"""
Data Models for ServerGem Backend
Production-grade data structures with validation
"""

from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, List, Any
from datetime import datetime
from enum import Enum
import json


class DeploymentStatus(Enum):
    """Deployment lifecycle states"""
    PENDING = "pending"
    BUILDING = "building"
    DEPLOYING = "deploying"
    LIVE = "live"
    FAILED = "failed"
    STOPPED = "stopped"


class PlanTier(Enum):
    """Subscription tiers"""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


@dataclass
class Deployment:
    """Production deployment record"""
    id: str
    user_id: str
    service_name: str
    repo_url: str
    status: DeploymentStatus
    url: str
    gcp_url: Optional[str] = None
    region: str = "us-central1"
    memory: str = "512Mi"
    cpu: str = "1"
    env_vars: Dict[str, str] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    last_deployed: Optional[str] = None
    build_logs: List[str] = field(default_factory=list)
    stages: List[Dict] = field(default_factory=list)
    framework: Optional[str] = None
    language: Optional[str] = None
    error_message: Optional[str] = None
    request_count: int = 0
    uptime_percentage: float = 100.0
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['status'] = self.status.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Deployment':
        """Create from dictionary with schema evolution robustness"""
        # [FAANG] Handle status conversion
        if isinstance(data.get('status'), str):
            try:
                data['status'] = DeploymentStatus(data['status'])
            except ValueError:
                 # Fallback for unknown status
                 data['status'] = DeploymentStatus.PENDING

        # [FAANG] Robustness: Filter fields to match current dataclass
        import inspect
        # inspect.get_annotations returns a dict {name: type}
        valid_fields = set(inspect.get_annotations(cls).keys())
        filtered_data = {k: v for k, v in data.items() if k in valid_fields}
        
        return cls(**filtered_data)


@dataclass
class User:
    """User account with settings"""
    id: str
    email: str
    username: str
    display_name: str
    avatar_url: Optional[str] = None
    github_token: Optional[str] = None
    plan_tier: PlanTier = PlanTier.FREE
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    settings: Dict[str, Any] = field(default_factory=dict)
    
    # Usage limits based on plan
    max_services: int = 1
    max_requests_per_day: int = 100
    max_memory_mb: int = 512
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        data = asdict(self)
        data['plan_tier'] = self.plan_tier.value
        return data
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'User':
        """Create from dictionary"""
        if isinstance(data.get('plan_tier'), str):
            data['plan_tier'] = PlanTier(data['plan_tier'])
        return cls(**data)
    
    def can_deploy_more_services(self, current_count: int) -> bool:
        """Check if user can deploy more services"""
        return current_count < self.max_services
    
    def upgrade_to_pro(self):
        """Upgrade user to Pro plan"""
        self.plan_tier = PlanTier.PRO
        self.max_services = 5
        self.max_requests_per_day = -1  # unlimited
        self.max_memory_mb = 2048


@dataclass
class UsageMetrics:
    """Daily usage tracking"""
    user_id: str
    date: str
    requests: int = 0
    deployments: int = 0
    memory_used_mb: int = 0
    bandwidth_gb: float = 0.0
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'UsageMetrics':
        """Create from dictionary"""
        return cls(**data)


@dataclass
class DeploymentEvent:
    """Event log for deployments"""
    id: str
    deployment_id: str
    event_type: str  # build_started, build_complete, deploy_started, deploy_complete, error
    message: str
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return asdict(self)
