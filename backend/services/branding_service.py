import os
import re
import json
import httpx
import asyncio
from pathlib import Path
from typing import Dict, Optional, List, Any
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

class BrandingService:
    """
    Sovereign Branding Engine (FAANG-Level)
    Manages local assets and autonomous favicon scraping with multi-stage fallback.
    """

    def __init__(self, assets_dir: str, cache_dir: str = "branding_assets"):
        self.assets_dir = Path(assets_dir)
        self.cache_dir = Path(cache_dir)
        self.manifest_path = self.cache_dir / "manifest.json"
        
        self.asset_index: Dict[str, Path] = {}
        self.normalized_index: Dict[str, Path] = {}
        self.favicon_cache: Dict[str, Dict] = {}
        
        # Ensure directories exist
        self.cache_dir.mkdir(exist_ok=True)
        
        self._load_manifest()
        self._index_assets()

    def _load_manifest(self):
        """Load favicon cache from disk"""
        if self.manifest_path.exists():
            try:
                with open(self.manifest_path, 'r', encoding='utf-8') as f:
                    self.favicon_cache = json.load(f)
                print(f"[BrandingService] Loaded {len(self.favicon_cache)} cached favicons.")
            except Exception as e:
                print(f"[BrandingService] Warning: Error loading manifest: {e}")
                self.favicon_cache = {}

    def _save_manifest(self):
        """Atomic manifest persistence"""
        try:
            temp_path = self.manifest_path.with_suffix('.tmp')
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(self.favicon_cache, f, indent=2)
            temp_path.replace(self.manifest_path)
        except Exception as e:
            print(f"[BrandingService] Warning: Failed to save manifest: {e}")

    def _index_assets(self):
        """High-performance recursive indexing of local brand assets"""
        if not self.assets_dir.exists():
            print(f"[BrandingService] Warning: Assets directory not found: {self.assets_dir}")
            return

        print(f"[BrandingService] Indexing Sovereign Assets in {self.assets_dir}...")
        count = 0
        for path in self.assets_dir.rglob('*'):
            if path.is_file() and path.suffix.lower() in ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico']:
                name_key = path.stem.lower()
                self.asset_index[name_key] = path
                
                # Semantic normalization (e.g., "Node.js" -> "nodejs")
                clean_key = re.sub(r'[^a-z0-9]', '', name_key)
                if clean_key and clean_key not in self.normalized_index:
                    self.normalized_index[clean_key] = path
                count += 1
        
        print(f"[BrandingService] Indexed {count} sovereign assets.")

    async def get_favicon(self, url: str) -> Optional[str]:
        """
        [FAANG] Resilient Favicon Discovery
        Traverses Cache -> HTML Scraping -> Root Fallback
        """
        if not url: return None
        
        # Normalize URL to strip path for caching key
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        # 1. Check Cache
        if base_url in self.favicon_cache:
            return self.favicon_cache[base_url].get("icon_url")

        # 2. Heuristic Scraping
        try:
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                response = await client.get(url)
                if response.status_code != 200:
                    return f"{base_url}/favicon.ico" # Final fallback

                soup = BeautifulSoup(response.text, 'html.parser')
                
                # Heuristic 1: <link rel="icon"> or <link rel="shortcut icon">
                icon_link = (
                    soup.find("link", rel=lambda x: x and 'icon' in x.lower()) or
                    soup.find("link", rel="apple-touch-icon")
                )
                
                if icon_link and icon_link.get('href'):
                    icon_url = urljoin(url, icon_link['href'])
                    
                    # Store in cache
                    self.favicon_cache[base_url] = {
                        "icon_url": icon_url,
                        "timestamp": asyncio.get_event_loop().time()
                    }
                    self._save_manifest()
                    return icon_url

                # Heuristic 2: Direct lookup at root
                root_favicon = f"{base_url}/favicon.ico"
                self.favicon_cache[base_url] = {
                    "icon_url": root_favicon,
                    "timestamp": asyncio.get_event_loop().time()
                }
                self._save_manifest()
                return root_favicon

        except Exception as e:
            print(f"[BrandingService] Warning: Scraping failed for {url}: {e}")
            return f"{base_url}/favicon.ico"

    async def proxy_icon(self, icon_url: str) -> Optional[bytes]:
        """Proxy remote bytes to bypass CORS with timeout protection"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(icon_url)
                if response.status_code == 200:
                    return response.content
        except Exception as e:
            print(f"[BrandingService] Warning: Proxy failure for {icon_url}: {e}")
        return None

    def match_asset(self, query: str) -> Optional[Path]:
        """Fuzzy match query to local assets index"""
        if not query: return None
        q = query.lower().strip()
        
        # Exact match
        if q in self.asset_index: return self.asset_index[q]
        
        # Cleaned match
        q_clean = re.sub(r'[^a-z0-9]', '', q)
        if q_clean in self.normalized_index: return self.normalized_index[q_clean]
        
        # Alias matching
        aliases = {
            'c#': 'c#', 'csharp': 'c#',
            'c++': 'c++', 'cpp': 'c++',
            'golang': 'go',
            'express': 'nodejs',
            'nest': 'nestjs',
            'react': 'react',
            'vue': 'vuejs'
        }
        if q in aliases and aliases[q] in self.asset_index:
            return self.asset_index[aliases[q]]
            
        return None
