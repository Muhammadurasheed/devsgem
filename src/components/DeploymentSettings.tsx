import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Settings2, Wand2, Calculator, History, ShieldCheck, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { DeploymentsTable } from './deployment/DeploymentsTable';

export const DeploymentSettings = () => {
    const [isAutoNaming, setIsAutoNaming] = useState(true);
    const [customName, setCustomName] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

    // Load from storage on mount
    useEffect(() => {
        const savedAuto = localStorage.getItem('devgem_param_auto_naming');
        const savedName = localStorage.getItem('devgem_param_service_name');

        if (savedAuto !== null) setIsAutoNaming(savedAuto === 'true');
        if (savedName) setCustomName(savedName);
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('devgem_param_auto_naming', String(isAutoNaming));

        if (!isAutoNaming && customName) {
            // Validate: lowercase, numbers, hyphens only
            const validName = customName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
            localStorage.setItem('devgem_param_service_name', validName);
            setCustomName(validName); // Update UI to show sanitized version
        } else {
            localStorage.removeItem('devgem_param_service_name');
        }

        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Settings2 className="w-5 h-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-primary/20 bg-background/95 backdrop-blur-xl">
                <div className="p-6 pb-2">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            Platform Settings
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Configure your FAANG-grade deployment parameters and manage secrets.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 border-b border-border/40">
                        <TabsList className="bg-transparent border-b-0 gap-6 h-12 p-0">
                            <TabsTrigger
                                value="general"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10 transition-all font-medium"
                            >
                                <Settings2 className="w-4 h-4 mr-2" />
                                General
                            </TabsTrigger>
                            <TabsTrigger
                                value="deployments"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10 transition-all font-medium"
                            >
                                <History className="w-4 h-4 mr-2" />
                                Deployments
                            </TabsTrigger>
                            <TabsTrigger
                                value="secrets"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10 transition-all font-medium"
                            >
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                Persistence & Secrets
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 p-6">
                        <TabsContent value="general" className="mt-0 space-y-6 animate-in fade-in-50 duration-300">
                            {/* Service Naming Config */}
                            <div className="flex flex-col gap-6 p-6 rounded-2xl bg-secondary/5 border border-border/50 shadow-sm transition-all hover:border-primary/20">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <Label className="text-lg font-semibold flex items-center gap-2">
                                            {isAutoNaming ? <Wand2 className="w-5 h-5 text-purple-500 animate-pulse" /> : <Calculator className="w-5 h-5 text-blue-500" />}
                                            Service Naming Strategy
                                        </Label>
                                        <p className="text-sm text-muted-foreground max-w-[340px]">
                                            {isAutoNaming
                                                ? "DevGem autonomously generates optimized service names based on your repository architecture."
                                                : "Manually specify a fixed Cloud Run service identifier for this project."}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={isAutoNaming}
                                        onCheckedChange={setIsAutoNaming}
                                        className="data-[state=checked]:bg-primary"
                                    />
                                </div>

                                {!isAutoNaming && (
                                    <div className="space-y-3 pt-2 animate-in slide-in-from-top-4 duration-300">
                                        <Label htmlFor="service-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                                            Persistent Service Name
                                        </Label>
                                        <Input
                                            id="service-name"
                                            placeholder="e.g. quantum-api-v1"
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                            className="font-mono text-sm bg-background/50 border-primary/20 focus:border-primary focus:ring-primary/20 h-11"
                                        />
                                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                            Google Cloud Constraint: Lowercase, numbers, and hyphens only.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="deployments" className="mt-0 animate-in fade-in-50 duration-300 h-full">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Activity</h3>
                                </div>
                                <DeploymentsTable />
                            </div>
                        </TabsContent>

                        <TabsContent value="secrets" className="mt-0 space-y-6 animate-in fade-in-50 duration-300">
                            <div className="p-6 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-purple-500/10 rounded-xl">
                                            <ShieldCheck className="w-6 h-6 text-purple-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold">Cloud Persistence Layer</h3>
                                            <p className="text-sm text-muted-foreground">
                                                Active Secrets are encrypted and stored in Google Secret Manager.
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm" className="gap-2 border-purple-500/30 hover:bg-purple-500/10 h-10 px-4">
                                        <RefreshCw className="w-4 h-4" />
                                        Refresh Sync
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-purple-500/10">
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-muted-foreground uppercase">Storage Engine</p>
                                        <p className="font-mono text-sm">Google Secret Manager (v2)</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-bold text-muted-foreground uppercase">Redundancy Status</p>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500" />
                                            <p className="text-sm font-medium">Multi-Region Redundant</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </div>

                    <div className="p-6 pt-2 border-t border-border/40 flex items-center justify-between bg-secondary/5">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                            DevGem Platform Protocol v2.5 // Secure Deployment
                        </p>
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" className="h-10 px-6 font-medium" onClick={() => setIsOpen(false)}>
                                Dismiss
                            </Button>
                            <Button
                                className="h-10 px-8 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:translate-y-[-1px]"
                                onClick={handleSave}
                            >
                                Apply Changes
                            </Button>
                        </div>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
