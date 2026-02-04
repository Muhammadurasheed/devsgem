import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Clock, CheckCircle2, XCircle, TrendingUp,
  Activity, Zap, AlertTriangle, Calendar, Filter,
  ArrowUpRight, ArrowDownRight, Minus, Rocket,
  ChevronDown, Download, Globe, Server, Database, ShieldCheck
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api/client';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';

// Types
interface DeploymentRecord {
  id: string;
  timestamp: string;
  serviceName: string;
  repoUrl: string;
  status: 'success' | 'failed';
  duration: number; // seconds
  stages: {
    name: string;
    duration: number;
    status: 'success' | 'failed';
  }[];
  errorMessage?: string;
  region: string;
}

interface AnalyticsData {
  totalDeployments: number;
  successRate: number;
  avgDeployTime: number;
  failurePatterns: { pattern: string; count: number; percentage: number }[];
  deploymentsByDay: { date: string; success: number; failed: number }[];
  recentDeployments: DeploymentRecord[];
  stagePerformance: { stage: string; avgTime: number; failureRate: number }[];
  trends: {
    successRateTrend: 'up' | 'down' | 'stable';
    deployTimeTrend: 'up' | 'down' | 'stable';
    volumeTrend: 'up' | 'down' | 'stable';
  };
}

// Components
function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default'
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: any;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  variant?: 'default' | 'success' | 'danger';
}) {
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="relative group"
    >
      <Card className="p-6 bg-card/40 backdrop-blur-md border-border/40 hover:border-primary/40 transition-all duration-300 shadow-lg hover:shadow-primary/5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">{title}</p>
            <p className={cn(
              "text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70",
              variant === 'success' && "from-green-400 to-emerald-500",
              variant === 'danger' && "from-red-400 to-rose-500"
            )}>
              {value}
            </p>
          </div>

          <div className={cn(
            "p-3 rounded-2xl shadow-inner transition-colors duration-300",
            variant === 'success' ? "bg-green-500/10 group-hover:bg-green-500/20" :
              variant === 'danger' ? "bg-red-500/10 group-hover:bg-red-500/20" : "bg-primary/10 group-hover:bg-primary/20"
          )}>
            <Icon className={cn(
              "w-5 h-5",
              variant === 'success' ? "text-green-400" :
                variant === 'danger' ? "text-red-400" : "text-primary"
            )} />
          </div>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-[11px] text-muted-foreground font-medium">{subtitle}</p>
          {trend && trendValue && (
            <div className={cn("flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-background/50 border border-border/50 text-[10px] font-bold", trendColor)}>
              <TrendIcon className="w-2.5 h-2.5" />
              <span>{trendValue}</span>
            </div>
          )}
        </div>

        {/* Subtle hover accent */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </Card>
    </motion.div>
  );
}

