import React, { useEffect, useRef, useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Copy, Check, ChevronDown, Terminal as TerminalIcon } from 'lucide-react';
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
    const [isAtBottom, setIsAtBottom] = useState(true);

    // [FAANG] Noise Suppression (Client-Side Safety Net)
    const filteredLogs = useMemo(() => {
        const noisePatterns = ['git: ', 'bash: ', 'executor:latest: ', 'STATUS_UNKNOWN'];
        return logs.filter(log => !noisePatterns.some(pattern => log.includes(pattern)));
    }, [logs]);

    const scrollToBottom = () => {
        if (!scrollRef.current) return;
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollContainer) {
            scrollContainer.scrollTo({
                top: scrollContainer.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    useEffect(() => {
        if (!scrollRef.current) return;
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (!scrollContainer) return;

        // [FAANG] Smart Positioning: Center on "real" content or middle
        if (centerOnLoad && !hasCentered && filteredLogs.length > 0) {
            const viewport = scrollContainer as HTMLElement;
            // Target the middle-ish for big logs to avoid the "bash unknowns" at start
            viewport.scrollTop = (viewport.scrollHeight - viewport.clientHeight) * 0.45;
            setHasCentered(true);
            return;
        }

        // Standard auto-scroll logic
        if (autoScroll && isAtBottom && !centerOnLoad) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
    }, [filteredLogs, autoScroll, centerOnLoad, hasCentered, isAtBottom]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isBottom = scrollHeight - scrollTop - clientHeight < 20;
        setIsAtBottom(isBottom);
    };

    const handleCopyLogs = async () => {
        try {
            await navigator.clipboard.writeText(filteredLogs.join('\n'));
            setCopied(true);
            toast.success('Logs copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Failed to copy logs');
        }
    };

    return (
        <div className="relative group flex flex-col h-full bg-[#0D1117]/90 rounded-lg border border-white/10 shadow-2xl overflow-hidden">
            {/* [FAANG] Terminal Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/50" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                        <div className="w-3 h-3 rounded-full bg-green-500/50" />
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/30 ml-4 flex items-center gap-2">
                        <TerminalIcon size={10} className="text-white/20" /> build_logs.sh
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {filteredLogs.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleCopyLogs}
                            className="h-7 px-2 text-[10px] uppercase font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                        >
                            {copied ? (
                                <><Check className="w-3 h-3 mr-1 text-green-400" /> Copied</>
                            ) : (
                                <><Copy className="w-3 h-3 mr-1" /> Copy Content</>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            <ScrollArea
                ref={scrollRef}
                onScroll={handleScroll as any}
                className={cn(
                    "flex-1 font-mono text-[13px] leading-relaxed",
                    className
                )}
            >
                <div className="p-4 space-y-0.5 min-h-full">
                    {filteredLogs.length > 0 ? (
                        filteredLogs.map((log, i) => {
                            const isError = log.toLowerCase().includes('error') || log.toLowerCase().includes('fail') || log.includes('ERR!');
                            const isWarn = log.toLowerCase().includes('warn');
                            const isInfo = log.includes('INFO') || log.includes('Step') || log.includes('Successfully');

                            return (
                                <div key={i} className="flex gap-4 group/line hover:bg-white/5 px-2 -mx-2 rounded transition-colors py-0.5">
                                    <span className="text-white/10 select-none w-10 text-right flex-shrink-0 font-light italic tabular-nums">
                                        {i + 1}
                                    </span>
                                    <span className={cn(
                                        "break-all whitespace-pre-wrap flex-1",
                                        isError ? "text-red-400 font-medium" :
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
                        <div className="flex flex-col items-center justify-center py-32 text-white/20">
                            <div className="animate-pulse mb-3 opacity-20">_</div>
                            <p className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30">Awaiting Log Stream</p>
                            <div className="mt-4 w-32 h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* [FAANG] Scroll-to-bottom pulse button */}
            {!isAtBottom && filteredLogs.length > 5 && (
                <button
                    onClick={scrollToBottom}
                    className="absolute bottom-6 right-6 p-2 rounded-full bg-primary/20 hover:bg-primary/40 border border-primary/30 text-primary-foreground backdrop-blur-md transition-all animate-bounce shadow-lg shadow-black/50"
                >
                    <ChevronDown size={18} />
                </button>
            )}

            {/* [FAANG] Viewport Decoration */}
            <div className="absolute right-0 top-10 bottom-0 w-1 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        </div>
    );
};

