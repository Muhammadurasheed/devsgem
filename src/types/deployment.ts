/**
 * Deployment Progress Types
 */

export type DeploymentStageStatus = 'waiting' | 'in-progress' | 'success' | 'error';
export type DeploymentStatus = 'deploying' | 'success' | 'failed';

export interface DeploymentStage {
  id: string;
  label: string;
  icon: string;
  status: DeploymentStageStatus;
  message?: string;
  details?: string[];
  duration?: number;
  startTime?: string;
  endTime?: string;
  weight?: number;
}

export interface DeploymentProgress {
  deploymentId: string;
  serviceName?: string;
  stages: DeploymentStage[];
  currentStage: string;
  overallProgress: number;
  startTime: string;
  estimatedTimeRemaining?: number;
  status: DeploymentStatus;
  deploymentUrl?: string;
  error?: DeploymentError;
  lastThought?: string;
  thoughts?: string[];
}

export interface DeploymentError {
  message: string;
  stage: string;
  location?: string;
  codeSnippet?: string;
  currentCode?: string;
  suggestedFix?: string;
  autoFixable: boolean;
  canRollback: boolean;
}

export interface StageUpdate {
  stage: string;
  status: DeploymentStageStatus;
  details?: string[];
  progress?: number;
  message?: string;
}

export const DEPLOYMENT_STAGES: DeploymentStage[] = [
  {
    id: 'repo_access',
    label: 'Repository Access',
    icon: '📦',
    status: 'waiting',
    weight: 5,
  },
  {
    id: 'code_analysis',
    label: 'Code Analysis',
    icon: '🔍',
    status: 'waiting',
    weight: 5,
  },
  {
    id: 'dockerfile_generation',
    label: 'Dockerfile Generation',
    icon: '🐳',
    status: 'waiting',
    weight: 5,
  },
  {
    id: 'env_vars',
    label: 'Environment Config',
    icon: '⚙️',
    status: 'waiting',
    weight: 5,
  },
  {
    id: 'security_scan',
    label: 'Security Scan',
    icon: '🔒',
    status: 'waiting',
    weight: 5,
  },
  {
    id: 'container_build',
    label: 'Container Build',
    icon: '🏗️',
    status: 'waiting',
    weight: 50, // Build is the longest
  },
  {
    id: 'cloud_deployment',
    label: 'Cloud Run Deployment',
    icon: '🚀',
    status: 'waiting',
    weight: 25,
  },
];
