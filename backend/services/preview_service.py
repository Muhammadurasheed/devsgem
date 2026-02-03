import asyncio
import os
from contextlib import asynccontextmanager
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

class PreviewService:
    def __init__(self):
        self.browser = None
        self.playwright = None
        self._lock = asyncio.Lock()

    async def initialize(self):
        """Lazy initialization of browser"""
        if not self.playwright:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=True,
                args=['--no-sandbox', '--disable-setuid-sandbox']
            )
            print("[PreviewService] Browser initialized")

    async def capture_screenshot(self, url: str) -> bytes:
        """Capture a screenshot of the given URL"""
        async with self._lock:
            if not self.browser:
                await self.initialize()

            page = await self.browser.new_page(
                viewport={'width': 1280, 'height': 720},
                device_scale_factor=1
            )
            
            try:
                # [FAANG] Smart Wait
                # Wait for network to be idle (heuristic for "loaded")
                # Timeout after 10s to avoid hanging
                await page.goto(url, wait_until='networkidle', timeout=15000)
                
                # Extra safety buffer for animations
                await page.wait_for_timeout(1000)
                
                screenshot = await page.screenshot(type='jpeg', quality=80)
                return screenshot
                
            except PlaywrightTimeoutError:
                print(f"[PreviewService] Timeout capturing {url}")
                # Try capturing whatever is there even if not fully idle
                return await page.screenshot(type='jpeg', quality=60)
            except Exception as e:
                print(f"[PreviewService] Error capturing {url}: {e}")
                raise e
            finally:
                await page.close()

    async def shutdown(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

# Singleton instance
preview_service = PreviewService()
