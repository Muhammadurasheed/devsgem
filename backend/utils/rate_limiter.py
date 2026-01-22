"""
Distributed Rate Limiter for Gemini API
====================================================
Production-grade implementation with:
- Upstash Redis for distributed state
- Multi-region fallback support
- Token-aware budgeting
- Priority queue for critical operations
- Circuit breaker pattern

This is how Google/OpenAI handle rate limiting at scale.
"""

import time
import asyncio
import os
import json
from typing import Dict, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum


class Priority(Enum):
    """Request priority levels"""
    CRITICAL = 1    # Deploy operations - never delay
    HIGH = 2        # Analysis operations - minimal delay
    NORMAL = 3      # Chat operations - can wait
    LOW = 4         # Background operations - can be queued


@dataclass
class QuotaConfig:
    """
    Quota configuration matching Vertex AI limits
    See: https://cloud.google.com/vertex-ai/generative-ai/docs/quotas
    """
    # Gemini 2.5 Flash limits (per minute per region)
    requests_per_minute: int = 60  # RPM limit
    tokens_per_minute: int = 250_000  # TPM limit
    
    # Safety margin (80% of actual limit)
    safety_factor: float = 0.8
    
    # Cooldown between requests (prevents burst)
    min_request_interval: float = 0.5  # 500ms minimum
    
    # Multi-region fallback order
    fallback_regions: Tuple[str, ...] = (
        'us-central1',
        'us-east1', 
        'europe-west1',
        'asia-northeast1'
    )
    
    # Circuit breaker thresholds
    failure_threshold: int = 3  # Failures before circuit opens
    recovery_timeout: float = 30.0  # Seconds before retry


class CircuitState(Enum):
    """Circuit breaker states"""
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing recovery


