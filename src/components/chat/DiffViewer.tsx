import { motion } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FileCode, X, Check, ArrowRight, GitCommit } from "lucide-react";
import { cn } from "@/lib/utils";

interface Change {
    line_start: number;
    line_end: number;
    old_content: string;
    new_content: string;
    reason?: string;
}

interface Fix {
    file_path: string;
    changes: Change[];
}

interface DiffViewerProps {
    fix: Fix;
    onApply: () => void;
    onDismiss: () => void;
}

export const DiffViewer = ({ fix, onApply, onDismiss }: DiffViewerProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-500/20 rounded-lg">
                        <FileCode className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white">{fix.file_path}</span>
                        <span className="text-[10px] text-gray-400">Proposed Changes</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-300 font-mono">
                        {fix.changes.length} change{fix.changes.length !== 1 ? 's' : ''}
                    </div>
                </div>
            </div>

            {/* Changes Content */}
            <div className="max-h-[400px] overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {fix.changes.map((change, idx) => (
                    <div key={idx} className="border-b border-white/5 last:border-0">
                        {change.reason && (
                            <div className="px-4 py-2 bg-white/[0.02] border-b border-white/5 mx-4 mt-4 rounded-t-lg flex items-center gap-2">
                                <GitCommit className="w-3 h-3 text-purple-400" />
                                <span className="text-xs text-gray-400 italic">{change.reason}</span>
                            </div>
                        )}

                        <div className={`grid grid-cols-1 ${change.new_content ? 'md:grid-cols-1' : ''} gap-0`}>
                            {/* Old Content (Red) */}
                            <div className="relative group">
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded font-mono z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    ORIGINAL
                                </div>
                                <SyntaxHighlighter
                                    language="typescript" // Defaulting to TS, but could be dynamic
                                    style={vscDarkPlus}
                                    customStyle={{
                                        margin: 0,
                                        padding: '1rem',
                                        background: 'rgba(239, 68, 68, 0.05)', // Red tint
                                        fontSize: '12px',
                                        lineHeight: '1.5',
                                        borderLeft: '2px solid rgba(239, 68, 68, 0.4)'
                                    }}
                                    wrapLongLines={true}
                                >
                                    {change.old_content}
                                </SyntaxHighlighter>
                            </div>

                            {/* Arrow Divider (Visual only) */}
                            {/* <div className="h-px w-full bg-white/10 flex items-center justify-center relative">
                  <div className="absolute bg-[#0f172a] p-1 rounded-full border border-white/10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <ArrowDown className="w-3 h-3 text-gray-500" />
                  </div>
               </div> */}

                            {/* New Content (Green) */}
                            <div className="relative group">
                                <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded font-mono z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    PROPOSED
                                </div>
                                <SyntaxHighlighter
                                    language="typescript"
                                    style={vscDarkPlus}
                                    customStyle={{
                                        margin: 0,
                                        padding: '1rem',
                                        background: 'rgba(34, 197, 94, 0.05)', // Green tint
                                        fontSize: '12px',
                                        lineHeight: '1.5',
                                        borderLeft: '2px solid rgba(34, 197, 94, 0.4)'
                                    }}
                                    wrapLongLines={true}
                                >
                                    {change.new_content}
                                </SyntaxHighlighter>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-end gap-3">
                <button
                    onClick={onDismiss}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                </button>
                <button
                    onClick={onApply}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
                >
                    <Check className="w-3.5 h-3.5" />
                    Apply Fix
                </button>
            </div>
        </motion.div>
    );
};
