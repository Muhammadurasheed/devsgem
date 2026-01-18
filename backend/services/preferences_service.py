
import os
import json
from pathlib import Path
from typing import Dict, Any, Optional

class PreferencesService:
    """
    Manages user preferences for the DevGem platform.
    Persists data to a local JSON file for simplicity in this environment.
    """
    
    def __init__(self, persistence_path: str = "user_preferences.json"):
        self.persistence_path = Path(persistence_path)
        self._preferences = self._load_preferences()

    def _load_preferences(self) -> Dict[str, Any]:
        if not self.persistence_path.exists():
            return self._get_defaults()
        try:
            return json.loads(self.persistence_path.read_text())
        except Exception:
            return self._get_defaults()

    def _get_defaults(self) -> Dict[str, Any]:
        return {
            "deployment_mode": "fast",  # 'fast' (auto-generated names) or 'interactive' (ask user)
            "theme": "dark",
            "notifications": True
        }

    def _save_preferences(self):
        self.persistence_path.write_text(json.dumps(self._preferences, indent=2))

    def get_preference(self, key: str) -> Any:
        return self._preferences.get(key, self._get_defaults().get(key))

    def set_preference(self, key: str, value: Any):
        self._preferences[key] = value
        self._save_preferences()
        
    def get_deployment_mode(self) -> str:
        return self.get_preference("deployment_mode")

    def set_deployment_mode(self, mode: str):
        if mode not in ["fast", "interactive"]:
            raise ValueError("Mode must be 'fast' or 'interactive'")
        self.set_preference("deployment_mode", mode)
