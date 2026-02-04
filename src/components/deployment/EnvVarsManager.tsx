

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus,
    Trash2,
    Eye,
    EyeOff,
    Save,
    Loader2,
    AlertTriangle,
    CheckCircle,
    Key,
    Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EnvVar {
    key: string;
    value: string;
    isSecret?: boolean;
    isNew?: boolean;
}

interface EnvVarsManagerProps {
    deploymentId: string;
    initialVars?: EnvVar[];
    onSave?: (vars: EnvVar[]) => Promise<void>;
    className?: string;
}

export const EnvVarsManager: React.FC<EnvVarsManagerProps> = ({
    deploymentId,
    initialVars = [],
    onSave,
    className
}) => {
    const [envVars, setEnvVars] = useState<EnvVar[]>(initialVars);
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [editingKey, setEditingKey] = useState<string | null>(null);

    // Common secret patterns for auto-detection
    const secretPatterns = ['password', 'secret', 'key', 'token', 'api', 'auth', 'credential'];

    const isSecretKey = (key: string): boolean => {
        const lowerKey = key.toLowerCase();
        return secretPatterns.some(pattern => lowerKey.includes(pattern));
    };

    const toggleVisibility = (key: string) => {
        setVisibleKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const handleAddVar = () => {
        const newVar: EnvVar = {
            key: '',
            value: '',
            isNew: true
        };
        setEnvVars([...envVars, newVar]);
        setEditingKey('__new__' + Date.now());
    };

    const handleUpdateVar = (index: number, field: 'key' | 'value', newValue: string) => {
        const updated = [...envVars];
        updated[index] = {
            ...updated[index],
            [field]: newValue,
            isSecret: field === 'key' ? isSecretKey(newValue) : updated[index].isSecret
        };
        setEnvVars(updated);
    };

    const handleDeleteVar = (index: number) => {
        setEnvVars(envVars.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!onSave) return;

        setIsSaving(true);
        setSaveSuccess(false);

        try {
            // Filter out empty entries
            const validVars = envVars.filter(v => v.key.trim() !== '');
            await onSave(validVars);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        } catch (error) {
            console.error('Failed to save env vars:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const getMaskedValue = (value: string): string => {
        if (value.length <= 4) return '••••••••';
        return value.slice(0, 2) + '••••••••' + value.slice(-2);
    };

    return (
        <div className={cn("space-y-4", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Settings className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">Environment Variables</h3>
                        <p className="text-xs text-muted-foreground">
                            Securely manage your deployment secrets
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddVar}
                        className="text-sm"
                    >
                        <Plus className="w-4 h-4 mr-1" />
                        Add Variable
                    </Button>

                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving}
                        className={cn(
                            "min-w-[100px]",
                            saveSuccess && "bg-green-600 hover:bg-green-700"
                        )}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                Saving...
                            </>
                        ) : saveSuccess ? (
                            <>
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Saved!
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4 mr-1" />
                                Save
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {/* Variables List */}
            <div className="rounded-xl border border-border bg-card/50 backdrop-blur overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-3 bg-secondary/30 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <div>Key</div>
                    <div>Value</div>
                    <div className="w-20">Actions</div>
                </div>

                {/* Table Body */}
                <AnimatePresence mode="popLayout">
                    {envVars.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="p-8 text-center text-muted-foreground"
                        >
                            <Key className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No environment variables configured</p>
                            <p className="text-xs mt-1">Click "Add Variable" to get started</p>
                        </motion.div>
                    ) : (
                        envVars.map((envVar, index) => (
                            <motion.div
                                key={envVar.key || `new-${index}`}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className={cn(
                                    "grid grid-cols-[1fr_1fr_auto] gap-4 px-4 py-3 border-b border-border last:border-0 items-center group",
                                    "hover:bg-secondary/20 transition-colors"
                                )}
                            >
                                {/* Key Input */}
                                <div className="relative">
                                    <Input
                                        value={envVar.key}
                                        onChange={(e) => handleUpdateVar(index, 'key', e.target.value)}
                                        placeholder="VARIABLE_NAME"
                                        className={cn(
                                            "font-mono text-sm h-9 bg-secondary/30",
                                            envVar.isSecret && "border-amber-500/50"
                                        )}
                                    />
                                    {envVar.isSecret && (
                                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" title="Secret detected" />
                                        </span>
                                    )}
                                </div>

                                {/* Value Input */}
                                <div className="relative flex items-center gap-2">
                                    <Input
                                        type={envVar.isSecret && !visibleKeys.has(envVar.key) ? 'password' : 'text'}
                                        value={envVar.isSecret && !visibleKeys.has(envVar.key) ? getMaskedValue(envVar.value) : envVar.value}
                                        onChange={(e) => handleUpdateVar(index, 'value', e.target.value)}
                                        placeholder="value"
                                        className="font-mono text-sm h-9 bg-secondary/30"
                                        disabled={envVar.isSecret && !visibleKeys.has(envVar.key)}
                                    />

                                    {envVar.isSecret && (
                                        <button
                                            onClick={() => toggleVisibility(envVar.key)}
                                            className="p-1.5 rounded hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
                                            title={visibleKeys.has(envVar.key) ? 'Hide value' : 'Show value'}
                                        >
                                            {visibleKeys.has(envVar.key) ? (
                                                <EyeOff className="w-4 h-4" />
                                            ) : (
                                                <Eye className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="w-20 flex justify-end">
                                    <button
                                        onClick={() => handleDeleteVar(index)}
                                        className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete variable"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-950/20 border border-amber-500/20 text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                    <span className="text-amber-500 font-medium">Security:</span> Variables containing
                    sensitive keywords (password, secret, key, token, api) are automatically masked.
                    All values are encrypted with Google Secret Manager.
                </p>
            </div>
        </div>
    );
};

export default EnvVarsManager;
