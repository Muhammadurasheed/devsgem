/**
 * NeuroLogMatrix - Matrix-style Deep Scan Visualization
 * FAANG-Level UX: Real-time streaming AI analysis with terminal aesthetics
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, Cpu, Zap, Radio, Minimize2, Maximize2,
  FileCode, Layers, Box, Database, Shield, CheckCircle2,
  AlertTriangle, Clock, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface NeuroLogMatrixProps {
  thoughts: string[];
  isLive?: boolean;
  analysisData?: any;
}

interface ParsedThought {
  timestamp: string;
  category: 'SCAN' | 'DETECT' | 'ANALYZE' | 'OPTIMIZE' | 'SECURE' | 'COMPLETE' | 'WARN';
  message: string;
  raw: string;
}

const CATEGORY_CONFIG = {
  SCAN: { icon: Radio, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  DETECT: { icon: FileCode, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ANALYZE: { icon: Cpu, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  OPTIMIZE: { icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  SECURE: { icon: Shield, color: 'text-green-400', bg: 'bg-green-500/10' },
  COMPLETE: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  WARN: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10' },
};

function categorizeThought(thought: string): ParsedThought['category'] {
  const lower = thought.toLowerCase();
  if (lower.includes('scan') || lower.includes('clone') || lower.includes('fetch')) return 'SCAN';
  if (lower.includes('detect') || lower.includes('found') || lower.includes('discover')) return 'DETECT';
  if (lower.includes('analyz') || lower.includes('evaluat') || lower.includes('process')) return 'ANALYZE';
  if (lower.includes('optim') || lower.includes('enhanc') || lower.includes('improv')) return 'OPTIMIZE';
  if (lower.includes('secur') || lower.includes('valid') || lower.includes('check')) return 'SECURE';
  if (lower.includes('complete') || lower.includes('success') || lower.includes('done') || lower.includes('✅')) return 'COMPLETE';
  if (lower.includes('warn') || lower.includes('issue') || lower.includes('error') || lower.includes('⚠')) return 'WARN';
  return 'ANALYZE';
}

function parseThought(raw: string, index: number): ParsedThought {
  // Clean up thought
  let cleaned = raw.trim()
    .replace(/^```(json|tool_outputs)?/g, '')
    .replace(/```$/g, '')
    .replace(/^tool_outputs\s*/g, '')
    .trim();

  // Try to extract from JSON
  try {
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      const parsed = JSON.parse(cleaned);
      const content = parsed.description || parsed.message || parsed.content || parsed.summary || parsed.status;
      if (content) cleaned = content;
      else {
        const firstKey = Object.keys(parsed)[0];
        if (firstKey) {
          const inner = parsed[firstKey];
          cleaned = typeof inner === 'object'
            ? (inner.description || inner.message || `${firstKey} completed`)
            : `${firstKey}: ${inner}`;
        }
      }
    }
  } catch { }

  // Generate timestamp with slight offset for visual effect
  const baseTime = new Date();
  baseTime.setMilliseconds(baseTime.getMilliseconds() + index * 50);

  return {
    timestamp: baseTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    category: categorizeThought(cleaned),
    message: cleaned,
    raw
  };
}

