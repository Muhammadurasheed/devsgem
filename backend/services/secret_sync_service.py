"""
Secret Sync Service - Two-Way Environment Variable Synchronization
Bismillahir Rahmanir Raheem

Provides FAANG-level secret management:
1. Dashboard -> Google Secret Manager (on save)
2. Google Secret Manager -> Cloud Run (live update without rebuild)
"""

import asyncio
import json
import os
from typing import Dict, Optional, List
from datetime import datetime
import hashlib


class SecretSyncService:
    """
    [FAANG] Two-Way Secret Synchronization Engine
    
    Features:
    - Push env vars to Google Secret Manager on save
    - Trigger Cloud Run revision update to apply changes (no rebuild)
    - Load secrets from GSM when deployment starts
    - Merge priority: API > GSM > Local .env > Default
    """
    
    def __init__(self, gcloud_service=None):
        self.gcloud_service = gcloud_service
        self._sync_cache: Dict[str, datetime] = {}  # deployment_id -> last_sync_time
        
    def set_gcloud_service(self, gcloud_service):
        """Set the GCloud service (dependency injection for flexibility)"""
        self.gcloud_service = gcloud_service
        
    def _get_secret_id(self, deployment_id: str, user_id: str) -> str:
        """
        Generate a unique secret ID for this deployment.
        [GOOGLE STANDARDS] Deterministic and collision-resistant.
        """
        user_hash = hashlib.md5(user_id.encode()).hexdigest()[:8]
        deployment_prefix = deployment_id[:12]
        return f"devgem-{user_hash}-{deployment_prefix}"

    def _get_repo_secret_id(self, repo_url: str, user_id: str) -> str:
        """
        [FAANG] Bridge Secret ID for the pre-deployment (analyze) phase.
        Uses repo URL to identify secrets before a deployment_id exists.
        """
        import re
        # Extract owner/repo from URL
        parts = repo_url.strip('/').split('/')
        if len(parts) >= 2:
            owner = parts[-2]
            repo = parts[-1].replace('.git', '')
        else:
            owner = 'default'
            repo = parts[-1].replace('.git', '')
            
        safe_owner = re.sub(r'[^a-zA-Z0-9]', '', owner).lower()
        safe_repo = re.sub(r'[^a-zA-Z0-9-]', '-', repo).lower()
        safe_repo = re.sub(r'-+', '-', safe_repo).strip('-')
        
        # Add user hash for isolation
        user_hash = hashlib.md5(user_id.encode()).hexdigest()[:8]
        return f"devgem-{user_hash}-{safe_repo}-env"
        
    async def save_to_secret_manager(
        self,
        deployment_id: Optional[str],
        user_id: str,
        env_vars: Dict[str, str],
        repo_url: Optional[str] = None
    ) -> bool:
        """
        Save environment variables to Google Secret Manager.
        [FAANG] Supports both Deployment-id and Repo-URL based identities.
        
        Returns:
            bool: True if successful
        """
        if not self.gcloud_service:
            print("[SecretSync] ERROR: No GCloudService configured")
            return False
            
        # Prioritize deployment_id, fallback to repo_url
        if deployment_id:
            secret_id = self._get_secret_id(deployment_id, user_id)
        elif repo_url:
            secret_id = self._get_repo_secret_id(repo_url, user_id)
        else:
            print("[SecretSync] ERROR: Neither deployment_id nor repo_url provided")
            return False
        
        # Prepare payload - store as JSON
        payload = json.dumps({
            "env_vars": env_vars,
            "updated_at": datetime.utcnow().isoformat(),
            "deployment_id": deployment_id,
            "repo_url": repo_url,
            "user_id": user_id
        })
        
        print(f"[SecretSync] Saving {len(env_vars)} env vars to GSM: {secret_id}")
        
        success = await self.gcloud_service.create_or_update_secret(secret_id, payload)
        
        if success and deployment_id:
            self._sync_cache[deployment_id] = datetime.utcnow()
            
        return success
        
    async def load_from_secret_manager(
        self,
        deployment_id: Optional[str],
        user_id: str,
        repo_url: Optional[str] = None
    ) -> Optional[Dict[str, str]]:
        """
        Load environment variables from Google Secret Manager with Hybrid Search.
        [GOOGLE] Searches by deployment identity first, then by bridge identity.
        """
        if not self.gcloud_service:
            print("[SecretSync] WARNING: No GCloudService configured")
            return None
            
        # 1. Primary Search: Deployment ID
        if deployment_id:
            secret_id = self._get_secret_id(deployment_id, user_id)
            print(f"[SecretSync] Searching GSM by Deployment ID: {secret_id}")
            payload_str = await self.gcloud_service.access_secret(secret_id)
            if payload_str:
                try:
                    payload = json.loads(payload_str)
                    return payload.get("env_vars", {})
                except Exception:
                    pass

        # 2. Secondary Search: Repo URL (The bridge secret)
        if repo_url:
            repo_secret_id = self._get_repo_secret_id(repo_url, user_id)
            print(f"[SecretSync] Searching GSM by Bridge ID (Repo): {repo_secret_id}")
            payload_str = await self.gcloud_service.access_secret(repo_secret_id)
            if payload_str:
                try:
                    payload = json.loads(payload_str)
                    return payload.get("env_vars", {})
                except Exception:
                    pass

        return None
            
    async def update_cloud_run_env_vars(
        self,
        service_name: str,
        env_vars: Dict[str, str]
    ) -> bool:
        """
        Update environment variables on a running Cloud Run service.
        This triggers a new revision WITHOUT rebuilding the container.
        
        [FAANG] This is the key feature - live config update!
        
        Args:
            service_name: Name of the Cloud Run service
            env_vars: New environment variables to set
            
        Returns:
            bool: True if successful
        """
        if not self.gcloud_service:
            print("[SecretSync] ERROR: No GCloudService configured")
            return False
            
        try:
            from google.cloud import run_v2
            
            client = run_v2.ServicesAsyncClient()
            
            # Get current service
            service_path = f"projects/{self.gcloud_service.project_id}/locations/{self.gcloud_service.region}/services/{service_name}"
            
            print(f"[SecretSync] Fetching current service: {service_path}")
            
            service = await client.get_service(name=service_path)
            
            # Update container environment variables
            if service.template.containers:
                container = service.template.containers[0]
                
                # Convert our dict to Cloud Run EnvVar format
                new_env_vars = []
                for key, value in env_vars.items():
                    new_env_vars.append(run_v2.EnvVar(name=key, value=str(value)))
                
                # Replace all environment variables
                container.env = new_env_vars
                
                print(f"[SecretSync] Updating {len(env_vars)} env vars on Cloud Run...")
                
                # Update the service (this creates a new revision)
                update_request = run_v2.UpdateServiceRequest(
                    service=service,
                    allow_missing=False
                )
                
                operation = await client.update_service(request=update_request)
                
                # Wait for operation to complete (with timeout)
                result = await asyncio.wait_for(operation.result(), timeout=120)
                
                print(f"[SecretSync] Cloud Run service updated! New revision: {result.latest_created_revision}")
                return True
                
        except asyncio.TimeoutError:
            print("[SecretSync] Timeout waiting for revision update")
            return False
        except Exception as e:
            print(f"[SecretSync] Failed to update Cloud Run env vars: {e}")
            return False
            
    async def sync_env_vars(
        self,
        deployment_id: str,
        user_id: str,
        service_name: str,
        env_vars: Dict[str, str],
        apply_to_cloud_run: bool = True
    ) -> Dict[str, bool]:
        """
        Full two-way sync: Dashboard -> GSM -> Cloud Run
        
        Args:
            deployment_id: Deployment identifier
            user_id: User identifier
            service_name: Cloud Run service name
            env_vars: Environment variables to sync
            apply_to_cloud_run: If True, also update the running service
            
        Returns:
            Dict with status of each sync step
        """
        result = {
            "secret_manager_sync": False,
            "cloud_run_sync": False,
            "overall_success": False
        }
        
        # Step 1: Save to Secret Manager
        result["secret_manager_sync"] = await self.save_to_secret_manager(
            deployment_id, user_id, env_vars
        )
        
        if not result["secret_manager_sync"]:
            print("[SecretSync] Failed at GSM sync step")
            return result
            
        # Step 2: Optionally update Cloud Run
        if apply_to_cloud_run and service_name:
            result["cloud_run_sync"] = await self.update_cloud_run_env_vars(
                service_name, env_vars
            )
        else:
            result["cloud_run_sync"] = True  # Skipped, mark as success
            
        result["overall_success"] = result["secret_manager_sync"] and result["cloud_run_sync"]
        
        return result
        
    def get_last_sync_time(self, deployment_id: str) -> Optional[datetime]:
        """Get the last sync time for a deployment"""
        return self._sync_cache.get(deployment_id)


# Singleton instance
secret_sync_service = SecretSyncService()
