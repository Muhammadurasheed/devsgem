"""
Progress Notifier for Deployment Updates
Uses safe WebSocket sending to avoid "close message sent" errors
"""

import asyncio
from typing import Callable, Optional, List
from datetime import datetime


class DeploymentStages:
    """Stage name constants"""
    REPO_CLONE = "repo_access"
    CODE_ANALYSIS = "code_analysis"
    DOCKERFILE_GEN = "dockerfile_generation"
    ENV_VARS = "env_vars"
    SECURITY = "security" # [FIX] Missing constant causing crash
    SECURITY_SCAN = "security_scan"
    CONTAINER_BUILD = "container_build"
    CLOUD_DEPLOYMENT = "cloud_deployment"


class ProgressNotifier:
    """
    Sends real-time progress updates to frontend via WebSocket
    [FAANG-LEVEL] Enhanced with contextual thought telemetry and log caching
    """
    
    def __init__(self, session_id: str, deployment_id: str, safe_send_func: Callable):
        """
        Initialize progress notifier
        
        Args:
            session_id: Session ID for this deployment
            deployment_id: Unique deployment ID
            safe_send_func: Async function that safely sends JSON (session_id, data)
        """
        self.session_id = session_id
        self.deployment_id = deployment_id
        self.safe_send = safe_send_func
        self.current_stage = None
        self.stage_start_time = None
        # [FAANG] In-memory log cache for session rehydration
        self.thought_cache: List[dict] = []
    
    async def send_update(
        self,
        stage: str,
        status: str,
        message: str,
        details: Optional[dict] = None,
        progress: Optional[int] = None
    ):
        """Send progress update to frontend"""
        
        payload = {
            "type": "deployment_progress",
            "deployment_id": self.deployment_id,
            "stage": stage,
            "status": status,  # 'waiting', 'in-progress', 'success', 'error'
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        
        if details:
            payload["details"] = details
        
        if progress is not None:
            payload["progress"] = progress
        
        # Use safe send function
        success = await self.safe_send(self.session_id, payload)
        
        if success:
            print(f"[Progress] [SUCCESS] Sent: {stage} - {status}")
        else:
            print(f"[Progress] [WARNING] Failed to send: {stage} - {status}")

    async def send_thought(self, message: str, level: str = 'info', stage_id: str = None):
        """
        [FAANG] Send granular AI thought process telemetry
        Google CTO-level visibility into the agent's reasoning, now with contextual stage mapping.
        
        Args:
            message: The AI thought content
            level: Severity (info, warning, success, analyzing, scan, detect, secure)
            stage_id: Optional stage to associate this thought with for UI grouping
        """
        # Use current stage if not explicitly provided
        effective_stage = stage_id or self.current_stage
        
        payload = {
            "type": "ai_thought",
            "deployment_id": self.deployment_id,
            "message": message,
            "level": level,
            "stage_id": effective_stage,
            "timestamp": datetime.now().isoformat()
        }
        
        # [FAANG] Cache for rehydration
        self.thought_cache.append(payload)
        
        await self.safe_send(self.session_id, payload)
    
    async def start_stage(self, stage: str, message: str):
        """Mark stage as started"""
        self.current_stage = stage
        self.stage_start_time = datetime.now()
        await self.send_update(stage, "in-progress", message)
    
    async def complete_stage(self, stage: str, message: str, details: Optional[dict] = None):
        """Mark stage as completed"""
        duration = None
        if self.stage_start_time:
            duration = (datetime.now() - self.stage_start_time).total_seconds()
        
        if details is None:
            details = {}
        
        if duration:
            details["duration"] = f"{duration:.1f}s"
        
        await self.send_update(stage, "success", message, details=details)
    
    async def fail_stage(self, stage: str, error_message: str, details: Optional[dict] = None):
        """Mark stage as failed"""
        await self.send_update(stage, "error", error_message, details=details)
    
    async def update_progress(self, stage: str, message: str, progress: int):
        """Update progress percentage for current stage"""
        await self.send_update(stage, "in-progress", message, progress=progress)

    async def force_complete_all(self):
        """[FAANG] Terminal Pulse: Force-complete all stages to ensure UI checkmarks resolve"""
        stages = [
            "repo_access", "code_analysis", "dockerfile_generation", 
            "env_vars", "security_scan", "container_build", "cloud_deployment"
        ]
        for stage in stages:
            await self.send_update(stage, "success", "Completed")

    async def send_message(self, type: str, data: dict):
        """Generic message sender wrapper for compatibility"""
        payload = {
            "type": type,
            **data,
            "timestamp": datetime.now().isoformat()
        }
        await self.safe_send(self.session_id, payload)

    def get_cached_thoughts(self) -> List[dict]:
        """[FAANG] Return cached thoughts for session rehydration"""
        return self.thought_cache