export function NeuroLogMatrix({ thoughts, isLive = false, analysisData }: NeuroLogMatrixProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleLines, setVisibleLines] = useState<number>(0);

  const parsedThoughts = thoughts.map((t, i) => parseThought(t, i));

  // Auto-expand on live scanning
  useEffect(() => {
    if (isLive) {
      setIsExpanded(true);
    }
  }, [isLive]);

  // Progressive reveal effect
  useEffect(() => {
    if (isLive && visibleLines < parsedThoughts.length) {
      const timer = setTimeout(() => {
        setVisibleLines(prev => Math.min(prev + 1, parsedThoughts.length));
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isLive) {
      setVisibleLines(parsedThoughts.length);
    }
  }, [isLive, visibleLines, parsedThoughts.length]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleLines, isExpanded]);

  if (!thoughts || thoughts.length === 0) return null;

  // Collapsed inline view
  if (!isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 w-full"
      >
        <button
          onClick={() => setIsExpanded(true)}
          className="group flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/70 hover:text-cyan-400 transition-all duration-300"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 group-hover:border-cyan-500/40 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all">
            <Terminal className="w-3 h-3" />
            <span>Neuro-Log</span>
            <span className="px-1.5 py-0.5 bg-cyan-500/20 rounded text-[9px] font-mono">
              {parsedThoughts.length}
            </span>
            {isLive && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
              </span>
            )}
          </div>
          <span className="text-[9px] text-gray-500 group-hover:text-gray-400 transition-colors">
            Click to expand neural trace
          </span>
        </button>
      </motion.div>
    );
  }

  // Expanded Matrix View
  const MatrixContent = (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={cn(
        "font-mono text-xs overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0a0f14]/98 backdrop-blur-xl shadow-2xl",
        isFullscreen
          ? "fixed inset-4 z-[100] flex flex-col"
          : "mb-4 w-full max-h-[400px] flex flex-col"
      )}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-cyan-900/20 to-transparent border-b border-cyan-500/20">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/30 border border-red-500/50 hover:bg-red-500/50 cursor-pointer transition-colors"
              onClick={() => setIsExpanded(false)} />
            <div className="w-3 h-3 rounded-full bg-yellow-500/30 border border-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-green-500/30 border border-green-500/50" />
          </div>

          <div className="flex items-center gap-2">
            <Activity className={cn("w-3.5 h-3.5", isLive ? "text-cyan-400 animate-pulse" : "text-gray-500")} />
            <span className="text-cyan-400/80 font-bold text-[10px] uppercase tracking-wider">
              DEVGEM_NEURO_LOG
            </span>
            {isLive && (
              <span className="px-1.5 py-0.5 bg-cyan-500/20 rounded text-[8px] text-cyan-300 animate-pulse">
                LIVE
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="h-6 w-6 text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/10 rounded"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-1">
          {/* Boot Sequence */}
          <div className="text-cyan-500/40 text-[10px] mb-3">
            <span className="text-cyan-500/60">[INIT]</span> Neural processing unit initialized
          </div>

          {parsedThoughts.slice(0, visibleLines).map((thought, i) => {
            const config = CATEGORY_CONFIG[thought.category];
            const Icon = config.icon;

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "flex items-start gap-3 py-1 px-2 -mx-2 rounded-lg transition-colors hover:bg-white/5",
                  thought.category === 'COMPLETE' && "bg-emerald-500/5",
                  thought.category === 'WARN' && "bg-orange-500/5"
                )}
              >
                <span className="text-gray-600 text-[10px] font-mono shrink-0">
                  {thought.timestamp}
                </span>

                <div className={cn("p-1 rounded shrink-0", config.bg)}>
                  <Icon className={cn("w-3 h-3", config.color)} />
                </div>

                <span className={cn("text-[9px] font-bold uppercase w-16 shrink-0", config.color)}>
                  [{thought.category}]
                </span>

                <span className={cn(
                  "text-gray-300 leading-relaxed break-all",
                  thought.category === 'COMPLETE' && "text-emerald-300",
                  thought.category === 'WARN' && "text-orange-300"
                )}>
                  {thought.message}
                </span>
              </motion.div>
            );
          })}

          {/* Cursor */}
          {isLive && (
            <motion.div
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="flex items-center gap-2 mt-2"
            >
              <span className="w-2 h-4 bg-cyan-500" />
              <span className="text-[10px] text-cyan-500/50">Processing neural pathways...</span>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Analysis Summary Footer - Enhanced Wow Moment */}
      {analysisData && !isLive && (
        <div className="border-t border-cyan-500/20 px-4 py-4 bg-gradient-to-r from-cyan-900/10 via-purple-900/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-emerald-400 rounded-full"
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              Deep Scan Complete
            </span>
          </div>

          {/* Primary Analysis Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              <FileCode className="w-4 h-4 text-blue-400" />
              <div>
                <span className="text-[9px] text-gray-500 uppercase block">Framework</span>
                <span className="text-xs text-blue-400 font-bold">
                  {analysisData.analysis?.framework || analysisData.framework || 'Detected'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <Layers className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-[9px] text-gray-500 uppercase block">Language</span>
                <span className="text-xs text-purple-400 font-bold">
                  {analysisData.analysis?.language || analysisData.language || 'Analyzed'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <Box className="w-4 h-4 text-yellow-400" />
              <div>
                <span className="text-[9px] text-gray-500 uppercase block">Dependencies</span>
                <span className="text-xs text-yellow-400 font-bold">
                  {analysisData.analysis?.dependencies_count || analysisData.dependencies?.length || '0'} pkgs
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Shield className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-[9px] text-gray-500 uppercase block">Security</span>
                <span className="text-xs text-emerald-400 font-bold">Scanned ✓</span>
              </div>
            </div>
          </div>

          {/* Additional Detected Info */}
          {(analysisData.analysis?.port || analysisData.port || analysisData.analysis?.entry_point || analysisData.entry_point) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-cyan-500/10">
              {(analysisData.analysis?.port || analysisData.port) && (
                <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
                  Port: {analysisData.analysis?.port || analysisData.port}
                </span>
              )}
              {(analysisData.analysis?.entry_point || analysisData.entry_point) && (
                <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
                  Entry: {analysisData.analysis?.entry_point || analysisData.entry_point}
                </span>
              )}
              {(analysisData.analysis?.build_command || analysisData.build_command) && (
                <span className="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded border border-cyan-500/20">
                  Build: {analysisData.analysis?.build_command || analysisData.build_command}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );

  return (
    <AnimatePresence mode="wait">
      {MatrixContent}
    </AnimatePresence>
  );
}
