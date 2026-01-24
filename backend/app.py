"""
DevGem Backend API
FastAPI server optimized for Google Cloud Run
بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
"""
import traceback


from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os
from dotenv import load_dotenv
import asyncio
from datetime import datetime
import json
import uuid
import traceback
import hashlib
import re

from agents.orchestrator import OrchestratorAgent
from services.deployment_service import deployment_service
from services.user_service import user_service
from services.usage_service import usage_service
from middleware.usage_tracker import UsageTrackingMiddleware
from models import DeploymentStatus, PlanTier

# Import progress notifier
import sys
sys.path.append(os.path.dirname(__file__))
from utils.progress_notifier import ProgressNotifier, DeploymentStages
from services.session_store import get_session_store

load_dotenv()

app = FastAPI(
    title="DevGem API",
    description="AI-powered Cloud Run deployment assistant",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Usage tracking middleware
app.add_middleware(UsageTrackingMiddleware)

# Store active WebSocket connections with metadata
active_connections: dict[str, dict] = {}

# Store orchestrator instances per session (CRITICAL FIX for deployment loop)
# This preserves project context across reconnections
session_orchestrators: dict[str, OrchestratorAgent] = {}

# Initialize global orchestrator (fallback only)
orchestrator = OrchestratorAgent(
    gcloud_project=os.getenv('GOOGLE_CLOUD_PROJECT'),
    github_token=os.getenv('GITHUB_TOKEN'),
    location=os.getenv('GOOGLE_CLOUD_REGION', 'us-central1')
)

# Initialize Session Store (Redis or Memory)
session_store = get_session_store()


class ChatMessage(BaseModel):
    message: str
    session_id: str


# ============================================================================
# HELPER FUNCTIONS FOR SAFE WEBSOCKET SENDING
# ============================================================================

async def safe_send_json(session_id: str, data: dict) -> bool:
    """
    Safely send JSON to WebSocket, handling all error cases.
    Returns True if sent successfully, False otherwise.
    """
    if session_id not in active_connections:
        print(f"[WebSocket] [WARNING] Session {session_id} not in active connections")
        return False
    
    connection_info = active_connections[session_id]
    websocket = connection_info['websocket']
    
    try:
        # Check if WebSocket is in a state that can send
        if websocket.client_state.name != "CONNECTED":
            print(f"[WebSocket] [WARNING] Session {session_id} not connected (state: {websocket.client_state.name})")
            return False
        
        # Try to send
        await websocket.send_json(data)
        # ✅ CRITICAL: Force event loop flush for real-time responsiveness
        await asyncio.sleep(0)
        print(f"[WebSocket] [SUCCESS] Sent to {session_id}: {data.get('type', 'unknown')}")
        return True
        
    except RuntimeError as e:
        if "close message has been sent" in str(e):
            print(f"[WebSocket] [WARNING] Session {session_id} already closed, removing from active connections")
            # Remove from active connections
            if session_id in active_connections:
                del active_connections[session_id]
            return False
        else:
            print(f"[WebSocket] [ERROR] RuntimeError sending to {session_id}: {e}")
            return False
            
    except Exception as e:
        print(f"[WebSocket] [ERROR] Error sending to {session_id}: {e}")
        return False


async def broadcast_to_session(session_id: str, data: dict):
    """Broadcast message to a specific session with retries"""
    max_retries = 3
    for attempt in range(max_retries):
        success = await safe_send_json(session_id, data)
        if success:
            return True
        
        if attempt < max_retries - 1:
            print(f"[WebSocket] 🔄 Retry {attempt + 1}/{max_retries} for session {session_id}")
            await asyncio.sleep(0.5)
    
    print(f"[WebSocket] [ERROR] Failed to send to {session_id} after {max_retries} attempts")
    return False


# ============================================================================
# SESSION CLEANUP TASK
# ============================================================================

async def cleanup_memory_cache():
    """Periodically clean up in-memory orchestrator cache"""
    while True:
        try:
            await asyncio.sleep(1800)  # Check every 30 minutes
            
            # Clear cache entries that aren't active connections
            # The actual state is safe in Redis
            keys_to_remove = [
                sid for sid in session_orchestrators 
                if sid not in active_connections
            ]
            
            for sid in keys_to_remove:
                del session_orchestrators[sid]
                
            if keys_to_remove:
                print(f"[Cleanup] Cleared {len(keys_to_remove)} orchestrators from RAM cache")
                
        except Exception as e:
            print(f"[Cleanup] Error in cache cleanup task: {e}")

async def cleanup_active_connections():
    """Monitor heartbeat health and cleanup stale connections"""
    print("[Cleanup] Connection monitor started")
    while True:
        try:
            await asyncio.sleep(60)  # Check every minute
            
            now = datetime.now()
            stale_threshold = 600  # 10 minutes (Allow for long GCP deployments)
            
            sid_to_remove = []
            for sid, info in active_connections.items():
                last_seen = info.get('last_seen_at')
                if last_seen and (now - last_seen).total_seconds() > stale_threshold:
                    sid_to_remove.append(sid)
            
            for sid in sid_to_remove:
                print(f"[Cleanup] Removing stale connection: {sid} (No heartbeat for {stale_threshold}s)")
                # Cancel keep-alive
                info = active_connections[sid]
                if 'keep_alive_task' in info:
                    info['keep_alive_task'].cancel()
                # Remove
                del active_connections[sid]
                
        except Exception as e:
            print(f"[Cleanup] Error in connection cleanup task: {e}")

@app.on_event("startup")
async def startup_event():
    """Start background tasks on server startup"""
    asyncio.create_task(cleanup_memory_cache())
    asyncio.create_task(cleanup_active_connections())
    print("[DevGem] Background cleanup tasks started")


# ============================================================================
# KEEP-ALIVE TASK
# ============================================================================

async def keep_alive_task(session_id: str):
    """Send periodic pings to keep connection alive"""
    while session_id in active_connections:
        try:
            await asyncio.sleep(30)  # Ping every 30 seconds
            
            if session_id in active_connections:
                success = await safe_send_json(session_id, {
                    'type': 'ping',
                    'timestamp': datetime.now().isoformat()
                })
                if success:
                    # PROACTIVE HEARTBEAT: If we successfully sent a ping, the socket is alive.
                    # This prevents cleanup even if the client (browser tab) is throttled/lazy with pongs.
                    active_connections[session_id]['last_seen_at'] = datetime.now()
                    print(f"[WebSocket] 🏓 Heartbeat sent to {session_id}")
        except asyncio.CancelledError:
            print(f"[WebSocket] Keep-alive task cancelled for {session_id}")
            break
        except Exception as e:
            print(f"[WebSocket] [ERROR] Keep-alive error for {session_id}: {e}")
            break


# ============================================================================
# MAIN ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "DevGem",
        "status": "operational",
        "version": "1.0.0"
    }


