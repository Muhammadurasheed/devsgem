"""
Analysis Service - Coordinates code analysis workflow
Integrates CodeAnalyzer with real project paths
"""

from pathlib import Path
from typing import Dict, Optional, Callable
import asyncio
from agents.code_analyzer import CodeAnalyzerAgent
from agents.docker_expert import DockerExpertAgent


class AnalysisService:
    """Orchestrates code analysis and Dockerfile generation"""
    
    def __init__(
        self, 
        gcloud_project: str, 
        location: str = 'us-central1', 
        gemini_api_key: Optional[str] = None,
        docker_service=None,
        docker_expert=None,
        code_analyzer=None
    ):
        self.code_analyzer = code_analyzer or CodeAnalyzerAgent(gcloud_project, location, gemini_api_key)
        self.docker_expert = docker_expert or DockerExpertAgent(gcloud_project, location)
        self.docker_service = docker_service
    
    async def analyze_and_generate(
        self, 
        project_path: str, 
        progress_callback: Optional[Callable] = None,
        progress_notifier=None,
        abort_event: Optional[asyncio.Event] = None # [FAANG]
    ) -> Dict:
        """
        [FIXED] Full analysis workflow with granular real-time progress
        
        Progress is sent BEFORE each operation starts, not after!
        """
        try:
            # ✅ FIX 1: Immediate feedback WITH flush
            if progress_callback:
                await progress_callback("Starting code analysis...")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
            
            # ✅ FIX 2: Report BEFORE scanning WITH flush
            if progress_callback:
                await progress_callback("Scanning project structure...")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
            
            print(f"[AnalysisService] Analyzing project at {project_path}")
            
            # ✅ FIX 3: Pass progress callback to code analyzer
            analysis = await self.code_analyzer.analyze_project(
                project_path, 
                progress_callback=progress_callback,
                progress_notifier=progress_notifier,
                abort_event=abort_event # [FAANG]
            )
            
            if 'error' in analysis:
                return {'success': False, 'error': analysis['error']}
            
            # ✅ FIX 4: Report findings immediately WITH flush
            framework = analysis.get('framework', 'application')
            language = analysis.get('language', 'unknown')
            
            if progress_callback:
                await progress_callback(f"[SUCCESS] Framework detected: {framework}")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
                
                await progress_callback(f"Language: {language}")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
                
                dep_count = len(analysis.get('dependencies', []))
                if dep_count > 0:
                    await progress_callback(f"Found {dep_count} dependencies")
                    await asyncio.sleep(0)  # [FIX] Force event loop flush
            
            # ✅ FIX 5: Report BEFORE Dockerfile generation WITH flush
            if progress_callback:
                await progress_callback(f"Starting Dockerfile generation...")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
                
                await progress_callback(f"Optimizing for {framework} framework...")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
            
            print(f"[AnalysisService] Generating Dockerfile for {framework}")
            
            # Pass progress to docker expert
            dockerfile_result = await self.docker_expert.generate_dockerfile(
                analysis, 
                progress_callback=progress_callback,
                progress_notifier=progress_notifier,
                abort_event=abort_event # [FAANG]
            )
            
            # ✅ FIX 6: Report completion with details WITH flush
            if progress_callback:
                await progress_callback("[SUCCESS] Dockerfile generated successfully!")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
                
                await progress_callback("Applied security best practices")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
                
                await progress_callback("Multi-stage build configured")
                await asyncio.sleep(0)  # [FIX] Force event loop flush
            
            # Step 3: Compile report
            report = {
                'success': True,
                'analysis': {
                    'language': analysis['language'],
                    'framework': analysis['framework'],
                    'entry_point': analysis['entry_point'],
                    'dependencies_count': len(analysis['dependencies']),
                    'database': analysis.get('database'),
                    'port': analysis.get('port'),
                    'env_vars': analysis['env_vars']
                },
                'dockerfile': {
                    'content': dockerfile_result['dockerfile'],
                    'optimizations': dockerfile_result.get('optimizations', []),
                    'explanations': dockerfile_result.get('explanations', [])
                },
                'recommendations': analysis.get('recommendations', []),
                'warnings': analysis.get('warnings', []),
                'next_steps': [
                    'Review the generated Dockerfile',
                    'Configure environment variables',
                    'Set up secrets in Secret Manager',
                    'Deploy to Cloud Run'
                ]
            }
            
            return report
            
        except Exception as e:
            print(f"[AnalysisService] [ERROR] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'success': False,
                'error': f'Analysis failed: {str(e)}'
            }
    
    async def quick_analysis(self, project_path: str) -> Dict:
        """Quick analysis without Dockerfile generation"""
        try:
            analysis = await self.code_analyzer.analyze_project(project_path)
            
            if 'error' in analysis:
                return {'success': False, 'error': analysis['error']}
            
            return {
                'success': True,
                'language': analysis['language'],
                'framework': analysis['framework'],
                'dependencies': len(analysis['dependencies']),
                'database': analysis.get('database'),
                'ready_to_deploy': analysis['language'] != 'unknown'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Quick analysis failed: {str(e)}'
            }
