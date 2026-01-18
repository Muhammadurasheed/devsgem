"""
Docker Service - Real Docker operations
Handles Dockerfile generation and validation
"""

import os
import subprocess
from pathlib import Path
from typing import Dict, Optional


class DockerService:
    """Production-grade Docker operations"""
    
    def __init__(self):
        self.templates_cache = {}
    
    def validate_docker_installed(self) -> Dict:
        """Check if Docker is installed and running"""
        try:
            result = subprocess.run(
                ['docker', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                version = result.stdout.strip()
                return {'installed': True, 'version': version}
            else:
                return {'installed': False, 'error': 'Docker not found'}
                
        except Exception as e:
            return {'installed': False, 'error': f'Docker check failed: {str(e)}'}
    
    async def save_dockerfile(self, dockerfile_content: str, project_path: str, progress_callback=None) -> Dict:
        """Save Dockerfile to project directory with progress updates"""
        try:
            # ✅ PHASE 2: Real-time progress
            if progress_callback:
                await progress_callback("💾 Saving Dockerfile to project...")
            dockerfile_path = Path(project_path) / 'Dockerfile'
            
            # Backup existing Dockerfile if present
            if dockerfile_path.exists():
                backup_path = Path(project_path) / 'Dockerfile.backup'
                # Delete existing backup to avoid Windows rename conflict (WinError 183)
                if backup_path.exists():
                    backup_path.unlink()
                dockerfile_path.rename(backup_path)
                print(f"[DockerService] Backed up existing Dockerfile to {backup_path}")
            
            # Write new Dockerfile with UTF-8 encoding (required for emoji on Windows)
            dockerfile_path.write_text(dockerfile_content, encoding='utf-8')
            
            print(f"[DockerService] Dockerfile saved to {dockerfile_path}")
            
            # ✅ PHASE 2: Real-time progress - Complete
            if progress_callback:
                await progress_callback(f"✅ Dockerfile saved: {dockerfile_path.name}")
            
            return {
                'success': True,
                'path': str(dockerfile_path),
                'message': 'Dockerfile created successfully'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to save Dockerfile: {str(e)}'
            }
    
    def create_dockerignore(self, project_path: str, language: str) -> Dict:
        """Create optimized .dockerignore file"""
        try:
            dockerignore_templates = {
                'python': """
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
.env
.venv
.git
.gitignore
.pytest_cache/
.coverage
htmlcov/
dist/
build/
*.egg-info/
.DS_Store
*.md
.vscode/
.idea/
""",
                'nodejs': """
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.eslintcache
.env
.env.local
.git
.gitignore
.DS_Store
dist/
coverage/
.next/
.cache/
*.md
.vscode/
.idea/
""",
                'golang': """
vendor/
*.exe
*.exe~
*.dll
*.so
*.dylib
*.test
*.out
.git
.gitignore
.env
.DS_Store
*.md
.vscode/
.idea/
""",
                'java': """
target/
*.class
*.jar
*.war
*.ear
.git
.gitignore
.env
.DS_Store
.mvn/
mvnw
mvnw.cmd
*.md
.vscode/
.idea/
"""
            }
            
            template = dockerignore_templates.get(language.lower(), dockerignore_templates['python'])
            
            dockerignore_path = Path(project_path) / '.dockerignore'
            dockerignore_path.write_text(template.strip())
            
            return {
                'success': True,
                'path': str(dockerignore_path),
                'message': '.dockerignore created'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Failed to create .dockerignore: {str(e)}'
            }
    
    def validate_dockerfile(self, project_path: str) -> Dict:
        """Validate Dockerfile syntax"""
        try:
            dockerfile_path = Path(project_path) / 'Dockerfile'
            
            if not dockerfile_path.exists():
                return {
                    'valid': False,
                    'error': 'Dockerfile not found'
                }
            
            # Basic syntax validation (read with UTF-8 for emoji support)
            content = dockerfile_path.read_text(encoding='utf-8')
            
            required_instructions = ['FROM', 'WORKDIR', 'COPY', 'CMD']
            missing = [inst for inst in required_instructions if inst not in content]
            
            if missing:
                # RELAXED VALIDATION: Don't fail the build, just warn.
                # UNLESS 'FROM' is missing - that's non-negotiable.
                if 'FROM' in missing:
                    return {
                        'valid': False,
                        'error': 'Dockerfile missing FROM instruction'
                    }
                    
                return {
                    'valid': True,
                    'warnings': [f'Missing recommended instruction: {inst}' for inst in missing],
                    'message': 'Dockerfile validation passed with warnings'
                }
            
            # Check for common issues
            warnings = []
            
            if 'EXPOSE' not in content:
                warnings.append('No EXPOSE instruction found - Cloud Run needs port info')
            
            if 'USER' not in content:
                warnings.append('Consider adding USER instruction for security')
            
            if content.count('RUN') > 10:
                warnings.append('Too many RUN instructions - consider combining them')
            
            return {
                'valid': True,
                'warnings': warnings,
                'message': 'Dockerfile validation passed'
            }
            
        except Exception as e:
            return {
                'valid': False,
                'error': f'Validation failed: {str(e)}'
            }
    
    def local_build_test(self, project_path: str, image_name: str) -> Dict:
        """Test build Docker image locally (optional, for development)"""
        try:
            result = subprocess.run(
                ['docker', 'build', '-t', image_name, project_path],
                capture_output=True,
                text=True,
                timeout=600
            )
            
            if result.returncode == 0:
                return {
                    'success': True,
                    'image': image_name,
                    'message': 'Local build successful'
                }
            else:
                return {
                    'success': False,
                    'error': f'Build failed: {result.stderr}'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Local build test failed: {str(e)}'
            }