@app.get("/api/chat/sessions")
async def list_chat_sessions():
    """List all available chat sessions with metadata"""
    try:
        session_ids = await session_store.list_sessions()
        rich_sessions = []
        
        # Helper to extract metadata
        for sid in session_ids:
            try:
                # Try RAM cache first (fastest)
                if sid in session_orchestrators:
                    agent = session_orchestrators[sid]
                    ctx = agent.project_context
                    # Get title from context or use default
                    title = ctx.get('custom_title') or ctx.get('service_name') or ctx.get('repo_url', '').split('/')[-1] or "New Session"
                    
                    # Get timestamp
                    timestamp = datetime.now().isoformat()
                    if agent.conversation_history:
                        # Try to get last message time
                        pass 
                    
                    rich_sessions.append({
                        "id": sid,
                        "title": title,
                        "timestamp": timestamp, # ideally track last_active
                        "preview": "Active in memory"
                    })
                else:
                    # Load from Redis (slower but necessary for history)
                    state = await session_store.load_session(sid)
                    if state:
                        ctx = state.get('project_context', {})
                        title = ctx.get('custom_title') or ctx.get('service_name') or ctx.get('repo_url', '').split('/')[-1] or "Saved Session"
                        
                        # Get timestamp from last history item if possible
                        history = state.get('history', [])
                        timestamp = datetime.now().isoformat()
                        if history:
                             # last item
                             pass
                             
                        rich_sessions.append({
                            "id": sid,
                            "title": title,
                            "timestamp": timestamp,
                            "preview": "Restored"
                        })
            except Exception as e:
                print(f"[Sessions] Error processing {sid}: {e}")
                
        # Sort by timestamp descending (if we had real timestamps)
        return {"sessions": rich_sessions}
    except Exception as e:
        print(f"[Sessions] [ERROR] {e}")
        return {"sessions": []}


@app.delete("/api/chat/history/{session_id}")
async def delete_chat_session(session_id: str):
    """Permanently delete a chat session and its history"""
    try:
        # 1. Remove from RAM cache if exists
        if session_id in session_orchestrators:
            del session_orchestrators[session_id]
            
        # 2. Remove from Redis
        success = await session_store.delete_session(session_id)
        return {"success": success}
    except Exception as e:
        print(f"[Sessions] [ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/history")
async def get_chat_history(payload: dict):
    """
    Retrieve chat history and session state for rehydration.
    Used for persistence across page refreshes.
    """
    session_id = payload.get('session_id')
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
        
    try:
        # ✅ CRITICAL FIX: ALWAYS load from Redis first for authoritative history
        # RAM cache may have stale or transient data
        state = await session_store.load_session(session_id)
        
        if state:
            print(f"[History] ✅ Loaded from Redis for {session_id}")
        elif session_id in session_orchestrators:
            # Fallback to RAM only if Redis has no data
            state = session_orchestrators[session_id].get_state()
            print(f"[History] ⚠️ RAM fallback for {session_id} (not in Redis)")
        
        if not state:
            return {"messages": [], "activeDeployment": None}
            
        ui_history = state.get('ui_history', [])
        project_context = state.get('project_context', {})
        
        # Priority 1: Use High-Fidelity UI History (if available)
        frontend_messages = []
        
        if ui_history:
            print(f"[History] Using UI history for {session_id} ({len(ui_history)} turns)")
            for i, turn in enumerate(ui_history):
                frontend_messages.append({
                    "id": turn.get('id', f"ui-{i}-{uuid.uuid4().hex[:4]}"),
                    "role": turn.get('role', 'assistant'),
                    "content": turn.get('content', ''),
                    "metadata": turn.get('metadata', {}),
                    "data": turn.get('data'),
                    "actions": turn.get('actions'),
                    "timestamp": turn.get('timestamp') or datetime.now().isoformat()
                })
        else:
            # Priority 2: Fallback to Gemini History (legacy sessions or fresh ones)
            print(f"[History] Falling back to Gemini history for {session_id}")
            history_data = state.get('history', [])
            
            for i, turn in enumerate(history_data):
                role = 'user' if turn.get('role') == 'user' else 'assistant'
                parts = turn.get('parts', [])
                content = "".join([p.get('text', '') for p in parts if 'text' in p])
                
                frontend_messages.append({
                    "id": f"hist-{i}-{uuid.uuid4().hex[:4]}",
                    "role": role,
                    "content": content,
                    "timestamp": datetime.now().isoformat()
                })
            
        # ✅ FIX: Deployment Persistence
        # Priority 1: Use persisted structured state
        active_deployment = state.get('active_deployment')
        
        # Priority 2: Fallback to reconstruction from project context
        if not active_deployment and project_context.get('deployment_id'):
            print(f"[History] Reconstructing deployment state for {session_id}")
            active_deployment = {
                'deploymentId': project_context.get('deployment_id'),
                'status': 'success' if project_context.get('deployment_url') else 'deploying',
                'currentStage': 'COMPLETE' if project_context.get('deployment_url') else 'DEPLOY_SERVICE',
                'stages': [], # Frontend will re-hydrate default stages
                'overallProgress': 100 if project_context.get('deployment_url') else 80,
                'startTime': datetime.now().isoformat() # Approx
            }

        return {
            "messages": frontend_messages, 
            "activeDeployment": active_deployment
        }

    except Exception as e:
        print(f"[History] [ERROR] {e}")
        return {"messages": [], "activeDeployment": None, "error": str(e)}


