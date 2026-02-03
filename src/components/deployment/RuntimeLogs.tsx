import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Filter, Search, Download, Trash2, Clock, ShieldAlert, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RuntimeLogsProps {
    deploymentId: string;
    serviceName?: string;
    className?: string;
}

export const RuntimeLogs = ({ deploymentId, serviceName, className }: RuntimeLogsProps) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [filter, setFilter] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const pollInterval = useRef<any>(null);

    const fetchLogs = async () => {
        try {
            const response = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/runtime-logs?limit=100`);
            if (response.ok) {
                const data = await response.json();
                setLogs(data.logs || []);
            }
        } catch (error) {
            console.error('Failed to fetch runtime logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        pollInterval.current = setInterval(fetchLogs, 5000); // Poll every 5 seconds
        return () => {
            if (pollInterval.current) clearInterval(pollInterval.current);
        };
    }, [deploymentId]);

    useEffect(() => {
        if (isAutoScroll && scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }, [logs, isAutoScroll]);

    const filteredLogs = logs.filter(log =>
        log.toLowerCase().includes(filter.toLowerCase())
    );

    const getLogColor = (log: string) => {
        const l = log.toUpperCase();
        if (l.includes('[ERROR]') || l.includes('[CRITICAL]') || l.includes('[FATAL]')) return 'text-red-400';
        if (l.includes('[WARNING]') || l.includes('[WARN]')) return 'text-yellow-400';
        if (l.includes('[INFO]')) return 'text-blue-400';
        if (l.includes('[DEBUG]')) return 'text-gray-500';
        return 'text-foreground/80';
    };

    return (
        <div className={cn("flex flex-col h-full bg-[#0a0f14] rounded-xl border border-white/5 overflow-hidden shadow-2xl", className)}>
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-white/5">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="h-4 w-px bg-white/10 mx-1" />
                    <Terminal className="w-4 h-4 text-primary" />
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
                        Runtime Console {serviceName && `─ ${serviceName}`}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5 border-primary/20 bg-primary/5 text-primary animate-pulse">
                        LIVE
                    </Badge>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative group">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            placeholder="Filter logs..."
                            className="h-8 w-48 pl-8 text-xs bg-black/40 border-white/10 focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all font-mono"
                        />
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-white/10 text-muted-foreground"
                        onClick={() => fetchLogs()}
                        disabled={isLoading}
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8 hover:bg-white/10", isAutoScroll ? "text-primary" : "text-muted-foreground")}
                        onClick={() => setIsAutoScroll(!isAutoScroll)}
                        title="Toggle Auto-scroll"
                    >
                        <Activity className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Log Stream */}
            <ScrollArea ref={scrollRef} className="flex-1 font-mono text-xs p-4">
                {isLoading && logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                        <span className="animate-pulse">Connecting to Cloud Run trace engine...</span>
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                        <Search className="w-8 h-8 opacity-20" />
                        <span className="text-muted-foreground/60">{filter ? 'No logs matching filter' : 'Waiting for runtime process output...'}</span>
                    </div>
                ) : (
                    <div className="space-y-1.5 pb-4">
                        {filteredLogs.map((log, i) => (
                            <div key={i} className="flex gap-3 group">
                                <span className="text-white/20 select-none w-8 text-right shrink-0">{i + 1}</span>
                                <span className={cn("break-all leading-relaxed transition-colors", getLogColor(log))}>
                                    {log}
                                </span>
                            </div>
                        ))}
                        {isAutoScroll && (
                            <div className="flex items-center gap-2 pt-2 text-[10px] text-primary/40 italic">
                                <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                                Listening for new output...
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>

            {/* Footer Info */}
            <div className="px-4 py-2 bg-black/40 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60">
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Retention: 15m
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Activity className="w-3 h-3" />
                        SDK: Native/V2
                    </span>
                </div>
                <div className="text-[10px] font-mono text-primary/60">
                    DevGem_Audit_Stream@1.0.0
                </div>
            </div>
        </div>
    );
};

const Loader2 = ({ className }: { className?: string }) => (
    <svg className={cn("animate-spin", className)} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
);
