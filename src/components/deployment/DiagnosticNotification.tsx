/**
 * DiagnosticNotification - AI-Powered Error Diagnosis UI
 * 
 * This component displays Gemini Brain's error diagnosis when a deployment fails.
 * It shows the root cause, affected files, and provides an "Apply Fix" action.
 * 
 * Part of the Self-Healing Infrastructure (Hackathon Feature)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Brain,
    AlertTriangle,
    FileCode,
    Wrench,
    CheckCircle,
    Loader2,
    ChevronDown,
    ChevronUp,
    Zap,
    Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface DiagnosisInfo {
    root_cause: string;
    affected_files: string[];
    recommended_fix?: {
        file_path?: string;
        changes?: Array<{
            original?: string;
            modified?: string;
            old_content?: string;
            new_content?: string;
        }>;
    };
    confidence_score: number;
    error_category: string;
    explanation: string;
}

interface DiagnosticNotificationProps {
    diagnosis: DiagnosisInfo;
    onApplyFix: () => Promise<void>;
    onSkip?: () => void;
    isApplying?: boolean;
    className?: string;
}

export const DiagnosticNotification: React.FC<DiagnosticNotificationProps> = ({
    diagnosis,
    onApplyFix,
    onSkip,
    isApplying = false,
    className
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [fixApplied, setFixApplied] = useState(false);

    const handleApplyFix = async () => {
        try {
            await onApplyFix();
            setFixApplied(true);
        } catch (error) {
            console.error('Failed to apply fix:', error);
        }
    };

    const getConfidenceColor = (score: number) => {
        if (score >= 80) return 'text-green-500';
        if (score >= 60) return 'text-yellow-500';
        return 'text-orange-500';
    };

    const getConfidenceLabel = (score: number) => {
        if (score >= 80) return 'High Confidence';
        if (score >= 60) return 'Medium Confidence';
        return 'Low Confidence';
    };

    const isVibe = diagnosis.error_category === 'Vibe Coding';

    const getThemeStyles = () => {
        if (isVibe) {
            return {
                border: "border-purple-500/30",
                bg: "bg-gradient-to-br from-purple-950/40 via-background to-background",
                gradient: "from-purple-500 via-pink-500 to-blue-500",
                iconBg: "bg-purple-500/20 text-purple-400",
                ping: "bg-purple-400",
                dot: "bg-purple-500",
                titleIcon: "text-purple-400",
                titleText: "text-purple-100",
                badge: isVibe ? "bg-purple-500/20 text-purple-300" : undefined
            };
        }
        return {
            border: "border-amber-500/30",
            bg: "bg-gradient-to-br from-amber-950/40 via-background to-background",
            gradient: "from-amber-500 via-orange-500 to-red-500",
            iconBg: "bg-amber-500/20 text-amber-400",
            ping: "bg-amber-400",
            dot: "bg-amber-500",
            titleIcon: "text-amber-400",
            titleText: "text-amber-100",
            badge: undefined
        };
    };

    const theme = getThemeStyles();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={cn(
                "relative overflow-hidden rounded-xl border shadow-2xl",
                theme.border,
                theme.bg,
                className
            )}
        >
            {/* Animated gradient border effect */}
            <div className="absolute inset-0 opacity-20">
                <div className={cn("absolute inset-0 bg-gradient-to-r animate-pulse", theme.gradient)} />
            </div>

            {/* Header */}
            <div className={cn("relative p-4 border-b", theme.border)}>
                <div className="flex items-start gap-3">
                    <div className="relative">
                        <div className={cn("p-2 rounded-lg", theme.iconBg)}>
                            {isVibe ? <Sparkles className="w-6 h-6" /> : <Brain className="w-6 h-6" />}
                        </div>
                        {/* Pulse effect */}
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", theme.ping)}></span>
                            <span className={cn("relative inline-flex rounded-full h-3 w-3", theme.dot)}></span>
                        </span>
                    </div>

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className={cn("font-semibold flex items-center gap-2", theme.titleText)}>
                                {isVibe ? <Zap className={cn("w-4 h-4", theme.titleIcon)} /> : <Sparkles className={cn("w-4 h-4", theme.titleIcon)} />}
                                {isVibe ? "Gemini Vibe Proposal" : "Gemini Brain Diagnosis"}
                            </h3>
                            <span className={cn(
                                "text-xs font-mono px-2 py-0.5 rounded-full bg-black/30",
                                theme.badge || getConfidenceColor(diagnosis.confidence_score)
                            )}>
                                {diagnosis.confidence_score}% • {getConfidenceLabel(diagnosis.confidence_score)}
                            </span>
                        </div>

                        <p className={cn("text-sm line-clamp-2", isVibe ? "text-purple-200/80" : "text-amber-200/80")}>
                            {diagnosis.root_cause}
                        </p>
                    </div>
                </div>
            </div>

            {/* Expandable Details */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn("relative border-b", theme.border)}
                    >
                        <div className="p-4 space-y-4">
                            {/* Category */}
                            <div className="flex items-center gap-2 text-sm">
                                {isVibe ? <Sparkles className="w-4 h-4 text-purple-500" /> : <AlertTriangle className="w-4 h-4 text-amber-500" />}
                                <span className="text-muted-foreground">Category:</span>
                                <span className={cn(
                                    "font-mono px-2 py-0.5 rounded",
                                    isVibe ? "text-purple-300 bg-purple-950/50" : "text-amber-300 bg-amber-950/50"
                                )}>
                                    {diagnosis.error_category}
                                </span>
                            </div>

                            {/* Affected Files */}
                            {diagnosis.affected_files.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <FileCode className="w-4 h-4" />
                                        {isVibe ? "Target Files:" : "Affected Files:"}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {diagnosis.affected_files.map((file, i) => (
                                            <span
                                                key={i}
                                                className="text-xs font-mono bg-secondary/50 px-2 py-1 rounded border border-border"
                                            >
                                                {file}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Explanation */}
                            <div className="text-sm text-muted-foreground bg-black/20 rounded-lg p-3 border border-border/50">
                                <p className="leading-relaxed">{diagnosis.explanation}</p>
                            </div>

                            {/* Code Preview */}
                            {diagnosis.recommended_fix?.changes?.[0] && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Wrench className="w-4 h-4" />
                                        Proposed Change:
                                    </div>
                                    <pre className={cn(
                                        "text-xs font-mono rounded-lg p-3 overflow-x-auto border",
                                        isVibe ? "bg-purple-950/30 border-purple-500/30" : "bg-green-950/30 border-green-500/30"
                                    )}>
                                        <code className={isVibe ? "text-purple-300" : "text-green-300"}>
                                            {diagnosis.recommended_fix.changes[0].modified?.slice(0, 500) || diagnosis.recommended_fix.changes[0].new_content?.slice(0, 500)}
                                            {((diagnosis.recommended_fix.changes[0].modified?.length || 0) > 500 || (diagnosis.recommended_fix.changes[0].new_content?.length || 0) > 500) && '...'}
                                        </code>
                                    </pre>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Actions Footer */}
            <div className="relative p-4">
                <div className="flex items-center justify-between gap-3">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {isExpanded ? (
                            <>
                                <ChevronUp className="w-4 h-4" />
                                Hide Details
                            </>
                        ) : (
                            <>
                                <ChevronDown className="w-4 h-4" />
                                View Details
                            </>
                        )}
                    </button>

                    <div className="flex items-center gap-2">
                        {onSkip && !fixApplied && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onSkip}
                                disabled={isApplying}
                                className="text-muted-foreground"
                            >
                                {isVibe ? "Reject" : "Skip"}
                            </Button>
                        )}

                        {fixApplied ? (
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                disabled
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {isVibe ? "Applied" : "Fix Applied"}
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleApplyFix}
                                disabled={isApplying || diagnosis.confidence_score < 50}
                                className={cn(
                                    "text-white shadow-lg",
                                    isVibe
                                        ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-purple-500/25"
                                        : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/25"
                                )}
                            >
                                {isApplying ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Applying...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="w-4 h-4 mr-2" />
                                        {isVibe ? "Apply Change" : "Apply Fix & Redeploy"}
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default DiagnosticNotification;
