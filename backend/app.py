"""
DevGem Backend API
FastAPI server optimized for Google Cloud Run
بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
"""
import sys
import traceback
import os
import json
import uuid
import re
import asyncio
import logging
import sys

# [SOVEREIGN BOOTSTRAPPING] 
# Windows requires ProactorEventLoop for subprocess support (Playwright, GCloud CLI)
# We enforce this at the highest level possible.
if sys.platform == 'win32':
    try:
        from asyncio import WindowsProactorEventLoopPolicy
        asyncio.set_event_loop_policy(WindowsProactorEventLoopPolicy())
        print("[System] [SUCCESS] Enforced WindowsProactorEventLoopPolicy for subprocess support.")
    except Exception as e:
        print(f"[System] [WARNING] Failed to set ProactorEventLoopPolicy: {e}")

# [FIXED] Force standard logging to stdout without stream reconfiguration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger("uvicorn")

from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from contextlib import asynccontextmanager

import hashlib

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Request, Depends, Body, BackgroundTasks, Response
from fastapi.responses import FileResponse, RedirectResponse
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
from services.branding_service import branding_service
from middleware.usage_tracker import UsageTrackingMiddleware
from models import DeploymentStatus, PlanTier, User

# Import progress notifier
import sys
sys.path.append(os.path.dirname(__file__))
from utils.progress_notifier import ProgressNotifier, DeploymentStages
from services.session_store import get_session_store

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Unified Application Lifespan Handler
    [FAANG-LEVEL] Managed resource initialization and cleanup
    """
    print("[System] 🚀 DevGem Backend Starting Up...")
    
    # Initialize Source Control Service (Smart Polling CI/CD)
    from services.source_control_service import source_control_service, RepoWatchConfig
    
    async def on_repo_changes(config: RepoWatchConfig, result):
        """Callback when changes are detected - trigger auto-redeploy"""
        print(f"[AutoDeploy] 🔄 Changes detected in {config.repo_url}, triggering redeploy...")
        try:
            # Get the orchestrator for this deployment
            deployment = deployment_service.get_deployment(config.deployment_id)
            if deployment and deployment.status.value == 'live':
                # Broadcast to connected clients
                await broadcast_to_all({
                    "type": "auto_deploy_triggered",
                    "deployment_id": config.deployment_id,
                    "repo_url": config.repo_url,
                    "commit_message": result.commit_message,
                    "commit_author": result.commit_author
                })
        except Exception as e:
            print(f"[AutoDeploy] Error triggering redeploy: {e}")
    
    source_control_service.register_callback(on_repo_changes)
    source_control_service.start_polling()
    
    # Initialize background tasks
    tasks = []
    tasks.append(asyncio.create_task(cleanup_memory_cache()))
    tasks.append(asyncio.create_task(cleanup_active_connections()))
    tasks.append(asyncio.create_task(monitoring_agent.start()))
    tasks.append(asyncio.create_task(monitor_deployments()))
    
    print("[DevGem] Background autonomous systems engaged")
    
    yield
    
    # Shutdown logic
    print("[System] 🛑 DevGem Backend Shutting Down...")
    for task in tasks:
        task.cancel()
    
    # Explicitly stop agents that have internal state
    monitoring_agent.stop()
    
    # Use gather with return_exceptions=True for clean exit
    await asyncio.gather(*tasks, return_exceptions=True)
    print("[System] 🛡️ All systems safely retired")

app = FastAPI(
    title="DevGem API",
    description="AI-powered Cloud Run deployment assistant",
    version="1.0.0",
    lifespan=lifespan
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

# [FAANG] Emergency Abort Control Plane
# Stores asyncio.Event objects per session to halt background deployments
session_abort_events: Dict[str, asyncio.Event] = {}

# [FAANG] Task Registry for Immediate Cancellation
# Tracks the primary active asyncio.Task for each session (deployment/analysis)
session_tasks: Dict[str, asyncio.Task] = {}

# Initialize global orchestrator (fallback only)
orchestrator = OrchestratorAgent(
    gcloud_project=os.getenv('GOOGLE_CLOUD_PROJECT'),
    user_id="system_fallback", # [FAANG] Fallback identity
    github_token=os.getenv('GITHUB_TOKEN'),
    location=os.getenv('GOOGLE_CLOUD_REGION', 'us-central1')
)

# Initialize Monitoring Agent
from agents.monitoring_agent import MonitoringAgent

async def monitoring_alert_hook(user_id: str, payload: dict):
    # Broadcast to all sessions for this user
    for session_id, info in active_connections.items():
        if info.get('user_id') == user_id:
            await broadcast_to_session(session_id, payload)

monitoring_agent = MonitoringAgent(send_alert_hook=monitoring_alert_hook)

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

# Start background tasks on server startup removed (Migrated to lifespan)


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
                agent = OrchestratorAgent(
                    gcloud_project=gcloud_project,
                    user_id="system_recovery" # [FAANG] Recovery identity
                )
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
        
        # [FIX] Robust region handling with debug logs
        print(f"[WebSocket] Raw Config: PROJECT={repr(gcloud_project)} REGION={repr(gcloud_region)}")
        
        if gcloud_region:
            # Remove any quotes that might have been loaded from .env
            gcloud_region = gcloud_region.replace('"', '').replace("'", "").strip()
            
        # Hard validation against common garbage
        if not gcloud_region or len(gcloud_region) < 4 or gcloud_region.lower() == 'none':
            print(f"[WebSocket] ⚠️ Invalid region detected ({repr(gcloud_region)}), defaulting to 'us-central1'")
            gcloud_region = 'us-central1'

        print(f"[WebSocket] [SUCCESS] Final Region: {repr(gcloud_region)}")
        
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
        user_id = init_message.get('user_id', 'user_default') # [FAANG] Persistent Identity
        user_data = init_message.get('user') # [FAANG] Auto-registration payload
        
        # [FAANG] Auto-Sync User Record
        if user_id and user_id != 'user_default' and user_data:
            from services.user_service import user_service
            existing_user = user_service.get_user(user_id)
            if not existing_user:
                print(f"[WebSocket] 👤 Creating new user record for {user_id} ({user_data.get('displayName')})")
                # Create user in database
                user_service._users[user_id] = User(
                    id=user_id,
                    email=user_data.get('email', 'unknown@servergem.app'),
                    username=user_data.get('displayName', 'user').lower().replace(' ', '_'),
                    display_name=user_data.get('displayName', 'User'),
                    avatar_url=user_data.get('photoURL')
                )
                user_service._save_users()
            else:
                # Sync existing user info (e.g. if name changed)
                print(f"[WebSocket] 👤 Syncing user record for {user_id}")
                existing_user.display_name = user_data.get('displayName', existing_user.display_name)
                existing_user.avatar_url = user_data.get('photoURL', existing_user.avatar_url)
                user_service._save_users()

        instance_id = init_message.get('instance_id', 'unknown')
        is_reconnect = init_message.get('is_reconnect', False)
        
        print(f"[WebSocket] 🔌 Client connecting:")
        print(f"  Session ID: {session_id}")
        print(f"  User ID: {user_id}")
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
        
        # [FAANG] Initialize abort event for this session
        if session_id not in session_abort_events:
            session_abort_events[session_id] = asyncio.Event()
        session_abort_events[session_id].clear()
        
        active_connections[session_id] = {
            'websocket': websocket,
            'keep_alive_task': keep_alive,
            'connected_at': datetime.now().isoformat(),
            'last_seen_at': datetime.now(),
            'instance_id': instance_id,
            'user_id': user_id, # Link session to user
            'abort_event': session_abort_events[session_id]
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
                user_id=user_id, # [FAANG] Pass persistent ID
                github_token=github_token or os.getenv('GITHUB_TOKEN'),
                location=gcloud_region,
                gemini_api_key=gemini_key
            )
            
            if saved_state:
                print(f"[WebSocket] 💾 Loaded state from Redis for {session_id}")
                user_orchestrator.load_state(saved_state)
                # [FAANG] Force re-sync user_id after state load
                user_orchestrator.user_id = user_id
            else:
                print(f"[WebSocket] ✨ Created FRESH orchestrator for {session_id}")
                
            # Update RAM cache
            session_orchestrators[session_id] = user_orchestrator
            
        # [FAANG] Initialize Abort Event for this session
        if session_id not in session_abort_events:
            session_abort_events[session_id] = asyncio.Event()
        else:
            session_abort_events[session_id].clear() # Reset if resuming
            
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
        user_orchestrator.user_id = user_id # [FAANG] Propagate identity
        
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
            
            # [FAANG] HEARTBEAT & IDENTITY PROTOCOL
            msg_type = data.get('type')
            
            if msg_type == 'ping':
                # Client is checking if we are alive
                await safe_send_json(session_id, {
                    'type': 'pong',
                    'timestamp': datetime.now().isoformat()
                })
                continue
                
            elif msg_type == 'identify':
                 # [FAANG] IDENTITY UNIFICATION
                 # Client is updating user identity (e.g. after login)
                 new_user_id = data.get('user_id')
                 user_data = data.get('user')
                 
                 if new_user_id and new_user_id != active_connections[session_id].get('user_id'):
                     print(f"[WebSocket] 🆔 Unifying Identity: {session_id} -> {new_user_id}")
                     
                     # 1. Update Connection Metadata
                     active_connections[session_id]['user_id'] = new_user_id
                     
                     # 2. Update Orchestrator Identity
                     if session_id in session_orchestrators:
                         session_orchestrators[session_id].user_id = new_user_id
                         
                     # 3. Sync User Record (Create/Update)
                     if user_data:
                         from services.user_service import user_service
                         existing_user = user_service.get_user(new_user_id)
                         if not existing_user:
                             print(f"[WebSocket] 👤 Creating unified user record for {new_user_id}")
                             user_service._users[new_user_id] = User(
                                 id=new_user_id,
                                 email=user_data.get('email', 'unknown@servergem.app'),
                                 username=user_data.get('displayName', 'user').lower().replace(' ', '_'),
                                 display_name=user_data.get('displayName', 'User'),
                                 avatar_url=user_data.get('photoURL')
                             )
                             user_service._save_users()
                     
                     # 4. Acknowledge identity update
                     await safe_send_json(session_id, {
                         'type': 'identity_verified',
                         'user_id': new_user_id,
                         'message': f"Identity verified: {user_data.get('displayName', 'User')}"
                     })
                 continue

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
                    await asyncio.sleep(0) # Yield during loop to prevent freeze
                
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
                        try:
                            from services.secret_sync_service import secret_sync_service
                            print(f"[WebSocket] [GSM] Attempting to save to Secret Manager via unified service for repo: {repo_url}")
                            
                            # Clean env vars for GSM (remove metadata)
                            gsm_payload = {k: v.get('value') if isinstance(v, dict) else v for k, v in session_env_vars.items()}
                            
                            success = await secret_sync_service.save_to_secret_manager(
                                deployment_id=None,
                                user_id=user_id,
                                env_vars=gsm_payload,
                                repo_url=repo_url
                            )
                            await asyncio.sleep(0) # Yield after GCP call
                            if success:
                                print(f"[WebSocket] [GSM] ✅ Unified cloud save success.")
                            else:
                                print(f"[WebSocket] [GSM] ⚠️ Unified cloud save returned failure.")
                        except Exception as gsm_e:
                            print(f"[WebSocket] [GSM] ❌ Unified cloud save failed: {gsm_e}")

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
                            await asyncio.sleep(0) # Yield after disk I/O
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
                                await asyncio.sleep(0) # Yield after disk I/O
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
                    await asyncio.sleep(0) # Yield after Redis save
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
                
                # ✅ PRINCIPAL FIX: Robust Deployment ID Continuity
                existing_deployment = user_orchestrator.active_deployment
                deployment_id = None
                
                # Check for an already active deployment in this session
                if existing_deployment and existing_deployment.get('deploymentId'):
                    deployment_id = existing_deployment['deploymentId']
                
                if deployment_id:
                    print(f"[WebSocket] ♻️ Reusing deployment identity: {deployment_id}")
                    # ✅ UX FIX: Use 'deployment_resumed' to avoid resetting frontend panel
                    await safe_send_json(session_id, {
                        "type": "deployment_resumed",
                        "deployment_id": deployment_id,
                        "resume_stage": "container_build",
                        "resume_progress": 25,
                        "timestamp": datetime.now().isoformat()
                    })
                else:
                    deployment_id = f"deploy-{uuid.uuid4().hex[:8]}"
                    print(f"[WebSocket] ✨ Initiating fresh deployment anchor: {deployment_id}")
                    
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
                
                # [FAANG ZERO-FREEZE] Pre-emptive feedback to eliminate static gap
                await progress_notifier.send_update(
                    'repo_access', 'success', 'Identity confirmed. Accessing repository archives...', progress=100
                )
                await progress_notifier.send_update(
                    'code_analysis', 'in-progress', 'Analyzing project architecture for final synthesis...', progress=20
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
                                
                                # [PRINCIPAL FIX]: Do NOT hardcode 'status'. Use what's passed or default to in-progress.
                                # This ensures checkmarks appear when 'success' is sent.
                                status = data.get('status', 'in-progress')
                                
                                # ✅ FAANG LOG FIX: Allow packets with ONLY details (logs)
                                # Removed the 'if message:' guard to ensure GCS log streams are visible
                                await safe_send_json(session_id, {
                                    'type': 'deployment_progress', 
                                    'stage': stage,
                                    'status': status,
                                    'message': message,
                                    'progress': progress,
                                    'details': data.get('details', []),
                                    'metadata': {
                                        'type': 'progress_update',
                                        'stage': stage,
                                        'timestamp': datetime.now().isoformat()
                                    }
                                })
                                await asyncio.sleep(0) # Yield for UI responsiveness
                        except Exception as e:
                            print(f"[WebSocket] [WARNING] Progress callback error: {e}")
                    
                    # Execute deployment
                    response = await user_orchestrator._direct_deploy(
                        progress_notifier=progress_notifier,
                        progress_callback=progress_callback_wrapper,
                        ignore_env_check=True,
                        explicit_env_vars=flat_env_vars,
                        safe_send=safe_send_json,
                        session_id=session_id,
                        abort_event=session_abort_events.get(session_id) # [FAANG] Pass abort event
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

                    # [PERSISTENCE] FAANG-Level Save (Standard Path)
                    deploy_data = response.get('data', {})
                    if deploy_data and deploy_data.get('url'):
                        try:
                            print(f"[WebSocket] 💾 Persisting deployment (Standard): {deploy_data.get('service_name')}")
                            dep_record = deployment_service.create_deployment(
                                user_id=user_id,
                                service_name=deploy_data.get('service_name', 'unknown'),
                                repo_url=deploy_data.get('repo_url', user_orchestrator.project_context.get('repo_url', '')),
                                region=deploy_data.get('region', 'us-central1'),
                                env_vars=deploy_data.get('env_vars', flat_env_vars)
                            )
                            deployment_service.update_deployment_status(
                                dep_record.id,
                                str(DeploymentStatus.LIVE),
                                gcp_url=deploy_data.get('url')
                            )
                            print(f"[WebSocket] ✅ Deployment persisted: {dep_record.id}")

                            # [MAANG BRIDGE] Transfer Secrets from Repo-ID to Deployment-ID
                            try:
                                from services.secret_sync_service import secret_sync_service
                                repo_url = deploy_data.get('repo_url', user_orchestrator.project_context.get('repo_url', ''))
                                if repo_url:
                                    print(f"[WebSocket] [MAANG] Bridging secrets: {repo_url} -> {dep_record.id}")
                                    env_vars = await secret_sync_service.load_from_secret_manager(
                                        deployment_id=None,
                                        user_id=user_id,
                                        repo_url=repo_url
                                    )
                                    if env_vars:
                                        # Save under deployment_id for permanent dashboard access
                                        await secret_sync_service.save_to_secret_manager(
                                            deployment_id=dep_record.id,
                                            user_id=user_id,
                                            env_vars=env_vars,
                                            repo_url=repo_url
                                        )
                                        print(f"[WebSocket] [MAANG] ✅ Secrets bridged successfully.")
                            except Exception as b_err:
                                print(f"[WebSocket] [MAANG] ⚠️ Secret bridging skipped/failed: {b_err}")
                        except Exception as p_err:
                            print(f"[WebSocket] ❌ Persistence failed: {p_err}")
                    
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
            
            # 🧠 GEMINI BRAIN: Handle auto-fix requests
            if msg_type == 'apply_gemini_fix':
                print(f"[WebSocket] 🤖 Gemini Brain fix request received for session {session_id}")
                
                deployment_id = data.get('deployment_id')
                diagnosis_dict = data.get('diagnosis', {})
                
                if not diagnosis_dict:
                    await safe_send_json(session_id, {
                        'type': 'error',
                        'message': 'No diagnosis data provided for auto-fix',
                        'timestamp': datetime.now().isoformat()
                    })
                    continue
                
                # Notify user we're applying the fix
                await safe_send_json(session_id, {
                    'type': 'message',
                    'data': {
                        'content': '🤖 **Gemini Brain Activated**\n\nApplying the recommended fix to your repository...',
                        'metadata': {'type': 'system'}
                    },
                    'timestamp': datetime.now().isoformat()
                })
                
                # Create progress notifier for the fix process
                fix_deployment_id = f"fix-{uuid.uuid4().hex[:8]}"
                progress_notifier = ProgressNotifier(session_id, fix_deployment_id, safe_send_json)
                
                # Define Fix Task
                async def handle_fix_task():
                    try:
                        # Import the handler
                        from agents.gemini_brain import DiagnosisResult
                        
                        # Reconstruct diagnosis
                        diagnosis = DiagnosisResult(
                            root_cause=diagnosis_dict.get('root_cause', ''),
                            affected_files=diagnosis_dict.get('affected_files', []),
                            recommended_fix=diagnosis_dict.get('recommended_fix', {}),
                            confidence_score=diagnosis_dict.get('confidence_score', 0),
                            error_category=diagnosis_dict.get('error_category', 'other'),
                            explanation=diagnosis_dict.get('explanation', '')
                        )
                        
                        # Get repo URL from context
                        repo_url = user_orchestrator.project_context.get('repo_url')
                        if not repo_url:
                            await safe_send_json(session_id, {
                                'type': 'error',
                                'message': 'Repository URL not found. Please analyze a repository first.',
                                'timestamp': datetime.now().isoformat()
                            })
                            return
                        
                        # Apply the fix
                        print(f"[WebSocket] 🔧 Applying fix to {repo_url}")
                        fix_result = await user_orchestrator.gemini_brain.apply_fix(
                            diagnosis=diagnosis,
                            repo_url=repo_url,
                            branch='main'
                        )
                        
                        if fix_result.get('success'):
                            commit_sha = fix_result.get('commit_sha', 'unknown')
                            file_path = fix_result.get('file_path', 'unknown')
                            
                            await safe_send_json(session_id, {
                                'type': 'message',
                                'data': {
                                    'content': f'✅ **Fix Applied Successfully!**\n\n'
                                               f'- **File**: `{file_path}`\n'
                                               f'- **Commit**: `{commit_sha[:7] if commit_sha != "unknown" else "pending"}`\n\n'
                                               f'Triggering re-deployment with the fixed code...',
                                    'metadata': {'type': 'gemini_fix_applied'}
                                },
                                'timestamp': datetime.now().isoformat()
                            })
                            
                            # Trigger re-deployment
                            # Re-clone to get the fixed code
                            print(f"[WebSocket] 🔄 Re-cloning repository with fixes...")
                            
                            clone_result = await user_orchestrator._handle_clone_and_analyze(
                                repo_url=repo_url,
                                branch='main',
                                progress_notifier=progress_notifier,
                                progress_callback=None,
                                skip_deploy_prompt=True,
                                abort_event=session_abort_events.get(session_id)
                            )
                            
                            if clone_result.get('type') != 'error':
                                # Deploy with existing env vars
                                deploy_result = await user_orchestrator._direct_deploy(
                                    progress_notifier=progress_notifier,
                                    progress_callback=None,
                                    ignore_env_check=True,
                                    explicit_env_vars=user_orchestrator.project_context.get('env_vars', {}),
                                    abort_event=session_abort_events.get(session_id) # [FAANG]
                                )
                                
                                # Send deployment result
                                await safe_send_json(session_id, {
                                    'type': 'message',
                                    'data': deploy_result,
                                    'timestamp': datetime.now().isoformat()
                                })

                                # [PERSISTENCE] FAANG-Level Save (Auto-Fix Path)
                                fix_deploy_data = deploy_result.get('data', {})
                                if fix_deploy_data and fix_deploy_data.get('url'):
                                    try:
                                        print(f"[WebSocket] 💾 Persisting deployment (Auto-Fix): {fix_deploy_data.get('service_name')}")
                                        dep_record = deployment_service.create_deployment(
                                            user_id=user_id, # [FIX] Use real user_id
                                            service_name=fix_deploy_data.get('service_name', 'unknown'),
                                            repo_url=fix_deploy_data.get('repo_url', repo_url),
                                            region=fix_deploy_data.get('region', 'us-central1'),
                                            env_vars=user_orchestrator.project_context.get('env_vars', {})
                                        )
                                        deployment_service.update_deployment_status(
                                            dep_record.id,
                                            str(DeploymentStatus.LIVE),
                                            gcp_url=fix_deploy_data.get('url')
                                        )
                                        print(f"[WebSocket] ✅ Deployment persisted: {dep_record.id}")
                                    except Exception as p_err:
                                        print(f"[WebSocket] ❌ Persistence failed: {p_err}")
                            else:
                                await safe_send_json(session_id, {
                                    'type': 'error',
                                    'message': f'Failed to re-clone repository: {clone_result.get("content", "Unknown error")}',
                                    'timestamp': datetime.now().isoformat()
                                })
                        else:
                            await safe_send_json(session_id, {
                                'type': 'error',
                                'message': f'Failed to apply fix: {fix_result.get("error", "Unknown error")}',
                                'timestamp': datetime.now().isoformat()
                            })
                    
                    except asyncio.CancelledError:
                         print(f"[WebSocket] 🛑 Gemini fix task cancelled")
                         raise
                    except Exception as fix_error:
                        print(f"[WebSocket] ❌ Gemini Brain fix failed: {fix_error}")
                        traceback.print_exc()
                        
                        await safe_send_json(session_id, {
                            'type': 'error',
                            'message': f'Gemini Brain fix error: {str(fix_error)}',
                            'code': 'GEMINI_FIX_ERROR',
                            'timestamp': datetime.now().isoformat()
                        })

                # Launch Fix Task
                if session_id in session_tasks and not session_tasks[session_id].done():
                     session_tasks[session_id].cancel()

                fix_task = asyncio.create_task(handle_fix_task())
                session_tasks[session_id] = fix_task
                fix_task.add_done_callback(lambda t: session_tasks.pop(session_id, None) if session_tasks.get(session_id) == t else None)
                
                continue
            
            # 🧠 GEMINI BRAIN: Vision Debugging (Screenshot Analysis)
            if msg_type == 'vision_debug':
                print(f"[WebSocket] 👁️ Vision debug request received for session {session_id}")
                
                image_base64 = data.get('image_base64', '')
                description = data.get('description', '')
                
                if not image_base64:
                    await safe_send_json(session_id, {
                        'type': 'error',
                        'message': 'No image data provided for vision debugging',
                        'timestamp': datetime.now().isoformat()
                    })
                    continue
                
                # Notify user we're analyzing
                await safe_send_json(session_id, {
                    'type': 'message',
                    'data': {
                        'content': '👁️ **Gemini Vision Activated**\n\nAnalyzing your screenshot to detect UI issues...',
                        'metadata': {'type': 'system'}
                    },
                    'timestamp': datetime.now().isoformat()
                })
                
                async def handle_vision_task():
                    try:
                        import base64
                        
                        # Decode image
                        image_data = base64.b64decode(image_base64)
                        
                        project_path = user_orchestrator.project_context.get('project_path', '')
                        
                        # Call Gemini Brain Vision
                        diagnosis = await user_orchestrator.gemini_brain.analyze_screenshot(
                            image_data=image_data,
                            project_path=project_path,
                            user_description=description
                        )
                        
                        # Format and send response
                        if diagnosis.confidence_score > 50:
                            await safe_send_json(session_id, {
                                'type': 'message',
                                'data': {
                                    'content': f'👁️ **Vision Analysis Complete**\n\n'
                                               f'**Root Cause**: {diagnosis.root_cause}\n\n'
                                               f'**Affected Files**: {", ".join(diagnosis.affected_files) or "Unknown"}\n\n'
                                               f'**Confidence**: {diagnosis.confidence_score}%\n\n'
                                               f'**Explanation**: {diagnosis.explanation[:500]}...',
                                    'metadata': {
                                        'type': 'gemini_brain_diagnosis',
                                        'diagnosis': diagnosis.to_dict(),
                                        'can_auto_fix': diagnosis.confidence_score >= 80
                                    },
                                    'actions': [
                                        {
                                            'label': '🔧 Apply Fix & Redeploy',
                                            'action': 'apply_gemini_fix',
                                            'payload': {
                                                'diagnosis': diagnosis.to_dict()
                                            }
                                        } if diagnosis.confidence_score >= 80 else {
                                            'label': '📋 Copy Fix',
                                            'action': 'copy_fix',
                                            'payload': diagnosis.to_dict()
                                        }
                                    ]
                                },
                                'timestamp': datetime.now().isoformat()
                            })
                        else:
                            await safe_send_json(session_id, {
                                'type': 'message',
                                'data': {
                                    'content': f'🤔 **Could not confidently diagnose the issue**\n\n'
                                               f'Confidence: {diagnosis.confidence_score}%\n\n'
                                               f'Best guess: {diagnosis.root_cause}\n\n'
                                               f'Please provide more context or a clearer screenshot.',
                                    'metadata': {'type': 'system'}
                                },
                                'timestamp': datetime.now().isoformat()
                            })
                    
                    except Exception as vision_error:
                        print(f"[WebSocket] ❌ Vision analysis failed: {vision_error}")
                        traceback.print_exc()
                        
                        await safe_send_json(session_id, {
                            'type': 'error',
                            'message': f'Vision analysis error: {str(vision_error)}',
                            'code': 'VISION_ERROR',
                            'timestamp': datetime.now().isoformat()
                        })
                
                # Launch Vision Task
                if session_id in session_tasks and not session_tasks[session_id].done():
                    session_tasks[session_id].cancel()
                
                vision_task = asyncio.create_task(handle_vision_task())
                session_tasks[session_id] = vision_task
                vision_task.add_done_callback(lambda t: session_tasks.pop(session_id, None) if session_tasks.get(session_id) == t else None)
                
                continue
            
            # 🛑 [FAANG] Handle abort deployment
            if msg_type == 'abort_deployment':
                print(f"[WebSocket] [EMERGENCY] Abort requested for session {session_id}")
                if session_id in session_abort_events:
                    session_abort_events[session_id].set()
                
                # Also notify the orchestrator if it supports direct abort signaling
                if hasattr(user_orchestrator, 'abort_event'):
                    user_orchestrator.abort_event.set()
                
                await safe_send_json(session_id, {
                    'type': 'message',
                    'data': {
                        'content': '⚠️ **Deployment Aborted**\n\nStopping all active processes for this session.',
                        'metadata': {'type': 'system_error'}
                    }
                })
                continue

            # 🏷️ [FAANG] Handle service name provided (Resume Flow)
            if msg_type == 'service_name_provided':
                print(f"[WebSocket] [INFO] Manual service name captured: {data.get('name')}")
                # We forward this JSON as string to orchestrator's internal JSON handler
                # which is already built to resume deployment upon receiving this.
                await user_orchestrator.process_message(
                    json.dumps(data),
                    progress_notifier=ProgressNotifier(session_id, data.get('deployment_id', 'resume'), safe_send_json),
                    progress_callback=progress_callback_wrapper, # Re-use the smart wrapper from above
                    safe_send=safe_send_json
                )
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

                    # 5. Trigger Direct Deploy Task
                    async def handle_skip_deploy_task():
                        try:
                            print(f"[WebSocket] Triggering direct_deploy (Skip Mode)", flush=True)
                            response = await user_orchestrator._direct_deploy(
                                progress_notifier=progress_notifier,
                                progress_callback=progress_callback_wrapper,
                                ignore_env_check=True,
                                explicit_env_vars={},  # Empty dict for skip
                                safe_send=safe_send_json,
                                session_id=session_id,
                                deployment_id=deployment_id, # [FAANG] Pass authoritative ID
                                abort_event=session_abort_events.get(session_id)
                            )
                            
                            await safe_send_json(session_id, {
                                'type': 'message',
                                'data': response,
                                'timestamp': datetime.now().isoformat()
                            })

                            # [PERSISTENCE] FAANG-Level Update (Skip Path)
                            # Early registration in Orchestrator already created the record.
                            # We just ensure the status is LIVE and the URL is set.
                            deploy_data = response.get('data', {})
                            if deploy_data and deploy_data.get('url'):
                                try:
                                    print(f"[WebSocket] 💾 Finalizing deployment (Skip Env): {deploy_data.get('service_name')}")
                                    # Use the ID from Orchestrator's active_deployment if possible
                                    existing_id = user_orchestrator.active_deployment.get('deploymentId') if user_orchestrator.active_deployment else None
                                    
                                    if existing_id:
                                        deployment_service.update_deployment_status(
                                            existing_id,
                                            str(DeploymentStatus.LIVE),
                                            gcp_url=deploy_data.get('url')
                                        )
                                        await deployment_service.update_url(existing_id, deploy_data.get('url'))
                                        print(f"[WebSocket] ✅ Deployment final state saved: {existing_id}")
                                except Exception as p_err:
                                    print(f"[WebSocket] ⚠️ Status update failed (non-fatal): {p_err}")
                            
                            await session_store.save_session(session_id, user_orchestrator.get_state())
                            
                        except Exception as deploy_error:
                             print(f"[WebSocket] [ERROR] Skip-deploy failed: {deploy_error}")
                             await safe_send_json(session_id, {
                                'type': 'error',
                                'message': f'Deployment error: {str(deploy_error)}',
                                'code': 'DEPLOY_ERROR'
                            })

                    # Launch Skip Task
                    skip_task = asyncio.create_task(handle_skip_deploy_task())
                    session_tasks[session_id] = skip_task
                    
                    skip_task.add_done_callback(lambda t: session_tasks.pop(session_id, None) if session_tasks.get(session_id) == t else None)
                    
                    continue # Skip LLM processing
                
                # ✅ FAANG-LEVEL FIX: Sync & Redeploy Handler
                # Handles "Git Push" automation request via Dashboard trigger
                elif metadata.get('type') == 'sync_deploy':
                    print(f"[WebSocket] 🔄 Sync & Redeploy requested for session {session_id}")
                    
                    repo_url = metadata.get('repoUrl')
                    deployment_id = metadata.get('deploymentId') or f"sync-{uuid.uuid4().hex[:8]}"
                    service_name = metadata.get('serviceName')
                    
                    # 1. Notify User
                    await safe_send_json(session_id, {
                        'type': 'message',
                        'data': {
                            'content': f"🔄 **Syncing with GitHub...**\n\nFetching latest commits for `{service_name}` and initiating build sequence...",
                            'metadata': {'type': 'system'}
                        },
                        'timestamp': datetime.now().isoformat()
                    })
                    
                    # 2. Init Notifier
                    progress_notifier = ProgressNotifier(session_id, deployment_id, safe_send_json)
                    
                    async def sync_task():
                        try:
                            # 3. Force Clone
                            await progress_notifier.start_stage('repo_access', 'Synchronizing latest code from remote...')
                            await progress_notifier.send_thought("[Git Ops] Fetching HEAD from remote branch...", "scan")
                            
                            clone_result = await user_orchestrator.github_service.clone_repository(
                                repo_url=repo_url,
                                branch='main', # Defaulting to main, could be dynamic
                                progress_callback=None
                            )
                            
                            if not clone_result['success']:
                                await progress_notifier.fail_stage('repo_access', f"Clone failed: {clone_result.get('error')}")
                                return
                            
                            # Update Context with NEW path
                            new_path = clone_result['local_path']
                            user_orchestrator.project_context['project_path'] = new_path
                            print(f"[WebSocket] 📂 Updated project path to: {new_path}")
                            
                            await progress_notifier.complete_stage('repo_access', 'Repository synchronized successfully')
                            
                            # 4. Trigger Direct Deploy
                            await progress_notifier.send_thought("[Orchestrator] Context refreshed. Initiating deployment pipeline...", "orchestrate")
                            
                            response = await user_orchestrator._direct_deploy(
                                progress_notifier=progress_notifier,
                                progress_callback=None, 
                                ignore_env_check=True,
                                explicit_env_vars=user_orchestrator.project_context.get('env_vars', {}),
                                safe_send=safe_send_json,
                                session_id=session_id,
                                abort_event=session_abort_events.get(session_id)
                            )
                            
                            # [PERSISTENCE] FAANG-Level Update (Sync Path)
                            # Orchestrator handles early registration; we just finalize.
                            deploy_data = response.get('data', {})
                            if deploy_data and deploy_data.get('url'):
                                try:
                                    print(f"[WebSocket] 💾 Finalizing deployment (Sync): {deploy_data.get('service_name')}")
                                    existing_id = user_orchestrator.active_deployment.get('deploymentId') if user_orchestrator.active_deployment else None
                                    
                                    if existing_id:
                                        deployment_service.update_deployment_status(
                                            existing_id,
                                            str(DeploymentStatus.LIVE),
                                            gcp_url=deploy_data.get('url')
                                        )
                                        await deployment_service.update_url(existing_id, deploy_data.get('url'))
                                        print(f"[WebSocket] ✅ Deployment final state saved: {existing_id}")
                                except Exception as p_err:
                                    print(f"[WebSocket] ⚠️ Status update failed (Sync): {p_err}")

                            await safe_send_json(session_id, {
                                'type': 'message',
                                'data': response,
                                'timestamp': datetime.now().isoformat()
                            })
                            
                            await session_store.save_session(session_id, user_orchestrator.get_state())

                        except Exception as e:
                            print(f"[WebSocket] ❌ Sync task failed: {e}")
                            traceback.print_exc()
                            await safe_send_json(session_id, {'type': 'error', 'message': f"Sync failed: {str(e)}"})
                    
                    # Launch
                    asyncio.create_task(sync_task())
                    
                    continue
                
                # ✅ CRITICAL FIX: Update GitHub token from metadata if provided
                # This is sent from Deploy.tsx when selecting a repo
                github_token = metadata.get('githubToken')
                if github_token:
                    print(f"[WebSocket] Updating GitHub token for session {session_id}", flush=True)
                    # Update the orchestrator's GitHub service with the new token
                    from services.github_service import GitHubService
                    user_orchestrator.github_service = GitHubService(github_token)
                    print(f"[WebSocket] [SUCCESS] GitHub token updated successfully", flush=True)
                
                # Typing indicator
                await safe_send_json(session_id, {
                    'type': 'typing',
                    'timestamp': datetime.now().isoformat()
                })

                # Define the task wrapper
                async def handle_user_message_task():
                    try:
                        # ✅ EAGER SAVE
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
                            existing_deployment = getattr(user_orchestrator, 'active_deployment', None)
                            
                            if existing_deployment and existing_deployment.get('deploymentId'):
                                deployment_id = existing_deployment['deploymentId']
                                print(f"[WebSocket] 🧬 Locking onto existing deployment: {deployment_id}")
                            else:
                                deployment_id = f"deploy-{uuid.uuid4().hex[:8]}"
                                print(f"[WebSocket] ✨ Anchor created for new deployment: {deployment_id}")
                                
                                await safe_send_json(session_id, {
                                    "type": "deployment_started",
                                    "deployment_id": deployment_id,
                                    "message": "[DEPLOY] Synchronizing deployment kernel...",
                                    "timestamp": datetime.now().isoformat()
                                })
                            
                            progress_notifier = ProgressNotifier(
                                session_id, 
                                deployment_id, 
                                safe_send_json
                            )
                        
                        # Process message
                        response = await user_orchestrator.process_message(
                            message,
                            session_id,
                            progress_notifier=progress_notifier,
                            safe_send=safe_send_json,
                            abort_event=session_abort_events.get(session_id)
                        )
                        
                        # [SUCCESS] PERSISTENCE HOOK: Save successful deployment
                        # Consolidated into Orchestrator Early Registration.
                        # We only need to check if it's Live here.
                        if response.get('type') == 'success' and 'data' in response:
                            print(f"[WebSocket] 💾 Deployment lifecycle finished for {deployment_id}")

                        await safe_send_json(session_id, {
                            'type': 'message',
                            'data': response,
                            'timestamp': datetime.now().isoformat()
                        })
                        
                        await session_store.save_session(
                            session_id, 
                            user_orchestrator.get_state()
                        )

                    except asyncio.CancelledError:
                        print(f"[WebSocket] 🛑 Task cancelled for {session_id}")
                        # Don't send another message here if it was an intentional abort.
                        # The abort_deployment handler already sent a definitive status.
                        raise # Propagate cancel
                    except Exception as e:
                        error_msg = str(e)
                        print(f"[WebSocket] [ERROR] Error in message task: {error_msg}")
                        traceback.print_exc()
                        # Send error
                        await safe_send_json(session_id, {
                            'type': 'error',
                            'message': f'Error: {error_msg}',
                            'code': 'API_ERROR',
                            'timestamp': datetime.now().isoformat()
                        })

                # Launch message task
                if session_id in session_tasks and not session_tasks[session_id].done():
                    print(f"[WebSocket] ⚠️ Replacing active task for {session_id}")
                    session_tasks[session_id].cancel()
                
                msg_task = asyncio.create_task(handle_user_message_task())
                session_tasks[session_id] = msg_task
                
                # Cleanup callback
                def clean_task(t):
                    if session_id in session_tasks and session_tasks[session_id] == t:
                        del session_tasks[session_id]
                msg_task.add_done_callback(clean_task)

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

            # [FAANG] Handle emergency abort
            if msg_type == 'abort_deployment':
                print(f"[WebSocket] 🛑 ABORT requested for session {session_id}")
                
                # 1. Trigger the Event (Fastest Path for background loops)
                if session_id in session_abort_events:
                    session_abort_events[session_id].set()
                
                # 2. Hard Cancel the Async Task
                if session_id in session_tasks:
                    task = session_tasks[session_id]
                    if not task.done():
                        print(f"[WebSocket] 🗡️ Killing active task for {session_id}")
                        task.cancel()
                        # Wait briefly to ensure cancellation propagates
                        try:
                            await asyncio.wait_for(task, timeout=1.0)
                        except (asyncio.CancelledError, asyncio.TimeoutError, Exception):
                            pass
                
                # 3. [FAANG] INSTANT UI FEEDBACK: Force the deployment panel to stop
                # We send this as a definitive final status message.
                await safe_send_json(session_id, {
                    'type': 'deployment_complete',
                    'success': False,
                    'error': ' **Operation Cancelled.**',
                    'timestamp': datetime.now().isoformat()
                })
                
                # Clean up tracking
                if session_id in session_tasks: del session_tasks[session_id]
                
                # Clear event for next time
                if session_id in session_abort_events:
                     session_abort_events[session_id].clear()
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

class DeploymentCreate(BaseModel):
    user_id: str
    service_name: str
    repo_url: str
    region: Optional[str] = "us-central1"
    env_vars: Optional[dict] = {}

class DeploymentStatusUpdate(BaseModel):
    status: str
    error_message: Optional[str] = None
    gcp_url: Optional[str] = None

@app.get("/api/deployments")
async def list_deployments(user_id: str):
    """List all deployments for a user [HEALED]"""
    deployments = await deployment_service.list_deployments(user_id)
    return {"deployments": [d.to_dict() for d in deployments]}

@app.post("/api/deployments")
async def create_deployment(data: DeploymentCreate):
    """Create a new deployment record"""
    deployment = await deployment_service.create_deployment(
        user_id=data.user_id,
        service_name=data.service_name,
        repo_url=data.repo_url,
        region=data.region,
        env_vars=data.env_vars
    )
    return deployment.to_dict()

@app.get("/api/deployments/{deployment_id}")
async def get_deployment(deployment_id: str):
    """Get single deployment details"""
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment.to_dict()

@app.patch("/api/deployments/{deployment_id}/status")
async def update_deployment_status(deployment_id: str, update: DeploymentStatusUpdate):
    """Update deployment status"""
    status_enum = getattr(DeploymentStatus, update.status.upper(), None)
    if not status_enum:
        raise HTTPException(status_code=400, detail=f"Invalid status: {update.status}")
        
    deployment = await deployment_service.update_deployment_status(
        deployment_id,
        status_enum,
        error_message=update.error_message,
        gcp_url=update.gcp_url
    )
    
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
        
    return deployment.to_dict()

@app.delete("/api/deployments/{deployment_id}")
async def delete_deployment(deployment_id: str):
    """
    [FAANG] Nuclear Purge Protocol
    Deletes local records and initiates remote Cloud Run service removal.
    """
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
        
    # 1. Strategic Remote Cleanup (Async)
    # We trigger this first to ensure the intent is captured, but don't block the UI
    if deployment.service_name:
        print(f"[API] 🗑️ Nuclear Cleanup: Initiating remote removal for {deployment.service_name}")
        asyncio.create_task(orchestrator.gcloud_service.delete_service(deployment.service_name))
        
    # 2. Local Record Purge
    success = deployment_service.delete_deployment(deployment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    return {"message": "Deployment deleted successfully"}





# ============================================================================
# Environment Variables Management
# ============================================================================

class EnvVarUpdate(BaseModel):
    env_vars: dict

@app.get("/api/deployments/{deployment_id}/env-vars")
async def get_deployment_env_vars(deployment_id: str):
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return {"env_vars": deployment.env_vars}

@app.put("/api/deployments/{deployment_id}/env-vars")
async def update_deployment_env_vars(deployment_id: str, update: EnvVarUpdate):
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    # Update local DB
    deployment.env_vars = update.env_vars
    deployment_service._save_deployments()
    
    # Sync with Secret Manager
    try:
        from services.gcloud_service import GCloudService
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        gcloud_svc = GCloudService(project_id=project_id)
        
        # Sanitize secret ID
        safe_service_name = re.sub(r'[^a-zA-Z0-9]', '_', deployment.service_name).upper()
        secret_id = f"{safe_service_name}_ENV"
        
        env_string = "\n".join([f"{k}={v}" for k, v in update.env_vars.items()])
        
        version = await gcloud_svc.create_or_update_secret(secret_id, env_string)
        
        return {
            "status": "success", 
            "secret_version": version, 
            "env_vars": deployment.env_vars
        }
    except Exception as e:
        print(f"Error updating secrets: {e}")
        return {
            "status": "warning", 
            "message": "Updated locally but failed to sync with Secret Manager",
            "error": str(e),
            "env_vars": deployment.env_vars
        }


@app.get("/api/deployments/{deployment_id}/runtime-logs")
async def get_runtime_logs(deployment_id: str, limit: int = 100):
    """Fetch runtime logs from Cloud Run"""
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
         raise HTTPException(status_code=404, detail="Deployment not found")
         
    try:
        # [FAANG] Lazy Load Dependency
        from services.gcloud_service import GCloudService
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        gcloud_svc = GCloudService(project_id=project_id)
        
        logs = await gcloud_svc.get_service_logs(
            service_name=deployment.service_name,
            limit=limit
        )
        return {"logs": logs}
    except Exception as e:
        print(f"Log fetch error: {e}")
        # Return empty list on failure instead of 500
        return {"logs": [], "error": str(e)}


@app.get("/api/deployments/{deployment_id}/metrics")
async def get_deployment_metrics(deployment_id: str, minutes: int = 60):
    """Fetch real-time metrics for deployment from Cloud Monitoring"""
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
         raise HTTPException(status_code=404, detail="Deployment not found")
         
    try:
        from services.gcloud_service import GCloudService
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        gcloud_svc = GCloudService(project_id=project_id)
        
        hours = max(1, minutes / 60)
        
        metrics = await gcloud_svc.get_service_metrics(
            service_name=deployment.service_name,
            hours=hours
        )
        return metrics
    except Exception as e:
        print(f"Metrics error: {e}")
        return {"cpu": [], "memory": [], "requests": []}


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


# Duplicate preview endpoints removed (Hardened version moved to lines 2460+)


@app.get("/api/deployments/{deployment_id}/runtime-logs")
async def get_runtime_logs(deployment_id: str, limit: int = 100):
    """Fetch live logs from Cloud Run service (SDK-Native)"""
    try:
        # 1. Resolve service name from deployment_id
        deployment = deployment_service.get_deployment(deployment_id)
        if not deployment:
            raise HTTPException(status_code=404, detail="Deployment not found")
        
        service_name = deployment.service_name
        
        # 2. Extract logs from GCloudService
        # We use the global orchestrator instance which holds the initialized Google Cloud service
        logs = await orchestrator.gcloud_service.get_service_logs(service_name, limit=limit)
        
        return {
            "logs": logs,
            "count": len(logs),
            "service_name": service_name
        }
    except Exception as e:
        print(f"[API] Error fetching runtime logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Environment Variable Sync Endpoints (Two-Way GSM + Cloud Run)
# ============================================================================

class EnvVarsSyncRequest(BaseModel):
    """Request model for syncing environment variables"""
    env_vars: Dict[str, str]
    apply_to_cloud_run: bool = True  # Whether to update the running service


@app.get("/api/deployments/{deployment_id}/env")
async def get_deployment_env_vars(deployment_id: str):
    """[FAANG] Load environment variables from Google Secret Manager"""
    from services.secret_sync_service import secret_sync_service
    
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    # Inject gcloud service if needed
    if not secret_sync_service.gcloud_service:
        secret_sync_service.set_gcloud_service(orchestrator.gcloud_service)
    
    env_vars = await secret_sync_service.load_from_secret_manager(
        deployment_id=deployment_id,
        user_id=deployment.user_id
    )
    
    return {
        "deployment_id": deployment_id,
        "env_vars": env_vars or {},
        "source": "google_secret_manager" if env_vars else "none",
        "last_sync": secret_sync_service.get_last_sync_time(deployment_id)
    }


@app.post("/api/deployments/{deployment_id}/env")
async def sync_deployment_env_vars(deployment_id: str, request: EnvVarsSyncRequest):
    """
    [FAANG] Two-Way Environment Variable Sync
    
    1. Saves to Google Secret Manager
    2. Optionally updates Cloud Run (creates new revision, no rebuild)
    """
    from services.secret_sync_service import secret_sync_service
    
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    # Inject gcloud service if needed
    if not secret_sync_service.gcloud_service:
        secret_sync_service.set_gcloud_service(orchestrator.gcloud_service)
    
    result = await secret_sync_service.sync_env_vars(
        deployment_id=deployment_id,
        user_id=deployment.user_id,
        service_name=deployment.service_name if request.apply_to_cloud_run else None,
        env_vars=request.env_vars,
        apply_to_cloud_run=request.apply_to_cloud_run
    )
    
    if not result["overall_success"]:
        raise HTTPException(
            status_code=500, 
            detail=f"Sync failed: GSM={result['secret_manager_sync']}, CloudRun={result['cloud_run_sync']}"
        )
    
    return {
        "message": "Environment variables synced successfully",
        "deployment_id": deployment_id,
        "sync_result": result,
        "applied_to_cloud_run": request.apply_to_cloud_run
    }


# ============================================================================
# CUSTOM DOMAIN MANAGEMENT (FAANG-Level)
# ============================================================================

class DomainCreate(BaseModel):
    domain: str
    force_override: bool = False

@app.get("/api/deployments/{deployment_id}/domains")
async def list_deployment_domains(deployment_id: str):
    """List custom domains for a deployment"""
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
         raise HTTPException(status_code=404, detail="Deployment not found")
         
    try:
        from services.gcloud_service import GCloudService
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        gcloud_svc = GCloudService(project_id=project_id)
        
        domains = await gcloud_svc.list_domain_mappings(service_name=deployment.service_name)
        return {"domains": domains}
    except Exception as e:
        print(f"List domains error: {e}")
        return {"domains": [], "error": str(e)}

@app.post("/api/deployments/{deployment_id}/domains")
async def add_deployment_domain(deployment_id: str, request: DomainCreate):
    """Map a custom domain to a deployment"""
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
         raise HTTPException(status_code=404, detail="Deployment not found")
         
    try:
        from services.gcloud_service import GCloudService
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        gcloud_svc = GCloudService(project_id=project_id)
        
        result = await gcloud_svc.create_domain_mapping(
            service_name=deployment.service_name,
            domain_name=request.domain,
            force_override=request.force_override
        )
        return result
    except Exception as e:
        print(f"Add domain error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/deployments/{deployment_id}/domains")
async def remove_deployment_domain(deployment_id: str, domain: str):
    """Remove a custom domain mapping"""
    # Verify ownership? In MVP, we trust the deployment_id ownership check
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
         raise HTTPException(status_code=404, detail="Deployment not found")
         
    try:
        from services.gcloud_service import GCloudService
        project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        gcloud_svc = GCloudService(project_id=project_id)
        
        success = await gcloud_svc.delete_domain_mapping(domain_name=domain)
        return {"success": success}
    except Exception as e:
        print(f"Delete domain error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# PREVIEW GENERATION (FAANG-Level)
# ============================================================================

from services.preview_service import preview_service

@app.get("/api/deployments/{deployment_id}/preview")
async def get_deployment_preview(deployment_id: str, background_tasks: BackgroundTasks):
    """[FAANG] Get or generate a preview screenshot with caching"""
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment or not deployment.url:
         raise HTTPException(status_code=404, detail="Preview unavailable")
    
    # 1. Check for cached preview
    preview_path = await preview_service.get_latest_preview(deployment_id)
    if preview_path:
        return FileResponse(preview_path, media_type="image/png")
        
    # 2. Block and generate if missing (UX: First time users wait ~s)
    try:
        preview_path = await preview_service.generate_preview(deployment.url, deployment_id)
        if preview_path:
            return FileResponse(preview_path, media_type="image/png")
        
        # [FAANG] Hybrid Fallback: Remote Snapshot API
        # If local Playwright fails (Windows/Incompatible), redirect to a professional screenshot service.
        remote_preview = f"https://api.microlink.io?url={deployment.url}&screenshot=true&embed=screenshot.url"
        return RedirectResponse(url=remote_preview)
        
    except Exception as e:
        print(f"Preview generation failed: {e}")
        # Final Fallback to Remote API even on exception
        remote_preview = f"https://api.microlink.io?url={deployment.url}&screenshot=true&embed=screenshot.url"
        return RedirectResponse(url=remote_preview)

# ============================================================================
# BRANDING & ASSET ENGINE (FAANG-Level)
# ============================================================================

@app.get("/api/branding/favicon")
async def get_branding_favicon(url: str, response: Response):
    """[FAANG] Extract high-fidelity favicon URL for any target"""
    icon_url = await branding_service.get_favicon(url)
    if not icon_url:
        raise HTTPException(status_code=404, detail="Favicon not found")
    
    # [FAANG] Persistent Caching Headers
    response.headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=3600"
    return {"url": icon_url}

@app.get("/api/branding/proxy")
async def proxy_branding_favicon(url: str, response: Response):
    """[FAANG] Proxy favicon bytes to bypass CORS restrictions with aggressive caching"""
    icon_url = await branding_service.get_favicon(url)
    if not icon_url:
        raise HTTPException(status_code=404)
    
    content = await branding_service.proxy_icon(icon_url)
    if not content:
        # Fallback to a default globe if all else fails
        return RedirectResponse(url="https://icons.duckduckgo.com/ip3/devgem.ai.ico")
    
    # [FAANG] Sharp Caching logic - 24 hours of client-side persistence
    response.headers["Cache-Control"] = "public, max-age=86400, immutable"
    return Response(content=content, media_type="image/x-icon")

@app.post("/api/deployments/{deployment_id}/preview/regenerate")
async def regenerate_deployment_preview(deployment_id: str, background_tasks: BackgroundTasks):
    """[FAANG] Force regenerate preview in background"""
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment or not deployment.url:
         raise HTTPException(status_code=404, detail="Deployment has no URL")
    
    background_tasks.add_task(preview_service.generate_preview, deployment.url, deployment_id)
    return {"message": "Preview regeneration started", "deployment_id": deployment_id}


# ============================================================================
# Usage & Analytics Endpoints
# ============================================================================

# Analytics migrated to centralized endpoint below



# ============================================================================
# Auto-Deploy (Smart Polling CI/CD) Endpoints
# ============================================================================

@app.post("/api/deployments/{deployment_id}/auto-deploy/enable")
async def enable_auto_deploy(deployment_id: str, branch: str = "main"):
    """[FAANG] Enable auto-deploy for a deployment"""
    from services.source_control_service import source_control_service, RepoWatchConfig
    
    deployment = deployment_service.get_deployment(deployment_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    config = RepoWatchConfig(
        repo_url=deployment.repo_url,
        deployment_id=deployment_id,
        user_id=deployment.user_id,
        branch=branch,
        auto_deploy_enabled=True
    )
    
    watch_id = source_control_service.watch_repo(config)
    
    return {
        "message": "Auto-deploy enabled",
        "watch_id": watch_id,
        "deployment_id": deployment_id,
        "repo_url": deployment.repo_url,
        "branch": branch
    }


@app.post("/api/deployments/{deployment_id}/auto-deploy/disable")
async def disable_auto_deploy(deployment_id: str):
    """[FAANG] Disable auto-deploy for a deployment"""
    from services.source_control_service import source_control_service
    
    # Find and remove the watch
    for watch_id, config in list(source_control_service._watched_repos.items()):
        if config.deployment_id == deployment_id:
            source_control_service.unwatch_repo(watch_id)
            return {"message": "Auto-deploy disabled", "deployment_id": deployment_id}
    
    return {"message": "Auto-deploy was not enabled", "deployment_id": deployment_id}


@app.get("/api/deployments/{deployment_id}/auto-deploy/status")
async def get_auto_deploy_status(deployment_id: str):
    """[FAANG] Get auto-deploy status for a deployment"""
    from services.source_control_service import source_control_service
    
    for watch_id, config in source_control_service._watched_repos.items():
        if config.deployment_id == deployment_id:
            return {
                "enabled": config.auto_deploy_enabled,
                "watch_id": watch_id,
                "repo_url": config.repo_url,
                "branch": config.branch,
                "last_commit_sha": config.last_commit_sha,
                "last_checked": config.last_checked.isoformat() if config.last_checked else None,
                "check_interval_seconds": config.check_interval_seconds
            }
    
    return {"enabled": False, "deployment_id": deployment_id}


@app.post("/api/deployments/{deployment_id}/auto-deploy/check-now")
async def check_for_updates_now(deployment_id: str):
    """[FAANG] Force an immediate check for updates"""
    from services.source_control_service import source_control_service
    
    result = await source_control_service.trigger_check_now(deployment_id)
    
    if result is None:
        raise HTTPException(status_code=404, detail="Auto-deploy not enabled for this deployment")
    
    return {
        "has_changes": result.has_changes,
        "current_sha": result.current_sha,
        "previous_sha": result.previous_sha,
        "commit_message": result.commit_message,
        "commit_author": result.commit_author,
        "error": result.error
    }


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

@app.get("/api/analytics/{user_id}")
async def get_analytics(user_id: str):
    """Get deployment analytics for a user"""
    return await deployment_service.get_analytics(user_id)


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



# ============================================================================
# BACKGROUND MONITORING TASK (Self-Healing)
# ============================================================================

async def monitor_deployments():
    """Background task to watch over deployments (FAANG Guardian Mode)"""
    print("[Monitor] 🛡️ Guardian Active: Monitoring deployments...")
    await asyncio.sleep(15) # Wait for platform to stabilize
    
    while True:
        try:
            # 1. Fetch all LIVE deployments (Guardian monitors globally across all users)
            deployments = [d for d in deployment_service._deployments.values() 
                          if d.status == DeploymentStatus.LIVE]
            
            for d in deployments:
                try:
                    # 2. Check real-time status from GCP using orchestrator's gcloud service
                    if not orchestrator.gcloud_service: continue
                    
                    # We only poll for LIVE or FAILED transitions if not already in terminal state
                    # or if we want to ensure Uptime verification
                    status_info = await orchestrator.gcloud_service.get_service_status(d.service_name)
                    
                    if status_info:
                        new_status = status_info.get('status')
                        url = status_info.get('url')
                        
                        # Map GCP status to our internal DeploymentStatus
                        if new_status == 'READY' and d.status != DeploymentStatus.LIVE:
                            deployment_service.update_deployment_status(d.id, DeploymentStatus.LIVE, url=url)
                            print(f"[Guardian] ✅ Service {d.service_name} is now LIVE at {url}")
                        elif new_status == 'ERROR' and d.status != DeploymentStatus.FAILED:
                            deployment_service.update_deployment_status(d.id, DeploymentStatus.FAILED, error_message=status_info.get('error'))
                            print(f"[Guardian] ❌ Service {d.service_name} detected in ERROR state")
                except Exception as inner_e:
                    print(f"[Guardian] Check failed for {d.service_name}: {inner_e}")
            
            await asyncio.sleep(45) # Google-scale polling interval
        except Exception as e:
            print(f"[Monitor] Guardian Loop Error: {e}")
            await asyncio.sleep(60)

# Startup sequence migrated to lifespan


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "app:app", # Must use import string for reload to work
        host="0.0.0.0",
        port=port,
        log_level="info",
        reload=True, # ✅ Enable auto-reload for FAANG-speed iteration
        reload_excludes=["data"] # [FAANG] Stability: Prevent infinite loop when DB updates
    )