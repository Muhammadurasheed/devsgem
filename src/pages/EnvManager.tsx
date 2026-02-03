
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Plus, Trash2, Key, Eye, EyeOff, ArrowLeft, Loader2, ShieldCheck, AlertTriangle, Upload, CloudCog, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/DashboardLayout";

interface EnvVar {
    key: string;
    value: string;
    isVisible: boolean;
}

interface EnvManagerProps {
    deploymentId?: string;
    embedded?: boolean;
}

export default function EnvManager({ deploymentId: propDeploymentId, embedded = false }: EnvManagerProps = {}) {
    const params = useParams();
    const deploymentId = propDeploymentId || params.deploymentId;
    const navigate = useNavigate();
    const { toast } = useToast();

    const [envVars, setEnvVars] = useState<EnvVar[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [serviceName, setServiceName] = useState("");

    const [newKey, setNewKey] = useState("");
    const [newValue, setNewValue] = useState("");
    const [applyToCloudRun, setApplyToCloudRun] = useState(true);  // [FAANG] Live update option
    const [lastSyncSource, setLastSyncSource] = useState<string>("");

    // Fetch Env Vars
    useEffect(() => {
        if (!deploymentId) return;

        const fetchEnvVars = async () => {
            try {
                setLoading(true);
                // Fetch deployment details for service name
                const depRes = await fetch(`http://localhost:8000/api/deployments/${deploymentId}`);
                if (depRes.ok) {
                    const depData = await depRes.json();
                    setServiceName(depData.service_name);
                }

                // [FAANG] Fetch from Google Secret Manager via new sync endpoint
                const envRes = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/env`);
                if (envRes.ok) {
                    const envData = await envRes.json();
                    setLastSyncSource(envData.source);

                    // Convert dict to array
                    const vars = Object.entries(envData.env_vars || {}).map(([k, v]) => ({
                        key: k,
                        value: v as string,
                        isVisible: false
                    }));
                    setEnvVars(vars);
                } else {
                    throw new Error("Failed to load environment variables from Secret Manager");
                }
            } catch (error) {
                toast({
                    title: "Error loading environment variables",
                    description: "Could not fetch configuration from Secret Manager.",
                    variant: "destructive",
                });
            } finally {
                setLoading(false);
            }
        };

        fetchEnvVars();
    }, [deploymentId, toast]);

    const handleAdd = () => {
        if (!newKey.trim()) return;

        // Check duplicates
        if (envVars.some(e => e.key === newKey.trim())) {
            toast({
                title: "Duplicate Key",
                description: "This variable already exists.",
                variant: "destructive"
            });
            return;
        }

        setEnvVars([...envVars, { key: newKey.trim(), value: newValue, isVisible: true }]);
        setNewKey("");
        setNewValue("");
    };

    const handleUpdate = (index: number, field: 'key' | 'value', val: string) => {
        const updated = [...envVars];
        updated[index] = { ...updated[index], [field]: val };
        setEnvVars(updated);
    };

    const handleDelete = (index: number) => {
        setEnvVars(envVars.filter((_, i) => i !== index));
    };

    const toggleVisibility = (index: number) => {
        const updated = [...envVars];
        updated[index] = { ...updated[index], isVisible: !updated[index].isVisible };
        setEnvVars(updated);
    };

    const handleSave = async () => {
        if (!deploymentId) return;

        setSaving(true);
        try {
            const payload = envVars.reduce((acc, curr) => ({
                ...acc,
                [curr.key]: curr.value
            }), {});

            // [FAANG] Two-Way Sync: Dashboard -> GSM -> Cloud Run (optional)
            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/env`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    env_vars: payload,
                    apply_to_cloud_run: applyToCloudRun  // Live update toggle
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast({
                    title: applyToCloudRun ? "Secrets Synced & Applied Live!" : "Secrets Synced to GSM",
                    description: applyToCloudRun
                        ? `${envVars.length} variables synced to Secret Manager and applied to Cloud Run (new revision created).`
                        : `${envVars.length} variables synced to Secret Manager. Apply on next deployment.`,
                });
                setLastSyncSource("google_secret_manager");
            } else {
                throw new Error(data.detail || "Save failed");
            }
        } catch (error: any) {
            toast({
                title: "Sync Failed",
                description: error.message || "Could not sync environment variables.",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    const content = (
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8 w-8 p-0">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                                Environment Variables
                            </h1>
                        </div>
                        <p className="text-muted-foreground ml-10">
                            Manage secrets for <span className="text-foreground font-medium">{serviceName}</span>
                        </p>
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="bg-green-600 hover:bg-green-700 text-white min-w-[120px]"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Syncing...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-4 w-4" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>

                {/* Status Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card/50 border border-border/50 rounded-xl p-4 space-y-4"
                >
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="h-5 w-5 text-green-400 mt-1 flex-shrink-0" />
                        <div className="text-sm flex-1">
                            <p className="font-medium text-foreground">Securely Stored in Google Secret Manager</p>
                            <p className="text-muted-foreground mt-1">
                                Variables are encrypted at rest and injected into your container at runtime.
                            </p>
                        </div>
                    </div>

                    {/* [FAANG] Live Update Toggle */}
                    <div className="flex items-center justify-between px-2 py-3 bg-accent/30 rounded-lg border border-border/30">
                        <div className="flex items-center gap-3">
                            <Zap className={`h-4 w-4 ${applyToCloudRun ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                            <div>
                                <p className="text-sm font-medium">Apply Changes Live</p>
                                <p className="text-xs text-muted-foreground">
                                    {applyToCloudRun
                                        ? "Will update Cloud Run immediately (creates new revision)"
                                        : "Changes apply on next deployment only"
                                    }
                                </p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={applyToCloudRun}
                                onChange={(e) => setApplyToCloudRun(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-green-500 peer-focus:ring-2 peer-focus:ring-green-500/50 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                    </div>
                </motion.div>

                {/* Variables List */}
                <div className="space-y-4">
                    <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-white/5 bg-accent/20 grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <div className="col-span-4 pl-2">Key</div>
                            <div className="col-span-7">Value</div>
                            <div className="col-span-1 text-center">Action</div>
                        </div>

                        <div className="divide-y divide-white/5">
                            <AnimatePresence>
                                {loading ? (
                                    <div className="p-8 flex justify-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                    </div>
                                ) : envVars.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground italic">
                                        No environment variables configured.
                                    </div>
                                ) : (
                                    envVars.map((env, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="p-3 grid grid-cols-12 gap-4 items-center group hover:bg-white/5 transition-colors"
                                        >
                                            <div className="col-span-4 relative">
                                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-400 opacity-50" />
                                                <Input
                                                    value={env.key}
                                                    onChange={(e) => handleUpdate(index, 'key', e.target.value)}
                                                    className="pl-9 font-mono text-sm bg-transparent border-transparent hover:border-border focus:border-primary transition-all"
                                                    placeholder="KEY_NAME"
                                                />
                                            </div>
                                            <div className="col-span-7 relative">
                                                <Input
                                                    type={env.isVisible ? "text" : "password"}
                                                    value={env.value}
                                                    onChange={(e) => handleUpdate(index, 'value', e.target.value)}
                                                    className="pr-10 font-mono text-sm bg-transparent border-transparent hover:border-border focus:border-primary transition-all"
                                                    placeholder="Value"
                                                />
                                                <button
                                                    onClick={() => toggleVisibility(index)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    {env.isVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                            </div>
                                            <div className="col-span-1 flex justify-center">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDelete(index)}
                                                    className="text-muted-foreground hover:text-red-400 hover:bg-red-400/10 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Add New Row */}
                        <div className="p-3 bg-accent/30 border-t border-white/5 grid grid-cols-12 gap-4 items-center">
                            <div className="col-span-4 relative">
                                <Plus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-400" />
                                <Input
                                    value={newKey}
                                    onChange={(e) => setNewKey(e.target.value)}
                                    className="pl-9 bg-background/50 border-white/10 focus:border-green-500/50"
                                    placeholder="NEW_VARIABLE_KEY"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                />
                            </div>
                            <div className="col-span-7">
                                <Input
                                    value={newValue}
                                    onChange={(e) => setNewValue(e.target.value)}
                                    className="bg-background/50 border-white/10 focus:border-green-500/50"
                                    placeholder="Value"
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                />
                            </div>
                            <div className="col-span-1 flex justify-center">
                                <Button
                                    size="sm"
                                    onClick={handleAdd}
                                    disabled={!newKey.trim()}
                                    className="h-9 w-9 p-0 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30"
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button variant="outline" className="text-muted-foreground text-xs gap-2 border-dashed">
                            <Upload className="h-3.5 w-3.5" />
                            Bulk Import .env
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (embedded) return content;

    return (
        <DashboardLayout>
            {content}
        </DashboardLayout>
    );
}
