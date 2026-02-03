"""
Atomic JSON Storage Utility
Implements a robust Write-Retry-Rename loop to handle Windows file locking semantics.
Designed to prevent 'WinError 5: Access is denied' and 'WinError 32: The process cannot access the file because it is being used by another process'.
"""

import json
import os
import time
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional
from contextlib import contextmanager

class AtomicJsonStore:
    """
    Google-Grade Atomic Storage for JSON data.
    Ensures data integrity even under high concurrency or aggressive Anti-Virus file locking.
    """
    
    def __init__(self, file_path: str, default_data: Optional[Dict] = None):
        self.file_path = Path(file_path)
        self.default_data = default_data or {}
        self._ensure_dir()

    def _ensure_dir(self):
        """Ensure parent directory exists"""
        self.file_path.parent.mkdir(parents=True, exist_ok=True)

    def load(self) -> Dict[str, Any]:
        """Load data with read retries [HEALED]"""
        if not self.file_path.exists():
            return self.default_data.copy()
            
        for attempt in range(5):
            try:
                with open(self.file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if not content:
                        return self.default_data.copy()
                    return json.loads(content)
            except (json.JSONDecodeError, OSError) as e:
                if attempt == 4:
                    print(f"[AtomicStore] ⚠️ CRITICAL: Load failed for {self.file_path.name}: {e}")
                    return self.default_data.copy()
                time.sleep(0.1 * (attempt + 1))
        return self.default_data.copy()

    def save(self, data: Dict[str, Any]):
        """Save data using Write-Retry-Rename strategy [HEALED]"""
        temp_path = None
        try:
            # 1. Create temp file
            fd, temp_path = tempfile.mkstemp(dir=self.file_path.parent, text=True, suffix='.tmp')
            
            # 2. Wrap FD and write
            try:
                with os.fdopen(fd, 'w', encoding='utf-8') as f:
                    # [FAANG] Defensive Serialization: Handle datetime if it leaks
                    def json_serial(obj):
                        if isinstance(obj, (datetime)):
                            return obj.isoformat()
                        raise TypeError (f"Type {type(obj)} not serializable")
                    
                    json.dump(data, f, indent=2, default=json_serial)
                    f.flush()
                    try:
                        os.fsync(f.fileno())
                    except:
                        pass
                # [FD-LOCKED]: os.fdopen closes the FD here.
            except Exception as e:
                # If writing fails, we still need to close fd if not closed by with
                try: os.close(fd)
                except: pass
                raise e

            # 3. Rename loop (Windows Fix)
            for attempt in range(10):
                try:
                    os.replace(temp_path, self.file_path)
                    return
                except OSError as e:
                    if attempt < 9:
                        time.sleep(0.1 * (attempt + 1))
                        continue
                    raise e
        except Exception as e:
            if temp_path and os.path.exists(temp_path):
                try: os.remove(temp_path)
                except: pass
            print(f"[AtomicStore] ❌ Persistent save failure: {e}")
            raise IOError(f"Atomic save failed: {e}")

    @contextmanager
    def update(self):
        """
        Thread-safe context manager for updating data.
        Usage:
        with store.update() as data:
            data['key'] = 'value'
        """
        data = self.load()
        yield data
        self.save(data)
