import { useEffect } from 'react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, X } from 'lucide-react';

interface DeploymentSuccessPanelProps {
  deploymentUrl: string;
  duration: number;
  serviceName: string;
  onClose: () => void;
}

export function DeploymentSuccessPanel({
  deploymentUrl,
  duration,
  serviceName,
  onClose,
}: DeploymentSuccessPanelProps) {
  const { toast } = useToast();

  useEffect(() => {
    // Trigger confetti celebration
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: Math.random(), y: Math.random() - 0.2 },
        colors: ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'],
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(deploymentUrl);
    toast({
      title: 'Copied!',
      description: 'URL copied to clipboard',
    });
  };

  return (
    <motion.div
      className="deployment-success-panel"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-slate-400 hover:text-white"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      <motion.div
        className="success-icon"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
      >
        🎉
      </motion.div>

      <h2 className="text-3xl font-bold text-white mb-2">Deployment Successful!</h2>
      <p className="text-slate-300 mb-6">
        {serviceName} is now live and ready to use
      </p>

      <div className="deployment-url-box">
        <span className="url-label">Your app is live at:</span>
        <div className="url-display">
          <code className="url-text">{deploymentUrl}</code>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            className="copy-btn"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <a
          href={deploymentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="open-btn"
        >
          <ExternalLink className="h-4 w-4" />
          Open in Browser
        </a>
      </div>

      <div className="deployment-stats">
        <div className="stat">
          <span className="stat-label">Total deployment time:</span>
          <span className="stat-value">{duration}s</span>
        </div>
        <div className="stat">
          <span className="stat-label">Status:</span>
          <span className="stat-value text-green-400">✅ Active</span>
        </div>
      </div>

      <div className="next-steps">
        <h3 className="text-lg font-semibold text-white mb-3">What's next?</h3>
        <ul className="next-steps-list">
          <li>→ Set up CI/CD for automatic deployments</li>
          <li>→ Add custom domain</li>
          <li>→ Configure monitoring alerts</li>
          <li>→ View deployment logs and metrics</li>
        </ul>
      </div>

      <div className="success-actions">
        <Button onClick={onClose} className="primary-btn">
          Close
        </Button>
      </div>
    </motion.div>
  );
}
