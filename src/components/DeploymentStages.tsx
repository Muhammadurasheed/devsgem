import { motion, AnimatePresence } from 'framer-motion';
import { GitBranch, Search, MonitorPlay, Cloud, Globe, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import '@/styles/transformation.css';
import confetti from 'canvas-confetti';
import { useEffect, useState } from 'react';

interface DeploymentStagesProps {
    currentStage: string;
    progress: number;
}

const STAGES = [
    { id: 'REPO_CLONE', label: 'Clone Repository', icon: GitBranch, description: 'Fetching your code...' },
    { id: 'CODE_ANALYSIS', label: 'Analyze Code', icon: Search, description: 'Understanding structure...' },
    { id: 'BUILD_IMAGE', label: 'Build Solution', icon: MonitorPlay, description: 'Creating container...' },
    { id: 'DEPLOY_SERVICE', label: 'Deploying', icon: Cloud, description: 'Launching to cloud...' },
    { id: 'COMPLETE', label: 'Live Access', icon: Globe, description: 'Ready for users!' },
];

export const DeploymentStages = ({ currentStage, progress }: DeploymentStagesProps) => {

    const [elapsedTime, setElapsedTime] = useState('00:00');
    const [startTime] = useState(Date.now());

    useEffect(() => {
        if (currentStage === 'COMPLETE' || currentStage.includes('SUCCESS')) return;

        const interval = setInterval(() => {
            const seconds = Math.floor((Date.now() - startTime) / 1000);
            const m = Math.floor(seconds / 60).toString().padStart(2, '0');
            const s = (seconds % 60).toString().padStart(2, '0');
            setElapsedTime(`${m}:${s}`);
        }, 1000);

        return () => clearInterval(interval);
    }, [currentStage, startTime]);

    // Robust Active Index Logic - Maps backend stage IDs to UI pipeline steps
    const getStepIndex = (stage: string) => {
        if (!stage) return 0;
        const s = stage.toUpperCase();

        // Completed states override everything (index 5 = beyond last stage)
        if (s.includes('COMPLETE') || s.includes('SUCCESS') || s.includes('LIVE')) return 5;

        // Stage 0: Repository Clone
        if (s.includes('CLONE') || s.includes('REPO')) return 0;

        // Stage 1: Code Analysis (includes dockerfile generation)
        if (s.includes('ANALYSIS') || s.includes('ANALYZE') || s.includes('CODE_ANALYSIS') ||
            s.includes('DOCKERFILE')) return 1;

        // Stage 2: Build (includes security scan, docker build, kaniko, container build)
        if (s.includes('BUILD') || s.includes('DOCKER') || s.includes('CONTAINER') ||
            s.includes('SECURITY') || s.includes('KANIKO') || s.includes('IMAGE')) return 2;

        // Stage 3: Deploy (includes provisioning, health check, service creation)
        if (s.includes('DEPLOY') || s.includes('PROVISION') || s.includes('CLOUD') ||
            s.includes('HEALTH') || s.includes('VERIFY') || s.includes('SERVICE') ||
            s.includes('ENV_VARS') || s.includes('IAM')) return 3;

        return 0;
    };

    const activeIndex = getStepIndex(currentStage);
    const isSuccess = activeIndex >= 4; // Completion state

    useEffect(() => {
        if (isSuccess) {
            const end = Date.now() + 3 * 1000;
            const colors = ['#3B82F6', '#8B5CF6', '#F472B6'];

            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: colors
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }
    }, [isSuccess]);

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
                    const isActive = index === activeIndex;
                    const isCompleted = index < activeIndex || isSuccess; // ✅ Logic Fix: All stages complete if success

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
                                    backgroundColor: isCompleted ? "hsl(var(--primary))" : isActive ? "hsl(var(--background))" : "hsl(var(--secondary))",
                                    borderColor: isCompleted ? "hsl(var(--primary))" : isActive ? "hsl(var(--primary))" : "hsl(var(--border))"
                                }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-lg relative",
                                    isActive && "ring-4 ring-primary/20 border-primary"
                                )}
                            >
                                <AnimatePresence mode="wait">
                                    {isCompleted ? (
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
