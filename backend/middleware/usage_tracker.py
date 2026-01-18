"""
Usage Tracking Middleware
Automatically track API usage for all requests
"""

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time

from services.usage_service import usage_service


class UsageTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track API usage
    
    Features:
    - Track requests per user
    - Track bandwidth
    - Track response times
    - Rate limiting enforcement
    """
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next):
        """Track request and enforce limits"""
        start_time = time.time()
        
        # Extract user_id from session/auth
        # For now, use session_id from WebSocket or query params
        user_id = request.query_params.get('user_id', 'anonymous')
        
        # Track request
        if user_id != 'anonymous':
            usage_service.track_request(user_id)
        
        # Process request
        response = await call_next(request)
        
        # Track bandwidth (approximate)
        if user_id != 'anonymous':
            # Estimate response size (not 100% accurate but good enough)
            response_size = int(response.headers.get('content-length', 0))
            if response_size > 0:
                usage_service.track_bandwidth(user_id, response_size)
        
        # Add performance headers
        process_time = time.time() - start_time
        response.headers['X-Process-Time'] = str(process_time)
        
        return response
