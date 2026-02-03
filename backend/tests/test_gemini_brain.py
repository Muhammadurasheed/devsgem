
import asyncio
import os
import json
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).parent.parent))

from agents.gemini_brain import GeminiBrainAgent
from dotenv import load_dotenv

load_dotenv()

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

async def test_scenarios():
    """Test Gemini Brain with multiple failure scenarios"""
    gcloud_project = os.getenv('GOOGLE_CLOUD_PROJECT')
    gemini_api_key = os.getenv('GEMINI_API_KEY')
    
    if not gcloud_project:
        print("[FAIL] Error: GOOGLE_CLOUD_PROJECT not set")
        return

    brain = GeminiBrainAgent(
        gcloud_project=gcloud_project,
        gemini_api_key=gemini_api_key
    )

    scenarios = [
        {
            "name": "MongoDB connection error",
            "logs": [
                "[ERROR] MongooseServerSelectionError: querySrv ENOTFOUND _mongodb._tcp.cluster0.skefzri.mongodb.net"
            ],
            "code": "const mongoose = require('mongoose');\nmongoose.connect(process.env.MONGODB_URI);",
            "file": "server.js",
            "lang": "nodejs"
        },
        {
            "name": "Port binding error",
            "logs": [
                "Error: listen EADDRINUSE: address already in use :::8080"
            ],
            "code": "const app = require('express')();\napp.listen(8080);",
            "file": "app.js",
            "lang": "nodejs"
        },
        {
            "name": "Python syntax error",
            "logs": [
                "  File \"app.py\", line 10\n    def hello()\n              ^\nSyntaxError: expected ':'"
            ],
            "code": "def hello()\n    pass",
            "file": "app.py",
            "lang": "python"
        },
        {
            "name": "Missing dependency",
            "logs": [
                "ModuleNotFoundError: No module named 'httpx'"
            ],
            "code": "import httpx\nfrom fastapi import FastAPI",
            "file": "main.py",
            "lang": "python"
        }
    ]

    for scenario in scenarios:
        print(f"\n--- Testing Scenario: {scenario['name']} ---")
        
        # Setup mock repo
        project_path = f"/tmp/test_brain_{scenario['lang']}"
        os.makedirs(project_path, exist_ok=True)
        with open(f"{project_path}/{scenario['file']}", 'w') as f:
            f.write(scenario['code'])
            
        try:
            diagnosis = await brain.detect_and_diagnose(
                deployment_id=f"test-{scenario['name'].replace(' ', '-')}",
                error_logs=scenario['logs'],
                project_path=project_path,
                repo_url="https://github.com/test/repo",
                language=scenario['lang']
            )
            
            print(f"[SUCCESS] Root Cause: {diagnosis.root_cause}")
            print(f"[SUCCESS] Confidence: {diagnosis.confidence_score}%")
            if diagnosis.recommended_fix:
                print(f"[SUCCESS] Fix generated for {diagnosis.recommended_fix.get('file_path')}")
            else:
                print("[WARNING] No fix recommended")
                
        except Exception as e:
            print(f"[FAIL] Scenario failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_scenarios())
