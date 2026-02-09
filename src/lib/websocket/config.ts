/**
 * WebSocket Configuration
 * Production-grade configuration with sensible defaults
 */

import { WebSocketConfig } from '@/types/websocket';

// ============================================================================
// Environment Configuration
// ============================================================================

import { WS_URL } from '@/lib/api/config';

// ============================================================================
// Environment Configuration
// ============================================================================

const getWebSocketUrl = (): string => {
  return WS_URL;
};

// ============================================================================
// WebSocket Configuration
// ============================================================================

export const WS_CONFIG: WebSocketConfig = {
  url: getWebSocketUrl(),

  // Reconnection strategy with exponential backoff
  reconnect: {
    enabled: true,
    maxAttempts: 10,
    initialDelay: 1000,      // 1 second
    maxDelay: 30000,         // 30 seconds max
    backoffMultiplier: 1.5,  // 1s → 1.5s → 2.25s → 3.37s → 5s → ...
  },

  // Heartbeat to detect dead connections
  heartbeat: {
    enabled: true,
    interval: 30000,  // Ping every 30 seconds
    timeout: 5000,    // Expect pong within 5 seconds
  },

  // Message queue for offline scenarios
  messageQueue: {
    enabled: true,
    maxSize: 50,  // Store up to 50 messages
  },
};

// ============================================================================
// Constants
// ============================================================================

export const SESSION_ID_KEY = 'servergem_session_id';
export const MAX_MESSAGE_LENGTH = 10000; // 10KB max message size
export const CONNECTION_TIMEOUT = 10000; // 10 second connection timeout

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a unique session ID
 */
export const generateSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Get or create session ID
 */
export const getSessionId = (): string => {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
};

/**
 * Clear session ID (for logout/reset)
 */
export const clearSessionId = (): void => {
  localStorage.removeItem(SESSION_ID_KEY);
};

/**
 * Force generate a new session ID - for "New Thread" functionality
 * This ensures complete session isolation
 */
export const forceNewSessionId = (): string => {
  const sessionId = generateSessionId();
  localStorage.setItem(SESSION_ID_KEY, sessionId);
  console.log('[WebSocket Config] 🆕 Forced new session ID:', sessionId);
  return sessionId;
};
