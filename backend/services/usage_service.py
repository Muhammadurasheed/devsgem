"""
Usage Tracking Service
Track API requests, deployments, and resource usage
"""

import json
import os
from typing import Dict, List
from datetime import datetime, timedelta
from collections import defaultdict

from models import UsageMetrics


class UsageService:
    """
    Production usage tracking
    
    Features:
    - Request counting per user
    - Daily usage metrics
    - Resource usage tracking
    - Usage limits enforcement
    """
    
    def __init__(self, storage_path: str = "data/usage.json"):
        self.storage_path = storage_path
        self._ensure_storage()
        self._usage: Dict[str, Dict[str, UsageMetrics]] = self._load_usage()
        # In-memory counters for current day
        self._request_counts: Dict[str, int] = defaultdict(int)
    
    def _ensure_storage(self):
        """Create storage directory"""
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, 'w') as f:
                json.dump({}, f)
    
    def _load_usage(self) -> Dict[str, Dict[str, UsageMetrics]]:
        """Load usage data from disk"""
        try:
            with open(self.storage_path, 'r') as f:
                data = json.load(f)
                result = {}
                for user_id, dates in data.items():
                    result[user_id] = {
                        date: UsageMetrics.from_dict(metrics)
                        for date, metrics in dates.items()
                    }
                return result
        except Exception as e:
            print(f"Error loading usage: {e}")
            return {}
    
    def _save_usage(self):
        """Save usage data to disk"""
        try:
            temp_path = f"{self.storage_path}.tmp"
            with open(temp_path, 'w') as f:
                data = {}
                for user_id, dates in self._usage.items():
                    data[user_id] = {
                        date: metrics.to_dict()
                        for date, metrics in dates.items()
                    }
                json.dump(data, f, indent=2)
            os.replace(temp_path, self.storage_path)
        except Exception as e:
            print(f"Error saving usage: {e}")
    
    def _get_today_date(self) -> str:
        """Get today's date string"""
        return datetime.utcnow().date().isoformat()
    
    def _get_or_create_metrics(self, user_id: str, date: str = None) -> UsageMetrics:
        """Get or create usage metrics for user/date"""
        if date is None:
            date = self._get_today_date()
        
        if user_id not in self._usage:
            self._usage[user_id] = {}
        
        if date not in self._usage[user_id]:
            self._usage[user_id][date] = UsageMetrics(
                user_id=user_id,
                date=date
            )
        
        return self._usage[user_id][date]
    
    # ========================================================================
    # Tracking Operations
    # ========================================================================
    
    def track_request(self, user_id: str):
        """Track API request"""
        metrics = self._get_or_create_metrics(user_id)
        metrics.requests += 1
        self._request_counts[user_id] += 1
        self._save_usage()
    
    def track_deployment(self, user_id: str, memory_mb: int = 512):
        """Track deployment"""
        metrics = self._get_or_create_metrics(user_id)
        metrics.deployments += 1
        metrics.memory_used_mb += memory_mb
        self._save_usage()
    
    def track_bandwidth(self, user_id: str, bytes_transferred: int):
        """Track bandwidth usage"""
        metrics = self._get_or_create_metrics(user_id)
        metrics.bandwidth_gb += bytes_transferred / (1024 ** 3)
        self._save_usage()
    
    # ========================================================================
    # Query Operations
    # ========================================================================
    
    def get_today_usage(self, user_id: str) -> UsageMetrics:
        """Get today's usage for user"""
        return self._get_or_create_metrics(user_id)
    
    def get_usage_range(
        self,
        user_id: str,
        start_date: str,
        end_date: str
    ) -> List[UsageMetrics]:
        """Get usage metrics for date range"""
        if user_id not in self._usage:
            return []
        
        return [
            metrics
            for date, metrics in self._usage[user_id].items()
            if start_date <= date <= end_date
        ]
    
    def get_monthly_usage(self, user_id: str, year: int, month: int) -> List[UsageMetrics]:
        """Get usage for a specific month"""
        start_date = f"{year:04d}-{month:02d}-01"
        
        # Calculate last day of month
        if month == 12:
            end_date = f"{year:04d}-{month:02d}-31"
        else:
            next_month = datetime(year, month + 1, 1)
            last_day = (next_month - timedelta(days=1)).day
            end_date = f"{year:04d}-{month:02d}-{last_day:02d}"
        
        return self.get_usage_range(user_id, start_date, end_date)
    
    def get_total_requests_today(self, user_id: str) -> int:
        """Get total requests for today"""
        metrics = self.get_today_usage(user_id)
        return metrics.requests
    
    def has_exceeded_daily_limit(self, user_id: str, limit: int) -> bool:
        """Check if user has exceeded daily request limit"""
        if limit == -1:  # unlimited
            return False
        return self.get_total_requests_today(user_id) >= limit
    
    # ========================================================================
    # Analytics
    # ========================================================================
    
    def get_usage_summary(self, user_id: str, days: int = 30) -> Dict:
        """Get usage summary for last N days"""
        end_date = datetime.utcnow().date()
        start_date = end_date - timedelta(days=days)
        
        usage_list = self.get_usage_range(
            user_id,
            start_date.isoformat(),
            end_date.isoformat()
        )
        
        total_requests = sum(m.requests for m in usage_list)
        total_deployments = sum(m.deployments for m in usage_list)
        total_bandwidth = sum(m.bandwidth_gb for m in usage_list)
        avg_memory = (
            sum(m.memory_used_mb for m in usage_list) / len(usage_list)
            if usage_list else 0
        )
        
        return {
            "period_days": days,
            "total_requests": total_requests,
            "total_deployments": total_deployments,
            "total_bandwidth_gb": round(total_bandwidth, 2),
            "avg_memory_mb": round(avg_memory, 0),
            "daily_average_requests": round(total_requests / days, 1) if days > 0 else 0
        }


# Global instance
usage_service = UsageService()
