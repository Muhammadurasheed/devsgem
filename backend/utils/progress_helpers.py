"""
Progress Helpers - Ensure consistent message delivery across all long-running operations

This module provides utilities for sending progress messages with proper event loop flushing
to ensure real-time updates are delivered to the frontend immediately.
"""

import asyncio
from typing import Optional, Callable, Any


async def send_and_flush(
    message: str,
    callback: Optional[Callable] = None,
    notifier: Any = None,
    stage: str = None,
    progress: int = None
) -> None:
    """
    Send a progress message and force event loop flush for immediate delivery.
    
    This is CRITICAL for real-time UX - without the flush, messages can be 
    delayed or batched, making the interface feel unresponsive.
    
    Args:
        message: The progress message to send
        callback: Optional async callback function for progress updates
        notifier: Optional ProgressNotifier instance
        stage: Optional stage name for the notifier
        progress: Optional progress percentage (0-100)
    """
    # Send via callback
    if callback:
        try:
            if asyncio.iscoroutinefunction(callback):
                await callback(message)
            else:
                callback(message)
        except Exception as e:
            print(f"[Progress] Callback error: {e}")
    
    # Send via notifier
    if notifier and stage:
        try:
            if hasattr(notifier, 'update_progress') and progress is not None:
                await notifier.update_progress(stage, message, progress)
            elif hasattr(notifier, 'send_update'):
                await notifier.send_update(stage, "in-progress", message)
        except Exception as e:
            print(f"[Progress] Notifier error: {e}")
    
    # CRITICAL: Force event loop to flush the message immediately
    # This ensures WebSocket messages are sent before continuing
    await asyncio.sleep(0)


async def send_progress_dict(
    data: dict,
    callback: Optional[Callable] = None
) -> None:
    """
    Send a structured progress update (dict format) with flush.
    
    Args:
        data: Progress data dictionary with stage, progress, message, etc.
        callback: Optional async callback for the progress update
    """
    if callback:
        try:
            if asyncio.iscoroutinefunction(callback):
                await callback(data)
            else:
                callback(data)
        except Exception as e:
            print(f"[Progress] Callback error: {e}")
    
    await asyncio.sleep(0)


async def with_progress(
    operation: Callable,
    before_msg: str,
    after_msg: str,
    callback: Optional[Callable] = None,
    *args, **kwargs
) -> Any:
    """
    Execute an operation with before/after progress messages.
    
    Args:
        operation: Async function to execute
        before_msg: Message to send before operation
        after_msg: Message to send after operation
        callback: Progress callback
        *args, **kwargs: Arguments to pass to the operation
    
    Returns:
        Result of the operation
    """
    await send_and_flush(before_msg, callback)
    
    try:
        result = await operation(*args, **kwargs)
        await send_and_flush(after_msg, callback)
        return result
    except Exception as e:
        await send_and_flush(f"Error: {str(e)}", callback)
        raise


class ProgressReporter:
    """
    Context manager for reporting progress during long operations.
    
    Usage:
        async with ProgressReporter(callback, "Building") as reporter:
            await reporter.update("Step 1 complete", 25)
            await reporter.update("Step 2 complete", 50)
    """
    
    def __init__(self, callback: Optional[Callable] = None, stage: str = "operation"):
        self.callback = callback
        self.stage = stage
        self.progress = 0
    
    async def __aenter__(self):
        await send_and_flush(f"Starting {self.stage}...", self.callback)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            await send_and_flush(f"Completed {self.stage}", self.callback)
        else:
            await send_and_flush(f"Failed: {exc_val}", self.callback)
        return False
    
    async def update(self, message: str, progress: int = None):
        """Update progress with a message and optional percentage."""
        if progress is not None:
            self.progress = progress
        
        if self.callback:
            try:
                if asyncio.iscoroutinefunction(self.callback):
                    await self.callback({
                        'stage': self.stage,
                        'progress': self.progress,
                        'message': message
                    })
                else:
                    self.callback({
                        'stage': self.stage,
                        'progress': self.progress,
                        'message': message
                    })
            except Exception as e:
                print(f"[ProgressReporter] Error: {e}")
        
        await asyncio.sleep(0)
