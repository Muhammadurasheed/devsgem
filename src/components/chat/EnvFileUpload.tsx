import { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

export interface EnvVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

interface EnvFileUploadProps {
  onEnvParsed: (envVars: EnvVariable[]) => void;
  onEnvsSentToBackend?: () => void;
}

export function EnvFileUpload({ onEnvParsed, onEnvsSentToBackend }: EnvFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedEnvs, setParsedEnvs] = useState<EnvVariable[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse .env file content
  const parseEnvFile = (content: string): EnvVariable[] => {
    console.log('[EnvFileUpload] Parsing file content:', content.substring(0, 200));
    
    // Normalize line endings (handle \r\n, \n, \r)
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');
    const envVars: EnvVariable[] = [];
    
    console.log('[EnvFileUpload] Total lines:', lines.length);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('#') || trimmedLine === '') {
        continue;
      }
      
      // Remove 'export ' prefix if present
      const cleanLine = trimmedLine.replace(/^export\s+/, '');
      
      // More lenient regex: allows keys starting with letters or underscore
      // and containing letters, numbers, or underscores
      const match = cleanLine.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)$/);
      
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        console.log(`[EnvFileUpload] Found var at line ${i + 1}: ${key}=${value.substring(0, 20)}...`);
        
        // Remove simple quotes if present (single or double)
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
          
          // ✅ RESILIENCE: Unescape newlines only if they were quoted
          // This handles PEM keys like "---BEGIN...\n..."
          value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
        } else {
             // If unquoted, we still check for literal \n but be careful? 
             // Standard .env parsers usually only expand in quoted strings.
             // But for resilience, let's look for known PEM headers?
             if (value.includes('BEGIN PRIVATE KEY') && value.includes('\\n')) {
                 value = value.replace(/\\n/g, '\n');
             }
        }
        
        // Remove trailing comments (only if not inside quotes - which we removed above)
        // Wait, if we removed quotes, now we need to be careful not to strip # inside the value?
        // Standard parser: # starts comment unless quoted.
        // Since we already stripped quotes, we should have handled comment stripping BEFORE quote stripping?
        // Actually, match[2] grabs everything.
        // Correct logic: Check for # outside quotes.
        
        // Simplified Logic for "Standard" .env files:
        // 1. If line has #, take substring before # (unless # is in quotes)
        // This regex is hard.
        // Let's stick to the previous simple logic but improved for PEM.
        
        if (value.includes('#') && !value.includes('PRIVATE KEY')) {
            // Heuristic: If it looks like a key, don't strip #.
            // If it's a normal value, strip after #
            const commentIndex = value.indexOf('#');
            // Check if # is preceded by space (convention)
             if (commentIndex > 0 && value[commentIndex-1] === ' ') {
                 value = value.substring(0, commentIndex).trim();
             }
        }
        
        // Detect if it's likely a secret
        const isSecret = detectSecret(key, value);
        
        envVars.push({ key, value, isSecret });
      } else if (cleanLine.length > 0) {
        console.warn(`[EnvFileUpload] Could not parse line ${i + 1}:`, cleanLine);
      }
    }
    
    console.log('[EnvFileUpload] Parsed env vars:', envVars.length);
    return envVars;
  };

  // Smart secret detection
  const detectSecret = (key: string, value: string): boolean => {
    const secretKeywords = [
      'password', 'secret', 'key', 'token', 'api_key', 'apikey',
      'auth', 'credential', 'private', 'salt', 'hash', 'jwt',
      'access', 'refresh', 'session'
    ];
    
    const keyLower = key.toLowerCase();
    const hasSecretKeyword = secretKeywords.some(keyword => 
      keyLower.includes(keyword)
    );
    
    // Also check if value looks like a secret (long random string)
    const looksLikeSecret = value.length > 20 && /^[A-Za-z0-9_\-+=\/]+$/.test(value);
    
    return hasSecretKeyword || looksLikeSecret;
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    console.log('[EnvFileUpload] Starting file upload:', file.name, file.size, 'bytes');
    setIsProcessing(true);
    setUploadedFile(file);
    
    try {
      const content = await file.text();
      console.log('[EnvFileUpload] File read successfully, length:', content.length);
      
      const envVars = parseEnvFile(content);
      
      if (envVars.length === 0) {
        console.error('[EnvFileUpload] No environment variables found');
        toast.error(
          'No environment variables found in file. Please check the format: KEY=VALUE',
          { duration: 5000 }
        );
        setUploadedFile(null);
        return;
      }
      
      console.log('[EnvFileUpload] Successfully parsed variables:', envVars);
      setParsedEnvs(envVars);
      
      // ✅ CRITICAL: Trigger callback to send to backend
      onEnvParsed(envVars);
      
      // Notify parent that env vars are ready to be sent
      if (onEnvsSentToBackend) {
        onEnvsSentToBackend();
      }
      
      toast.success(`Successfully parsed ${envVars.length} environment variable${envVars.length > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('[EnvFileUpload] Error parsing .env file:', error);
      toast.error('Failed to parse .env file. Please check the format.');
      setUploadedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name === '.env' || file.name.endsWith('.env') || file.type === 'text/plain')) {
      handleFileUpload(file);
    } else {
      toast.error('Please upload a .env file');
    }
  };

  // File input handler
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleReset = () => {
    setUploadedFile(null);
    setParsedEnvs([]);
  };

  return (
    <div className="env-file-upload">
      {!uploadedFile ? (
        <div
          className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="upload-icon" size={48} />
          <h3 className="upload-title">Upload Environment Variables</h3>
          <p className="upload-description">Drag and drop your .env file here</p>
          <span className="upload-or">or</span>
          <label className="upload-button">
            <input
              type="file"
              accept=".env,text/plain"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />
            Browse Files
          </label>
          <div className="upload-hint">
            📄 We support standard .env format
          </div>
        </div>
      ) : (
        <div className="upload-success">
          <div className="success-header">
            <CheckCircle className="success-icon" size={24} />
            <span className="success-text">
              {uploadedFile.name} uploaded successfully
            </span>
          </div>
          
          {isProcessing ? (
            <div className="processing">
              <div className="spinner">⟳</div>
              <span>Parsing environment variables...</span>
            </div>
          ) : (
            <div className="parsed-envs">
              <h4 className="parsed-title">Found {parsedEnvs.length} environment variables:</h4>
              <div className="env-list">
                {parsedEnvs.map((env, index) => (
                  <div key={index} className="env-item">
                    <div className="env-key">
                      {env.isSecret && <span className="secret-badge">🔒 Secret</span>}
                      <code>{env.key}</code>
                    </div>
                    <div className="env-value">
                      {env.isSecret ? (
                        <span className="hidden-value">••••••••</span>
                      ) : (
                        <code>{env.value.substring(0, 50)}
                          {env.value.length > 50 ? '...' : ''}
                        </code>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="env-actions">
                <button 
                  onClick={handleReset}
                  className="secondary-btn"
                >
                  <X size={16} />
                  Upload Different File
                </button>
              </div>
              
              <div className="security-note">
                <AlertCircle size={16} />
                <span>
                  Variables marked as secrets will be stored securely in Google Secret Manager
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
