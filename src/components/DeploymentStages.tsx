import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Search, FileCode, Settings, Shield, Package, Cloud, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/styles/transformation.css';
import { useEffect, useState } from 'react';

interface DeploymentStagesProps {
    currentStage: string;
    progress: number;
    // FAANG-LEVEL: Accept stage statuses for accurate checkmark rendering
    stageStatuses?: { id: string; status: string }[];
}

// ✅ PRINCIPAL FIX: STAGES now match backend DEPLOYMENT_STAGES exactly (7 stages)
export const STAGES = [
    { id: 'repo_access', label: 'Repository', icon: GitBranch, description: 'Fetching your code...' },
    { id: 'code_analysis', label: 'Analysis', icon: Search, description: 'Understanding structure...' },
    { id: 'dockerfile_generation', label: 'Dockerfile', icon: FileCode, description: 'Creating container recipe...' },
    { id: 'env_vars', label: 'Env Config', icon: Settings, description: 'Configuring secrets...' },
    { id: 'security_scan', label: 'Security', icon: Shield, description: 'Scanning vulnerabilities...' }, // ✅ SYNCED with Backend
    { id: 'container_build', label: 'Build', icon: Package, description: 'Building image...' },
    { id: 'cloud_deployment', label: 'Deploy', icon: Cloud, description: 'Launching to cloud...' },
];

export const DeploymentStages = ({ currentStage, progress, stageStatuses }: DeploymentStagesProps) => {

    const [elapsedTime, setElapsedTime] = useState('00:00');
    const [startTime] = useState(Date.now());

    // ✅ FAANG-LEVEL: Check if deployment is fully complete
    const isDeploymentComplete = currentStage === 'success' ||
        currentStage.toLowerCase().includes('complete') ||
        stageStatuses?.find(s => s.id === 'cloud_deployment')?.status === 'success';

    useEffect(() => {
        if (isDeploymentComplete) return;

        const interval = setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000);
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            setElapsedTime(`${m}:${s}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [isDeploymentComplete, startTime]);

    // ✅ PRINCIPAL FIX: Direct index lookup from STAGES array (no more string matching)
    const getStepIndex = (stage: string) => {
        if (!stage) return 0;
        const s = stage.toLowerCase();

        // Check for completion states
        if (s === 'success' || s.includes('complete') || s.includes('live')) {
            return STAGES.length; // Beyond last stage = complete
        }

        // Direct lookup by ID
        const index = STAGES.findIndex(stg => stg.id === s);
        return index >= 0 ? index : 0;
    };

    // ✅ FAANG-LEVEL: Get stage status from context or infer from index
    const getStageStatus = (stageId: string, index: number) => {
        // First, check if we have explicit status from props
        const explicit = stageStatuses?.find(s => s.id === stageId);
        if (explicit) return explicit.status;

        // Fallback: infer from current stage index
        const activeIndex = getStepIndex(currentStage);
        if (index < activeIndex) return 'success';
        if (index === activeIndex) return 'in-progress';
        return 'waiting';
    };

    const activeIndex = getStepIndex(currentStage);
    const isSuccess = isDeploymentComplete || activeIndex >= STAGES.length;


    return (
        <div className="w-full py-8 px-4">
            <div className="relative flex justify-between items-center max-w-3xl mx-auto">

                {/* Progress Bar Background */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-secondary/30 -z-10 rounded-full overflow-hidden">
                    {/* Animated Gradient Bar */}
                    <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"
                        initial={{ width: '0%' }}
                        animate={{ width: `${(activeIndex / (STAGES.length - 1)) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                    />
                </div>

                {/* Timer Display */}
                <div className="absolute -top-6 right-0 flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        isSuccess ? "bg-green-500" : "bg-blue-500 animate-pulse"
                    )} />
                    {elapsedTime}
                </div>

                {STAGES.map((stage, index) => {
                    // ✅ FAANG-LEVEL: Use actual status from props, not just index inference
                    const stageStatus = getStageStatus(stage.id, index);
                    const isActive = stageStatus === 'in-progress';
                    const isCompleted = stageStatus === 'success' || isSuccess;
                    const isError = stageStatus === 'error';

                    const Icon = stage.icon;

                    return (
                        <div key={stage.id} className="relative z-10 flex flex-col items-center">

                            {/* Glowing Ring Effect for Active Step */}
                            {isActive && (
                                <div className="absolute -inset-4 rounded-full bg-blue-500/20 blur-xl animate-pulse-dot" />
                            )}

                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isActive ? 1.25 : 1,
                                    backgroundColor: isError ? "hsl(0 84% 60%)" : isCompleted ? "hsl(var(--primary))" : isActive ? "hsl(var(--background))" : "hsl(var(--secondary))",
                                    borderColor: isError ? "hsl(0 84% 60%)" : isCompleted ? "hsl(var(--primary))" : isActive ? "hsl(var(--primary))" : "hsl(var(--border))"
                                }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-lg relative",
                                    isActive && "ring-4 ring-primary/20 border-primary",
                                    isError && "ring-4 ring-red-500/20 border-red-500"
                                )}
                            >
                                <AnimatePresence mode="wait">
                                    {isError ? (
                                        <motion.div
                                            key="error"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                        >
                                            <XCircle className="w-6 h-6 text-white" />
                                        </motion.div>
                                    ) : isCompleted ? (
                                        <motion.div
                                            key="check"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                        >
                                            <CheckCircle2 className="w-6 h-6 text-primary-foreground" />
                                        </motion.div>
                                    ) : isActive ? (
                                        <motion.div
                                            key="loading"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                        >
                                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="icon"
                                            initial={{ scale: 0, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0, opacity: 0 }}
                                        >
                                            <Icon className="w-5 h-5 text-muted-foreground" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Pulse Ring for Active */}
                                {isActive && (
                                    <span className="absolute -inset-2 rounded-full border border-primary/30 animate-pulse-ring" />
                                )}
                            </motion.div>

                            {/* Label & Description */}
                            <div className="absolute top-16 w-32 flex flex-col items-center text-center">
                                <span className={cn(
                                    "text-sm font-semibold transition-colors duration-300",
                                    isActive ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                                )}>
                                    {stage.label}
                                </span>
                                {isActive && (
                                    <motion.span
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-xs text-muted-foreground mt-1"
                                    >
                                        {stage.description}
                                    </motion.span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
