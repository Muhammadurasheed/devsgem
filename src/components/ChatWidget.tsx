import { useState, useEffect } from "react";
import { MessageCircle, X, Sparkles } from "lucide-react";
import ChatWindow from "./ChatWindow";

interface ChatWidgetProps {
  isOpen: boolean;
  onToggle: () => void;
  initialMessage?: string;
  unreadCount?: number;
}

const ChatWidget = ({ isOpen, onToggle, initialMessage, unreadCount = 0 }: ChatWidgetProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);

  // Show welcome bubble after 5 seconds (first-time user experience)
  useEffect(() => {
    if (!isOpen && !bubbleDismissed) {
      const timer = setTimeout(() => {
        setShowBubble(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, bubbleDismissed]);

  const handleBubbleClick = () => {
    setShowBubble(false);
    onToggle();
  };

  const handleBubbleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBubble(false);
    setBubbleDismissed(true);
  };

  return (
    <>
      {/* Chat Window */}
      {isOpen && <ChatWindow onClose={onToggle} initialMessage={initialMessage} />}

      {/* Welcome Bubble (First-time User) */}
      {showBubble && !isOpen && (
        <div
          onClick={handleBubbleClick}
          className="fixed bottom-24 right-5 z-40 max-w-[280px] bg-background/95 backdrop-blur-xl border border-[rgba(139,92,246,0.3)] rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 cursor-pointer hover:scale-105 transition-transform"
        >
          <button
            onClick={handleBubbleDismiss}
            className="absolute -top-2 -right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center hover:bg-accent/80 transition-colors"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#06b6d4] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">👋 Need help deploying?</p>
              <p className="text-xs text-muted-foreground">I'm here to assist!</p>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <div className="fixed bottom-5 right-5 z-30">
        <button
          onClick={onToggle}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`
            relative
            w-[60px] h-[60px] rounded-full
            bg-gradient-to-br from-[#3b82f6] to-[#8b5cf6]
            text-white shadow-[0_0_40px_rgba(139,92,246,0.5)]
            flex items-center justify-center
            transition-all duration-300
            hover:scale-105 hover:shadow-[0_0_50px_rgba(139,92,246,0.7)]
            ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}
            ${!isOpen && 'animate-pulse'}
          `}
          style={{
            animationDuration: '3s',
            animationIterationCount: 'infinite',
          }}
          aria-label="Toggle chat"
        >
          <MessageCircle size={28} />

          {/* Notification Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-xs font-bold animate-in zoom-in">
              {unreadCount}
            </span>
          )}
        </button>

        {/* Tooltip */}
        {showTooltip && !isOpen && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-background/95 backdrop-blur-xl border border-[rgba(139,92,246,0.3)] rounded-lg whitespace-nowrap text-sm animate-in fade-in slide-in-from-bottom-1 duration-150">
            Chat with
          </div>
        )}
      </div>
    </>
  );
};

export default ChatWidget;
