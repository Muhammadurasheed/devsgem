
import requests
import json
import time
import sys

BASE_URL = "http://localhost:8000/api"

def get_first_deployment():
    # We need a user ID. The backend defaults to 'user_default' in some places, 
    # or we can try to guess. Let's try to list deployments for 'user_default' 
    # or just use a known user ID if possible. 
    # Actually, the API requires a user_id param.
    # Let's try to create a dummy user or just assume 'user_default' has deployments 
    # if the dev environment was used.
    
    # Alternatively, we can just use a hardcoded repo_url if we know one.
    # But dynamic is better.
    
    user_id = "user_default" 
    
    try:
        print(f"Fetching deployments for {user_id}...")
        resp = requests.get(f"{BASE_URL}/deployments", params={"user_id": user_id})
        if resp.status_code != 200:
            print(f"Failed to list deployments: {resp.text}")
            return None
            
        data = resp.json()
        deployments = data.get("deployments", [])
        if not deployments:
            print("No deployments found. Please create one manually first.")
            return None
            
        return deployments[0]
    except Exception as e:
        print(f"Error fetching deployments: {e}")
        return None

def trigger_webhook(repo_url):
    webhook_url = f"{BASE_URL}/github/webhook"
    
    payload = {
        "repository": {
            "html_url": repo_url
        },
        "commits": [
            {
                "id": "a1b2c3d4e5f6",
                "message": "feat(core): auto-redeploy verification test",
                "timestamp": "2024-02-09T12:00:00Z",
                "author": {
                    "name": "DevGem Bot"
                }
            }
        ],
        "head_commit": {
            "id": "a1b2c3d4e5f6",
            "message": "feat(core): auto-redeploy verification test",
            "timestamp": "2024-02-09T12:00:00Z",
            "author": {
                "name": "DevGem Bot"
            }
        }
    }
    
    headers = {
        "X-GitHub-Event": "push",
        "Content-Type": "application/json"
    }
    
    print(f"Sending webhook for {repo_url}...")
    resp = requests.post(webhook_url, json=payload, headers=headers)
    print(f"Response: {resp.status_code} - {resp.text}")
    return resp.status_code == 200

def monitor_deployment(deployment_id):
    print(f"Monitoring deployment {deployment_id} for changes...")
    for i in range(10):
        resp = requests.get(f"{BASE_URL}/deployments/{deployment_id}")
        if resp.status_code == 200:
            dep = resp.json()
            print(f"[{i+1}/10] Status: {dep.get('status')} | Last Update: {dep.get('updated_at')}")
            
            # Check commit info
            if dep.get('commit_hash') == "a1b2c3d4e5f6":
                print("✅ SUCCESS: Commit hash updated in deployment record!")
                return True
        else:
             print(f"Failed to get deployment status: {resp.status_code}")
             
        time.sleep(2)
        
    print("❌ Timed out waiting for update.")
    return False

if __name__ == "__main__":
    print("=== Auto-Redeploy Verification ===")
    
    dep = get_first_deployment()
    if not dep:
        # Fallback for testing: Try to create one? 
        # Or just exit.
        sys.exit(1)
        
    print(f"Targeting Deployment: {dep['service_name']} ({dep['id']})")
    print(f"Repo URL: {dep['repo_url']}")
    
    if trigger_webhook(dep['repo_url']):
        # Wait a bit for the async task to kick in
        time.sleep(2)
        monitor_deployment(dep['id'])
