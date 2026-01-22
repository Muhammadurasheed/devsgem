import { motion, AnimatePresence } from 'framer-motion';
import { DeploymentProgress } from '@/types/deployment';
import { DeploymentStage } from './DeploymentStage';
import { ProgressBar } from './ProgressBar';
import { DeploymentSuccessPanel } from './DeploymentSuccessPanel';
import { DeploymentErrorPanel } from './DeploymentErrorPanel';
import { MinimizedDeploymentIndicator } from './MinimizedDeploymentIndicator';
import { Button } from '@/components/ui/button';
import { Minimize2, X } from 'lucide-react';
import { calculateDuration } from '@/lib/websocket/deploymentParser';
import { useState, useEffect } from 'react';

interface DeploymentProgressPanelProps {
  progress: DeploymentProgress;
  onClose: () => void;
}

export function DeploymentProgressPanel({
  progress,
  onClose,
}: DeploymentProgressPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const totalDuration = calculateDuration(progress.startTime, new Date().toISOString());

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to minimize (not close) when panel is expanded
      if (e.key === 'Escape' && !isMinimized) {
        e.preventDefault();
        setIsMinimized(true);
      }
    };

    if (!isMinimized) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMinimized]);

  // Show minimized indicator when minimized
  if (isMinimized) {
    return (
      <MinimizedDeploymentIndicator
        progress={progress}
        onExpand={() => setIsMinimized(false)}
        onClose={onClose}
      />
    );
  }

  // Trigger Confetti on Success
  useEffect(() => {
    if (progress.status === 'success') {
      import('canvas-confetti').then((confetti) => {
        confetti.default({
          particleCount: 200,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#a855f7', '#3b82f6', '#f59e0b'] // Green, Purple, Blue, Amber
        });
      });
    }
  }, [progress.status]);

  // Show success panel
  if (progress.status === 'success') {
    return (
      <div className="deployment-panel-overlay">
        <DeploymentSuccessPanel
          deploymentUrl={progress.deploymentUrl || ''}
          duration={totalDuration}
          serviceName={progress.serviceName}
          onClose={onClose}
        />
      </div>
    );
  }

  // Show error panel
  if (progress.status === 'failed' && progress.error) {
    return (
      <div className="deployment-panel-overlay">
        <DeploymentErrorPanel
          error={progress.error}
          onCancel={onClose}
          onViewLogs={() => console.log('View logs')}
        />
      </div>
    );
  }

  // Show progress panel (default) - FULL SCREEN WITH BACKDROP
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[70] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => {
          // Click backdrop to minimize (not close)
          if (e.target === e.currentTarget) {
            setIsMinimized(true);
          }
        }}
      >
        <motion.div
          className="bg-slate-900 rounded-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/20 w-full max-w-2xl max-h-[80vh] overflow-hidden"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1],
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-100">
                  Deploying Your Application
                </h2>
                <p className="text-sm text-slate-400">
                  {progress.serviceName || 'Repository'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMinimized(true)}
                className="text-slate-400 hover:text-slate-200 transition"
                title="Minimize (ESC)"
              >
                <Minimize2 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-200 transition"
                title="Close"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Body - Stages */}
          <div className="px-6 py-4 max-h-96 overflow-y-auto">
            {progress.stages.map((stage) => (
              <DeploymentStage
                key={stage.id}
                stage={stage}
                isActive={stage.id === progress.currentStage}
              />
            ))}
          </div>

          {/* Footer - Progress */}
          <div className="px-6 py-4 border-t border-slate-700 bg-slate-900/50">
            <ProgressBar
              progress={progress.overallProgress}
              estimatedTimeRemaining={progress.estimatedTimeRemaining}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
