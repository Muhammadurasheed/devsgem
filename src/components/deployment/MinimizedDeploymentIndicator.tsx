import { DeploymentProgress } from '@/types/deployment';
import { Loader2, X, Move } from 'lucide-react';
import Draggable from 'react-draggable';
import { useState } from 'react';

interface MinimizedDeploymentIndicatorProps {
  progress: DeploymentProgress;
  onExpand: () => void;
  onClose: () => void;
}

export function MinimizedDeploymentIndicator({
  progress,
  onExpand,
  onClose,
}: MinimizedDeploymentIndicatorProps) {
  const [isDragging, setIsDragging] = useState(false);
  
  const getCurrentStageLabel = () => {
    const stageLabels: Record<string, string> = {
      repo_clone: 'Cloning repository...',
      code_analysis: 'Analyzing code...',
      dockerfile_generation: 'Generating Dockerfile...',
      security_scan: 'Running security checks...',
      container_build: 'Building container...',
      cloud_deployment: 'Deploying to Cloud Run...'
    };
    return stageLabels[progress.currentStage || ''] || 'Processing...';
  };

  return (
    <Draggable
      handle=".drag-handle"
      defaultPosition={{ x: 20, y: -200 }}
      onStart={() => setIsDragging(true)}
      onStop={() => {
        setTimeout(() => setIsDragging(false), 100);
      }}
    >
      <div
        className="fixed bottom-0 right-0 z-[60]"
        style={{ cursor: isDragging ? 'grabbing' : 'default' }}
      >
        <div
          className="bg-slate-900 border border-purple-500/40 rounded-xl shadow-2xl shadow-purple-500/20 p-4 hover:shadow-purple-500/30 transition-all hover:scale-105 min-w-[320px]"
        >
        <div className="flex items-center gap-3">
          {/* Drag handle */}
          <div className="drag-handle cursor-move p-1 hover:bg-slate-800 rounded transition">
            <Move className="w-4 h-4 text-slate-500" />
          </div>
          
          {/* Animated spinner with progress ring */}
          <div className="relative" onClick={(e) => {
            e.stopPropagation();
            if (!isDragging) onExpand();
          }}>
            <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
            {/* Progress ring */}
            <svg className="absolute inset-0 w-12 h-12 -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                className="text-slate-700"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress.overallProgress / 100)}`}
                className="text-purple-400 transition-all duration-500"
              />
            </svg>
          </div>

          {/* Status text */}
          <div className="flex-1" onClick={(e) => {
            e.stopPropagation();
            if (!isDragging) onExpand();
          }}>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-semibold text-slate-200">
                Deploying...
              </h4>
              <span className="text-xs font-bold text-purple-400">
                {progress.overallProgress}%
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {getCurrentStageLabel()}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mini progress bar */}
        <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500 transition-all duration-500"
            style={{ width: `${progress.overallProgress}%` }}
          />
        </div>

        {/* Expand hint */}
        <p className="text-xs text-slate-500 text-center mt-2" onClick={(e) => {
          e.stopPropagation();
          if (!isDragging) onExpand();
        }}>
          Click to expand • Drag to move • ESC to minimize
        </p>
      </div>
      </div>
    </Draggable>
  );
}
