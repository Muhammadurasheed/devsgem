import { StageUpdate } from '@/types/deployment';

/**
 * Parse backend log messages into structured deployment stage updates
 * ✅ FIX GAP #3: Added pre-flight check patterns
 */
export const parseBackendLog = (message: string): StageUpdate | null => {
  // ✅ FIX GAP #3: Pre-flight checks - starting
  if (message.includes('🔍 Running pre-flight checks') || message.includes('pre-flight')) {
    return {
      stage: 'repo_access',
      status: 'in-progress',
      details: ['Verifying GCP environment...'],
      progress: 1,
    };
  }

  // ✅ FIX GAP #3: Pre-flight checks - complete
  if (message.includes('✅ All pre-flight checks passed')) {
    return {
      stage: 'repo_access',
      status: 'success',
      details: [
        'Project access verified',
        'Artifact Registry ready',
        'Cloud Build API enabled',
        'Cloud Run API enabled',
        'Storage bucket configured'
      ],
      progress: 100, // Relative: Preflight Success
    };
  }

  // ✅ FIX GAP #3: Individual pre-flight check updates
  if (message.includes('✅ Project access verified')) {
    return {
      stage: 'repo_access',
      status: 'in-progress',
      details: ['Project access verified ✓'],
      progress: 1,
    };
  }

  if (message.includes('✅ Artifact Registry') || message.includes('📦 Creating Artifact Registry')) {
    return {
      stage: 'repo_access',
      status: 'in-progress',
      details: ['Setting up Artifact Registry...'],
      progress: 2,
    };
  }

  // Repository cloning - starting
  if (message.includes('[GitHubService] Cloning') || message.includes('Cloning repository') || message.includes('🚀 Starting repository clone')) {
    return {
      stage: 'repo_access',
      status: 'in-progress',
      details: ['Cloning repository from GitHub...'],
      progress: 5,
    };
  }

  // Repository cloning - complete
  if ((message.includes('Cloning') && message.includes('to')) || message.includes('Repository cloned')) {
    const match = message.match(/to (.+)/);
    return {
      stage: 'repo_access',
      status: 'success',
      details: [
        'Cloned from GitHub',
        `Location: ${match ? match[1] : 'local cache'}`,
      ],
      progress: 100, // Relative: Stage complete
    };
  }

  // Code analysis - starting
  if (message.includes('[AnalysisService] Analyzing project') || message.includes('Starting code analysis')) {
    return {
      stage: 'code_analysis',
      status: 'in-progress',
      details: ['Detecting framework and dependencies...'],
      progress: 20,
    };
  }

  // Code analysis - scanning
  if (message.includes('Analyzing project at')) {
    return {
      stage: 'code_analysis',
      status: 'in-progress',
      details: ['Scanning project structure...'],
      progress: 25,
    };
  }

  // Code analysis - framework detection
  if (message.includes('Detected framework') || message.match(/framework.*detected/i)) {
    const match = message.match(/(?:framework[:\s]+|detected\s+)(\w+)/i);
    const framework = match ? match[1] : 'unknown';
    return {
      stage: 'code_analysis',
      status: 'in-progress',
      details: [
        `Framework detected: ${framework}`,
        'Analyzing dependencies...',
      ],
      progress: 30,
    };
  }

  // Code analysis - complete
  if (message.includes('Analysis complete') || message.includes('analysis_result')) {
    return {
      stage: 'code_analysis',
      status: 'success',
      details: [
        'Framework and runtime identified',
        'Dependencies analyzed',
        'Configuration validated',
      ],
      progress: 100, // Relative: Stage complete
    };
  }

  // Dockerfile generation - starting
  if (message.includes('[AnalysisService] Generating Dockerfile') || message.includes('Generating Dockerfile')) {
    const match = message.match(/Generating Dockerfile for (\w+)/);
    const framework = match ? match[1] : 'detected framework';
    return {
      stage: 'dockerfile_generation',
      status: 'in-progress',
      details: [
        `Framework: ${framework}`,
        'Creating optimized Docker configuration...',
      ],
      progress: 40,
    };
  }

  // ✅ FIX GAP #3: Dockerfile saving - in progress
  if (message.includes('💾 Saving Dockerfile')) {
    return {
      stage: 'dockerfile_generation',
      status: 'in-progress',
      details: ['Saving Dockerfile to project...'],
      progress: 48,
    };
  }

  // Dockerfile generation - complete
  if (message.includes('[DockerService] Dockerfile saved') || message.includes('Dockerfile created') || message.includes('✅ Dockerfile saved')) {
    return {
      stage: 'dockerfile_generation',
      status: 'success',
      details: [
        'Multi-stage build configured',
        'Security best practices applied',
        'Layer caching optimized',
        'Dockerfile saved to project'
      ],
      progress: 100, // Relative: Stage complete
    };
  }

  // Security scan - starting
  if (message.includes('Security scan') || message.includes('Scanning for vulnerabilities')) {
    return {
      stage: 'security_scan',
      status: 'in-progress',
      details: ['Scanning for vulnerabilities...'],
      progress: 55,
    };
  }

  // Security scan - complete
  if (message.includes('Security scan complete') || message.includes('No vulnerabilities')) {
    return {
      stage: 'security_scan',
      status: 'success',
      details: ['Security checks passed'],
      progress: 100, // Relative: Stage complete
    };
  }

  // Container build - starting
  if (message.includes('Building container image') || message.includes('[DockerService] Building')) {
    return {
      stage: 'container_build',
      status: 'in-progress',
      details: ['Building Docker image...'],
      progress: 65,
    };
  }

  // Container build - progress
  if (message.includes('Building') && message.includes('%')) {
    const match = message.match(/(\d+)%/);
    const buildProgress = match ? parseInt(match[1]) : 0;
    return {
      stage: 'container_build',
      status: 'in-progress',
      details: [`Build progress: ${buildProgress}%`],
      progress: buildProgress, // Relative: Use raw 0-100 build pct
    };
  }

  // Container build - complete
  if (message.includes('Container image built') || message.includes('Build complete')) {
    return {
      stage: 'container_build',
      status: 'success',
      details: ['Image built successfully'],
      progress: 100, // Relative: Stage complete
    };
  }

  // Cloud deployment - starting
  if (message.includes('Deploying to Cloud Run') || message.includes('[GCloudService] Deploying')) {
    return {
      stage: 'cloud_deployment',
      status: 'in-progress',
      details: ['Launching service on Cloud Run...'],
      progress: 85,
    };
  }

  // Cloud deployment - progress
  if (message.includes('Deployment progress')) {
    return {
      stage: 'cloud_deployment',
      status: 'in-progress',
      details: ['Configuring service...'],
      progress: 90,
    };
  }

  // ✅ FIX GAP #3: Deployment health checks
  if (message.includes('🔍 Verifying deployment health') || message.includes('Waiting for service to be ready')) {
    return {
      stage: 'cloud_deployment',
      status: 'in-progress',
      details: ['Verifying service health...'],
      progress: 95,
    };
  }

  // Cloud deployment - complete
  if (message.includes('Deployment successful') || message.includes('deployed successfully') || message.includes('Service URL:') || message.includes('🎉 Deployment complete')) {
    return {
      stage: 'cloud_deployment',
      status: 'success',
      details: ['Service deployed and verified successfully!'],
      progress: 100, // Relative: Stage complete
    };
  }

  // Error detection
  if (message.includes('Error:') || message.includes('Failed:') || message.includes('[ERROR]')) {
    return {
      stage: 'unknown',
      status: 'error',
      message: message,
      progress: 0,
    };
  }

  return null;
};

/**
 * Calculate duration between two timestamps
 */
export const calculateDuration = (startTime?: string, endTime?: string): number => {
  if (!startTime || !endTime) return 0;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.round((end - start) / 1000);
};

/**
 * Generate unique deployment ID
 */
export const generateDeploymentId = (): string => {
  return `deploy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
