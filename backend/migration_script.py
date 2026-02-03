"""
[FAANG] Identity Healing Script
Mission: Reclaim any 'user_default' deployments and assign them to the correct user.
To run: python migration_script.py [REAL_USER_ID]
"""

import sys
import json
import os
from datetime import datetime

DEPLOYMENTS_PATH = "data/deployments.json"

def heal_data(real_user_id):
    if not os.path.exists(DEPLOYMENTS_PATH):
        print(f"Error: {DEPLOYMENTS_PATH} not found.")
        return

    print(f"🔍 Starting Data Healing for User ID: {real_user_id}")
    
    with open(DEPLOYMENTS_PATH, 'r') as f:
        deployments = json.load(f)

    orphaned_count = 0
    healed_count = 0

    for dep_id, dep in deployments.items():
        if dep.get('user_id') == 'user_default' or dep.get('user_id') is None:
            orphaned_count += 1
            dep['user_id'] = real_user_id
            dep['updated_at'] = datetime.utcnow().isoformat()
            healed_count += 1
            print(f"  ✅ Reclaimed: {dep_id} ({dep.get('service_name')})")

    if healed_count > 0:
        # Save backup before overwrite
        backup_path = f"{DEPLOYMENTS_PATH}.bak.{int(datetime.now().timestamp())}"
        import shutil
        shutil.copy2(DEPLOYMENTS_PATH, backup_path)
        print(f"💾 Backup created at: {backup_path}")

        # Atomic write
        temp_path = DEPLOYMENTS_PATH + ".tmp"
        with open(temp_path, 'w') as f:
            json.dump(deployments, f, indent=2)
        os.replace(temp_path, DEPLOYMENTS_PATH)
        print(f"\n🎉 SUCCESS: {healed_count} deployments reclaimed for {real_user_id}!")
    else:
        print("\n✨ No orphaned deployments found. The system is clean.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migration_script.py [REAL_USER_ID]")
        sys.exit(1)
    
    heal_data(sys.argv[1])
