import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
    Layout,
    Settings,
    Activity,
    Terminal,
    Globe,
    GitBranch,
    Clock,
    ExternalLink,
    Trash2,
    ShieldCheck,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Database,
    Cpu,
    Zap,
    History,
    ArrowLeft
} from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { DeploymentPreview } from "@/components/deployment/DeploymentPreview";
import { RuntimeLogs } from "@/components/deployment/RuntimeLogs";
import { TerminalView } from "@/components/deployment/TerminalView";
import EnvManager from "./EnvManager";
import { AutoDeployToggle } from "@/components/deployment/AutoDeployToggle";
import { BrandingIcon } from "@/components/BrandingIcon";
import { DomainManager } from '@/components/deployment/DomainManager';
import { resolveLogo } from '@/lib/logos';
import { Deployment } from "@/hooks/useDeployments";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function DeploymentDetails() {
    const { deploymentId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const activeTab = searchParams.get('tab') || 'overview';

    // [MAANG] High-Performance Data Rehydration
    const {
        data: deployment,
        isLoading,
        error
    } = useQuery<Deployment>({
        queryKey: ['deployment', deploymentId],
        queryFn: async () => {
            if (!deploymentId) throw new Error("No deployment ID provided");
            return await apiClient.getDeployment(deploymentId) as Deployment;
        },
        refetchInterval: 10000, // Poll every 10s for status updates
        staleTime: 60000, // Keep data fresh for 1 min
    });

    const setActiveTab = (tab: string) => {
        setSearchParams({ tab });
    };

    if (error) return (
        <DashboardLayout>
            <div className="p-8 text-center text-red-500">Error loading deployment: {error.message}</div>
        </DashboardLayout>
    );

    if (!deployment) return (
        <DashboardLayout>
            <div className="p-8 text-center text-muted-foreground">Deployment not found.</div>
        </DashboardLayout>
    );

    const statusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'live': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'failed': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'building': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col h-full bg-background/50">
                {/* Header */}
                <div className="border-b border-border/40 bg-background/95 backdrop-blur sticky top-0 z-10">
                    <div className="container max-w-7xl mx-auto py-4 px-6 md:px-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                                <div>
                                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
                                        {resolveLogo(deployment) && (
                                            <img
                                                src={resolveLogo(deployment)!}
                                                className="w-8 h-8 rounded-sm object-contain bg-white/5 p-1"
                                                alt=""
                                                onError={(e) => (e.currentTarget.style.display = 'none')}
                                            />
                                        )}
                                        {deployment.service_name}
                                        <Badge variant="outline" className={`${statusColor(deployment.status)} uppercase text-[10px] tracking-wider`}>
                                            {deployment.status}
                                        </Badge>
                                    </h1>
                                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                        {deployment.url ? (
                                            <a href={deployment.url} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline flex items-center gap-1">
                                                {deployment.url.replace('https://', '')} <ExternalLink className="w-3 h-3" />
                                            </a>
                                        ) : (
                                            <span>No URL generated</span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <GitBranch className="w-3.5 h-3.5" /> main
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {(() => {
                                                try {
                                                    const dateStr = deployment.updated_at || deployment.created_at;
                                                    // Ensure we have a valid date even if the string is messy
                                                    const date = new Date(dateStr);
                                                    return isNaN(date.getTime()) ? 'recently' : formatDistanceToNow(date, { addSuffix: true });
                                                } catch (e) {
                                                    return 'recently';
                                                }
                                            })()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button variant="outline" onClick={() => navigate(`/dashboard/monitor/${deploymentId}`)}>
                                    <Activity className="w-4 h-4 mr-2" />
                                    Monitor
                                </Button>
                                {deployment.url && (
                                    <Button className="bg-white text-black hover:bg-gray-200" onClick={() => window.open(deployment.url, '_blank')}>
                                        Visit Site
                                    </Button>
                                )}
                            </div>
                        </div>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="bg-transparent border-b border-transparent w-full justify-start h-auto p-0 rounded-none gap-6">
                                <TabsTrigger value="overview" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-2">Overview</TabsTrigger>
                                <TabsTrigger value="env" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-2">Environment</TabsTrigger>
                                <TabsTrigger value="domains" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-2">Domains</TabsTrigger>
                                <TabsTrigger value="logs" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-2">Logs</TabsTrigger>
                                <TabsTrigger value="settings" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-2">Settings</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                {/* Content */}
                <div className="container max-w-7xl mx-auto p-6 md:p-8 py-8 space-y-8">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        <TabsContent value="overview" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 space-y-6">
                                    <Card className="overflow-hidden border-border/40 bg-card/50 backdrop-blur-sm p-0">
                                        <DeploymentPreview
                                            deploymentId={deploymentId!}
                                            deploymentUrl={deployment.url}
                                            status={deployment.status}
                                            className="h-[350px]"
                                        />
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Automation</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <AutoDeployToggle
                                                deploymentId={deploymentId!}
                                                repoUrl={deployment.repo_url}
                                            />
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="space-y-6">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Information</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4 text-sm">
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="flex justify-between items-center py-1 border-b border-border/50">
                                                    <div className="text-muted-foreground">Status</div>
                                                    <div className="flex items-center gap-2">
                                                        {deployment.status === 'live' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Activity className="w-4 h-4 text-yellow-500" />}
                                                        <span className="capitalize">{deployment.status}</span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center py-1 border-b border-border/50">
                                                    <div className="text-muted-foreground">Region</div>
                                                    <div className="flex items-center gap-1.5">
                                                        <img src="https://upload.wikimedia.org/wikipedia/commons/e/e2/Flag_of_the_United_States_%28Pantone%29.svg" className="w-4 h-3 rounded-[2px]" alt="US" />
                                                        {deployment.region}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center py-1 border-b border-border/50">
                                                    <div className="text-muted-foreground">Memory</div>
                                                    <div>{deployment.memory || '512Mi'}</div>
                                                </div>
                                                <div className="flex justify-between items-center py-1 border-b border-border/50">
                                                    <div className="text-muted-foreground">CPU</div>
                                                    <div>{deployment.cpu || '1'} vCPU</div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Source</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center gap-3">
                                                <GitBranch className="w-5 h-5 text-muted-foreground" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium truncate">{deployment.repo_url?.split('/').pop() || 'Repository'}</div>
                                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> main
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => window.open(deployment.repo_url, '_blank')}>
                                                    View
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="env" className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                            <EnvManager deploymentId={deploymentId!} embedded />
                        </TabsContent>

                        <TabsContent value="domains" className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                            <DomainManager deploymentId={deploymentId!} serviceName={deployment.service_name} />
                        </TabsContent>

                        <TabsContent value="logs" className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                            <div className="flex flex-col gap-6 h-[75vh] min-h-[500px]">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
                                    {/* Build Logs - The High-Fidelity Record */}
                                    <div className="flex flex-col h-full overflow-hidden">
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                            <Terminal className="w-4 h-4 text-blue-400" />
                                            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Build Artifacts</span>
                                        </div>
                                        <TerminalView
                                            logs={deployment.build_logs || []}
                                            className="flex-1"
                                        />
                                    </div>

                                    {/* Runtime Logs Stream - The Live Heartbeat */}
                                    <div className="flex flex-col h-full overflow-hidden">
                                        <div className="flex items-center gap-2 mb-2 px-1">
                                            <Activity className="w-4 h-4 text-green-400" />
                                            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Runtime Console</span>
                                        </div>
                                        <RuntimeLogs
                                            deploymentId={deploymentId!}
                                            serviceName={deployment.service_name}
                                            className="flex-1"
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                            <Card className="border-red-500/20 bg-red-500/5">
                                <CardHeader>
                                    <CardTitle className="text-red-500 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" /> Danger Zone
                                    </CardTitle>
                                    <CardDescription>Irreversible actions requiring confirmation.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="destructive">
                                                Delete Deployment
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will permanently delete <strong>{deployment.service_name}</strong> and all associated resources on Google Cloud. This action cannot be undone.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={async () => {
                                                        try {
                                                            if (deploymentId) {
                                                                await apiClient.deleteDeployment(deploymentId);
                                                                navigate('/dashboard');
                                                                toast({
                                                                    title: "Deployment deleted successfully",
                                                                    description: "All resources have been decommissioned.",
                                                                });
                                                            }
                                                        } catch (err) {
                                                            toast({
                                                                title: "Failed to delete deployment",
                                                                description: err instanceof Error ? err.message : "Internal error",
                                                                variant: "destructive"
                                                            });
                                                        }
                                                    }}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Delete Project
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </DashboardLayout>
    );
}