@app.get("/api/chat/sessions")
async def list_sessions():
    """List all available chat sessions with metadata"""
    try:
        session_ids = await session_store.list_sessions()
        sessions = []
        
        # In a real production app, we'd use MGET or store metadata separately
        # For now, we'll fetch individual sessions but cap functionality if too many
        # to prevent timeouts. Limit to most recent 20 ideally.
        
        for sid in session_ids:
            try:
                # 1. Check RAM cache first
                agent = session_orchestrators.get(sid)
                state = None
                
                if agent:
                    state = agent.get_state()
                else:
                    state = await session_store.load_session(sid)
                
                if state:
                    # Extract metadata
                    title = state.get('title', 'New Chat')
                    timestamp = state.get('timestamp') or datetime.now().isoformat()
                    
                    # Try to find a better title if "New Chat"
                    if title == "New Chat":
                         history = state.get('history', [])
                         if history:
                             # Use first user message
                             first_user = next((m for m in history if m.get('role') == 'user'), None)
                             if first_user:
                                 parts = first_user.get('parts', [])
                                 text = "".join([p.get('text', '') for p in parts])
                                 if text:
                                     title = text[:30] + "..."
                    
                    sessions.append({
                        "id": sid,
                        "title": title,
                        "timestamp": timestamp,
                        "preview": "..." # Could extract last message
                    })
            except Exception as e:
                print(f"[Sessions] Error loading {sid}: {e}")
                continue
                
        # Sort by timestamp descending
        sessions.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return {"sessions": sessions}
    except Exception as e:
        print(f"[Sessions] List error: {e}")
        return {"sessions": [], "error": str(e)}


