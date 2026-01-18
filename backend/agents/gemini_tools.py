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
        }
    ]
