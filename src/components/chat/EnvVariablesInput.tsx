import { useState } from 'react';
import { Upload, Edit3, SkipForward, Rocket } from 'lucide-react';
import { EnvFileUpload, EnvVariable } from './EnvFileUpload';
import { ManualEnvInput } from './ManualEnvInput';
import { motion, AnimatePresence } from 'framer-motion';

// Re-export EnvVariable for use in other components
export type { EnvVariable };

interface EnvVariablesInputProps {
  onEnvSubmit: (envVars: EnvVariable[]) => void;
  onSkip?: () => void;
  sendMessageToBackend?: (type: string, data: any) => void;
}

export function EnvVariablesInput({ onEnvSubmit, onSkip, sendMessageToBackend }: EnvVariablesInputProps) {
  const [inputMethod, setInputMethod] = useState<'upload' | 'manual' | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [varCount, setVarCount] = useState(0);

  const handleEnvSubmit = (envVars: EnvVariable[]) => {
    setVarCount(envVars.length);
    // Mark as submitted to show the "Launch" button
    setIsSubmitted(true);

    // Also call parent callback
    onEnvSubmit(envVars);
  };

  const handleLaunch = () => {
    if (sendMessageToBackend) {
      sendMessageToBackend('message', {
        message: 'deploy',
        intent: 'deploy'
      });
    }
  };

  if (isSubmitted) {
    // ✅ FAANG-LEVEL: Auto-deploy is triggered by backend immediately after env vars upload
    // Show deploying state instead of manual launch button
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-8 space-y-6 text-center"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full"
          />
          <Rocket className="w-8 h-8 text-purple-500 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-2">Deploying to Cloud Run...</h3>
          <p className="text-gray-400 max-w-xs mx-auto">
            {varCount} environment variables synchronized. Deployment in progress.
          </p>
        </div>

        <p className="text-[10px] text-purple-400 uppercase tracking-widest animate-pulse">
          🚀 Mission Control: Launch sequence initiated
        </p>
      </motion.div>
    );
  }

  if (!inputMethod) {
    return (
      <div className="env-input-choice">
        <h3 className="choice-title">Environment Variables</h3>
        <p className="choice-description">
          Does your app need environment variables? How would you like to provide them?
        </p>

        <div className="choice-buttons">
          <button
            onClick={() => setInputMethod('upload')}
            className="choice-btn recommended"
          >
            <Upload size={24} />
            <div className="choice-content">
              <span className="choice-btn-title">Upload .env File</span>
              <span className="choice-btn-subtitle">Easiest • Recommended</span>
            </div>
          </button>

          <button
            onClick={() => setInputMethod('manual')}
            className="choice-btn"
          >
            <Edit3 size={24} />
            <div className="choice-content">
              <span className="choice-btn-title">Enter Manually</span>
              <span className="choice-btn-subtitle">Type key-value pairs</span>
            </div>
          </button>
        </div>

        {onSkip && (
          <button
            onClick={() => {
              // ✅ FAANG UX: Show "Deploying" state immediately on skip to prevent UI flash
              setIsSubmitted(true);

              if (sendMessageToBackend) {
                console.log('[EnvVariablesInput] User clicked SKIP. Sending explicit skip message...');
                sendMessageToBackend('message', {
                  message: 'skip',
                  metadata: { type: 'env_skip' }
                });
              }
              // Don't call onSkip() - keep this component mounted to show the Rocket UI
              // until the global DeploymentProgress takes over via WebSocket events.
            }}
            className="skip-btn"
          >
            <SkipForward size={16} />
            Skip (Not required for my project)
          </button>
        )}
      </div>
    );
  }

  if (inputMethod === 'upload') {
    return (
      <div className="env-input-container">
        <button
          onClick={() => setInputMethod(null)}
          className="back-btn"
        >
          ← Back to options
        </button>
        <EnvFileUpload
          onEnvParsed={handleEnvSubmit}
          onEnvsSentToBackend={() => {
            console.log('[EnvVariablesInput] Env vars sent to backend successfully');
          }}
        />
      </div>
    );
  }

  return (
    <div className="env-input-container">
      <button
        onClick={() => setInputMethod(null)}
        className="back-btn"
      >
        ← Back to options
      </button>
      <ManualEnvInput onEnvSubmit={handleEnvSubmit} />
    </div>
  );
}
