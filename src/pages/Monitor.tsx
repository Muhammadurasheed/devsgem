
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { motion } from "framer-motion";
import { Activity, Cpu, Server, FileText, ArrowLeft, RefreshCw, Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { toast } from 'sonner';
import { useDeployments, Deployment } from '@/hooks/useDeployments';
import { RuntimeLogs } from "@/components/deployment/RuntimeLogs";

interface MetricPoint {
    timestamp: string;
    value: number;
}

interface MetricsData {
    cpu: MetricPoint[];
    memory: MetricPoint[];
    requests: MetricPoint[];
}

export default function Monitor() {
    const { deploymentId } = useParams();
    const navigate = useNavigate();

    const [metrics, setMetrics] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [serviceName, setServiceName] = useState("");

    const fetchMetrics = async (isRefresh = false) => {
        if (!deploymentId) return;
        const { apiClient } = await import("@/lib/api/client");

        try {
            if (isRefresh) setRefreshing(true);
            else setLoading(true);

            // Fetch Deployment Info & Metrics in parallel for FAANG performance
            const [depData, data] = await Promise.all([
                apiClient.getDeployment(deploymentId),
                apiClient.getMetrics(deploymentId, 60)
            ]);

            if (depData) {
                setServiceName((depData as any).service_name);
            }

            if (data) {
                // Format timestamps for display
                const formatData = (points: any[]) => points.map(p => ({
                    ...p,
                    displayTime: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }));

                setMetrics({
                    cpu: formatData(data.cpu || []),
                    memory: formatData(data.memory || []),
                    requests: formatData(data.requests || [])
                });
            }
        } catch (error) {
            console.error(error);
            toast.error("Monitoring Offline", {
                description: "Could not establish connection to telemetry stream.",
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
        // Auto-refresh every 60s
        const interval = setInterval(() => fetchMetrics(true), 60000);
        return () => clearInterval(interval);
    }, [deploymentId]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-popover border border-border p-2 rounded shadow-lg text-xs">
                    <p className="font-semibold mb-1">{label}</p>
                    <p className="text-primary">
                        {payload[0].value.toFixed(2)}
                        {payload[0].payload.unit || ''}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <DashboardLayout>
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 mb-1">
                                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8 w-8 p-0">
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <h1 className="text-2xl font-bold">Monitor: {serviceName}</h1>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground ml-10">
                                <Activity className="w-4 h-4 text-green-400" />
                                <span className="text-sm">Real-time Metrics (Last Hour)</span>
                            </div>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => fetchMetrics(true)} disabled={refreshing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>

                    {loading && !metrics ? (
                        <div className="h-96 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                            {/* Metrics Column */}
                            <div className="xl:col-span-8 space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* CPU Chart */}
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                        <Card className="h-full">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">CPU Utilization</CardTitle>
                                                <Cpu className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="h-[200px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={metrics?.cpu || []}>
                                                            <defs>
                                                                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                            <XAxis dataKey="displayTime" hide />
                                                            <YAxis hide domain={[0, 'auto']} />
                                                            <Tooltip content={<CustomTooltip />} />
                                                            <Area
                                                                type="monotone"
                                                                dataKey="value"
                                                                stroke="#3B82F6"
                                                                fillOpacity={1}
                                                                fill="url(#colorCpu)"
                                                                strokeWidth={2}
                                                            />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>Current Load</span>
                                                    <span className="font-mono text-foreground text-lg">
                                                        {(metrics?.cpu[metrics.cpu.length - 1]?.value || 0).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>

                                    {/* Memory Chart */}
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                                        <Card className="h-full">
                                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
                                                <Server className="h-4 w-4 text-muted-foreground" />
                                            </CardHeader>
                                            <CardContent>
                                                <div className="h-[200px] w-full">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={metrics?.memory || []}>
                                                            <defs>
                                                                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                            <XAxis dataKey="displayTime" hide />
                                                            <YAxis hide domain={[0, 'auto']} />
                                                            <Tooltip content={<CustomTooltip />} />
                                                            <Area
                                                                type="monotone"
                                                                dataKey="value"
                                                                stroke="#8B5CF6"
                                                                fillOpacity={1}
                                                                fill="url(#colorMem)"
                                                                strokeWidth={2}
                                                            />
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>Current Usage</span>
                                                    <span className="font-mono text-foreground text-lg">
                                                        {(metrics?.memory[metrics.memory.length - 1]?.value || 0).toFixed(1)}%
                                                    </span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                </div>

                                {/* Request Count */}
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                                    <Card>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <CardTitle className="text-sm font-medium">Request Volume (RPS)</CardTitle>
                                            <Zap className="h-4 w-4 text-muted-foreground" />
                                        </CardHeader>
                                        <CardContent>
                                            <div className="h-[200px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={metrics?.requests || []}>
                                                        <defs>
                                                            <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#F472B6" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#F472B6" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                                        <XAxis dataKey="displayTime" tick={{ fontSize: 10, fill: '#666' }} />
                                                        <YAxis hide />
                                                        <Tooltip content={<CustomTooltip />} />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="value"
                                                            stroke="#F472B6"
                                                            fillOpacity={1}
                                                            fill="url(#colorReq)"
                                                            strokeWidth={2}
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </div>

                            {/* Logs Column */}
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.4 }}
                                className="xl:col-span-4 h-[600px] xl:h-auto min-h-[500px]"
                            >
                                <RuntimeLogs deploymentId={deploymentId!} serviceName={serviceName} className="h-full" />
                            </motion.div>
                        </div>
                    )}

                    {!loading && (!metrics || (metrics.cpu.length === 0 && metrics.requests.length === 0)) && (
                        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No telemetry data available yet.</p>
                            <p className="text-xs mt-1">Make some requests to your service to generate insights.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
