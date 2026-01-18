/**
 * Deployment Analytics Dashboard
 * FAANG-Level: Success rates, deployment times, failure patterns
 * Bismillah ar-Rahman ar-Rahim
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, Clock, CheckCircle2, XCircle, TrendingUp, 
  Activity, Zap, AlertTriangle, Calendar, Filter,
  ArrowUpRight, ArrowDownRight, Minus, Rocket,
  ChevronDown, Download
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

// Mock data generator (would be replaced with real API calls)
function generateMockAnalytics(): AnalyticsData {
  const stages = ['repo_access', 'code_analysis', 'dockerfile_generation', 'security_scan', 'container_build', 'cloud_deployment'];
  
  const recentDeployments: DeploymentRecord[] = Array.from({ length: 15 }, (_, i) => ({
    id: `deploy-${i + 1}`,
    timestamp: new Date(Date.now() - i * 3600000 * (Math.random() * 5 + 1)).toISOString(),
    serviceName: ['ihealth-api', 'energram-backend', 'nexus-frontend', 'data-pipeline'][Math.floor(Math.random() * 4)],
    repoUrl: `https://github.com/user/repo-${i}`,
    status: Math.random() > 0.15 ? 'success' : 'failed',
    duration: Math.floor(Math.random() * 180 + 60),
    stages: stages.map(s => ({
      name: s,
      duration: Math.floor(Math.random() * 30 + 5),
      status: Math.random() > 0.1 ? 'success' : 'failed'
    })),
    errorMessage: Math.random() > 0.85 ? 'Container build failed: dependency not found' : undefined,
    region: 'us-central1'
  }));

  const successCount = recentDeployments.filter(d => d.status === 'success').length;
  const avgTime = recentDeployments.reduce((acc, d) => acc + d.duration, 0) / recentDeployments.length;

  return {
    totalDeployments: 47,
    successRate: (successCount / recentDeployments.length) * 100,
    avgDeployTime: Math.round(avgTime),
    failurePatterns: [
      { pattern: 'Dependency resolution failed', count: 3, percentage: 42.9 },
      { pattern: 'Container build timeout', count: 2, percentage: 28.6 },
      { pattern: 'Health check failed', count: 1, percentage: 14.3 },
      { pattern: 'Resource quota exceeded', count: 1, percentage: 14.3 },
    ],
    deploymentsByDay: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('en-US', { weekday: 'short' }),
      success: Math.floor(Math.random() * 8 + 2),
      failed: Math.floor(Math.random() * 2)
    })),
    recentDeployments,
    stagePerformance: stages.map(s => ({
      stage: s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      avgTime: Math.floor(Math.random() * 45 + 5),
      failureRate: Math.random() * 15
    })),
    trends: {
      successRateTrend: 'up',
      deployTimeTrend: 'down',
      volumeTrend: 'up'
    }
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
  const trendColor = variant === 'success' 
    ? (trend === 'up' ? 'text-green-400' : 'text-red-400')
    : variant === 'danger'
      ? (trend === 'down' ? 'text-green-400' : 'text-red-400')
      : 'text-muted-foreground';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden"
    >
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">{title}</p>
            <p className={cn(
              "text-3xl font-bold tracking-tight",
              variant === 'success' && "text-green-400",
              variant === 'danger' && "text-red-400"
            )}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          
          <div className={cn(
            "p-3 rounded-xl",
            variant === 'success' ? "bg-green-500/10" : 
            variant === 'danger' ? "bg-red-500/10" : "bg-primary/10"
          )}>
            <Icon className={cn(
              "w-5 h-5",
              variant === 'success' ? "text-green-400" : 
              variant === 'danger' ? "text-red-400" : "text-primary"
            )} />
          </div>
        </div>
        
        {trend && trendValue && (
          <div className={cn("flex items-center gap-1 mt-4 text-xs", trendColor)}>
            <TrendIcon className="w-3 h-3" />
            <span className="font-bold">{trendValue}</span>
            <span className="text-muted-foreground ml-1">vs last week</span>
          </div>
        )}
        
        {/* Decorative gradient */}
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-2xl" />
      </Card>
    </motion.div>
  );
}

function MiniBarChart({ data }: { data: { date: string; success: number; failed: number }[] }) {
  const maxValue = Math.max(...data.map(d => d.success + d.failed));
  
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map((day, i) => (
        <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '100px' }}>
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(day.success / maxValue) * 100}%` }}
              transition={{ delay: i * 0.1 }}
              className="w-full bg-green-500/80 rounded-t-sm"
            />
            {day.failed > 0 && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(day.failed / maxValue) * 100}%` }}
                transition={{ delay: i * 0.1 }}
                className="w-full bg-red-500/80 rounded-t-sm"
              />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">{day.date}</span>
        </div>
      ))}
    </div>
  );
}

