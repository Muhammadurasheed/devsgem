import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EnvVariable } from './EnvFileUpload';

interface ManualEnvInputProps {
  onEnvSubmit: (envVars: EnvVariable[]) => void;
}

export function ManualEnvInput({ onEnvSubmit }: ManualEnvInputProps) {
  const [envVars, setEnvVars] = useState<EnvVariable[]>([
    { key: '', value: '', isSecret: false }
  ]);

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '', isSecret: false }]);
  };

  const updateEnvVar = (index: number, field: keyof EnvVariable, value: any) => {
    const updated = [...envVars];
    updated[index] = { ...updated[index], [field]: value };
    setEnvVars(updated);
  };

  const removeEnvVar = (index: number) => {
    if (envVars.length > 1) {
      setEnvVars(envVars.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = () => {
    const valid = envVars.filter(e => e.key.trim() && e.value.trim());
    if (valid.length === 0) {
      alert('Please add at least one environment variable');
      return;
    }
    onEnvSubmit(valid);
  };

  const validCount = envVars.filter(e => e.key.trim() && e.value.trim()).length;

  return (
    <div className="manual-env-input">
      <h4 className="manual-title">Add Environment Variables</h4>
      
      <div className="env-input-list">
        {envVars.map((env, index) => (
          <div key={index} className="env-input-row">
            <input
              type="text"
              placeholder="KEY"
              value={env.key}
              onChange={(e) => updateEnvVar(index, 'key', e.target.value.toUpperCase())}
              className="env-key-input"
            />
            <input
              type={env.isSecret ? 'password' : 'text'}
              placeholder="value"
              value={env.value}
              onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
              className="env-value-input"
            />
            <label className="env-secret-checkbox">
              <input
                type="checkbox"
                checked={env.isSecret}
                onChange={(e) => updateEnvVar(index, 'isSecret', e.target.checked)}
              />
              <span>Secret</span>
            </label>
            <button 
              onClick={() => removeEnvVar(index)}
              className="remove-env-btn"
              disabled={envVars.length === 1}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      
      <button onClick={addEnvVar} className="add-env-btn">
        <Plus size={16} />
        Add Variable
      </button>
      
      <button 
        onClick={handleSubmit} 
        className="submit-env-btn primary-btn"
        disabled={validCount === 0}
      >
        Continue with {validCount} Variable{validCount !== 1 ? 's' : ''}
      </button>
    </div>
  );
}
