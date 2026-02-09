import React, { useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TerminalViewProps {
    logs: string[];
    className?: string;
    autoScroll?: boolean;
    centerOnLoad?: boolean;
}

export const TerminalView = ({ logs, className, autoScroll = true, centerOnLoad = false }: TerminalViewProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [hasCentered, setHasCentered] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!scrollRef.current) return;
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (!scrollContainer) return;

        // [FAANG] Wow Factor: Center on initial load
        if (centerOnLoad && !hasCentered && logs.length > 0) {
            const viewport = scrollContainer as HTMLElement;
            viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) / 2;
            setHasCentered(true);
            return;
        }

        // Standard auto-scroll to bottom
        if (autoScroll && !centerOnLoad) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }, [logs, autoScroll, centerOnLoad, hasCentered]);

    // [FAANG] Copy logs to clipboard with toast feedback
    const handleCopyLogs = async () => {
        try {
            await navigator.clipboard.writeText(logs.join('\n'));
            setCopied(true);
            toast.success('Logs copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy logs');
        }
    };

    return (
        <div className="relative group">
            {/* [FAANG] Hover-reveal copy button */}
            {logs.length > 0 && (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyLogs}
                    className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800/80 hover:bg-zinc-700 border border-white/10"
                    title="Copy logs to clipboard"
                >
                    {copied ? (
                        <Check className="w-4 h-4 text-green-400" />
                    ) : (
                        <Copy className="w-4 h-4 text-zinc-300" />
                    )}
                </Button>
            )}

            <ScrollArea
                ref={scrollRef}
                className={cn(
                    "bg-[#0D1117] border border-white/10 rounded-lg overflow-hidden font-mono text-[13px] leading-relaxed shadow-2xl",
                    className
                )}
            >
                <div className="p-4 space-y-1">
                    {logs.length > 0 ? (
                        logs.map((log, i) => {
                            const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('fail') || log.includes('ERR!');
                            const isWarn = log.toLowerCase().includes('warn');
                            const isInfo = log.includes('INFO') || log.includes('Step');

                            return (
                                <div key={i} className="flex gap-4 group/line hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
                                    <span className="text-white/20 select-none w-8 text-right flex-shrink-0">{i + 1}</span>
                                    <span className={cn(
                                        "break-all whitespace-pre-wrap flex-1",
                                        isError ? "text-red-400" :
                                            isWarn ? "text-yellow-400" :
                                                isInfo ? "text-blue-400" :
                                                    "text-gray-300"
                                    )}>
                                        {log}
                                    </span>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-white/20">
                            <div className="animate-pulse mb-2">_</div>
                            <p className="text-xs uppercase tracking-widest">Awaiting log stream...</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
