import { useState, useRef, useEffect } from "react";
import { Send, Paperclip } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  onSendMessage: (message: string, files?: File[]) => void;
  disabled?: boolean;
}

const ChatInput = ({ onSendMessage, disabled = false }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 96)}px`;
    }
  }, [message]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.name === '.env' || file.name.endsWith('.env') || file.type === '' || file.type === 'text/plain') {
        return true;
      }
      toast({
        title: "Invalid file type",
        description: `${file.name} is not supported. Please upload .env files only.`,
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
    <div className="border-t border-border/50 bg-background/50 p-4">
      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-accent/50 border border-border/50 rounded-lg px-3 py-1.5 text-sm"
            >
              <Paperclip size={14} className="text-muted-foreground" />
              <span className="text-foreground">{file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="ml-1 text-muted-foreground hover:text-foreground"
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".env,text/plain"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors mb-0.5 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Attach .env file"
          title="Upload .env file"
        >
          <Paperclip size={20} />
        </button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to deploy your app..."
            disabled={disabled}
            rows={1}
            className="
              w-full px-4 py-3 pr-12
              bg-accent/30 border border-border/50
              rounded-xl resize-none
              text-sm text-foreground placeholder:text-muted-foreground
              focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all
            "
            style={{ maxHeight: "96px" }}
          />
        </div>

        {/* Send Button - Using onMouseDown for better click handling */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            if (!isButtonDisabled) {
              handleSend();
            }
          }}
          disabled={isButtonDisabled}
          className="
            p-3 rounded-xl flex-shrink-0 pointer-events-auto
            bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]
            text-white font-medium
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            enabled:cursor-pointer
            hover:enabled:scale-105 hover:enabled:shadow-lg
            active:enabled:scale-95
          "
          aria-label="Send message"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default ChatInput;
