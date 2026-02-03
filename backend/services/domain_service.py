"""
Domain Service - Custom Domain Management for Cloud Run
Handles programmatic creation of domain mappings.
"""

import os
from typing import Dict, List, Optional
import asyncio
import logging
from googleapiclient import discovery
from google.oauth2 import service_account
from google.auth import default

logger = logging.getLogger(__name__)

class DomainService:
    """
    Manages Cloud Run Domain Mappings.
    Note: Domain Mappings are part of the Cloud Run v1 API.
    """
    
    def __init__(self, project_id: Optional[str] = None, region: str = 'us-central1'):
        self.project_id = project_id or os.getenv('GOOGLE_CLOUD_PROJECT')
        self.region = region or os.getenv('GOOGLE_CLOUD_REGION', 'us-central1')
        
        # Initialize API client
        try:
            credentials, _ = default()
            self.run_api = discovery.build('run', 'v1', credentials=credentials, cache_discovery=False)
            logger.info("[SUCCESS] DomainService initialized")
        except Exception as e:
            logger.error(f"Failed to initialize DomainService: {e}")
            self.run_api = None

    async def map_custom_domain(self, service_name: str, domain: str) -> Dict:
        """
        Map a custom domain to a Cloud Run service.
        Example: map_custom_domain('my-service', 'app.servergem.io')
        """
        if not self.run_api:
            return {'success': False, 'error': 'DomainService not initialized'}
            
        try:
            # DomainMapping resource
            # Parent: namespaces/{project_id}
            parent = f"namespaces/{self.project_id}"
            
            mapping_body = {
                "apiVersion": "serving.knative.dev/v1",
                "kind": "DomainMapping",
                "metadata": {
                    "name": domain,
                    "namespace": self.project_id
                },
                "spec": {
                    "routeName": service_name
                }
            }
            
            logger.info(f"Creating domain mapping for {domain} -> {service_name}")
            
            # Execute request
            request = self.run_api.namespaces().domainmappings().create(
                parent=parent,
                body=mapping_body
            )
            
            response = await asyncio.to_thread(request.execute)
            
            logger.info(f"Domain mapping created: {response.get('metadata', {}).get('name')}")
            
            # Get DNS records to configure
            records = response.get('status', {}).get('resourceRecords', [])
            
            return {
                'success': True,
                'domain': domain,
                'records': records,
                'message': 'Domain mapping created. DNS verification required.'
            }
            
        except Exception as e:
            error_msg = str(e)
            if "already exists" in error_msg:
                logger.info(f"Domain mapping for {domain} already exists")
                return {
                    'success': True,
                    'domain': domain,
                    'message': 'Domain mapping already exists'
                }
            
            logger.error(f"Failed to map domain: {e}")
            return {
                'success': False,
                'error': f"Failed to map domain: {str(e)}"
            }

    async def get_domain_mapping(self, domain: str) -> Dict:
        """Get status of a domain mapping"""
        if not self.run_api:
            return {'success': False, 'error': 'DomainService not initialized'}
            
        try:
            name = f"namespaces/{self.project_id}/domainmappings/{domain}"
            request = self.run_api.namespaces().domainmappings().get(name=name)
            response = await asyncio.to_thread(request.execute)
            
            # Check status conditions
            conditions = response.get('status', {}).get('conditions', [])
            is_ready = any(c['type'] == 'Ready' and c['status'] == 'True' for c in conditions)
            
            return {
                'success': True,
                'ready': is_ready,
                'records': response.get('status', {}).get('resourceRecords', []),
                'conditions': conditions
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
