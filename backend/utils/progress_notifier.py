"""
Progress Notifier for Deployment Updates
Uses safe WebSocket sending to avoid "close message sent" errors
"""

import asyncio
from typing import Callable, Optional
from datetime import datetime


class DeploymentStages:
    """Stage name constants"""
    REPO_CLONE = "repo_clone"
    CODE_ANALYSIS = "code_analysis"
    DOCKERFILE_GEN = "dockerfile_generation"
    SECURITY_SCAN = "security_scan"
    CONTAINER_BUILD = "container_build"
    CLOUD_DEPLOYMENT = "cloud_deployment"


class ProgressNotifier:
    """
    Sends real-time progress updates to frontend via WebSocket
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