function FailurePatternCard({ patterns }: { patterns: AnalyticsData['failurePatterns'] }) {
  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Common Failure Patterns</h3>
      </div>
      
      <div className="space-y-3">
        {patterns.map((pattern, i) => (
          <motion.div
            key={pattern.pattern}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-center gap-3"
          >
            <div className="flex-1">
              <p className="text-sm text-foreground">{pattern.pattern}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pattern.percentage}%` }}
                    transition={{ delay: i * 0.1 + 0.2 }}
                    className="h-full bg-orange-500/70 rounded-full"
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono w-12">
                  {pattern.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {pattern.count}x
            </Badge>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function StagePerformanceTable({ stages }: { stages: AnalyticsData['stagePerformance'] }) {
  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Stage Performance</h3>
      </div>
      
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-4 text-xs text-muted-foreground uppercase tracking-wider pb-2 border-b border-border/50">
          <span>Stage</span>
          <span className="text-right">Avg Time</span>
          <span className="text-right">Failure Rate</span>
        </div>
        
        {stages.map((stage, i) => (
          <motion.div
            key={stage.stage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className="grid grid-cols-3 gap-4 py-2 text-sm hover:bg-muted/20 rounded transition-colors"
          >
            <span className="font-medium">{stage.stage}</span>
            <span className="text-right font-mono text-muted-foreground">{stage.avgTime}s</span>
            <span className={cn(
              "text-right font-mono",
              stage.failureRate > 10 ? "text-red-400" : 
              stage.failureRate > 5 ? "text-yellow-400" : "text-green-400"
            )}>
              {stage.failureRate.toFixed(1)}%
            </span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

function RecentDeploymentsTable({ deployments }: { deployments: DeploymentRecord[] }) {
  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider">Recent Deployments</h3>
        </div>
        <Button variant="ghost" size="sm" className="text-xs">
          <Download className="w-3 h-3 mr-1" />
          Export
        </Button>
      </div>
      
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {deployments.map((deployment, i) => (
            <motion.div
              key={deployment.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/20 transition-colors border border-transparent hover:border-border/50"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                deployment.status === 'success' ? "bg-green-500/20" : "bg-red-500/20"
              )}>
                {deployment.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{deployment.serviceName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(deployment.timestamp).toLocaleString()}
                </p>
              </div>
              
              <div className="text-right shrink-0">
                <p className="text-sm font-mono">{Math.floor(deployment.duration / 60)}m {deployment.duration % 60}s</p>
                <p className="text-xs text-muted-foreground">{deployment.region}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch
    setIsLoading(true);
    const timer = setTimeout(() => {
      setAnalytics(generateMockAnalytics());
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [timeRange]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Deployment Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor your deployment performance and identify bottlenecks
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32 h-9">
                <Calendar className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="w-3.5 h-3.5 mr-2" />
              Filters
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Rocket className="w-8 h-8 text-primary" />
            </motion.div>
          </div>
        ) : analytics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Deployments"
                value={analytics.totalDeployments}
                subtitle="All time"
                icon={Rocket}
                trend={analytics.trends.volumeTrend}
                trendValue="+23%"
              />
              <StatCard
                title="Success Rate"
                value={`${analytics.successRate.toFixed(1)}%`}
                subtitle="Last 7 days"
                icon={CheckCircle2}
                variant="success"
                trend={analytics.trends.successRateTrend}
                trendValue="+5.2%"
              />
              <StatCard
                title="Avg Deploy Time"
                value={`${Math.floor(analytics.avgDeployTime / 60)}:${(analytics.avgDeployTime % 60).toString().padStart(2, '0')}`}
                subtitle="Minutes:Seconds"
                icon={Clock}
                trend={analytics.trends.deployTimeTrend}
                trendValue="-12s"
              />
              <StatCard
                title="Failed Deployments"
                value={analytics.recentDeployments.filter(d => d.status === 'failed').length}
                subtitle="This week"
                icon={XCircle}
                variant="danger"
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Deployments Over Time</h3>
                </div>
                <MiniBarChart data={analytics.deploymentsByDay} />
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-green-500/80 rounded-sm" />
                    <span>Success</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-red-500/80 rounded-sm" />
                    <span>Failed</span>
                  </div>
                </div>
              </Card>
              
              <FailurePatternCard patterns={analytics.failurePatterns} />
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <StagePerformanceTable stages={analytics.stagePerformance} />
              <RecentDeploymentsTable deployments={analytics.recentDeployments} />
            </div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
