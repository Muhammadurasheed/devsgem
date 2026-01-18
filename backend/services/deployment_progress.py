"""
Deployment Progress Tracking Service
FAANG-Level Implementation - Structured Progress Updates for Real-time UI
"""

from typing import Optional, Dict, List, Callable
from datetime import datetime
import asyncio

class DeploymentProgressTracker:
    """
    Tracks and emits structured deployment progress updates.
    Designed for real-time WebSocket streaming to frontend.
    """
    
    def __init__(self, deployment_id: str, service_name: str, progress_callback: Optional[Callable] = None):
        self.deployment_id = deployment_id
        self.service_name = service_name
        self.progress_callback = progress_callback
        self.start_time = datetime.now()
        self.stages: Dict[str, Dict] = {}
        self.current_progress = 0
        
    async def emit(self, message: str, stage: Optional[str] = None, progress: Optional[int] = None, logs: Optional[List[str]] = None):
        """
        Emit a progress message to the frontend.
        Frontend parser will extract stage information from log patterns.
        """
        if not self.progress_callback:
            return
            
        # Update progress if provided
        if progress is not None:
            self.current_progress = progress
            
        # Emit structured message with error handling for disconnected clients
        try:
            await self.progress_callback({
                'type': 'message',
                'data': {
                    'content': message,
                    'timestamp': datetime.now().isoformat(),
                    'metadata': {
                        'deployment_id': self.deployment_id,
                        'service_name': self.service_name,
                        'stage': stage,
                        'progress': self.current_progress,
                        'logs': logs or []
                    }
                }
            })
        except Exception as e:
            # Gracefully handle disconnected clients
            print(f"[DeploymentProgress] Warning: Could not emit progress: {e}")
            pass
    
    # ========================================================================
    # STAGE 1: Repository Access
    # ========================================================================
    
    async def start_repo_clone(self, repo_url: str):
        """Emit: Repository cloning started"""
        await self.emit(
            f"[GitHubService] Cloning {repo_url}...",
            stage='repo_access',
            progress=5
        )
    
    async def complete_repo_clone(self, local_path: str, file_count: int, size_mb: float):
        """Emit: Repository cloning completed"""
        await self.emit(
            f"[GitHubService] Cloning {self.service_name} to {local_path}",
            stage='repo_access',
            progress=15
        )
        await asyncio.sleep(0.1)
        await self.emit(
            f"[GitHubService] Repository cloned successfully",
            stage='repo_access'
        )
        await self.emit(
            f"[GitHubService] Size: {size_mb:.1f} MB • {file_count} files",
            stage='repo_access'
        )
    
    # ========================================================================
    # STAGE 2: Code Analysis
    # ========================================================================
    
    async def start_code_analysis(self, project_path: str):
        """Emit: Code analysis started"""
        await self.emit(
            f"[AnalysisService] Analyzing project at {project_path}",
            stage='code_analysis',
            progress=20
        )
    
    async def emit_framework_detection(self, framework: str, language: str, runtime: str):
        """Emit: Framework detected"""
        await self.emit(
            f"[AnalysisService] Detected framework: {framework}",
            stage='code_analysis',
            progress=25
        )
        await self.emit(
            f"[AnalysisService] Language: {language} ({runtime})",
            stage='code_analysis'
        )
    
    async def emit_dependency_analysis(self, dep_count: int, database: Optional[str] = None):
        """Emit: Dependencies analyzed"""
        await self.emit(
            f"[AnalysisService] Found {dep_count} dependencies",
            stage='code_analysis',
            progress=30
        )
        if database:
            await self.emit(
                f"[AnalysisService] Database detected: {database}",
                stage='code_analysis'
            )
    
    async def complete_code_analysis(self):
        """Emit: Code analysis completed"""
        await self.emit(
            "[AnalysisService] Analysis complete",
            stage='code_analysis',
            progress=35
        )
    
    # ========================================================================
    # STAGE 3: Dockerfile Generation
    # ========================================================================
    
    async def start_dockerfile_generation(self, framework: str):
        """Emit: Dockerfile generation started"""
        await self.emit(
            f"[AnalysisService] Generating Dockerfile for {framework}",
            stage='dockerfile_generation',
            progress=40
        )
    
    async def emit_dockerfile_optimization(self, optimizations: List[str]):
        """Emit: Dockerfile optimizations"""
        await self.emit(
            "[DockerService] Applying multi-stage build strategy",
            stage='dockerfile_generation',
            progress=45
        )
        for opt in optimizations[:2]:
            await self.emit(
                f"[DockerService] {opt}",
                stage='dockerfile_generation'
            )
    
    async def complete_dockerfile_generation(self, dockerfile_path: str):
        """Emit: Dockerfile generation completed"""
        await self.emit(
            f"[DockerService] Dockerfile saved to {dockerfile_path}",
            stage='dockerfile_generation',
            progress=50
        )
        await self.emit(
            "[DockerService] Dockerfile created successfully",
            stage='dockerfile_generation'
        )
    
    # ========================================================================
    # STAGE 4: Security Scan
    # ========================================================================
    
    async def start_security_scan(self):
        """Emit: Security scan started"""
        await self.emit(
            "[SecurityService] Starting security scan",
            stage='security_scan',
            progress=55
        )
    
    async def emit_security_check(self, check_name: str, passed: bool):
        """Emit: Individual security check result"""
        status = "✓" if passed else "✗"
        await self.emit(
            f"[SecurityService] {status} {check_name}",
            stage='security_scan'
        )
    
    async def complete_security_scan(self, issues_found: int):
        """Emit: Security scan completed"""
        if issues_found == 0:
            await self.emit(
                "[SecurityService] Security scan complete - No vulnerabilities found",
                stage='security_scan',
                progress=60
            )
        else:
            await self.emit(
                f"[SecurityService] Security scan complete - {issues_found} issues detected",
                stage='security_scan',
                progress=60
            )
    
    # ========================================================================
    # STAGE 5: Container Build
    # ========================================================================
    
    async def start_container_build(self, image_tag: str):
        """Emit: Container build started"""
        await self.emit(
            f"[DockerService] Building container image: {image_tag}",
            stage='container_build',
            progress=65
        )
    
    async def emit_build_step(self, step_num: int, total_steps: int, description: str):
        """Emit: Build step progress"""
        step_progress = 65 + int((step_num / total_steps) * 15)  # 65-80% range
        await self.emit(
            f"[CloudBuild] Step {step_num}/{total_steps}: {description}",
            stage='container_build',
            progress=step_progress
        )
    
    async def emit_build_progress(self, percentage: int):
        """Emit: Overall build progress"""
        build_progress = 65 + int(percentage * 0.15)  # Map 0-100% to 65-80%
        await self.emit(
            f"[CloudBuild] Building {percentage}%",
            stage='container_build',
            progress=build_progress
        )
    
    async def complete_container_build(self, image_digest: str):
        """Emit: Container build completed"""
        await self.emit(
            "[CloudBuild] Container image built successfully",
            stage='container_build',
            progress=80
        )
        await self.emit(
            f"[CloudBuild] Image digest: {image_digest[:20]}...",
            stage='container_build'
        )
    
    async def emit_build_logs(self, logs: List[str]):
        """Emit: Build logs"""
        if not logs:
            return
        await self.emit(
            "Building...",
            stage='container_build',
            logs=logs
        )
    
    # ========================================================================
    # STAGE 6: Cloud Run Deployment
    # ========================================================================
    
    async def start_cloud_deployment(self, service_name: str, region: str):
        """Emit: Cloud Run deployment started"""
        await self.emit(
            f"[GCloudService] Deploying to Cloud Run",
            stage='cloud_deployment',
            progress=85
        )
        await self.emit(
            f"[GCloudService] Service: {service_name} | Region: {region}",
            stage='cloud_deployment'
        )
    
    async def emit_deployment_config(self, cpu: str, memory: str, concurrency: int):
        """Emit: Deployment configuration"""
        await self.emit(
            f"[GCloudService] Configuration: {cpu} CPU, {memory} RAM",
            stage='cloud_deployment',
            progress=90
        )
        await self.emit(
            f"[GCloudService] Concurrency: {concurrency} requests",
            stage='cloud_deployment'
        )
    
    async def emit_deployment_status(self, status: str):
        """Emit: Deployment status update"""
        await self.emit(
            f"[GCloudService] Deployment progress: {status}",
            stage='cloud_deployment',
            progress=95
        )
    
    async def complete_cloud_deployment(self, service_url: str):
        """Emit: Cloud Run deployment completed"""
        await self.emit(
            "[GCloudService] Deployment successful",
            stage='cloud_deployment',
            progress=100
        )
        await self.emit(
            f"[GCloudService] Service URL: {service_url}",
            stage='cloud_deployment'
        )
        await self.emit(
            "[GCloudService] Auto HTTPS enabled, auto-scaling configured",
            stage='cloud_deployment'
        )
    
    # ========================================================================
    # Error Handling
    # ========================================================================
    
    async def emit_error(self, stage: str, error_message: str):
        """Emit: Error occurred during deployment"""
        await self.emit(
            f"[ERROR] {stage}: {error_message}",
            stage=stage
        )
    
    async def emit_warning(self, warning_message: str):
        """Emit: Warning message"""
        await self.emit(
            f"[WARNING] {warning_message}"
        )
    
    # ========================================================================
    # Utility Methods
    # ========================================================================
    
    def get_elapsed_time(self) -> float:
        """Get elapsed time since deployment started (in seconds)"""
        return (datetime.now() - self.start_time).total_seconds()
    
    async def emit_custom(self, message: str, stage: Optional[str] = None):
        """Emit custom message with optional stage"""
        await self.emit(message, stage=stage)


# ============================================================================
# Convenience Function
# ============================================================================

def create_progress_tracker(
    deployment_id: str,
    service_name: str,
    progress_callback: Optional[Callable] = None
) -> DeploymentProgressTracker:
    """
    Factory function to create a deployment progress tracker.
    
    Usage:
        tracker = create_progress_tracker(deployment_id, service_name, callback)
        await tracker.start_repo_clone(repo_url)
        await tracker.complete_repo_clone(path, files, size)
    """
    return DeploymentProgressTracker(deployment_id, service_name, progress_callback)
