"""
Gemini Brain Agent - Autonomous Engineering Partner
Powered by Gemini 3 Pro Preview

Capabilities:
- Autonomous error detection from deployment logs
- Root cause diagnosis using advanced reasoning
- Automatic code fix generation
- GitHub integration for applying fixes
- Self-healing deployment workflows

بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
"""

import asyncio
import json
import re
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

import vertexai
from vertexai.generative_models import GenerativeModel, Part
import google.generativeai as genai


class DiagnosisResult:
    """Structured diagnosis result from Gemini Brain"""
    
    def __init__(
        self,
        root_cause: str,
        affected_files: List[str],
        recommended_fix: Dict[str, Any],
        confidence_score: int,
        error_category: str,
        explanation: str
    ):
        self.root_cause = root_cause
        self.affected_files = affected_files
        self.recommended_fix = recommended_fix
        self.confidence_score = confidence_score  # 0-100
        self.error_category = error_category
        self.explanation = explanation
    
    def to_dict(self) -> Dict:
        return {
            'root_cause': self.root_cause,
            'affected_files': self.affected_files,
            'recommended_fix': self.recommended_fix,
            'confidence_score': self.confidence_score,
            'error_category': self.error_category,
            'explanation': self.explanation
        }


class GeminiBrainAgent:
    """
    Autonomous Engineering Partner powered by Gemini 3 Pro Preview
    
    This agent can:
    1. Detect deployment failures from logs
    2. Diagnose root causes using deep code analysis
    3. Generate precise code fixes
    4. Apply fixes via GitHub commits
    5. Trigger re-deployments automatically
    """
    
    def __init__(
        self,
        gcloud_project: str,
        github_service=None,
        location: str = 'us-central1',
        gemini_api_key: Optional[str] = None
    ):
        """
        Initialize Gemini Brain with Vertex AI and optional Gemini API fallback
        
        Args:
            gcloud_project: Google Cloud project ID
            github_service: GitHubService instance for code modifications
            location: GCP region
            gemini_api_key: Optional Gemini API key for fallback
        """
        self.gcloud_project = gcloud_project
        self.github_service = github_service
        self.location = location
        
        # [DEBUG] Deep inspection of location string
        print(f"[GeminiBrain] DEBUG: project={repr(gcloud_project)} location={repr(location)} type={type(location)}")
        if isinstance(location, str):
            print(f"[GeminiBrain] HEX: {' '.join(hex(ord(c)) for c in location)}")

        # Initialize Vertex AI (primary)
        try:
            vertexai.init(project=gcloud_project, location=location)
        except Exception as e:
            # [FAANG] Resilience Pattern: If init fails (e.g. spurious region validation), 
            # assume global initialization from app.py startup is sufficient and proceed.
            print(f"[GeminiBrain] ⚠️ WARN: vertexai.init failed: {e}")
            print(f"[GeminiBrain] 🛡️ Proceeding with reliance on Global Orchestrator initialization.")
            
        # [SUCCESS] GEMINI 3 MIGRATION: Using gemini-3-pro-preview as mandated
        try:
            self.model = GenerativeModel('gemini-3-pro-preview')
        except Exception as ex:
             print(f"[GeminiBrain] CRITICAL: Failed to load model: {ex}")
             # If completely broken, we might rely on fallback only, but let's see.
             # We don't raise here to allow Fallback logic (Gemini API) to take over below.
        
        # Initialize Gemini API (fallback)
        self.gemini_api_key = gemini_api_key
        if gemini_api_key:
            genai.configure(api_key=gemini_api_key)
            # Use Gemini 3 Pro Preview for fallback too if available, otherwise Flash
            try:
                self.fallback_model = genai.GenerativeModel('gemini-3-pro-preview')
            except:
                print("[GeminiBrain] Gemini 3 Preview not available via API key, falling back to Flash")
                self.fallback_model = genai.GenerativeModel('gemini-2.0-flash-001')
        else:
            self.fallback_model = None
        
        print(f"[GeminiBrain] Initialized with Gemini 3 Pro Preview (Mode: {'Active' if self.gemini_api_key else 'Vertex-Only'})")
    
    async def detect_and_diagnose(
        self,
        deployment_id: str,
        error_logs: List[str],
        project_path: str,
        repo_url: str,
        language: str = 'unknown',
        framework: str = 'unknown',
        abort_event: Optional[asyncio.Event] = None # [FAANG]
    ) -> DiagnosisResult:
        """
        Analyze deployment failure with [FAANG] Resilience:
        - Exponential Backoff for 429s
        - Fallback Chain: Vertex Pro -> Vertex Flash -> Gemini API
        """
        print(f"[GeminiBrain] 🧠 Analyzing deployment failure: {deployment_id}")
        
        # Emit thoughts if possible
        print(f"[GeminiBrain] [THOUGHT] Ingesting catastrophic failure vectors... isolating traceback segments.")
        print(f"[GeminiBrain] [THOUGHT] Correlating error patterns with known framework-specific anti-patterns.")
        
        # Extract key error patterns
        error_summary = self._extract_error_patterns(error_logs)
        
        # Read relevant source files
        source_context = await self._gather_source_context(
            project_path,
            error_summary,
            language
        )
        
        # Use Gemini 3 Pro Preview for deep analysis
        diagnosis_prompt = self._build_diagnosis_prompt(
            error_logs=error_logs,
            error_summary=error_summary,
            source_context=source_context,
            language=language,
            framework=framework,
            repo_url=repo_url
        )
        
        # [FAANG] Emergency Abort Check
        if abort_event and abort_event.is_set():
            raise Exception("Diagnosis aborted by user")

        diagnosis_text = ""
        
        # [FAANG] RESILIENCE CHAIN
        # 1. Primary: Vertex AI Gemini 3 Pro (The Brain)
        try:
            print("[GeminiBrain] ⚡ Attempting Primary Model: Gemini 3 Pro (Vertex)...")
            response = await self._call_with_retry(self.model.generate_content_async, diagnosis_prompt)
            diagnosis_text = response.text
        except Exception as e_primary:
            print(f"[GeminiBrain] ⚠️ Primary Model Failed: {e_primary}")
            
            # 2. Secondary: Vertex AI Flash (The Speedster) - Higher QPS
            try:
                print("[GeminiBrain] 🔄 Falling back to Secondary: Gemini 2.0 Flash (Vertex)...")
                flash_model = GenerativeModel('gemini-2.0-flash-001')
                response = await self._call_with_retry(flash_model.generate_content_async, diagnosis_prompt)
                diagnosis_text = response.text
            except Exception as e_secondary:
                 print(f"[GeminiBrain] ⚠️ Secondary Model Failed: {e_secondary}")
                 
                 # 3. Tertiary: Gemini API (The Safety Net) - Different Quota
                 if self.fallback_model:
                     try:
                        print("[GeminiBrain] 🛡️ Falling back to Tertiary: Gemini API...")
                        response = await self._call_with_retry(self.fallback_model.generate_content_async, diagnosis_prompt)
                        diagnosis_text = response.text
                     except Exception as e_tertiary:
                         print(f"[GeminiBrain] ❌ All models failed.")
                         raise Exception(f"Brain Shutdown. Last error: {e_tertiary}")
                 else:
                     raise e_secondary

        # Parse structured diagnosis
        diagnosis = self._parse_diagnosis(diagnosis_text)
        
        print(f"[GeminiBrain] ✅ Diagnosis complete:")
        print(f"  Root Cause: {diagnosis.root_cause}")
        print(f"  Confidence: {diagnosis.confidence_score}%")
        
        return diagnosis

    async def _call_with_retry(self, func, *args, **kwargs):
        """Exponential Backoff Retry Logic"""
        max_retries = 3
        base_delay = 2
        
        for attempt in range(max_retries):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                # Check for 429 or 503
                error_str = str(e).lower()
                if "429" in error_str or "quota" in error_str or "overloaded" in error_str:
                    if attempt == max_retries - 1:
                        raise e
                    
                    wait_time = base_delay * (2 ** attempt) + (0.1 * attempt) # Jitter
                    print(f"[GeminiBrain] ⏳ Rate Limited. Sleeping {wait_time:.1f}s (Attempt {attempt+1}/{max_retries})...")
                    await asyncio.sleep(wait_time)
                else:
                    raise e

    
    def _extract_error_patterns(self, error_logs: List[str]) -> Dict[str, Any]:
        """
        Extract key error patterns from logs
        
        Returns:
            Dictionary with categorized errors
        """
        patterns = {
            'mongodb_dns': r'querySrv ENOTFOUND.*mongodb',
            'npm_lockfile': r'npm ci.*package-lock\.json',
            'port_binding': r'(EADDRINUSE|failed to listen|bind.*port)',
            'env_var_missing': r'(undefined|not defined|missing.*variable)',
            'import_error': r'(ImportError|ModuleNotFoundError|Cannot find module)',
            'syntax_error': r'(SyntaxError|Unexpected token)',
            'connection_refused': r'(ECONNREFUSED|connection refused)',
            'timeout': r'(timeout|timed out)',
        }
        
        detected_errors = {}
        primary_error = None
        
        for log_line in error_logs:
            for error_type, pattern in patterns.items():
                if re.search(pattern, log_line, re.IGNORECASE):
                    if error_type not in detected_errors:
                        detected_errors[error_type] = []
                    detected_errors[error_type].append(log_line)
                    if not primary_error:
                        primary_error = error_type
        
        return {
            'primary_error': primary_error,
            'detected_patterns': detected_errors,
            'full_logs': error_logs[-50:]  # Last 50 lines
        }
    
    async def _gather_source_context(
        self,
        project_path: str,
        error_summary: Dict,
        language: str
    ) -> Dict[str, str]:
        """
        Read relevant source files based on error type
        
        Returns:
            Dictionary mapping file paths to their contents
        """
        context = {}
        project_path_obj = Path(project_path)
        
        # Determine which files to read based on error type
        primary_error = error_summary.get('primary_error')
        
        if primary_error == 'mongodb_dns':
            # Read database connection files
            candidates = [
                'server.js', 'app.js', 'index.js', 'main.js',
                'server.ts', 'app.ts', 'index.ts', 'main.ts',
                'app.py', 'main.py', 'server.py',
                'config/database.js', 'config/db.js',
                'src/config/database.ts', 'src/config/db.ts'
            ]
        elif primary_error == 'npm_lockfile':
            # Read package.json
            candidates = ['package.json', 'package-lock.json']
        elif primary_error == 'port_binding':
            # Read server entry points
            candidates = [
                'server.js', 'app.js', 'index.js', 'main.js',
                'server.ts', 'app.ts', 'index.ts', 'main.ts',
                'app.py', 'main.py'
            ]
        else:
            # Default: Read main entry points
            if language == 'python':
                candidates = ['app.py', 'main.py', 'server.py', 'requirements.txt']
            elif language in ['node', 'nodejs', 'javascript', 'typescript']:
                candidates = ['package.json', 'server.js', 'app.js', 'index.js', 'main.ts']
            else:
                candidates = ['main.go', 'server.go', 'app.go']
        
        # Read files
        for candidate in candidates:
            file_path = project_path_obj / candidate
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        context[candidate] = content[:5000]  # Limit to 5000 chars per file
                        print(f"[GeminiBrain] 📄 Read {candidate} ({len(content)} bytes)")
                except Exception as e:
                    print(f"[GeminiBrain] ⚠️ Could not read {candidate}: {e}")
        
        return context
    
    def _build_diagnosis_prompt(
        self,
        error_logs: List[str],
        error_summary: Dict,
        source_context: Dict[str, str],
        language: str,
        framework: str,
        repo_url: str
    ) -> str:
        """Build comprehensive diagnosis prompt for Gemini"""
        
        logs_text = '\n'.join(error_logs[-30:])  # Last 30 lines
        
        source_files_text = ""
        for file_path, content in source_context.items():
            source_files_text += f"\n\n### {file_path}\n```\n{content}\n```"
        
        prompt = f"""You are an expert DevOps engineer analyzing a deployment failure.

**Deployment Context:**
- Repository: {repo_url}
- Language: {language}
- Framework: {framework}
- Primary Error Type: {error_summary.get('primary_error', 'unknown')}

**Error Logs:**
```
{logs_text}
```

**Source Code:**
{source_files_text}

**Your Task:**
Analyze the error logs and source code to:
1. Identify the ROOT CAUSE of the deployment failure
2. Determine which file(s) are causing the issue
3. Generate a precise code fix
4. Provide a confidence score (0-100)

**Response Format (JSON):**
{{
  "root_cause": "Brief description of the root cause",
  "error_category": "mongodb_connection|npm_install|port_binding|env_vars|import_error|syntax_error|other",
  "affected_files": ["path/to/file1.js", "path/to/file2.js"],
  "confidence_score": 85,
  "explanation": "Detailed explanation of why this is failing",
  "recommended_fix": {{
    "file_path": "path/to/file.js",
    "changes": [
      {{
        "line_start": 42,
        "line_end": 45,
        "old_content": "mongoose.connect(process.env.MONGODB_URI)",
        "new_content": "mongoose.connect(process.env.MONGODB_URI, {{ useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 5000 }}).catch(err => {{ console.error('MongoDB connection error:', err); process.exit(1); }})",
        "reason": "Add connection options and error handling"
      }}
    ]
  }}
}}

Think step-by-step and provide a surgical fix that will resolve this deployment failure.
"""
        
        return prompt
    
    def _parse_diagnosis(self, diagnosis_text: str) -> DiagnosisResult:
        """Parse Gemini's diagnosis response into structured format"""
        
        try:
            # Extract JSON from response (handle markdown code blocks)
            if '```json' in diagnosis_text:
                json_str = diagnosis_text.split('```json')[1].split('```')[0].strip()
            elif '```' in diagnosis_text:
                json_str = diagnosis_text.split('```')[1].split('```')[0].strip()
            else:
                json_str = diagnosis_text.strip()
            
            data = json.loads(json_str)
            
            return DiagnosisResult(
                root_cause=data.get('root_cause', 'Unknown error'),
                affected_files=data.get('affected_files', []),
                recommended_fix=data.get('recommended_fix', {}),
                confidence_score=data.get('confidence_score', 50),
                error_category=data.get('error_category', 'other'),
                explanation=data.get('explanation', '')
            )
        
        except Exception as e:
            print(f"[GeminiBrain] ⚠️ Failed to parse diagnosis: {e}")
            print(f"[GeminiBrain] Raw response: {diagnosis_text[:500]}")
            
            # Fallback: Create a basic diagnosis from the text
            return DiagnosisResult(
                root_cause="Failed to parse diagnosis (see explanation)",
                affected_files=[],
                recommended_fix={},
                confidence_score=30,
                error_category='other',
                explanation=diagnosis_text[:1000]
            )
    
    async def apply_fix(
        self,
        diagnosis: DiagnosisResult,
        repo_url: str,
        branch: str = 'main'
    ) -> Dict[str, Any]:
        """
        Apply the recommended fix by committing to GitHub
        
        Args:
            diagnosis: DiagnosisResult with recommended fix
            repo_url: GitHub repository URL
            branch: Branch to commit to
        
        Returns:
            Dictionary with commit details
        """
        if not self.github_service:
            raise Exception("GitHub service not configured")
        
        if not diagnosis.recommended_fix:
            raise Exception("No fix recommended in diagnosis")
        
        print(f"[GeminiBrain] 🔧 Applying fix to {repo_url}")
        
        fix = diagnosis.recommended_fix
        file_path = fix.get('file_path')
        changes = fix.get('changes', [])
        
        if not file_path or not changes:
            raise Exception("Invalid fix format: missing file_path or changes")
        
        # Read current file content from GitHub
        try:
            current_content = await self.github_service.get_file_content(
                repo_url,
                file_path,
                branch
            )
        except Exception as e:
            raise Exception(f"Failed to read {file_path} from GitHub: {e}")
        
        # Apply changes
        modified_content = current_content
        for change in changes:
            old_content = change.get('old_content', '')
            new_content = change.get('new_content', '')
            
            if old_content in modified_content:
                modified_content = modified_content.replace(old_content, new_content, 1)
                print(f"[GeminiBrain] ✅ Applied change: {change.get('reason', 'No reason provided')}")
            else:
                print(f"[GeminiBrain] ⚠️ Could not find old content to replace")
        
        # Commit to GitHub
        commit_message = f"🤖 Gemini Brain: Fix {diagnosis.error_category}\n\n{diagnosis.root_cause}"
        
        try:
            commit_result = await self.github_service.commit_file(
                repo_url=repo_url,
                file_path=file_path,
                content=modified_content,
                message=commit_message,
                branch=branch
            )
            
            print(f"[GeminiBrain] ✅ Committed fix to GitHub")
            print(f"  Commit SHA: {commit_result.get('sha', 'unknown')}")
            
            return {
                'success': True,
                'commit_sha': commit_result.get('sha'),
                'commit_message': commit_message,
                'file_path': file_path,
                'changes_applied': len(changes)
            }
        
        except Exception as e:
            raise Exception(f"Failed to commit fix to GitHub: {e}")
    
    # =========================================================================
    # VIBE CODING - Natural Language Code Modification
    # =========================================================================
    
    async def vibe_code_request(
        self,
        user_request: str,
        project_path: str,
        repo_url: str,
        target_file: Optional[str] = None,
        branch: str = 'main'
    ) -> Dict[str, Any]:
        """
        Process natural language code modification request (VIBE CODING)
        
        Examples:
        - "Change the background color to blue"
        - "Make the logo spin"
        - "Add a loading state"
        - "Fix the hover effect"
        
        Args:
            user_request: Natural language request
            project_path: Local path to repo
            repo_url: GitHub repo URL
            target_file: Optional specific file to modify
            branch: Git branch
        
        Returns:
            Dict with proposed changes or applied commit
        """
        print(f"[GeminiBrain] Vibe coding request: {user_request}")
        
        # Gather source context
        source_files = await self._gather_vibe_context(project_path, target_file)
        
        # Build prompt for code modification
        vibe_prompt = f"""You are an expert full-stack developer. The user wants to make this change:

"{user_request}"

Here are the relevant source files from the project:

{source_files}

Analyze the request and provide a response in this exact JSON format:
{{
    "understood": true/false,
    "file_path": "path/to/file.ext",
    "original_code": "the exact lines to replace",
    "modified_code": "the new replacement code",
    "explanation": "what this change does",
    "confidence": 0-100
}}

Rules:
- Identify the most appropriate file to modify based on the request
- The original_code MUST be an exact match from the source
- The modified_code should implement the user's request
- If modifying CSS, prefer CSS custom properties
- If unsure which file, set understood to false and explain

Respond ONLY with the JSON, no additional text."""

        try:
            response = await self.model.generate_content_async(vibe_prompt)
            result_text = response.text
            
            # Parse JSON response
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
                
                if result.get('understood') and result.get('confidence', 0) >= 70:
                    print(f"[GeminiBrain] Vibe coding: {result['explanation']}")
                    return {
                        'success': True,
                        'file_path': result['file_path'],
                        'original_code': result['original_code'],
                        'modified_code': result['modified_code'],
                        'explanation': result['explanation'],
                        'confidence': result['confidence']
                    }
                else:
                    return {
                        'success': False,
                        'reason': 'Low confidence or unclear request',
                        'explanation': result.get('explanation', 'Could not understand the request')
                    }
            else:
                raise ValueError("No valid JSON in response")
                
        except Exception as e:
            print(f"[GeminiBrain] Vibe coding failed: {e}")
            return {
                'success': False,
                'reason': str(e)
            }
    
    async def _gather_vibe_context(self, project_path: str, target_file: Optional[str] = None) -> str:
        """Gather relevant files for vibe coding context"""
        path = Path(project_path)
        relevant_files = []
        
        # Priority extensions for UI changes
        ui_extensions = ['.tsx', '.jsx', '.css', '.scss', '.html', '.vue', '.svelte']
        
        if target_file:
            target_path = path / target_file
            if target_path.exists():
                content = target_path.read_text(encoding='utf-8', errors='ignore')
                relevant_files.append(f"### {target_file}\n```\n{content[:3000]}\n```")
        else:
            # Find relevant files
            for ext in ui_extensions:
                for file_path in path.rglob(f'*{ext}'):
                    if 'node_modules' in str(file_path) or '.git' in str(file_path):
                        continue
                    content = file_path.read_text(encoding='utf-8', errors='ignore')
                    rel_path = file_path.relative_to(path)
                    relevant_files.append(f"### {rel_path}\n```\n{content[:2000]}\n```")
                    if len(relevant_files) >= 10:
                        break
                if len(relevant_files) >= 10:
                    break
        
        return '\n\n'.join(relevant_files) if relevant_files else "No relevant files found"
    
    # =========================================================================
    # VISION DEBUGGING - Screenshot Analysis
    # =========================================================================
    
    async def analyze_screenshot(
        self,
        image_data: bytes,
        project_path: str,
        user_description: str = ""
    ) -> DiagnosisResult:
        """
        Analyze UI screenshot and detect issues using Gemini Vision
        
        Args:
            image_data: Screenshot image bytes (PNG/JPEG)
            project_path: Local path to the project
            user_description: Optional description of the issue
        
        Returns:
            DiagnosisResult with UI fixes
        """
        print(f"[GeminiBrain] Analyzing screenshot with vision...")
        
        # Gather CSS/styling context
        style_context = await self._gather_style_context(project_path)
        
        vision_prompt = f"""You are a senior frontend developer with expertise in UI debugging.

Analyze this screenshot of a web application and identify any visual issues or bugs.

User's description: {user_description if user_description else 'No specific issue mentioned'}

Here is the relevant CSS/styling code from the project:

{style_context}

Provide your analysis in this JSON format:
{{
    "issues_found": [
        {{
            "description": "what's wrong",
            "severity": "high/medium/low",
            "css_fix": "the CSS fix if applicable"
        }}
    ],
    "root_cause": "main issue summary",
    "affected_file": "path/to/style.css or component.tsx",
    "fix_code": "complete fixed code",
    "confidence": 0-100
}}

Respond ONLY with JSON."""

        try:
            # Use vision model with image
            from vertexai.generative_models import Part
            
            image_part = Part.from_data(image_data, mime_type="image/png")
            response = await self.model.generate_content_async([vision_prompt, image_part])
            result_text = response.text
            
            # Parse response
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                result = json.loads(json_match.group())
                
                return DiagnosisResult(
                    root_cause=result.get('root_cause', 'UI issue detected'),
                    affected_files=[result.get('affected_file', 'styles.css')],
                    recommended_fix={
                        'file_path': result.get('affected_file'),
                        'changes': [{'original': '', 'modified': result.get('fix_code', '')}]
                    },
                    confidence_score=result.get('confidence', 70),
                    error_category='ui_visual',
                    explanation=str(result.get('issues_found', []))
                )
            else:
                raise ValueError("No valid JSON in vision response")
                
        except Exception as e:
            print(f"[GeminiBrain] Vision analysis failed: {e}")
            return DiagnosisResult(
                root_cause=f"Vision analysis failed: {e}",
                affected_files=[],
                recommended_fix={},
                confidence_score=0,
                error_category='error',
                explanation=str(e)
            )
    
    async def _gather_style_context(self, project_path: str) -> str:
        """Gather CSS and styling files for context"""
        path = Path(project_path)
        style_files = []
        style_extensions = ['.css', '.scss', '.sass', '.less']
        
        for ext in style_extensions:
            for file_path in path.rglob(f'*{ext}'):
                if 'node_modules' in str(file_path):
                    continue
                content = file_path.read_text(encoding='utf-8', errors='ignore')
                rel_path = file_path.relative_to(path)
                style_files.append(f"### {rel_path}\n```css\n{content[:2000]}\n```")
                if len(style_files) >= 5:
                    break
        
        return '\n\n'.join(style_files) if style_files else "No style files found"

    async def vibe_code_request(
        self,
        user_request: str,
        project_path: str,
        repo_url: str,
        branch: str = 'main',
        abort_event: Optional[asyncio.Event] = None # [FAANG]
    ) -> Dict[str, Any]:
        """
        Process natural language code modification request using Gemini 3 Vibe Coding.
        Returns suggested changes and explanation.
        """
        print(f"[GeminiBrain] 🔮 Vibe Coding Request: {user_request}")
        
        prompt = f"""
        You are an expert AI software engineer participating in 'Vibe Coding'.
        User Request: "{user_request}"
        
        Project Context:
        We are working on a repo at {repo_url} (branch: {branch}).
        
        Your Goal:
        1. Understand the user's intent (e.g., "Change background to blue", "Fix the login bug").
        2. Identify which file(s) likely need changing.
        3. Generate the specific code changes.
        
        Output JSON format:
        {{
            "thought_process": "Analysis of what needs changing...",
            "target_file": "path/to/file.ext",
            "operation": "modify" | "create" | "delete",
            "code_change": "The fully valid replacement code or new code.",
            "explanation": "Brief user-facing explanation of the change"
        }}
        
        If you need more context (e.g., file contents) to be sure, return:
        {{
            "operation": "needs_context",
            "target_file": "path/to/file.ext",
            "explanation": "I need to read this file to apply the fix."
        }}
        """
        
        try:
            response = await self.model.generate_content_async(prompt)
            result = response.text
            # Clean markdown code blocks if present
            if "```json" in result:
                result = result.split("```json")[1].split("```")[0].strip()
            elif "```" in result:
                result = result.split("```")[0].strip()
                
            import json
            return json.loads(result)
        except Exception as e:
            print(f"[GeminiBrain] Vibe Coding Error: {e}")
            return {
                "operation": "error",
                "explanation": f"Failed to generate code change: {str(e)}"
            }