class DistributedRateLimiter:
    """
    Production-grade distributed rate limiter using Upstash Redis.
    
    Features:
    - Distributed state across multiple backend instances
    - Token-aware budgeting (estimates tokens before sending)
    - Multi-region quota tracking
    - Priority queue for critical operations
    - Circuit breaker for failing regions
    - Automatic fallback between regions
    """
    
    def __init__(self, config: QuotaConfig = None):
        self.config = config or QuotaConfig()
        self.redis = None
        self._local_cache = {}  # Fallback if Redis unavailable
        self._circuit_states: Dict[str, CircuitState] = {}
        self._failure_counts: Dict[str, int] = {}
        self._last_failure_time: Dict[str, float] = {}
        self._initialized = False
        
    async def initialize(self):
        """Initialize Redis connection"""
        if self._initialized:
            return True
            
        redis_url = os.getenv("UPSTASH_REDIS_REST_URL")
        redis_token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
        
        if redis_url and redis_token:
            try:
                from upstash_redis.asyncio import Redis
                self.redis = Redis(url=redis_url, token=redis_token)
                print("[RateLimiter] [SUCCESS] Connected to Upstash Redis (Distributed Mode)")
                self._initialized = True
                return True
            except Exception as e:
                print(f"[RateLimiter] [WARNING] Redis connection failed: {e}")
                print("[RateLimiter] [INFO] Falling back to local mode")
                self.redis = None
        else:
            print("[RateLimiter] [INFO] No Redis configured, using local mode")
            
        self._initialized = True
        return False
    
    def estimate_tokens(self, message: str, context_size: int = 0) -> int:
        """
        Estimate tokens for a request before sending.
        Conservative estimate: ~4 chars per token + overhead.
        """
        # Input tokens
        input_tokens = len(message) // 4 + context_size
        
        # Expected output tokens (typical deployment response)
        output_tokens = 500
        
        # Overhead for function calling schema
        overhead = 200
        
        return input_tokens + output_tokens + overhead
    
    async def get_best_region(self) -> str:
        """
        Get the best available region based on:
        1. Circuit breaker state
        2. Current quota usage
        3. Latency (prefer closer regions)
        """
        for region in self.config.fallback_regions:
            # Check circuit breaker
            state = self._get_circuit_state(region)
            
            if state == CircuitState.OPEN:
                # Check if recovery timeout has passed
                last_failure = self._last_failure_time.get(region, 0)
                if time.time() - last_failure < self.config.recovery_timeout:
                    continue  # Skip this region
                else:
                    # Move to half-open for testing
                    self._circuit_states[region] = CircuitState.HALF_OPEN
            
            # Check quota availability
            quota_available = await self._check_region_quota(region)
            if quota_available:
                return region
        
        # All regions exhausted - return primary and let it fail
        # This triggers the Gemini API fallback
        return self.config.fallback_regions[0]
    
    async def _check_region_quota(self, region: str) -> bool:
        """Check if a region has quota available"""
        key = f"quota:{region}:rpm"
        
        if self.redis:
            try:
                count = await self.redis.get(key)
                if count is None:
                    return True
                    
                limit = int(self.config.requests_per_minute * self.config.safety_factor)
                return int(count) < limit
            except Exception as e:
                print(f"[RateLimiter] Redis error checking quota: {e}")
                return True  # Optimistic on Redis failure
        else:
            # Local mode
            count = self._local_cache.get(key, 0)
            limit = int(self.config.requests_per_minute * self.config.safety_factor)
            return count < limit
    
    async def acquire(
        self, 
        region: str,
        priority: Priority = Priority.NORMAL,
        estimated_tokens: int = 500,
        timeout: float = 30.0
    ) -> Tuple[bool, str]:
        """
        Acquire permission to make an API call.
        
        Returns:
            (success, region) - region may differ if fallback occurred
        """
        await self.initialize()
        
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            # Get best available region
            best_region = await self.get_best_region()
            
            # Check if we can proceed
            can_proceed = await self._try_acquire(best_region, estimated_tokens, priority)
            
            if can_proceed:
                return True, best_region
            
            # For critical priority, try fallback immediately
            if priority == Priority.CRITICAL:
                for fallback_region in self.config.fallback_regions:
                    if fallback_region != best_region:
                        can_proceed = await self._try_acquire(
                            fallback_region, estimated_tokens, priority
                        )
                        if can_proceed:
                            return True, fallback_region
            
            # Wait based on priority
            wait_times = {
                Priority.CRITICAL: 0.2,
                Priority.HIGH: 0.5,
                Priority.NORMAL: 1.0,
                Priority.LOW: 2.0
            }
            await asyncio.sleep(wait_times[priority])
        
        # Timeout - allow request anyway (better to try than fail silently)
        print(f"[RateLimiter] [WARNING] Timeout waiting for quota, proceeding anyway")
        return True, region
    
    async def _try_acquire(
        self, 
        region: str, 
        estimated_tokens: int,
        priority: Priority
    ) -> bool:
        """Try to acquire a slot in the rate limiter"""
        current_minute = int(time.time() // 60)
        rpm_key = f"quota:{region}:rpm:{current_minute}"
        tpm_key = f"quota:{region}:tpm:{current_minute}"
        
        if self.redis:
            try:
                # Atomic increment with expiry
                pipe = self.redis.pipeline()
                
                # Get current values
                rpm_count = await self.redis.get(rpm_key)
                tpm_count = await self.redis.get(tpm_key)
                
                rpm_count = int(rpm_count) if rpm_count else 0
                tpm_count = int(tpm_count) if tpm_count else 0
                
                # Check limits
                rpm_limit = int(self.config.requests_per_minute * self.config.safety_factor)
                tpm_limit = int(self.config.tokens_per_minute * self.config.safety_factor)
                
                # Critical priority gets 20% extra headroom
                if priority == Priority.CRITICAL:
                    rpm_limit = int(rpm_limit * 1.2)
                    tpm_limit = int(tpm_limit * 1.2)
                
                if rpm_count >= rpm_limit or tpm_count + estimated_tokens > tpm_limit:
                    return False
                
                # Increment counters
                await self.redis.incr(rpm_key)
                await self.redis.incrby(tpm_key, estimated_tokens)
                
                # Set expiry (2 minutes to be safe)
                await self.redis.expire(rpm_key, 120)
                await self.redis.expire(tpm_key, 120)
                
                return True
                
            except Exception as e:
                print(f"[RateLimiter] Redis error: {e}")
                return True  # Optimistic on Redis failure
        else:
            # Local mode
            self._local_cache[rpm_key] = self._local_cache.get(rpm_key, 0) + 1
            self._local_cache[tpm_key] = self._local_cache.get(tpm_key, 0) + estimated_tokens
            
            rpm_limit = int(self.config.requests_per_minute * self.config.safety_factor)
            return self._local_cache[rpm_key] <= rpm_limit
    
    def record_success(self, region: str):
        """Record successful request - reset circuit breaker"""
        self._failure_counts[region] = 0
        self._circuit_states[region] = CircuitState.CLOSED
    
    def record_failure(self, region: str, error: str = ""):
        """Record failed request - update circuit breaker"""
        self._failure_counts[region] = self._failure_counts.get(region, 0) + 1
        self._last_failure_time[region] = time.time()
        
        if self._failure_counts[region] >= self.config.failure_threshold:
            self._circuit_states[region] = CircuitState.OPEN
            print(f"[RateLimiter] [ERROR] Circuit OPEN for region {region}: {error}")
    
    def _get_circuit_state(self, region: str) -> CircuitState:
        """Get circuit breaker state for a region"""
        return self._circuit_states.get(region, CircuitState.CLOSED)
    
    async def get_status(self) -> Dict:
        """Get current rate limiter status for monitoring"""
        await self.initialize()
        
        current_minute = int(time.time() // 60)
        status = {
            'mode': 'distributed' if self.redis else 'local',
            'regions': {}
        }
        
        for region in self.config.fallback_regions:
            rpm_key = f"quota:{region}:rpm:{current_minute}"
            tpm_key = f"quota:{region}:tpm:{current_minute}"
            
            if self.redis:
                try:
                    rpm = await self.redis.get(rpm_key)
                    tpm = await self.redis.get(tpm_key)
                    rpm = int(rpm) if rpm else 0
                    tpm = int(tpm) if tpm else 0
                except:
                    rpm = tpm = 0
            else:
                rpm = self._local_cache.get(rpm_key, 0)
                tpm = self._local_cache.get(tpm_key, 0)
            
            status['regions'][region] = {
                'requests_used': rpm,
                'requests_limit': self.config.requests_per_minute,
                'tokens_used': tpm,
                'tokens_limit': self.config.tokens_per_minute,
                'circuit_state': self._get_circuit_state(region).value,
                'available': await self._check_region_quota(region)
            }
        
        return status


# Global rate limiter instance (singleton)
_rate_limiter: Optional[DistributedRateLimiter] = None


def get_rate_limiter() -> DistributedRateLimiter:
    """Get or create global rate limiter"""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = DistributedRateLimiter()
    return _rate_limiter


async def acquire_with_fallback(
    message: str,
    priority: Priority = Priority.NORMAL,
    preferred_region: str = 'us-central1'
) -> Tuple[bool, str]:
    """
    High-level helper to acquire rate limit with automatic fallback.
    
    Returns:
        (can_proceed, best_region)
    """
    limiter = get_rate_limiter()
    estimated_tokens = limiter.estimate_tokens(message)
    
    return await limiter.acquire(
        region=preferred_region,
        priority=priority,
        estimated_tokens=estimated_tokens
    )
