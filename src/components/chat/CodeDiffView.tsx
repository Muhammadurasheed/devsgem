import { motion, AnimatePresence } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FileCode, GitCommit, ChevronDown, ChevronRight, Check } from "lucide-react";
import { useState } from "react";

interface Change {
    line_start: number;
    line_end: number;
    old_content: string;
    new_content: string;
    reason?: string;
    file?: string;
}

interface CodeDiffViewProps {
    changes: Change[];
}

export const CodeDiffView = ({ changes }: CodeDiffViewProps) => {
    const [isOpen, setIsOpen] = useState(true);

    if (!changes || changes.length === 0) return null;

    return (
        <div className="w-full max-w-2xl mt-4 mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#0f172a]/95 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-500/20 rounded-lg">
                        <FileCode className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-sm font-semibold text-white">Code Changes Applied</span>
                    <div className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300 font-mono">
                        {changes.length} file{changes.length !== 1 ? 's' : ''}
                    </div>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 text-xs font-mono border-l-2 border-purple-500/30 pl-4 space-y-4">
                            {changes.map((change, idx) => (
                                <div key={idx} className="bg-black/30 rounded-lg border border-white/5 overflow-hidden">
                                    <div className="px-3 py-2 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-purple-300 font-bold">{change.file}</span>
                                            <span className="text-gray-500">L{change.line_start}-{change.line_end}</span>
                                        </div>
                                        {change.reason && <span className="text-gray-400 italic">{change.reason}</span>}
                                    </div>

                                    <div className="grid grid-cols-1 gap-px bg-white/5">
                                        {/* Split view or Unified? Unified is easier for now */}
                                        {change.old_content && (
                                            <div className="relative group bg-[#1e1e1e]">
                                                <div className="absolute top-1 right-2 text-[9px] text-red-400 font-bold opacity-50">BEFORE</div>
                                                <SyntaxHighlighter
                                                    language="typescript"
                                                    style={vscDarkPlus}
                                                    customStyle={{ margin: 0, padding: '0.75rem', fontSize: '11px', background: 'transparent', opacity: 0.7 }}
                                                    wrapLongLines={true}
                                                >
                                                    {change.old_content}
                                                </SyntaxHighlighter>
                                            </div>
                                        )}
                                        <div className="relative group bg-[#1e1e1e]">
                                            <div className="absolute top-1 right-2 text-[9px] text-green-400 font-bold opacity-50">AFTER</div>
                                            <SyntaxHighlighter
                                                language="typescript"
                                                style={vscDarkPlus}
                                                customStyle={{ margin: 0, padding: '0.75rem', fontSize: '11px', background: 'rgba(34, 197, 94, 0.05)' }}
                                                wrapLongLines={true}
                                            >
                                                {change.new_content}
                                            </SyntaxHighlighter>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
