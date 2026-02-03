import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, TrendingUp, Activity, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { DeploymentStage } from '@/types/deployment';

// Historical stage durations for fallback estimation
const STAGE_BENCHMARKS: Record<string, { min: number; avg: number; max: number }> = {
    'repo_access': { min: 2, avg: 5, max: 15 },
    'code_analysis': { min: 3, avg: 10, max: 30 },
    'dockerfile_generation': { min: 2, avg: 5, max: 15 },
    'security_scan': { min: 1, avg: 3, max: 10 },
    'container_build': { min: 30, avg: 90, max: 300 },
    'cloud_deployment': { min: 20, avg: 60, max: 180 },
};

function formatTimeRemaining(seconds: number): string {
    if (seconds < 0) return 'Calculating...';
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.ceil(seconds % 60);
    if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

export function GlobalStickyTimer() {
    const { activeDeployment } = useWebSocketContext();
    const [isVisible, setIsVisible] = useState(true);

    const [eta, setEta] = useState<{
        seconds: number;
        confidence: 'low' | 'medium' | 'high';
        trend: 'faster' | 'slower' | 'stable';
    }>({
        seconds: -1,
        confidence: 'low',
        trend: 'stable'
    });

    const progressHistory = useRef<{ progress: number; timestamp: number }[]>([]);
    const emaSpeed = useRef<number>(0);
    const lastProgress = useRef<number>(0);
    const lastProgressTime = useRef<number>(Date.now());
    const shadowTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Reset when deployment changes
    useEffect(() => {
        if (activeDeployment?.startTime) {
            progressHistory.current = [];
            emaSpeed.current = 0;
            lastProgress.current = 0;
            lastProgressTime.current = Date.now();
            setIsVisible(true);
        }
    }, [activeDeployment?.startTime]);

    const calculateETA = useCallback(() => {
        if (!activeDeployment || activeDeployment.status !== 'deploying') return;

        const now = Date.now();
        const startTime = new Date(activeDeployment.startTime).getTime();
        const elapsed = (now - startTime) / 1000;
        const overallProgress = activeDeployment.overallProgress || 0;
        const currentStage = activeDeployment.currentStage;

        // Track progress history
        if (overallProgress !== lastProgress.current) {
            const timeDelta = (now - lastProgressTime.current) / 1000;
            const progressDelta = overallProgress - lastProgress.current;

            if (timeDelta > 0 && progressDelta > 0) {
                const instantSpeed = progressDelta / timeDelta; // % per second
                // EMA smoothing (0.2 for slower, more stable changes)
                const alpha = 0.2;
                emaSpeed.current = emaSpeed.current === 0
                    ? instantSpeed
                    : alpha * instantSpeed + (1 - alpha) * emaSpeed.current;

                progressHistory.current.push({ progress: overallProgress, timestamp: now });
                if (progressHistory.current.length > 10) progressHistory.current.shift();
            }
            lastProgress.current = overallProgress;
            lastProgressTime.current = now;
        }

        // --- [PRINCIPAL CALCULATION] STAGE-WEIGHTED FUSION MODEL ---
        const stages: DeploymentStage[] = activeDeployment.stages || [];
        const currentStageIndex = stages.findIndex(s => s.id === currentStage);

        let estimatedSeconds = -1;
        let confidence: 'low' | 'medium' | 'high' = 'low';
        let trend: 'faster' | 'slower' | 'stable' = 'stable';

        if (currentStageIndex >= 0) {
            let totalRemainingBenchmark = 0;
            const remainingStages = stages.slice(currentStageIndex);

            remainingStages.forEach((stage, idx) => {
                const benchmark = STAGE_BENCHMARKS[stage.id] || { avg: 20 };
                if (idx === 0) {
                    // Current stage: progress-adjusted
                    // We assume progress within a stage is linear (if not provided, we use 50% as safe harbor)
                    const stageProgress = (stage.status === 'success') ? 100 : 30; // Heuristic if sub-progress missing
                    totalRemainingBenchmark += benchmark.avg * (1 - stageProgress / 100);
                } else {
                    // Future stages: full benchmark
                    totalRemainingBenchmark += benchmark.avg;
                }
            });

            // EMA Calibration: If we have a stable speed, we blend it with the benchmark
            if (emaSpeed.current > 0 && overallProgress > 10) {
                const EMA_WEIGHT = Math.min(0.7, overallProgress / 100); // trust EMA more as we go
                const rawEmaETA = (100 - overallProgress) / emaSpeed.current;

                // Blend: Fusion = (EMA * weight) + (Benchmark * (1-weight))
                estimatedSeconds = (rawEmaETA * EMA_WEIGHT) + (totalRemainingBenchmark * (1 - EMA_WEIGHT));

                // Confidence & Trend logic (preserved)
                const dataPoints = progressHistory.current.length;
                if (dataPoints >= 5 && overallProgress >= 30) confidence = 'high';
                else if (dataPoints >= 3 && overallProgress >= 15) confidence = 'medium';

                if (dataPoints >= 3) {
                    const recent = progressHistory.current[dataPoints - 1];
                    const older = progressHistory.current[dataPoints - 3];
                    const recentSpeed = (recent.progress - older.progress) / ((recent.timestamp - older.timestamp) / 1000);
                    if (recentSpeed > emaSpeed.current * 1.2) trend = 'faster';
                    else if (recentSpeed < emaSpeed.current * 0.8) trend = 'slower';
                }
            } else {
                estimatedSeconds = totalRemainingBenchmark;
            }
        }

        // 🛡️ [FAANG SAFETY BOUNDS]: Prevent 'The 3s Trap'
        // If we are in 'cloud_deployment', it physicaly takes ~30s minimum for GCP to propagate.
        if (currentStage === 'cloud_deployment' && estimatedSeconds < 25) {
            estimatedSeconds = 25;
        }

        if (estimatedSeconds > 600) estimatedSeconds = 600;
        if (estimatedSeconds < 3) estimatedSeconds = 3;

        setEta(prev => ({
            seconds: estimatedSeconds,
            confidence,
            trend
        }));

    }, [activeDeployment]);

    // Update loop (Backend updates)
    useEffect(() => {
        if (activeDeployment?.status === 'deploying') {
            const interval = setInterval(calculateETA, 1000);
            calculateETA();
            return () => clearInterval(interval);
        }
    }, [activeDeployment?.status, calculateETA]);

    // ✅ SHADOW COUNTDOWN: Fluid decrement every 100ms
    useEffect(() => {
        if (activeDeployment?.status === 'deploying' && eta.seconds > 0) {
            shadowTimerRef.current = setInterval(() => {
                setEta(prev => {
                    if (prev.seconds <= 1) return prev; // Hold at 1s until next update
                    return { ...prev, seconds: prev.seconds - 0.1 };
                });
            }, 100);
            return () => {
                if (shadowTimerRef.current) clearInterval(shadowTimerRef.current);
            };
        }
    }, [activeDeployment?.status, eta.seconds > 0]); // Re-sync when major ETA updates occur

    if (!activeDeployment || activeDeployment.status !== 'deploying' || !isVisible) {
        return null;
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-6 right-6 z-[9999] flex items-center gap-4 p-4 bg-background/80 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl shadow-primary/10"
            >
                {/* Progress Circle */}
                <div className="relative w-10 h-10">
                    <svg className="w-10 h-10 transform -rotate-90">
                        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="none" className="text-muted" />
                        <circle
                            cx="20" cy="20" r="18"
                            stroke="currentColor" strokeWidth="3" fill="none"
                            strokeDasharray={`${2 * Math.PI * 18}`}
                            strokeDashoffset={`${2 * Math.PI * 18 * (1 - (activeDeployment.overallProgress || 0) / 100)}`}
                            className="text-primary transition-all duration-500 ease-in-out"
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-primary animate-pulse" />
                    </div>
                </div>

                <div className="flex flex-col min-w-[140px]">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-foreground">Deploying...</span>
                        <span className="text-xs font-mono text-muted-foreground">{Math.round(activeDeployment.overallProgress || 0)}%</span>
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-primary tabular-nums">
                            {eta.seconds < 0 ? 'Calculating...' : `~${formatTimeRemaining(eta.seconds)} left`}
                        </span>

                        {/* Trend Indicator */}
                        {eta.seconds > 0 && eta.trend !== 'stable' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className={cn(
                                    "flex items-center gap-0.5 px-1 rounded text-[8px] font-bold uppercase",
                                    eta.trend === 'faster' ? "bg-green-500/10 text-green-500" : "bg-orange-500/10 text-orange-500"
                                )}
                            >
                                <TrendingUp className={cn("w-2 h-2", eta.trend === 'slower' && "rotate-180")} />
                                {eta.trend}
                            </motion.div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setIsVisible(false)}
                    className="p-1 hover:bg-muted rounded-full transition-colors"
                >
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>
            </motion.div>
        </AnimatePresence>
    );
}
