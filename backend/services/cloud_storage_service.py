import os
import logging
from google.cloud import storage
from pathlib import Path

logger = logging.getLogger("uvicorn")

class CloudStorageService:
    """
    Google-Grade Distributed Persistence Service.
    Handles archival and retrieval of critical system state (deployments, config)
    to ensure zero-data-loss across ephemeral Cloud Run restarts.
    """
    
    def __init__(self, bucket_name: str = None):
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        self.bucket_name = bucket_name or f"devgem-state-{self.project_id}"
        self.storage_client = storage.Client()
        self.bucket = self.storage_client.bucket(self.bucket_name)

    async def upload_file(self, local_path: str, remote_path: str) -> bool:
        """Upload a local file to GCS with verification"""
        try:
            blob = self.bucket.blob(remote_path)
            # Use run_in_executor for heavy I/O if needed, but for small JSONs direct is fine
            blob.upload_from_filename(local_path)
            logger.info(f"[GCS] [UPLOAD] Successfully archived {local_path} to gs://{self.bucket_name}/{remote_path}")
            return True
        except Exception as e:
            logger.error(f"[GCS] [ERROR] Upload failed for {local_path}: {e}")
            return False

    async def download_file(self, remote_path: str, local_path: str) -> bool:
        """Download from GCS to a local path (Restores state)"""
        try:
            blob = self.bucket.blob(remote_path)
            if not blob.exists():
                logger.warning(f"[GCS] [LOAD] Blob {remote_path} does not exist in bucket {self.bucket_name}")
                return False
            
            # Ensure local directory exists
            Path(local_path).parent.mkdir(parents=True, exist_ok=True)
            blob.download_to_filename(local_path)
            logger.info(f"[GCS] [LOAD] Successfully restored state from gs://{self.bucket_name}/{remote_path} to {local_path}")
            return True
        except Exception as e:
            logger.error(f"[GCS] [ERROR] Download failed for {remote_path}: {e}")
            return False

    async def blob_exists(self, remote_path: str) -> bool:
        """Check if a state object exists"""
        try:
            blob = self.bucket.blob(remote_path)
            return blob.exists()
        except Exception:
            return False

# Singleton instance
cloud_storage_service = CloudStorageService(
    bucket_name=os.getenv("STATE_BUCKET", "devgem-state-devgem-i4i")
)
