"""
Gemini 3 API Function Declarations
Compatible format for google-generativeai library
✅ Updated for Gemini 3 Hackathon (gemini-2.5-flash)
"""

def get_gemini_api_tools():
    """Get function declarations for Gemini API"""
    return [
        {
            'name': 'clone_and_analyze_repo',
            'description': 'Clone and analyze a GitHub repository. ⚠️ CRITICAL: Only call this when "Project Path:" is NOT in context. If "Project Path:" exists in context, repository is ALREADY cloned - call deploy_to_cloudrun instead!',
            'parameters': {
                'type': 'object',
                'properties': {
                    'repo_url': {
                        'type': 'string',
                        'description': 'GitHub repository URL (e.g., https://github.com/user/repo)'
                    },
                    'branch': {
                        'type': 'string',
                        'description': 'Branch to clone (default: main or master)'
                    },
                    'root_dir': {
                        'type': 'string',
                        'description': 'Optional subdirectory within the repo to analyze (Monorepo Support). e.g., "backend", "apps/web"'
                    }
                },
                'required': ['repo_url']
            }
        },
        {
            'name': 'deploy_to_cloudrun',
            'description': 'Deploy to Google Cloud Run. ⚠️ CRITICAL: ONLY call this when context contains "Project Path:". This means repository is already cloned. Use project_path from context.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'project_path': {
                        'type': 'string',
                        'description': 'Local path to project (MUST be from context if repo is cloned)'
                    },
                    'service_name': {
                        'type': 'string',
                        'description': 'Cloud Run service name (lowercase, hyphens only)'
                    },
                    'root_dir': {
                        'type': 'string',
                        'description': 'Optional subdirectory to deploy (Monorepo Support).'
                    }
                },
                'required': ['project_path', 'service_name']
            }
        },
        {
            'name': 'list_user_repositories',
            'description': 'List all GitHub repositories for the authenticated user',
            'parameters': {
                'type': 'object',
                'properties': {}
            }
        },
        {
            'name': 'get_deployment_logs',
            'description': 'Get logs from a deployed Cloud Run service',
            'parameters': {
                'type': 'object',
                'properties': {
                    'service_name': {
                        'type': 'string',
                        'description': 'Cloud Run service name'
                    },
                    'limit': {
                        'type': 'integer',
                        'description': 'Number of log entries to fetch (default: 50)'
                    }
                },
                'required': ['service_name']
            }
        },
        {
            'name': 'modify_source_code',
            'description': 'Modify source code files in the cloned repository. Use this for "Vibe Coding" - when user asks to change colors, text, logic, or fix bugs. Returns a diff of changes.',
            'parameters': {
                'type': 'object',
                'properties': {
                    'file_path': {
                        'type': 'string',
                        'description': 'Relative path to the file to modify (e.g., src/App.tsx, backend/main.py)'
                    },
                    'changes': {
                        'type': 'array',
                        'items': {
                            'type': 'object',
                            'properties': {
                                'old_content': {
                                    'type': 'string',
                                    'description': 'Exact substring to replace. MUST match existing file content EXACTLY, including whitespace.'
                                },
                                'new_content': {
                                    'type': 'string',
                                    'description': 'New content to insert'
                                },
                                'reason': {
                                    'type': 'string',
                                    'description': 'Reason for this change (e.g., "Changing background to dark blue")'
                                }
                            },
                            'required': ['old_content', 'new_content']
                        },
                        'description': 'List of code replacements to apply'
                    }
                },
                'required': ['file_path', 'changes']
            }
        }
    ]
