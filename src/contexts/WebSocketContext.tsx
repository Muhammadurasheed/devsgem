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
import { DEPLOYMENT_STAGES, DeploymentProgress } from '@/types/deployment';
import { authService } from '@/lib/auth';

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
  activeDeployment: DeploymentProgress | null;
  setActiveDeployment: (deployment: DeploymentProgress | null) => void;
  // History management
  sessions: any[];
  refreshSessions: () => Promise<void>;
  switchSession: (sessionId: string) => void;
  renameSession: (sid: string, newTitle: string) => Promise<boolean>;
  resetSession: () => void;
  // UI State
  isChatWindowOpen: boolean;
  toggleChatWindow: (isOpen?: boolean) => void;
  reconnect: () => void;
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
  const [activeDeployment, setActiveDeployment] = useState<DeploymentProgress | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isChatWindowOpen, setIsChatWindowOpen] = useState(false);
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

    // [FAANG] Identity Sync: Listen for auth changes and update socket identity
    const authUnsubscribe = authService.subscribe((user) => {
      console.log('[WebSocketProvider] 🔐 Auth state changed, syncing identity...');
      client.updateUser(user);
    });

    // Cleanup only when app unmounts (not when components remount)
    return () => {
      console.log('[WebSocketProvider] 🔴 Provider unmounting - cleaning up WebSocket');
      console.log('[WebSocketProvider] 🔍 This should only happen once during app lifetime');
      authUnsubscribe();
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

  const toggleChatWindow = useCallback((isOpen?: boolean) => {
    setIsChatWindowOpen(prev => isOpen === undefined ? !prev : isOpen);
  }, []);

  const reconnect = useCallback(() => {
    console.log('[WebSocketProvider] 🔄 Manual reconnection requested');
    client.disconnect();
    setTimeout(() => {
      client.connect();
    }, 100);
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

  // ========================================================================
  // [FAANG] NEURO-STREAM ENGINE (Playback Queue)
  // ========================================================================
  const playbackQueue = useRef<any[]>([]);
  const isProcessingQueue = useRef(false);

  // The Heartbeat: Processes the queue with "cinematic" timing
  const processQueue = useCallback(() => {
    if (playbackQueue.current.length === 0) {
      isProcessingQueue.current = false;
      return;
    }

    isProcessingQueue.current = true;
    const item = playbackQueue.current[0]; // Peek

    // [FAANG] Variable Pacing Logic
    let delay = 30; // Default: Fast but readable
    const backlog = playbackQueue.current.length;

    // 1. "Thought" moments - Pause to let user read the insight
    if (item.type === 'ai_thought') {
      delay = 800; // 0.8s for thoughts
    }
    // 2. "Catch up" mode - If backlog is huge, speed up significantly
    else if (backlog > 50) {
      delay = 5; // Hyper-speed
    } else if (backlog > 20) {
      delay = 15; // Fast forward
    }
    // 3. "Cinematic" typing mode - Rhythmic flow with organic jitter
    else {
      // [FAANG] Organic Jitter: 20ms - 50ms variability
      // This prevents the "metronome" feel and feels like a fast typist
      const base = 30;
      const jitter = Math.floor(Math.random() * 30); // 0-29ms
      delay = base + jitter;
    }

    // Apply the update
    applyUpdate(item);

    // Remove processed item
    playbackQueue.current.shift();

    // Schedule next frame
    setTimeout(processQueue, delay);
  }, []); // Dependencies will be handled via refs/functional updates

  const enqueueItem = useCallback((item: any) => {
    playbackQueue.current.push(item);
    if (!isProcessingQueue.current) {
      processQueue();
    }
  }, [processQueue]);

  // The "Renderer": Applies a single atomic update to the state
  const applyUpdate = (serverMessage: any) => {
    // setIsTyping(true); // Keep typing active while processing

    switch (serverMessage.type) {
      case 'monitoring_alert':
        const alert = serverMessage as any;
        addAssistantMessage({
          content: `### 🚨 Proactive Health Alert\n\n${alert.message}`,
          metadata: {
            type: 'monitoring_alert',
            deployment_id: alert.deployment_id,
            alert_type: alert.alert_type,
            meta: alert.metadata
          },
          actions: [
            { id: 'view_metrics', label: '📊 View Metrics', type: 'button', url: `/dashboard/monitor/${alert.deployment_id}` },
            { id: 'fix_it', label: '🛠️ AI Optimization', type: 'button', action: `Analyze and optimize ${alert.service_name} for ${alert.alert_type} issues` }
          ]
        });
        toast.warning(alert.message, { description: `Service Health: ${alert.service_name}` });
        break;

      case 'typing':
        setIsTyping(true);
        hasReceivedProgressRef.current = false;
        setThoughtBuffer([]);
        break;

      case 'ai_thought':
        const thoughtMsg = serverMessage as any;
        // console.log('[WebSocket] 🧠 AI Thought:', thoughtMsg.content || thoughtMsg.message);
        setIsTyping(true);
        const thoughtContent = thoughtMsg.content || thoughtMsg.message;
        const thoughtStageId = thoughtMsg.stage_id;

        setThoughtBuffer(prev => [...prev, thoughtContent]);

        setActiveDeployment((prev: any) => {
          if (!prev) return prev;
          const updatedThoughts = [...(prev.thoughts || []), thoughtContent];

          // Inject thought into stage history [NEURO-LOG]
          let updatedStages = prev.stages;
          if (thoughtStageId) {
            updatedStages = prev.stages.map((stage: any) => {
              if (stage.id === thoughtStageId) {
                const existingDetails = stage.details || [];
                const aiLogEntry = `[AI] ${thoughtContent}`;
                return { ...stage, details: [...existingDetails, aiLogEntry] };
              }
              return stage;
            });
          }

          return {
            ...prev,
            lastThought: thoughtContent,
            thoughts: updatedThoughts,
            stages: updatedStages
          };
        });
        break;

      case 'progress':
        const progMsg = serverMessage as any;
        if (!hasReceivedProgressRef.current) {
          setIsTyping(false);
          hasReceivedProgressRef.current = true;
        }
        setMessages(prevMessages => {
          const lastMsg = prevMessages[prevMessages.length - 1];
          // Update valid progress message
          if (lastMsg && lastMsg.metadata?.type === 'progress') {
            const updatedMessages = [...prevMessages];
            updatedMessages[updatedMessages.length - 1] = {
              ...lastMsg,
              content: progMsg.content,
              timestamp: new Date()
            };
            return updatedMessages;
          }
          return [...prevMessages, {
            id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            role: 'assistant',
            content: progMsg.content,
            timestamp: new Date(),
            metadata: { type: 'progress', timestamp: new Date().toISOString() }
          }];
        });
        break;

      case 'deployment_resumed':
        setIsTyping(false);
        hasReceivedProgressRef.current = true;
        const resumeData = serverMessage as any;

        setActiveDeployment((prev: DeploymentProgress | null) => {
          if (!prev) {
            return {
              deploymentId: resumeData.deployment_id,
              stages: DEPLOYMENT_STAGES.map(s => ({ ...s })),
              currentStage: resumeData.resume_stage || 'env_vars',
              overallProgress: resumeData.resume_progress || 20,
              status: 'deploying',
              startTime: new Date().toISOString()
            };
          }
          return { ...prev, status: 'deploying' };
        });
        break;

      case 'deployment_started':
        setIsTyping(false);
        hasReceivedProgressRef.current = true;
        const deployStart = serverMessage as any;
        const deploymentStartTime = new Date().toISOString();

        setActiveDeployment((prev: DeploymentProgress | null) => {
          const hasExisting = prev && prev.overallProgress > 0;
          if (hasExisting) {
            return { ...prev, deploymentId: deployStart.deployment_id, status: 'deploying' };
          }
          return {
            deploymentId: deployStart.deployment_id,
            stages: DEPLOYMENT_STAGES.map(s => ({ ...s })),
            currentStage: deployStart.resume_stage || 'repo_clone',
            overallProgress: deployStart.resume_progress || 0,
            status: 'deploying',
            startTime: deploymentStartTime
          };
        });

        // Add start message to chat
        setMessages(prev => {
          const exists = prev.some(m => m.metadata?.deployment_id === deployStart.deployment_id);
          if (exists) return prev;

          return [...prev, {
            id: `msg_deploy_${deployStart.deployment_id}`,
            role: 'assistant',
            content: deployStart.message || `Starting deployment...`,
            timestamp: new Date(),
            metadata: {
              type: 'deployment_started',
              deployment_id: deployStart.deployment_id,
              showLogs: true,
              startTime: deploymentStartTime
            }
          }];
        });
        break;

      case 'deployment_progress':
        if (!hasReceivedProgressRef.current) {
          setIsTyping(false);
          hasReceivedProgressRef.current = true;
        }
        const deployProg = serverMessage as any;

        setActiveDeployment((prev: DeploymentProgress | null) => {
          if (!prev) return prev;

          const updatedStages = prev.stages.map((stage: any) => {
            if (stage.id === deployProg.stage) {
              // [FAANG] Log Accumulator
              let currentDetails = stage.details || [];
              let newDetails = deployProg.details || [];

              if (!Array.isArray(newDetails)) {
                newDetails = Object.entries(newDetails).map(([k, v]) => `${k}: ${v}`);
              }
              const updatedDetails = [...new Set([...currentDetails, ...newDetails])];

              const currentStatus = stage.status;
              const nextStatus = (currentStatus === 'success' || currentStatus === 'error')
                ? currentStatus
                : deployProg.status;

              return {
                ...stage,
                status: nextStatus,
                message: deployProg.message || stage.message,
                details: updatedDetails,
                endTime: (nextStatus === 'success' || nextStatus === 'error') ? (stage.endTime || new Date().toISOString()) : stage.endTime,
                startTime: stage.startTime || new Date().toISOString()
              };
            }
            return stage;
          });

          // [FAANG] Fluid Progress Calculation
          const totalWeight = DEPLOYMENT_STAGES.reduce((sum, s) => sum + (s.weight || 0), 0) || 100;
          const completedWeight = updatedStages
            .filter((s: any) => s.status === 'success')
            .reduce((sum, s) => sum + (DEPLOYMENT_STAGES.find(ds => ds.id === s.id)?.weight || 0), 0);

          const currentStageDef = DEPLOYMENT_STAGES.find(s => s.id === deployProg.stage);
          const currentStageWeight = currentStageDef?.weight || 0;
          const incomingSubProgress = deployProg.progress !== undefined ? deployProg.progress : 10;

          const isStageActuallyDone = updatedStages.find((s: any) => s.id === deployProg.stage)?.status === 'success';
          const partialWeight = (deployProg.status === 'in-progress' && !isStageActuallyDone)
            ? (currentStageWeight * (incomingSubProgress / 100))
            : 0;

          const calculatedProgress = Math.round(((completedWeight + partialWeight) / totalWeight) * 100);
          const currentDisplay = prev.overallProgress;
          const nextProgress = Math.max(currentDisplay, calculatedProgress);
          const finalProgress = currentDisplay === 0 ? 1 : nextProgress;

          const lastStageSuccess = updatedStages.find(s => s.id === 'cloud_deployment')?.status === 'success';
          const isComplete = lastStageSuccess;

          return {
            ...prev,
            stages: updatedStages,
            currentStage: deployProg.stage,
            overallProgress: isComplete ? 100 : Math.min(finalProgress, 99),
            status: isComplete ? 'success' : (deployProg.status === 'error' ? 'failed' : prev.status),
            startTime: prev.startTime,
            deploymentUrl: deployProg.deploymentUrl || prev.deploymentUrl
          };
        });
        break;

      case 'message':
        setIsTyping(false);
        hasReceivedProgressRef.current = true;
        const rawMsg = serverMessage as any;
        const msgData = rawMsg.data || rawMsg;
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
        refreshSessions();
        break;

      case 'deployment_complete':
        setIsTyping(false);
        const deployCompleteRaw = serverMessage as any;
        const deployData = deployCompleteRaw.data || deployCompleteRaw;
        const isSuccess = deployData?.status === 'success' || deployData?.success === true || (!deployData?.error && deployData?.url);
        const deployedUrl = deployData?.url || deployData?.deployment_url || deployCompleteRaw?.url;

        setActiveDeployment((prev: DeploymentProgress | null) => {
          if (!prev) return prev;
          // [FAANG] Terminal State Reconciliation: Force ALL stages to success
          const completedStages = prev.stages.map(s => {
            return {
              ...s,
              status: (isSuccess ? 'success' : 'error') as any,
              message: isSuccess ? 'Completed' : (deployData.error || 'Failed')
            };
          });

          return {
            ...prev,
            status: isSuccess ? 'success' : 'failed',
            currentStage: isSuccess ? 'success' : prev.currentStage,
            stages: completedStages,
            overallProgress: isSuccess ? 100 : prev.overallProgress,
            deploymentUrl: deployedUrl
          };
        });

        addAssistantMessage({
          content: isSuccess ? `## 🎉 Deployment Successful!\n\n${deployData.message || 'Your app is live!'}` : `## ❌ Deployment Failed\n\n${deployData.error || 'Build or deployment failed.'}`,
          actions: isSuccess ? [
            { id: 'view_logs', label: '📊 View Logs', type: 'button', actions: 'view_logs' as any },
            { id: 'setup_cicd', label: '🔄 Set Up CI/CD', type: 'button', actions: 'setup_cicd' as any },
          ] : undefined,
          metadata: { type: 'deployment_complete', url: deployedUrl },
          ...(deployedUrl ? { deploymentUrl: deployedUrl } : {})
        } as any);
        break;

      case 'error':
        setIsTyping(false);
        const errorMsg = (serverMessage as any).content || (serverMessage as any).message || 'An unknown error occurred';
        setActiveDeployment((prev) => {
          if (!prev || prev.status === 'failed' || prev.status === 'success') return prev;
          return {
            ...prev,
            status: 'failed',
            stages: prev.stages.map(s => {
              if (s.id === prev.currentStage || s.status === 'in-progress') {
                return { ...s, status: 'error', message: errorMsg };
              }
              return s;
            })
          };
        });
        addAssistantMessage({
          content: `❌ **Error:** ${errorMsg}`,
          metadata: { type: 'error' }
        });
        break;

      case 'ping':
      case 'pong':
      case 'snapshot_ready':
        // [FAANG] Background signals - silently ignored here as they are 
        // typically handled via onMessage listeners in specific components.
        break;

      default:
        console.warn('Unknown message type:', serverMessage.type);
    }
  };

  const handleServerMessage = useCallback((serverMessage: ServerMessage) => {
    // Direct pass-through for critical/simple messages if needed, OR queue everything
    // We Queue Everything for perfect sequencing
    enqueueItem(serverMessage);
  }, [enqueueItem]);

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
    isChatWindowOpen,
    toggleChatWindow,
    reconnect,
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
