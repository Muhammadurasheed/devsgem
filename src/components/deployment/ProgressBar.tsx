import { motion } from 'framer-motion';

interface ProgressBarProps {
  progress: number;
  estimatedTimeRemaining?: number;
}

export function ProgressBar({ progress, estimatedTimeRemaining }: ProgressBarProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <div className="progress-bar-wrapper">
      <div className="progress-info">
        <span className="progress-label">Overall Progress:</span>
        <span className="progress-percentage">{progress}%</span>
      </div>

      <div className="progress-bar-container">
        <motion.div
          className="progress-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="progress-shimmer"></div>
        </motion.div>
      </div>

      {estimatedTimeRemaining && estimatedTimeRemaining > 0 && (
        <div className="progress-estimate">
          Estimated time remaining: ~{formatTime(estimatedTimeRemaining)}
        </div>
      )}
    </div>
  );
}
