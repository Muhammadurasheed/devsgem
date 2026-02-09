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
import { API_BASE_URL } from '@/lib/api/config';
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
    const [error, setError] = useState(false);
    const [view, setView] = useState<'desktop' | 'mobile'>('desktop');
    const { onMessage } = useWebSocketContext();

    const fetchPreview = async () => {
        // [MAANG] This function is now minimal as we focus on Live Iframe
        // We keep it for future health checks or thumbnail generation
        setIsLoading(true);
        setError(false);
        setTimeout(() => setIsLoading(false), 500);
    };

    useEffect(() => {
        // [FAANG] Instant activation for Live services
        if (status === 'live') {
            setIsLoading(false);
        }
    }, [deploymentId, status]);

    useEffect(() => {
        fetchPreview();
        const unsubscribe = onMessage((message: any) => {
            if (message.type === 'snapshot_ready' && message.deploymentId === deploymentId) {
                fetchPreview();
            }
        });

        return () => {
            unsubscribe();
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [deploymentId, status]);

    const browserFavicon = deploymentUrl ? `${API_BASE_URL}/api/branding/proxy?url=${encodeURIComponent(deploymentUrl)}` : null;

    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const updateScale = () => {
        if (!containerRef.current) return;
        const width = containerRef.current.offsetWidth;
        const baseWidth = view === 'mobile' ? 375 : 1280;
        setScale(width / baseWidth);
    };

    useEffect(() => {
        updateScale();
        window.addEventListener('resize', updateScale);
        return () => window.removeEventListener('resize', updateScale);
    }, [view]);

    return (
        <div
            ref={containerRef}
            className={cn(
                "group relative w-full flex flex-col rounded-[2rem] overflow-hidden border border-border/40 bg-[#09090b] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] transition-all duration-700",
                view === 'mobile' ? 'aspect-[9/16] max-w-[320px] mx-auto' : 'aspect-video',
                className
            )}
        >
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
                        className={cn("w-3.5 h-3.5 ml-2 cursor-pointer hover:text-white transition-colors", isLoading && "animate-spin")}
                        onClick={() => fetchPreview()}
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

                {/* Live Indicator */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-xl border border-green-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-green-500 uppercase tracking-wider">Live</span>
                </div>
            </div>

            {/* Content Area */}
            <div className="relative flex-1 bg-zinc-950 overflow-hidden">
                <AnimatePresence mode="wait">
                    {status === 'live' ? (
                        <motion.div
                            key="live-container"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 origin-top-left transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                            style={{
                                width: view === 'mobile' ? '375px' : '1280px',
                                height: view === 'mobile' ? '667px' : '720px',
                                transform: `scale(${scale})`,
                                pointerEvents: 'none'
                            }}
                        >
                            <iframe
                                src={deploymentUrl}
                                className="w-full h-full border-none bg-white"
                                title="Interactive Preview"
                                scrolling="no"
                            />
                        </motion.div>
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
                                    <Globe className="w-10 h-10 text-primary animate-pulse" />
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">
                                Waking Instance...
                            </h3>
                            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
                                Deployment is progressing. Preview will be available as soon as the service is live.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Action Bar (Only shows when content is present) */}
                <AnimatePresence>
                    {(status === 'live') && (
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
            {error && (
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
