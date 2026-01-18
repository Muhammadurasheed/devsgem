"""
Deployment Optimization Service
Cost optimization and performance tuning
"""

from typing import Dict, Optional, List
from dataclasses import dataclass


@dataclass
class ResourceConfig:
    """Cloud Run resource configuration"""
    cpu: str = "1"
    memory: str = "512Mi"
    min_instances: int = 0
    max_instances: int = 10
    timeout: int = 300
    concurrency: int = 80
    
    def to_gcloud_args(self) -> List[str]:
        """Convert to gcloud command arguments"""
        return [
            '--cpu', self.cpu,
            '--memory', self.memory,
            '--min-instances', str(self.min_instances),
            '--max-instances', str(self.max_instances),
            '--timeout', str(self.timeout),
            '--concurrency', str(self.concurrency)
        ]


class OptimizationService:
    """
    Production optimization service
    
    Features:
    - Resource right-sizing
    - Cost optimization
    - Performance tuning
    - Auto-scaling configuration
    """
    
    # Framework-specific optimizations
    FRAMEWORK_CONFIGS = {
        'fastapi': ResourceConfig(cpu="1", memory="512Mi", concurrency=100),
        'flask': ResourceConfig(cpu="1", memory="512Mi", concurrency=80),
        'django': ResourceConfig(cpu="2", memory="1Gi", concurrency=40),
        'express': ResourceConfig(cpu="1", memory="512Mi", concurrency=100),
        'nextjs': ResourceConfig(cpu="2", memory="1Gi", concurrency=60),
        'react': ResourceConfig(cpu="1", memory="256Mi", concurrency=100),
        'vue': ResourceConfig(cpu="1", memory="256Mi", concurrency=100),
        'spring-boot': ResourceConfig(cpu="2", memory="1Gi", concurrency=40),
        'golang': ResourceConfig(cpu="1", memory="256Mi", concurrency=200),
        'rust': ResourceConfig(cpu="1", memory="128Mi", concurrency=300),
    }
    
    def get_optimal_config(
        self, 
        framework: str, 
        expected_load: str = "medium"
    ) -> ResourceConfig:
        """
        Get optimal resource configuration
        
        Args:
            framework: Detected framework
            expected_load: low, medium, high
        """
        # Get base config for framework
        base_config = self.FRAMEWORK_CONFIGS.get(
            framework.lower(),
            ResourceConfig()  # Default
        )
        
        # Adjust for expected load
        if expected_load == "high":
            base_config.min_instances = 2
            base_config.max_instances = 50
            base_config.cpu = str(int(base_config.cpu) * 2)
            memory_value = int(base_config.memory.replace('Mi', '').replace('Gi', '')) 
            if 'Gi' in base_config.memory:
                base_config.memory = f"{memory_value * 2}Gi"
            else:
                base_config.memory = f"{memory_value * 2}Mi"
        
        elif expected_load == "low":
            base_config.min_instances = 0
            base_config.max_instances = 5
            base_config.concurrency = int(base_config.concurrency * 0.7)
        
        return base_config
    
    def get_build_optimizations(self, language: str) -> Dict:
        """Get build optimization recommendations"""
        optimizations = {
            'python': {
                'cache_dirs': ['/root/.cache/pip'],
                'build_args': ['--no-cache-dir'],
                'tips': [
                    'Use multi-stage builds to reduce image size',
                    'Install dependencies before copying source code',
                    'Use .dockerignore to exclude unnecessary files',
                    'Consider using slim base images (python:3.11-slim)'
                ]
            },
            'nodejs': {
                'cache_dirs': ['/root/.npm', 'node_modules'],
                'build_args': ['--production'],
                'tips': [
                    'Use npm ci instead of npm install for faster builds',
                    'Copy package files before source code',
                    'Use multi-stage builds',
                    'Consider using alpine images'
                ]
            },
            'golang': {
                'cache_dirs': ['/go/pkg/mod'],
                'build_args': ['-ldflags="-s -w"'],  # Strip debug info
                'tips': [
                    'Use multi-stage builds (builder + runtime)',
                    'Use scratch or distroless images for runtime',
                    'Enable Go modules caching',
                    'Static compilation for smallest images'
                ]
            },
            'java': {
                'cache_dirs': ['/root/.m2', '/root/.gradle'],
                'build_args': ['-DskipTests'],
                'tips': [
                    'Use JDK for build, JRE for runtime',
                    'Use multi-stage builds',
                    'Cache Maven/Gradle dependencies',
                    'Consider using Jib for faster builds'
                ]
            }
        }
        
        return optimizations.get(language.lower(), {
            'cache_dirs': [],
            'build_args': [],
            'tips': ['Use multi-stage builds', 'Minimize layer count']
        })
    
    def estimate_cost(self, config: ResourceConfig, requests_per_month: int) -> Dict:
        """
        Estimate monthly Cloud Run cost
        
        Pricing (as of 2024):
        - CPU: $0.00002400 per vCPU-second
        - Memory: $0.00000250 per GiB-second
        - Requests: $0.40 per million
        """
        # Parse CPU and memory
        cpu_count = float(config.cpu)
        memory_str = config.memory.replace('Mi', '').replace('Gi', '')
        memory_gb = float(memory_str) / 1024 if 'Mi' in config.memory else float(memory_str)
        
        # Assume average request duration
        avg_request_duration = 0.5  # seconds
        total_seconds = requests_per_month * avg_request_duration
        
        # Calculate costs
        cpu_cost = cpu_count * total_seconds * 0.00002400
        memory_cost = memory_gb * total_seconds * 0.00000250
        request_cost = (requests_per_month / 1_000_000) * 0.40
        
        # Add cold start costs (estimated)
        cold_starts = requests_per_month * 0.05  # 5% cold start rate
        cold_start_cost = (cold_starts / 1_000_000) * 0.40
        
        total_cost = cpu_cost + memory_cost + request_cost + cold_start_cost
        
        return {
            'breakdown': {
                'cpu': round(cpu_cost, 2),
                'memory': round(memory_cost, 2),
                'requests': round(request_cost, 2),
                'cold_starts': round(cold_start_cost, 2)
            },
            'total_monthly': round(total_cost, 2),
            'currency': 'USD'
        }
    
    def get_dockerfile_optimizations(self, dockerfile_content: str) -> List[str]:
        """Analyze Dockerfile and suggest optimizations"""
        suggestions = []
        lines = dockerfile_content.split('\n')
        
        # Check layer count
        run_count = sum(1 for line in lines if line.strip().startswith('RUN'))
        if run_count > 5:
            suggestions.append(
                f"Combine {run_count} RUN commands into fewer layers for faster builds"
            )
        
        # Check for cache busting
        copy_before_install = False
        for i, line in enumerate(lines):
            if 'COPY . ' in line or 'COPY ./ ' in line:
                for prev_line in lines[:i]:
                    if 'RUN' in prev_line and ('install' in prev_line or 'pip' in prev_line):
                        copy_before_install = True
        
        if copy_before_install:
            suggestions.append(
                "Copy dependency files first, install, then copy source code for better caching"
            )
        
        # Check for multi-stage
        from_count = sum(1 for line in lines if line.strip().startswith('FROM'))
        if from_count == 1:
            suggestions.append(
                "Consider multi-stage build to reduce final image size"
            )
        
        return suggestions


# Global optimization instance
optimization = OptimizationService()
