import asyncio
import os
import sys

# Add current dir to path
sys.path.append(os.getcwd())

from services.cloud_storage_service import cloud_storage_service

async def handover():
    print("[Handover] Initiating local-to-cloud state migration...")
    
    local_path = "backend/data/deployments.json"
    remote_path = "state/deployments.json"
    
    if not os.path.exists(local_path):
        print(f"[Handover] [ERROR] Local state file not found at {local_path}")
        return

    print(f"[Handover] Uploading {local_path} to gs://{cloud_storage_service.bucket_name}/{remote_path}...")
    success = await cloud_storage_service.upload_file(local_path, remote_path)
    
    if success:
        print("[Handover] [SUCCESS] Dashboard state migrated to Cloud Storage.")
        print("[Handover] Next step: Redeploy the backend to pick up the new Dockerfile and rehydration logic.")
    else:
        print("[Handover] [ERROR] Failed to upload state. Check GCP permissions.")

if __name__ == "__main__":
    # Ensure GOOGLE_CLOUD_PROJECT is set for the script
    if not os.getenv("GOOGLE_CLOUD_PROJECT"):
        os.environ["GOOGLE_CLOUD_PROJECT"] = "devgem-i4i"
    
    asyncio.run(handover())
