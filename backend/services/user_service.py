"""
User Management Service
User accounts, authentication, and settings
"""

import json
import os
from typing import Optional, Dict
import uuid

from models import User, PlanTier


class UserService:
    """
    Production user management
    
    Features:
    - User CRUD operations
    - Plan tier management
    - Settings persistence
    - Token management
    """
    
    def __init__(self, storage_path: str = "data/users.json"):
        self.storage_path = storage_path
        self._ensure_storage()
        self._users: Dict[str, User] = self._load_users()
    
    def _ensure_storage(self):
        """Create storage directory"""
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, 'w') as f:
                json.dump({}, f)
    
    def _load_users(self) -> Dict[str, User]:
        """Load users from disk"""
        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)
                return {
                    user_id: User.from_dict(user_data)
                    for user_id, user_data in data.items()
                }
        except Exception as e:
            print(f"Error loading users: {e}")
            return {}
    
    def _save_users(self):
        """Save users to disk"""
        try:
            temp_path = f"{self.storage_path}.tmp"
            with open(temp_path, 'w') as f:
                data = {
                    user_id: user.to_dict()
                    for user_id, user in self._users.items()
                }
                json.dump(data, f, indent=2)
            os.replace(temp_path, self.storage_path)
        except Exception as e:
            print(f"Error saving users: {e}")
    
    # ========================================================================
    # User Operations
    # ========================================================================
    
    def create_user(
        self,
        email: str,
        username: str,
        display_name: str,
        avatar_url: Optional[str] = None,
        github_token: Optional[str] = None
    ) -> User:
        """Create new user"""
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        
        user = User(
            id=user_id,
            email=email,
            username=username,
            display_name=display_name,
            avatar_url=avatar_url,
            github_token=github_token
        )
        
        self._users[user_id] = user
        self._save_users()
        
        return user
    
    def get_user(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self._users.get(user_id)
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        for user in self._users.values():
            if user.email == email:
                return user
        return None
    
    def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username"""
        for user in self._users.values():
            if user.username == username:
                return user
        return None
    
    def update_user(
        self,
        user_id: str,
        **updates
    ) -> Optional[User]:
        """Update user fields"""
        user = self._users.get(user_id)
        if not user:
            return None
        
        for key, value in updates.items():
            if hasattr(user, key):
                setattr(user, key, value)
        
        self._save_users()
        return user
    
    def update_github_token(self, user_id: str, token: str) -> Optional[User]:
        """Update GitHub token"""
        return self.update_user(user_id, github_token=token)
    
    def upgrade_user_plan(self, user_id: str, tier: PlanTier) -> Optional[User]:
        """Upgrade user to new plan tier"""
        user = self._users.get(user_id)
        if not user:
            return None
        
        if tier == PlanTier.PRO:
            user.upgrade_to_pro()
        elif tier == PlanTier.ENTERPRISE:
            user.plan_tier = PlanTier.ENTERPRISE
            user.max_services = -1  # unlimited
            user.max_requests_per_day = -1
            user.max_memory_mb = 8192
        
        self._save_users()
        return user
    
    def update_settings(self, user_id: str, settings: Dict) -> Optional[User]:
        """Update user settings"""
        user = self._users.get(user_id)
        if not user:
            return None
        
        user.settings.update(settings)
        self._save_users()
        return user
    
    def delete_user(self, user_id: str) -> bool:
        """Delete user"""
        if user_id in self._users:
            del self._users[user_id]
            self._save_users()
            return True
        return False


# Global instance
user_service = UserService()
