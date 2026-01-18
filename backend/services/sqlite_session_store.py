"""
SQLite Session Store Service
Persistence layer using SQLite for robust local development and single-instance deployments.
Bismillah ar-Rahman ar-Rahim
"""

import sqlite3
import json
import os
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
from .session_store import SessionStore

DB_PATH = "devgem_sessions.db"

class SQLiteSessionStore(SessionStore):
    """
    Production-grade SQLite session store.
    Uses a local file database to persist sessions across server restarts.
    """
    
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()
        print(f"[SessionStore] Initialized SQLite Store at {self.db_path}")

    def _get_connection(self):
        """Get a connection to the SQLite database"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Initialize the database schema"""
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS sessions (
                        session_id TEXT PRIMARY KEY,
                        data TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP
                    )
                """)
                # Create index for cleaner lookups if needed
                conn.execute("CREATE INDEX IF NOT EXISTS idx_expires_at ON sessions(expires_at)")
                conn.commit()
        except Exception as e:
            print(f"[SessionStore] CRITICAL ERROR initializing SQLite DB: {e}")

    async def save_session(self, session_id: str, data: Dict[str, Any], ttl: int = 86400 * 30) -> bool:
        """
        Save session data to SQLite.
        Runs in a thread executor to avoid blocking the async event loop.
        TTL defaults to 30 days for long-term history.
        """
        def _save():
            try:
                json_data = json.dumps(data)
                expires_at = datetime.now().timestamp() + ttl
                
                with self._get_connection() as conn:
                    conn.execute("""
                        INSERT OR REPLACE INTO sessions (session_id, data, updated_at, expires_at)
                        VALUES (?, ?, CURRENT_TIMESTAMP, ?)
                    """, (session_id, json_data, expires_at))
                    conn.commit()
                return True
            except Exception as e:
                print(f"[SessionStore] Error saving session {session_id} to SQLite: {e}")
                return False

        return await asyncio.to_thread(_save)

    async def load_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Load session data from SQLite"""
        def _load():
            try:
                with self._get_connection() as conn:
                    cursor = conn.execute(
                        "SELECT data, expires_at FROM sessions WHERE session_id = ?", 
                        (session_id,)
                    )
                    row = cursor.fetchone()
                    
                    if not row:
                        return None
                        
                    # Check expiration (optional, if we want strict TTL)
                    if row['expires_at'] and row['expires_at'] < datetime.now().timestamp():
                        print(f"[SessionStore] Session {session_id} expired")
                        # Lazy delete? Or just return None
                        return None
                        
                    return json.loads(row['data'])
            except Exception as e:
                print(f"[SessionStore] Error loading session {session_id} from SQLite: {e}")
                return None

        return await asyncio.to_thread(_load)

    async def delete_session(self, session_id: str) -> bool:
        """Delete a session permanently"""
        def _delete():
            try:
                with self._get_connection() as conn:
                    conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
                    conn.commit()
                return True
            except Exception as e:
                print(f"[SessionStore] Error deleting session {session_id}: {e}")
                return False
                
        return await asyncio.to_thread(_delete)

    async def list_sessions(self, pattern: str = "session:*") -> List[str]:
        """List all valid session IDs"""
        def _list():
            try:
                with self._get_connection() as conn:
                    # Simple listing, ordering by most recently updated
                    cursor = conn.execute(
                        "SELECT session_id FROM sessions ORDER BY updated_at DESC"
                    )
                    rows = cursor.fetchall()
                    return [row['session_id'] for row in rows]
            except Exception as e:
                print(f"[SessionStore] Error listing sessions: {e}")
                return []
                
        return await asyncio.to_thread(_list)
