import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Plus, Check, AlertCircle, Copy, Loader2, ExternalLink, ShieldCheck, ShieldAlert, Trash2, ArrowRight, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface DomainRecord {
    type: string;
    name: string;
    rrdata: string;
}

interface DomainMapping {
    domain: string;
    service: string;
    created_at: string;
    status: 'verified' | 'pending' | 'unknown';
    records: DomainRecord[];
}

interface DomainManagerProps {
    deploymentId: string;
    serviceName: string;
}

export const DomainManager = ({ deploymentId, serviceName }: DomainManagerProps) => {
    const [newDomain, setNewDomain] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const queryClient = useQueryClient();

    // 1. Fetch Domains Query
    const { data: domains = [], isLoading } = useQuery({
        queryKey: ['domains', deploymentId],
        queryFn: async () => {
            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/domains`);
            if (!res.ok) throw new Error('Failed to fetch domains');
            const data = await res.json();
            return data.domains as DomainMapping[];
        },
        refetchInterval: (query) => {
            // Poll if any domain is still pending
            const hasPending = query.state.data?.some(d => d.status === 'pending');
            return hasPending ? 10000 : false;
        }
    });

    // 2. Add Domain Mutation
    const addMutation = useMutation({
        mutationFn: async (domain: string) => {
            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/domains`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Failed to add domain");
            }
            return await res.json();
        },
        onSuccess: () => {
            toast.success(`Domain added successfully!`);
            setNewDomain('');
            setIsDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['domains', deploymentId] });
        },
        onError: (error: Error) => {
            toast.error(error.message);
        }
    });

    // 3. Delete Domain Mutation
    const deleteMutation = useMutation({
        mutationFn: async (domain: string) => {
            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/domains?domain=${domain}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed to remove domain');
            return domain;
        },
        onSuccess: () => {
            toast.success("Domain removed");
            queryClient.invalidateQueries({ queryKey: ['domains', deploymentId] });
        }
    });

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.info("Copied to clipboard");
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            {/* Header / Add Domain CTA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary" />
                        Custom Domains
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Connect your own brand to this deployment with FAANG-grade performance.
                    </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="group bg-white text-black hover:bg-gray-200">
                            <Plus className="w-4 h-4 mr-2 transition-transform group-hover:rotate-90" />
                            Connect Domain
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md bg-[#0f1419] border-white/10 text-white backdrop-blur-xl">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Connect Custom Domain</DialogTitle>
                            <DialogDescription className="text-gray-400">
                                Enter the domain you want to use. We'll provide the DNS records.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Domain Name</label>
                                <Input
                                    placeholder="e.g. app.yourbrand.com"
                                    value={newDomain}
                                    onChange={(e) => setNewDomain(e.target.value)}
                                    className="bg-black/40 border-white/10 text-white focus:ring-primary/40 h-10"
                                />
                            </div>
                            <div className="rounded-lg bg-blue-500/5 p-3 border border-blue-500/10 flex gap-3 items-start">
                                <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                                <div className="text-xs text-blue-200/70 leading-relaxed">
                                    We support root domains and subdomains. Propagation typically takes 5-15 minutes globally.
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="hover:bg-white/5">Cancel</Button>
                            <Button
                                onClick={() => addMutation.mutate(newDomain)}
                                disabled={addMutation.isPending || !newDomain}
                                className="bg-white text-black hover:bg-gray-100"
                            >
                                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Start Setup
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Domains List */}
            <div className="grid gap-4">
                {isLoading ? (
                    <div className="flex items-center justify-center p-20 opacity-30">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : domains.length === 0 ? (
                    <Card className="border-dashed border-white/5 bg-[#0a0f14]/30">
                        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Globe className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-md font-medium text-white mb-2">No custom domains yet</h3>
                            <p className="text-sm text-muted-foreground max-w-xs">
                                Connect your own domain to give your app a professional look and feel.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {domains.map((domain) => (
                            <motion.div
                                key={domain.domain}
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="group"
                            >
                                <Card className="border-white/5 bg-[#0a0f14]/50 backdrop-blur-md overflow-hidden hover:border-white/10 transition-colors">
                                    <div className="p-5 flex flex-col md:flex-row gap-5">
                                        {/* Status & Domain Info */}
                                        <div className="flex-1 flex flex-col gap-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg ${domain.status === 'verified' ? 'bg-green-500/10' : 'bg-yellow-500/10'}`}>
                                                        {domain.status === 'verified' ?
                                                            <ShieldCheck className="w-5 h-5 text-green-500" /> :
                                                            <ShieldAlert className="w-5 h-5 text-yellow-500 animate-pulse" />
                                                        }
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-semibold flex items-center gap-2">
                                                            {domain.domain}
                                                            <a href={`https://${domain.domain}`} target="_blank" rel="noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-white" />
                                                            </a>
                                                        </h3>
                                                        <Badge variant="outline" className={`mt-1 capitalize text-[10px] ${domain.status === 'verified' ? 'text-green-500 border-green-500/20 bg-green-500/5' : 'text-yellow-500 border-yellow-500/20 bg-yellow-500/5'}`}>
                                                            {domain.status === 'verified' ? 'Active' : 'Verification Pending'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-400"
                                                    onClick={() => deleteMutation.mutate(domain.domain)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>

                                            {/* DNS Setup Guide (FAANG Level) */}
                                            {domain.status !== 'verified' && (
                                                <div className="mt-2 space-y-4">
                                                    <div className="flex items-center gap-2 text-sm font-medium text-white/80">
                                                        <ArrowRight className="w-4 h-4 text-primary" />
                                                        Complete DNS Setup
                                                    </div>
                                                    <div className="grid gap-3 p-4 rounded-xl bg-black/40 border border-white/5">
                                                        {domain.records.map((rec, i) => (
                                                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                                                                <div className="flex items-center gap-4 min-w-[120px]">
                                                                    <Badge variant="outline" className="w-14 justify-center font-mono py-0">{rec.type}</Badge>
                                                                    <div className="font-mono text-muted-foreground">{rec.name || '@'}</div>
                                                                </div>
                                                                <div className="flex items-center justify-between flex-1 bg-white/5 rounded-md px-2 py-1.5 border border-white/5">
                                                                    <code className="font-mono text-white/80 truncate max-w-[200px]">{rec.rrdata}</code>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6"
                                                                        onClick={() => copyToClipboard(rec.rrdata)}
                                                                    >
                                                                        <Copy className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground italic">
                                                        * Note: DNS changes can take up to 24 hours, but usually propagate in minutes. We'll automatically verify it for you.
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
