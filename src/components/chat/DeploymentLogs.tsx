/**
 * Deployment Logs Component
 * Enhanced with Apple-level aesthetics, Matrix-style log visualization, and Interactive Accordion
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Clock, Terminal, Minimize2, ChevronRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeploymentStage, DeploymentStageStatus, DeploymentStatus } from '@/types/deployment';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DeploymentLogsProps {
  stages: DeploymentStage[];
  currentStage: string;
  overallProgress: number;
  status: DeploymentStatus;
}

export function DeploymentLogs({ stages, currentStage, overallProgress, status }: DeploymentLogsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMatrix, setShowMatrix] = useState(false);
  // Track which stage is expanded in the "Accordion" view
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll matrix logs
  useEffect(() => {
    if (showMatrix && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [stages, showMatrix]);

  // Auto-expand the current stage if it changes
  useEffect(() => {
    if (currentStage && status === 'deploying') {
      setExpandedStageId(currentStage);
    }
  }, [currentStage, status]);

  const toggleStage = (stageId: string) => {
    setExpandedStageId(expandedStageId === stageId ? null : stageId);
  };

  const getStatusIcon = (stageStatus: DeploymentStageStatus) => {
    switch (stageStatus) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in-progress':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-slate-500" />;
    }
  };

  const getProgressColor = () => {
    if (status === 'success') return 'text-green-500';
    if (status === 'failed') return 'text-red-500';
    return 'text-blue-500';
  };

  // Aggregate all logs for Matrix view
  const allLogs = stages.flatMap(s =>
    (s.details || []).map(d => ({
      timestamp: s.startTime || new Date().toISOString(),
      msg: d,
      stage: s.label
    }))
  );

  return (
    <div className="w-full space-y-4">
      <motion.div
        layout
        className="w-full border border-border/50 rounded-xl overflow-hidden bg-background/60 backdrop-blur-md shadow-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-12 h-12 flex-shrink-0">
              <svg className="w-12 h-12 transform -rotate-90">
                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="none" className="text-muted/30" />
                <circle
                  cx="24" cy="24" r="20"
                  stroke="currentColor" strokeWidth="4" fill="none"
                  strokeDasharray={`${2 * Math.PI * 20}`}
                  strokeDashoffset={`${2 * Math.PI * 20 * (1 - overallProgress / 100)}`}
                  className={cn("transition-all duration-1000 ease-in-out", getProgressColor())}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono">
                {Math.round(overallProgress)}%
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate">
                {status === 'success' ? 'Deployment Successful' :
                  status === 'failed' ? 'Deployment Failed' :
                    'Deploying to Cloud Run'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {stages.find(s => s.id === currentStage)?.label || 'Initializing...'}
              </p>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-lg border border-border/50">
              <div className={cn(
                "w-2 h-2 rounded-full",
                status === 'success' ? "bg-green-500" :
                  status === 'failed' ? "bg-red-500" :
                    "bg-[#8b5cf6] animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.6)]"
              )} />
              <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMatrix(!showMatrix)}
              className={cn(
                "h-8 px-3 text-xs transition-all duration-300 border-primary/20",
                showMatrix ? "bg-primary/10 text-primary border-primary/50 shadow-inner" : "hover:bg-primary/5"
              )}
            >
              <Terminal className="w-3.5 h-3.5 mr-1.5" />
              {showMatrix ? 'Close Terminal' : 'Terminal Check'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 hover:bg-muted rounded-full"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Standard Steps View */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-2 space-y-1 bg-muted/5 max-h-[400px] overflow-y-auto custom-scrollbar">
                {stages.map((stage) => {
                  const isCurrent = currentStage === stage.id;
                  const isCompleted = stage.status === 'success';
                  const isError = stage.status === 'error';
                  const isItemExpanded = expandedStageId === stage.id;

                  return (
                    <motion.div
                      key={stage.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{
                        opacity: 1,
                        x: 0,
                        backgroundColor: isCurrent ? "rgba(var(--primary), 0.05)" :
                          isItemExpanded ? "rgba(255,255,255,0.03)" : "transparent",
                        scale: isCurrent ? 1.01 : 1
                      }}
                      className={cn(
                        "rounded-lg border transition-all duration-300 relative overflow-hidden group",
                        isCurrent ? "border-primary/30 shadow-sm" :
                          isCompleted ? "border-border/40 opacity-70 hover:opacity-100" :
                            "border-transparent opacity-50 hover:bg-white/5 cursor-pointer"
                      )}
                    >
                      {/* Clickable Header Area */}
                      <div
                        className="p-3 flex items-start gap-3 cursor-pointer select-none"
                        onClick={() => toggleStage(stage.id)}
                      >
                        {isCurrent && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary animate-pulse" />
                        )}

                        <div className={cn("mt-0.5 relative", isCurrent && "animate-pulse")}>
                          {getStatusIcon(stage.status)}
                          {isCurrent && (
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-ping" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-sm font-medium flex items-center gap-2",
                              isCurrent && "text-primary",
                              isCompleted && "text-green-600 dark:text-green-400",
                              isError && "text-red-600"
                            )}>
                              {stage.label}
                              {/* New "Eye" icon for visibility hint */}
                              <Eye className={cn(
                                "w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity",
                                isItemExpanded && "opacity-100 text-primary"
                              )} />
                            </span>

                            <ChevronRight className={cn(
                              "w-4 h-4 text-muted-foreground transition-transform duration-300",
                              isItemExpanded && "rotate-90"
                            )} />
                          </div>

                          {stage.message && !isItemExpanded && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {stage.message}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Accordion Content (Logs/Details) */}
                      <AnimatePresence>
                        {isItemExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-border/10 bg-black/20"
                          >
                            <div className="p-3 pl-10 text-xs font-mono space-y-1 text-muted-foreground">
                              {stage.details && stage.details.length > 0 ? (
                                stage.details.map((detail, idx) => (
                                  <div key={idx} className="break-all border-l-2 border-primary/20 pl-2">
                                    {detail}
                                  </div>
                                ))
                              ) : (
                                <div className="italic opacity-50">No details available for this stage.</div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* MATRIX MODE OVERLAY */}
      <AnimatePresence>
        {showMatrix && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed inset-4 md:inset-auto md:bottom-20 md:right-20 md:w-[600px] md:h-[400px] z-[9999] rounded-xl overflow-hidden shadow-2xl border border-green-500/30 bg-black/95 backdrop-blur-xl flex flex-col font-mono"
          >
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-green-900/10 border-b border-green-500/20">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <span className="text-xs text-green-500/80 font-bold ml-2">DEVGEM_DIAGNOSTICS</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMatrix(false)}
                className="h-6 w-6 text-green-500 hover:bg-green-500/20 rounded hover:text-green-400"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Terminal Content */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-1">
                {allLogs.length === 0 ? (
                  <div className="text-green-500/40 text-xs italic">Waiting for telemetry stream...</div>
                ) : (
                  allLogs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.02 }} // Staggered entry
                      className="text-xs break-all"
                    >
                      <span className="text-green-500/40 mr-2">[{new Date(log.timestamp || Date.now()).toLocaleTimeString()}]</span>
                      <span className="text-blue-400/80 mr-2">[{log.stage}]</span>
                      <span className="text-green-400">{log.msg}</span>
                    </motion.div>
                  ))
                )}
                {status === 'deploying' && (
                  <motion.div
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-2 h-4 bg-green-500 mt-2"
                  />
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
