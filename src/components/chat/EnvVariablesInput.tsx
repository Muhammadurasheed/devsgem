import { useState } from 'react';
import { Upload, Edit3, SkipForward, Rocket, CheckCircle } from 'lucide-react';
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
    console.log('[EnvVariablesInput] Submitting env vars to backend:', envVars.length);
    setVarCount(envVars.length);

    // Send to backend via WebSocket
    if (sendMessageToBackend) {
      sendMessageToBackend('env_vars_uploaded', {
        variables: envVars.map(env => ({
          key: env.key,
          value: env.value,
          isSecret: env.isSecret
        })),
        count: envVars.length
      });
    }

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
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-8 space-y-6 text-center"
      >
        <div className="relative">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute inset-0 bg-green-500/20 rounded-full"
          />
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-2">Configuration Ready!</h3>
          <p className="text-gray-400 max-w-xs mx-auto">
            {varCount} environment variables have been securely synchronized. You're ready for takeoff.
          </p>
        </div>

        <button
          onClick={handleLaunch}
          className="group relative flex items-center justify-center gap-3 w-full max-w-sm py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-xl shadow-purple-500/20 transition-all duration-300 transform hover:-translate-y-1 active:scale-[0.98]"
        >
          <Rocket className="w-6 h-6 group-hover:animate-bounce" />
          <span className="text-lg tracking-wide uppercase">🚀 Launch Deployment</span>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
        </button>

        <p className="text-[10px] text-gray-500 uppercase tracking-widest animate-pulse">
          Standing by for Mission Control ignition
        </p>
      </motion.div>
    );
  }

  if (!inputMethod) {
    return (
      <div className="env-input-choice">
        <h3 className="choice-title">Environment Variables</h3>
        <p className="choice-description">
          Your app needs environment variables. How would you like to provide them?
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
            onClick={onSkip}
            className="skip-btn"
          >
            <SkipForward size={16} />
            Skip (I'll add them later)
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
