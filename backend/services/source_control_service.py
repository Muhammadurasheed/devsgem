"""
Source Control Service - Smart Polling for CI/CD
Bismillahir Rahmanir Raheem

Monitors GitHub repositories for changes and triggers automatic redeployments.
This is the "Pulse" that keeps DevGem in sync with your code.
"""

import asyncio
import os
import hashlib
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Callable
from dataclasses import dataclass, field
import aiohttp


@dataclass
class RepoWatchConfig:
    """Configuration for a watched repository"""
    repo_url: str
    deployment_id: str
    user_id: str
    branch: str = "main"
    last_commit_sha: Optional[str] = None
    last_checked: Optional[datetime] = None
    auto_deploy_enabled: bool = True
    check_interval_seconds: int = 300  # 5 minutes default
    

@dataclass  
class ChangeDetectionResult:
    """Result of checking for changes"""
    has_changes: bool
    current_sha: Optional[str] = None
    previous_sha: Optional[str] = None
    commit_message: Optional[str] = None
    commit_author: Optional[str] = None
    error: Optional[str] = None


class SourceControlService:
    """
    [FAANG] Smart Polling CI/CD Engine
    
    Monitors repositories for changes without requiring webhook infrastructure.
    Perfect for local development and deployments behind NAT/firewalls.
    """
    
    def __init__(self, github_token: Optional[str] = None):
        self.github_token = github_token or os.getenv("GITHUB_TOKEN")
        self._watched_repos: Dict[str, RepoWatchConfig] = {}
        self._polling_task: Optional[asyncio.Task] = None
        self._on_change_callbacks: List[Callable] = []
        self._running = False
        
    def register_callback(self, callback: Callable):
        """Register a callback to be called when changes are detected"""
        self._on_change_callbacks.append(callback)
        
    def watch_repo(self, config: RepoWatchConfig) -> str:
        """Add a repository to the watch list"""
        watch_id = hashlib.md5(f"{config.deployment_id}:{config.repo_url}".encode()).hexdigest()[:12]
        self._watched_repos[watch_id] = config
        print(f"[SourceControl] Added watch: {config.repo_url} -> {config.deployment_id}")
        return watch_id
        
    def unwatch_repo(self, watch_id: str):
        """Remove a repository from the watch list"""
        if watch_id in self._watched_repos:
            del self._watched_repos[watch_id]
            print(f"[SourceControl] Removed watch: {watch_id}")
            
    def get_watched_repos(self) -> List[RepoWatchConfig]:
        """Get all watched repositories"""
        return list(self._watched_repos.values())
        
    async def check_for_changes(self, repo_url: str, branch: str = "main", last_known_sha: Optional[str] = None) -> ChangeDetectionResult:
        """
        Check if a repository has new commits since the last known SHA.
        Uses GitHub API to fetch the latest commit.
        """
        try:
            # Parse repo URL to get owner/repo
            # Supports: https://github.com/owner/repo.git or https://github.com/owner/repo
            clean_url = repo_url.rstrip('.git').rstrip('/')
            parts = clean_url.split('/')
            if len(parts) < 2:
                return ChangeDetectionResult(has_changes=False, error="Invalid repository URL")
                
            owner = parts[-2]
            repo = parts[-1]
            
            # GitHub API request
            api_url = f"https://api.github.com/repos/{owner}/{repo}/commits/{branch}"
            
            headers = {
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "DevGem-SourceControl/1.0"
            }
            
            if self.github_token:
                headers["Authorization"] = f"token {self.github_token}"
                
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, headers=headers) as response:
                    if response.status == 200:
                        data = await response.json()
                        current_sha = data.get("sha")
                        commit_data = data.get("commit", {})
                        
                        has_changes = last_known_sha is not None and current_sha != last_known_sha
                        
                        return ChangeDetectionResult(
                            has_changes=has_changes,
                            current_sha=current_sha,
                            previous_sha=last_known_sha,
                            commit_message=commit_data.get("message", "").split("\n")[0],
                            commit_author=commit_data.get("author", {}).get("name")
                        )
                    elif response.status == 404:
                        return ChangeDetectionResult(has_changes=False, error="Repository or branch not found")
                    elif response.status == 403:
                        return ChangeDetectionResult(has_changes=False, error="GitHub API rate limit exceeded")
                    else:
                        return ChangeDetectionResult(has_changes=False, error=f"GitHub API error: {response.status}")
                        
        except Exception as e:
            return ChangeDetectionResult(has_changes=False, error=str(e))
            
    async def _poll_repositories(self):
        """Background task that polls all watched repositories"""
        print("[SourceControl] Polling engine started")
        
        while self._running:
            for watch_id, config in list(self._watched_repos.items()):
                if not config.auto_deploy_enabled:
                    continue
                    
                # Check if it's time to poll this repo
                now = datetime.utcnow()
                if config.last_checked:
                    next_check = config.last_checked + timedelta(seconds=config.check_interval_seconds)
                    if now < next_check:
                        continue
                
                try:
                    result = await self.check_for_changes(
                        config.repo_url, 
                        config.branch,
                        config.last_commit_sha
                    )
                    
                    # Update last checked time
                    config.last_checked = now
                    
                    if result.error:
                        print(f"[SourceControl] Error checking {config.repo_url}: {result.error}")
                        continue
                        
                    # Update stored SHA
                    if result.current_sha:
                        config.last_commit_sha = result.current_sha
                        
                    if result.has_changes:
                        print(f"[SourceControl] Changes detected in {config.repo_url}!")
                        print(f"  Commit: {result.commit_message} by {result.commit_author}")
                        
                        # Notify all callbacks
                        for callback in self._on_change_callbacks:
                            try:
                                await callback(config, result)
                            except Exception as cb_err:
                                print(f"[SourceControl] Callback error: {cb_err}")
                                
                except Exception as e:
                    print(f"[SourceControl] Poll error for {config.repo_url}: {e}")
                    
            # Sleep before next poll cycle
            await asyncio.sleep(30)  # Check the list every 30 seconds
            
    def start_polling(self):
        """Start the background polling task"""
        if self._polling_task and not self._polling_task.done():
            return
            
        self._running = True
        self._polling_task = asyncio.create_task(self._poll_repositories())
        print("[SourceControl] Polling engine activated")
        
    def stop_polling(self):
        """Stop the background polling task"""
        self._running = False
        if self._polling_task:
            self._polling_task.cancel()
            self._polling_task = None
        print("[SourceControl] Polling engine stopped")
        
    async def trigger_check_now(self, deployment_id: str) -> Optional[ChangeDetectionResult]:
        """Force an immediate check for a specific deployment"""
        for watch_id, config in self._watched_repos.items():
            if config.deployment_id == deployment_id:
                result = await self.check_for_changes(
                    config.repo_url,
                    config.branch,
                    config.last_commit_sha
                )
                
                if result.current_sha:
                    config.last_commit_sha = result.current_sha
                    config.last_checked = datetime.utcnow()
                    
                return result
                
        return None


# Singleton instance
source_control_service = SourceControlService()
