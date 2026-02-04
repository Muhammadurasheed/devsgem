import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TerminalViewProps {
    logs: string[];
    className?: string;
    autoScroll?: boolean;
}

export const TerminalView = ({ logs, className, autoScroll = true }: TerminalViewProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [logs, autoScroll]);

    return (
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
                            <div key={i} className="flex gap-4 group hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
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
    );
};
