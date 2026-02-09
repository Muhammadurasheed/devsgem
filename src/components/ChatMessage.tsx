import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { User, Sparkles, Loader2, Rocket, ExternalLink, Timer, Globe, ShieldCheck, CheckCircle2, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useEffect, useRef } from "react";
import type { ChatMessage, MessageAction } from "@/types/websocket";
import { EnvVariablesInput, EnvVariable } from "./chat/EnvVariablesInput";
import { ServiceNameInput } from "./chat/ServiceNameInput";
import { DeploymentLogs } from "./chat/DeploymentLogs";
import { AnalysisVisualizer } from "./chat/AnalysisVisualizer";
import { NeuroLogMatrix } from "./chat/NeuroLogMatrix";
import { DiffViewer } from "./chat/DiffViewer"; // ✅ Import DiffViewer
import { CodeDiffView } from "./chat/CodeDiffView"; // ✅ Import Vibe Coding View
import { cn } from "@/lib/utils";




// --- Neuro-Log (Thought Process) Component ---
const NeuroLog = ({ thoughts }: { thoughts: string[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!thoughts || thoughts.length === 0) return null;

  // Clean up thoughts - if they look like JSON, try to extract description or just show summary
  const cleanThoughts = thoughts.map(t => {
    let cleaned = t.trim();

    // STRIP: Backticks and tool tags
    cleaned = cleaned.replace(/^```(json|tool_outputs)?/g, '').replace(/```$/g, '').trim();
    cleaned = cleaned.replace(/^tool_outputs\s*/g, '').trim();

    try {
      if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        const parsed = JSON.parse(cleaned);
        // Try to find any common "text" key
        const content = parsed.description || parsed.message || parsed.content || parsed.summary || parsed.status;
        if (content) return content;

        // If it's a tool response wrapper, look deeper
        const firstKey = Object.keys(parsed)[0];
        if (firstKey && typeof parsed[firstKey] === 'object') {
          const inner = parsed[firstKey];
          const innerContent = inner.description || inner.message || inner.content || inner.summary;
          if (innerContent) return `${firstKey.replace(/_response$/, '')}: ${innerContent}`;
        }

        return `Strategic ${firstKey || 'action'} completed`;
      }
      return cleaned || t;
    } catch (e) {
      return cleaned || t;
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mb-3 w-full"
    >
      <motion.div
        initial={{ opacity: 0, y: -5, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        className="mt-2 overflow-hidden border-l border-[#8b5cf6]/20 pl-4 py-1"
      >
        {cleanThoughts.map((thought, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="text-[11px] text-gray-400 font-mono leading-relaxed break-all whitespace-pre-wrap flex gap-2"
          >
            <span className="text-[#06b6d4] flex-shrink-0">›</span>
            {thought}
          </motion.p>
        ))}
      </motion.div>
    </motion.div>
  );
};

// --- Celebration Card Component ---
const CelebrationCard = ({ url, metadata }: { url: string, metadata?: any }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      className="mt-4 p-6 glass-card rounded-2xl border-green-500/30 celebration-glow"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <Rocket className="w-8 h-8 text-green-400 animate-bounce" />
        </div>

        <h3 className="text-2xl font-bold success-gradient-text px-4">
          Deployment Successful!
        </h3>

        <p className="text-gray-400 text-sm max-w-sm">
          Your application is now live and secured across Google's global edge network.
        </p>

        <div className="grid grid-cols-2 gap-4 w-full pt-4">
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center">
            <Timer className="w-4 h-4 text-[#8b5cf6] mb-1" />
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Time To Live</span>
            <span className="text-sm font-mono text-white">48s</span>
          </div>
          <div className="p-3 bg-white/5 rounded-xl border border-white/10 flex flex-col items-center">
            <Globe className="w-4 h-4 text-[#06b6d4] mb-1" />
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Region</span>
            <span className="text-sm font-mono text-white">us-central1</span>
          </div>
        </div>

        <div className="flex gap-2 w-full pt-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 bg-gradient-to-r from-[#3b82f6] to-[#8b5cf6] hover:from-[#4f46e5] hover:to-[#9333ea] text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] shadow-xl hover:shadow-[#3b82f6]/20"
          >
            <ExternalLink className="w-4 h-4" />
            Visit
          </a>
          <button
            onClick={handleCopy}
            className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/10"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface ChatMessageProps {
  message: ChatMessage;
  onEnvSubmit?: (envVars: EnvVariable[]) => void;
  onServiceNameSubmit?: (name: string) => void;
  sendStructuredMessage?: (type: string, data: any) => void;
  onActionClick?: (action: MessageAction) => void;
  activeDeployment?: any;
  isLatestMessage?: boolean;
}

const ChatMessageComponent = React.memo(({
  message,
  isLatestMessage,
  sendStructuredMessage,
  activeDeployment,
  onActionClick,
  onEnvSubmit,
  onServiceNameSubmit
}: ChatMessageProps) => {
  const isUser = message.role === "user";
  const time = message.timestamp.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const requestsEnvVars = !isUser && (
    message.metadata?.type === 'analysis_with_env_request' ||
    message.metadata?.request_env_vars === true
  );

  const requestsServiceName = !isUser && message.metadata?.type === 'request_service_name';

  const isProgressMessage = message.metadata?.type === 'progress';

  const isProgressSuccess = isProgressMessage && (
    message.content.includes("✅") ||
    message.content.includes("[SUCCESS]") ||
    message.content.toLowerCase().includes("complete")
  );

  const isDirectAnalysisProgress = message.metadata?.original_type === 'direct_progress';
  const showDeploymentLogs = message.metadata?.type === 'deployment_started' && message.metadata?.showLogs;

  // Detect if this is a final successful deployment message
  const isSuccessMessage = !isUser && (message.deploymentUrl || message.metadata?.type === 'deployment_complete');

  // ✅ BLUEPRINT REQUIREMENT: Typing Animation
  // Only animate regular AI messages, not progress updates or user messages
  const shouldAnimate = isLatestMessage && !isUser && !isProgressMessage && !showDeploymentLogs && !requestsEnvVars;
  const [displayedContent, setDisplayedContent] = useState(shouldAnimate ? "" : message.content);

  useEffect(() => {
    // If not animating, ensure full content is shown
    if (!shouldAnimate) {
      setDisplayedContent(message.content || "");
      return;
    }

    // Defensive check: If content is missing, don't attempt to animate
    if (!message.content) {
      setDisplayedContent("");
      return;
    }

    // Typing logic
    if (displayedContent.length < message.content.length) {
      // Type speed: Adaptive chunking for natural feel
      const chunk = Math.max(1, Math.floor((message.content.length - displayedContent.length) / 50)) + 1;

      const timeout = setTimeout(() => {
        setDisplayedContent(message.content.slice(0, displayedContent.length + chunk));
      }, 10);

      return () => clearTimeout(timeout);
    }
  }, [message.content, displayedContent, shouldAnimate]);


  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        flex gap-3 mb-6 w-full
        ${isUser ? "flex-row-reverse" : "flex-row"}
      `}
    >
      {/* Avatar */}
      <div
        className={`
          w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg
          ${isUser
            ? "bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] border border-white/10"
            : "bg-[rgba(30,41,59,0.8)] border border-[rgba(139,92,246,0.3)]"
          }
        `}
      >
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : isProgressMessage ? (
          <Loader2 className="w-5 h-5 text-[#8b5cf6] animate-spin" />
        ) : (
          <Sparkles className="w-5 h-5 text-[#8b5cf6]" />
        )}
      </div>

      {/* Message Bubble */}
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`
            relative rounded-3xl px-5 py-4 shadow-xl overflow-hidden max-w-full break-all whitespace-pre-wrap
            ${isUser
              ? "bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6] text-white rounded-tr-sm"
              : "bg-[rgba(30,41,59,0.8)] backdrop-blur-md border border-[rgba(139,92,246,0.2)] text-gray-100 rounded-tl-sm ring-1 ring-white/5"
            }
          `}
        >
          {isUser ? (
            <div className="flex flex-col gap-2">
              {message.metadata?.images && (
                <div className="flex flex-wrap gap-2">
                  {message.metadata.images.map((img: any, i: number) => (
                    <img
                      key={i}
                      src={`data:${img.mime_type};base64,${img.data}`}
                      alt="Attached"
                      className="max-w-full max-h-[300px] rounded-lg border border-white/20 object-contain"
                    />
                  ))}
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              {isProgressMessage ? (
                <div className={cn(
                  "p-3 rounded-2xl bg-muted/30 border border-border/50 text-xs font-mono mb-2 transition-all",
                  isProgressSuccess ? "text-green-400 border-green-500/20" : "text-[#8b5cf6] animate-pulse"
                )}>
                  <div className="flex items-center gap-2">
                    {isProgressSuccess ? (
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                    ) : (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    )}
                    <span>{message.content}</span>
                  </div>
                </div>
              ) : (
                <>
                  {(message.metadata?.type === 'analysis' || message.metadata?.type === 'analysis_report') && message.data && (
                    <AnalysisVisualizer data={message.data} />
                  )}

                  {/* ✅ GEMINI BRAIN: Diff Viewer */}
                  {message.metadata?.showDiff && message.metadata?.diagnosis?.recommended_fix && (
                    <div className="mt-4 mb-4">
                      <DiffViewer
                        fix={message.metadata.diagnosis.recommended_fix}
                        onApply={() => {
                          // Trigger apply action
                          onActionClick?.({
                            id: 'apply-fix-internal',
                            label: 'Apply Fix',
                            type: 'button',
                            action: 'apply_gemini_fix',
                            payload: {
                              deployment_id: message.metadata?.deployment_id,
                              diagnosis: message.metadata?.diagnosis
                            }
                          });
                        }}
                        onDismiss={() => {
                          // Trigger close action (handled by ChatWindow to toggle flag off)
                          onActionClick?.({
                            id: 'close-diff',
                            label: 'Close Diff',
                            type: 'button',
                            action: 'close_diff_view',
                            payload: { messageId: message.id }
                          });
                        }}
                      />
                    </div>
                  )}

                  {/* ✅ GEMINI BRAIN: Vibe Coding Result (Read-Only Diff) */}
                  {message.metadata?.type === 'vibe_modify_success' && message.metadata?.changes && (
                    <div className="mt-4 mb-4">
                      <CodeDiffView changes={message.metadata.changes} />
                    </div>
                  )}

                  {message.thoughts && message.thoughts.length > 0 && (
                    <NeuroLogMatrix
                      thoughts={message.thoughts}
                      analysisData={message.data}
                    />
                  )}

                  <div className="prose prose-sm prose-invert max-w-none break-all whitespace-pre-wrap">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || "");
                          return !inline && match ? (
                            <div className="relative group rounded-xl overflow-hidden my-4 border border-border/50">
                              <div className="overflow-x-hidden w-full overflow-hidden">
                                <SyntaxHighlighter
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  wrapLongLines={true}
                                  customStyle={{
                                    wordBreak: 'break-all',
                                    whiteSpace: 'pre-wrap',
                                  }}
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                              </div>
                            </div>
                          ) : (
                            <code className={cn("bg-muted/50 px-1.5 py-0.5 rounded-md text-[#8b5cf6] break-all whitespace-pre-wrap block my-2", className)} {...props}>
                              {children}
                            </code>
                          );
                        },
                        p: ({ children }) => <p className="mb-3 last:mb-0 text-sm leading-relaxed text-gray-200">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1.5">{children}</ul>,
                        li: ({ children }) => <li className="text-[13.5px] text-gray-300">{children}</li>,
                        h1: ({ children }) => <h1 className="text-xl font-bold mb-3 success-gradient-text">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-lg font-bold mb-3 text-white/90">{children}</h2>,
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#3b82f6] hover:text-[#60a5fa] underline underline-offset-4 transition-colors font-medium break-all"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {displayedContent}
                    </ReactMarkdown>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Celebration Area */}
          {isSuccessMessage && message.deploymentUrl && (
            <CelebrationCard url={message.deploymentUrl} metadata={message.metadata} />
          )}

          {/* Actions Area */}
          <AnimatePresence>
            {message.actions && message.actions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 w-full"
              >
                {message.actions.map((action, idx) => (
                  <motion.button
                    key={action.id || idx}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onActionClick?.(action)}
                    className="relative group overflow-hidden glass-card p-4 text-left border border-white/10 hover:border-[#8b5cf6]/50 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wider group-hover:text-white transition-colors ${action.variant === 'primary' ? 'text-white' : 'text-white/80'}`}>
                        {action.label}
                      </span>
                      {action.variant === 'primary' ? (
                        <Rocket className="w-4 h-4 text-white animate-pulse" />
                      ) : (
                        <ShieldCheck className="w-4 h-4 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <p className={`text-[10px] group-hover:text-gray-200 transition-colors ${action.variant === 'primary' ? 'text-gray-300' : 'text-gray-500'}`}>
                      {action.action === 'deploy_to_cloudrun'
                        ? 'Automated Cloud Run provisioning'
                        : action.action === 'request_env_vars'
                          ? 'Configure secrets and variables'
                          : 'Advanced agentic operation'}
                    </p>

                    {/* High-Impact Gradient for Primary */}
                    {action.variant === 'primary' && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-100 group-hover:opacity-40 transition-opacity pointer-events-none" />
                    )}

                    {/* Subtle Glow Effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#8b5cf6]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Deployment Logs Area with ETA Calculator */}
          {showDeploymentLogs && activeDeployment && (
            <div className="mt-4 w-full">
              <DeploymentLogs
                stages={activeDeployment.stages}
                currentStage={activeDeployment.currentStage}
                overallProgress={activeDeployment.overallProgress}
                status={activeDeployment.status}
                thoughts={activeDeployment.thoughts}
                lastThought={activeDeployment.lastThought}
              />
            </div>
          )}

          {/* Env Input Area */}
          {requestsEnvVars && onEnvSubmit && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 w-full max-w-2xl bg-[#1e293b]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-1"
            >
              <EnvVariablesInput
                onEnvSubmit={onEnvSubmit}
                onSkip={() => onEnvSubmit([])}
                sendMessageToBackend={sendStructuredMessage}
              />
            </motion.div>
          )}

          {/* Service Name Input Area */}
          {requestsServiceName && onServiceNameSubmit && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-4 w-full max-w-2xl bg-[#1e293b]/50 backdrop-blur-xl border border-white/10 rounded-2xl p-1"
            >
              <ServiceNameInput
                defaultName={message.metadata?.default_name || "servergem-app"}
                onSave={onServiceNameSubmit}
                onSkip={() => onServiceNameSubmit(message.metadata?.default_name || "servergem-app")}
              />
            </motion.div>
          )}

          <span className="text-[10px] uppercase tracking-tighter text-muted-foreground/60 px-2 font-bold">{time}</span>
        </div>
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for deep stability check
  // Return true if props are equivalent (prevents re-render)
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.isLatestMessage === nextProps.isLatestMessage &&
    JSON.stringify(prevProps.message.metadata) === JSON.stringify(nextProps.message.metadata) &&
    prevProps.activeDeployment?.status === nextProps.activeDeployment?.status &&
    prevProps.activeDeployment?.overallProgress === nextProps.activeDeployment?.overallProgress &&
    prevProps.activeDeployment?.lastThought === nextProps.activeDeployment?.lastThought &&
    JSON.stringify(prevProps.activeDeployment?.stages) === JSON.stringify(nextProps.activeDeployment?.stages)
  );
});

const ChatMessage = ChatMessageComponent;
export default ChatMessage;
