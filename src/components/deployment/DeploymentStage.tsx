import { motion } from 'framer-motion';
import { DeploymentStage as DeploymentStageType } from '@/types/deployment';

interface DeploymentStageProps {
  stage: DeploymentStageType;
  isActive: boolean;
}

export function DeploymentStage({ stage, isActive }: DeploymentStageProps) {
  const getStatusIcon = () => {
    switch (stage.status) {
      case 'waiting':
        return stage.icon || '⏳';
      case 'in-progress':
        return '⚡';
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return stage.icon || '⏳';
    }
  };

  const getStatusColor = () => {
    switch (stage.status) {
      case 'waiting':
        return 'text-slate-400';
      case 'in-progress':
        return 'text-purple-400';
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
    }
  };

  const getStatusText = () => {
    switch (stage.status) {
      case 'waiting':
        return 'Waiting...';
      case 'in-progress':
        return 'In Progress...';
      case 'success':
        return stage.duration ? `Completed in ${stage.duration}s` : 'Completed';
      case 'error':
        return 'Failed';
    }
  };

  return (
    <motion.div
      className={`deployment-stage ${isActive ? 'active' : ''}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: 1,
        x: 0,
      }}
      transition={{ duration: 0.3 }}
    >
      <div className="stage-header">
        <span className="stage-icon">{getStatusIcon()}</span>
        <span className={`stage-label ${getStatusColor()}`}>{stage.label}</span>
        <span className={`stage-status ${getStatusColor()}`}>{getStatusText()}</span>
      </div>

      {stage.details && stage.details.length > 0 && (
        <motion.div
          className="stage-details"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
        >
          {stage.details.map((detail, index) => (
            <div key={index} className="stage-detail-item">
              └─ {detail}
            </div>
          ))}
        </motion.div>
      )}

      {stage.status === 'in-progress' && (
        <motion.div
          className="stage-spinner"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <span className="spinner-icon">⟳</span>
        </motion.div>
      )}
    </motion.div>
  );
}
