import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink, Copy, Check, Terminal, Minimize2, ChevronDown, Brain, Sparkles, Radio, Shield, Box, Zap, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/websocket';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { DeploymentStages, STAGES } from './DeploymentStages';
import { AnalysisCard } from './AnalysisCard';
import { DiagnosticNotification } from './deployment/DiagnosticNotification';
import { cn } from '@/lib/utils';

import { DeploymentProgress as IDeploymentProgress, DeploymentStage } from '@/types/deployment';

interface DeploymentProgressProps {
  messages: ChatMessageType[];
  isTyping: boolean;
  deploymentUrl?: string;
  activeDeployment: IDeploymentProgress | null;
  onApplyFix?: (diagnosis: any) => Promise<void>;
}

// ========================================================================
// [FAANG] Premium Neuro-Log Entry Component - Matrix-style inline log
// ========================================================================
const NeuroLogEntry = ({ content, index }: { content: string; index: number }) => {
  const isAiThought = content.startsWith('[AI]');
  const displayContent = isAiThought ? content.replace('[AI] ', '') : content;

  // Categorize based on content
  const getCategory = () => {
    const lower = displayContent.toLowerCase();
    if (lower.includes('scan') || lower.includes('clone') || lower.includes('fetch')) return { label: 'SCAN', color: 'text-cyan-400', bg: 'bg-cyan-500/10' };
    if (lower.includes('detect') || lower.includes('found')) return { label: 'DETECT', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    if (lower.includes('analyz') || lower.includes('evaluat')) return { label: 'ANALYZE', color: 'text-purple-400', bg: 'bg-purple-500/10' };
    if (lower.includes('optim') || lower.includes('enhanc')) return { label: 'OPTIMIZE', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
    if (lower.includes('secur') || lower.includes('harden')) return { label: 'SECURE', color: 'text-green-400', bg: 'bg-green-500/10' };
    if (lower.includes('build') || lower.includes('compil')) return { label: 'BUILD', color: 'text-orange-400', bg: 'bg-orange-500/10' };
    if (lower.includes('deploy') || lower.includes('launch')) return { label: 'DEPLOY', color: 'text-pink-400', bg: 'bg-pink-500/10' };
    if (lower.includes('success') || lower.includes('complete')) return { label: 'SUCCESS', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    if (lower.includes('error') || lower.includes('fail')) return { label: 'ERROR', color: 'text-red-400', bg: 'bg-red-500/10' };
    return { label: 'INFO', color: 'text-gray-400', bg: 'bg-gray-500/10' };
  };

  const category = isAiThought ? { label: 'NEURO', color: 'text-cyan-400', bg: 'bg-cyan-500/10' } : getCategory();

  // [FAANG] Simplified rendering without heavy motion animations for performance
  return (
    <div
      className={cn(
        "flex items-start gap-2 py-1.5 px-2 -mx-2 rounded-lg transition-colors hover:bg-white/5 group font-mono text-xs",
        isAiThought && "bg-gradient-to-r from-cyan-500/5 to-transparent border-l-2 border-cyan-500/30"
      )}
    >
      <span className="text-[10px] text-muted-foreground/40 shrink-0 tabular-nums pt-0.5">
        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>

      {isAiThought && (
        <div className={cn("p-0.5 rounded shrink-0", category.bg)}>
          <Brain className={cn("w-3 h-3", category.color)} />
        </div>
      )}

      <span className={cn("text-[9px] font-bold uppercase w-12 shrink-0 pt-0.5", category.color)}>
        [{category.label}]
      </span>

      <span className={cn(
        "leading-relaxed break-all flex-1",
        isAiThought ? "text-cyan-300/90" : "text-muted-foreground/80"
      )}>
        {displayContent}
      </span>
    </div>
  );
};

// ========================================================================
// [FAANG] Stage Card with Integrated Neuro-Logs - Sequential Reveal
// ========================================================================
interface StageCardProps {
  stage: DeploymentStage;
  isCurrent: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

const StageCard = ({ stage, isCurrent, isExpanded, onToggle }: StageCardProps) => {
  const getStatusIcon = () => {
    switch (stage.status) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'in-progress':
        return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />;
    }
  };

  const hasLogs = stage.details && stage.details.length > 0;
  const aiLogs = stage.details?.filter(d => d.startsWith('[AI]')) || [];
  const buildLogs = stage.details?.filter(d => !d.startsWith('[AI]')) || [];
  const details = stage.details || [];

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200 overflow-hidden",
        isCurrent ? "border-primary/40 bg-primary/5 shadow-md" : "border-border/30 bg-background/40",
        stage.status === 'success' && "border-emerald-500/20 bg-emerald-500/5",
        stage.status === 'error' && "border-red-500/20 bg-red-500/5"
      )}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            {getStatusIcon()}
          </div>

          <div className="text-left">
            <span className={cn(
              "text-sm font-semibold",
              isCurrent && "text-primary",
              stage.status === 'success' && "text-emerald-600 dark:text-emerald-400",
              stage.status === 'error' && "text-red-600"
            )}>
              {stage.label}
            </span>
            {stage.message && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {stage.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI Thoughts Badge */}
          {aiLogs.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 rounded-full border border-cyan-500/20">
              <Brain className="w-3 h-3 text-cyan-400" />
              <span className="text-[10px] font-bold text-cyan-400">{aiLogs.length}</span>
            </div>
          )}

          {/* Build Logs Badge */}
          {buildLogs.length > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 rounded-full">
              <Terminal className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground">{buildLogs.length}</span>
            </div>
          )}

          <ChevronDown className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )} />
        </div>
      </button>

      {/* Expanded Content - Neuro-Log Matrix with Sequential Reveal */}
      {isExpanded && hasLogs && (
        <div className="border-t border-border/20">
          <div className="p-4 bg-[#0a0f14]/60">
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80">
                NEURO-LOG TRACE
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/20 to-transparent" />
              <span className="text-[9px] text-muted-foreground/50 font-mono">
                {details.length}/{details.length}
              </span>
            </div>

            {/* Log Entries - Sequential Reveal */}
            {/* Log Entries - Smart Auto-Scroll Container */}
            <div
              className="max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-cyan-900/20 scrollbar-track-transparent hover:scrollbar-thumb-cyan-500/30"
              ref={(el) => {
                if (!el) return;
                // [FAANG] Smart Auto-Scroll Logic
                // We only scroll to bottom if the user hasn't manually scrolled up
                const isScrolledToBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 50; // 50px threshold

                if (isScrolledToBottom) {
                  requestAnimationFrame(() => {
                    el.scrollTop = el.scrollHeight;
                  });
                }
              }}
            >
              <div className="space-y-0.5">
                {details.map((detail, idx) => (
                  <NeuroLogEntry key={idx} content={detail} index={idx} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================================
// [FAANG] Main Deployment Progress Component
// ========================================================================
export const DeploymentProgress = ({ messages, isTyping, deploymentUrl, activeDeployment, onApplyFix }: DeploymentProgressProps) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Auto-expand current stage
  useEffect(() => {
    if (activeDeployment?.currentStage && activeDeployment.status === 'deploying') {
      setExpandedStageId(activeDeployment.currentStage);
    }
  }, [activeDeployment?.currentStage, activeDeployment?.status]);

  const hasActiveState = !!activeDeployment;
  const progressMessage = [...messages].reverse().find(m => m.metadata?.type === 'deployment_progress' || m.metadata?.type === 'deployment_started');
  const rawProgress = activeDeployment ? activeDeployment.overallProgress : (progressMessage?.metadata?.progress || 0);
  const rawStage = activeDeployment ? activeDeployment.currentStage : (progressMessage?.metadata?.stage || 'Initializing');
  const stageDef = STAGES.find(s => s.id === rawStage);
  const stage = stageDef ? stageDef.label : rawStage;
  const progress = rawProgress;

  const analysisMessage = [...messages].reverse().find(m =>
    m.metadata?.type === 'analysis_result' ||
    m.content.includes('Analysis Complete') ||
    m.content.includes('Analysis Service')
  );

  const contextSuccess = activeDeployment?.status === 'success';
  const successMsg = messages.find(m =>
    m.metadata?.type === 'deployment_complete' ||
    // [FAANG] Use more specific content matching for final success
    (m.content.includes('Deployment Successful') && !m.content.includes('Dockerfile')) ||
    (m.content.includes('Deployment Complete') && !m.content.includes('Analysis')) ||
    m.content.includes('is live at:') || // More specific live URL pattern
    m.content.includes('.run.app') ||
    m.metadata?.url ||
    (m as any).deploymentUrl
  );

  const isComplete = contextSuccess || !!successMsg;
  const finalUrl = activeDeployment?.deploymentUrl || deploymentUrl || (successMsg as any)?.deploymentUrl || successMsg?.metadata?.url;

  // Check for cancellation
  const isCancelled = activeDeployment?.status === 'failed' &&
    messages.some(m => m.content.toLowerCase().includes('cancel'));

  const hasError = messages.some(m =>
    (m.content.toLowerCase().includes('error') || m.metadata?.error) &&
    !m.content.includes('Success')
  ) && !isComplete && !isCancelled;

  const diagnosisMsg = [...messages].reverse().find(m => m.metadata?.type === 'gemini_brain_diagnosis');

  // [FAANG] PRINCIPAL FIX: Higher-Fidelity Celebration Engine
  // Confetti now ONLY triggers if it hasn't fired before and we have a LIVE URL.
  const [hasCelebrated, setHasCelebrated] = useState(false);

  useEffect(() => {
    if (isComplete && finalUrl && !hasCelebrated) {
      setHasCelebrated(true);

      const duration = 5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 45, spread: 360, ticks: 120, zIndex: 9999, scalar: 1.2 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 100 * (timeLeft / duration);

        // Dynamic Side Bursts (Apple Style)
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#3B82F6', '#8B5CF6', '#F472B6']
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#3B82F6', '#6366F1', '#EC4899']
        });
      }, 250);

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
        audio.volume = 0.3;
        audio.play().catch(e => console.log('Audio feedback suppressed:', e));
      } catch (e) { }

      return () => clearInterval(interval);
    }
  }, [isComplete, finalUrl, hasCelebrated]);

  return (
    <div className="w-full space-y-4">
      <AnimatePresence mode="popLayout">
        {/* Diagnosis Card */}
        {diagnosisMsg && diagnosisMsg.metadata?.diagnosis && (
          <DiagnosticNotification
            key="diagnosis-card"
            diagnosis={diagnosisMsg.metadata.diagnosis}
            onApplyFix={async () => {
              if (onApplyFix) await onApplyFix(diagnosisMsg.metadata.diagnosis);
            }}
          />
        )}

        {/* Success Card */}
        {isComplete && (
          <motion.div
            key="success-card"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
          >
            <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-emerald-900/5 overflow-hidden relative backdrop-blur-xl">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/20 blur-3xl rounded-full" />
              <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-cyan-500/10 blur-2xl rounded-full" />

              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
                  <div className="p-2 bg-emerald-500/10 rounded-full ring-4 ring-emerald-500/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  Deployment Successful
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="w-4 h-4" />
                  <AlertDescription className="font-medium ml-2">
                    Your application is live and scaling automatically on Google Cloud Run.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <code className="flex-1 px-4 py-3 bg-background/50 border border-emerald-500/20 rounded-xl text-sm font-mono break-all text-foreground/80 shadow-inner">
                      {finalUrl || "Waiting for URL..."}
                    </code>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => finalUrl && copyToClipboard(finalUrl)}
                        disabled={!finalUrl}
                        className="h-11 w-11 shrink-0 border-emerald-500/20 hover:bg-emerald-500/10 hover:text-emerald-600"
                      >
                        {copiedUrl ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                      </Button>
                      <Button
                        size="default"
                        onClick={() => finalUrl && window.open(finalUrl, '_blank')}
                        disabled={!finalUrl}
                        className="h-11 px-6 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
                      >
                        <ExternalLink className="w-5 h-5" />
                        Visit Live App
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: "Auto HTTPS", value: "Enabled", icon: Shield },
                    { label: "Scaling", value: "Auto (0-10)", icon: Zap },
                    { label: "Health Check", value: "Passing", icon: Activity },
                    { label: "Region", value: "Global", icon: Radio },
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-background/40 rounded-lg border border-border/50 flex flex-col items-center text-center gap-1">
                      <item.icon className="w-4 h-4 text-emerald-500" />
                      <p className="text-muted-foreground font-medium">{item.label}</p>
                      <p className="font-semibold text-foreground/80">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Cancelled State */}
        {isCancelled && (
          <motion.div
            key="cancelled-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="text-sm font-medium ml-2">
                Deployment Cancelled
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Analysis Results */}
        {analysisMessage && !isComplete && (
          <AnalysisCard
            key="analysis-card"
            summary={analysisMessage.content}
            analysisData={analysisMessage.metadata?.analysis}
          />
        )}

        {/* Active Deployment Progress */}
        {(activeDeployment || progressMessage || isTyping) && !isComplete && !hasError && !isCancelled && (
          <motion.div
            key="deployment-progress"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden border-primary/20 bg-background/80 backdrop-blur-xl shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-primary to-purple-500 opacity-40" />
              <div className="absolute -right-20 -top-20 w-60 h-60 bg-primary/5 blur-3xl rounded-full" />

              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                  </div>
                  Deploying to Cloud Run
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
                    <span className="text-xs font-mono font-bold text-primary">{progress}%</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground/80">{stage}</span>
                    <span className="text-muted-foreground font-mono">Stage {STAGES.findIndex(s => s.id === rawStage) + 1}/{STAGES.length}</span>
                  </div>
                  <div className="h-2 w-full bg-secondary/30 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-cyan-500 via-primary to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    />
                  </div>
                </div>

                {/* Interactive Stages with Neuro-Logs */}
                <div className="space-y-2 pt-2">
                  {activeDeployment?.stages.map((stageData) => (
                    <StageCard
                      key={stageData.id}
                      stage={stageData}
                      isCurrent={stageData.id === activeDeployment.currentStage}
                      isExpanded={expandedStageId === stageData.id}
                      onToggle={() => setExpandedStageId(
                        expandedStageId === stageData.id ? null : stageData.id
                      )}
                    />
                  ))}
                </div>

                {/* Live Thought Stream */}
                {activeDeployment?.lastThought && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 p-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20"
                  >
                    <Brain className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
                    <span className="text-xs text-cyan-300/90 font-mono line-clamp-1">
                      {activeDeployment.lastThought}
                    </span>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Error State */}
        {hasError && !isCancelled && (
          <motion.div
            key="error-card"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Alert variant="destructive" className="bg-destructive/5 border-destructive/20">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="text-sm font-medium ml-2">
                Deployment encountered an error. Please check the logs above for details.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