@app.patch("/api/chat/sessions/{session_id}")
async def update_session_title(session_id: str, payload: dict):
    """Update title for a specific session"""
    new_title = payload.get('title')
    if not new_title:
        raise HTTPException(status_code=400, detail="title required")
        
    try:
        # 1. Try RAM cache first
        agent = None
        if session_id in session_orchestrators:
            agent = session_orchestrators[session_id]
        else:
            # 2. Try loading from Session Store (Redis)
            state = await session_store.load_session(session_id)
            if state:
                # We need to temporarily recreate agent to save it back
                # This is slightly expensive but rare (user renaming old session)
                gcloud_project = os.getenv('GOOGLE_CLOUD_PROJECT')
                agent = OrchestratorAgent(gcloud_project=gcloud_project)
                agent.load_state(state)
        
        if not agent:
            raise HTTPException(status_code=404, detail="Session not found")
            
        # Update custom title in context
        agent.project_context['custom_title'] = new_title
        
        # Save back to Redis
        await session_store.save_session(session_id, agent.get_state())
        
        return {"success": True, "title": new_title}
    except Exception as e:
        print(f"[Sessions] [ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check for Cloud Run"""
    return {
        "status": "healthy",
        "service": "DevGem Backend",
        "timestamp": datetime.now().isoformat()
    }


@app.post("/chat")
async def chat(message: ChatMessage):
    """HTTP endpoint for chat (non-streaming)"""
    try:
        response = await orchestrator.process_message(
            message.message,
            message.session_id
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/auth/github/login")
async def github_login():
    """Start GitHub OAuth flow"""
    from services.github_auth import GitHubAuthService
    auth_service = GitHubAuthService()
    try:
        url = auth_service.get_authorization_url()
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/auth/github/callback")
async def github_callback(payload: dict):
    """Exchange code for token"""
    code = payload.get('code')
    if not code:
        raise HTTPException(status_code=400, detail="Code required")
        
    from services.github_auth import GitHubAuthService
    auth_service = GitHubAuthService()
    
    try:
        token_data = auth_service.exchange_code_for_token(code)
        
        # Verify token works by getting user info
        user_info = auth_service.get_user_info(token_data['access_token'])
        
        return {
            "token": token_data['access_token'],
            "user": user_info
        }
    except Exception as e:
        print(f"Callback error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# GOOGLE OAUTH ENDPOINTS
# ============================================================================

@app.get("/auth/google/login")
async def google_login():
    """Start Google OAuth flow"""
    from services.google_auth import GoogleAuthService
    auth_service = GoogleAuthService()
    try:
        url = auth_service.get_authorization_url()
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/google/callback")
async def google_callback(payload: dict):
    """Exchange code for token"""
    code = payload.get('code')
    if not code:
        raise HTTPException(status_code=400, detail="Code required")
        
    from services.google_auth import GoogleAuthService
    auth_service = GoogleAuthService()
    
    try:
        token_data = auth_service.exchange_code_for_token(code)
        
        # Get user info
        user_info = auth_service.get_user_info(token_data['access_token'])
        
        return {
            "token": token_data['access_token'],
            "user": user_info
        }
    except Exception as e:
        print(f"Google callback error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket, api_key: Optional[str] = Query(None), github_token: Optional[str] = Query(None)):
    """
    WebSocket endpoint with bulletproof error handling
    بِسْمِ اللَّهِ - In the name of Allah, the Most Gracious, the Most Merciful
    """
    
    session_id = None
    user_api_key = api_key
    keep_alive = None
    
    try:
        # Vertex AI uses Google Cloud authentication - no API key needed
        gcloud_project = os.getenv('GOOGLE_CLOUD_PROJECT')
        gcloud_region = os.getenv('GOOGLE_CLOUD_REGION', 'us-central1')
        
        if not gcloud_project:
            await websocket.close(code=1008, reason="Google Cloud project not configured")
            return
        
        await websocket.accept()
        print(f"[WebSocket] [SUCCESS] Connection accepted (Using Vertex AI with project: {gcloud_project})")
        
        # Receive init message
        init_message = await asyncio.wait_for(
            websocket.receive_json(),
            timeout=10.0
        )
        
        message_type = init_message.get('type')
        
        if message_type != 'init':
            await websocket.close(code=1008, reason="Expected init message")
            return
        
        session_id = init_message.get('session_id', f'session_{uuid.uuid4().hex[:12]}')
        instance_id = init_message.get('instance_id', 'unknown')
        is_reconnect = init_message.get('is_reconnect', False)
        
        print(f"[WebSocket] 🔌 Client connecting:")
        print(f"  Session ID: {session_id}")
        print(f"  Instance ID: {instance_id}")
        print(f"  Reconnect: {is_reconnect}")
        
        # Handle reconnection
        if session_id in active_connections:
            print(f"[WebSocket] 🔄 Reconnection detected for {session_id}")
            old_connection = active_connections[session_id]
            old_ws = old_connection['websocket']
            old_keep_alive = old_connection.get('keep_alive_task')
            
            # Cancel old keep-alive task
            if old_keep_alive and not old_keep_alive.done():
                old_keep_alive.cancel()
                try:
                    await old_keep_alive
                except asyncio.CancelledError:
                    pass
            
            # Close old WebSocket gracefully
            try:
                await old_ws.close(code=1000, reason="Client reconnected")
            except:
                pass
        
        # Store new connection
        keep_alive = asyncio.create_task(keep_alive_task(session_id))
        
        active_connections[session_id] = {
            'websocket': websocket,
            'keep_alive_task': keep_alive,
            'connected_at': datetime.now().isoformat(),
            'last_seen_at': datetime.now(),
            'instance_id': instance_id
        }
        
        print(f"[WebSocket] [SUCCESS] Session {session_id} registered. Active: {len(active_connections)}")
        
        # CRITICAL FIX: Smart caching strategy with stale detection
        user_orchestrator = None
        
        # Extract Gemini API key from query params (from user's localStorage)
        gemini_key = user_api_key
        
        # 1. ALWAYS check Redis first to determine if this is a genuinely new session
        saved_state = await session_store.load_session(session_id)
        
        # 2. Try RAM cache, but validate it's not stale
        if session_id in session_orchestrators:
            if saved_state:
                # Session exists in both RAM and Redis - use RAM (faster)
                user_orchestrator = session_orchestrators[session_id]
                print(f"[WebSocket] ⚡ RAM Cache hit for {session_id}")
            else:
                # ✅ CRITICAL FIX: Session in RAM but NOT in Redis = STALE
                # This happens when user clicked "New Thread" which generates new session ID
                print(f"[WebSocket] 🧹 Clearing STALE RAM orchestrator for {session_id}")
                del session_orchestrators[session_id]
                # Fall through to create fresh orchestrator
        
        # 3. Create new orchestrator if needed
        if user_orchestrator is None:
            user_orchestrator = OrchestratorAgent(
                gcloud_project=gcloud_project,
                github_token=github_token or os.getenv('GITHUB_TOKEN'),
                location=gcloud_region,
                gemini_api_key=gemini_key
            )
            
            if saved_state:
                print(f"[WebSocket] 💾 Loaded state from Redis for {session_id}")
                user_orchestrator.load_state(saved_state)
            else:
                print(f"[WebSocket] ✨ Created FRESH orchestrator for {session_id}")
                
            # Update RAM cache
            session_orchestrators[session_id] = user_orchestrator
            
        # ✅ FIX: Setup save callback for real-time persistence
        async def trigger_save():
            try:
                state = user_orchestrator.get_state()
                await session_store.save_session(session_id, state)
            except Exception as e:
                print(f"[WebSocket] [ERROR] Failed to background save session {session_id}: {e}")
        
        user_orchestrator.save_callback = trigger_save
        user_orchestrator.safe_send = safe_send_json
        user_orchestrator.session_id = session_id
        
        # Get or initialize session env vars from orchestrator context
        session_env_vars = user_orchestrator.project_context.get('env_vars', {})
        
        # Send connection confirmation
        await safe_send_json(session_id, {
            'type': 'connected',
            'session_id': session_id,
            'message': 'Connected to DevGem AI - Ready to deploy!'
        })
        
        # Message loop with timeout
        while True:
            try:
                # ✅ CRITICAL FIX: Extended timeout for long-running deployments
                # Cloud Build can take 5-10 minutes (or 20 for massive ones)
                data = await asyncio.wait_for(
                    websocket.receive_json(),
                    timeout=1200.0  # 20 minute timeout for deployment operations
                )
                
                # Update last seen
                if session_id in active_connections:
                    active_connections[session_id]['last_seen_at'] = datetime.now()
            except asyncio.TimeoutError:
                # Timeout is OK, just continue loop
                continue
            except RuntimeError as e:
                # WebSocket disconnected while waiting for message
                print(f"[WebSocket] [WARNING] RuntimeError in receive loop for {session_id}: {e}")
                break
            except WebSocketDisconnect:
                # Client disconnected normally
                print(f"[WebSocket] 🔌 Client {session_id} disconnected during receive")
                break
            except Exception as e:
                # Any other error during receive
                print(f"[WebSocket] [ERROR] Error receiving from {session_id}: {e}")
                break
            
            msg_type = data.get('type')
            if msg_type != 'pong': # Reduce noise
                 print(f"[WebSocket] [DEBUG] Received message type: {msg_type}, Keys: {list(data.keys())}")
            
            # Handle pong response
            if msg_type == 'pong':
                print(f"[WebSocket] [INFO] Heartbeat pong received from {session_id}")
                continue
            
            # Handle env vars
            if msg_type == 'env_vars_uploaded':
                variables = data.get('variables', [])
                count = data.get('count', len(variables))
                
                print(f"[WebSocket] [INFO] Received {count} env vars")
                
                # Store env vars in both session and orchestrator context
                for var in variables:
                    session_env_vars[var['key']] = {
                        'value': var['value'],
                        'isSecret': var.get('isSecret', False)
                    }
                
                user_orchestrator.project_context['env_vars'] = session_env_vars
                
                # 
                # FAANG-LEVEL FIX: Hybrid Persistence (Cloud + Local Fallback)
                
              
                try:
                    # ✅ FAANG FIX: Prioritize repo_url from message payload (Bridge Session Gaps)
                    repo_url = data.get('repo_url') or user_orchestrator.project_context.get('repo_url')
                    
                    if repo_url:
                        # Auto-rehydrate orchestrator context if missing
                        if not user_orchestrator.project_context.get('repo_url'):
                            print(f"[WebSocket] [REHYDRATION] 🧲 Auto-rehydrating repo_url into orchestrator context: {repo_url}")
                            user_orchestrator.project_context['repo_url'] = repo_url
                        
                        # 1. Parse details
                        parts = repo_url.strip('/').split('/')
                        if len(parts) >= 2:
                            user_name = parts[-2]
                            repo_name = parts[-1].replace('.git', '')
                        else:
                            user_name = 'default'
                            repo_name = parts[-1].replace('.git', '')

                        # 2. Strategy A: Google Secret Manager (Primary)
                        safe_user = re.sub(r'[^a-zA-Z0-9]', '', user_name).lower()
                        safe_repo = re.sub(r'[^a-zA-Z0-9-]', '-', repo_name).lower()
                        safe_repo = re.sub(r'-+', '-', safe_repo).strip('-')
                        secret_id = f"devgem-{safe_user}-{safe_repo}-env"
                        
                        try:
                            print(f"[WebSocket] [GSM] Attempting to save to Secret Manager: {secret_id}")
                            success = await user_orchestrator.gcloud_service.create_or_update_secret(secret_id, session_env_vars)
                            if success:
                                print(f"[WebSocket] [GSM] ✅ Cloud save success.")
                            else:
                                print(f"[WebSocket] [GSM] ⚠️ Cloud save returned failure.")
                        except Exception as gsm_e:
                            print(f"[WebSocket] [GSM] ❌ Cloud save failed: {gsm_e}")

                        # 3. Strategy B: Global Local Store (Backup)
                        # Saves to ~/.gemini/antigravity/env_store/<repo_hash>.json
                        try:
                            repo_hash = hashlib.md5(repo_url.encode()).hexdigest()
                            home = os.path.expanduser("~")
                            store_dir = os.path.join(home, ".gemini", "antigravity", "env_store")
                            os.makedirs(store_dir, exist_ok=True)
                            global_env_file = os.path.join(store_dir, f"{repo_hash}.json")
                            with open(global_env_file, 'w') as f:
                                json.dump(session_env_vars, f, indent=2)
                            print(f"[WebSocket] [BACKUP] ✅ Saved to local global store: {repo_hash}.json")
                        except Exception as file_e:
                            print(f"[WebSocket] [BACKUP] ❌ Local store failed: {file_e}")

                        # 4. Strategy C: Project-Local Store (Priority for deployment)
                        # Saves to <project_path>/.devgem_env.json
                        project_path = user_orchestrator.project_context.get('project_path')
                        if project_path and os.path.exists(project_path):
                            try:
                                project_env_file = os.path.join(project_path, '.devgem_env.json')
                                with open(project_env_file, 'w') as f:
                                    json.dump(session_env_vars, f, indent=2)
                                print(f"[WebSocket] [PROJECT] ✅ Saved to project local store: {project_env_file}")
                            except Exception as proj_e:
                                print(f"[WebSocket] [PROJECT] ❌ Project store failed: {proj_e}")

                    else:
                        print(f"[WebSocket] [PERSISTENCE] Warning: No repo_url found.")

                except Exception as e:
                    print(f"[WebSocket] [PERSISTENCE] Critical error: {e}")
                    traceback.print_exc()
                
                # ✅ CRITICAL FIX: Force Save to Redis IMMEDIATELY
                # This prevents "Amnesia" if the user disconnects/reconnects right after upload
                try:
                    await session_store.save_session(session_id, user_orchestrator.get_state())
                    print(f"[WebSocket] [PERSISTENCE] 💾 Saved session state to Redis after Env Var upload for {session_id}")
                except Exception as save_e:
                    print(f"[WebSocket] [ERROR] Failed to save state to Redis: {save_e}")


                print(f"[WebSocket] [SUCCESS] Env vars processing complete. Count: {count}")
                
                # ===========================================================================
                # ✅ FAANG-LEVEL FIX: Auto-proceed to deployment after env vars upload
                # Instead of waiting for user to say "deploy", directly trigger deployment
                # This provides the seamless UX expected after .env configuration
                # ===========================================================================
                
                # Send progress update to let user know we're proceeding
                await safe_send_json(session_id, {
                    'type': 'message',
                    'data': {
                        'content': f"✅ **{count} environment variables configured!** Proceeding to deployment...",
                        'metadata': {'type': 'env_vars_confirmed', 'env_vars_count': count}
                    },
                    'timestamp': datetime.now().isoformat()
                })
                
                # ✅ FAANG-LEVEL FIX: Avoid duplicate deployment triggers
                if existing_deployment and existing_deployment.get('status') == 'deploying':
                    print(f"[WebSocket] 🛑 Deployment already in progress for {session_id}. Ignoring redundant trigger.")
                    return
                
                if existing_deployment and existing_deployment.get('deploymentId'):
                    deployment_id = existing_deployment['deploymentId']
                    print(f"[WebSocket] ♻️ Resuming deployment: {deployment_id}")
                    
                    # Send deployment_resumed to preserve frontend state
                    await safe_send_json(session_id, {
                        "type": "deployment_resumed",
                        "deployment_id": deployment_id,
                        "resume_stage": "container_build",
                        "resume_progress": 25,
                        "timestamp": datetime.now().isoformat()
                    })
                else:
                    deployment_id = f"deploy-{uuid.uuid4().hex[:8]}"
                    print(f"[WebSocket] Starting fresh deployment: {deployment_id}")
                    
                    await safe_send_json(session_id, {
                        "type": "deployment_started",
                        "deployment_id": deployment_id,
                        "message": "[DEPLOY] Starting deployment after env configuration...",
                        "timestamp": datetime.now().isoformat()
                    })
                
                progress_notifier = ProgressNotifier(
                    session_id,
                    deployment_id,
                    safe_send_json
                )
                
                try:
                    # ✅ DIRECT DEPLOY: Bypass Gemini and go straight to Cloud Run
                    # FAANG Architecture: Explicit Data Passing (No Side Effects)
                    flat_env_vars = {
                       k: v.get('value', '') if isinstance(v, dict) else v 
                       for k, v in session_env_vars.items()
                    }
                    
                    print(f"[DEBUG APP] Calling _direct_deploy on Orchestrator ID: {id(user_orchestrator)}")
                    print(f"[DEBUG APP] Explicitly passing {len(flat_env_vars)} env vars")
                    
                    # [SUCCESS] PHASE 10 FIX: Create progress_callback wrapper to forward to DPMP
                    # This ensures all stages (Security Scan, Container Build, Cloud Deployment) are visible
                    async def progress_callback_wrapper(data):
                        """Forward progress updates to frontend via WebSocket"""
                        try:
                            if isinstance(data, dict):
                                # Extract message from various formats
                                message = data.get('message') or data.get('data', {}).get('content', '')
                                stage = data.get('stage', 'deployment')
                                progress = data.get('progress', 0)
                                
                                if message:
                                    # ✅ UX FIX: Send as 'deployment_progress' (FLAT structure)
                                    await safe_send_json(session_id, {
                                        'type': 'deployment_progress', 
                                        'stage': stage,
                                        'status': 'in-progress',
                                        'message': message,
                                        'progress': progress,
                                        'metadata': {
                                            'type': 'progress_update',
                                            'stage': stage,
                                            'timestamp': datetime.now().isoformat()
                                        }
                                    })
                        except Exception as e:
                            print(f"[WebSocket] [WARNING] Progress callback error: {e}")
                    response = await user_orchestrator._direct_deploy(
                        progress_notifier=progress_notifier,
                        progress_callback=progress_callback_wrapper,  # [SUCCESS] Now not None!
                        ignore_env_check=True,  # Bypass prompt
                        explicit_env_vars=flat_env_vars # ✅ Override with guaranteed data
                    )
                    
                    # Send response
                    await safe_send_json(session_id, {
                        'type': 'message',
                        'data': response,
                        'timestamp': datetime.now().isoformat()
                    })
                    
                    # Save state
                    await session_store.save_session(
                        session_id,
                        user_orchestrator.get_state()
                    )
                    
                except Exception as deploy_error:
                    print(f"[WebSocket] [ERROR] Auto-deploy failed: {deploy_error}")
                    traceback.print_exc()
                    
                    await safe_send_json(session_id, {
                        'type': 'error',
                        'message': f'Deployment error: {str(deploy_error)}',
                        'code': 'DEPLOY_ERROR',
                        'timestamp': datetime.now().isoformat()
                    })
                
                continue
            
            # Handle chat messages
            if msg_type == 'message':
                message = data.get('message')
                metadata = data.get('metadata', {})  # ✅ Extract metadata
                
                if not message:
                    continue
                
                # ✅ FAANG-LEVEL FIX: Explicitly handle "Skip Env Vars" action
                # This ensures deterministic deployment triggering without relaying on LLM interpretation
                if metadata.get('type') == 'env_skip':
                    print(f"[WebSocket] ⏩ User requested SKIP env vars for session {session_id}")
                    
                    # 1. Notify user
                    await safe_send_json(session_id, {
                        'type': 'message',
                        'data': {
                            'content': "🚀 **Launch sequence initiated!** Skipping environment variables...",
                            'metadata': {'type': 'system'}
                        },
                        'timestamp': datetime.now().isoformat()
                    })
                    
                    # 2. Initialize Deployment ID
                    deployment_id = f"deploy-{uuid.uuid4().hex[:8]}"
                    
                    # 3. Send Global 'deployment_started' event (Wakes up UI Panel)
                    await safe_send_json(session_id, {
                        "type": "deployment_started",
                        "deployment_id": deployment_id,
                        "message": "[DEPLOY] Launching directly (No Env Vars)...",
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # 4. Create Notifier & Callback
                    progress_notifier = ProgressNotifier(session_id, deployment_id, safe_send_json)
                    
                    async def progress_callback_wrapper(data):
                        try:
                            if isinstance(data, dict):
                                message = data.get('message') or data.get('data', {}).get('content', '')
                                stage = data.get('stage', 'deployment')
                                progress = data.get('progress', 0)
                                if message:
                                    await safe_send_json(session_id, {
                                        'type': 'deployment_progress', 
                                        'stage': stage, 
                                        'status': 'in-progress', 
                                        'message': message, 
                                        'progress': progress,
                                        'metadata': {'type': 'progress_update', 'stage': stage}
                                    })
                        except Exception as e:
                            print(f"[WebSocket] Progress callback error: {e}")

                    # 5. Trigger Direct Deploy
                    try:
                        print(f"[WebSocket] ⚡ Triggering _direct_deploy (Skip Mode)")
                        response = await user_orchestrator._direct_deploy(
                            progress_notifier=progress_notifier,
                            progress_callback=progress_callback_wrapper,
                            ignore_env_check=True,
                            explicit_env_vars={}  # Empty dict for skip
                        )
                        
                        await safe_send_json(session_id, {
                            'type': 'message',
                            'data': response,
                            'timestamp': datetime.now().isoformat()
                        })
                        
                        await session_store.save_session(session_id, user_orchestrator.get_state())
                        
                    except Exception as deploy_error:
                         print(f"[WebSocket] [ERROR] Skip-deploy failed: {deploy_error}")
                         await safe_send_json(session_id, {
                            'type': 'error',
                            'message': f'Deployment error: {str(deploy_error)}',
                            'code': 'DEPLOY_ERROR'
                        })
                    
                    continue # Skip LLM processing
                
                # ✅ CRITICAL FIX: Update GitHub token from metadata if provided
                # This is sent from Deploy.tsx when selecting a repo
                github_token = metadata.get('githubToken')
                if github_token:
                    print(f"[WebSocket] 🔑 Updating GitHub token for session {session_id}")
                    # Update the orchestrator's GitHub service with the new token
                    from services.github_service import GitHubService
                    user_orchestrator.github_service = GitHubService(github_token)
                    print(f"[WebSocket] [SUCCESS] GitHub token updated successfully")
                
                # Typing indicator
                await safe_send_json(session_id, {
                    'type': 'typing',
                    'timestamp': datetime.now().isoformat()
                })

                # ✅ EAGER SAVE: Index the session immediately so it appears in history
                # This ensures the "New Thread" title updates as soon as the first message is sent
                try:
                    await session_store.save_session(
                        session_id, 
                        user_orchestrator.get_state()
                    )
                except Exception as e:
                    print(f"[WebSocket] [WARNING] Eager save failed: {e}")
                
                # Check for deployment keywords
                deployment_keywords = ['deploy', 'start', 'begin', 'launch', 'go ahead', 'yes', 'proceed']
                might_deploy = any(keyword in message.lower() for keyword in deployment_keywords)
                
                # Create progress notifier - SMART RESUMPTION
                progress_notifier = None
                if might_deploy:
                    # ✅ SMART RESUMPTION: Check if orchestrator already has an active deployment
                    existing_deployment = getattr(user_orchestrator, 'active_deployment', None)
                    
                    if existing_deployment and existing_deployment.get('deploymentId'):
                        deployment_id = existing_deployment['deploymentId']
                        print(f"[WebSocket] 🧬 Resuming existing deployment: {deployment_id}")
                        
                        # Only send started notice if requested explicitly or if panel might be gone
                        # But DON'T send 'deployment_started' as it resets everything in frontend
                        # Instead we just create the notifier with existing ID
                    else:
                        deployment_id = f"deploy-{uuid.uuid4().hex[:8]}"
                        print(f"[WebSocket] ✨ Created NEW progress notifier: {deployment_id}")
                        
                        # Send deployment started (only for fresh deployments)
                        await safe_send_json(session_id, {
                            "type": "deployment_started",
                            "deployment_id": deployment_id,
                            "message": "[DEPLOY] Starting deployment process...",
                            "timestamp": datetime.now().isoformat()
                        })
                    
                    # Pass session_id and safe_send function
                    progress_notifier = ProgressNotifier(
                        session_id, 
                        deployment_id, 
                        safe_send_json  # Pass the safe send function!
                    )
                
                # Process message
                try:
                    response = await user_orchestrator.process_message(
                        message,
                        session_id,
                        progress_notifier=progress_notifier,
                        safe_send=safe_send_json  # Pass safe_send for progress messages during analysis
                    )
                    
                    # Send response
                    await safe_send_json(session_id, {
                        'type': 'message',
                        'data': response,
                        'timestamp': datetime.now().isoformat()
                    })
                    
                    # ✅ SAVE STATE TO REDIS (Background safe)
                    await session_store.save_session(
                        session_id, 
                        user_orchestrator.get_state()
                    )
                except Exception as e:
                    error_msg = str(e)
                    print(f"[WebSocket] [ERROR] Error processing message: {error_msg}")
                    print(traceback.format_exc())
                    
                    # Send error
                    if '429' in error_msg or 'quota' in error_msg.lower():
                        await safe_send_json(session_id, {
                            'type': 'error',
                            'message': 'API quota exceeded. Please try again later.',
                            'code': 'QUOTA_EXCEEDED',
                            'timestamp': datetime.now().isoformat()
                        })
                    elif '401' in error_msg or '403' in error_msg:
                        await safe_send_json(session_id, {
                            'type': 'error',
                            'message': 'Invalid API key. Please check Settings.',
                            'code': 'INVALID_API_KEY',
                            'timestamp': datetime.now().isoformat()
                        })
                    else:
                        await safe_send_json(session_id, {
                            'type': 'error',
                            'message': f'Error: {error_msg}',
                            'code': 'API_ERROR',
                            'timestamp': datetime.now().isoformat()
                        })
                continue
            
            # Handle session reset (New Thread)
            if msg_type == 'reset':
                print(f"[WebSocket] 🔄 Resetting session {session_id}")
                user_orchestrator.reset_context() 
                
                await safe_send_json(session_id, {
                    'type': 'message',
                    'data': {
                        'content': "Session context has been cleared. I'm ready for a fresh start! How can I help?",
                        'metadata': {'type': 'system'}
                    },
                    'timestamp': datetime.now().isoformat()
                })
                continue
    
    except WebSocketDisconnect:
        print(f"[WebSocket] 🔌 Client {session_id} disconnected normally")
    
    except asyncio.TimeoutError:
        print(f"[WebSocket] ⏰ Timeout for {session_id}")
    
    except Exception as e:
        print(f"[WebSocket] [ERROR] Error for {session_id}: {e}")
        print(traceback.format_exc())
    
    finally:
        # Cleanup
        if session_id and session_id in active_connections:
            connection_info = active_connections[session_id]
            
            # Cancel keep-alive
            if keep_alive and not keep_alive.done():
                keep_alive.cancel()
                try:
                    await keep_alive
                except asyncio.CancelledError:
                    pass
            
            # Remove from active connections
            del active_connections[session_id]
            print(f"[WebSocket] 🧹 Cleaned up connection for {session_id}. Active: {len(active_connections)}")
            
            # NOTE: We keep it in session_orchestrators (RAM) for short-term cache
            # But ensure it is saved to Redis one last time
            if session_id in session_orchestrators:
                # We can't access user_orchestrator variable here reliably if exception occurred early
                # So we fetch from cache
                agent = session_orchestrators[session_id]
                await session_store.save_session(session_id, agent.get_state())
                print(f"[WebSocket] 💾 Final state saved for {session_id}")


# ============================================================================
# User Management Endpoints
# ============================================================================

@app.post("/api/users")
async def create_user(
    email: str,
    username: str,
    display_name: str,
    avatar_url: Optional[str] = None,
    github_token: Optional[str] = None
):
    """Create new user account"""
    existing = user_service.get_user_by_email(email)
    if existing:
        return {"user": existing.to_dict(), "existing": True}
    
    user = user_service.create_user(
        email=email,
        username=username,
        display_name=display_name,
        avatar_url=avatar_url,
        github_token=github_token
    )
    
    return {"user": user.to_dict(), "existing": False}


@app.get("/api/users/{user_id}")
async def get_user(user_id: str):
    """Get user by ID"""
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.to_dict()


@app.patch("/api/users/{user_id}")
async def update_user(user_id: str, updates: dict):
    """Update user"""
    user = user_service.update_user(user_id, **updates)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user.to_dict()


@app.post("/api/users/{user_id}/upgrade")
async def upgrade_user(user_id: str, tier: str):
    """Upgrade user plan"""
    try:
        plan_tier = PlanTier(tier)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    user = user_service.upgrade_user_plan(user_id, plan_tier)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"user": user.to_dict(), "message": f"Upgraded to {tier}"}


# ============================================================================
# Deployment Management Endpoints
# ============================================================================

@app.get("/api/deployments")
async def list_deployments(user_id: str = Query(...)):
    """Get all deployments for user"""
    deployments = deployment_service.get_user_deployments(user_id)
    return {
        "deployments": [d.to_dict() for d in deployments],
        "count": len(deployments)
    }


@app.get("/api/deployments/{deployment_id}")
async def get_deployment(deployment_id: str):
    """Get deployment by ID"""
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment.to_dict()


@app.post("/api/deployments")
async def create_deployment(
    user_id: str,
    service_name: str,
    repo_url: str,
    region: str = "us-central1",
    env_vars: dict = None
):
    """Create new deployment"""
    user = user_service.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    active_count = len(deployment_service.get_active_deployments(user_id))
    if not user.can_deploy_more_services(active_count):
        raise HTTPException(
            status_code=403,
            detail=f"Deployment limit reached. Upgrade to deploy more services."
        )
    
    deployment = deployment_service.create_deployment(
        user_id=user_id,
        service_name=service_name,
        repo_url=repo_url,
        region=region,
        env_vars=env_vars
    )
    
    usage_service.track_deployment(user_id)
    
    return deployment.to_dict()


@app.patch("/api/deployments/{deployment_id}/status")
async def update_deployment_status(
    deployment_id: str,
    status: str,
    error_message: Optional[str] = None,
    gcp_url: Optional[str] = None
):
    """Update deployment status"""
    try:
        status_enum = DeploymentStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    deployment = deployment_service.update_deployment_status(
        deployment_id,
        status_enum,
        error_message=error_message,
        gcp_url=gcp_url
    )
    
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    return deployment.to_dict()


@app.delete("/api/deployments/{deployment_id}")
async def delete_deployment(deployment_id: str):
    """Delete deployment"""
    success = deployment_service.delete_deployment(deployment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    return {"message": "Deployment deleted successfully"}


@app.get("/api/deployments/{deployment_id}/events")
async def get_deployment_events(deployment_id: str, limit: int = 50):
    """Get deployment event log"""
    events = deployment_service.get_deployment_events(deployment_id, limit)
    return {
        "events": [e.to_dict() for e in events],
        "count": len(events)
    }


@app.post("/api/deployments/{deployment_id}/logs")
async def add_deployment_log(deployment_id: str, log_line: str):
    """Add build log line"""
    deployment_service.add_build_log(deployment_id, log_line)
    return {"message": "Log added"}


# ============================================================================
# Usage & Analytics Endpoints
# ============================================================================

@app.get("/api/usage/{user_id}/today")
async def get_today_usage(user_id: str):
    """Get today's usage for user"""
    usage = usage_service.get_today_usage(user_id)
    user = user_service.get_user(user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "usage": usage.to_dict(),
        "limits": {
            "max_services": user.max_services,
            "max_requests_per_day": user.max_requests_per_day,
            "max_memory_mb": user.max_memory_mb
        },
        "plan_tier": user.plan_tier.value
    }


@app.get("/api/usage/{user_id}/summary")
async def get_usage_summary(user_id: str, days: int = 30):
    """Get usage summary for last N days"""
    summary = usage_service.get_usage_summary(user_id, days)
    return summary


@app.get("/api/usage/{user_id}/monthly")
async def get_monthly_usage(user_id: str, year: int, month: int):
    """Get monthly usage"""
    usage_list = usage_service.get_monthly_usage(user_id, year, month)
    return {
        "usage": [u.to_dict() for u in usage_list],
        "month": f"{year}-{month:02d}"
    }


# ============================================================================
# Stats & Health
# ============================================================================

@app.get("/stats")
async def get_stats():
    """Get service statistics"""
    return {
        "active_connections": len(active_connections),
        "total_deployments": len(deployment_service._deployments),
        "total_users": len(user_service._users)
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "app:app", # Must use import string for reload to work
        host="0.0.0.0",
        port=port,
        log_level="info",
        reload=True # ✅ Enable auto-reload for FAANG-speed iteration
    )