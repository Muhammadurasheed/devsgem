
import asyncio
import os
import time
from typing import Dict, List, Any, Optional, Callable
from services.deployment_service import deployment_service
from services.gcloud_service import GCloudService
from datetime import datetime

class MonitoringAgent:
    """
    Proactive Monitoring Agent (GEMINI BRAIN SUBSYSTEM)
    Watches live services and alerts users about performance issues,
    high resource usage, or service outages.
    """
    
    def __init__(self, send_alert_hook: Callable):
        self.project_id = os.getenv('GOOGLE_CLOUD_PROJECT')
        self.send_alert_hook = send_alert_hook
        self.gcloud_svc = GCloudService(project_id=self.project_id)
        
        self.thresholds = {
            'cpu': 80.0,       # Alert if > 80% CPU
            'memory': 85.0,    # Alert if > 85% Memory
            'error_rate': 0.05 # Alert if error rate > 5% (TODO)
        }
        
        self.check_interval = 300 # 5 minutes for background polling
        self.is_running = False
        self._notified_alerts = set() # Prevent alert spam (deployment_id:type)
        
    async def start(self):
        """Start the background monitoring loop"""
        if self.is_running:
            return
            
        self.is_running = True
        print("[MonitoringAgent] 📡 Proactive monitoring started")
        
        while self.is_running:
            try:
                await self.run_check_cycle()
            except Exception as e:
                print(f"[MonitoringAgent] [ERROR] Check cycle failed: {e}")
                
            await asyncio.sleep(self.check_interval)
            
    def stop(self):
        """Stop the monitoring loop"""
        self.is_running = False
        print("[MonitoringAgent] 🛑 Monitoring stopped")
        
    async def run_check_cycle(self):
        """Perform health and metric checks for all active deployments"""
        
        # [FAANG] Self-Healing State: Reconcile with Cloud Run source of truth first
        try:
            cloud_services = await self.gcloud_svc.list_cloud_run_services()
            if cloud_services:
                deployment_service.reconcile_with_cloud(cloud_services)
        except Exception as e:
            print(f"[MonitoringAgent] Reconciliation warning: {e}")

        # Get all live deployments from all users
        # Note: We aggregate across all sessions stored in deployment_service
        # In multi-tenant production, we'd filter or shard this.
        deployments = [d for d in deployment_service._deployments.values() if d.status.value == 'live']
        
        if not deployments:
            return
            
        print(f"[MonitoringAgent] 🔍 Checking {len(deployments)} live services...")
        
        for dep in deployments:
            try:
                await self.check_deployment_health(dep)
            except Exception as e:
                print(f"[MonitoringAgent] Failed to check {dep.service_name}: {e}")
                
    async def check_deployment_health(self, deployment: Any):
        """Check metrics and status for a specific deployment"""
        # 1. Fetch metrics from the last 15 minutes
        metrics = await self.gcloud_svc.get_service_metrics(
            service_name=deployment.service_name,
            hours=0.25 
        )
        
        # 2. Analyze CPU
        if metrics.get('cpu'):
            latest_cpu = metrics['cpu'][-1]['value']
            if latest_cpu > self.thresholds['cpu']:
                await self.trigger_alert(
                    deployment, 
                    'high_cpu', 
                    f"⚠️ High CPU usage detected: {latest_cpu:.1f}%",
                    {'value': latest_cpu, 'threshold': self.thresholds['cpu']}
                )
            else:
                self.clear_alert(deployment.id, 'high_cpu')

        # 3. Analyze Memory
        if metrics.get('memory'):
            latest_mem = metrics['memory'][-1]['value']
            if latest_mem > self.thresholds['memory']:
                await self.trigger_alert(
                    deployment, 
                    'high_memory', 
                    f"⚠️ High Memory usage detected: {latest_mem:.1f}%",
                    {'value': latest_mem, 'threshold': self.thresholds['memory']}
                )
            else:
                self.clear_alert(deployment.id, 'high_memory')

        # 4. Check for Outages (Empty metrics for a live service could mean it's down or no traffic)
        # Note: Cloud Run metrics can have delay, so we need to be careful with "Down" detection
        
    async def trigger_alert(self, deployment: Any, alert_type: str, message: str, meta: Dict):
        """Send alert to frontend via WebSocket hook"""
        alert_key = f"{deployment.id}:{alert_type}"
        
        # Don't resend same alert if already notified recently
        if alert_key in self._notified_alerts:
            return
            
        print(f"[MonitoringAgent] 🔔 ALERT for {deployment.service_name}: {message}")
        
        alert_payload = {
            'type': 'monitoring_alert',
            'deployment_id': deployment.id,
            'service_name': deployment.service_name,
            'alert_type': alert_type,
            'message': message,
            'metadata': meta,
            'timestamp': datetime.now().isoformat()
        }
        
        # Identify which session owns this deployment
        # In our app, deployment has user_id. We need a way to find active session_id for that user.
        # For simplicity in this demo, we'll try to broad-broadcast or use a mapping if we have it.
        # In current app.py, session_id is used.
        
        await self.send_alert_hook(deployment.user_id, alert_payload)
        self._notified_alerts.add(alert_key)
        
    def clear_alert(self, deployment_id: str, alert_type: str):
        """Mark alert as resolved"""
        alert_key = f"{deployment_id}:{alert_type}"
        if alert_key in self._notified_alerts:
            self._notified_alerts.remove(alert_key)
            print(f"[MonitoringAgent] ✅ Alert resolved: {alert_key}")
