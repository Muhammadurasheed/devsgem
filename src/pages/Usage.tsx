/**
 * Usage & Billing Dashboard
 * Shows current usage vs limits with upgrade prompts
 */

import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  AlertTriangle, 
  Zap,
  Activity,
  HardDrive,
  Globe,
  ArrowUpRight,
  Calendar,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUsage } from '@/hooks/useUsage';

const Usage = () => {
  const navigate = useNavigate();
  const { 
    todayUsage, 
    summary, 
    isLoading, 
    error,
    getRequestsPercentage, 
    getMemoryPercentage,
    isApproachingLimit
  } = useUsage();

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getAlertLevel = (percentage: number) => {
    if (percentage >= 90) return 'error';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading usage data...</p>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !todayUsage) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-4">{error || 'Failed to load usage data'}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const requestsPercent = getRequestsPercentage();
  const memoryPercent = getMemoryPercentage();
  const planTier = todayUsage.plan_tier;
  const limits = todayUsage.limits;
  const usage = todayUsage.usage;

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Usage & Billing</h1>
            <p className="text-muted-foreground">
              Track your resource usage and manage your plan
            </p>
          </div>
          <Badge variant="secondary" className="text-base px-4 py-2">
            {planTier.charAt(0).toUpperCase() + planTier.slice(1)} Plan
          </Badge>
        </div>

        {/* Alert Banner */}
        {isApproachingLimit() && planTier === 'free' && (
          <Card className="border-yellow-500/50 bg-yellow-500/5 mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">You're approaching your limits!</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upgrade to Pro for unlimited requests, more services, and advanced features.
                  </p>
                  <Button onClick={() => navigate('/dashboard/pricing')} className="gap-2">
                    <Zap className="w-4 h-4" />
                    Upgrade to Pro - $9/month
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Period */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Current billing period</p>
                  <p className="font-semibold">{usage.date}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => navigate('/dashboard/pricing')}>
                View Plans
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Usage Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Services */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-primary" />
                  <CardTitle>Active Services</CardTitle>
                </div>
                <Badge variant={getAlertLevel((usage.deployments / limits.max_services) * 100) === 'error' ? 'destructive' : 'secondary'}>
                  {usage.deployments} / {limits.max_services === -1 ? '∞' : limits.max_services}
                </Badge>
              </div>
              <CardDescription>
                Number of deployed services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Progress value={limits.max_services === -1 ? 0 : (usage.deployments / limits.max_services) * 100} className="h-3" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {limits.max_services === -1 ? 'Unlimited' : `${limits.max_services - usage.deployments} services remaining`}
                </span>
                <span className="font-semibold">
                  {limits.max_services === -1 ? '∞' : Math.round((usage.deployments / limits.max_services) * 100)}%
                </span>
              </div>
              {usage.deployments >= limits.max_services && limits.max_services !== -1 && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Upgrade to deploy more services
                  </p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/pricing')}>
                    Upgrade Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-green-500" />
                  <CardTitle>Requests Today</CardTitle>
                </div>
                <Badge variant={getAlertLevel(requestsPercent) === 'error' ? 'destructive' : 'secondary'}>
                  {usage.requests} / {limits.max_requests_per_day === -1 ? '∞' : limits.max_requests_per_day}
                </Badge>
              </div>
              <CardDescription>
                Daily request limit (resets midnight UTC)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Progress value={requestsPercent} className="h-3" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {limits.max_requests_per_day === -1 ? 'Unlimited' : `${limits.max_requests_per_day - usage.requests} requests remaining`}
                </span>
                <span className="font-semibold">{limits.max_requests_per_day === -1 ? '∞' : Math.round(requestsPercent)}%</span>
              </div>
              {requestsPercent >= 70 && limits.max_requests_per_day !== -1 && (
                <div className="pt-3 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Pro plan includes unlimited requests
                  </p>
                  <Button size="sm" variant="outline" onClick={() => navigate('/dashboard/pricing')}>
                    Upgrade Plan
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Memory */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <CardTitle>Memory Usage</CardTitle>
                </div>
                <Badge variant="secondary">
                  {usage.memory_used_mb}MB / {limits.max_memory_mb}MB
                </Badge>
              </div>
              <CardDescription>
                Average memory per service
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Progress value={memoryPercent} className="h-3" />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {limits.max_memory_mb - usage.memory_used_mb}MB available
                </span>
                <span className="font-semibold">{Math.round(memoryPercent)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Bandwidth */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-purple-500" />
                  <CardTitle>Bandwidth</CardTitle>
                </div>
                <Badge variant="secondary">
                  {usage.bandwidth_gb.toFixed(2)}GB
                </Badge>
              </div>
              <CardDescription>
                Data transfer usage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  This month
                </span>
                <span className="font-semibold">{usage.bandwidth_gb.toFixed(2)}GB</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Plan Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Upgrade for More Resources
            </CardTitle>
            <CardDescription>
              Compare plans and find the right fit for your needs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-semibold mb-2">Free</h4>
                <p className="text-2xl font-bold mb-1">$0</p>
                <p className="text-sm text-muted-foreground mb-4">Perfect for testing</p>
                <ul className="space-y-2 text-sm">
                  <li>• 1 service</li>
                  <li>• 100 req/day</li>
                  <li>• 512MB RAM</li>
                </ul>
              </div>
              
              <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                <Badge className="mb-2">Recommended</Badge>
                <h4 className="font-semibold mb-2">Pro</h4>
                <p className="text-2xl font-bold mb-1">$9<span className="text-sm font-normal">/mo</span></p>
                <p className="text-sm text-muted-foreground mb-4">For production apps</p>
                <ul className="space-y-2 text-sm mb-4">
                  <li>• 5 services</li>
                  <li>• Unlimited requests</li>
                  <li>• 2GB RAM</li>
                  <li>• Custom domains</li>
                </ul>
                <Button className="w-full" onClick={() => navigate('/dashboard/pricing')}>
                  Upgrade to Pro
                  <ArrowUpRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-semibold mb-2">Enterprise</h4>
                <p className="text-2xl font-bold mb-1">Custom</p>
                <p className="text-sm text-muted-foreground mb-4">For teams</p>
                <ul className="space-y-2 text-sm mb-4">
                  <li>• Unlimited services</li>
                  <li>• Dedicated resources</li>
                  <li>• 99.9% SLA</li>
                  <li>• Priority support</li>
                </ul>
                <Button variant="outline" className="w-full" onClick={() => navigate('/dashboard/pricing')}>
                  Contact Sales
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Usage;
