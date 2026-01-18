"""
GitHub OAuth Service
Handles the OAuth 2.0 flow for GitHub integration.
FIXED: Uses form-encoded data for token exchange (GitHub requirement)
"""

import os
import requests
from typing import Dict
from urllib.parse import urlencode


class GitHubAuthService:
    def __init__(self):
        self.client_id = os.getenv('GITHUB_CLIENT_ID')
        self.client_secret = os.getenv('GITHUB_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GITHUB_REDIRECT_URI', 'http://localhost:8080/auth')
        self.auth_url = 'https://github.com/login/oauth/authorize'
        self.token_url = 'https://github.com/login/oauth/access_token'
        self.user_url = 'https://api.github.com/user'

    def get_authorization_url(self) -> str:
        """Generate the GitHub OAuth authorization URL"""
        if not self.client_id:
            raise ValueError("GITHUB_CLIENT_ID is not configured")
        
        # Generate a random state for CSRF protection
        import secrets
        state = secrets.token_urlsafe(16)
        
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'scope': 'repo read:user user:email',
            'state': state
        }
        
        print(f"[GitHub OAuth] Authorization URL generated:")
        print(f"  Client ID: {self.client_id[:8]}...")
        print(f"  Redirect URI: {self.redirect_uri}")
        print(f"  Scopes: {params['scope']}")
        
        return f"{self.auth_url}?{urlencode(params)}"

    def exchange_code_for_token(self, code: str) -> Dict:
        """Exchange the temporary code for an access token"""
        if not self.client_id or not self.client_secret:
            raise ValueError("GitHub credentials not configured")
        
        payload = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'redirect_uri': self.redirect_uri
        }
        
        # CRITICAL FIX: GitHub requires form-encoded data, NOT JSON
        headers = {'Accept': 'application/json'}
        
        print(f"[GitHub OAuth] Exchanging code for token...")
        print(f"  Code: {code[:10]}...")
        print(f"  Redirect URI: {self.redirect_uri}")
        
        response = requests.post(
            self.token_url,
            data=payload,  # FIXED: Use data= for form-encoded, not json=
            headers=headers
        )
        
        print(f"[GitHub OAuth] Token exchange response: {response.status_code}")
        
        if response.status_code != 200:
            print(f"[GitHub OAuth] ERROR: {response.text}")
            raise Exception(f"Failed to exchange token: {response.text}")
        
        data = response.json()
        print(f"[GitHub OAuth] Response data keys: {list(data.keys())}")
        
        if 'error' in data:
            error_desc = data.get('error_description', data['error'])
            print(f"[GitHub OAuth] ERROR: {error_desc}")
            raise Exception(f"GitHub OAuth error: {error_desc}")
        
        if 'access_token' not in data:
            print(f"[GitHub OAuth] ERROR: No access_token in response: {data}")
            raise Exception("No access token returned from GitHub")
        
        print(f"[GitHub OAuth] SUCCESS: Token obtained")
        
        return {
            'access_token': data['access_token'],
            'token_type': data.get('token_type'),
            'scope': data.get('scope')
        }

    def get_user_info(self, access_token: str) -> Dict:
        """Fetch authenticated user info with the new token"""
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
        
        print(f"[GitHub OAuth] Fetching user info...")
        
        response = requests.get(self.user_url, headers=headers)
        
        if response.status_code != 200:
            print(f"[GitHub OAuth] ERROR fetching user: {response.status_code}")
            raise Exception(f"Failed to fetch user info: {response.status_code}")
        
        user_data = response.json()
        print(f"[GitHub OAuth] User fetched: {user_data.get('login')}")
        
        return user_data
