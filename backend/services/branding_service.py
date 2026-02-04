import httpx
import re
import asyncio
import os
import json
import hashlib
from urllib.parse import urljoin, urlparse
from typing import Optional, List
import logging

class BrandingService:
    """
    [SOVEREIGN BRANDING ENGINE]
    Surgically extracts high-fidelity favicons and brand assets from live URLs.
    [FAANG] Designed for high reliability, persistent disk-based caching, and bypasses CORS.
    """
    def __init__(self):
        self.logger = logging.getLogger("BrandingService")
        self.client = httpx.AsyncClient(
            timeout=10.0, 
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
            }
        )
        self.cache_dir = os.path.join(os.getcwd(), "branding_assets")
        self.manifest_path = os.path.join(self.cache_dir, "manifest.json")
        os.makedirs(self.cache_dir, exist_ok=True)
        self._load_manifest()

    def _load_manifest(self):
        if os.path.exists(self.manifest_path):
            try:
                with open(self.manifest_path, 'r') as f:
                    self._manifest = json.load(f)
            except:
                self._manifest = {}
        else:
            self._manifest = {}

    def _save_manifest(self):
        try:
            with open(self.manifest_path, 'w') as f:
                json.dump(self._manifest, f)
        except Exception as e:
            self.logger.error(f"[Branding] Failed to save manifest: {e}")

    async def get_favicon(self, url: str) -> Optional[str]:
        """
        Extracts the best possible favicon URL for a given target.
        """
        if not url:
            return None
            
        if url in self._manifest:
            return self._manifest[url].get('icon_url')

        try:
            self.logger.info(f"[Branding] 🔍 Extracting favicon for: {url}")
            response = await self.client.get(url)
            html = response.text
            
            icon_patterns = [
                r'<link[^>]*rel=["\'](?:apple-touch-icon|apple-touch-icon-precomposed)["\'][^>]*href=["\']([^"\']+)["\']',
                r'<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\'](?:apple-touch-icon|apple-touch-icon-precomposed)["\']',
                r'<link[^>]*rel=["\']icon["\'][^>]*href=["\']([^"\']+)["\']',
                r'<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']icon["\']',
                r'<link[^>]*rel=["\']shortcut icon["\'][^>]*href=["\']([^"\']+)["\']',
                r'<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']shortcut icon["\']'
            ]
            
            best_icon = None
            for pattern in icon_patterns:
                match = re.search(pattern, html, re.IGNORECASE)
                if match:
                    icon_path = match.group(1)
                    best_icon = urljoin(url, icon_path)
                    break
            
            if not best_icon:
                parsed_url = urlparse(url)
                best_icon = f"{parsed_url.scheme}://{parsed_url.netloc}/favicon.ico"

            self.logger.info(f"[Branding] ✅ Found {url} -> {best_icon}")
            self._manifest[url] = {'icon_url': best_icon, 'timestamp': str(asyncio.get_event_loop().time())}
            self._save_manifest()
            return best_icon

        except Exception as e:
            self.logger.warning(f"[Branding] ❌ Failed {url}: {e}")
            parsed_url = urlparse(url)
            return f"https://www.google.com/s2/favicons?domain={parsed_url.netloc}&sz=128"

    async def proxy_icon(self, icon_url: str) -> Optional[bytes]:
        """
        Proxies icon bytes with persistent disk caching.
        """
        icon_hash = hashlib.md5(icon_url.encode()).hexdigest()
        ext = os.path.splitext(urlparse(icon_url).path)[1] or ".ico"
        local_path = os.path.join(self.cache_dir, f"{icon_hash}{ext}")

        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                return f.read()

        try:
            response = await self.client.get(icon_url)
            if response.status_code == 200:
                with open(local_path, "wb") as f:
                    f.write(response.content)
                return response.content
            return None
        except Exception as e:
            self.logger.error(f"[Branding] ❌ Proxy Failed {icon_url}: {e}")
            return None

# Singleton instance
branding_service = BrandingService()
