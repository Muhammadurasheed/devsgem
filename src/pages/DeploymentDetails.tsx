import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RuntimeLogs } from '@/components/deployment/RuntimeLogs';
import { DeploymentPreview } from '@/components/deployment/DeploymentPreview';
import { AutoDeployToggle } from '@/components/deployment/AutoDeployToggle';
import { DomainManager } from '@/components/deployment/DomainManager';
import EnvManager from '@/pages/EnvManager';
import { ExternalLink, GitBranch, Clock, ArrowLeft, Terminal, Activity, CheckCircle2, ShieldAlert } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function DeploymentDetails() {
    const { deploymentId } = useParams();
    const navigate = useNavigate();
    const [deployment, setDeployment] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        const fetchDeployment = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}`);
                if (res.ok) setDeployment(await res.json());
            } catch (error) {
                console.error("Failed to fetch deployment", error);
            }
        };
        fetchDeployment();
    }, [deploymentId]);

    if (!deployment) return (
        <DashboardLayout>
            <div className="p-8 text-center text-muted-foreground">Loading deployment details...</div>
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
            <div className="flex-1 overflow-y-auto bg-background/50">
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
                                            {formatDistanceToNow(new Date(deployment.updated_at || deployment.created_at))} ago
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
                                {/* Build Logs */}
                                <Card className="h-full flex flex-col bg-[#0a0f14] border-white/5">
                                    <CardHeader className="bg-white/5 py-3 px-4 border-b border-white/5">
                                        <CardTitle className="text-sm font-mono flex items-center gap-2">
                                            <Terminal className="w-4 h-4 text-blue-400" /> Build Logs
                                        </CardTitle>
                                    </CardHeader>
                                    <ScrollArea className="flex-1 p-4 font-mono text-xs text-muted-foreground">
                                        {deployment.build_logs?.length ? (
                                            deployment.build_logs.map((log: string, i: number) => (
                                                <div key={i} className="mb-1 break-all hover:bg-white/5 px-1 rounded">{log}</div>
                                            ))
                                        ) : (
                                            <div className="text-center py-20 opacity-50">No build logs available</div>
                                        )}
                                    </ScrollArea>
                                </Card>

                                {/* Runtime Logs Stream */}
                                <div className="h-full">
                                    <RuntimeLogs deploymentId={deploymentId!} serviceName={deployment.service_name} className="h-full" />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="settings" className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                            <Card className="border-red-500/20 bg-red-500/5">
                                <CardHeader>
                                    <CardTitle className="text-red-500 flex items-center gap-2">
                                        <ShieldAlert className="w-5 h-5" /> Danger Zone
                                    </CardTitle>
                                    <CardDescription>Irreversible actions requiring confirmation.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Button variant="destructive">
                                        Delete Deployment
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </DashboardLayout>
    );
}
