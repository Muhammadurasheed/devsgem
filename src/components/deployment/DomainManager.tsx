import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Plus, Check, AlertCircle, Copy, Loader2, ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'sonner';

interface DomainRecord {
    type: string;
    name: string;
    rrdata: string;
}

interface DomainMapping {
    domain: string;
    service: string;
    created_at: string;
    status: 'verified' | 'verifying' | 'pending';
    records: DomainRecord[];
}

interface DomainManagerProps {
    deploymentId: string;
    serviceName: string;
}

export const DomainManager = ({ deploymentId, serviceName }: DomainManagerProps) => {
    const [domains, setDomains] = useState<DomainMapping[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [newDomain, setNewDomain] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Fetch domains
    const fetchDomains = async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/domains`);
            if (res.ok) {
                const data = await res.json();
                setDomains(data.domains || []);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDomains();
    }, [deploymentId]);

    const handleAddDomain = async () => {
        if (!newDomain) return;
        setAdding(true);
        try {
            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/domains`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: newDomain })
            });

            if (res.ok) {
                toast.success(`Domain ${newDomain} added!`);
                setNewDomain('');
                setIsDialogOpen(false);
                fetchDomains();
            } else {
                const err = await res.json();
                toast.error(err.detail || "Failed to add domain");
            }
        } catch (error) {
            toast.error("Network error");
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (domain: string) => {
        if (!confirm(`Remove ${domain}?`)) return;
        try {
            await fetch(`http://localhost:8000/api/deployments/${deploymentId}/domains?domain=${domain}`, {
                method: 'DELETE'
            });
            toast.success("Domain removed");
            fetchDomains(); // Refresh
        } catch (error) {
            toast.error("Failed to remove domain");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.info("Copied to clipboard");
    };

    return (
        <Card className="border border-white/5 bg-[#0a0f14]/50 backdrop-blur-sm shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                    <CardTitle className="text-lg font-medium flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        Custom Domains
                    </CardTitle>
                    <CardDescription>
                        Map your own domains to your Cloud Run service.
                    </CardDescription>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="gap-1.5 bg-white text-black hover:bg-gray-200">
                            <Plus className="w-4 h-4" /> Add Domain
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-[#0f1419] border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle>Add Custom Domain</DialogTitle>
                            <DialogDescription className="text-gray-400">
                                Enter the domain you want to use (e.g., app.example.com).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex items-center space-x-2 py-4">
                            <div className="grid flex-1 gap-2">
                                <Input
                                    placeholder="subdomain.yourdomain.com"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value)}
                                    className="bg-black/20 border-white/10 text-white focus:ring-primary/50"
                                />
                            </div>
                        </div>
                        <DialogFooter className="justify-end">
                            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="hover:bg-white/5 hover:text-white">Cancel</Button>
                            <Button onClick={handleAddDomain} disabled={adding} className="bg-white text-black hover:bg-gray-200">
                                {adding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Add Domain
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 min-h-[100px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-20 opacity-50">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    ) : domains.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-8 border-2 border-dashed border-white/5 rounded-lg text-muted-foreground text-sm"
                        >
                            No custom domains configured.
                        </motion.div>
                    ) : (
                        <AnimatePresence>
                            {domains.map((domain) => (
                                <motion.div
                                    key={domain.domain}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="group relative flex flex-col gap-3 rounded-lg border border-white/5 bg-white/5 p-4 hover:bg-white/[0.07] transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            {domain.status === 'verified' ? (
                                                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10 text-green-500">
                                                    <ShieldCheck className="w-4 h-4" />
                                                    <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping opacity-20" />
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-500 relative">
                                                    <ShieldAlert className="w-4 h-4" />
                                                    <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                                </div>
                                            )}

                                            <div>
                                                <div className="flex items-center gap-2 font-medium text-sm text-white">
                                                    {domain.domain}
                                                    <a href={`https://${domain.domain}`} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ExternalLink className="w-3 h-3 text-muted-foreground hover:text-white" />
                                                    </a>
                                                </div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                                    {domain.status === 'verified' ? (
                                                        <span className="text-green-500 font-medium">Verified & Active</span>
                                                    ) : (
                                                        <span className="text-yellow-500 font-medium">DNS Verification Required</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(domain.domain)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
                                        >
                                            Remove
                                        </Button>
                                    </div>

                                    {/* DNS Records Drawer - Only show if not verified or user wants to see */}
                                    {domain.status !== 'verified' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            className="ml-11 bg-black/30 rounded-md p-3 border border-white/5"
                                        >
                                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                                                Required DNS Records
                                            </div>
                                            <div className="space-y-2">
                                                {domain.records.map((rec, i) => (
                                                    <div key={i} className="flex items-center justify-between text-xs bg-white/5 p-2 rounded border border-white/5">
                                                        <div className="flex items-center gap-4">
                                                            <Badge variant="outline" className="w-12 justify-center font-mono">{rec.type}</Badge>
                                                            <div className="font-mono text-muted-foreground">{rec.name || '@'}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                                                            <code className="font-mono text-white/80 truncate max-w-[200px]" title={rec.rrdata}>
                                                                {rec.rrdata}
                                                            </code>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 shrink-0"
                                                                onClick={() => copyToClipboard(rec.rrdata)}
                                                            >
                                                                <Copy className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
