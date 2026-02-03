import { useEffect, useRef, useState } from "react";
import { X, Minus, Sparkles, Copy, Check, WifiOff, Loader2, Maximize2, History, Trash2, PlusCircle, MessageSquare, Edit2, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useWebSocketContext } from "@/contexts/WebSocketContext";
import confetti from "canvas-confetti";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import { useChat } from "@/hooks/useChat";
import type { MessageAction } from "@/types/websocket";
import { AnimatePresence, motion } from "framer-motion";

interface ChatWindowProps {
  onClose: () => void;
  initialMessage?: string;
}

const ChatWindow = ({ onClose, initialMessage }: ChatWindowProps) => {
  const {
    messages,
    isConnected,
    isTyping,
    connectionStatus,
    sendMessage,
    sendStructuredMessage,
    resetSession,
    activeDeployment,
    thoughtBuffer,
    setMessages, // ✅ Needed for local diff insertion
  } = useChat();

  const {
    sessions,
    switchSession,
    refreshSessions,
    renameSession,
    sessionId: activeSessionId
  } = useWebSocketContext();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('devgem_chat_sidebar_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Neural Log logic ---
  const showLiveThoughts = isTyping && thoughtBuffer.length > 0;

  // Clean up live thoughts similar to NeuroLog in ChatMessage
  const cleanLiveThoughts = thoughtBuffer.map(t => {
    let cleaned = t.trim().replace(/^```(json|tool_outputs)?/g, '').replace(/```$/g, '').trim();
    cleaned = cleaned.replace(/^tool_outputs\s*/g, '').trim();
    try {
      if (cleaned.startsWith('{')) {
        const parsed = JSON.parse(cleaned);
        const firstKey = Object.keys(parsed)[0];
        return parsed.description || parsed.message || parsed.content || `Strategic ${firstKey || 'action'} in progress...`;
      }
      return cleaned;
    } catch { return cleaned; }
  }).filter(t => t.length > 0);

  const isReconnecting = connectionStatus.state === 'reconnecting';

  // Handle initial message from CTA buttons
  useEffect(() => {
    if (initialMessage && messages.length === 0) {
      sendMessage(initialMessage);
    }
  }, [initialMessage, messages.length, sendMessage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, thoughtBuffer]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // --- [PRESTIGE] CELEBRATION ENGINE ---
  useEffect(() => {
    if (activeDeployment?.status === 'success') {
      console.log('[PRESTIGE] 🎊 Triggering global celebration');

      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 120, zIndex: 99999, scalar: 1.8, gravity: 0.8 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 25 * (timeLeft / duration); // Reduced count (was 80)

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#3b82f6', '#8b5cf6', '#06b6d4', '#ffffff']
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#3b82f6', '#8b5cf6', '#06b6d4', '#ffffff']
        });

        if (timeLeft > duration * 0.8) {
          confetti({
            ...defaults,
            particleCount: particleCount * 1.5,
            origin: { x: 0.5, y: 0.5 },
            shapes: ['star'],
            colors: ['#FFD700', '#FFA500']
          });
        }
      }, 250);

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.warn('Audio blocked:', e));
      } catch (e) {
        console.error('Audio fail:', e);
      }

      return () => clearInterval(interval);
    }
  }, [activeDeployment?.status]);

  const handleActionClick = (action: MessageAction) => {
    if (action.action === 'apply_gemini_fix') {
      sendStructuredMessage('apply_gemini_fix', {
        deployment_id: action.payload?.deployment_id,
        diagnosis: action.payload?.diagnosis
      });
      return;
    }

    if (action.action === 'view_fix_diff') {
      setMessages(prev => {
        const newMessages = [...prev];
        const targetIndex = newMessages.map(m => m).reverse().findIndex(m =>
          m.metadata?.type === 'gemini_brain_diagnosis' && m.role === 'assistant'
        );

        if (targetIndex !== -1) {
          const actualIndex = newMessages.length - 1 - targetIndex;
          newMessages[actualIndex] = {
            ...newMessages[actualIndex],
            metadata: {
              ...newMessages[actualIndex].metadata,
              showDiff: true
            }
          };
        }
        return newMessages;
      });
      return;
    }

    if (action.action === 'close_diff_view') {
      if (action.payload?.messageId) {
        setMessages(prev => prev.map(m =>
          m.id === action.payload.messageId
            ? { ...m, metadata: { ...m.metadata, showDiff: false } }
            : m
        ));
      }
      return;
    }

    if (action.action === 'dismiss') {
      sendMessage("I'll fix the issue manually. Please wait...");
      return;
    }

    if (action.action) {
      sendMessage(action.action);
    } else if (action.url) {
      window.open(action.url, '_blank');
    }
  };

  const abortDeployment = () => {
    console.log('[ChatWindow] 🛑 Sending abort signal to backend');
    sendStructuredMessage('abort_deployment', {});
  };

  const handleQuickAction = (action: string) => {
    sendMessage(action);
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const stopResizing = () => setIsResizing(false);
    const resize = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(240, Math.min(450, e.clientX - 20));
      setSidebarWidth(newWidth);
      localStorage.setItem('devgem_chat_sidebar_width', newWidth.toString());
    };

    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

  const handleRenameSubmit = async (sid: string) => {
    if (!editingTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    const success = await renameSession(sid, editingTitle.trim());
    if (success) {
      setEditingSessionId(null);
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus.state) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Online • Ready to help';
      case 'reconnecting': return `Reconnecting (${connectionStatus.reconnectAttempt || 1})...`;
      case 'disconnected': return 'Offline';
      case 'error': return 'Connection Error';
      default: return 'Initializing...';
    }
  };

  const getConnectionIndicatorColor = () => {
    switch (connectionStatus.state) {
      case 'connected': return 'bg-green-500';
      case 'connecting':
      case 'reconnecting': return 'bg-yellow-500 animate-pulse';
      case 'error':
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div
      className={`
        fixed
        bg-background/95 backdrop-blur-xl
        border border-[rgba(139,92,246,0.3)]
        shadow-2xl
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isMaximized
          ? 'inset-4 rounded-2xl z-[100]'
          : isMinimized
            ? 'bottom-5 right-5 w-[400px] h-[60px] rounded-2xl z-30'
            : 'bottom-5 right-5 w-[400px] h-[600px] rounded-2xl z-30'
        }
        animate-in slide-in-from-bottom-4 fade-in duration-300
        max-md:inset-5 max-md:max-w-none max-md:h-[calc(100vh-40px)] max-md:z-[100]
        group
      `}
    >
      <AnimatePresence>
        {showHistory && !isMinimized && (
          <div className="absolute inset-0 z-50 pointer-events-none">
            <motion.div
              initial={{ x: -sidebarWidth }}
              animate={{ x: 0 }}
              exit={{ x: -sidebarWidth }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{ width: sidebarWidth }}
              className="absolute left-0 top-0 bottom-0 bg-[#0A0B14]/95 backdrop-blur-3xl border-r border-[#8b5cf6]/20 flex flex-col shadow-2xl pointer-events-auto"
            >
              <div className="p-4 border-b border-[#8b5cf6]/20 flex items-center justify-between bg-gradient-to-r from-[#8b5cf6]/5 to-transparent">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#8b5cf6]" />
                  <h4 className="font-bold text-[10px] uppercase tracking-widest text-[#8b5cf6]">History Hub</h4>
                </div>
                <button onClick={() => setShowHistory(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin scrollbar-thumb-[#8b5cf6]/20">
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-4">
                    <History className="w-12 h-12 text-white/5 mb-2" />
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-50">Zero threads indexed</p>
                  </div>
                ) : (
                  sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        if (editingSessionId === session.id) return;
                        if (session.id !== activeSessionId) {
                          switchSession(session.id);
                          setShowHistory(false);
                        }
                      }}
                      className={`
                        group relative p-3 rounded-xl cursor-pointer transition-all border
                        ${session.id === activeSessionId
                          ? 'bg-[#8b5cf6]/20 border-[#8b5cf6]/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]'
                          : 'bg-white/[0.02] border-transparent hover:bg-white/[0.05] hover:border-[#8b5cf6]/20'
                        }
                      `}
                    >
                      <div className="flex gap-3 items-start">
                        <div className={`mt-0.5 p-2 rounded-lg ${session.id === activeSessionId ? 'bg-[#8b5cf6]/20' : 'bg-white/5'}`}>
                          <MessageSquare size={14} className={session.id === activeSessionId ? 'text-[#8b5cf6]' : 'text-gray-500'} />
                        </div>

                        <div className="flex-1 min-w-0">
                          {editingSessionId === session.id ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <input
                                autoFocus
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameSubmit(session.id);
                                  if (e.key === 'Escape') setEditingSessionId(null);
                                }}
                                className="w-full bg-black/40 border border-[#8b5cf6]/50 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]"
                              />
                            </div>
                          ) : (
                            <>
                              <p className={`text-xs font-semibold truncate ${session.id === activeSessionId ? 'text-white' : 'text-gray-300'}`}>
                                {session.title || 'Untitled Session'}
                              </p>
                              <p className="text-[10px] text-muted-foreground/60 mt-0.5 font-mono">
                                {(() => {
                                  try {
                                    return session.timestamp ? formatDistanceToNow(new Date(session.timestamp), { addSuffix: true }) : 'Recently';
                                  } catch (e) { return 'Recently'; }
                                })()}
                              </p>
                            </>
                          )}
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!editingSessionId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSessionId(session.id);
                                setEditingTitle(session.title || '');
                              }}
                              className="p-1.5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg transition-all"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('Permanently delete this thread?')) {
                                await fetch(`http://localhost:8000/api/chat/history/${session.id}`, { method: 'DELETE' });
                                refreshSessions();
                                if (session.id === activeSessionId) resetSession();
                              }
                            }}
                            className="p-1.5 hover:bg-red-500/20 text-gray-500 hover:text-red-400 rounded-lg transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t border-[#8b5cf6]/20 bg-gradient-to-t from-[#8b5cf6]/5 to-transparent">
                <button
                  onClick={() => {
                    resetSession();
                    setShowHistory(false);
                  }}
                  className="w-full py-2.5 bg-[#8b5cf6] hover:bg-[#7c4dff] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#8b5cf6]/20 transition-all active:scale-95 group"
                >
                  <PlusCircle size={14} className="group-hover:rotate-90 transition-transform" />
                  New Conversation
                </button>
              </div>

              <div
                onMouseDown={startResizing}
                className="absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize group flex items-center justify-center hover:bg-[#8b5cf6]/10 active:bg-[#8b5cf6]/20 transition-all z-20"
              >
                <div className="w-[1px] h-12 bg-[#8b5cf6]/20 group-hover:bg-[#8b5cf6]/50 group-active:bg-[#8b5cf6] rounded-full" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="relative border-b border-[rgba(139,92,246,0.3)] bg-gradient-to-r from-[#8b5cf6]/10 to-[#06b6d4]/10">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4]" />

        {!isConnected && !isMinimized && (
          <div className="border-b border-border">
            {isReconnecting ? (
              <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-1.5 flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
                <span className="text-xs text-yellow-400">
                  Reconnecting... {connectionStatus.reconnectAttempt ? `(Attempt ${connectionStatus.reconnectAttempt})` : ''}
                </span>
              </div>
            ) : (
              <div className="bg-red-500/10 border-b border-red-500/30 px-4 py-1.5 flex items-center justify-center gap-2">
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-xs text-red-400">Disconnected from server</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Sparkles className="w-6 h-6 text-[hsl(var(--secondary))]" />
              <span className={`absolute -top-1 -right-1 w-3 h-3 ${getConnectionIndicatorColor()} rounded-full border-2 border-background`} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">DevGem AI Assistant</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                {getConnectionStatusText()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-[#8b5cf6]/20 text-[#8b5cf6]' : 'hover:bg-accent'}`}
            >
              <History size={18} />
            </button>
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            {messages.length > 0 && (
              <button
                onClick={resetSession}
                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-lg transition-all text-[#8b5cf6] font-bold text-[10px] uppercase tracking-wider group"
              >
                <PlusCircle size={14} className="group-hover:rotate-90 transition-transform" />
                New Thread
              </button>
            )}
            <div className="w-[1px] h-4 bg-white/10 mx-1" />
            <button
              onClick={() => { setIsMaximized(!isMaximized); setIsMinimized(false); setShowHistory(false); }}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <Maximize2 size={18} />
            </button>
            <button
              onClick={() => { setIsMinimized(!isMinimized); setIsMaximized(false); setShowHistory(false); }}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <Minus size={18} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold mb-2">Welcome to DevGem!</h4>
                  <p className="text-sm text-muted-foreground mb-6">I can help you deploy to Cloud Run in minutes.</p>
                </div>
                <div className="space-y-2 w-full max-w-xs">
                  <button onClick={() => handleQuickAction("I want to deploy my app to Cloud Run")} className="w-full px-4 py-3 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-lg text-sm font-medium transition-colors text-left">🚀 Deploy my app</button>
                  <button onClick={() => handleQuickAction("Help me debug a deployment error")} className="w-full px-4 py-3 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-lg text-sm font-medium transition-colors text-left">🔧 Debug deployment</button>
                  <button onClick={() => handleQuickAction("Optimize my Cloud Run costs")} className="w-full px-4 py-3 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-lg text-sm font-medium transition-colors text-left">💰 Optimize costs</button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div key={message.id}>
                    <ChatMessage
                      message={message}
                      isLatestMessage={message.role === 'assistant' && index === messages.length - 1}
                      sendStructuredMessage={sendStructuredMessage}
                      activeDeployment={activeDeployment}
                      onActionClick={handleActionClick}
                      onEnvSubmit={(envVars) => {
                        sendStructuredMessage('env_vars_uploaded', {
                          variables: envVars.map(env => ({ key: env.key, value: env.value, isSecret: env.isSecret })),
                          count: envVars.length
                        });
                      }}
                      onServiceNameSubmit={(name) => {
                        sendStructuredMessage('service_name_provided', { name, repo_url: message.metadata?.repo_url });
                      }}
                    />
                    {message.deploymentUrl && !message.metadata?.hideLegacyUrl && (
                      <div className="flex items-center gap-2 mb-4 ml-12">
                        <code className="flex-1 px-3 py-2 bg-[#101827]/80 border border-white/5 rounded-lg text-sm text-[#06b6d4] font-mono truncate">{message.deploymentUrl}</code>
                        <button onClick={() => copyToClipboard(message.deploymentUrl!)} className="p-2 bg-accent/20 hover:bg-accent/40 rounded-lg transition-colors border border-accent/20">
                          {copiedUrl ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-accent" />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--accent))] flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-card/80 border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <span className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          <ChatInput
            onSendMessage={sendMessage}
            onAbort={abortDeployment}
            disabled={!isConnected || isTyping || isReconnecting || (activeDeployment?.status === 'deploying')}
          />
        </>
      )}

      {!isMaximized && !isMinimized && <div className="resize-handle-indicator" />}
    </div>
  );
};

export default ChatWindow;
