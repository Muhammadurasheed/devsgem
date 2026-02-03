/**
 * DeploymentPreview - FAANG-Level Visual Preview Component
 * Bismillahir Rahmanir Raheem
 * 
 * Displays automated screenshots of deployed applications.
 * Inspired by Vercel's deployment preview cards.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, RefreshCw, ImageOff, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DeploymentPreviewProps {
    deploymentId: string;
    deploymentUrl?: string;
    status?: string;
    className?: string;
}

export const DeploymentPreview = ({
    deploymentId,
    deploymentUrl,
    status,
    className
}: DeploymentPreviewProps) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [error, setError] = useState(false);

    const fetchPreview = async () => {
        try {
            setIsLoading(true);
            setError(false);

            const res = await fetch(`http://localhost:8000/api/deployments/${deploymentId}/preview`);

            if (res.ok) {
                // Create blob URL for the image
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);
            } else if (res.status === 404) {
                // No preview available yet
                setPreviewUrl(null);
            } else {
                setError(true);
            }
        } catch (err) {
            console.error('Failed to fetch preview:', err);
            setError(true);
        } finally {
            setIsLoading(false);
        }
    };

    const regeneratePreview = async () => {
        if (!deploymentUrl) {
            toast.error('No deployment URL available');
            return;
        }

        try {
            setIsRegenerating(true);

            const res = await fetch(
                `http://localhost:8000/api/deployments/${deploymentId}/preview/regenerate`,
                { method: 'POST' }
            );

            if (res.ok) {
                toast.success('Preview regeneration started!');
                // Wait a bit then refresh
                setTimeout(() => {
                    fetchPreview();
                }, 5000);
            } else {
                toast.error('Failed to regenerate preview');
            }
        } catch (err) {
            toast.error('Failed to regenerate preview');
        } finally {
            setIsRegenerating(false);
        }
    };

    useEffect(() => {
        fetchPreview();

        // Cleanup blob URL on unmount
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [deploymentId]);

    return (
        <div className={cn(
            "aspect-video w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center relative group overflow-hidden",
            className
        )}>
            {isLoading ? (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-xs animate-pulse">Loading preview...</span>
                </div>
            ) : previewUrl ? (
                <>
                    <img
                        src={previewUrl}
                        alt="Deployment Preview"
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="gap-2 backdrop-blur-sm"
                            onClick={() => window.open(deploymentUrl, '_blank')}
                        >
                            <ExternalLink className="w-3.5 h-3.5" /> Visit Site
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2 backdrop-blur-sm text-white/70 hover:text-white"
                            onClick={regeneratePreview}
                            disabled={isRegenerating}
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", isRegenerating && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                    {error ? (
                        <>
                            <ImageOff className="w-12 h-12 opacity-30" />
                            <span className="text-sm opacity-60">Preview unavailable</span>
                        </>
                    ) : (
                        <>
                            <Camera className="w-12 h-12 opacity-20" />
                            <span className="text-sm opacity-60">No preview yet</span>
                            {status === 'live' && deploymentUrl && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={regeneratePreview}
                                    disabled={isRegenerating}
                                >
                                    <Camera className={cn("w-3.5 h-3.5", isRegenerating && "animate-pulse")} />
                                    {isRegenerating ? 'Generating...' : 'Generate Preview'}
                                </Button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Status indicator */}
            {status === 'live' && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-medium text-green-400 uppercase tracking-wider">Live</span>
                </div>
            )}
        </div>
    );
};
