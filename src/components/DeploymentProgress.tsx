import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, AlertCircle, ExternalLink, Copy, Check, Terminal, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useState, useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/websocket';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { DeploymentStages } from './DeploymentStages';
import { AnalysisCard } from './AnalysisCard';

interface DeploymentProgressProps {
  messages: ChatMessageType[];
  isTyping: boolean;
  deploymentUrl?: string; // Still passed as prop, but we'll also check metadata
}

export const DeploymentProgress = ({ messages, isTyping, deploymentUrl }: DeploymentProgressProps) => {
  const [showMatrix, setShowMatrix] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Find deployment progress message (Get LAST one to ensure we have latest state)
  const progressMessage = [...messages].reverse().find(m => m.metadata?.type === 'deployment_progress' || m.metadata?.type === 'deployment_started');
  const progress = progressMessage?.metadata?.progress || 0;
  const stage = progressMessage?.metadata?.stage || 'Initializing';
  const logs = progressMessage?.metadata?.logs || [];

  // Find analysis message - prefer structured metadata
  const analysisMessage = [...messages].reverse().find(m =>
    m.metadata?.type === 'analysis_result' ||
    m.content.includes('Analysis Complete') ||
    m.content.includes('Analysis Service')
  );

  // ✅ ROBUST CHECK: Check for structured success metadata OR string match
  const successMsg = messages.find(m => m.metadata?.type === 'deployment_complete' || m.content.includes('Deployment Successful') || m.content.includes('Deployment Complete'));
  const isComplete = !!successMsg;
  const finalUrl = deploymentUrl || successMsg?.deploymentUrl || successMsg?.metadata?.url;

  const hasError = messages.some(m => m.content.includes('Error') || m.metadata?.error);

  // Auto-scroll logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, showMatrix]);

  // Trigger confetti and notifications on success
  useEffect(() => {
    if (isComplete && finalUrl) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      // Smart Notifications
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("DevGem: Deployment Successful! 🚀", { body: `Your app is live at ${finalUrl}` });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
              new Notification("DevGem: Deployment Successful! 🚀", { body: `Your app is live at ${finalUrl}` });
            }
          });
        }
      }
    }
  }, [isComplete, finalUrl]);

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <AnimatePresence mode='wait'>

        {/* Analysis Results (New Mission Control UI) */}
        {analysisMessage && !isComplete && (
          <AnalysisCard
            summary={analysisMessage.content}
            analysisData={analysisMessage.metadata?.analysis}
          />
        )}

        {/* Deployment Progress */}
        {(progressMessage || isTyping) && !isComplete && !hasError && (
          <motion.div
            key="deployment-progress"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden border-primary/20 bg-background/80 backdrop-blur-sm shadow-lg relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-20 animate-pulse" />

              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg flex items-center gap-3">
                  <div className="relative">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                  </div>
                  Deploying to Cloud Run
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMatrix(!showMatrix)}
                  className={`border-primary/20 transition-all duration-300 ${showMatrix ? "bg-primary/10 text-primary border-primary/50" : "hover:bg-primary/5"}`}
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  {showMatrix ? 'Hide Logs' : 'View Logs'}
                </Button>
              </CardHeader>

              <CardContent className="space-y-6">

                {/* Visual Pipeline */}
                <div className="mb-6">
                  <DeploymentStages currentStage={stage} progress={progress} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground/80">{stage}</span>
                    <span className="font-mono text-primary text-xs">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-secondary/30 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ type: "spring", stiffness: 50, damping: 15 }}
                    />
                  </div>
                </div>

                <AnimatePresence>
                  {(showMatrix || logs.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{
                        opacity: 1,
                        height: showMatrix ? "400px" : "auto",
                        position: showMatrix ? "fixed" : "relative",
                        inset: showMatrix ? 0 : "auto",
                        zIndex: showMatrix ? 50 : 0,
                      }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`${showMatrix ? "bg-black/95 backdrop-blur-md p-6 flex flex-col" : "rounded-lg border border-border/50 bg-black/5 dark:bg-black/30 p-3"}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className={`text-xs font-mono font-medium ${showMatrix ? "text-green-500" : "text-muted-foreground"}`}>
                          {showMatrix ? "> SYSTEM_DIAGNOSTICS_MODE // LIVE_STREAM" : "Last Log Entry:"}
                        </p>
                        {showMatrix && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowMatrix(false)}
                            className="text-green-500 hover:text-green-400 hover:bg-green-500/10 h-8"
                          >
                            <Minimize2 className="w-4 h-4 mr-2" />
                            Minimize Console
                          </Button>
                        )}
                      </div>

                      <ScrollArea
                        className={`${showMatrix ? "flex-1 border-t border-green-500/20 pt-4" : "h-[100px]"} w-full`}
                        ref={scrollRef}
                      >
                        <div className={`space-y-1.5 font-mono text-xs ${showMatrix ? "text-green-400/90" : "text-muted-foreground"}`}>
                          {logs.map((log: string, idx: number) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className={`break-all ${showMatrix ? "border-l-2 border-green-900/50 pl-3 py-0.5 hover:bg-green-500/5 transition-colors" : ""}`}
                            >
                              {showMatrix && <span className="opacity-40 mr-3 text-[10px]">{new Date().toLocaleTimeString()} &gt;</span>}
                              {log.replace(/\[.*?\]/, '')}
                            </motion.div>
                          ))}
                          {logs.length === 0 && (
                            <div className="text-muted-foreground italic opacity-50 px-2">Initiating deployment sequence...</div>
                          )}
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Deployment Success */}
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 100, delay: 0.2 }}
          >
            <Card className="border-green-500/30 bg-green-500/5 dark:bg-green-500/10 overflow-hidden relative">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500/20 blur-3xl rounded-full" />

              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3 text-green-600 dark:text-green-400">
                  <div className="p-2 bg-green-500/10 rounded-full">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  Deployment Successful
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert className="border-green-500/20 bg-green-500/5 text-green-700 dark:text-green-300">
                  <AlertDescription className="font-medium">
                    Your application is live and scaling automatically.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <code className="flex-1 px-4 py-3 bg-background/50 border border-green-500/20 rounded-xl text-sm font-mono break-all text-foreground/80 shadow-inner">
                      {finalUrl || "Waiting for URL..."}
                    </code>
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => finalUrl && copyToClipboard(finalUrl)}
                        disabled={!finalUrl}
                        className="h-11 w-11 shrink-0 border-green-500/20 hover:bg-green-500/10 hover:text-green-600"
                      >
                        {copiedUrl ? (
                          <Check className="w-5 h-5 text-green-500" />
                        ) : (
                          <Copy className="w-5 h-5" />
                        )}
                      </Button>
                      <Button
                        size="default"
                        onClick={() => finalUrl && window.open(finalUrl, '_blank')}
                        disabled={!finalUrl}
                        className="h-11 px-6 gap-2 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-600/20"
                      >
                        <ExternalLink className="w-5 h-5" />
                        Visit Live App
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {[
                    { label: "Auto HTTPS", value: "Enabled", icon: "🔒" },
                    { label: "Scaling", value: "Auto (0-10)", icon: "📈" },
                    { label: "Health Check", value: "Passing", icon: "❤️" },
                    { label: "Region", value: "Global", icon: "🌍" },
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-background/40 rounded-lg border border-border/50 flex flex-col items-center text-center gap-1">
                      <span className="text-lg">{item.icon}</span>
                      <p className="text-muted-foreground font-medium">{item.label}</p>
                      <p className="font-semibold text-foreground/80">{item.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Error State */}
        {hasError && (
          <motion.div
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
