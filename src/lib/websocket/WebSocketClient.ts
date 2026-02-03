/**
 * WebSocket Client Implementation
 * Production-grade WebSocket manager with:
 * - Exponential backoff reconnection
 * - Heartbeat/ping-pong
 * - Message queueing
 * - Type safety
 * - Event-driven architecture
 */

import {
  ClientMessage,
  ServerMessage,
  ConnectionState,
  ConnectionStatus,
  WebSocketConfig,
} from '@/types/websocket';
import { WS_CONFIG, getSessionId } from './config';

type EventHandler<T = any> = (data: T) => void;

// Singleton instance tracker to prevent multiple clients
let activeClientInstance: WebSocketClient | null = null;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string;
  private config: WebSocketConfig;
  private instanceId: string;

  // Connection state
  private connectionStatus: ConnectionStatus = {
    state: 'idle',
  };

  // Reconnection management
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isIntentionalClose = false;

  // Heartbeat management
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatTimeoutTimer: NodeJS.Timeout | null = null;

  // Message queue for offline scenarios
  private messageQueue: ClientMessage[] = [];

  // Event handlers
  private eventHandlers: {
    message: Set<EventHandler<ServerMessage>>;
    error: Set<EventHandler<Error>>;
    connectionChange: Set<EventHandler<ConnectionStatus>>;
  } = {
      message: new Set(),
      error: new Set(),
      connectionChange: new Set(),
    };

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.instanceId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.config = { ...WS_CONFIG, ...config };
    this.sessionId = getSessionId();

    // Track active instance for debugging
    if (activeClientInstance) {
      console.warn('[WebSocket] ⚠️ Multiple WebSocketClient instances detected!');
      console.warn('[WebSocket] Previous instance:', activeClientInstance.instanceId);
      console.warn('[WebSocket] New instance:', this.instanceId);
    }
    activeClientInstance = this;

    console.log('[WebSocket] 🆕 Created new client instance:', this.instanceId);
    console.log('[WebSocket] 🔑 Persistent session ID:', this.sessionId);
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Connect to WebSocket server
   */
  public connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
      console.log('[WebSocket] Connection already in progress');
      return;
    }

    this.isIntentionalClose = false;
    this.updateConnectionStatus('connecting');

    console.log('[WebSocket] 🔌 Connecting... (instance:', this.instanceId, 'session:', this.sessionId, ')');

    try {
      // Get API key and GitHub token from localStorage
      const apiKey = localStorage.getItem('servergemApiKey') || '';
      const githubToken = localStorage.getItem('servergem_github_token') || '';

      const params = new URLSearchParams();
      if (apiKey) params.append('api_key', apiKey);
      if (githubToken) params.append('github_token', githubToken);

      const queryString = params.toString();
      const url = queryString ? `${this.config.url}?${queryString}` : this.config.url;

      console.log('[WebSocket] Connecting with API key:', apiKey ? 'Yes' : 'No');
      this.ws = new WebSocket(url);
      this.setupEventHandlers();

      // Connection timeout
      const timeout = setTimeout(() => {
        if (this.connectionStatus.state === 'connecting') {
          console.error('[WebSocket] Connection timeout');
          this.ws?.close();
          this.handleReconnect();
        }
      }, 10000);

      this.ws.addEventListener('open', () => clearTimeout(timeout), { once: true });

    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.updateConnectionStatus('error', (error as Error).message);
      this.emitError(error as Error);
      this.handleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    console.log('[WebSocket] ⚠️ Disconnect requested');
    console.log('[WebSocket] Call stack:', new Error().stack);
    this.isIntentionalClose = true;
    this.cleanup();
    this.updateConnectionStatus('disconnected');
  }

  /**
   * Send message to server
   * Returns true if sent, false if queued
   */
  public sendMessage(message: ClientMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Not connected, queueing message');

      if (this.config.messageQueue.enabled) {
        this.queueMessage(message);
        return false;
      }

      throw new Error('WebSocket not connected and message queue disabled');
    }

    try {
      this.ws.send(JSON.stringify(message));
      console.log('[WebSocket] Sent message:', message.type);
      return true;
    } catch (error) {
      console.error('[WebSocket] Send error:', error);
      this.emitError(error as Error);
      return false;
    }
  }

  /**
   * Register message handler
   * Returns unsubscribe function
   */
  public onMessage(handler: EventHandler<ServerMessage>): () => void {
    this.eventHandlers.message.add(handler);
    return () => this.eventHandlers.message.delete(handler);
  }

  /**
   * Register error handler
   * Returns unsubscribe function
   */
  public onError(handler: EventHandler<Error>): () => void {
    this.eventHandlers.error.add(handler);
    return () => this.eventHandlers.error.delete(handler);
  }

  /**
   * Register connection status change handler
   * Returns unsubscribe function
   */
  public onConnectionChange(handler: EventHandler<ConnectionStatus>): () => void {
    this.eventHandlers.connectionChange.add(handler);
    return () => this.eventHandlers.connectionChange.delete(handler);
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get public session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Set session ID
   */
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
    localStorage.setItem('servergem_session_id', sessionId);
  }

  /**
   * Update user identity on active connection
   * [FAANG] prevents "user_default" orphans by syncing identity post-login
   */
  public updateUser(user: any): void {
    if (!this.isConnected()) {
      // If not connected, the init message will pick it up on connect
      return; 
    }
    
    console.log('[WebSocket] 👤 Updating user identity:', user?.id);
    this.sendMessage({
      type: 'identify',
      user_id: user?.id,
      user: user,
      session_id: this.sessionId,
      timestamp: new Date().toISOString()
    });
  }

  // ========================================================================
  // Private Methods - WebSocket Event Handlers
  // ========================================================================

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.addEventListener('open', this.handleOpen.bind(this));
    this.ws.addEventListener('message', this.handleMessage.bind(this));
    this.ws.addEventListener('error', this.handleError.bind(this));
    this.ws.addEventListener('close', this.handleClose.bind(this));
  }

  private handleOpen(): void {
    console.log('[WebSocket] ✅ Connected successfully to server');
    console.log('[WebSocket] 🆔 Instance ID:', this.instanceId);
    console.log('[WebSocket] 🔑 Session ID (persistent):', this.sessionId);
    console.log('[WebSocket] 🔄 Reconnect attempt:', this.reconnectAttempts);

    // Save reconnect status BEFORE resetting
    const wasReconnect = this.reconnectAttempts > 0;
    this.reconnectAttempts = 0;
    this.updateConnectionStatus('connected', undefined, wasReconnect ? 1 : 0);

    // Send init message with persistent session_id and authenticated user_id
    // [FAANG] Unify identity by propagating local user info to backend
    const storedUser = localStorage.getItem('servergem_user');
    let user = null;
    try {
      if (storedUser) {
        user = JSON.parse(storedUser);
      }
    } catch (e) {
      console.warn('[WebSocket] Failed to parse stored user for identity unification', e);
    }

    this.sendMessage({
      type: 'init',
      user_id: user?.id, // CRITICAL: Bridges the auth-persistence gap
      user: user, // [FAANG] Pass full user info for auto-registration
      session_id: this.sessionId, // This persists across reconnections!
      instance_id: this.instanceId, // For debugging
      is_reconnect: wasReconnect, // Now correctly reports reconnections!
      metadata: {
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    // Start heartbeat
    if (this.config.heartbeat.enabled) {
      console.log('[WebSocket] 🏓 Starting heartbeat (15s interval, 30s timeout)');
      this.startHeartbeat();
    }

    // Send queued messages
    if (this.messageQueue.length > 0) {
      console.log(`[WebSocket] 📤 Flushing ${this.messageQueue.length} queued messages`);
      this.flushMessageQueue();
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: ServerMessage = JSON.parse(event.data);
      console.log('[WebSocket] Received message:', message.type);

      // Handle pong for heartbeat
      if (message.type === 'pong') {
        this.handlePong();
        return;
      }

      // Emit to all message handlers
      this.eventHandlers.message.forEach(handler => {
        try {
          // ANY message from server is proof of life - reset the heartbeat watchdog
          if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
            console.log('[WebSocket] Watchdog reset - activity detected');
          }

          handler(message);
        } catch (error) {
          console.error('[WebSocket] Message handler error:', error);
        }
      });

    } catch (error) {
      console.error('[WebSocket] Message parse error:', error);
      this.emitError(new Error('Failed to parse server message'));
    }
  }

  private handleError(event: Event): void {
    console.error('[WebSocket] WebSocket error:', event);
    const error = new Error('WebSocket connection error');
    this.emitError(error);
  }

  private handleClose(event: CloseEvent): void {
    console.log('[WebSocket] 🔌 Connection closed');
    console.log('[WebSocket] Close code:', event.code);
    console.log('[WebSocket] Close reason:', event.reason || 'No reason provided');
    console.log('[WebSocket] Was intentional:', this.isIntentionalClose);

    this.stopHeartbeat();

    if (!this.isIntentionalClose) {
      console.log('[WebSocket] 🔄 Connection lost, will attempt to reconnect...');
      this.updateConnectionStatus('reconnecting');
      this.handleReconnect();
    } else {
      console.log('[WebSocket] ✅ Clean disconnect');
      this.updateConnectionStatus('disconnected');
    }
  }

  // ========================================================================
  // Private Methods - Reconnection
  // ========================================================================

  private handleReconnect(): void {
    if (!this.config.reconnect.enabled || this.isIntentionalClose) {
      return;
    }

    if (this.reconnectAttempts >= this.config.reconnect.maxAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.updateConnectionStatus('error', 'Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.calculateBackoffDelay();

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.reconnect.maxAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      console.log('[WebSocket] Attempting reconnect...');
      this.connect();
    }, delay);

    this.updateConnectionStatus('reconnecting', undefined, this.reconnectAttempts);
  }

  private calculateBackoffDelay(): number {
    const { initialDelay, maxDelay, backoffMultiplier } = this.config.reconnect;
    const delay = initialDelay * Math.pow(backoffMultiplier, this.reconnectAttempts - 1);
    return Math.min(delay, maxDelay);
  }

  // ========================================================================
  // Private Methods - Heartbeat
  // ========================================================================

  private startHeartbeat(): void {
    this.stopHeartbeat();

    // ✅ CRITICAL FIX: Extended intervals for long-running deployments
    // Cloud Build can take 5-10 minutes, don't disconnect during builds
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        console.log('[WebSocket] 🏓 Sending heartbeat ping');
        this.sendMessage({
          type: 'ping',
          timestamp: new Date().toISOString(),
        });

        // ✅ 5 minute timeout for deployment operations
        // Backend may be busy building containers, analyzing code, deploying etc.
        this.heartbeatTimeoutTimer = setTimeout(() => {
          console.warn('[WebSocket] ⚠️ Heartbeat timeout after 5 minutes - reconnecting...');
          this.ws?.close();
        }, 300000); // 5 minute timeout - FAANG-level patience for deployments
      }
    }, 30000); // Ping every 30 seconds (Standard heartbeat)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  private handlePong(): void {
    console.log('[WebSocket] 🏓 Received pong - connection healthy');
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
  }

  // ========================================================================
  // Private Methods - Message Queue
  // ========================================================================

  private queueMessage(message: ClientMessage): void {
    if (this.messageQueue.length >= this.config.messageQueue.maxSize) {
      console.warn('[WebSocket] Message queue full, dropping oldest message');
      this.messageQueue.shift();
    }

    this.messageQueue.push(message);
    console.log(`[WebSocket] Message queued (${this.messageQueue.length}/${this.config.messageQueue.maxSize})`);
  }

  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`[WebSocket] Flushing ${this.messageQueue.length} queued messages`);

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    queue.forEach(message => {
      this.sendMessage(message);
    });
  }

  // ========================================================================
  // Private Methods - State Management
  // ========================================================================

  private updateConnectionStatus(
    state: ConnectionState,
    error?: string,
    reconnectAttempt?: number
  ): void {
    this.connectionStatus = {
      state,
      error,
      reconnectAttempt,
      lastConnected: state === 'connected' ? new Date() : this.connectionStatus.lastConnected,
    };

    console.log('[WebSocket] Connection status:', this.connectionStatus);

    // Emit to all connection change handlers
    this.eventHandlers.connectionChange.forEach(handler => {
      try {
        handler(this.connectionStatus);
      } catch (error) {
        console.error('[WebSocket] Connection change handler error:', error);
      }
    });
  }

  private emitError(error: Error): void {
    this.eventHandlers.error.forEach(handler => {
      try {
        handler(error);
      } catch (err) {
        console.error('[WebSocket] Error handler error:', err);
      }
    });
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  private cleanup(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Destroy the client and cleanup all resources
   */
  public destroy(): void {
    console.log('[WebSocket] 💥 Destroying client instance:', this.instanceId);
    this.isIntentionalClose = true;
    this.cleanup();
    this.eventHandlers.message.clear();
    this.eventHandlers.error.clear();
    this.eventHandlers.connectionChange.clear();
    this.messageQueue = [];

    // Clear singleton reference if this is the active instance
    if (activeClientInstance === this) {
      activeClientInstance = null;
    }
  }
}
