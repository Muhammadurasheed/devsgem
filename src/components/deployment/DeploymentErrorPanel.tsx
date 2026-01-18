import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { DeploymentError } from '@/types/deployment';
import { AlertCircle, X, Wrench, FileText, Undo2 } from 'lucide-react';

interface DeploymentErrorPanelProps {
  error: DeploymentError;
  onAutoFix?: () => void;
  onManualFix?: () => void;
  onRollback?: () => void;
  onViewLogs?: () => void;
  onCancel: () => void;
}

export function DeploymentErrorPanel({
  error,
  onAutoFix,
  onManualFix,
  onRollback,
  onViewLogs,
  onCancel,
}: DeploymentErrorPanelProps) {
  return (
    <motion.div
      className="deployment-error-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-slate-400 hover:text-white"
        onClick={onCancel}
      >
        <X className="h-5 w-5" />
      </Button>

      <div className="error-icon">
        <AlertCircle className="h-16 w-16 text-red-400" />
      </div>

      <h2 className="text-3xl font-bold text-white mb-2">Deployment Failed</h2>
      <p className="text-slate-300 mb-6">
        Something went wrong during the {error.stage} stage
      </p>

      <div className="error-explanation">
        <h3 className="text-lg font-semibold text-white mb-3">🔍 What went wrong:</h3>
        <div className="error-message">{error.message}</div>

        {error.location && (
          <div className="error-location">
            <span className="location-label">📍 Location:</span>
            <code className="location-code">{error.location}</code>
          </div>
        )}

        {error.currentCode && error.suggestedFix && (
          <div className="code-comparison">
            <div className="code-block">
              <div className="code-label">Current (incorrect):</div>
              <pre>
                <code className="language-javascript">{error.currentCode}</code>
              </pre>
            </div>

            <div className="code-block">
              <div className="code-label">Should be:</div>
              <pre>
                <code className="language-javascript">{error.suggestedFix}</code>
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="error-actions">
        <h3 className="text-lg font-semibold text-white mb-3">🛠️ How to fix:</h3>

        <div className="action-buttons">
          {error.autoFixable && onAutoFix && (
            <Button onClick={onAutoFix} className="auto-fix-btn w-full">
              <Wrench className="h-4 w-4 mr-2" />
              Fix Automatically (30 seconds)
              <span className="btn-subtitle">I'll update your code and redeploy</span>
            </Button>
          )}

          {onManualFix && (
            <Button onClick={onManualFix} variant="outline" className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Fix Manually
              <span className="btn-subtitle">I'll guide you through it</span>
            </Button>
          )}

          {error.canRollback && onRollback && (
            <Button onClick={onRollback} variant="outline" className="w-full">
              <Undo2 className="h-4 w-4 mr-2" />
              Rollback to Previous Version
              <span className="btn-subtitle">Restore last working deployment</span>
            </Button>
          )}

          {onViewLogs && (
            <Button onClick={onViewLogs} variant="ghost" className="w-full">
              📋 View Full Logs
            </Button>
          )}
        </div>
      </div>

      <div className="error-footer">
        <Button onClick={onCancel} variant="ghost" className="cancel-btn">
          Cancel Deployment
        </Button>
      </div>
    </motion.div>
  );
}