# Test Gemini Brain
async def test_gemini_brain():
    """Test the Gemini Brain agent with a sample error"""
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    gcloud_project = os.getenv('GOOGLE_CLOUD_PROJECT')
    gemini_api_key = os.getenv('GEMINI_API_KEY')
    
    brain = GeminiBrainAgent(
        gcloud_project=gcloud_project,
        gemini_api_key=gemini_api_key
    )
    
    # Sample MongoDB error logs
    error_logs = [
        "[INFO] Starting application...",
        "[ERROR] Error connecting to MongoDB: querySrv ENOTFOUND _mongodb._tcp.cluster0.skefzri.mongodb.net",
        "[ERROR] MongooseServerSelectionError: querySrv ENOTFOUND _mongodb._tcp.cluster0.skefzri.mongodb.net",
        "[WARNING] Container called exit(1)"
    ]
    
    # Sample source code
    project_path = "/tmp/test_repo"
    os.makedirs(project_path, exist_ok=True)
    
    server_js = """
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI);

const app = express();
app.listen(8080);
"""
    
    with open(f"{project_path}/server.js", 'w') as f:
        f.write(server_js)
    
    # Run diagnosis
    diagnosis = await brain.detect_and_diagnose(
        deployment_id="test-001",
        error_logs=error_logs,
        project_path=project_path,
        repo_url="https://github.com/test/repo",
        language="nodejs",
        framework="express"
    )
    
    print("\n" + "="*60)
    print("DIAGNOSIS RESULT:")
    print("="*60)
    print(json.dumps(diagnosis.to_dict(), indent=2))


if __name__ == "__main__":
    asyncio.run(test_gemini_brain())
