"""
Robust model verification with real API calls
"""
import os
import sys
from dotenv import load_dotenv
import vertexai
from vertexai.generative_models import GenerativeModel

load_dotenv()

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

def test_model(model_name):
    project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
    vertexai.init(project=project_id, location='us-central1')
    
    try:
        model = GenerativeModel(model_name)
        print(f"[TESTING] {model_name}...")
        response = model.generate_content("Hi")
        print(f"   [SUCCESS] {model_name} responded: {response.text[:20]}...")
        return True
    except Exception as e:
        print(f"   [FAIL] {model_name}: {e}")
        return False

if __name__ == "__main__":
    models = [
        "gemini-2.0-flash-001",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "gemini-2.0-pro-exp",
        "gemini-3-pro-preview",
        "gemini-3-flash-preview"
    ]
    
    for m in models:
        test_model(m)
        print("-" * 40)
