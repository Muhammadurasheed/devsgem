"""
Session Store Service
Handles persistence of user sessions and orchestrator state.
Supports:
- Upstash Redis (Production)
- In-Memory (Development/Fallback)
"""

import os
import json
import abc
from typing import Dict, Optional, Any, List
from datetime import datetime

class SessionStore(abc.ABC):
    """Abstract base class for session storage"""
    
    @abc.abstractmethod
    async def save_session(self, session_id: str, data: Dict[str, Any], ttl: int = 3600) -> bool:
        """Save session data"""
        pass
    
    @abc.abstractmethod
    async def load_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Load session data"""
        pass
    
    @abc.abstractmethod
    async def delete_session(self, session_id: str) -> bool:
        """Delete session"""
        pass

    @abc.abstractmethod
    async def list_sessions(self, pattern: str = "session:*") -> List[str]:
        """List session IDs matching pattern"""
        pass

class MemorySessionStore(SessionStore):
    """In-memory session store for local development"""
    
    def __init__(self):
        self._store: Dict[str, Dict] = {}
        print("[SessionStore] Using In-Memory Store (Not persistent)")
    
    async def save_session(self, session_id: str, data: Dict[str, Any], ttl: int = 3600) -> bool:
        self._store[session_id] = {
            'data': data,
            'expires_at': datetime.now().timestamp() + ttl
        }
        return True
    
    async def load_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        if session_id not in self._store:
            return None
            
        entry = self._store[session_id]
        if datetime.now().timestamp() > entry['expires_at']:
            del self._store[session_id]
            return None
            
        return entry['data']
    
    async def delete_session(self, session_id: str) -> bool:
        if session_id in self._store:
            del self._store[session_id]
            return True
        return False

    async def list_sessions(self, pattern: str = "session:*") -> List[str]:
        # Filter keys that match the pattern (basic glob simulation)
        return [k for k in self._store.keys() if k.startswith(pattern.replace('*', ''))]

class UpstashSessionStore(SessionStore):
    """Upstash Redis session store (Serverless friendly)"""
    
    def __init__(self, url: str, token: str):
        try:
            # Use Async Client
            from upstash_redis.asyncio import Redis
            self.redis = Redis(url=url, token=token)
            print("[SessionStore] Initialized Upstash Redis (Async)")
        except Exception as e:
            print(f"[SessionStore] Failed to initialize Upstash Redis: {e}")
            raise e
            
    async def save_session(self, session_id: str, data: Dict[str, Any], ttl: int = 3600) -> bool:
        try:
            # Serialize complex objects if needed, simple JSON for now
            json_data = json.dumps(data)
            await self.redis.setex(f"session:{session_id}", ttl, json_data)
            return True
        except Exception as e:
            print(f"[SessionStore] Error saving session {session_id}: {e}")
            return False
            
    async def load_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        try:
            data = await self.redis.get(f"session:{session_id}")
            if not data:
                return None
            return json.loads(data)
        except Exception as e:
            print(f"[SessionStore] Error loading session {session_id}: {e}")
            return None

    async def delete_session(self, session_id: str) -> bool:
        try:
            await self.redis.delete(f"session:{session_id}")
            return True
        except Exception as e:
            print(f"[SessionStore] Error deleting session {session_id}: {e}")
            return False

    async def list_sessions(self, pattern: str = "session:*") -> List[str]:
        try:
            # Redis SCAN to avoid blocking
            keys = []
            cursor = 0
            while True:
                cursor, batch = await self.redis.scan(cursor, match=pattern, count=100)
                keys.extend(batch)
                if cursor == 0:
                    break
            # Strip the prefix "session:" from the keys
            return [k.replace("session:", "") for k in keys]
        except Exception as e:
            print(f"[SessionStore] Error listing sessions: {e}")
            return []

def get_session_store() -> SessionStore:
    """Factory to get appropriate session store based on env vars"""
    url = os.getenv("UPSTASH_REDIS_REST_URL")
    token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
    
    if url and token:
        try:
            return UpstashSessionStore(url, token)
        except Exception:
            print("[SessionStore] Fallback to SQLite due to connection failure")
            try:
                from .sqlite_session_store import SQLiteSessionStore
                return SQLiteSessionStore()
            except ImportError:
                return MemorySessionStore()
    else:
        # Default to SQLite for local dev
        try:
            from .sqlite_session_store import SQLiteSessionStore
            return SQLiteSessionStore()
        except ImportError:
            print("[SessionStore] SQLite store not found, falling back to Memory")
            return MemorySessionStore()
