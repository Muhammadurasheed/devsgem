/**
 * AutoDeployToggle - FAANG-Level CI/CD Control
 * Bismillahir Rahmanir Raheem
 * 
 * Provides a beautiful toggle for enabling/disabling auto-deploy on a deployment.
 * Shows real-time status of the smart polling system.
 */

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GitBranch, RefreshCw, Clock, Zap, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface AutoDeployToggleProps {
    deploymentId: string;
    repoUrl?: string;
    className?: string;
}

interface AutoDeployStatus {
    enabled: boolean;
    watch_id?: string;
    repo_url?: string;
    branch?: string;
    last_commit_sha?: string;
    last_checked?: string;
    check_interval_seconds?: number;
}

export const AutoDeployToggle = ({ deploymentId, repoUrl, className }: AutoDeployToggleProps) => {
    const [status, setStatus] = useState<AutoDeployStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isToggling, setIsToggling] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/auto-deploy/status`);
            if (res.ok) {
                setStatus(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch auto-deploy status:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleAutoDeploy = async () => {
        setIsToggling(true);
        try {
            const endpoint = status?.enabled
                ? `http://localhost:8000/api/deployments/${deploymentId}/auto-deploy/disable`
                : `http://localhost:8000/api/deployments/${deploymentId}/auto-deploy/enable`;

            const res = await fetch(endpoint, { method: 'POST' });

            if (res.ok) {
                const data = await res.json();
                toast.success(data.message);
                await fetchStatus();
            } else {
                toast.error('Failed to toggle auto-deploy');
            }
        } catch (err) {
            toast.error('Failed to toggle auto-deploy');
        } finally {
            setIsToggling(false);
        }
    };

    const checkNow = async () => {
        setIsChecking(true);
        try {
            const res = await fetch(
                `http://localhost:8000/api/deployments/${deploymentId}/auto-deploy/check-now`,
                { method: 'POST' }
            );

            if (res.ok) {
                const data = await res.json();
                if (data.has_changes) {
                    toast.success(`Changes detected! Commit: ${data.commit_message}`);
                } else if (data.error) {
                    toast.error(data.error);
                } else {
                    toast.info('No changes detected');
                }
                await fetchStatus();
            } else {
                toast.error('Check failed');
            }
        } catch (err) {
            toast.error('Failed to check for updates');
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        // Refresh status every 30 seconds
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }, [deploymentId]);

    if (isLoading) {
        return (
            <Card className={cn("animate-pulse", className)}>
                <CardContent className="p-4">
                    <div className="h-6 bg-muted rounded w-1/3" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-lg",
                            status?.enabled ? "bg-green-500/10" : "bg-muted"
                        )}>
                            <Zap className={cn(
                                "w-4 h-4",
                                status?.enabled ? "text-green-500" : "text-muted-foreground"
                            )} />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-medium">Auto-Deploy</CardTitle>
                            <CardDescription className="text-xs">
                                {status?.enabled
                                    ? "Watching for changes"
                                    : "Push to deploy automatically"
                                }
                            </CardDescription>
                        </div>
                    </div>

                    <Switch
                        checked={status?.enabled || false}
                        onCheckedChange={toggleAutoDeploy}
                        disabled={isToggling}
                    />
                </div>
            </CardHeader>

            {status?.enabled && (
                <CardContent className="pt-0 pb-4">
                    <div className="space-y-3">
                        {/* Branch Info */}
                        <div className="flex items-center gap-2 text-xs">
                            <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Branch:</span>
                            <Badge variant="secondary" className="text-[10px] h-5">
                                {status.branch || 'main'}
                            </Badge>
                        </div>

                        {/* Last Checked */}
                        {status.last_checked && (
                            <div className="flex items-center gap-2 text-xs">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Last checked:</span>
                                <span className="text-foreground">
                                    {formatDistanceToNow(new Date(status.last_checked))} ago
                                </span>
                            </div>
                        )}

                        {/* Commit SHA */}
                        {status.last_commit_sha && (
                            <div className="flex items-center gap-2 text-xs">
                                <Check className="w-3.5 h-3.5 text-green-500" />
                                <span className="text-muted-foreground">Commit:</span>
                                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                    {status.last_commit_sha.substring(0, 7)}
                                </code>
                            </div>
                        )}

                        {/* Check Now Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 h-8 text-xs gap-2"
                            onClick={checkNow}
                            disabled={isChecking}
                        >
                            <RefreshCw className={cn("w-3 h-3", isChecking && "animate-spin")} />
                            {isChecking ? 'Checking...' : 'Check for Updates Now'}
                        </Button>
                    </div>
                </CardContent>
            )}
        </Card>
    );
};
