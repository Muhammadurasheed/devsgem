
import { motion } from 'framer-motion';
import { FileCode, Layers, Box, Database, Zap, Shield, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisVisualizerProps {
    data: any;
}

export function AnalysisVisualizer({ data }: AnalysisVisualizerProps) {
    const analysis = data?.analysis || {};
    const dockerfile = data?.dockerfile || {};

    const stats = [
        { label: 'Language', value: analysis.language, icon: FileCode, color: 'text-blue-400' },
        { label: 'Framework', value: analysis.framework, icon: Layers, color: 'text-purple-400' },
        { label: 'Dependencies', value: analysis.dependencies_count || 0, icon: Box, color: 'text-yellow-400' },
        { label: 'Env Vars', value: (analysis.env_vars || []).length, icon: Database, color: 'text-green-400' },
    ];

    const optimizations = dockerfile.optimizations || [];

    return (
        <div className="w-full mt-4 mb-2">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl p-4 border border-white/10 overflow-hidden"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Project Intelligence</h3>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    {stats.map((stat, i) => (
                        <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/5 flex flex-col">
                            <div className="flex items-center gap-2 mb-1">
                                <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                                <span className="text-[10px] text-gray-400 uppercase">{stat.label}</span>
                            </div>
                            <span className="text-sm font-mono font-semibold text-gray-200 capitalize">
                                {stat.value || 'N/A'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Optimizations List */}
                {optimizations.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-xs font-semibold text-gray-300">Auto-Applied Optimizations</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {optimizations.slice(0, 4).map((opt: string, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-400 bg-black/20 p-2 rounded">
                                    <CheckCircle2 className="w-3 h-3 text-green-500/70" />
                                    <span className="truncate">{opt}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
