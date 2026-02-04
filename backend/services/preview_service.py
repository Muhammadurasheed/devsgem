import asyncio
import os
from contextlib import asynccontextmanager
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

class PreviewService:
    def __init__(self):
        self.browser = None
        self.playwright = None
        self._lock = asyncio.Lock()
        self.available = True
        self.storage_dir = os.path.join(os.getcwd(), "previews")
        os.makedirs(self.storage_dir, exist_ok=True)

    async def initialize(self):
        """Lazy initialization of browser with fail-safe check"""
        if not self.available:
            return False
            
        if not self.playwright:
            try:
                self.playwright = await async_playwright().start()
                self.browser = await self.playwright.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-setuid-sandbox']
                )
                print("[PreviewService] [SUCCESS] Browser initialized")
                return True
            except NotImplementedError:
                print("[PreviewService] [WARN] Subprocess support unavailable on this host (Windows/Loop mismatch). Switching to Hybrid Fallback.")
                self.available = False
                return False
            except Exception as e:
                print(f"[PreviewService] [ERROR] Browser init failed: {e}")
                self.available = False
                return False
        return True

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
                await page.goto(url, wait_until='networkidle', timeout=15000)
                await page.wait_for_timeout(1000)
                
                screenshot = await page.screenshot(type='jpeg', quality=80)
                return screenshot
                
            except PlaywrightTimeoutError:
                print(f"[PreviewService] Timeout capturing {url}")
                return await page.screenshot(type='jpeg', quality=60)
            except Exception as e:
                print(f"[PreviewService] Error capturing {url}: {e}")
                raise e
            finally:
                await page.close()

    async def generate_preview(self, url: str, deployment_id: str):
        """
        Generate and save preview to disk with robust retry logic.
        [FAANG] Uses exponential backoff to handle transient service startup delays.
        """
        max_retries = 3
        base_delay = 5
        
        for attempt in range(max_retries):
            try:
                print(f"[PreviewService] Capture attempt {attempt + 1} for {url}")
                screenshot = await self.capture_screenshot(url)
                
                file_path = os.path.join(self.storage_dir, f"{deployment_id}.png")
                with open(file_path, "wb") as f:
                    f.write(screenshot)
                
                print(f"[PreviewService] [SUCCESS] Saved preview for {deployment_id}")
                return file_path
                
            except Exception as e:
                print(f"[PreviewService] Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    wait_time = base_delay * (2 ** attempt)
                    print(f"[PreviewService] Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    print(f"[PreviewService] [CRITICAL] All capture attempts failed for {deployment_id}")
                    return None

    async def get_latest_preview(self, deployment_id: str) -> str:
        """Get path to the latest preview file"""
        file_path = os.path.join(self.storage_dir, f"{deployment_id}.png")
        if os.path.exists(file_path):
            return file_path
        return None

    async def shutdown(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

# Singleton instance
preview_service = PreviewService()
