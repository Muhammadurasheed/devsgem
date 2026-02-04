import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    ExternalLink,
    RefreshCw,
    ImageOff,
    Camera,
    Loader2,
    Sparkles,
    Wand2,
    Globe,
    ChevronLeft,
    ChevronRight,
    Monitor,
    Smartphone,
    Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocketContext } from '@/contexts/WebSocketContext';

interface DeploymentPreviewProps {
    deploymentId: string;
    deploymentUrl?: string;
    status?: string;
    className?: string;
}

export const DeploymentPreview = ({
    deploymentId,
    deploymentUrl,
    status,
    className
}: DeploymentPreviewProps) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [error, setError] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [mode, setMode] = useState<'live' | 'snapshot'>('snapshot');
    const [view, setView] = useState<'desktop' | 'mobile'>('desktop');
    const { onMessage } = useWebSocketContext();

    const fetchPreview = async (quiet = false) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        try {
            if (!quiet) setIsLoading(true);
            setError(false);

            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/preview`, {
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
                setIsPolling(false);
                return true;
            } else {
                setPreviewUrl(null);
                if (res.status >= 500 && !quiet) setError(true);
                return false;
            }
        } catch (err) {
            console.error('Failed to fetch preview:', err);
            if (!quiet) setError(true);
            return false;
        } finally {
            if (!quiet) setIsLoading(false);
            clearTimeout(timeoutId);
        }
    };

    const regeneratePreview = async () => {
        if (!deploymentUrl) return;
        try {
            setIsRegenerating(true);
            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/preview/regenerate`, { method: 'POST' });
            if (res.ok) {
                toast.info('Visual synthesis initiated...');
                setIsPolling(true);
            }
        } catch (err) {
            toast.error('Synthesis engine failure');
        } finally {
            setIsRegenerating(false);
        }
    };

    useEffect(() => {
        fetchPreview();
        const unsubscribe = onMessage((message: any) => {
            if (message.type === 'snapshot_ready' && message.deploymentId === deploymentId) {
                fetchPreview(true);
            }
        });

        // [FAANG] Default to Live mode if service is live
        if (status === 'live') {
            setMode('live');
        }

        return () => {
            unsubscribe();
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [deploymentId, status]);

    const browserFavicon = deploymentUrl ? `http://localhost:8000/api/branding/proxy?url=${encodeURIComponent(deploymentUrl)}` : null;

    return (
        <div className={cn(
            "group relative w-full flex flex-col rounded-[2rem] overflow-hidden border border-border/40 bg-[#09090b] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] transition-all duration-700",
            view === 'mobile' ? 'aspect-[9/16] max-w-[320px] mx-auto' : 'aspect-video',
            className
        )}>
            {/* [MAANG] High-Fidelity Browser Frame */}
            <div className="flex items-center gap-4 px-6 h-14 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5 z-30">
                {/* Traffic Lights */}
                <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ff5f57] shadow-inner" />
                    <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner" />
                    <div className="w-3 h-3 rounded-full bg-[#28c940] shadow-inner" />
                </div>

                {/* Nav Controls */}
                <div className="flex items-center gap-1 text-zinc-500">
                    <ChevronLeft className="w-4 h-4 cursor-not-allowed opacity-30" />
                    <ChevronRight className="w-4 h-4 cursor-not-allowed opacity-30" />
                    <RefreshCw
                        className={cn("w-3.5 h-3.5 ml-2 cursor-pointer hover:text-white transition-colors", (isLoading || isRegenerating) && "animate-spin")}
                        onClick={() => mode === 'live' ? setMode('live') : fetchPreview()}
                    />
                </div>

                {/* Address Bar */}
                <div className="flex-1 flex items-center gap-2 px-4 h-9 bg-zinc-950/50 rounded-xl border border-white/5 text-[11px] text-zinc-400 font-medium">
                    {browserFavicon && (
                        <img src={browserFavicon} alt="" className="w-4 h-4 rounded-sm object-contain" />
                    )}
                    <Globe className="w-3 h-3 opacity-40" />
                    <span className="truncate opacity-60">{deploymentUrl || 'about:blank'}</span>
                    <div className="ml-auto opacity-20">
                        <Search className="w-3 h-3" />
                    </div>
                </div>

                {/* Mode Toggles */}
                <div className="flex items-center gap-1 p-1 bg-zinc-950/50 rounded-xl border border-white/5">
                    <button
                        onClick={() => setMode('live')}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                            mode === 'live' ? "bg-primary/20 text-primary shadow-lg shadow-primary/10" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        Live
                    </button>
                    <button
                        onClick={() => setMode('snapshot')}
                        className={cn(
                            "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                            mode === 'snapshot' ? "bg-primary/20 text-primary shadow-lg shadow-primary/10" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        Snap
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative flex-1 bg-zinc-950 overflow-hidden">
                <AnimatePresence mode="wait">
                    {mode === 'live' && status === 'live' ? (
                        <motion.iframe
                            key="live-frame"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            src={deploymentUrl}
                            className="w-full h-full border-none bg-white"
                            title="Interactive Preview"
                        />
                    ) : isLoading && mode === 'snapshot' ? (
                        <motion.div
                            key="loader"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                        >
                            <Loader2 className="w-8 h-8 text-primary/40 animate-spin" />
                            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Waking Canvas</span>
                        </motion.div>
                    ) : previewUrl && mode === 'snapshot' ? (
                        <motion.img
                            key="snapshot"
                            initial={{ opacity: 0, scale: 1.02 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            src={previewUrl}
                            alt=""
                            className="w-full h-full object-cover object-top"
                        />
                    ) : (
                        <motion.div
                            key="placeholder"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center"
                        >
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl" />
                                <div className="relative w-24 h-24 rounded-3xl bg-zinc-900 border border-white/5 flex items-center justify-center shadow-2xl">
                                    {isPolling ? <Sparkles className="w-10 h-10 text-primary animate-pulse" /> : <Camera className="w-10 h-10 text-zinc-700" />}
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">
                                {isPolling ? "Visualizing Environment..." : "Snapshot Pending"}
                            </h3>
                            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                                {status === 'live'
                                    ? "We're synthesizing a high-fidelity snapshot of your live service. You can also switch to 'Live' mode for interactive access."
                                    : "No visual data available. Previews are generated automatically once your service reaches 'Live' status."}
                            </p>

                            {status === 'live' && !isPolling && (
                                <Button
                                    onClick={regeneratePreview}
                                    variant="secondary"
                                    size="sm"
                                    className="mt-6 rounded-xl font-bold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                                >
                                    <Sparkles className="w-3.5 h-3.5 mr-2" />
                                    Synthesize Now
                                </Button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Action Bar (Only shows when content is present) */}
                <AnimatePresence>
                    {(previewUrl || (mode === 'live' && status === 'live')) && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1 bg-zinc-900/80 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl z-40 px-3"
                        >
                            <div className="flex items-center gap-2 pr-4 border-r border-white/5">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                                <span className="text-[10px] font-bold text-white/80 uppercase tracking-tighter">Live Instance</span>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-8 w-8 rounded-lg", view === 'desktop' ? "bg-white/10 text-white" : "text-zinc-500")}
                                    onClick={() => setView('desktop')}
                                >
                                    <Monitor className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-8 w-8 rounded-lg", view === 'mobile' ? "bg-white/10 text-white" : "text-zinc-500")}
                                    onClick={() => setView('mobile')}
                                >
                                    <Smartphone className="w-4 h-4" />
                                </Button>
                            </div>

                            <Button
                                variant="secondary"
                                size="sm"
                                className="h-8 rounded-lg font-bold bg-primary text-primary-foreground text-[11px]"
                                onClick={() => window.open(deploymentUrl, '_blank')}
                            >
                                Launch <ExternalLink className="w-3 h-3 ml-2" />
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Error Overlay */}
            {error && mode === 'snapshot' && (
                <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-md flex flex-col items-center justify-center p-8 z-[50]">
                    <ImageOff className="w-12 h-12 text-red-500/30 mb-4" />
                    <h4 className="text-sm font-bold text-red-400 mb-1">Preview Engine Offline</h4>
                    <p className="text-[10px] text-zinc-500 mb-6 max-w-[200px] text-center">We couldn't reach the local snapshot agent. Usually heals automatically.</p>
                    <Button variant="outline" size="sm" onClick={() => fetchPreview()} className="rounded-xl border-red-500/20 text-red-400 hover:bg-red-500/10">
                        Attempt Recovery
                    </Button>
                </div>
            )}
        </div>
    );
};
