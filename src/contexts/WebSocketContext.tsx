/**
 * WebSocket Context Provider
 * Maintains a single, persistent WebSocket connection across the entire app
 * Bismillah ar-Rahman ar-Rahim
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { WebSocketClient } from '@/lib/websocket/WebSocketClient';
import { forceNewSessionId } from '@/lib/websocket/config';
import { ConnectionStatus, ServerMessage, ClientMessage, ChatMessage, MessageAction } from '@/types/websocket';
import { toast } from 'sonner';
import { DEPLOYMENT_STAGES } from '@/types/deployment';

interface WebSocketContextValue {
  isConnected: boolean;
  sessionId: string;
  connectionStatus: ConnectionStatus;
  sendMessage: (message: ClientMessage) => boolean;
  onMessage: (handler: (message: ServerMessage) => void) => () => void;
  // Global Chat State
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  isTyping: boolean;
  setIsTyping: (isTyping: boolean) => void;
  thoughtBuffer: string[];
  setThoughtBuffer: React.Dispatch<React.SetStateAction<string[]>>;
  activeDeployment: any | null;
  setActiveDeployment: (deployment: any | null) => void;
  // History management
  sessions: any[];
  refreshSessions: () => Promise<void>;
  switchSession: (sessionId: string) => void;
  renameSession: (sid: string, newTitle: string) => Promise<boolean>;
  resetSession: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    console.log('[WebSocketProvider] 🏗️ Creating WebSocketClient singleton');
    return new WebSocketClient();
  });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    state: 'idle',
  });

  // Global Chat State persistence 
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [thoughtBuffer, setThoughtBuffer] = useState<string[]>([]);
  const [activeDeployment, setActiveDeployment] = useState<any | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const hasReceivedProgressRef = useRef(false);

  useEffect(() => {
    console.log('[WebSocketProvider] 🚀 Initializing app-level WebSocket connection');
    console.log('[WebSocketProvider] 🔍 Checking for duplicate mounts...');

    // Subscribe to connection changes
    const unsubscribe = client.onConnectionChange((status) => {
      console.log('[WebSocketProvider] Connection status:', status.state);
      setConnectionStatus(status);

      // FAANG-style: No toast spam. Let the subtle indicator in the UI show connection status.
      // Only show critical errors that require user action
      if (status.state === 'error' && status.error) {
        toast.error(`Connection Error: ${status.error}`, { duration: 3000 });
      }
    });

    // Connect immediately
    client.connect();

    // Cleanup only when app unmounts (not when components remount)
    return () => {
      console.log('[WebSocketProvider] 🔴 Provider unmounting - cleaning up WebSocket');
      console.log('[WebSocketProvider] 🔍 This should only happen once during app lifetime');
      unsubscribe();
      client.destroy();
    };
  }, [client]); // Only depend on client (which never changes due to useState)

  const sendMessage = useCallback((message: ClientMessage) => {
    return client.sendMessage(message);
  }, [client]);

  const onMessage = useCallback((handler: (message: ServerMessage) => void) => {
    return client.onMessage(handler);
  }, [client]);

  const fetchHistory = useCallback(async (sid: string) => {
    try {
      console.log(`[WebSocketProvider] 🕰️ Fetching history for: ${sid}`);
      const response = await fetch('http://localhost:8000/api/chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sid }),
      });

      if (response.ok) {
        const history = await response.json();
        if (history.messages) {
          const restoredMessages = history.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(restoredMessages);

          if (history.activeDeployment) {
            setActiveDeployment(history.activeDeployment);
          }
        }
      }
    } catch (err) {
      console.warn('[WebSocketProvider] Failed to fetch history:', err);
    }
  }, []);

  // ✅ ETERNAL PERSISTENCE: Restore history on fresh mount
  useEffect(() => {
    const sid = client.getSessionId();
    if (sid) {
      console.log('[WebSocketProvider] 🔄 Restoring persistent session:', sid);
      fetchHistory(sid);
    }
  }, [client, fetchHistory]);

  const refreshSessions = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:8000/api/chat/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.warn('[WebSocketProvider] Failed to fetch sessions:', err);
    }
  }, []);

  const switchSession = useCallback((newSid: string) => {
    console.log(`[WebSocketProvider] 🔄 Switching to session: ${newSid}`);

    // ✅ CRITICAL FIX: Force disconnect before switching ID
    // This ensures the new 'init' handshake sends the NEW session ID
    client.disconnect();

    client.setSessionId(newSid);
    setMessages([]);
    setActiveDeployment(null);
    setThoughtBuffer([]);
    fetchHistory(newSid);

    // Force reconnect with new session (with small delay to allow disconnect cleanup)
    setTimeout(() => {
      client.connect();
    }, 100);
  }, [client, fetchHistory]);

  const renameSession = useCallback(async (sid: string, newTitle: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/chat/sessions/${sid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (response.ok) {
        await refreshSessions();
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[WebSocketProvider] Failed to rename session:', err);
      return false;
    }
  }, [refreshSessions]);

  const resetSession = useCallback(() => {
    // ✅ CRITICAL FIX: Generate truly unique session ID and update localStorage
    const newSid = forceNewSessionId();

    console.log('[WebSocketProvider] 🔄 Resetting session to:', newSid);

    // Force full disconnect to clear backend state
    client.disconnect();

    // Update client session ID
    client.setSessionId(newSid);

    // Clear ALL local state immediately
    setMessages([]);
    setActiveDeployment(null);
    setThoughtBuffer([]);
    setIsTyping(false);

    // Reconnect with fresh session (with small delay to allow disconnect cleanup)
    setTimeout(() => {
      client.connect();
    }, 100);

    toast.info('New Thread Started', {
      description: 'Project context and memory have been cleared.'
    });
  }, [client]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  // ========================================================================
  // Message Processing Logic (Moved from useChat for global persistence)
  // ========================================================================

  const addAssistantMessage = useCallback((data: {
    content: string;
    actions?: MessageAction[];
    metadata?: Record<string, any>;
    data?: any;
    thoughts?: string[];
  }) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      role: 'assistant',
      content: data.content,
      timestamp: new Date(),
      actions: data.actions,
      metadata: data.metadata,
      data: data.data,
      thoughts: data.thoughts,
    };

    setMessages(prev => [...prev, message]);
  }, []);

  const handleServerMessage = useCallback((serverMessage: ServerMessage) => {
    switch (serverMessage.type) {
      case 'typing':
        setIsTyping(true);
        hasReceivedProgressRef.current = false;
        setThoughtBuffer([]);
        break;

      case 'thought':
        const thoughtMsg = serverMessage as any;
        setIsTyping(true);
        setThoughtBuffer(prev => [...prev, thoughtMsg.content]);
        break;

      case 'progress':
        const progMsg = serverMessage as any;
        if (!hasReceivedProgressRef.current) {
          setIsTyping(false);
          hasReceivedProgressRef.current = true;
        }

        setMessages(prevMessages => {
          const lastMsg = prevMessages[prevMessages.length - 1];
          if (lastMsg && lastMsg.metadata?.type === 'progress') {
            const updatedMessages = [...prevMessages];
            updatedMessages[updatedMessages.length - 1] = {
              ...lastMsg,
              content: progMsg.content,
              timestamp: new Date()
            };
            return updatedMessages;
          }
          const message: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            role: 'assistant',
            content: progMsg.content,
            timestamp: new Date(),
            metadata: { type: 'progress', timestamp: new Date().toISOString() }
          };
          return [...prevMessages, message];
        });
        break;

      // ✅ NEW: Handle deployment resume without resetting state
      case 'deployment_resumed':
        setIsTyping(false);
        hasReceivedProgressRef.current = true;
        const resumeData = serverMessage as any;
        console.log('[WebSocket] ✅ Deployment RESUMED, preserving all existing stages');

        setActiveDeployment((prev: any) => {
          if (!prev) {
            // No prior state, initialize fresh
            return {
              deploymentId: resumeData.deployment_id,
              stages: DEPLOYMENT_STAGES.map(s => ({ ...s })),
              currentStage: resumeData.resume_stage || 'env_vars',
              overallProgress: resumeData.resume_progress || 20,
              status: 'deploying',
              startTime: new Date().toISOString()
            };
          }
          // Preserve existing state, just update status
          return {
            ...prev,
            status: 'deploying'
          };
        });
        break;

      case 'deployment_started':
        setIsTyping(false);
        hasReceivedProgressRef.current = true;
        const deployStart = serverMessage as any;
        const deploymentStartTime = new Date().toISOString();

        // ✅ FAANG-LEVEL FIX: Preserve ALL accumulated stage details across resumption
        // The issue was: after .env upload, a new deployment_id was generated
        // which caused complete state reset. Now we preserve stage details if deployment is active.
        setActiveDeployment((prev: any) => {
          // If we have existing progress with completed stages, preserve ALL details
          const hasExistingProgress = prev && prev.overallProgress > 0;
          const hasCompletedStages = prev?.stages?.some((s: any) => s.status === 'success' || s.details?.length > 0);

          if (hasExistingProgress || hasCompletedStages) {
            console.log('[WebSocket] ✅ Resuming deployment, PRESERVING all stage details');
            console.log('[WebSocket] Existing stages with details:',
              prev?.stages?.filter((s: any) => s.details?.length > 0).map((s: any) => s.id)
            );
            return {
              ...prev,
              deploymentId: deployStart.deployment_id, // Update to new ID
              status: 'deploying',
              // Keep ALL existing stages with their accumulated details
            };
          }

          // Only fully reset for genuinely new deployments (no prior state)
          console.log('[WebSocket] Starting fresh deployment:', deployStart.deployment_id);
          return {
            deploymentId: deployStart.deployment_id,
            stages: DEPLOYMENT_STAGES.map(s => ({ ...s })),
            currentStage: deployStart.resume_stage || 'repo_clone',
            overallProgress: deployStart.resume_progress || 0,
            status: 'deploying',
            startTime: deploymentStartTime
          };
        });

        addAssistantMessage({
          content: `Starting deployment to Cloud Run...`,
          metadata: {
            type: 'deployment_started',
            deployment_id: deployStart.deployment_id,
            showLogs: true,
            startTime: deploymentStartTime
          }
        });
        break;

      case 'deployment_progress':
        if (!hasReceivedProgressRef.current) {
          setIsTyping(false);
          hasReceivedProgressRef.current = true;
        }
        const deployProg = serverMessage as any;

        // Handle unwrapped payload if needed (though progress notifier uses top-level fields)
        // Backend sends { type: 'deployment_progress', stage: '...', ... } NOT wrapped in data

        setActiveDeployment((prev: any) => {
          if (!prev) return prev;
          const updatedStages = prev.stages.map((stage: any) => {
            if (stage.id === deployProg.stage) {
              return {
                ...stage,
                status: deployProg.status,
                message: deployProg.message,
                details: deployProg.details ? Object.entries(deployProg.details).map(([k, v]) => `${k}: ${v}`) : stage.details,
                endTime: deployProg.status === 'success' || deployProg.status === 'error' ? new Date().toISOString() : stage.endTime,
                startTime: stage.startTime || new Date().toISOString()
              };
            }
            return stage;
          });
          const completedStages = updatedStages.filter((s: any) => s.status === 'success');
          // ✅ WEIGHTED PROGRESS: Use weights for accuracy
          const totalWeight = DEPLOYMENT_STAGES.reduce((sum, s) => sum + (s.weight || 0), 0) || 100;
          const currentWeight = completedStages.reduce((sum: number, s: any) => {
            // Find original stage definition to get static weight
            const def = DEPLOYMENT_STAGES.find(ds => ds.id === s.id);
            return sum + (def?.weight || 0);
          }, 0);

          // Add partial progress for current stage (max 50% of its weight)
          const currentStageDef = DEPLOYMENT_STAGES.find(s => s.id === deployProg.stage);
          // Only add partial if receiving updates, simplistic "halfway through" assumption or small increments?
          // For now, raw completed weight is safer for stability, or we can add a small buffer?
          // Let's stick to completed weight to avoid jumping backward, maybe add 10% of current stage weight for "in-progress"
          const inProgressWeight = (currentStageDef?.weight || 0) * 0.1;

          return {
            ...prev,
            stages: updatedStages,
            currentStage: deployProg.stage,
            overallProgress: Math.min(Math.round(((currentWeight + inProgressWeight) / totalWeight) * 100), 99),
            status: deployProg.status === 'error' ? 'failed' : prev.status,
            startTime: prev.startTime  // ✅ CRITICAL FIX: Always preserve original startTime!
          };
        });
        break;

      case 'message':
        setIsTyping(false);
        hasReceivedProgressRef.current = true;

        // ✅ CRITICAL FIX: Robust Data Extraction
        // Handle both { type: 'message', data: {...} } AND { type: 'message', ...content }
        const rawMsg = serverMessage as any;
        const msgData = rawMsg.data || rawMsg;

        // Check for analysis type from Orchestrator response
        const isAnalysis = msgData.type === 'analysis' || msgData.type === 'analysis_report' || msgData.metadata?.type === 'analysis_report';
        const analysisPayload = isAnalysis ? (msgData.data || msgData.analysis || rawMsg.analysis) : null;

        addAssistantMessage({
          content: msgData.content,
          actions: msgData.actions,
          metadata: {
            ...msgData.metadata,
            type: (isAnalysis) ? 'analysis_report' : (msgData.metadata?.type || 'message'),
            request_env_vars: msgData.metadata?.request_env_vars || msgData.request_env_vars,
            detected_env_vars: msgData.metadata?.detected_env_vars || msgData.detected_env_vars
          },

          data: analysisPayload,
          thoughts: [...thoughtBuffer]
        });
        setThoughtBuffer([]);
        // ✅ REFRESH HISTORY: Update titles/timestamps in sidebar immediately
        refreshSessions();
        break;

      case 'deployment_complete':
        setIsTyping(false);
        // ✅ ROBUST: Handle both { data: {...} } and flat payload structures
        const deployCompleteRaw = serverMessage as any;
        const deployData = deployCompleteRaw.data || deployCompleteRaw;
        // ✅ FAANG-LEVEL: Multiple success indicators for reliability
        const isSuccess = deployData?.status === 'success' ||
          deployData?.success === true ||
          (!deployData?.error && deployData?.url);
        const deployedUrl = deployData?.url || deployData?.deployment_url || deployCompleteRaw?.url;

        setActiveDeployment((prev: any) => {
          if (!prev) return prev;
          // ✅ CRITICAL FIX: Include deploymentUrl for confetti trigger in DeploymentProgress.tsx
          return {
            ...prev,
            status: isSuccess ? 'success' : 'failed',
            overallProgress: 100,
            deploymentUrl: deployedUrl  // ✅ Required for confetti trigger
          };
        });
        addAssistantMessage({
          content: isSuccess ? `## 🎉 Deployment Successful!\n\n${deployData.message || 'Your app is live!'}` : `## ❌ Deployment Failed\n\n${deployData.error || 'Build or deployment failed.'}`,
          actions: isSuccess ? [
            { id: 'view_logs', label: '📊 View Logs', type: 'button', action: 'view_logs' },
            { id: 'setup_cicd', label: '🔄 Set Up CI/CD', type: 'button', action: 'setup_cicd' },
          ] : undefined,
          metadata: { type: 'deployment_complete', url: deployedUrl },
          // ✅ CRITICAL: Pass deploymentUrl directly for confetti detection
          ...(deployedUrl ? { deploymentUrl: deployedUrl } : {})
        } as any);
        break;

      case 'error':
        setIsTyping(false);
        addAssistantMessage({
          content: `❌ **Error:** ${(serverMessage as any).message}`,
          metadata: { type: 'error' }
        });
        break;
    }
  }, [addAssistantMessage, thoughtBuffer]);

  useEffect(() => {
    const unsub = client.onMessage(handleServerMessage);
    return unsub;
  }, [client, handleServerMessage]);

  const value: WebSocketContextValue = {
    isConnected: connectionStatus.state === 'connected',
    sessionId: client.getSessionId(),
    connectionStatus,
    sendMessage,
    onMessage,
    messages,
    setMessages,
    isTyping,
    setIsTyping,
    thoughtBuffer,
    setThoughtBuffer,
    activeDeployment,
    setActiveDeployment,
    sessions,
    refreshSessions,
    switchSession,
    renameSession,
    resetSession,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}
