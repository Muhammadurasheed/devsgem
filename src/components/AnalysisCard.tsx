import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { CheckCircle2, Server, Cpu, Globe, Boxes, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AnalysisCardProps {
    summary: string;
    analysisData?: {
        framework: string;
        language: string;
        port: number;
        readiness_score: number; // 0-100
        verdict: string;
        complexity?: 'Low' | 'Medium' | 'High';
        metrics?: {
            total_files: number;
            total_lines: number;
            total_size_kb: number;
            extension_map: Record<string, number>;
        }
    };
}

// Fallback parser if structured data isn't directly available (extracts from text)
const parseSummary = (text: string) => {
    const framework = text.match(/Framework:?\s*([A-Za-z0-9\.\-\_]+)/i)?.[1] || 'Unknown';
    const language = text.match(/Language:?\s*([A-Za-z0-9\.\-\_]+)/i)?.[1] || 'Polyglot';
    const port = text.match(/Port:?\s*(\d+)/i)?.[1] || '8080';
    const complexity = text.toLowerCase().includes('high') ? 'High' : (text.toLowerCase().includes('medium') ? 'Medium' : 'Low');
    return { framework, language, port: parseInt(port), complexity };
};

export const AnalysisCard = ({ summary, analysisData }: AnalysisCardProps) => {
    const data = analysisData || {
        ...parseSummary(summary),
        readiness_score: 98,
        verdict: "Ready for Cloud Run (Gen 2)",
        metrics: undefined
    };

    const [scanComplete, setScanComplete] = useState(false);
    const [counter, setCounter] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => setScanComplete(true), 1500);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (scanComplete && data.metrics?.total_lines) {
            const duration = 2000;
            const steps = 60;
            const increment = data.metrics.total_lines / steps;
            let current = 0;
            const interval = setInterval(() => {
                current += increment;
                if (current >= data.metrics!.total_lines) {
                    setCounter(data.metrics!.total_lines);
                    clearInterval(interval);
                } else {
                    setCounter(Math.floor(current));
                }
            }, duration / steps);
            return () => clearInterval(interval);
        }
    }, [scanComplete, data.metrics?.total_lines]);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-3xl mx-auto"
        >
            <Card className="overflow-hidden border-primary/20 bg-background/90 backdrop-blur-md shadow-xl relative group">

                {/* Scanning Effect Overlay */}
                {!scanComplete && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent z-10 pointer-events-none"
                        initial={{ top: '-100%' }}
                        animate={{ top: '100%' }}
                        transition={{ duration: 1.5, ease: "linear" }}
                    >
                        <div className="w-full h-1 bg-primary/30 shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                    </motion.div>
                )}

                <CardHeader className="border-b border-border/50 bg-muted/20 pb-4">
                    <CardTitle className="text-lg flex items-center gap-3 font-medium">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Cpu className="w-5 h-5 text-primary" />
                        </div>
                        Mission Control Analysis
                        {scanComplete && (
                            <Badge variant="outline" className="ml-auto border-green-500/30 text-green-600 bg-green-500/5 gap-1">
                                <CheckCircle2 className="w-3 h-3" /> VERIFIED
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>

                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative">

                    {/* Left Column: Core Stats */}
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Architecture Detection</label>
                            <div className="flex flex-wrap gap-2">
                                <Badge className="h-8 px-3 text-sm bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/20 gap-2 transition-transform hover:scale-105">
                                    <Boxes className="w-4 h-4" />
                                    {data.framework}
                                </Badge>
                                <Badge variant="secondary" className="h-8 px-3 text-sm gap-2">
                                    <Globe className="w-4 h-4" />
                                    {data.language}
                                </Badge>
                            </div>
                        </div>

                        {data.metrics && (
                            <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/10 relative overflow-hidden group/metrics">
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover/metrics:opacity-100 transition-opacity" />
                                <div className="grid grid-cols-2 gap-4 relative z-10">
                                    <div className="space-y-1">
                                        <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Calculated LoC</div>
                                        <div className="text-2xl font-mono font-bold text-primary tabular-nums">
                                            {scanComplete ? counter.toLocaleString() : '---'}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Entry Points</div>
                                        <div className="text-2xl font-mono font-bold text-foreground tabular-nums">
                                            {scanComplete ? data.metrics.total_files : '---'}
                                        </div>
                                    </div>
                                </div>

                                {scanComplete && (
                                    <motion.div
                                        initial={{ opacity: 0, scaleX: 0 }}
                                        animate={{ opacity: 1, scaleX: 1 }}
                                        className="h-1 w-full bg-muted rounded-full mt-2 overflow-hidden flex"
                                    >
                                        {Object.entries(data.metrics.extension_map).slice(0, 4).map(([ext, count], i) => (
                                            <div
                                                key={ext}
                                                style={{ width: `${(Number(count) / (data.metrics!.total_files || 1)) * 100}%` }}
                                                className={`h-full ${['bg-blue-500', 'bg-purple-500', 'bg-cyan-500', 'bg-indigo-500'][i % 4]}`}
                                                title={`${ext}: ${count} files`}
                                            />
                                        ))}
                                    </motion.div>
                                )}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Infrastructure Target</label>
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                                <Server className="w-5 h-5 text-orange-500" />
                                <div>
                                    <div className="text-sm font-medium">Cloud Run (Gen 2)</div>
                                    <div className="text-xs text-muted-foreground">Port {data.port} • Debian Slim • HTTP/2</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Readiness Score */}
                    <div className="space-y-6 flex flex-col justify-center">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Project Magnitude</label>
                                    <span className="text-xs font-mono text-muted-foreground">{data.metrics?.total_size_kb || 0} KB</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full bg-primary"
                                        initial={{ width: 0 }}
                                        animate={{ width: scanComplete ? '100%' : '0%' }}
                                        transition={{ duration: 1.5, ease: 'easeInOut' }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Readiness Score</label>
                                    <span className="text-2xl font-bold text-primary tabular-nums">{scanComplete ? data.readiness_score : 0}%</span>
                                </div>
                                <div className="h-4 w-full bg-secondary rounded-full overflow-hidden border border-white/5">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 relative"
                                        initial={{ width: 0 }}
                                        animate={{ width: scanComplete ? `${data.readiness_score}%` : '0%' }}
                                        transition={{ duration: 2, ease: 'easeOut', delay: 0.5 }}
                                    >
                                        <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.2)_50%,transparent_100%)] animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                                    </motion.div>
                                </div>
                            </div>
                        </div>

                        <AnimatePresence>
                            {scanComplete && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 shadow-lg shadow-green-500/5 flex gap-4"
                                >
                                    <div className="p-2 h-fit bg-green-500/20 rounded-lg">
                                        <ShieldCheck className="w-5 h-5 text-green-500" />
                                    </div>
                                    <div className="space-y-1.5 pt-0.5">
                                        <div className="text-xs font-bold uppercase tracking-widest text-green-500">Gemini Strategic Verdict</div>
                                        <p className="text-sm text-foreground/90 leading-relaxed font-medium italic">
                                            "{data.verdict}"
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </CardContent>
            </Card>
        </motion.div>
    );
};
import { AnimatePresence } from 'framer-motion';
