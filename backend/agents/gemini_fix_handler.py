"""
Handler for applying Gemini Brain fixes
This module adds the ability to apply AI-generated fixes to failed deployments
"""

# Add this method to the OrchestratorAgent class in orchestrator.py
# Insert after line 3106 (after _normalize_repo_url method)

async def apply_gemini_fix_and_redeploy(
    self,
    deployment_id: str,
    diagnosis_dict: Dict[str, Any],
    progress_notifier: Optional[ProgressNotifier] = None
) -> Dict[str, Any]:
    """
    Apply Gemini Brain's recommended fix and trigger re-deployment
    
    Args:
        deployment_id: Original deployment ID
        diagnosis_dict: Diagnosis result from Gemini Brain
        progress_notifier: Optional progress notifier
    
    Returns:
        Dictionary with fix application result
    """
    print(f"[Orchestrator] 🤖 Applying Gemini Brain fix for deployment: {deployment_id}")
    
    try:
        # Reconstruct diagnosis from dict
        from agents.gemini_brain import DiagnosisResult
        diagnosis = DiagnosisResult(
            root_cause=diagnosis_dict.get('root_cause', ''),
            affected_files=diagnosis_dict.get('affected_files', []),
            recommended_fix=diagnosis_dict.get('recommended_fix', {}),
            confidence_score=diagnosis_dict.get('confidence_score', 0),
            error_category=diagnosis_dict.get('error_category', 'other'),
            explanation=diagnosis_dict.get('explanation', '')
        )
        
        # Get repo URL from context
        repo_url = self.project_context.get('repo_url')
        if not repo_url:
            return {
                'type': 'error',
                'content': '❌ **Cannot Apply Fix**\n\nRepository URL not found in context.',
                'timestamp': datetime.now().isoformat()
            }
        
        # Notify user we're applying the fix
        if self.safe_send and self.session_id:
            await self.safe_send(self.session_id, {
                'type': 'message',
                'data': {
                    'content': '🤖 **Applying Gemini Brain Fix...**\n\nCommitting changes to GitHub...',
                    'metadata': {'type': 'system'}
                },
                'timestamp': datetime.now().isoformat()
            })
        
        # Apply the fix via GitHub
        fix_result = await self.gemini_brain.apply_fix(
            diagnosis=diagnosis,
            repo_url=repo_url,
            branch='main'  # TODO: Make branch configurable
        )
        
        if not fix_result.get('success'):
            return {
                'type': 'error',
                'content': f'❌ **Fix Application Failed**\n\n{fix_result.get("error", "Unknown error")}',
                'timestamp': datetime.now().isoformat()
            }
        
        commit_sha = fix_result.get('commit_sha', 'unknown')
        file_path = fix_result.get('file_path', 'unknown')
        
        # Notify user of successful commit
        if self.safe_send and self.session_id:
            await self.safe_send(self.session_id, {
                'type': 'message',
                'data': {
                    'content': f'✅ **Fix Committed to GitHub**\n\n'
                               f'- File: `{file_path}`\n'
                               f'- Commit: `{commit_sha[:7]}`\n\n'
                               f'Triggering re-deployment...',
                    'metadata': {'type': 'system'}
                },
                'timestamp': datetime.now().isoformat()
            })
        
        # Trigger re-deployment
        # Get project path from context
        project_path = self.project_context.get('project_path')
        if not project_path:
            return {
                'type': 'error',
                'content': '❌ **Re-deployment Failed**\n\nProject path not found. Please clone the repository again.',
                'timestamp': datetime.now().isoformat()
            }
        
        # Re-clone the repository to get the fixed code
        print("[Orchestrator] 🔄 Re-cloning repository with fixes...")
        
        # Use the clone_and_analyze method to refresh the codebase
        clone_result = await self._handle_clone_and_analyze(
            repo_url=repo_url,
            branch='main',
            progress_notifier=progress_notifier,
            progress_callback=None,
            skip_deploy_prompt=True  # Skip asking if they want to deploy
        )
        
        if clone_result.get('type') == 'error':
            return clone_result
        
        # Now trigger deployment with the fixed code
        print("[Orchestrator] 🚀 Triggering re-deployment with fixed code...")
        
        deploy_result = await self._direct_deploy(
            progress_notifier=progress_notifier,
            progress_callback=None,
            ignore_env_check=True,  # Use existing env vars
            explicit_env_vars=self.project_context.get('env_vars', {})
        )
        
        return deploy_result
    
    except Exception as e:
        print(f"[Orchestrator] ❌ Gemini fix application failed: {e}")
        import traceback
        traceback.print_exc()
        
        return {
            'type': 'error',
            'content': f'❌ **Fix Application Failed**\n\n{str(e)}',
            'timestamp': datetime.now().isoformat()
        }
