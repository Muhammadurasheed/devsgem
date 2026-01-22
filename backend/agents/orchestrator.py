"""
DevGem Orchestrator Agent
FAANG-Level Production Implementation
- Gemini ADK with function calling
- Production monitoring & observability
- Security best practices
- Cost optimization
- Advanced error handling
- Multi-region fallback with distributed rate limiting
"""

import asyncio
import time
from typing import Dict, List, Optional, Any, Callable, Tuple
import vertexai
from vertexai.generative_models import GenerativeModel, Tool, FunctionDeclaration, Part, GenerationConfig
from datetime import datetime
import json
import uuid
import os
import hashlib
import re
from dataclasses import dataclass
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from utils.progress_notifier import ProgressNotifier, DeploymentStages
from utils.rate_limiter import get_rate_limiter, Priority, acquire_with_fallback
from utils.progress_helpers import send_and_flush


@dataclass
class ResourceConfig:
    """Resource configuration for Cloud Run deployments"""
    cpu: str
    memory: str
    concurrency: int
    min_instances: int
    max_instances: int


class OrchestratorAgent:
    """
    Production-grade orchestrator using Gemini ADK with function calling.
    Routes to real services: GitHub, Google Cloud, Docker, Analysis.
    """
    
    def __init__(
        self, 
        gcloud_project: str,
        github_token: Optional[str] = None,
        location: str = 'us-central1',
        gemini_api_key: Optional[str] = None
    ):
        self.gemini_api_key = gemini_api_key
        # [SUCCESS] ALWAYS prefer Vertex AI if GCP project is configured
        # Store Gemini API key for automatic fallback on quota exhaustion
        self.use_vertex_ai = bool(gcloud_project)
        self.gcloud_project = gcloud_project
        
        print(f"[Orchestrator] Initialization:")
        print(f"  - Vertex AI: {self.use_vertex_ai} (project: {gcloud_project})")
        print(f"  - Gemini API key available: {bool(gemini_api_key)}")
        print(f"  - Fallback ready: {self.use_vertex_ai and bool(gemini_api_key)}")
        
        if self.use_vertex_ai:
            if not gcloud_project:
                raise ValueError("GOOGLE_CLOUD_PROJECT is required for Vertex AI")
            # Initialize Vertex AI
            vertexai.init(project=gcloud_project, location=location)
        else:
            # Using Gemini API directly
            import google.generativeai as genai
            genai.configure(api_key=gemini_api_key)
        
        # Get system instruction from method (reusable)
        system_instruction = self._get_system_instruction()
        
        # Initialize AI model (Vertex AI or Gemini API)
        # [SUCCESS] GEMINI 3 HACKATHON FIX: Use gemini-2.5-flash (Gemini 3 family)
        # Per hackathon requirements: "Build with the Gemini 3 API"
        # gemini-2.5-flash is the Gemini 3 Flash model
        if self.use_vertex_ai:
            self.model = GenerativeModel(
                'gemini-2.0-flash-001',  # Flagship Gemini 2.0 model
                tools=[self._get_function_declarations()],
                system_instruction=system_instruction
            )
            print("[Orchestrator] Using Gemini 2.0 Flash via Vertex AI")
        else:
            # [SUCCESS] Gemini 3 via direct API
            import google.generativeai as genai
            self.model = genai.GenerativeModel(
                'gemini-2.0-flash-001',  # Flagship Gemini 2.0 model
                tools=[self._get_function_declarations_genai()],
                system_instruction=system_instruction
            )
            print("[Orchestrator] Using Gemini 2.0 Flash via API")
        
        self.conversation_history: List[Dict] = []
        self.ui_history: List[Dict] = [] # [SUCCESS] Rehydration history
        self.project_context: Dict[str, Any] = {}
        self.chat_session = None
        
        # [SUCCESS] CRITICAL FIX: Add instance variables for progress messaging
        self.safe_send: Optional[Callable] = None
        self.session_id: Optional[str] = None
        self.save_callback: Optional[Callable] = None  # [SUCCESS] Function to trigger Redis save
        self.active_deployment: Optional[Dict[str, Any]] = None  # [SUCCESS] Full structured state
        
        # Initialize real services - with proper error handling
        try:
            from services.github_service import GitHubService
            from services.gcloud_service import GCloudService
            from services.docker_service import DockerService
            from services.analysis_service import AnalysisService
            from services.monitoring import monitoring
            from services.security import security
            from services.optimization import optimization
            from services.deployment_progress import create_progress_tracker
            from agents.docker_expert import DockerExpertAgent # [SUCCESS] Import Agent
            from agents.code_analyzer import CodeAnalyzerAgent # [SUCCESS] Import CodeAnalyzer
            from services.domain_service import DomainService
            from services.preferences_service import PreferencesService
            
            self.github_service = GitHubService(github_token)
            self.preferences_service = PreferencesService()
            
            # Use DevGem's GCP project (not user's)
            # [SUCCESS] FAANG FIX: Handle both project ID string AND pre-instantiated GCloudService object
            if gcloud_project:
                # Use duck-typing to check if it's already a service instance
                if hasattr(gcloud_project, 'access_secret'):
                    print(f"[Orchestrator] GCloudService object injected directly")
                    self.gcloud_service = gcloud_project
                else:
                    self.gcloud_service = GCloudService(
                        str(gcloud_project) or 'servergem-platform'
                    )
            else:
                self.gcloud_service = None
            self.docker_service = DockerService()
            self.docker_expert = DockerExpertAgent(gcloud_project or 'servergem-platform') # [SUCCESS] Init Agent
            self.code_analyzer = CodeAnalyzerAgent(gcloud_project, location, gemini_api_key) # [SUCCESS] Init CodeAnalyzer
            self.analysis_service = AnalysisService(gcloud_project, location, gemini_api_key)
            self.domain_service = DomainService(gcloud_project, location)
            
            # Production services
            self.monitoring = monitoring
            self.security = security
            self.optimization = optimization
            self.create_progress_tracker = create_progress_tracker
            
        except ImportError as e:
            print(f"[WARNING] Service import failed: {e}")
            print("[WARNING] Running in mock mode - services not available")
            # Create mock services for testing
            self._init_mock_services()
    
    def _init_mock_services(self):
        """Initialize mock services for testing when real services unavailable"""
        class MockService:
            def __getattr__(self, name):
                async def mock_method(*args, **kwargs):
                    return {'success': False, 'error': 'Service not available'}
                return mock_method
        
        self.github_service = MockService()
        self.gcloud_service = MockService()
        self.docker_service = MockService()
        self.analysis_service = MockService()
        self.monitoring = MockService()
        self.security = MockService()
        self.optimization = MockService()
        self.create_progress_tracker = lambda *args, **kwargs: MockService()
    
    def _get_function_declarations_genai(self):
        """
        Get function declarations for Gemini API (google-generativeai format)
        """
        from agents.gemini_tools import get_gemini_api_tools
        return get_gemini_api_tools()
    
    def _get_function_declarations(self) -> Tool:
        """
        Define real functions available for Vertex AI Gemini to call
        Uses Vertex AI SDK format
        """
        return Tool(
            function_declarations=[
                FunctionDeclaration(
                    name='clone_and_analyze_repo',
                    description='Clone and analyze a GitHub repository. [WARNING] CRITICAL: Only call this when "Project Path:" is NOT in context. If "Project Path:" exists in context, repository is ALREADY cloned - call deploy_to_cloudrun instead! NEVER clone the same repo twice.',
                    parameters={
                        'type': 'object',
                        'properties': {
                            'repo_url': {
                                'type': 'string',
                                'description': 'GitHub repository URL (https://github.com/user/repo or git@github.com:user/repo.git)'
                            },
                            'branch': {
                                'type': 'string',
                                'description': 'Branch name to clone and analyze (default: main)'
                            }
                        },
                        'required': ['repo_url']
                    }
                ),
                FunctionDeclaration(
                    name='deploy_to_cloudrun',
                    description='Deploy an analyzed project to Google Cloud Run. CRITICAL: Use this function IMMEDIATELY when user says "deploy", "yes", "go ahead", "start", etc. AND context contains project_path (meaning repo was already analyzed). Auto-generate service_name from repo name. Environment variables are automatically loaded from context.',
                    parameters={
                        'type': 'object',
                        'properties': {
                            'project_path': {
                                'type': 'string',
                                'description': 'Local path to the cloned project. Use value from project_context that was set during clone_and_analyze_repo.'
                            },
                            'service_name': {
                                'type': 'string',
                                'description': 'Name for Cloud Run service. Auto-generate from repo name (e.g., "ihealth-backend" from "ihealth_backend.git"). Use lowercase and hyphens.'
                            },
                            'env_vars': {
                                'type': 'object',
                                'description': 'Optional environment variables to inject (e.g. {"GEMINI_API_KEY": "..." }). If available in context, they will be merged.'
                            }
                        },
                        'required': ['project_path', 'service_name']
                    }
                ),
                FunctionDeclaration(
                    name='list_user_repositories',
                    description='List GitHub repositories for the authenticated user. Use this when user asks to see their repos or wants to select a project to deploy.',
                    parameters={
                        'type': 'object',
                        'properties': {},
                        'required': []
                    }
                ),
                FunctionDeclaration(
                    name='get_deployment_logs',
                    description='Fetch recent logs from a deployed Cloud Run service. Use this for debugging deployment issues or when user asks to see logs.',
                    parameters={
                        'type': 'object',
                        'properties': {
                            'service_name': {
                                'type': 'string',
                                'description': 'Cloud Run service name'
                            },
                            'limit': {
                                'type': 'integer',
                                'description': 'Number of log entries to fetch (default: 50)'
                            }
                        },
                        'required': ['service_name']
                    }
                )
            ]
        )
    
    async def _retry_with_backoff(self, func, max_retries: int = 3, base_delay: float = 1.0):
        """
        Retry a function with exponential backoff for network errors
        """
        for attempt in range(max_retries):
            try:
                return func()
            except Exception as e:
                error_str = str(e).lower()
                # Check if it's a network/connectivity error
                is_network_error = any(keyword in error_str for keyword in [
                    'connection aborted', 'connection refused', 'timeout', 
                    'unavailable', 'iocp', 'socket', '503', '502', '504'
                ])
                
                if not is_network_error or attempt == max_retries - 1:
                    raise  # Not a network error or final attempt - propagate
                
                delay = base_delay * (2 ** attempt)  # Exponential backoff
                print(f"[Orchestrator] Network error (attempt {attempt + 1}/{max_retries}): {str(e)[:100]}")
                print(f"[Orchestrator] Retrying in {delay}s...")
                await self._send_progress_message(f"[SYNC] Network issue detected, retrying... (attempt {attempt + 1}/{max_retries})")
                await asyncio.sleep(delay)
        
        raise Exception("Max retries exceeded for network operation")

    async def _send_with_fallback(self, message: str):
        """
        FAANG-Level Message Sending with Multi-Region Fallback
        
        Fallback order:
        1. Primary region (us-central1) via Vertex AI
        2. Fallback regions (us-east1, europe-west1, asia-northeast1) via Vertex AI
        3. Direct Gemini API with user's API key (last resort)
        
        This is how production systems at Google/OpenAI handle quota exhaustion.
        """
        rate_limiter = get_rate_limiter()
        
        # Estimate tokens for rate limiting
        estimated_tokens = rate_limiter.estimate_tokens(message)
        
        # Acquire rate limit permission with fallback
        can_proceed, best_region = await acquire_with_fallback(
            message=message,
            priority=Priority.HIGH,  # Chat operations are high priority
            preferred_region=self.gcloud_project and 'us-central1'
        )
        
        if not can_proceed:
            await self._send_progress_message("[WARNING] High API load detected, request queued...")
        
        # Define the regions to try
        regions_to_try = [best_region] if best_region else []
        regions_to_try.extend(['us-central1', 'us-east1', 'europe-west1', 'asia-northeast1'])
        regions_to_try = list(dict.fromkeys(regions_to_try))  # Remove duplicates, preserve order
        
        last_error = None
        
        for region in regions_to_try:
            try:
                # [SUCCESS] FIX: Save history before switching regions
                saved_history = []
                if self.chat_session and hasattr(self.chat_session, 'history'):
                    saved_history = list(self.chat_session.history)
                    
                # Re-initialize Vertex AI for this region if different from current
                if self.use_vertex_ai:
                    vertexai.init(project=self.gcloud_project, location=region)
                    
                    # Recreate model for this region
                    self.model = GenerativeModel(
                        'gemini-2.0-flash-001',
                        tools=[self._get_function_declarations()],
                        system_instruction=self._get_system_instruction()
                    )
                    # [RESTORE] Restore history!
                    self.chat_session = self.model.start_chat(history=saved_history)
                
                print(f"[Orchestrator] [INFO] Trying region: {region}")
            
                # Try sending message with retry logic
                response = await self._retry_with_backoff(
                    lambda: self.chat_session.send_message(message),
                    max_retries=2,
                    base_delay=1.0
                )
                
                # Success! Record and return
                rate_limiter.record_success(region)
                print(f"[Orchestrator] Success in region: {region}")
                return response
                
            except Exception as e:
                error_str = str(e).lower()
                last_error = e
                
                # Check for quota/rate limit errors
                from google.api_core.exceptions import ResourceExhausted
                is_quota_error = isinstance(e, ResourceExhausted) or any(
                    keyword in error_str for keyword in [
                        'resource exhausted', '429', 'quota', 'rate limit', 'too many requests'
                    ]
                )
                
                if is_quota_error:
                    rate_limiter.record_failure(region, str(e))
                    print(f"[Orchestrator] [WARNING] Region {region} quota exhausted, trying next...")
                    await self._send_progress_message(f"[WARNING] Region {region} busy, switching to backup...")
                    await asyncio.sleep(0)  # Flush message
                    continue  # Try next region
                else:
                    # Non-quota error - don't continue to other regions
                    raise
        
        # All Vertex AI regions exhausted - try Gemini API fallback
        if self.gemini_api_key:
            print(f"[Orchestrator] [SYNC] All Vertex AI regions exhausted, switching to Gemini API")
            await self._send_progress_message("[WARNING] All regions busy. Activating backup AI service...")
            await asyncio.sleep(0)
            
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_api_key)
                
                backup_model = genai.GenerativeModel(
                    model_name='gemini-2.0-flash-001',
                    tools=[self._get_function_declarations_genai()]
                )
                
                backup_chat = backup_model.start_chat(history=[])
                response = backup_chat.send_message(message)
                
                # Switch permanently to Gemini API for this session
                self.use_vertex_ai = False
                self.model = backup_model
                self.chat_session = backup_chat
                
                print(f"[Orchestrator] [SUCCESS] Successfully switched to Gemini API")
                await self._send_progress_message("[SUCCESS] Backup AI service activated - continuing...")
                await asyncio.sleep(0)
                return response
                
            except Exception as fallback_err:
                print(f"[Orchestrator] [ERROR] Gemini API fallback failed: {fallback_err}")
                raise Exception(f"All AI services exhausted. Primary: {last_error}. Backup: {fallback_err}")
        
        # No API key for fallback
        raise Exception(
            f"Vertex AI quota exhausted in all regions. "
            f"Please add a Gemini API key in Settings for automatic fallback, "
            f"or wait a few minutes and try again."
        )
    
    async def _direct_deploy(
        self, 
        progress_notifier: Optional[ProgressNotifier] = None,
        progress_callback: Optional[Callable] = None,
        ignore_env_check: bool = False,  # [SUCCESS] NEW: Allow skipping env var prompt
        explicit_env_vars: Optional[Dict[str, Any]] = None  # [SUCCESS] FAANG: Deterministic Override
    ) -> Dict[str, Any]:
        """
        Logic for direct deployment when intent is confirmed.
        """
        print(f"[Orchestrator] Intent detected: DIRECT DEPLOY (Bypassing LLM loop)")
        print(f"[Orchestrator] _direct_deploy running on instance ID: {id(self)} [VERSION: LIGHTSPEED-10]")
        
        # [SUCCESS] PHASE 10 FIX: Inject explicit_env_vars into context IMMEDIATELY
        # This ensures all subsequent env_vars checks pass correctly
        if explicit_env_vars:
            self.project_context['env_vars'] = explicit_env_vars
            print(f"[Orchestrator] [LIGHTSPEED] Injected {len(explicit_env_vars)} explicit env vars into context UPFRONT")
        
        await self._send_thought_message("Direct deployment intent confirmed. Short-circuiting LLM logic...")
        await self._send_progress_message("Initiating ultra-fast Cloud Run sequence...")
        
        # Extract service name from context if it was provided via service_name_provided event
        custom_service_name = self.project_context.get('custom_service_name')
        repo_url = self.project_context.get('repo_url')
        
        if custom_service_name:
            service_name = custom_service_name
            print(f"[Orchestrator] Using CUSTOM service name: {service_name}")
        elif repo_url:
            base_name = repo_url.split('/')[-1].replace('.git', '').replace('_', '-').lower()
            service_name = base_name
        else:
            base_name = "servergem-app"
            service_name = base_name
            
        # Force function call results
        # [SUCCESS] DirectFunctionCall: Encapsulates function call data for orchestrated execution
        class DirectFunctionCall:
            """Structurally identical to Gemini function calls for unified handler routing."""
            def __init__(self, name: str, args: dict):
                self.name = name
                self.args = args

        project_path = self.project_context.get('project_path')
        
        # [SUCCESS] RESUMPTION INTELLIGENCE: Skip redundant analysis if state is fresh
        cached_analysis = self.project_context.get('analysis')
        cached_url = self.project_context.get('repo_url')
        is_resume = (repo_url and cached_analysis and cached_url == repo_url and 
                     project_path and os.path.exists(project_path))

        if is_resume:
            print(f"[Orchestrator] Correctly identified resume state for: {repo_url}")
            
            # [SUCCESS] HEALING DEPLOY: Force a "Fast Sync" to verify ground truth even in resume
            # This handles cases where a project was previously misidentified as Node.js
            # but is actually Python/Go.
            try:
                print(f"[Orchestrator] 🩺 Performing Fast Sync heuristic re-verification...")
                fast_sync = await self.code_analyzer.analyze_project(project_path, skip_ai=True)
                
                cached_lang = cached_analysis.get('language', 'unknown')
                actual_lang = fast_sync.get('language', 'unknown')
                
                # [SUCCESS] FIX: loose equivalence for JS/TS stack
                is_js_stack = {cached_lang, actual_lang}.issubset({'node', 'typescript', 'javascript', 'nodejs', 'vite', 'react'})
                
                if actual_lang != cached_lang and actual_lang != 'unknown' and not is_js_stack:
                    print(f"[Orchestrator] [WARNING] LANGUAGE MISMATCH DETECTED!")
                    print(f"  - Cached: {cached_lang}")
                    print(f"  - Actual (Ground Truth): {actual_lang}")
                    print(f"  - Action: Wiping stale analysis and forcing HEALING RE-ANALYSIS.")
                    is_resume = False
                    # Drop the broken cache to force refresh
                    self.project_context.pop('analysis', None)
                else:
                    print(f"[Orchestrator] [SUCCESS] Fast Sync confirmed language: {actual_lang} (Compatible with {cached_lang})")
            except Exception as e:
                print(f"[Orchestrator] [WARNING] Fast Sync failed: {e}")
                # Continue with resume if sync fails (best effort)

        if is_resume:
            await self._send_thought_message("Retrieving existing project intelligence from persistent memory...")
            
            analysis_result = {
                'type': 'analysis_report',
                'data': cached_analysis,
                'content': self.project_context.get('last_analysis_formatted', "Resuming previous deployment state...")
            }
            
            # [SUCCESS] CRITICAL FIX: Even in resume, verify env_vars exist before proceeding
            # Session reconnection can cause env_vars loss - must re-request if empty
            existing_vars = self.project_context.get('env_vars')
            if not existing_vars and not ignore_env_check:
                print(f"[Orchestrator] Resume path: env_vars lost (session reconnected?). Re-requesting...")
                return {
                    'type': 'message',
                    'content': "Your session was reconnected. Please re-configure your environment variables to continue.",
                    'metadata': {
                        'type': 'analysis_with_env_request',
                        'request_env_vars': True,
                        'default_name': service_name
                    },
                    'actions': [
                        {
                            'id': 'deploy-direct-after-env',
                            'label': '[ROCKET] QUICK DEPLOY',
                            'type': 'button',
                            'variant': 'primary',
                            'action': 'deploy_to_cloudrun',
                            'intent': 'deploy'
                        }
                    ],
                    'timestamp': datetime.now().isoformat()
                }
        elif repo_url:
            print(f"[Orchestrator] Ensuring project analysis for: {repo_url}...")
            
            # [SUCCESS] FAANG-LEVEL UX: Pass skip_prompt=True for direct deployments
            # This prevents the report from asking "Ready to deploy?" when we are ALREADY deploying.
            analysis_result = await self._handle_clone_and_analyze(
                repo_url,
                branch=self.project_context.get('branch', 'main'),
                progress_notifier=progress_notifier,
                progress_callback=progress_callback,
                skip_deploy_prompt=True # [SUCCESS] NEW: Suppress silly question
            )

            # Check for critical errors
            if analysis_result.get('type') == 'error':
                 return analysis_result

            # Update path if changed
            if analysis_result.get('data', {}).get('project_path'):
                 self.project_context['project_path'] = analysis_result['data']['project_path']
                 project_path = self.project_context['project_path']

            # [SUCCESS] SEQUENTIAL DELIVERY: Send the Analysis Report first
            if self.safe_send and self.session_id:
                await self._send_thought_message("Finalizing project intelligence and structuring deployment architecture...")
                
                # Send the analysis result directly - it's already a well-structured dict
                await self.safe_send(self.session_id, {
                    'type': 'message',
                    'data': analysis_result,
                    'timestamp': datetime.now().isoformat()
                })
                await asyncio.sleep(1.2) # Premium padding for sequential perception

            # [SUCCESS] CRITICAL FLOW CONTROL:
            # If we don't have env vars yet, we ask for them.
            # Otherwise we proceed.
            # [SUCCESS] SKIP TRAP: If ignore_env_check is True (user said "Skip"), we bypass this!
            existing_vars = self.project_context.get('env_vars')
            
            print(f"[Orchestrator] _direct_deploy check: vars={len(existing_vars) if existing_vars else 0}, ignore_check={ignore_env_check}")

            if not existing_vars and not ignore_env_check:
                print(f"[Orchestrator] Pausing direct deployment to request environment variables.")
                return {
                    'type': 'message',
                    'content': "While I prepare the Dockerfile, you can configure environment variables if needed.",
                    'metadata': {
                        'type': 'analysis_with_env_request',
                        'request_env_vars': True,
                        'default_name': service_name
                    },
                    'actions': [
                        {
                            'id': 'deploy-direct-after-env',
                            'label': '[ROCKET] QUICK DEPLOY',
                            'type': 'button',
                            'variant': 'primary',
                            'action': 'deploy_to_cloudrun',
                            'intent': 'deploy'
                        }
                    ],
                    'timestamp': datetime.now().isoformat()
                }

            print(f"[Orchestrator] Env vars found in context ({len(existing_vars)}). Proceeding with deployment.")

            # Check if path is valid now
            if not project_path:
                 return {
                    'type': 'error',
                    'content': f"❌ Failed to acquire repository path after analysis.",
                    'timestamp': datetime.now().isoformat()
                }

        # [SUCCESS] CRITICAL FIX: Include env_vars from project_context to ensure Cloud Run receives them
        # Convert from {key: {value, isSecret}} to {key: value} format for Cloud Run
        
        # FAANG-LEVEL PRIORITY: Explicit > Context > File
        deployment_env_vars = {}
        
        if explicit_env_vars:
             print(f"[Orchestrator] [ROCKET] Using {len(explicit_env_vars)} EXPLICIT environment variables passed from caller.")
             print(f"[Orchestrator] 🔍 Explicit Keys: {list(explicit_env_vars.keys())}")
             deployment_env_vars = explicit_env_vars
             # Update context for consistency
             self.project_context['env_vars'] = explicit_env_vars
        else:
            raw_env_vars = self.project_context.get('env_vars', {})
            
            # Check if nested format (from app.py) and convert
            if raw_env_vars:
                first_value = next(iter(raw_env_vars.values()), None)
                if isinstance(first_value, dict) and 'value' in first_value:
                    # Nested format: {key: {'value': '...', 'isSecret': bool}} -> {key: value}
                    deployment_env_vars = {
                        key: val.get('value', '') 
                        for key, val in raw_env_vars.items()
                    }
                    print(f"[Orchestrator] Converted {len(deployment_env_vars)} env vars from nested to flat format")
                else:
                    # Already flat format
                    deployment_env_vars = raw_env_vars
            else:
                # [SUCCESS] FAANG-LEVEL FIX: Race Condition Protection
                # If env vars are empty, wait briefly and check file/context again
                # This protects against the frontend triggering deploy before file write completes
                deployment_env_vars = {}
                print(f"[Orchestrator] [WARNING] DirectDeploy: Env vars initially empty. Checking fallback/retry...")
                
                p_path = self.project_context.get('project_path')
                if p_path:
                    env_file_path = os.path.join(p_path, '.devgem_env.json')
                    
                    # Active Retry Loop (2 seconds max)
                    for i in range(4):
                        if os.path.exists(env_file_path):
                             try:
                                with open(env_file_path, 'r') as f:
                                    saved_vars = json.load(f)
                                if saved_vars:
                                    print(f"[Orchestrator] ♻️ DirectDeploy: Recovered {len(saved_vars)} env vars from file on retry {i+1}")
                                    deployment_env_vars = {
                                        key: val.get('value', '') if isinstance(val, dict) else val
                                        for key, val in saved_vars.items()
                                    }
                                    # Heal the context
                                    self.project_context['env_vars'] = saved_vars
                                    break
                             except Exception as e:
                                 print(f"[Orchestrator] Retry read failed: {e}")
                        
                        print(f"[Orchestrator] Waiting for env file sync (attempt {i+1})...")
                        await asyncio.sleep(0.5)
        
        # --------------------------------------------------------------------------------
        # [SUCCESS] ROBUSTNESS FIX: Fallback to persistent file for DirectFunctionCall too
        # --------------------------------------------------------------------------------
        if not deployment_env_vars:
            try:
                # Need project_path here. Either arg or context.
                p_path = call.get('project_path') or self.project_context.get('project_path')
                if p_path:
                    env_file_path = os.path.join(p_path, '.devgem_env.json')
                    if os.path.exists(env_file_path):
                        print(f"[Orchestrator] ♻️ DirectDeploy: Restoring env vars from file: {env_file_path}")
                        with open(env_file_path, 'r') as f:
                            saved_vars = json.load(f)
                        deployment_env_vars = {
                            key: val.get('value', '') if isinstance(val, dict) else val
                            for key, val in saved_vars.items()
                        }
                        # Update context so subsequent calls have it
                        self.project_context['env_vars'] = saved_vars
            except Exception as e:
                print(f"[Orchestrator] Warning: Failed to restore env vars in DirectDeploy: {e}")
                
        print(f"[Orchestrator] DirectFunctionCall with {len(deployment_env_vars)} env vars for Cloud Run: {list(deployment_env_vars.keys())}")
        
        deploy_call = DirectFunctionCall('deploy_to_cloudrun', {
            'project_path': project_path, 
            'service_name': service_name,
            'env_vars': deployment_env_vars  # [SUCCESS] Now properly formatted!
        })
        
        # Await the handler WITH PROGRESS CALLBACKS
        deploy_result = await self._handle_function_call(
            deploy_call,
            progress_notifier=progress_notifier,
            progress_callback=progress_callback
        )
        
        # [SUCCESS] CRITICAL: Format into a natural response, don't just return the dict data
        if deploy_result.get('type') == 'error':
            return deploy_result
            
        return {
            'type': 'message',
            'content': deploy_result.get('content', "[SUCCESS] Deployment complete!"),
            'deployment_url': deploy_result.get('deployment_url'),
            'metadata': {'type': 'deployment_complete'},
            'timestamp': datetime.now().isoformat()
        }

    def _get_system_instruction(self) -> str:
        """
        AI Brain - Optimized for Gemini 3 Hackathon
        Combines deep logic with elite engineering personality.
        """
        return """
# DevGem AI - Elite Deployment Copilot

You are DevGem, an elite Principal Engineer from Google DeepMind. Your mission is to make Google Cloud Run deployments so easy they feel like magic.

## Your Personality
- Professional, efficient, and proactive.
- Speak with confidence but stay helpful. Use technical terms correctly (e.g., "ephemeral storage", "concurrency", "cold starts").
- Use clear, efficient indicators ([BUILD], [DEPLOY], [SUCCESS]).
- **BRAND LOYALTY (CRITICAL)**: You represent **DevGem**. You MUST NEVER recommend or mention competitors like Vercel, Netlify, or AWS. Solve problems within Google Cloud.

## Core Capabilities
1. **REPO ANALYSIS**: Clone and scan GitHub repos to detect frameworks, ports, and dependencies.
2. **DOCKER EXPERT**: Generate high-performance, secure, multi-stage Dockerfiles automatically.
3. **GCP ARCHITECT**: Deploy to Cloud Run with optimized settings (1 vCPU, 512MB RAM as baseline).
4. **DOMAIN SPECIALIST**: Provide instant working URLs!

## Critical Execution Rules (STATE MACHINE)
- **NO EMOJIS**: NEVER use Unicode emojis in your responses. Use professional ASCII indicators like [SUCCESS], [ERROR], [BUILD], [DEPLOY] instead. This is critical for terminal compatibility on Windows.
- **NO LOOPS**: If `project_path` exists in the `Project Context`, the repo is ALREADY ANALYZED. 
- **DIRECT ACTION**: If the user says "deploy", "yes", "go ahead", or "start", IMMEDIATELY call `deploy_to_cloudrun`. Never ask for the URL again if you already have it.
- **CONTEXT AWARENESS**: Check the `Project Context` block before answering. If you see env vars are stored, move to the next logical step (deployment).
- **SERVICE NAMES**: Always generate service names from the repository name (e.g., "my-app" from "user/my-app").

## Operational Logic
- When a user provides a link -> `clone_and_analyze_repo`
- When repo is analyzed -> Present findings and ask to deploy (recommend action).
- When user confirms -> `deploy_to_cloudrun`
- When deployment fails -> `get_deployment_logs` and diagnose the issue.

Your goal is to get the user from "Zero to Live URL" in under 60 seconds.
""".strip()

    async def process_message(
        self, 
        user_message: str, 
        session_id: str, 
        progress_notifier: Optional[ProgressNotifier] = None,
        progress_callback: Optional[Callable] = None,
        safe_send: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Main entry point with FIXED progress messaging
        
        [SUCCESS] CRITICAL FIX: Store safe_send/session_id BEFORE any async operations
        Now ALL methods can send progress messages!
        """
        
        # [CRITICAL] Set up progress context
        print(f"[Orchestrator] Setting up progress context for session {session_id}")
        self.session_id = session_id
        self.safe_send = safe_send
        
        # Track user message in UI history
        self.ui_history.append({
            "role": "user",
            "content": user_message,
            "timestamp": datetime.now().isoformat()
        })
        
        print(f"[Orchestrator] Progress context set: safe_send={bool(self.safe_send)}, session_id={self.session_id}")
        
        # [TEST] Send immediate progress message
        await self._send_progress_message("DevGem AI is processing your request...")
    
        # [LOG] Start processing
        # [LOG] Start processing
        await self._send_thought_message("Analyzing request intent and project context...")
        
        # [SUCCESS] STRATEGIC UPDATE: Always scan for GitHub URLs first and store them
        # This fixes the "help deploy [URL]" scenario where URL isn't in context yet
        import re
        github_regex = r'(https?://github\.com/[a-zA-Z0-9-_./]+)'
        urls = re.findall(github_regex, user_message)
        if urls:
            repo_url = urls[0]
            if repo_url.endswith('.git'):
                pass
            else:
                # Optional: append .git if missing, but let clone handle it usually
                pass
            
            self.project_context['repo_url'] = repo_url
            print(f"[Orchestrator] 🔗 Extracted and saved Repo URL: {repo_url}")
            # If we just found a URL, we should probably analyze it unless "deploy" is explicitly requested
            # asking to "help deploy..." implies we should probably clone/analyze first
        
        # BEFORE sending to Gemini, check for obvious deployment intent
        deploy_keywords = [
            'deploy', 'yes', 'go', 'start', 'proceed', 'ok', 'okay', 'do it', 'run', 'push',
            'yeah', 'yep', 'sure', 'fine', 'proceed now', 'go ahead',
            'redeploy', 'retry', 'try again', 'fix', 'fix it', 'skip'
        ]
        
        # STOP AUTO-RETRY LOOP: Negative keywords that indicate this might be an error report fed back
        failure_keywords = ['fail', 'error', 'exception', '400', '500', 'timeout']
        
        user_msg_clean = user_message.lower().strip().rstrip('!').rstrip('.')
        
        # Check for failure keywords first
        is_failure_report = any(fk in user_msg_clean for fk in failure_keywords)
        
        # FIXED: Use looser matching to catch "help me deploy", "pls deploy", "skip" etc.
        # BUT only if we have a path OR we just found a URL (to trigger auto-clone in direct_deploy)
        # AND NOT if it looks like a failure report (prevents infinite retry loops)
        if any(kw in user_msg_clean for kw in deploy_keywords) and not is_failure_report:
             # If we have a path, OR if we have a repo_url (which we might have just extracted)
             if self.project_context.get('project_path') or self.project_context.get('repo_url'):
                # [SUCCESS] SKIP LOGIC: If user says 'skip' OR sends specific metadata, force deployment
                # This covers both the button click (with metadata) and manually typing "skip"
                is_skip = 'skip' in user_msg_clean
                
                # Check for metadata in message object if passed (though process_message signature takes str)
                # But we handle JSON payloads below... wait, the JSON payload handler handles service_name_provided
                # Let's check if the user_message IS a JSON with type 'env_skip'
                try:
                    if user_message.strip().startswith('{'):
                         payload = json.loads(user_message)
                         if payload.get('metadata', {}).get('type') == 'env_skip':
                             is_skip = True
                             print("[Orchestrator] Detected explicit SKIP event from UI payload")
                except:
                    pass
                
                deploy_result = await self._direct_deploy(
                    progress_notifier=progress_notifier,
                    progress_callback=progress_callback,
                    ignore_env_check=is_skip # [SUCCESS] Pass flag
                )
                
                # [SUCCESS] PERISTENCE FIX: Record Direct Deploy result
                self._add_to_ui_history(
                    role="assistant",
                    content=deploy_result.get('content', ''),
                    metadata={"type": deploy_result.get('type', 'message')},
                    data=deploy_result.get('data'),
                    actions=deploy_result.get('actions')
                )
                return deploy_result
        
        # Check for listing repos
        if any(kw in user_message.lower() for kw in ['list my repo', 'show my repo', 'my repositories']):
            await self._send_thought_message("Retrieving user repository catalog...")
            return await self._handle_list_repos()

        # Handle service name provided event (JSON)
        try:
            if user_message.startswith('{'):
                payload = json.loads(user_message)
                if payload.get('type') == 'service_name_provided':
                    name = payload.get('name')
                    payload_repo_url = payload.get('repo_url')
                    
                    if payload_repo_url:
                        self.project_context['repo_url'] = payload_repo_url
                        print(f"[Orchestrator] 🔗 Repo URL updated from payload: {payload_repo_url}")

                    if name:
                        self.project_context['custom_service_name'] = name
                        print(f"[Orchestrator] Service name updated in context: {name}")
                        # Immediately trigger deployment with the new name
                        deploy_result = await self._direct_deploy(
                            progress_notifier=progress_notifier,
                            progress_callback=progress_callback
                        )
                        
                        # [SUCCESS] PERISTENCE FIX: Record Direct Deploy result
                        self._add_to_ui_history(
                            role="assistant",
                            content=deploy_result.get('content', ''),
                            metadata={"type": deploy_result.get('type', 'message')},
                            data=deploy_result.get('data'),
                            actions=deploy_result.get('actions')
                        )
                        return deploy_result
        except:
            pass
            
        await self._send_thought_message("Consulting Gemini for strategic reasoning...")
    
        # Initialize chat session if needed
        # [SUCCESS] CRITICAL FIX: Disable response_validation to handle deployment error responses
        # Gemini's safety filters can block error messages (e.g., "Container failed to start")
        if not self.chat_session:
            self.chat_session = self.model.start_chat(
                history=self.conversation_history,
                response_validation=False  # Allow blocked responses for error handling
            )
        
        # [SUCCESS] OPTIMIZATION: Smart context injection
        context_prefix = self._build_context_prefix()
        enhanced_message = f"{context_prefix}\n\nUser: {user_message}" if context_prefix else user_message

        try:
            # Send to Gemini with function calling enabled
            response = await self._send_with_fallback(enhanced_message)
            
            # Check if Gemini wants to call a function
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                    for part in candidate.content.parts:
                        if hasattr(part, 'function_call') and part.function_call:
                            # Route to real service handler
                            function_result = await self._handle_function_call(
                                part.function_call,
                                progress_notifier=progress_notifier,
                                progress_callback=progress_callback
                            )
                            
                            # Send function result back to Gemini - with retry logic
                            # [SUCCESS] CRITICAL FIX: Wrap in try-except for ResponseValidationError
                            final_response = None
                            response_text = None
                            
                            try:
                                final_response = await self._retry_with_backoff(
                                    lambda: self.chat_session.send_message(
                                        Part.from_function_response(
                                            name=part.function_call.name,
                                            response=function_result
                                        )
                                    ),
                                    max_retries=3,
                                    base_delay=2.0
                                )
                                # Extract text from final response
                                response_text = self._extract_text_from_response(final_response)
                            except Exception as validation_error:
                                # [SUCCESS] Handle ResponseValidationError and other blocked responses gracefully
                                error_str = str(validation_error).lower()
                                if 'blocked' in error_str or 'validation' in error_str or 'response was blocked' in error_str:
                                    print(f"[Orchestrator] [WARNING] Gemini blocked response, using function result directly")
                                    response_text = None  # Will use function_result.content directly
                                else:
                                    print(f"[Orchestrator] Error sending function response: {validation_error}")
                                    response_text = None
                            
                            # Standardized result
                            result = {
                                'type': function_result.get('type', 'message'),
                                'content': response_text or function_result.get('content', ''),
                                'data': function_result.get('data'),
                                'actions': function_result.get('actions'),
                                'deployment_url': function_result.get('deployment_url'),
                                'request_env_vars': function_result.get('request_env_vars', False),
                                'detected_env_vars': function_result.get('detected_env_vars', []),
                                'timestamp': datetime.now().isoformat()
                            }
                            
                            # [SUCCESS] Record Assistant Response to UI History
                            self._add_to_ui_history(
                                role="assistant",
                                content=result['content'],
                                metadata={"type": result['type']},
                                data=result.get('data'),
                                actions=result.get('actions')
                            )
                            
                            return result
            
            # Regular text response (no function call needed)
            response_text = self._extract_text_from_response(response)
            
            result = {
                'type': 'message',
                'content': response_text if response_text else 'I received your message but couldn\'t generate a response. Please try again.',
                'timestamp': datetime.now().isoformat()
            }
            
            # [SUCCESS] Record Assistant Response to UI History
            self._add_to_ui_history(
                role="assistant",
                content=result['content'],
                metadata={"type": "message"}
            )
            
            return result
            
        except Exception as e:
            error_msg = str(e)
            print(f"[Orchestrator] Error: {error_msg}")
            import traceback
            traceback.print_exc()
            
            # User-friendly error message for network issues
            if any(keyword in error_msg.lower() for keyword in ['connection', 'network', 'unavailable', 'timeout', 'iocp', 'socket']):
                user_message = (
                    "**Network Connection Issue**\n\n"
                    "There was a problem connecting to the AI service. This can happen due to:\n"
                    "• Temporary network issues\n"
                    "• Firewall or antivirus blocking connections\n"
                    "• Service availability issues\n\n"
                    "**Please try again in a few moments.** If the issue persists, check your network connection."
                )
            else:
                user_message = f'[ERROR] Error processing message: {error_msg}'
            
            return {
                'type': 'error',
                'content': user_message,
                'timestamp': datetime.now().isoformat()
            }

    async def _handle_clone_and_analyze(
        self, 
        repo_url: str, 
        branch: str = 'main', 
        progress_notifier: Optional[ProgressNotifier] = None,
        progress_callback: Optional[Callable] = None,
        skip_deploy_prompt: bool = False # [SUCCESS] NEW: Suppress confirmation question
    ) -> Dict[str, Any]:
        """
        Clone GitHub repo and analyze it - FIXED with real-time progress
        """
        
        try:
            project_path = None
            # FIX: Check if repo already exists in context to prevent "Duplicate Clone"
            # [SUCCESS] DEFENSE IN DEPTH: Verify it's actually the SAME repo
            cached_path = self.project_context.get('project_path')
            cached_url = self.project_context.get('repo_url')
            
            if cached_path and os.path.exists(cached_path):
                # Check for context mismatch (Stale session leakage protection)
                # [SUCCESS] DEFENSE IN DEPTH: Normalize URLs to prevent false positives (trailing slash, casing, .git)
                norm_requested = self._normalize_repo_url(repo_url)
                norm_cached = self._normalize_repo_url(cached_url)
                
                if norm_cached != norm_requested:
                    print(f"[Orchestrator] [WARNING] Context Mismatch Detected (Repository Swap)!")
                    print(f"  - Requested: {norm_requested}")
                    print(f"  - Cached: {norm_cached}")
                    print(f"  - Action: Wiping stale context and forcing fresh clone.")
                    
                    # Wipe context but keep critical auth/settings if needed
                    # Just clearing project-specific keys
                    self.project_context.pop('project_path', None)
                    self.project_context.pop('repo_url', None)
                    self.project_context.pop('branch', None)
                    self.project_context.pop('env_vars', None) # Clear old env vars too!
                    
                    # Let execution fall through to standard cloning logic
                else:
                    print(f"[Orchestrator] Reuse existing repo at {cached_path}")
                    if progress_notifier:
                        await progress_notifier.complete_stage(
                            DeploymentStages.REPO_CLONE,
                            "[SUCCESS] Using cached repository"
                        )
                    project_path = cached_path
            
            # STAGE 1: Repository Cloning (Only if we don't have project_path yet)
            if not project_path:
                if progress_notifier:
                    await progress_notifier.start_stage(
                        DeploymentStages.REPO_CLONE,
                        "📦 Cloning repository from GitHub..."
                    )
                
                # [SUCCESS] PHASE 2: Real-time progress callback for clone
                async def clone_progress(message: str):
                    """Send real-time clone progress updates"""
                    try:
                        if progress_notifier:
                            await progress_notifier.send_update(
                                DeploymentStages.REPO_CLONE,
                                "in-progress",
                                message
                            )
                        await self._send_progress_message(message)
                        await asyncio.sleep(0)  # [SUCCESS] Force event loop flush
                    except Exception as e:
                        print(f"[Orchestrator] Clone progress error: {e}")
                
                await self._send_progress_message("📦 Cloning repository from GitHub...")
                await asyncio.sleep(0)  # [SUCCESS] Force immediate delivery
                
                # SAFEGUARD: Ensure branch is never None (manifested as NoneType error in subprocess)
                if not branch:
                    branch = 'main'
                
                clone_result = await self.github_service.clone_repository(
                    repo_url, 
                    branch,
                    progress_callback=clone_progress  # [SUCCESS] PHASE 2: Pass callback
                )
                
                if not clone_result.get('success'):
                    if progress_notifier:
                        await progress_notifier.fail_stage(
                            DeploymentStages.REPO_CLONE,
                            f"Failed to clone: {clone_result.get('error')}",
                            details={"error": clone_result.get('error')}
                        )
                    return {
                        'type': 'error',
                        'content': f"[ERROR] **Failed to clone repository**\n\n{clone_result.get('error')}\n\nPlease check:\n• Repository URL is correct\n• You have access to the repository\n• GitHub token has proper permissions",
                        'timestamp': datetime.now().isoformat()
                    }
                
                project_path = clone_result['local_path']
                self.project_context['project_path'] = project_path
                self.project_context['repo_url'] = repo_url
                self.project_context['branch'] = branch
                
                if progress_notifier:
                    await progress_notifier.complete_stage(
                        DeploymentStages.REPO_CLONE,
                        f"[SUCCESS] Repository cloned ({clone_result['files_count']} files)",
                        details={
                            "repo_name": clone_result['repo_name'],
                            "files": clone_result['files_count'],
                            "size": f"{clone_result['size_mb']} MB",
                            "commit": clone_result.get('git_meta', {}).get('latest_commit', 'HEAD'),
                            "author": clone_result.get('git_meta', {}).get('author', 'Unknown'),
                            "msg": clone_result.get('git_meta', {}).get('commit_message', '')
                        }
                    )
                
                await self._send_progress_message(f"[SUCCESS] Repository cloned: {clone_result['repo_name']} ({clone_result['files_count']} files)")
                await asyncio.sleep(0)  # [SUCCESS] Force immediate delivery

            # [SUCCESS] PHASE 14: Surgical Requirement Sanitization (Cloud Run Compat)
            # Ensure we use headless packages to avoid libGL issues (The "FAANG" Approach)
            if project_path:
                 self._sanitize_requirements(project_path)

            
            # Step 2: Analyze project with FIXED progress callback
            if progress_notifier:
                await progress_notifier.start_stage(
                    DeploymentStages.CODE_ANALYSIS,
                    "🔍 Analyzing project structure and dependencies..."
                )
            
            await self._send_progress_message("🔍 Analyzing project structure and dependencies...")
            await asyncio.sleep(0)  # [SUCCESS] Force immediate delivery
            
            # [SUCCESS] FIX 4: Robust progress callback with error handling
            async def analysis_progress(message: str):
                """Send progress updates during analysis with fallbacks"""
                try:
                    # Try progress notifier first
                    if progress_notifier:
                        await progress_notifier.send_update(
                            DeploymentStages.CODE_ANALYSIS,
                            "in-progress",
                            message
                        )
                    
                    # Always try direct WebSocket send as backup
                    await self._send_progress_message(message)
                    await asyncio.sleep(0)  # [SUCCESS] CRITICAL: Force event loop flush
                    
                except Exception as e:
                    print(f"[Orchestrator] Progress callback error: {e}")
                    # Don't fail the analysis if progress update fails
            
            try:
                # [SUCCESS] PHASE 1.1: Pass progress_notifier to analysis service
                analysis_result = await self.analysis_service.analyze_and_generate(
                    project_path,
                    progress_callback=analysis_progress,
                    progress_notifier=progress_notifier  # [SUCCESS] NEW: Pass notifier through
                )
            except Exception as e:
                error_msg = str(e)
                # Check if it's a quota error
                if '429' in error_msg or 'quota' in error_msg.lower() or 'resource exhausted' in error_msg.lower():
                    if progress_notifier:
                        await progress_notifier.fail_stage(
                            DeploymentStages.CODE_ANALYSIS,
                            "❌ API Quota Exceeded",
                            details={"error": "Gemini API quota limit reached"}
                        )
                    raise Exception(f"🚨 Gemini API Quota Exceeded. Please check your API quota at https://ai.google.dev/ and try again later.")
                else:
                    raise e
            
            if not analysis_result.get('success'):
                if progress_notifier:
                    await progress_notifier.fail_stage(
                        DeploymentStages.CODE_ANALYSIS,
                        f"Analysis failed: {analysis_result.get('error')}",
                        details={"error": analysis_result.get('error')}
                    )
                return {
                    'type': 'error',
                    'content': f"[ERROR] **Analysis failed**\n\n{analysis_result.get('error')}",
                    'timestamp': datetime.now().isoformat()
                }
            
            analysis_data = analysis_result['analysis']
            
            if progress_notifier:
                await progress_notifier.complete_stage(
                    DeploymentStages.CODE_ANALYSIS,
                    f"[SUCCESS] Analysis complete: {analysis_data['framework']} detected",
                    details={
                        "framework": analysis_data['framework'],
                        "language": analysis_data['language'],
                        "dependencies": analysis_data.get('dependencies_count', 0),
                        "entry_point": analysis_data.get('entry_point', 'N/A'),
                        "port": analysis_data.get('port', 'Auto'),
                        "database": analysis_data.get('database', 'None detected'),
                        "env_vars_detected": len(analysis_data.get('env_vars', []))
                    }
                )
            
            await self._send_progress_message(f"[SUCCESS] Analysis complete: {analysis_data['framework']} detected")
            await asyncio.sleep(0)  # [SUCCESS] Force immediate delivery

            # [SUCCESS] FAANG-LEVEL: Generate service_name from repo_url for UI display
            # Integrates with user preferences for auto-naming vs interactive mode
            service_name = 'servergem-app'  # Default fallback
            if repo_url:
                # Extract repo name from URL (e.g., "boostIQ.git" -> "boostiq")
                repo_name = repo_url.split('/')[-1].replace('.git', '').replace('_', '-').lower()
                # Sanitize: Cloud Run requires lowercase alphanumeric + hyphens
                import re
                service_name = re.sub(r'[^a-z0-9-]', '-', repo_name).strip('-')[:63]
            
            # Store suggested name in context for later use
            self.project_context['suggested_service_name'] = service_name
            
            # [SUCCESS] SURGICAL FIX: Removed duplicate .env prompts
            # The .env screen will be shown ONCE in the final analysis response
            # This ensures proper message ordering: Analysis Result -> .env Screen -> Deploy Button
            
            # Step 3: Generate and save Dockerfile
            if progress_notifier:
                await progress_notifier.start_stage(
                    DeploymentStages.DOCKERFILE_GEN,
                    "🐳 Generating optimized Dockerfile..."
                )
            
            await self._send_progress_message("🐳 Generating optimized Dockerfile...")
            await asyncio.sleep(0)  # [SUCCESS] Force immediate delivery
            
            # [SUCCESS] PHASE 2: Real-time progress for Dockerfile save
            async def dockerfile_progress(message: str):
                """Send real-time Dockerfile save updates"""
                try:
                    if progress_notifier:
                        await progress_notifier.send_update(
                            DeploymentStages.DOCKERFILE_GEN,
                            "in-progress",
                            message
                        )
                    await self._send_progress_message(message)
                    await asyncio.sleep(0)  # [SUCCESS] Force event loop flush
                except Exception as e:
                    print(f"[Orchestrator] Dockerfile progress error: {e}")
            
            dockerfile_save = await self.docker_service.save_dockerfile(
                analysis_result['dockerfile']['content'],
                project_path,
                progress_callback=dockerfile_progress  # [SUCCESS] PHASE 2: Pass callback
            )
            
            if progress_notifier:
                await progress_notifier.complete_stage(
                    DeploymentStages.DOCKERFILE_GEN,
                    "[SUCCESS] Dockerfile generated with optimizations",
                    details={
                        "path": dockerfile_save.get('path', f'{project_path}/Dockerfile'),
                        "optimizations": len(analysis_result['dockerfile'].get('optimizations', []))
                    }
                )
            
            await self._send_progress_message("[SUCCESS] Dockerfile generated with optimizations")
            await asyncio.sleep(0)  # [SUCCESS] Force immediate delivery
            
            # Step 4: Create .dockerignore
            self.docker_service.create_dockerignore(
                project_path,
                analysis_result['analysis']['language']
            )
            
            # Store analysis in context
            self.project_context['analysis'] = analysis_result['analysis']
            self.project_context['analysis_results'] = analysis_result['analysis']  # [SUCCESS] Alias for backwards compat
            self.project_context['framework'] = analysis_result['analysis']['framework']
            self.project_context['language'] = analysis_result['analysis']['language']
            
            # Format beautiful response
            # Pass skip_deploy_prompt to suppress the "Ready to deploy?" question in direct mode
            skip_prompt = locals().get('skip_deploy_prompt', False)
            content = self._format_analysis_response(
                analysis_result, 
                dockerfile_save, 
                repo_url,
                skip_prompt=skip_prompt
            )
            
            # Persist for resumption visibility
            self.project_context['last_analysis_formatted'] = content
            
            # [SUCCESS] ALWAYS offer env vars collection (user decides if needed)
            env_vars_detected = analysis_result['analysis'].get('env_vars', [])
            
            if env_vars_detected and len(env_vars_detected) > 0:
                content += f"\n\n⚙️ **Environment Variables Detected:** {len(env_vars_detected)}\n"
                content += "Variables like: " + ", ".join([f"`{v}`" for v in env_vars_detected[:3]])
                if len(env_vars_detected) > 3:
                    content += f" and {len(env_vars_detected) - 3} more"
            
            return {
                'type': 'analysis_report',
                'content': content,
                'data': analysis_result,
                'metadata': {
                    'type': 'analysis_report',
                    'detected_env_vars': env_vars_detected
                },
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"[Orchestrator] Clone and analyze error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'error',
                'content': f'[ERROR] **Analysis failed**\n\n```\n{str(e)}\n```\n\nPlease try again or check the logs.',
                'timestamp': datetime.now().isoformat()
            }




    async def _send_progress_message(self, message: str, actions: List[Dict] = None):
        """Send a standard progress update message"""
        if self.safe_send and self.session_id:
            try:
                msg_data = {
                    'type': 'progress',
                    'content': message
                }
                if actions:
                    msg_data['actions'] = actions
                await self.safe_send(self.session_id, msg_data)
                await asyncio.sleep(0)
            except Exception as e:
                print(f"[Orchestrator] Error sending progress: {e}")

    async def send_thought(self, content: str):
        """Send a 'Neuro-Log' thought packet to the frontend."""
        if self.safe_send and self.session_id:
            try:
                await self.safe_send(self.session_id, {
                    'type': 'thought',
                    'content': content,
                    'timestamp': datetime.now().isoformat()
                })
            except Exception as e:
                print(f"[Orchestrator] Error sending thought: {e}")

    def _update_deployment_stage(self, stage_id: str, label: str, status: str, progress: int, message: str = None, logs: List[str] = None):
        """Helper to maintain structured deployment stages for persistence"""
        if not self.active_deployment:
            return
            
        stages = self.active_deployment.get('stages', [])
        # Find if stage already exists
        stage = next((s for s in stages if s['id'] == stage_id), None)
        
        if not stage:
            stage = {
                'id': stage_id,
                'label': label,
                'status': status,
                'startTime': datetime.now().isoformat(),
                'details': logs or []
            }
            stages.append(stage)
        else:
            stage['status'] = status
            if logs:
                # Merge logs without duplicates
                combined = stage['details'] + logs
                stage['details'] = list(dict.fromkeys(combined)) # Preserve order
        
        if message:
            stage['message'] = message
            
        self.active_deployment['stages'] = stages
        self.active_deployment['currentStage'] = stage_id
        self.active_deployment['overallProgress'] = progress

    async def _send_thought_message(self, thought: str):
        """
        Broadcasting AI thoughts in real-time
        """
        if not self.safe_send or not self.session_id:
            return
            
        # [SUCCESS] SANITIZATION: Never send raw JSON strings as thoughts
        if thought.strip().startswith('{') or thought.strip().startswith('['):
            try:
                import json
                parsed = json.loads(thought)
                # Extract description or a clean summary
                thought = parsed.get('description') or parsed.get('message') or f"Strategic {list(parsed.keys())[0]} completed"
            except:
                thought = "Analyzing complex data structure..."

        try:
            # [SUCCESS] FAANG-Level Thought Propagation
            await self.safe_send(self.session_id, {
                'type': 'thought',
                'content': thought,
                'timestamp': datetime.now().isoformat()
            })
            await asyncio.sleep(0)  # Flush immediately
        except Exception as e:
            print(f"[Orchestrator] Error sending thought: {e}")
    
    def _extract_text_from_response(self, response) -> str:
        """
        Extract text content from Gemini response safely.
        """
        progress = 0 # Initialize scope safety
        try:
            text = ""
            # First, try to iterate through candidates and parts manually (safest for multi-part)
            if hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                    texts = []
                    for part in candidate.content.parts:
                        if hasattr(part, 'text') and part.text:
                            texts.append(part.text)
                    if texts:
                        text = "".join(texts)
            
            # Fallback to response.text if possible (for simple responses)
            if not text and hasattr(response, 'text'):
                try:
                    text = response.text
                except (ValueError, IndexError, AttributeError):
                    pass
            
            # RECOVERY: Strip lazy "tool_outputs" repeats
            if text and ('tool_outputs' in text or 'deploy_to_cloudrun_response' in text):
                print(f"[Orchestrator] Detected raw tool output leak in response, cleaning...")
                # Try to extract the narrative part if there is one
                lines = text.split('\n')
                clean_lines = []
                for line in lines:
                    if 'tool_outputs' in line or 'deploy_to_cloudrun_response' in line:
                        continue
                    if line.strip().startswith('{') or line.strip().endswith('}'):
                        continue
                    clean_lines.append(line)
                text = '\n'.join(clean_lines).strip()
                
            return text
        except Exception as e:
            print(f"[Orchestrator] Error extracting text: {e}")
        return ''
    
    def _sanitize_requirements(self, project_path: str):
        """
        Surgical fix for requirements.txt to ensure Cloud Run compatibility.
        Specifically swaps opencv-python for opencv-python-headless to eliminate libGL dependency.
        """
        try:
            req_path = os.path.join(project_path, 'requirements.txt')
            if os.path.exists(req_path):
                print(f"[Orchestrator] 🩺 Sanitizing requirements at {req_path}")
                with open(req_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                
                modified = False
                new_lines = []
                for line in lines:
                    # Detect opencv-python but NOT headless
                    if 'opencv-python' in line and 'opencv-python-headless' not in line:
                        # Replace with headless
                        new_line = line.replace('opencv-python', 'opencv-python-headless')
                        print(f"[Orchestrator] 🔄 Swapping dependency: {line.strip()} -> {new_line.strip()}")
                        new_lines.append(new_line)
                        modified = True
                    else:
                        new_lines.append(line)
                
                if modified:
                    with open(req_path, 'w', encoding='utf-8') as f:
                        f.writelines(new_lines)
                    print("[Orchestrator] ✅ Sanitization complete: requirements.txt updated.")
        except Exception as e:
            print(f"[Orchestrator] [WARNING] Failed to sanitize requirements: {e}")

    async def _handle_function_call(
        self, 
        function_call, 
        progress_notifier: Optional[ProgressNotifier] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Route Gemini function calls to real service implementations
        
        Args:
            function_call: Gemini function call object
            progress_callback: Optional async callback for WebSocket updates
        """
        
        function_name = function_call.name
        args = dict(function_call.args)
        
        print(f"[Orchestrator] Function call: {function_name}")
        if 'env_vars' in args and args['env_vars']:
             print(f"[Orchestrator] [INFO] Function Args contain {len(args['env_vars'])} env vars: {list(args['env_vars'].keys())}")
        else:
             if 'env_vars' in args:
                 print(f"[Orchestrator] [WARNING] Function Args contain EMPTY 'env_vars' dict")
             else:
                 print(f"[Orchestrator] [WARNING] Function Args MISSING 'env_vars' key")
                 
             # [SUCCESS] CRITICAL FIX: Safety Net Injection
             # If args are missing or empty but context has them (e.g. from app.py upload), INJECT THEM.
             if function_name == 'deploy_to_cloudrun':
                 context_vars = self.project_context.get('env_vars')
                 if context_vars:
                     print(f"[Orchestrator] [SAFETY] Safety Net: Injecting {len(context_vars)} env vars from Project Context")
                     # Convert session format {'key': {'value': 'v'}} -> {'key': 'v'} if needed
                     flat_vars = {}
                     for k, v in context_vars.items():
                         if isinstance(v, dict) and 'value' in v:
                             flat_vars[k] = v['value']
                         else:
                             flat_vars[k] = str(v)
                     args['env_vars'] = flat_vars
                 else:
                      print(f"[Orchestrator] [SAFETY] 🔎 Context empty. Attempting DEEP RECOVERY from local file store...")
                      # [SUCCESS] FAANG-LEVEL RECOVERY: Try to reload from .devgem_env.json if memory was wiped
                      project_path = args.get('project_path') or self.project_context.get('project_path')
                      loaded_vars = None
                      
                      # Try 1: Local project file
                      if project_path and os.path.exists(os.path.join(project_path, '.devgem_env.json')):
                          try:
                              with open(os.path.join(project_path, '.devgem_env.json'), 'r') as f:
                                  loaded_vars = json.load(f)
                                  print(f"[Orchestrator] [SAFETY] ✅ DEEP RECOVERY SUCCESS (local file): Loaded {len(loaded_vars)} vars.")
                          except Exception as e:
                              print(f"[Orchestrator] [SAFETY] ❌ Local file recovery failed: {e}")
                      
                      # Try 2: Global Backup Store (uses repo_url hash)
                      if not loaded_vars:
                          repo_url = self.project_context.get('repo_url')
                          if repo_url:
                              try:
                                  repo_hash = hashlib.md5(repo_url.encode()).hexdigest()
                                  home = os.path.expanduser("~")
                                  global_env_file = os.path.join(home, ".gemini", "antigravity", "env_store", f"{repo_hash}.json")
                                  if os.path.exists(global_env_file):
                                      with open(global_env_file, 'r') as f:
                                          loaded_vars = json.load(f)
                                      print(f"[Orchestrator] [SAFETY] ✅ DEEP RECOVERY SUCCESS (global store): Loaded {len(loaded_vars)} vars.")
                              except Exception as e:
                                  print(f"[Orchestrator] [SAFETY] ❌ Global store recovery failed: {e}")
                      
                      if loaded_vars:
                          # Standardize format for handler
                          flat_vars = {}
                          for k, v in loaded_vars.items():
                              if isinstance(v, dict) and 'value' in v:
                                  flat_vars[k] = v['value']
                              else:
                                  flat_vars[k] = str(v)
                          args['env_vars'] = flat_vars
                          # Restore memory for next time
                          self.project_context['env_vars'] = loaded_vars
                      else:
                          print(f"[Orchestrator] ❌ Safety Net Failed: All recovery sources empty")
        
        # Route to real service handlers
        handlers = {
            'clone_and_analyze_repo': self._handle_clone_and_analyze,
            'deploy_to_cloudrun': self._handle_deploy_to_cloudrun,
            'list_user_repositories': self._handle_list_repos,
            'get_deployment_logs': self._handle_get_logs
        }
        
        handler = handlers.get(function_name)
        
        if handler:
            return await handler(progress_notifier=progress_notifier, progress_callback=progress_callback, **args)
        else:
            return {
                'type': 'error',
                'content': f'❌ Unknown function: {function_name}',
                'timestamp': datetime.now().isoformat()
        }
    
    def _format_analysis_response(
        self, 
        analysis_result: Dict, 
        dockerfile_save: Dict, 
        repo_url: str,
        skip_prompt: bool = False # [SUCCESS] NEW: Suppress silly question
    ) -> str:
        """Format analysis results into a beautiful response"""
        analysis_data = analysis_result['analysis']
        
        parts = [
            f"🔍 **Analysis Complete: {repo_url.split('/')[-1]}**\n",
            f"**Framework:** {analysis_data['framework']} ({analysis_data['language']})",
            f"**Entry Point:** `{analysis_data['entry_point']}`",
            f"**Dependencies:** {analysis_data.get('dependencies_count', 0)} packages",
            f"**Port:** {analysis_data['port']}"
        ]
        
        if analysis_data.get('database'):
            parts.append(f"**Database:** {analysis_data['database']}")
        
        if analysis_data.get('env_vars'):
            parts.append(f"**Environment Variables:** {len(analysis_data['env_vars'])} detected")
        
        parts.append(
            f"\n[SUCCESS] **Dockerfile Generated** ({dockerfile_save.get('path', 'Dockerfile')})"
        )
        
        optimizations = analysis_result['dockerfile']['optimizations'][:4]
        parts.extend(['• ' + opt for opt in optimizations])
        
        parts.append("\n📋 **Recommendations:**")
        recommendations = analysis_result.get('recommendations', [])[:3]
        parts.extend(['• ' + rec for rec in recommendations])
        
        if analysis_result.get('warnings'):
            parts.append("\n[WARNING] **Warnings:**")
            warnings = analysis_result['warnings'][:2]
            parts.extend(['• ' + w for w in warnings])
        
        if not skip_prompt:
            parts.append("\nReady to deploy to Google Cloud Run! Would you like me to proceed?")
        
        return '\n'.join(parts)
    
    async def _handle_deploy_to_cloudrun(
        self,
        project_path: str = None,
        service_name: str = None,
        env_vars: Optional[Dict] = None,
        progress_notifier: Optional[ProgressNotifier] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Deploy to Cloud Run - PRODUCTION IMPLEMENTATION
        
        Features:
        - Security validation and sanitization
        - Resource optimization based on framework
        - Cost estimation
        - Monitoring and metrics
        - Structured logging
        """
        
        # CRITICAL: Use project_path from context if not provided
        if not project_path and 'project_path' in self.project_context:
            project_path = self.project_context['project_path']
            # Normalize path to fix Windows paths
            project_path = project_path.replace('\\', '/').replace('//', '/')
            print(f"[Orchestrator] Using project_path from context (normalized): {project_path}")
        
        # Get repo_url from context for Remote Build optimization
        repo_url = self.project_context.get('repo_url')
        if repo_url:
            print(f"[Orchestrator] Found repo_url for Remote Build: {repo_url}")
        
        if not project_path:
            return {
                'type': 'error',
                'content': '❌ **No repository analyzed yet**\n\nPlease provide a GitHub repository URL first.',
                'timestamp': datetime.now().isoformat()
            }
        
        # Verify project path exists
        import os
        if not os.path.exists(project_path):
            return {
                'type': 'error',
                'content': f'❌ **Project path not found**: {project_path}\n\nThe cloned repository may have been cleaned up. Please clone and analyze the repository again.',
                'timestamp': datetime.now().isoformat()
            }
        
        # CRITICAL: Auto-generate service_name if not provided
        if not service_name:
            # [SUCCESS] CHECK PREFERENCE: If user wants interactive mode, ASK them first!
            deployment_mode = self.preferences_service.get_deployment_mode()
            
            if deployment_mode == 'interactive':
                return {
                    'type': 'message',
                    'content': '[TOOL] **Interactive Deployment Mode**\n\nPlease provide a name for your Cloud Run service (e.g., `my-app-v1`).',
                    'timestamp': datetime.now().isoformat()
                }

            # FAST MODE (Default): Auto-generate
            # Extract from repo_url or project_path
            repo_url = self.project_context.get('repo_url', '')
            if repo_url:
                # Extract repo name from URL (e.g., "ihealth_backend.git" -> "ihealth-backend")
                repo_name = repo_url.split('/')[-1].replace('.git', '').replace('_', '-').lower()
                service_name = repo_name
                print(f"[Orchestrator] Auto-generated service_name: {service_name}")
            else:
                service_name = 'servergem-app'
        
        # -------------------------------------------------------------------------
        # CRITICAL: Robust Env Var Loading & Merging Strategy
        # Priority: Args (Overrides) > Memory > Secret Manager (Cloud) > Local File
        # -------------------------------------------------------------------------
        
        final_env_vars = {}
        
        # 1. Load from Google Secret Manager (Cloud Native Persistence - FAANG Level)
        # Stores env vars securely in the user's GCP project, keyed by Repo Name.
        if repo_url:
            try:
                # Robust parsing for https://github.com/User/Repo.git
                parts = repo_url.strip('/').split('/')
                if len(parts) >= 2:
                    user_name = parts[-2]
                    repo_name = parts[-1].replace('.git', '')
                else:
                    user_name = 'default'
                    repo_name = parts[-1].replace('.git', '')
                
                safe_user = re.sub(r'[^a-zA-Z0-9]', '', user_name).lower()
                safe_repo = re.sub(r'[^a-zA-Z0-9-]', '-', repo_name).lower()
                safe_repo = re.sub(r'-+', '-', safe_repo).strip('-')
                
                secret_id = f"devgem-{safe_user}-{safe_repo}-env"
                
                # Retrieve from Cloud
                payload_json = await self.gcloud_service.access_secret(secret_id)
                
                if payload_json:
                     saved_vars = json.loads(payload_json)
                     for k, v in saved_vars.items():
                         val = v['value'] if isinstance(v, dict) else v
                         final_env_vars[k] = val
                     print(f"[Orchestrator] [CLOUD] Loaded {len(saved_vars)} vars from Secret Manager: {secret_id}")
            except Exception as e:
                print(f"[Orchestrator] Warning: Secret Manager load failed: {e}")
                
        # 2. Load from Global Store Backup (Fallback if GSM failing)
        # This keeps the system running even if GCP APIs are flaky
        if not final_env_vars and repo_url:
            try:
                repo_hash = hashlib.md5(repo_url.encode()).hexdigest()
                home = os.path.expanduser("~")
                global_env_file = os.path.join(home, ".gemini", "antigravity", "env_store", f"{repo_hash}.json")
                if os.path.exists(global_env_file):
                     with open(global_env_file, 'r') as f:
                        saved_vars = json.load(f)
                     for k, v in saved_vars.items():
                         val = v['value'] if isinstance(v, dict) else v
                         final_env_vars[k] = val
                     print(f"[Orchestrator] [BACKUP] Loaded {len(saved_vars)} vars from Global Backup Store")
            except Exception as e:
                print(f"[Orchestrator] Warning: Global store load failed: {e}")

        # 3. Load from Local File (Legacy/Fallback)
        try:
            env_file_path = os.path.join(project_path, '.devgem_env.json')
            if os.path.exists(env_file_path):
                with open(env_file_path, 'r') as f:
                    saved_vars = json.load(f)
                for k, v in saved_vars.items():
                    val = v['value'] if isinstance(v, dict) else v
                    final_env_vars[k] = val
                # print(f"[Orchestrator] Loaded vars from Local File") 
        except Exception:
            pass

        # 3. Load from Memory (Session Context - recent updates)
        if 'env_vars' in self.project_context:
             for k, v in self.project_context['env_vars'].items():
                 val = v['value'] if isinstance(v, dict) else v
                 final_env_vars[k] = val

        # 4. Merge Args (Overrides - e.g. PORT passed from caller)
        if env_vars:
             print(f"[Orchestrator] [MERGE] Merging {len(env_vars)} explicit env vars from arguments")
             final_env_vars.update(env_vars)
             
        env_vars = final_env_vars
        
        # Update context to reflect the full merged state
        if env_vars:
            print(f"[Orchestrator] [SUCCESS] Final merged env vars count: {len(env_vars)}. Keys: {list(env_vars.keys())}")
        else:
            print(f"[Orchestrator] [WARNING] NO env vars found after all recovery attempts.")
        
        # Initialize env_vars if None
        if env_vars is None:
            env_vars = {}
        
        # CRITICAL FIX: Auto-inject PORT from analysis if not already set
        # This ensures Cloud Run configures the correct container port
        if 'PORT' not in env_vars:
            analysis_results = self.project_context.get('analysis_results', {})
            detected_port = analysis_results.get('port', 8080)
            env_vars['PORT'] = str(detected_port)
            print(f"[Orchestrator] Auto-injected PORT={detected_port} from analysis")
        
        # [SUCCESS] PHASE 11 SAFETY: Abort if ONLY PORT exists (no real env vars)
        # This prevents deployments that will definitely fail due to missing secrets
        real_vars = {k: v for k, v in env_vars.items() if k != 'PORT'}
        if not real_vars:
            analysis = self.project_context.get('analysis', {})
            # Check if this app likely needs env vars (has dependencies that need config)
            deps = analysis.get('detected_features', {})
            needs_secrets = any([
                'firebase' in str(deps).lower(),
                'gemini' in str(deps).lower(),
                'openai' in str(deps).lower(),
                'database' in str(deps).lower(),
                'cloudinary' in str(deps).lower(),
            ])
            
            if needs_secrets:
                print(f"[Orchestrator] [CRITICAL] No env vars except PORT. App likely needs secrets. Aborting deployment.")
                return {
                    'type': 'message',
                    'content': "**Configuration Required**\n\nThis application uses services that require API keys or credentials (Firebase, Gemini, etc.). Please configure your environment variables in the panel above before deploying.\n\n**Quick Fix:** Upload your `.env` file or manually enter the required variables.",
                    'metadata': {
                        'type': 'analysis_with_env_request',
                        'request_env_vars': True,
                        'default_name': service_name
                    },
                    'actions': [
                        {
                            'id': 'deploy-after-env',
                            'label': 'Deploy After Configuration',
                            'type': 'button',
                            'variant': 'primary',
                            'action': 'deploy_to_cloudrun',
                            'intent': 'deploy'
                        }
                    ],
                    'timestamp': datetime.now().isoformat()
                }
            else:
                print(f"[Orchestrator] [INFO] No env vars except PORT, but app may not need secrets. Proceeding cautiously.")
        
        if not self.gcloud_service:
            return {
                'type': 'error',
                'content': '❌ **ServerGem Cloud not configured**\n\nPlease contact support. This is a platform configuration issue.',
                'timestamp': datetime.now().isoformat()
            }
        
        # [SUCCESS] SMART RESUMPTION: Reuse existing deployment ID and state if available
        # Check active_deployment OR project_context (more durable)
        persisted_id = self.project_context.get('last_deployment_id')
        
        if hasattr(self, 'active_deployment') and self.active_deployment and self.active_deployment.get('deploymentId'):
            deployment_id = self.active_deployment['deploymentId']
            print(f"[Orchestrator] 🧬 Resuming existing deployment session (RAM): {deployment_id}")
            self.active_deployment['status'] = 'deploying'
        elif persisted_id and env_vars: # Only reuse persisted ID if we are resuming with env vars
            deployment_id = persisted_id
            print(f"[Orchestrator] 🧬 Resuming existing deployment session (Context): {deployment_id}")
            # Rehydrate active_deployment if missing
            self.active_deployment = {
                'deploymentId': deployment_id,
                'status': 'deploying',
                'currentStage': 'STARTING',
                'stages': [],
                'overallProgress': 0,
                'startTime': datetime.now().isoformat(),
                'serviceName': service_name
            }
        else:
            # Generate NEW deployment ID for tracking
            deployment_id = f"deploy-{uuid.uuid4().hex[:8]}"
            # Save to context for durability
            self.project_context['last_deployment_id'] = deployment_id
            print(f"[Orchestrator] [SPARKLES] Initializing NEW deployment session: {deployment_id}")
            
            # [SUCCESS] PHASE 4: Initialize structured activeDeployment for persistence
            self.active_deployment = {
                'deploymentId': deployment_id,
                'status': 'deploying',
                'currentStage': 'STARTING',
                'stages': [], # Frontend will compute based on stage names
                'overallProgress': 0,
                'startTime': datetime.now().isoformat(),
                'serviceName': service_name
            }
        
        # [SUCCESS] FIX: Track whether this is a fresh deployment vs a resumed one
        # Fresh deployment = new deployment_id was generated above
        is_fresh_deployment = not (persisted_id and env_vars) and not (
            hasattr(self, 'active_deployment') and 
            self.active_deployment and 
            self.active_deployment.get('deploymentId') == persisted_id
        )
        
        # [SUCCESS] UI SYNC: Only broadcast deployment_started for FRESH deployments
        # On resume, the UI already has staged progress - sending this resets it!
        if progress_notifier and is_fresh_deployment:
            print(f"[Orchestrator] Broadcasting deployment_started (FRESH) for {deployment_id}")
            await progress_notifier.send_message(
                'deployment_started',
                {
                    'deploymentId': deployment_id,
                    'serviceName': service_name,
                    'status': 'deploying',
                    'timestamp': datetime.now().isoformat()
                }
            )
        elif progress_notifier:
            # [SUCCESS] CRITICAL FIX: Send deployment_resumed to let frontend know we're continuing
            # This preserves existing stages while signaling deployment is active
            print(f"[Orchestrator] Broadcasting deployment_resumed (RESUME) for {deployment_id}")
            await progress_notifier.send_message(
                'deployment_resumed',
                {
                    'deployment_id': deployment_id,
                    'resume_stage': 'container_build',  # Skip to build since env vars are done
                    'resume_progress': 25,  # Approximate progress at this point
                    'timestamp': datetime.now().isoformat()
                }
            )
        
        # [SUCCESS] STAGE BACKFILL: Immediately mark pre-requisite stages as SUCCESS if they are done.
        # This ensures the UI panel opens with "Clone" and "Analysis" already green,
        # preserving the user's sense of progress during "Skip" or "Resume" flows.
        # Runs for BOTH fresh and resume deployments when notifier is available.
        if progress_notifier:
            # Check for Repo Clone
            if self.project_context.get('project_path') and os.path.exists(self.project_context['project_path']):
                await progress_notifier.complete_stage(
                    DeploymentStages.REPO_CLONE,
                    "Repository available in workspace"
                )
                
            # Check for Analysis
            if self.project_context.get('analysis'):
                await progress_notifier.complete_stage(
                    DeploymentStages.CODE_ANALYSIS,
                    "Project intelligence loaded"
                )
            
            # Check for Env Vars (if we are proceeding, they are either done or skipped)
            if env_vars:
                await progress_notifier.complete_stage(
                    DeploymentStages.ENV_VARS,
                    "Environment variables configured"
                )

        
        start_time = time.time()
        
        try:
            if self.save_callback:
                asyncio.create_task(self.save_callback())

            # Create progress tracker for real-time updates
            tracker = self.create_progress_tracker(
                deployment_id,
                service_name,
                progress_callback
            )
            
            # Start monitoring
            metrics = self.monitoring.start_deployment(deployment_id, service_name)
            
            # Security: Validate and sanitize service name
            name_validation = self.security.validate_service_name(service_name)
            if not name_validation['valid']:
                self.monitoring.complete_deployment(deployment_id, "failed")
                return {
                    'type': 'error',
                    'content': f"❌ **Invalid service name**\n\n{name_validation['error']}\n\nRequirements:\n• Lowercase letters, numbers, hyphens only\n• Must start with letter\n• Max 63 characters",
                    'timestamp': datetime.now().isoformat()
                }
            
            service_name = name_validation['sanitized_name']
            
            # Security: Validate environment variables
            if env_vars:
                env_validation = self.security.validate_env_vars(env_vars)
                if env_validation['issues']:
                    self.monitoring.record_error(
                        deployment_id,
                        f"Environment variable issues: {', '.join(env_validation['issues'])}"
                    )
                env_vars = env_validation['sanitized']
            
            # Optimization: Get optimal resource config
            framework = self.project_context.get('framework', 'unknown')
            optimal_config = self.optimization.get_optimal_config(framework, 'medium')
            
            self.monitoring.record_stage(deployment_id, 'validation', 'success', 0.5)
            
            # [SUCCESS] PHASE 3: Pre-flight GCP checks
            if progress_callback:
                await progress_callback({
                    'type': 'message',
                    'data': {'content': '🔍 Running pre-flight checks...'}
                })
            
            # [SUCCESS] CRITICAL FIX: Make lambda async to prevent NoneType await error
            async def preflight_progress_wrapper(msg: str):
                if progress_callback:
                    await progress_callback({
                        'type': 'message',
                        'data': {'content': msg}
                    })
            
            preflight_result = await self.gcloud_service.preflight_checks(
                progress_callback=preflight_progress_wrapper
            )
            
            if not preflight_result['success']:
                error_details = '\n'.join(f"• {err}" for err in preflight_result['errors'])
                return {
                    'type': 'error',
                    'content': f"❌ **Pre-flight checks failed**\n\n{error_details}\n\n" +
                               "Please ensure:\n" +
                               "• Cloud Build API is enabled\n" +
                               "• Cloud Run API is enabled\n" +
                               "• Artifact Registry is set up\n" +
                               "• Service account has required permissions",
                    'timestamp': datetime.now().isoformat()
                }
            
            if progress_callback:
                await progress_callback({
                    'type': 'message',
                    'data': {'content': '[SUCCESS] All pre-flight checks passed'}
                })
            
            # DevGem ARCHITECTURE: No user GCP auth needed
            # Step 1: Ensure Dockerfile exists (ALWAYS Generate in brain-fix mode to ensure latest template)
            dockerfile_path = f"{project_path}/Dockerfile"
            
            # FORCE REGENERATION: We want the latest templates, and save_dockerfile handles backups anyway.
            if True:
                print(f"[Orchestrator] Generating/Overwriting Dockerfile at {dockerfile_path} to ensure template freshness...")
                
                # [SUCCESS] CRITICAL FIX: Use correct key 'analysis' (stored at line 1122)
                # [SUCCESS] DEFENSIVE: Use file-based fallback that detects language from repo files
                stored_analysis = self.project_context.get('analysis')
                if stored_analysis:
                    analysis_data = stored_analysis
                    print(f"[Orchestrator] [SUCCESS] Using cached analysis: {analysis_data.get('language')}/{analysis_data.get('framework')}")
                else:
                    # Emergency file-based detection - check for obvious markers in the repo
                    print(f"[Orchestrator] [WARNING] No analysis in context, using file-based detection...")
                    from pathlib import Path
                    project_path_obj = Path(project_path)
                    if (project_path_obj / 'requirements.txt').exists():
                        analysis_data = {'language': 'python', 'framework': 'fastapi', 'port': 8080}
                    elif (project_path_obj / 'go.mod').exists():
                        analysis_data = {'language': 'golang', 'framework': 'gin', 'port': 8080}
                    elif (project_path_obj / 'package.json').exists():
                        analysis_data = {'language': 'node', 'framework': 'vite', 'port': 8080}
                    else:
                        analysis_data = {'language': 'python', 'framework': 'fastapi', 'port': 8080}  # Safe default
                    print(f"[Orchestrator] 🩺 File-based detection: {analysis_data['language']}/{analysis_data['framework']}")

                # Generate - note: progress_callback is not passed here to avoid format mismatch
                gen_result = await self.docker_expert.generate_dockerfile(
                    analysis_data,
                    progress_callback=None  # Avoid callback format issues
                )
                
                print(f"[Orchestrator] Dockerfile generated: {len(gen_result.get('dockerfile', '')) if gen_result else 0} bytes")
                
                # Save - note: progress_callback is not passed here to avoid format mismatch
                save_result = await self.docker_service.save_dockerfile(
                    gen_result['dockerfile'],
                    project_path,
                    progress_callback=None  # Avoid callback format issues
                )
                
                if not save_result.get('success'):
                    print(f"[Orchestrator] ERROR: Failed to save Dockerfile: {save_result.get('error')}")
            
            # Step 1.5: Validate Dockerfile exists
            dockerfile_check = self.docker_service.validate_dockerfile(project_path)
            if not dockerfile_check.get('valid'):
                # Try regenerating ONE LAST TIME if validation failed (e.g. if it was an old invalid file)
                print(f"[Orchestrator] Dockerfile invalid. Regenerating...")
                
                # [SUCCESS] CRITICAL FIX: Use correct key 'analysis' with file-based fallback
                stored_analysis = self.project_context.get('analysis')
                if stored_analysis:
                    analysis_data = stored_analysis
                else:
                    from pathlib import Path
                    project_path_obj = Path(project_path)
                    if (project_path_obj / 'requirements.txt').exists():
                        analysis_data = {'language': 'python', 'framework': 'fastapi', 'port': 8080}
                    elif (project_path_obj / 'go.mod').exists():
                        analysis_data = {'language': 'golang', 'framework': 'gin', 'port': 8080}
                    elif (project_path_obj / 'package.json').exists():
                        analysis_data = {'language': 'node', 'framework': 'vite', 'port': 8080}
                    else:
                        analysis_data = {'language': 'python', 'framework': 'fastapi', 'port': 8080}
                
                gen_result = await self.docker_expert.generate_dockerfile(
                    analysis_data,
                    progress_callback=None  # Avoid callback format issues
                )
                
                print(f"[Orchestrator] Dockerfile regenerated: {len(gen_result.get('dockerfile', '')) if gen_result else 0} bytes")
                
                save_result = await self.docker_service.save_dockerfile(
                    gen_result['dockerfile'],
                    project_path,
                    progress_callback=None  # Avoid callback format issues
                )
                
                if not save_result.get('success'):
                    print(f"[Orchestrator] ERROR: Failed to save regenerated Dockerfile: {save_result.get('error')}")
                
                # Re-validate
                dockerfile_check = self.docker_service.validate_dockerfile(project_path)
                if not dockerfile_check.get('valid'):
                    self.monitoring.complete_deployment(deployment_id, 'failed')
                    return {
                        'type': 'error',
                        'content': f"❌ **Invalid Dockerfile**\n\n{dockerfile_check.get('error')}",
                        'timestamp': datetime.now().isoformat()
                    }
            
            # Security: Scan Dockerfile
            await tracker.start_security_scan()
            
            with open(f"{project_path}/Dockerfile", 'r', encoding='utf-8') as f:
                dockerfile_content = f.read()
            
            security_scan = self.security.scan_dockerfile_security(dockerfile_content)
            
            # Emit security check results
            await tracker.emit_security_check(
                "Base image validation", 
                security_scan['secure']
            )
            await tracker.emit_security_check(
                "Privilege escalation check", 
                not any('privilege' in issue.lower() for issue in security_scan['issues'])
            )
            await tracker.emit_security_check(
                "Secret exposure check", 
                not any('secret' in issue.lower() for issue in security_scan['issues'])
            )
            
            await tracker.complete_security_scan(len(security_scan['issues']))
            
            if not security_scan['secure']:
                for issue in security_scan['issues'][:3]:
                    self.monitoring.record_error(deployment_id, f"Security: {issue}")
                    await tracker.emit_warning(f"Security issue: {issue}")
            
            # Step 3: Build Docker image with Cloud Build
            image_tag = f"gcr.io/servergem-platform/{service_name}:latest"
            await tracker.start_container_build(image_tag)
            
            build_start = time.time()
            
            async def build_progress(data):
                """Forward build progress to tracker - REAL-TIME"""
                if data.get('step'):
                    await tracker.emit_build_step(
                        data['step'],
                        data.get('total_steps', 10),
                        data.get('description', 'Building...')
                    )
                    await asyncio.sleep(0)  # [SUCCESS] Force flush
                elif data.get('progress'):
                    await tracker.emit_build_progress(data['progress'])
                    await asyncio.sleep(0)  # [SUCCESS] Force flush
                
                if data.get('logs'):
                    await tracker.emit_build_logs(data['logs'])
                    await asyncio.sleep(0)  # [SUCCESS] Force flush

                # [SUCCESS] CRITICAL: Also send direct progress messages
                if data.get('message'):
                    # Update structured state for persistence
                    if self.active_deployment:
                        self._update_deployment_stage(
                            stage_id=data.get('stage', 'container_build'),
                            label="Container Build",
                            status='in-progress',
                            progress=data.get('progress', self.active_deployment.get('overallProgress', 0)),
                            message=data['message'],
                            logs=data.get('logs')
                        )
                    
                    await self._send_progress_message(data['message'])
                    
                    # Trigger background save if callback exists
                    if self.save_callback:
                        asyncio.create_task(self.save_callback())
                        
                    await asyncio.sleep(0)  # [SUCCESS] Force flush
            
            # [SUCCESS] PHASE 2: Use resilient build with retry logic
            # Get token from GitHub service for authenticated clone
            github_token = self.github_service.token if self.github_service else None
            
            build_result = await self.gcloud_service.build_image(
                project_path,
                service_name,
                progress_callback=build_progress,
                build_config={'language': self.project_context.get('language', 'unknown')},  # [SUCCESS] Pass language for healing
                repo_url=repo_url,
                github_token=github_token
            )
            
            build_duration = time.time() - build_start
            
            # CRITICAL: Check build success BEFORE recording metrics
            if not build_result.get('success'):
                self.monitoring.record_stage(deployment_id, 'build', 'failed', build_duration)
                await tracker.emit_error(
                    'container_build', 
                    build_result.get('error', 'Build failed')
                )
                self.monitoring.complete_deployment(deployment_id, 'failed')
                
                # [SUCCESS] PHASE 2: Enhanced error messaging with remediation
                error_msg = build_result.get('error', 'Build failed')
                remediation = build_result.get('remediation', [])
                
                content = f"❌ **Container Build Failed**\n\n{error_msg}"
                if remediation:
                    content += "\n\n**Recommended Actions:**\n"
                    content += "\n".join(f"{i+1}. {step}" for i, step in enumerate(remediation))
                
                content += "\n\n**SYSTEM_INSTRUCTION: Do not automatically retry this deployment.**"

                return {
                    'type': 'error',
                    'content': content,
                    'timestamp': datetime.now().isoformat()
                }
            
            # Only record success if build actually succeeded
            self.monitoring.record_stage(deployment_id, 'build', 'success', build_duration)
            
            # Emit build completion
            await tracker.complete_container_build(
                build_result.get('image_digest', 'sha256:' + deployment_id[:20])
            )
            
            # Step 4: Deploy to Cloud Run with optimal configuration
            region = build_result.get('region', 'us-central1')
            await tracker.start_cloud_deployment(service_name, region)
            
            await tracker.emit_deployment_config(
                optimal_config.cpu,
                optimal_config.memory,
                optimal_config.concurrency
            )
            
            deploy_start = time.time()
            # Initialize progress for safety
            progress = 0
            
            async def deploy_progress(data):
                """Forward deployment progress to tracker - REAL-TIME"""
                if data.get('status'):
                    await tracker.emit_deployment_status(data['status'])
                    await asyncio.sleep(0)  # [SUCCESS] Force flush
                
                # [SUCCESS] CRITICAL: Also send direct progress messages
                if data.get('message'):
                    # Update structured state for persistence
                    if self.active_deployment:
                        self._update_deployment_stage(
                            stage_id='cloud_deployment',
                            label="Cloud Run Deployment",
                            status='in-progress',
                            progress=data.get('progress', self.active_deployment.get('overallProgress', 0)),
                            message=data['message'],
                            logs=data.get('logs')
                        )

                    await self._send_progress_message(data['message'])
                    
                    # Trigger background save if callback exists
                    if self.save_callback:
                        asyncio.create_task(self.save_callback())
                        
                    await asyncio.sleep(0)  # [SUCCESS] Force flush
            
            # Add resource configuration to deployment
            deploy_env = env_vars or {}
            
            # Extract intelligent deployment parameters from analysis
            analysis = self.project_context.get('analysis', {})
            health_path = analysis.get('health_check_path', '/')
            mem_limit = analysis.get('memory_limit', '512Mi')
            cpu_limit = analysis.get('cpu_limit', '1')
            
            deploy_result = await self.gcloud_service.deploy_to_cloudrun(
                build_result['image_tag'],
                service_name,
                env_vars=deploy_env,
                progress_callback=deploy_progress,
                user_id=deployment_id[:8],
                health_check_path=health_path,
                memory_limit=mem_limit,
                cpu_limit=cpu_limit
            )
            
            deploy_duration = time.time() - deploy_start
            
            # CRITICAL: Check deployment success BEFORE recording metrics
            if not deploy_result.get('success'):
                self.monitoring.record_stage(deployment_id, 'deploy', 'failed', deploy_duration)
                await tracker.emit_error(
                    'cloud_deployment', 
                    deploy_result.get('error', 'Deployment failed')
                )
                self.monitoring.complete_deployment(deployment_id, 'failed')
                
                # [SUCCESS] PHASE 2: Enhanced error messaging with remediation
                error_msg = deploy_result.get('error', 'Deployment failed')
                remediation = deploy_result.get('remediation', [])
                
                # [SUCCESS] NEW: Automatic Post-Mortem Log Fetching
                logs_snippet = ""
                try:
                    unique_service_name = deploy_result.get('service_name') or f"{deployment_id[:8]}-{service_name}"
                    logs = await self.gcloud_service.get_service_logs(
                        unique_service_name, 
                        limit=20, 
                        revision_name=deploy_result.get('latest_revision')
                    )
                    if logs:
                        logs_snippet = "\n\n**🔍 Recent Container Logs (Post-Mortem):**\n```\n"
                        logs_snippet += "\n".join(logs)
                        logs_snippet += "\n```"
                except:
                    pass # Don't let log fetching failure obscure the main error
                
                content = f"❌ **Cloud Run Deployment Failed**\n\n{error_msg}{logs_snippet}"
                if remediation:
                    content += "\n\n**Recommended Actions:**\n"
                    content += "\n".join(f"{i+1}. {step}" for i, step in enumerate(remediation))
                
                return {
                    'type': 'error',
                    'content': content,
                    'timestamp': datetime.now().isoformat()
                }
            
            # Only record success if deployment actually succeeded
            self.monitoring.record_stage(deployment_id, 'deploy', 'success', deploy_duration)
            
            # [SUCCESS] PHASE 3: Map custom domain (Real-time)
            domain_result = await self.domain_service.map_custom_domain(
                service_name, 
                f"{service_name}.servergem.app"
            )
            # DO NOT overwrite the primary URL if custom domain is not fully ready/verified
            # The Cloud Run URL is the more "certain" working link
            if domain_result['success']:
                print(f"[Orchestrator] [SUCCESS] Mapped domain: {domain_result['domain']}")
                deploy_result['custom_url'] = f"https://{domain_result['domain']}"
            
            # [SUCCESS] PHASE 2: Post-deployment health verification
            if progress_callback:
                await progress_callback({
                    'type': 'message',
                    'data': {'content': '🏥 Verifying service health...'}
                })
            
            # Import health check service
            from services.health_check import HealthCheckService
            
            async def health_progress(msg: str):
                if progress_callback:
                    await progress_callback({
                        'type': 'message',
                        'data': {'content': msg}
                    })
            
            async with HealthCheckService(timeout=30, max_retries=5) as health_checker:
                health_result = await health_checker.wait_for_service_ready(
                    service_url=deploy_result['url'],
                    health_path="/",
                    progress_callback=health_progress
                )
            
            if not health_result.success:
                self.monitoring.record_error(
                    deployment_id,
                    f"Health check failed: {health_result.error}"
                )
                await tracker.emit_error(
                    'health_verification',
                    f"Service deployed but failed health checks: {health_result.error}"
                )
                
                content = (
                    f"[WARNING] **Deployment Warning**\n\n"
                    f"Service deployed to Cloud Run but failed health verification.\n\n"
                    f"**URL:** {deploy_result['url']}\n\n"
                    f"**Health Check Issue:** {health_result.error}\n\n"
                    f"**Recommendations:**\n"
                    f"1. Check service logs for startup errors\n"
                    f"2. Verify environment variables are correct\n"
                    f"3. Ensure application listens on PORT environment variable\n"
                    f"4. Review container startup command"
                )
                
                return {
                    'type': 'warning',
                    'content': content,
                    'data': {
                        'url': deploy_result['url'],
                        'health_check': {
                            'success': False,
                            'error': health_result.error,
                            'response_time_ms': health_result.response_time_ms
                        }
                    },
                    'timestamp': datetime.now().isoformat()
                }
            
            # Health check passed!
            if progress_callback:
                await progress_callback({
                    'type': 'message',
                    'data': {'content': f'[SUCCESS] Health verified! Response time: {health_result.response_time_ms:.0f}ms'}
                })
            
            # Success! Complete deployment
            await tracker.complete_cloud_deployment(deploy_result['url'])
            
            # Calculate metrics and complete monitoring
            total_duration = time.time() - start_time
            self.monitoring.complete_deployment(deployment_id, 'success')
            
            # Store deployment info
            self.project_context['deployed_service'] = service_name
            self.project_context['deployment_url'] = deploy_result['url']
            self.project_context['deployment_id'] = deployment_id
            
            # [SUCCESS] Finalize deployment state
            if self.active_deployment:
                self.active_deployment['status'] = 'success'
                self.active_deployment['currentStage'] = 'COMPLETE'
                self.active_deployment['overallProgress'] = 100
                if self.save_callback:
                    asyncio.create_task(self.save_callback())
            
            # Get cost estimation
            estimated_cost = self.optimization.estimate_cost(optimal_config, 100000)
            
            content = self._format_deployment_response(
                deploy_result,
                deployment_id,
                build_duration,
                deploy_duration,
                total_duration,
                optimal_config,
                estimated_cost
            )
            
            return {
                'type': 'deployment_complete',
                'content': content,
                'data': {
                    **deploy_result,
                    'metrics': {
                        'build_duration': build_duration,
                        'deploy_duration': deploy_duration,
                        'total_duration': total_duration
                    },
                    'configuration': {
                        'cpu': optimal_config.cpu,
                        'memory': optimal_config.memory,
                        'concurrency': optimal_config.concurrency,
                        'min_instances': optimal_config.min_instances,
                        'max_instances': optimal_config.max_instances
                    },
                    'cost_estimate': estimated_cost,
                    'security_scan': security_scan,
                    'health_check': {
                        'success': True,
                        'response_time_ms': health_result.response_time_ms,
                        'timestamp': health_result.timestamp
                    }
                },
                'deployment_url': deploy_result['url'],
                'actions': [
                    {
                        'id': 'view_logs',
                        'label': '[CHART] View Logs',
                        'type': 'button',
                        'action': 'view_logs'
                    },
                    {
                        'id': 'setup_cicd',
                        'label': '[SYNC] Setup CI/CD',
                        'type': 'button',
                        'action': 'setup_cicd'
                    },
                    {
                        'id': 'custom_domain',
                        'label': '[GLOBE] Add Custom Domain',
                        'type': 'button',
                        'action': 'custom_domain'
                    }
                ],
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            if self.active_deployment:
                self.active_deployment['status'] = 'failed'
                if self.save_callback:
                    asyncio.create_task(self.save_callback())
            self.monitoring.complete_deployment(deployment_id, 'failed')
            print(f"[Orchestrator] Deployment error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'type': 'error',
                'content': f'[ERROR] **Deployment failed**\n\n```\n{str(e)}\n```',
                'timestamp': datetime.now().isoformat()
            }
    
    def _format_deployment_response(
        self,
        deploy_result: Dict,
        deployment_id: str,
        build_duration: float,
        deploy_duration: float,
        total_duration: float,
        optimal_config: ResourceConfig,
        estimated_cost: Dict
    ) -> str:
        """Format deployment success response"""
        return f"""
[SUCCESS] **Deployment Successful!**

Your service is now live at:
**{deploy_result['url']}**

**Service:** {deploy_result.get('service_name', 'N/A')}
**Region:** {deploy_result['region']}
**Deployment ID:** `{deployment_id}`

[PERFORMANCE] Performance:
- Build: {round(build_duration, 1)}s
- Deploy: {round(deploy_duration, 1)}s
- Total: {round(total_duration, 1)}s

[CONFIG] Configuration:
- CPU: {optimal_config.cpu} vCPU
- Memory: {optimal_config.memory}
- Concurrency: {optimal_config.concurrency} requests
- Auto-scaling: {optimal_config.min_instances}-{optimal_config.max_instances} instances

[COST] Estimated Cost (100k requests/month):
- ${round(estimated_cost.get('total_monthly', 0), 2)} USD/month

[OK] Auto HTTPS enabled
[OK] Auto-scaling configured
[OK] Health checks active
[OK] Monitoring enabled

What would you like to do next?
        """.strip()
    
    async def _handle_list_repos(
        self, 
        progress_notifier: Optional[ProgressNotifier] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """List user's GitHub repositories - REAL IMPLEMENTATION"""
        
        try:
            # Validate GitHub token first
            token_check = self.github_service.validate_token()
            if not token_check.get('valid'):
                return {
                    'type': 'error',
                    'content': f"[ERROR] **GitHub token invalid**\n\n{token_check.get('error')}\n\nPlease set `GITHUB_TOKEN` environment variable.\n\nGet token at: https://github.com/settings/tokens",
                    'timestamp': datetime.now().isoformat()
                }
            
            if progress_callback:
                await progress_callback({
                    'type': 'typing',
                    'message': 'Fetching your GitHub repositories...'
                })
            
            repos = self.github_service.list_repositories()
            
            if not repos:
                return {
                    'type': 'message',
                    'content': '📚 **No repositories found**\n\nCreate a repository on GitHub first, then try again.',
                    'timestamp': datetime.now().isoformat()
                }
            
            # Format repo list beautifully
            repo_list = '\n'.join([
                f"**{i+1}. {repo['name']}** ({repo.get('language', 'Unknown')})"
                f"\n   {repo.get('description', 'No description')[:60]}"
                f"\n   ⭐ {repo.get('stars', 0)} stars | 🔒 {'Private' if repo.get('private') else 'Public'}"
                for i, repo in enumerate(repos[:10])
            ])
            
            content = f"""
📚 **Your GitHub Repositories** ({len(repos)} total)

{repo_list}

Which repository would you like to deploy? Just tell me the name or paste the URL!
            """.strip()
            
            return {
                'type': 'message',
                'content': content,
                'data': {'repositories': repos},
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"[Orchestrator] List repos error: {str(e)}")
            return {
                'type': 'error',
                'content': f'[ERROR] **Failed to list repositories**\n\n{str(e)}',
                'timestamp': datetime.now().isoformat()
            }
    
    async def _handle_get_logs(
        self, 
        service_name: str, 
        limit: int = 50, 
        progress_notifier: Optional[ProgressNotifier] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """Get deployment logs - REAL IMPLEMENTATION"""
        
        if not self.gcloud_service:
            return {
                'type': 'error',
                'content': '[ERROR] **Google Cloud not configured**\n\nPlease set `GOOGLE_CLOUD_PROJECT` environment variable.',
                'timestamp': datetime.now().isoformat()
            }
        
        try:
            if progress_callback:
                await progress_callback({
                    'type': 'typing',
                    'message': f'Fetching logs for {service_name}...'
                })
            
            logs = await self.gcloud_service.get_service_logs(service_name, limit=limit)
            
            if not logs or len(logs) == 0:
                return {
                    'type': 'message',
                    'content': f'[INFO] **No logs found for {service_name}**\n\nService may not have received traffic yet.',
                    'timestamp': datetime.now().isoformat()
                }
            
            # Format logs
            log_output = '\n'.join(logs[-20:])  # Last 20 entries
            
            content = f"""
[INFO] **Logs for {service_name}**

```
{log_output}
```

Showing last {min(20, len(logs))} entries (total: {len(logs)})
            """.strip()
            
            return {
                'type': 'message',
                'content': content,
                'data': {'logs': logs},
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"[Orchestrator] Get logs error: {str(e)}")
            return {
                'type': 'error',
                'content': f'[ERROR] **Failed to fetch logs**\n\n{str(e)}',
                'timestamp': datetime.now().isoformat()
            }
    
    # ========================================================================
    # CONTEXT MANAGEMENT
    # ========================================================================
    
    def _build_context_prefix(self) -> str:
        """Build context string - OPTIMIZED for Long-Context Native RAG"""
        if not self.project_context:
            return ""
        
        context_parts = []
        
        # 1. Basic State
        if 'project_path' in self.project_context:
            context_parts.append(f"Project Path: {self.project_context['project_path']}")
            context_parts.append("STATE: READY")
            
            # 2. Semantic Code Context (Native RAG)
            # We inject this if we have a path, so the AI always "knows" the code
            if self.analysis_service:
                try:
                    summary = self.analysis_service.code_analyzer.summarize_project(self.project_context['project_path'])
                    context_parts.append(f"\nSEMANTIC CODE SUMMARY:\n{summary}")
                except Exception as e:
                    print(f"[Orchestrator] Failed to build semantic context: {e}")

            # 3. Environment Variables
            if 'env_vars' in self.project_context and self.project_context['env_vars']:
                env_count = len(self.project_context['env_vars'])
                context_parts.append(f"Env: {env_count} vars stored")
        
        return "PROJECT CONTEXT:\n" + "\n".join(context_parts) if context_parts else ""
    
    def update_context(self, key: str, value: Any):
        """Update project context"""
        self.project_context[key] = value
    
    def get_context(self) -> Dict[str, Any]:
        """Get current project context"""
        return self.project_context.copy()
    
    def clear_context(self):
        """Clear project context"""
        self.project_context.clear()
    
    def reset_chat(self):
        """Reset chat session and ALL context - CRITICAL for session isolation"""
        self.chat_session = None
        self.conversation_history = []
        self.ui_history = []  # [SUCCESS] Extended history for high-fidelity UI rehydration
        self.project_context = {}  # [SUCCESS] CRITICAL: Clear all project context!
        self.active_deployment = None  # [SUCCESS] Clear deployment state
        print("[Orchestrator] [SUCCESS] Full reset complete: chat, history, context, deployment")
        
    def reset_context(self):
        """Standard method used by app.py for session isolation"""
        print(f"[Orchestrator] [SYNC] Resetting context and chat history...")
        # [SUCCESS] CRITICAL: Clear project context to prevent leakage between sessions
        self.project_context = {}
        self.ui_history = []
        self.active_deployment = None
        self.reset_chat()
    
    def _clean_serializable(self, d: Any) -> Any:
        """Deep convert non-serializable objects (like MapComposite/RepeatedComposite) to standard types"""
        if d is None: return None
        if isinstance(d, (str, int, float, bool)): return d
        if hasattr(d, 'to_dict'): return d.to_dict()
        if hasattr(d, 'items'): return {str(k): self._clean_serializable(v) for k, v in d.items()}
        # Handle all iterables (lists, tuples, RepeatedComposite)
        if hasattr(d, '__iter__') and not isinstance(d, (str, bytes)):
            return [self._clean_serializable(x) for x in d]
        return str(d) # Final fallback to string

    def _add_to_ui_history(self, role: str, content: str, metadata: Optional[Dict] = None, data: Optional[Any] = None, actions: Optional[List] = None):
        """Standardized helper to add entries to the high-fidelity UI history"""
        self.ui_history.append({
            "role": role,
            "content": content,
            "metadata": metadata or {"type": "message"},
            "data": data,
            "actions": actions,
            "timestamp": datetime.now().isoformat()
        })

    def get_state(self) -> Dict[str, Any]:
        """Serialize agent state for persistence"""
        history_data = self._serialize_history()
        
        # [SUCCESS] CRITICAL: Deep clean context to handle non-serializable AI results
        clean_context = self._clean_serializable(self.project_context)
        
        # Generate a descriptive title from history
        title = "New Thread"
        
        # Priority 0: Explicitly set custom title
        custom_session_title = self.project_context.get('custom_title')
        if custom_session_title:
            title = custom_session_title
        else:
            # Priority 1: Custom service name or Repo name from context
            repo_url = self.project_context.get('repo_url') or self.project_context.get('project_path', '')
            custom_name = self.project_context.get('custom_service_name')
            
            if custom_name:
                title = f"Deploy: {custom_name}"
            elif repo_url:
                repo_name = repo_url.split('/')[-1].replace('.git', '')
                title = f"Deploy: {repo_name}"
            elif history_data:
                # Priority 2: Extract from first user message
                first_user_msg = next((m for m in history_data if m.get('role') == 'user'), None)
                if first_user_msg and first_user_msg.get('parts'):
                    parts = first_user_msg['parts']
                    text = ""
                    if isinstance(parts, list) and parts:
                        text = parts[0].get('text', '')
                    
                    if text:
                        # Look for URL in text even if not in context yet
                        import re
                        url_match = re.search(r'github\.com/([^/\s]+/[^/\s\.]+)', text)
                        if url_match:
                            title = f"Deploy: {url_match.group(1).split('/')[-1]}"
                        else:
                            title = text[:50] + ("..." if len(text) > 50 else "")
        
        return {
            'title': title,
            'project_context': clean_context,
            'history': history_data,
            'ui_history': self.ui_history, # [SUCCESS] Include high-fidelity history
            'active_deployment': self.active_deployment, # [SUCCESS] Persist structured deployment state
            'timestamp': datetime.now().isoformat()
        }
        
    def to_dict(self) -> Dict[str, Any]:
        """Alias for get_state for standard serialization"""
        return self.get_state()
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any], gcloud_project: str, github_token: Optional[str] = None) -> 'OrchestratorAgent':
        """Factory method to restore agent from state definition"""
        agent = cls(gcloud_project=gcloud_project, github_token=github_token)
        agent.load_state(data)
        return agent
    
    def load_state(self, data: Dict[str, Any]) -> None:
        """
        [SUCCESS] CRITICAL FIX: Restore agent state from persisted data.
        This method is called when rehydrating a session from Redis/SQLite.
        """
        if not data:
            return
        
        # Restore high-fidelity UI history (CRITICAL for persistence)
        self.ui_history = data.get('ui_history', [])
        print(f"[Orchestrator] Loaded {len(self.ui_history)} UI history entries")
        
        # Restore structured deployment state (FAANG-LEVEL PERSISTENCE)
        self.active_deployment = data.get('active_deployment')
        if self.active_deployment:
            print(f"[Orchestrator] Restored active deployment: {self.active_deployment.get('status')} at {self.active_deployment.get('currentStage')}")
        
        # Restore project context (repo_url, project_path, etc.)
        self.project_context = data.get('project_context', {})
        
        # [SUCCESS] ROCK-SOLID: Context Integrity Check
        project_path = self.project_context.get('project_path')
        if project_path:
            if os.path.exists(project_path):
                print(f"[Orchestrator] [CONTEXT-OK] Project path exists: {project_path}")
            else:
                print(f"[Orchestrator] [CONTEXT-STALE] Project path missing: {project_path}")
        
        # Restore Gemini conversation history if available
        serialized_history = data.get('history', [])
        if serialized_history and self.model:
            try:
                # Reconstruct Content objects for Gemini chat using standardized helper
                restored_history = self._deserialize_history(serialized_history)
                
                # Start chat with restored history
                self.chat_session = self.model.start_chat(history=restored_history)
                print(f"[Orchestrator] Restored Gemini session with {len(restored_history)} turns")
            except Exception as e:
                print(f"[Orchestrator] Failed to restore Gemini history: {e}")
                self.chat_session = self.model.start_chat(history=[])


    def _serialize_history(self) -> List[Dict]:
        """Convert Vertex AI Content objects to serializable format"""
        history_data = []
        if self.chat_session and hasattr(self.chat_session, 'history'):
            for content in self.chat_session.history:
                parts_data = []
                if hasattr(content, 'parts'):
                    for part in content.parts:
                        if hasattr(part, 'text') and part.text:
                            parts_data.append({'text': part.text})
                        elif hasattr(part, 'function_call') and part.function_call:
                            # CRITICAL: Clean function call args
                            parts_data.append({
                                'function_call': {
                                    'name': part.function_call.name,
                                    'args': self._clean_serializable(part.function_call.args)
                                }
                            })
                        elif hasattr(part, 'function_response') and part.function_response:
                            # CRITICAL: Clean function response
                            parts_data.append({
                                'function_response': {
                                    'name': part.function_response.name,
                                    'response': self._clean_serializable(part.function_response.response)
                                }
                            })
                
                history_data.append({
                    'role': content.role,
                    'parts': parts_data
                })
        return history_data

    def _deserialize_history(self, history_data: List[Dict]) -> List:
        """Convert serializable history back to Vertex AI Content objects"""
        if not history_data:
            return []
            
        from vertexai.generative_models import Content, Part
        deserialized = []
        for item in history_data:
            parts = []
            for p in item['parts']:
                if 'text' in p:
                    parts.append(Part.from_text(p['text']))
                elif 'function_call' in p:
                    # History doesn't strictly need to recreate FunctionCall object for history replay
                    pass 
                elif 'function_response' in p:
                    parts.append(Part.from_function_response(
                        name=p['function_response']['name'],
                        response=p['function_response']['response']
                    ))
            
            if parts:
                deserialized.append(Content(role=item['role'], parts=parts))
        
        return deserialized
    
    def _normalize_repo_url(self, url: str) -> str:
        """Deep normalization for GitHub URLs to ensure context integrity"""
        if not url: return ""
        try:
            import re
            u = str(url).strip().lower()
            # Remove protocols (http, https, git)
            u = re.sub(r'^https?://', '', u)
            u = re.sub(r'^git@', '', u).replace(':', '/')
            # Remove trailing slash and .git extension
            u = u.rstrip('/')
            if u.endswith('.git'):
                u = u[:-4]
            # Replace underscores with hyphens for service names (common swap)
            u = u.replace('_', '-')
            return u
        except Exception as e:
            print(f"[Orchestrator] URL normalization warning: {e}")
            return str(url).lower().strip().rstrip('/')
    
    


# ============================================================================
# TEST SUITE
# ============================================================================

async def test_orchestrator():
    """Test orchestrator with real services"""
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    gcloud_project = os.getenv('GOOGLE_CLOUD_PROJECT')
    github_token = os.getenv('GITHUB_TOKEN')
    gcloud_region = os.getenv('GOOGLE_CLOUD_REGION', 'us-central1')
    
    if not gcloud_project:
        print("[Test] GOOGLE_CLOUD_PROJECT not found in environment")
        return
    
    print("[Test] Initializing DevGem Orchestrator with Vertex AI...")
    orchestrator = OrchestratorAgent(
        gcloud_project=gcloud_project,
        github_token=github_token,
        location=gcloud_region
    )
    
    test_messages = [
        "Hello! What can you help me with?",
        "List my GitHub repositories",
        # "Analyze this repo: https://github.com/user/flask-app",
        # "Deploy it to Cloud Run as my-flask-service"
    ]
    
    for msg in test_messages:
        print(f"\n{'='*60}")
        print(f"USER: {msg}")
        print(f"{'='*60}")
        
        try:
            response = await orchestrator.process_message(
                msg, 
                session_id="test-123"
            )
            print(f"\nDEVGEM ({response['type']}):")
            print(response['content'])
            
            if response.get('data'):
                print(f"\nAdditional Data: {list(response['data'].keys())}")
            
            if response.get('actions'):
                print(f"\nAvailable Actions: {[a['label'] for a in response['actions']]}")
                
        except Exception as e:
            print(f"Error: {str(e)}")
            import traceback
            traceback.print_exc()
        
        print()  # Spacing


async def test_function_calling():
    """Test direct function calling"""
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    gcloud_project = os.getenv('GOOGLE_CLOUD_PROJECT')
    if not gcloud_project:
        print("[Test] GOOGLE_CLOUD_PROJECT not found")
        return
    
    orchestrator = OrchestratorAgent(
        gcloud_project=gcloud_project,
        github_token=os.getenv('GITHUB_TOKEN'),
        location=os.getenv('GOOGLE_CLOUD_REGION', 'us-central1')
    )
    
    print("Testing message that should trigger function call...")
    response = await orchestrator.process_message(
        "Can you list my GitHub repositories?",
        session_id="test-func-call"
    )
    
    print(f"\nResponse Type: {response['type']}")
    print(f"Content:\n{response['content']}")


def main():
    """Main entry point"""
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--test-functions':
        asyncio.run(test_function_calling())
    else:
        asyncio.run(test_orchestrator())


if __name__ == "__main__":
    main()