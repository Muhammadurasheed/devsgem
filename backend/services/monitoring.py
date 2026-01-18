"""
Production Monitoring & Observability Service
FAANG-level metrics, logging, and alerting
"""

import logging
import time
import uuid
from typing import Dict, Any, Optional, List
from datetime import datetime
from dataclasses import dataclass, field
import json


@dataclass
class DeploymentMetrics:
    """Track deployment metrics"""
    deployment_id: str
    service_name: str
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    status: str = "in_progress"
    stages: Dict[str, Dict] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)
    
    def record_stage(self, stage: str, status: str, duration: float = 0, metadata: Dict = None):
        """Record completion of a stage"""
        self.stages[stage] = {
            'status': status,
            'duration': duration,
            'timestamp': time.time(),
            'metadata': metadata or {}
        }
    
    def complete(self, status: str = "success"):
        """Mark deployment as complete"""
        self.end_time = time.time()
        self.status = status
    
    def get_duration(self) -> float:
        """Get total deployment duration"""
        end = self.end_time or time.time()
        return end - self.start_time
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for logging/reporting"""
        return {
            'deployment_id': self.deployment_id,
            'service_name': self.service_name,
            'duration': self.get_duration(),
            'status': self.status,
            'stages': self.stages,
            'errors': self.errors,
            'timestamp': datetime.fromtimestamp(self.start_time).isoformat()
        }


class MonitoringService:
    """
    Production monitoring service
    
    Features:
    - Structured logging with correlation IDs
    - Metrics collection
    - Performance tracking
    - Error aggregation
    - SLO monitoring
    """
    
    def __init__(self, correlation_id: Optional[str] = None):
        """
        Initialize monitoring service with correlation ID support
        
        Args:
            correlation_id: Optional correlation ID for request tracking
        """
        self.correlation_id = correlation_id or self._generate_correlation_id()
        
        # Use LoggerAdapter to inject correlation_id into all log records
        self.logger = logging.LoggerAdapter(
            logging.getLogger(__name__),
            {'correlation_id': self.correlation_id}
        )
        
        self.deployments: Dict[str, DeploymentMetrics] = {}
        self.metrics = {
            'total_deployments': 0,
            'successful_deployments': 0,
            'failed_deployments': 0,
            'avg_deployment_time': 0,
            'error_rate': 0
        }
    
    def _generate_correlation_id(self) -> str:
        """Generate unique correlation ID for monitoring instance"""
        return f"mon-{uuid.uuid4().hex[:12]}"
    
    def start_deployment(self, deployment_id: str, service_name: str) -> DeploymentMetrics:
        """Start tracking a deployment"""
        metrics = DeploymentMetrics(
            deployment_id=deployment_id,
            service_name=service_name
        )
        self.deployments[deployment_id] = metrics
        self.metrics['total_deployments'] += 1
        
        self.logger.info(f"[{deployment_id}] Started deployment for: {service_name}")
        return metrics
    
    def record_stage(
        self, 
        deployment_id: str, 
        stage: str, 
        status: str, 
        duration: float = 0,
        metadata: Dict = None
    ):
        """Record deployment stage completion"""
        if deployment_id in self.deployments:
            self.deployments[deployment_id].record_stage(stage, status, duration, metadata)
            self.logger.info(
                f"[{deployment_id}] Stage {stage}: {status} ({duration:.2f}s)"
            )
    
    def complete_deployment(self, deployment_id: str, status: str):
        """Mark deployment as complete"""
        if deployment_id not in self.deployments:
            return
        
        deployment = self.deployments[deployment_id]
        deployment.complete(status)
        
        if status == "success":
            self.metrics['successful_deployments'] += 1
        else:
            self.metrics['failed_deployments'] += 1
        
        # Update average deployment time
        total = self.metrics['total_deployments']
        current_avg = self.metrics['avg_deployment_time']
        new_avg = ((current_avg * (total - 1)) + deployment.get_duration()) / total
        self.metrics['avg_deployment_time'] = new_avg
        
        # Update error rate
        self.metrics['error_rate'] = (
            self.metrics['failed_deployments'] / self.metrics['total_deployments']
        )
        
        self.logger.info(
            f"[{deployment_id}] Deployment completed: {status} "
            f"(duration: {deployment.get_duration():.2f}s)"
        )
    
    def record_error(self, deployment_id: str, error: str):
        """Record deployment error"""
        if deployment_id in self.deployments:
            self.deployments[deployment_id].errors.append(error)
            self.logger.error(f"[{deployment_id}] Error: {error}")
    
    def get_deployment_metrics(self, deployment_id: str) -> Optional[Dict]:
        """Get metrics for a specific deployment"""
        if deployment_id in self.deployments:
            return self.deployments[deployment_id].to_dict()
        return None
    
    def get_overall_metrics(self) -> Dict:
        """Get overall service metrics"""
        return {
            **self.metrics,
            'timestamp': datetime.now().isoformat()
        }
    
    def log_structured(self, level: str, message: str, **kwargs):
        """Log structured message with metadata"""
        log_data = {
            'timestamp': datetime.now().isoformat(),
            'level': level,
            'message': message,
            **kwargs
        }
        
        log_method = getattr(self.logger, level.lower(), self.logger.info)
        log_method(json.dumps(log_data))


# Global monitoring instance
monitoring = MonitoringService()
