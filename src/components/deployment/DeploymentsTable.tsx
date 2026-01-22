import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Shield, Rocket, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface Deployment {
    id: string;
    serviceName: string;
    url: string;
    status: 'success' | 'failed' | 'deploying';
    timestamp: string;
    secretId?: string;
}

export const DeploymentsTable = () => {
    const [deployments, setDeployments] = useState<Deployment[]>([]);

    useEffect(() => {
        // Load historical deployments from localStorage
        // In a real FAANG app, this would be an API call to Redis/PostgreSQL
        const history = JSON.parse(localStorage.getItem('devgem_deployment_history') || '[]');
        setDeployments(history);
    }, []);

    if (deployments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 bg-secondary/20 rounded-full">
                    <Rocket className="w-8 h-8 text-muted-foreground opacity-20" />
                </div>
                <div className="space-y-1">
                    <p className="text-sm font-medium">No deployments yet</p>
                    <p className="text-xs text-muted-foreground">Start by deploying a repository from the chat.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-md border border-border/50 overflow-hidden">
            <Table>
                <TableHeader className="bg-secondary/10">
                    <TableRow>
                        <TableHead className="w-[150px]">Service</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="hidden md:table-cell">Deployed</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {deployments.map((deploy) => (
                        <TableRow key={deploy.id} className="hover:bg-secondary/5 transition-colors group">
                            <TableCell className="font-medium">
                                <div className="flex flex-col">
                                    <span className="text-sm">{deploy.serviceName}</span>
                                    <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[100px]">
                                        {deploy.id}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge
                                    variant={deploy.status === 'success' ? 'default' : 'destructive'}
                                    className={`text-[10px] uppercase font-bold tracking-wider ${deploy.status === 'success' ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' : ''
                                        }`}
                                >
                                    {deploy.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <Clock className="w-3 h-3" />
                                    {new Date(deploy.timestamp).toLocaleDateString()}
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    {deploy.secretId && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-400 hover:text-purple-300" title="Security & Secrets">
                                            <Shield className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 hover:text-primary"
                                        onClick={() => window.open(deploy.url, '_blank')}
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
