"""
Google OAuth Service
Handles the OAuth 2.0 flow for Google Sign-In integration.
"""

import os
import requests
from typing import Dict
from urllib.parse import urlencode


class GoogleAuthService:
    def __init__(self):
        self.client_id = os.getenv('GOOGLE_CLIENT_ID')
        self.client_secret = os.getenv('GOOGLE_CLIENT_SECRET')
        self.redirect_uri = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:8080/auth')
        self.auth_url = 'https://accounts.google.com/o/oauth2/v2/auth'
        self.token_url = 'https://oauth2.googleapis.com/token'
        self.user_url = 'https://www.googleapis.com/oauth2/v2/userinfo'

    def get_authorization_url(self) -> str:
        """Generate the Google OAuth authorization URL"""
        if not self.client_id:
            raise ValueError("GOOGLE_CLIENT_ID is not configured")
        
        import secrets
        state = secrets.token_urlsafe(16)
        
        params = {
            'client_id': self.client_id,
            'redirect_uri': self.redirect_uri,
            'response_type': 'code',
            'scope': 'openid email profile',
            'state': state,
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        print(f"[Google OAuth] Authorization URL generated:")
        print(f"  Client ID: {self.client_id[:20]}...")
        print(f"  Redirect URI: {self.redirect_uri}")
        
        return f"{self.auth_url}?{urlencode(params)}"

    def exchange_code_for_token(self, code: str) -> Dict:
        """Exchange the authorization code for an access token"""
        if not self.client_id or not self.client_secret:
            raise ValueError("Google credentials not configured")
        
        payload = {
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'code': code,
            'redirect_uri': self.redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        print(f"[Google OAuth] Exchanging code for token...")
        
        response = requests.post(
            self.token_url,
            data=payload,
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        print(f"[Google OAuth] Token exchange response: {response.status_code}")
        
        if response.status_code != 200:
            print(f"[Google OAuth] ERROR: {response.text}")
            raise Exception(f"Failed to exchange token: {response.text}")
        
        data = response.json()
        
        if 'error' in data:
            error_desc = data.get('error_description', data['error'])
            print(f"[Google OAuth] ERROR: {error_desc}")
            raise Exception(f"Google OAuth error: {error_desc}")
        
        if 'access_token' not in data:
            raise Exception("No access token returned from Google")
        
        print(f"[Google OAuth] SUCCESS: Token obtained")
        
        return {
            'access_token': data['access_token'],
            'id_token': data.get('id_token'),
            'refresh_token': data.get('refresh_token'),
            'expires_in': data.get('expires_in')
        }

    def get_user_info(self, access_token: str) -> Dict:
        """Fetch authenticated user info"""
        headers = {
            'Authorization': f'Bearer {access_token}'
        }
        
        print(f"[Google OAuth] Fetching user info...")
        
        response = requests.get(self.user_url, headers=headers)
        
        if response.status_code != 200:
            print(f"[Google OAuth] ERROR fetching user: {response.status_code}")
            raise Exception(f"Failed to fetch user info: {response.status_code}")
        
        user_data = response.json()
        print(f"[Google OAuth] User fetched: {user_data.get('email')}")
        
        # Normalize to match our user format
        return {
            'id': user_data.get('id'),
            'email': user_data.get('email'),
            'name': user_data.get('name'),
            'picture': user_data.get('picture'),
            'verified_email': user_data.get('verified_email', False)
        }
