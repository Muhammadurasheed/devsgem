import { useState, useEffect } from 'react';
import { Key, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('servergemApiKey');
    if (savedKey) {
      setApiKey(savedKey);
      setIsSaved(true);
    }
  }, []);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error('Please enter a valid API key');
      return;
    }

    localStorage.setItem('servergemApiKey', apiKey.trim());
    setIsSaved(true);
    toast.success('API key saved successfully!');
    
    // Reload to reconnect WebSocket with new key
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  const handleRemove = () => {
    localStorage.removeItem('servergemApiKey');
    setApiKey('');
    setIsSaved(false);
    toast.info('API key removed');
  };

  return (
    <div className="space-y-4 p-6 bg-card/50 rounded-lg border border-border">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
          <Key className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">Gemini API Key</h3>
          <p className="text-sm text-muted-foreground">
            Add your personal Gemini API key to continue using ServerGem AI features
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setIsSaved(false);
            }}
            placeholder="Enter your Gemini API key (AIza...)"
            className="pr-10"
          />
          {isSaved && (
            <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1" disabled={!apiKey.trim() || isSaved}>
            {isSaved ? 'Saved ✓' : 'Save API Key'}
          </Button>
          {isSaved && (
            <Button onClick={handleRemove} variant="outline">
              Remove
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 bg-muted/50 rounded-lg border border-border space-y-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm space-y-2">
            <p className="font-medium">How to get your API key:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground ml-2">
              <li>Visit Google AI Studio</li>
              <li>Sign in with your Google account</li>
              <li>Click "Get API Key"</li>
              <li>Copy and paste it above</li>
            </ol>
            <a
              href="https://ai.google.dev/aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline mt-2"
            >
              Get Free API Key
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            💡 <strong>Free Tier:</strong> 60 requests per minute • Stored locally in your browser • Never shared
          </p>
        </div>
      </div>
    </div>
  );
}