function MainAnalyticsChart({ data }: { data: AnalyticsData['deploymentsByDay'] }) {
  return (
    <div className="h-[320px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              borderColor: 'hsl(var(--border))',
              borderRadius: '12px',
              fontSize: '12px',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
            }}
          />
          <Area
            type="monotone"
            dataKey="success"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorSuccess)"
            animationDuration={1500}
          />
          <Area
            type="monotone"
            dataKey="failed"
            stroke="#ef4444"
            strokeWidth={2}
            strokeDasharray="5 5"
            fillOpacity={1}
            fill="url(#colorFailed)"
            animationDuration={2000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(true);

  const { user } = useAuth();

  useEffect(() => {
    async function fetchAnalytics() {
      if (!user) return;

      setIsLoading(true);
      try {
        const data = await apiClient.getAnalytics(user.id);
        setAnalytics(data as AnalyticsData);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAnalytics();
  }, [user, timeRange]);

  const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#06b6d4'];

  return (
    <DashboardLayout>
      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Apple-Style Glass Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary uppercase tracking-widest"
            >
              <Activity className="w-3 h-3" />
              Sovereign Insights
            </motion.div>
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/60">
              Operational Intelligence
            </h1>
            <p className="text-muted-foreground text-sm max-w-xl font-medium">
              High-fidelity telemetry across your global deployment fleet. Proactive monitoring for the next generation of cloud engineering.
            </p>
          </div>

          <div className="flex items-center gap-3 p-1 bg-card/30 backdrop-blur-xl rounded-2xl border border-border/40">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[140px] border-none bg-transparent hover:bg-accent/50 transition-colors rounded-xl font-medium">
                <Calendar className="w-4 h-4 mr-2 opacity-50" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/40">
                <SelectItem value="24h">Past 24 Hours</SelectItem>
                <SelectItem value="7d">Past 7 Days</SelectItem>
                <SelectItem value="30d">Past 30 Days</SelectItem>
                <SelectItem value="90d">Quarterly View</SelectItem>
              </SelectContent>
            </Select>
            <Separator orientation="vertical" className="h-4 bg-border/40" />
            <Button variant="ghost" size="sm" className="rounded-xl hover:bg-accent/50 font-medium h-10 px-4">
              <Download className="w-4 h-4 mr-2 opacity-50" />
              Export Dataset
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-[500px] flex-col gap-6">
            <div className="relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="w-20 h-20 rounded-full border-2 border-primary/10 border-t-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]"
              />
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Rocket className="w-6 h-6 text-primary" />
              </motion.div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-lg font-bold tracking-tight">Hydrating Telemetry Pipeline</p>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest">GEMINI BRAIN SUBSYSTEM: ACTIVE</p>
            </div>
          </div>
        ) : !analytics || analytics.totalDeployments === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-[500px] border border-dashed border-border/60 rounded-[2rem] bg-card/20 backdrop-blur-sm relative overflow-hidden"
          >
            <div className="p-6 rounded-3xl bg-primary/10 mb-6 shadow-xl border border-primary/20">
              <Activity className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Architecture is Dark</h3>
            <p className="text-sm text-muted-foreground max-w-sm text-center mt-3 mb-8 font-medium">
              We haven't detected any active telemetry pulses. Deploy your first global service to bridge the intelligence gap.
            </p>
            <Button
              onClick={() => window.location.href = '/dashboard'}
              className="rounded-full px-8 py-6 h-auto text-lg font-bold shadow-2xl shadow-primary/20 hover:scale-105 transition-transform"
            >
              <Rocket className="w-5 h-5 mr-3" />
              Initiate Deployment
            </Button>

            {/* Background decorative elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--primary)_0%,_transparent_50%)] opacity-[0.03] pointer-events-none" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* High-Impact Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Executions"
                value={analytics.totalDeployments}
                subtitle="Lifecycle management events"
                icon={Server}
                trend={analytics.trends.volumeTrend}
                trendValue="+23.4%"
              />
              <StatCard
                title="Health Viability"
                value={`${analytics.successRate.toFixed(1)}%`}
                subtitle="End-to-end stability score"
                icon={ShieldCheck}
                variant="success"
                trend={analytics.trends.successRateTrend}
                trendValue="+1.8%"
              />
              <StatCard
                title="Velocity Delta"
                value={`${Math.floor(analytics.avgDeployTime / 60)}:${(analytics.avgDeployTime % 60).toString().padStart(2, '0')}`}
                subtitle="Time-to-market average"
                icon={Zap}
                trend={analytics.trends.deployTimeTrend}
                trendValue="-8s"
              />
              <StatCard
                title="Surface Risks"
                value={analytics.recentDeployments.filter(d => d.status === 'failed').length}
                subtitle="Failed build investigations"
                icon={AlertTriangle}
                variant="danger"
              />
            </div>

            {/* Expansive Data Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card className="p-8 bg-card/40 backdrop-blur-xl border-border/40 lg:col-span-2 shadow-2xl rounded-[2rem] overflow-hidden group">
                <div className="flex items-center justify-between mb-8">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      <h3 className="text-xl font-bold tracking-tight">Fleet Velocity</h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Deployment volume vs. health patterns</p>
                  </div>

                  <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-2 bg-primary/5 px-2 py-1 rounded-lg border border-primary/20">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-primary">Success Pulse</span>
                    </div>
                    <div className="flex items-center gap-2 bg-red-500/5 px-2 py-1 rounded-lg border border-red-500/20">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-red-500">Failed Node</span>
                    </div>
                  </div>
                </div>

                <MainAnalyticsChart data={analytics.deploymentsByDay} />
              </Card>

              <Card className="p-8 bg-card/40 backdrop-blur-xl border-border/40 shadow-2xl rounded-[2rem] flex flex-col h-full">
                <div className="space-y-1 mb-8">
                  <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-orange-400" />
                    <h3 className="text-xl font-bold tracking-tight">Failure Anatomy</h3>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Top recursive error signatures</p>
                </div>

                <div className="flex-1 space-y-6">
                  {analytics.failurePatterns.map((pattern, i) => (
                    <motion.div
                      key={pattern.pattern}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="group/item"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold truncate max-w-[200px]">{pattern.pattern}</span>
                        <Badge variant="outline" className="text-[10px] font-mono rounded-full bg-background/50 border-orange-500/50 text-orange-400">
                          {pattern.count} SIGHTINGS
                        </Badge>
                      </div>
                      <div className="relative h-2 bg-muted/40 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pattern.percentage}%` }}
                          transition={{ delay: i * 0.1 + 0.3, duration: 1 }}
                          className="absolute h-full bg-gradient-to-r from-orange-400 to-rose-500 rounded-full group-hover/item:scale-y-110 transition-transform"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1.5 font-bold uppercase tracking-widest opacity-60">
                        {pattern.percentage.toFixed(1)}% OF TOTAL FAILURES
                      </p>
                    </motion.div>
                  ))}

                  {analytics.failurePatterns.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full opacity-40">
                      <div className="p-4 rounded-full bg-green-500/10 mb-4 border border-green-500/20">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                      </div>
                      <p className="text-sm font-bold">Absolute Stability</p>
                      <p className="text-xs">No failure patterns detected</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Granular Detail Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="p-8 bg-card/40 backdrop-blur-xl border-border/40 shadow-2xl rounded-[2rem]">
                <div className="flex items-baseline justify-between mb-8">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Globe className="w-5 h-5 text-emerald-400" />
                      <h3 className="text-xl font-bold tracking-tight">Stage Latency</h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Optimization metrics per pipeline phase</p>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-none hover:bg-emerald-500/20">OPTIMIZED</Badge>
                </div>

                <div className="space-y-4">
                  {analytics.stagePerformance.map((stage, i) => (
                    <motion.div
                      key={stage.stage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center gap-6 p-4 rounded-2xl hover:bg-accent/30 transition-all border border-transparent hover:border-border/40 group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-background/50 flex items-center justify-center font-bold text-xs shadow-soft group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        0{i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold">{stage.stage.replace(/_/g, ' ').toUpperCase()}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">Mean Duration: <span className="text-foreground">{stage.avgTime}s</span></span>
                          <Separator orientation="vertical" className="h-2 bg-border/60" />
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-tight",
                            stage.failureRate > 10 ? "text-red-400" : "text-green-400"
                          )}>
                            Failure Probability: {stage.failureRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <ChevronDown className="w-4 h-4 opacity-0 group-hover:opacity-40 transition-opacity" />
                    </motion.div>
                  ))}
                </div>
              </Card>

              <Card className="p-8 bg-card/40 backdrop-blur-xl border-border/40 shadow-2xl rounded-[2rem]">
                <div className="flex items-center justify-between mb-8">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      <h3 className="text-xl font-bold tracking-tight">Deployment Stream</h3>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Real-time execution ledger</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full h-8 text-[10px] font-bold px-3">
                    VIEW ALL
                  </Button>
                </div>

                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {analytics.recentDeployments.map((deployment, i) => (
                      <motion.div
                        key={deployment.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="group flex items-center gap-4 p-4 rounded-2xl bg-background/30 hover:bg-background/60 border border-transparent hover:border-border/60 transition-all cursor-pointer"
                        onClick={() => navigate(`/dashboard/deployments/${deployment.id}`)}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-110",
                          deployment.status === 'success' ? "bg-green-500/10" : "bg-red-500/10"
                        )}>
                          {deployment.status === 'success' ? (
                            <CheckCircle2 className="w-6 h-6 text-green-400" />
                          ) : (
                            <XCircle className="w-6 h-6 text-red-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate leading-none mb-1.5">{deployment.serviceName}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                            <span className="px-1.5 py-0.5 rounded bg-muted/60 font-mono">{deployment.id.slice(0, 8)}</span>
                            <span>•</span>
                            <span>{new Date(deployment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span className="uppercase">{deployment.region}</span>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-mono font-bold">{deployment.duration}s</p>
                          <TrendingUp className={cn(
                            "w-3 h-3 ml-auto mt-1",
                            deployment.status === 'success' ? "text-green-500/50" : "text-red-500/50"
                          )} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}

const Separator = ({ orientation = 'horizontal', className }: { orientation?: 'horizontal' | 'vertical', className?: string }) => (
  <div className={cn(
    orientation === 'horizontal' ? 'h-[1px] w-full' : 'w-[1px] h-full',
    'bg-border',
    className
  )} />
);
