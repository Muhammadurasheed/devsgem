"""
GitHub Service - Real GitHub integration
Handles repo cloning, validation, and management
"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Optional
import requests
from datetime import datetime


import tempfile

class GitHubService:
    """Production-grade GitHub integration service"""
    
    def __init__(self, github_token: Optional[str] = None):
        self.token = github_token or os.getenv('GITHUB_TOKEN')
        self.base_url = 'https://api.github.com'
        # [FIXED] Use standard temp directory for Windows compatibility
        self.workspace_dir = Path(tempfile.gettempdir()) / 'servergem_repos'
        self.workspace_dir.mkdir(parents=True, exist_ok=True)
        
    def validate_token(self) -> Dict:
        """Validate GitHub token and return user info"""
        if not self.token:
            return {'valid': False, 'error': 'No GitHub token provided'}
        
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        try:
            response = requests.get(f'{self.base_url}/user', headers=headers, timeout=10)
            
            if response.status_code == 200:
                user_data = response.json()
                return {
                    'valid': True,
                    'username': user_data.get('login'),
                    'name': user_data.get('name'),
                    'email': user_data.get('email'),
                    'avatar_url': user_data.get('avatar_url')
                }
            else:
                return {'valid': False, 'error': f'Invalid token: {response.status_code}'}
                
        except Exception as e:
            return {'valid': False, 'error': f'Validation failed: {str(e)}'}
    
    def list_repositories(self, username: Optional[str] = None) -> List[Dict]:
        """List user's repositories"""
        if not self.token:
            raise ValueError('GitHub token required')
        
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        try:
            # Get authenticated user's repos
            endpoint = f'{self.base_url}/user/repos' if not username else f'{self.base_url}/users/{username}/repos'
            response = requests.get(
                endpoint,
                headers=headers,
                params={'sort': 'updated', 'per_page': 100},
                timeout=10
            )
            
            if response.status_code == 200:
                repos = response.json()
                return [{
                    'name': repo['name'],
                    'full_name': repo['full_name'],
                    'description': repo.get('description', ''),
                    'url': repo['html_url'],
                    'clone_url': repo['clone_url'],
                    'language': repo.get('language', 'Unknown'),
                    'stars': repo['stargazers_count'],
                    'updated_at': repo['updated_at'],
                    'private': repo['private']
                } for repo in repos]
            else:
                raise Exception(f'Failed to fetch repos: {response.status_code}')
                
        except Exception as e:
            raise Exception(f'Failed to list repositories: {str(e)}')
    
    async def clone_repository(self, repo_url: str, branch: str = 'main', progress_callback=None) -> Dict:
        """
        Clone a GitHub repository with real-time progress updates
        
        Args:
            repo_url: GitHub repo URL (https or git)
            branch: Branch name to clone (default: main)
            progress_callback: Optional async callback for progress updates
            
        Returns:
            Dict with clone status and local path
        """
        try:
            # ✅ PHASE 2: Real-time progress - Start
            if progress_callback:
                await progress_callback(f"Starting repository clone: {repo_url}")
            # Extract repo name from URL
            repo_name = repo_url.rstrip('/').split('/')[-1].replace('.git', '')
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            local_path = self.workspace_dir / f"{repo_name}_{timestamp}"
            
            # Ensure we're using HTTPS URL with token
            if not repo_url.startswith('https://'):
                repo_url = repo_url.replace('git@github.com:', 'https://github.com/')
            
            # Add token to URL if available
            if self.token:
                # Parse URL to inject token
                if 'github.com' in repo_url:
                    repo_url = repo_url.replace('https://', f'https://{self.token}@')
            
            # ✅ PHASE 2: Real-time progress - Cloning
            if progress_callback:
                await progress_callback(f"[GITHUB] Cloning repository to {local_path.name}...")
            
            print(f"[GitHubService] Fast cloning {repo_url}...")
            
            # Use optimized git clone flags for maximum speed
            result = subprocess.run(
                [
                    'git', 'clone',
                    '--depth', '1',              # Shallow clone (fastest)
                    '--single-branch',           # Only clone one branch
                    '--no-tags',                 # Skip tags (faster)
                    '--branch', branch,
                    repo_url, 
                    str(local_path)
                ],
                capture_output=True,
                text=True,
                timeout=120  # Reduced to 2 minutes for faster feedback
            )
            
            if result.returncode != 0:
                # Try with 'master' branch if 'main' fails
                if branch == 'main':
                    print(f"[GitHubService] Retrying with 'master' branch")
                    
                    # ✅ FAANG-Level Robustness: Clean up partial directory from failed 'main' attempt
                    # Git will fail if the directory exists (even if empty)
                    if local_path.exists():
                        print(f"[GitHubService] Clearing ephemeral directory {local_path.name} before retry...")
                        self.cleanup_workspace(str(local_path))
                        
                    result = subprocess.run(
                        ['git', 'clone', '--depth', '1', '--branch', 'master', repo_url, str(local_path)],
                        capture_output=True,
                        text=True,
                        timeout=300
                    )
                
                if result.returncode != 0:
                    raise Exception(f"Git clone failed: {result.stderr}")
            
            # Verify clone succeeded
            if not local_path.exists() or not (local_path / '.git').exists():
                raise Exception("Repository clone verification failed")
            
            # Get repo info
            files_count = len(list(local_path.rglob('*')))
            size_mb = sum(f.stat().st_size for f in local_path.rglob('*') if f.is_file()) / (1024 * 1024)
            
            # ✅ PHASE 2.5: Extract rich Git metadata for "Pro" logs
            git_meta = {}
            try:
                # Get last commit info
                log_cmd = subprocess.run(
                    ['git', 'log', '-1', '--format=%h|%an|%s'],
                    cwd=str(local_path),
                    capture_output=True,
                    text=True
                )
                if log_cmd.returncode == 0:
                    hash_short, author, msg = log_cmd.stdout.strip().split('|', 2)
                    git_meta = {
                        'latest_commit': hash_short,
                        'author': author,
                        'commit_message': msg[:50] + "..." if len(msg) > 50 else msg
                    }
            except Exception as e:
                print(f"[GitHubService] Meta extraction warning: {e}")

            # ✅ PHASE 2: Real-time progress - Complete
            if progress_callback:
                await progress_callback(f"[SUCCESS] Clone complete: {files_count} files ({size_mb:.1f} MB)")
            
            return {
                'success': True,
                'repo_name': repo_name,
                'local_path': str(local_path),
                'branch': branch,
                'files_count': files_count,
                'size_mb': round(size_mb, 2),
                'git_meta': git_meta, # Return the rich metadata
                'message': f'Successfully cloned {repo_name} ({files_count} files, {size_mb:.2f}MB)'
            }
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'Clone timeout: Repository too large or network slow'
            }
        except Exception as e:
            return {
                'success': False,
                'error': f'Clone failed: {str(e)}'
            }
    
    def cleanup_workspace(self, path: Optional[str] = None):
        """Clean up cloned repositories"""
        try:
            if path:
                target = Path(path)
                if target.exists() and target.is_relative_to(self.workspace_dir):
                    shutil.rmtree(target)
            else:
                # Clean up all old repos (older than 1 hour)
                import time
                current_time = time.time()
                for item in self.workspace_dir.iterdir():
                    if item.is_dir():
                        age_hours = (current_time - item.stat().st_mtime) / 3600
                        if age_hours > 1:
                            shutil.rmtree(item)
        except Exception as e:
            print(f"[GitHubService] Cleanup warning: {e}")
    
    def get_repo_metadata(self, local_path: str) -> Dict:
        """Extract metadata from cloned repository"""
        path = Path(local_path)
        
        if not path.exists():
            raise ValueError(f'Path does not exist: {local_path}')
        
        metadata = {
            'path': local_path,
            'files': [],
            'languages': set(),
            'config_files': []
        }
        
        # Scan for important files
        important_files = [
            'package.json', 'requirements.txt', 'go.mod', 'pom.xml', 
            'Gemfile', 'Cargo.toml', 'composer.json', 'build.gradle',
            '.env.example', 'docker-compose.yml', 'Dockerfile'
        ]
        
        for file_name in important_files:
            if (path / file_name).exists():
                metadata['config_files'].append(file_name)
        
        # Detect languages
        extensions_map = {
            '.js': 'JavaScript', '.ts': 'TypeScript', '.py': 'Python',
            '.go': 'Go', '.java': 'Java', '.rb': 'Ruby', '.php': 'PHP',
            '.rs': 'Rust', '.cpp': 'C++', '.c': 'C', '.cs': 'C#'
        }
        
        for ext, lang in extensions_map.items():
            if list(path.rglob(f'*{ext}')):
                metadata['languages'].add(lang)
        
        metadata['languages'] = list(metadata['languages'])
        
        return metadata
    
    # =========================================================================
    # VIBE CODING METHODS - For Gemini Brain Code Modifications
    # =========================================================================
    
    async def get_file_content(self, repo_url: str, file_path: str, branch: str = 'main') -> str:
        """
        Read file content from GitHub repository via API
        
        Args:
            repo_url: GitHub repo URL (e.g., https://github.com/user/repo)
            file_path: Path to file within repo (e.g., src/app.js)
            branch: Branch name (default: main)
        
        Returns:
            File content as string
        """
        if not self.token:
            raise ValueError("GitHub token required for reading files")
        
        # Parse repo from URL
        parts = repo_url.rstrip('/').replace('.git', '').split('/')
        owner = parts[-2]
        repo = parts[-1]
        
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Accept': 'application/vnd.github.v3.raw'  # Get raw file content
        }
        
        url = f'{self.base_url}/repos/{owner}/{repo}/contents/{file_path}'
        params = {'ref': branch}
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
            
            if response.status_code == 200:
                return response.text
            elif response.status_code == 404:
                raise FileNotFoundError(f"File not found: {file_path}")
            else:
                raise Exception(f"GitHub API error {response.status_code}: {response.text}")
                
        except requests.Timeout:
            raise Exception("GitHub API timeout")
        except Exception as e:
            raise Exception(f"Failed to get file content: {str(e)}")
    
    async def commit_file(
        self,
        repo_url: str,
        file_path: str,
        content: str,
        message: str,
        branch: str = 'main'
    ) -> Dict:
        """
        Commit file changes to GitHub repository
        
        Args:
            repo_url: GitHub repo URL
            file_path: Path to file within repo
            content: New file content
            message: Commit message
            branch: Branch name (default: main)
        
        Returns:
            Dict with commit details (sha, url, etc.)
        """
        if not self.token:
            raise ValueError("GitHub token required for commits")
        
        import base64
        
        # Parse repo from URL
        parts = repo_url.rstrip('/').replace('.git', '').split('/')
        owner = parts[-2]
        repo = parts[-1]
        
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        url = f'{self.base_url}/repos/{owner}/{repo}/contents/{file_path}'
        
        try:
            # First, get the current file SHA (required for updates)
            get_response = requests.get(
                url,
                headers=headers,
                params={'ref': branch},
                timeout=30
            )
            
            sha = None
            if get_response.status_code == 200:
                sha = get_response.json().get('sha')
            
            # Prepare commit payload
            content_b64 = base64.b64encode(content.encode('utf-8')).decode('utf-8')
            
            payload = {
                'message': message,
                'content': content_b64,
                'branch': branch
            }
            
            if sha:
                payload['sha'] = sha  # Required for updating existing files
            
            # Create/update file
            response = requests.put(
                url,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code in [200, 201]:
                result = response.json()
                print(f"[GitHubService] Commit successful: {result.get('commit', {}).get('sha', 'unknown')[:7]}")
                return {
                    'success': True,
                    'sha': result.get('commit', {}).get('sha'),
                    'commit_url': result.get('commit', {}).get('html_url'),
                    'file_url': result.get('content', {}).get('html_url'),
                    'message': message
                }
            else:
                raise Exception(f"GitHub API error {response.status_code}: {response.text}")
                
        except requests.Timeout:
            raise Exception("GitHub API timeout")
        except Exception as e:
            raise Exception(f"Failed to commit file: {str(e)}")
    
    async def get_file_sha(self, repo_url: str, file_path: str, branch: str = 'main') -> Optional[str]:
        """Get SHA of a file (needed for updates)"""
        if not self.token:
            return None
        
        parts = repo_url.rstrip('/').replace('.git', '').split('/')
        owner = parts[-2]
        repo = parts[-1]
        
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        url = f'{self.base_url}/repos/{owner}/{repo}/contents/{file_path}'
        
        try:
            response = requests.get(url, headers=headers, params={'ref': branch}, timeout=10)
            if response.status_code == 200:
                return response.json().get('sha')
        except:
            pass
        
        return None
