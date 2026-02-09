/**
 * Dashboard - My Deployments Overview
 * Shows all user's deployed services with real-time status
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Rocket,
  ExternalLink,
  Settings,
  Trash2,
  Activity,
  Zap,
  TrendingUp,
  Loader2,
  Globe,
  RefreshCw,
  Plus,
  Home,
  Clock,
  Key,
  LayoutDashboard,
  Copy, // Added
  Check // Added
} from 'lucide-react';
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
import { toast } from 'sonner';
import { useDeployments, Deployment } from '@/hooks/useDeployments';
import { BrandingIcon } from '@/components/BrandingIcon';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import { formatDistanceToNow } from 'date-fns';

const Dashboard = () => {
  const navigate = useNavigate();
  const { deployments, isLoading, error, deleteDeployment, refresh } = useDeployments();
  const { toggleChatWindow, sendMessage, onMessage } = useWebSocketContext();

  // [FAANG] Automated State Synchronization
  useEffect(() => {
    const unsubscribe = onMessage((message) => {
      // [PERFORMANCE] Refresh on deployment lifecycle events
      // 'deployment_progress' is too frequent (~100/sec) and causes flickering
      const triggerTypes = [
        'deployment_complete',
        'status_change',
        'deployment_started',
        'deployment_update'  // [FAANG] Real-time Sync: Auto-populate URL when it's assigned
      ];

      if (triggerTypes.includes(message.type)) {
        console.log('[Dashboard] 🔄 Refreshing deployments due to:', message.type);
        refresh();
      }
    });

    return () => unsubscribe();
  }, [onMessage, refresh]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'live': return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]';
      case 'deploying':
      case 'building':
      case 'starting':
      case 'pending': return 'bg-yellow-500 animate-pulse shadow-[0_0_10px_rgba(234,179,8,0.3)]';
      case 'error':
      case 'failed': return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]';
      case 'stopped': return 'bg-zinc-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'live': return 'Live';
      case 'deploying': return 'Deploying';
      case 'building': return 'Building';
      case 'starting':
      case 'pending': return 'Deploying...';
      case 'error':
      case 'failed': return 'Failed';
      case 'stopped': return 'Stopped';
      default: return status.charAt(0).toUpperCase() + status.slice(1) || 'Unknown';
    }
  };

  const handleRedeploy = async (deploymentId: string, name: string) => {
    toast.info(`Initiating redeployment for ${name}...`);
    toggleChatWindow(true);
    // Add small delay to allow chat window to mount/animate
    setTimeout(() => {
      sendMessage({
        type: 'message',
        message: `Redeploy service: ${name} (ID: ${deploymentId})`,
        context: {
          action: 'redeploy',
          deploymentId,
          serviceName: name
        }
      });
    }, 500);
  };

  const handleSync = async (deploymentId: string, name: string, repoUrl: string) => {
    toast.info(`Syncing ${name} with GitHub & Updating...`);
    toggleChatWindow(true);
    setTimeout(() => {
      sendMessage({
        type: 'message',
        message: `Sync & Update: ${name}`,
        metadata: {
          type: 'sync_deploy',
          deploymentId,
          serviceName: name,
          repoUrl
        }
      });
    }, 500);
  };

  const handleDelete = async (deploymentId: string, name: string) => {
    if (confirm(`Delete ${name}? This cannot be undone.`)) {
      try {
        await deleteDeployment(deploymentId);
      } catch (err) {
        // Error already shown by hook
      }
    }
  };


  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return dateString;
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyUrl = async (e: React.MouseEvent, url: string, id: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast.success('URL copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Failed to copy URL');
    }
  };

  if (error) {
    return (
      <DashboardLayout>
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Back Navigation */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Button>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Deployments</h1>
            <p className="text-muted-foreground">
              Manage your DevGem deployments
            </p>
          </div>
          <Button onClick={() => navigate('/deploy')} className="gap-2" size="lg">
            <Plus className="w-5 h-5" />
            Deploy New App
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Services</p>
                  <p className="text-2xl font-bold">{deployments.filter(d => d.status === 'live').length}</p>
                </div>
                <Rocket className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Requests Today</p>
                  <p className="text-2xl font-bold">
                    {deployments.reduce((sum, d) => sum + d.request_count, 0)}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Uptime</p>
                  <p className="text-2xl font-bold">99.9%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">$0.00</p>
                </div>
                <Zap className="w-8 h-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Deployments List */}
        {isLoading ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading deployments...</p>
            </div>
          </Card>
        ) : deployments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Rocket className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No deployments yet</h3>
              <p className="text-muted-foreground mb-6 text-center max-w-md">
                Deploy your first app to DevGem in just 3 minutes. No Google Cloud setup required!
              </p>
              <Button onClick={() => navigate('/deploy')} className="gap-2" size="lg">
                <Rocket className="w-5 h-5" />
                Deploy Your First App
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {deployments.map((deployment) => (
              <Card key={deployment.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(deployment.status)}`} />
                        <div className="flex items-center gap-3">
                          <BrandingIcon
                            deployment={deployment}
                            className="w-8 h-8 rounded-lg shadow-xl shadow-primary/10 border border-white/10 p-0.5 bg-zinc-900"
                          />
                          <CardTitle
                            className="text-xl cursor-pointer hover:text-primary transition-colors font-bold tracking-tight"
                            onClick={() => navigate(`/dashboard/deployments/${deployment.id}`)}
                          >
                            {deployment.service_name}
                          </CardTitle>
                        </div>
                      </div>
                      <CardDescription className="flex items-center gap-2 ml-11">
                        <div className="flex items-center gap-2 group/url">
                          <a
                            href={deployment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm truncate"
                          >
                            {deployment.url.replace('https://', '')}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover/url:opacity-100 transition-opacity"
                            onClick={(e) => handleCopyUrl(e, deployment.url, deployment.id)}
                          >
                            {copiedId === deployment.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                        <ExternalLink className="w-3 h-3" />
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(deployment.url, '_blank')}
                        disabled={deployment.status !== 'live'}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(deployment.id, deployment.service_name, deployment.repo_url)}
                        disabled={deployment.status === 'deploying'}
                        title="Sync with Git & Redeploy"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRedeploy(deployment.id, deployment.service_name)}
                        disabled={deployment.status === 'deploying'}
                        title="Redeploy (Cached)"
                      >
                        <Rocket className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/dashboard/env-manager/${deployment.id}`)}
                        title="Environment Variables"
                      >
                        <Key className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/dashboard/monitor/${deployment.id}`)}
                        title="Real-time Metrics"
                      >
                        <Activity className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/dashboard/settings`)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            title="Delete Project"
                          >
                            <Trash2 className="w-4 h-4" />
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
                              onClick={() => deleteDeployment(deployment.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Project
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/dashboard/deployments/${deployment.id}`)}
                        className="text-primary hover:text-primary"
                        title="View Details"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <p className="text-sm font-medium">{getStatusLabel(deployment.status)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Deployed</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {deployment.status.toLowerCase() === 'live'
                          ? formatDate(deployment.updated_at)
                          : (
                            <span className="text-yellow-500 flex items-center gap-1 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Deploying...
                            </span>
                          )
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Requests</p>
                      <p className="text-sm font-medium">{deployment.request_count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Memory</p>
                      <p className="text-sm font-medium">{deployment.memory}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout >
  );
};

export default Dashboard;
