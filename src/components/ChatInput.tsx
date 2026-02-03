import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => void;
  onAbort?: () => void;
  disabled?: boolean;
}

const ChatInput = ({ onSendMessage, onAbort, disabled = false }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [message]);

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const newFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) newFiles.push(file);
        }
      }

      if (newFiles.length > 0) {
        setSelectedFiles(prev => [...prev, ...newFiles]);
        toast({
          title: "Image attached",
          description: "Ready to analyze with Gemini Vision",
        });
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [disabled, toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValid =
        file.name === '.env' ||
        file.name.endsWith('.env') ||
        file.type === '' ||
        file.type === 'text/plain' ||
        file.type.startsWith('image/');

      if (isValid) return true;

      toast({
        title: "Invalid file type",
        description: `${file.name} is not supported. Please upload images or .env files.`,
        variant: "destructive",
      });
      return false;
    });

    setSelectedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if ((trimmed || selectedFiles.length > 0) && !disabled) {
      onSendMessage(trimmed, selectedFiles);
      setMessage("");
      setSelectedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isButtonDisabled = (!message.trim() && selectedFiles.length === 0) || disabled;

  return (
    <div className="relative z-10 p-4 md:p-6 bg-transparent">
      <motion.div
        layout
        className={cn(
          "relative mx-auto max-w-4xl transition-all duration-300",
          "rounded-[28px] border bg-background/60 backdrop-blur-2xl shadow-2xl",
          isFocused ? "border-primary/50 ring-4 ring-primary/10" : "border-white/10"
        )}
      >
        {/* Attachment Preview */}
        <AnimatePresence>
          {selectedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: 10, height: 0 }}
              className="px-4 pt-4 flex flex-wrap gap-2"
            >
              {selectedFiles.map((file, index) => (
                <motion.div
                  key={`${file.name}-${index}`}
                  layout
                  className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm group transition-colors hover:bg-white/10"
                >
                  <Paperclip size={14} className="text-primary/70" />
                  <span className="text-foreground/80 max-w-[150px] truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 p-2">
          {/* File Upload Trigger */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".env,text/plain,image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-3 mb-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-2xl transition-all disabled:opacity-30 flex-shrink-0"
            title="Attach .env or Images"
          >
            <Paperclip size={22} strokeWidth={1.5} />
          </button>

          {/* Core Input */}
          <div className="flex-1 min-h-[52px] flex items-center">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Deploy my next big idea..."
              disabled={disabled}
              rows={1}
              className="
                w-full px-2 py-3
                bg-transparent border-none
                text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/50
                focus:ring-0 focus:outline-none resize-none
                disabled:opacity-50
                custom-scrollbar
              "
              style={{ maxHeight: "180px" }}
            />
          </div>

          <AnimatePresence mode="wait">
            {disabled && onAbort ? (
              <motion.button
                key="abort-button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onClick={onAbort}
                className="
                  p-3 mb-1 rounded-2xl flex-shrink-0
                  bg-destructive/10 text-destructive border border-destructive/20
                  hover:bg-destructive hover:text-white transition-all duration-300
                "
                title="Stop Deployment"
              >
                <Square size={20} fill="currentColor" />
              </motion.button>
            ) : (
              <motion.button
                key="send-button"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!isButtonDisabled) handleSend();
                }}
                disabled={isButtonDisabled}
                className={cn(
                  "p-3 mb-1 rounded-2xl flex-shrink-0 shadow-lg transition-all duration-300",
                  isButtonDisabled
                    ? "bg-white/5 text-muted-foreground cursor-not-allowed"
                    : "bg-primary text-primary-foreground hover:shadow-primary/20 hover:shadow-xl"
                )}
              >
                <Send size={20} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default ChatInput;
