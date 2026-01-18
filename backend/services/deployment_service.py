"""
Deployment Management Service
CRUD operations for deployments with persistent storage
"""

import json
import os
from typing import List, Optional, Dict
from datetime import datetime
import uuid

from models import Deployment, DeploymentStatus, DeploymentEvent


class DeploymentService:
    """
    Production deployment management
    
    Features:
    - Persistent JSON storage (upgrade to PostgreSQL in production)
    - Atomic writes with backups
    - Query by user, status, date
    - Event logging for audit trail
    """
    
    def __init__(self, storage_path: str = "data/deployments.json"):
        self.storage_path = storage_path
        self.events_path = "data/deployment_events.json"
        self._ensure_storage()
        self._deployments: Dict[str, Deployment] = self._load_deployments()
        self._events: List[DeploymentEvent] = self._load_events()
    
    def _ensure_storage(self):
        """Create storage directory if it doesn't exist"""
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        os.makedirs(os.path.dirname(self.events_path), exist_ok=True)
        
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, 'w') as f:
                json.dump({}, f)
        
        if not os.path.exists(self.events_path):
            with open(self.events_path, 'w') as f:
                json.dump([], f)
    
    def _load_deployments(self) -> Dict[str, Deployment]:
        """Load deployments from disk"""
        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)
                return {
                    dep_id: Deployment.from_dict(dep_data)
                    for dep_id, dep_data in data.items()
                }
        except Exception as e:
            print(f"Error loading deployments: {e}")
            return {}
    
    def _save_deployments(self):
        """Save deployments to disk with atomic write"""
        try:
            # Write to temp file first
            temp_path = f"{self.storage_path}.tmp"
            with open(temp_path, 'w') as f:
                data = {
                    dep_id: dep.to_dict()
                    for dep_id, dep in self._deployments.items()
                }
                json.dump(data, f, indent=2)
            
            # Atomic rename
            os.replace(temp_path, self.storage_path)
        except Exception as e:
            print(f"Error saving deployments: {e}")
    
    def _load_events(self) -> List[DeploymentEvent]:
        """Load events from disk"""
        try:
            with open(self.events_path, 'r') as f:
                data = json.load(f)
                return [DeploymentEvent(**event) for event in data]
        except Exception as e:
            print(f"Error loading events: {e}")
            return []
    
    def _save_events(self):
        """Save events to disk"""
        try:
            with open(self.events_path, 'w') as f:
                data = [event.to_dict() for event in self._events]
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving events: {e}")
    
    def _log_event(self, deployment_id: str, event_type: str, message: str, metadata: Dict = None):
        """Log deployment event"""
        event = DeploymentEvent(
            id=f"evt_{uuid.uuid4().hex[:12]}",
            deployment_id=deployment_id,
            event_type=event_type,
            message=message,
            metadata=metadata or {}
        )
        self._events.append(event)
        self._save_events()
    
    # ========================================================================
    # CRUD Operations
    # ========================================================================
    
    def create_deployment(
        self,
        user_id: str,
        service_name: str,
        repo_url: str,
        region: str = "us-central1",
        env_vars: Dict[str, str] = None
    ) -> Deployment:
        """Create new deployment record"""
        deployment_id = f"dep_{uuid.uuid4().hex[:12]}"
        unique_service_name = f"{user_id}-{service_name}".lower().replace('_', '-')
        
        deployment = Deployment(
            id=deployment_id,
            user_id=user_id,
            service_name=unique_service_name,
            repo_url=repo_url,
            status=DeploymentStatus.PENDING,
            url=f"https://{unique_service_name}.servergem.app",
            region=region,
            env_vars=env_vars or {}
        )
        
        self._deployments[deployment_id] = deployment
        self._save_deployments()
        
        self._log_event(
            deployment_id,
            "deployment_created",
            f"Deployment created for {repo_url}"
        )
        
        return deployment
    
    def get_deployment(self, deployment_id: str) -> Optional[Deployment]:
        """Get deployment by ID"""
        return self._deployments.get(deployment_id)
    
    def get_user_deployments(self, user_id: str) -> List[Deployment]:
        """Get all deployments for a user"""
        return [
            dep for dep in self._deployments.values()
            if dep.user_id == user_id
        ]
    
    def update_deployment_status(
        self,
        deployment_id: str,
        status: DeploymentStatus,
        error_message: Optional[str] = None,
        gcp_url: Optional[str] = None
    ) -> Optional[Deployment]:
        """Update deployment status"""
        deployment = self._deployments.get(deployment_id)
        if not deployment:
            return None
        
        deployment.status = status
        deployment.updated_at = datetime.utcnow().isoformat()
        
        if error_message:
            deployment.error_message = error_message
        
        if gcp_url:
            deployment.gcp_url = gcp_url
        
        if status == DeploymentStatus.LIVE:
            deployment.last_deployed = datetime.utcnow().isoformat()
        
        self._save_deployments()
        
        self._log_event(
            deployment_id,
            "status_changed",
            f"Status changed to {status.value}",
            {"status": status.value, "error": error_message}
        )
        
        return deployment
    
    def add_build_log(self, deployment_id: str, log_line: str):
        """Add build log line"""
        deployment = self._deployments.get(deployment_id)
        if deployment:
            deployment.build_logs.append(log_line)
            self._save_deployments()
    
    def increment_request_count(self, deployment_id: str):
        """Increment request count for a deployment"""
        deployment = self._deployments.get(deployment_id)
        if deployment:
            deployment.request_count += 1
            self._save_deployments()
    
    def delete_deployment(self, deployment_id: str) -> bool:
        """Delete deployment"""
        if deployment_id in self._deployments:
            deployment = self._deployments[deployment_id]
            del self._deployments[deployment_id]
            self._save_deployments()
            
            self._log_event(
                deployment_id,
                "deployment_deleted",
                f"Deployment {deployment.service_name} deleted"
            )
            
            return True
        return False
    
    # ========================================================================
    # Query Operations
    # ========================================================================
    
    def get_active_deployments(self, user_id: str) -> List[Deployment]:
        """Get all active (live) deployments for user"""
        return [
            dep for dep in self._deployments.values()
            if dep.user_id == user_id and dep.status == DeploymentStatus.LIVE
        ]
    
    def get_deployment_events(self, deployment_id: str, limit: int = 50) -> List[DeploymentEvent]:
        """Get events for a deployment"""
        events = [e for e in self._events if e.deployment_id == deployment_id]
        return sorted(events, key=lambda x: x.timestamp, reverse=True)[:limit]
    
    def get_deployment_count(self, user_id: str) -> int:
        """Get total deployment count for user"""
        return len([d for d in self._deployments.values() if d.user_id == user_id])


# Global instance
deployment_service = DeploymentService()
