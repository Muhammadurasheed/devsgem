import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Github, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useGitHub } from '@/hooks/useGitHub';
import { useToast } from '@/hooks/use-toast';

export const GitHubConnect = () => {
  const { isConnected, user, connect, disconnect, isLoading } = useGitHub();
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const { toast } = useToast();

  // Check for OAuth callback code on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code && !isConnected) {
      handleOAuthCallback(code);
    }
  }, []);

  const handleOAuthCallback = async (code: string) => {
    setIsAuthLoading(true);
    // Clear code from URL to clean up
    window.history.replaceState({}, document.title, window.location.pathname);

    try {
      const response = await fetch('http://localhost:8000/auth/github/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to authenticate');
      }

      // Connect using the token from backend
      await connect(data.token);
      toast({
        title: "Connected to GitHub",
        description: `Successfully logged in as ${data.user.login}`,
      });

    } catch (error) {
      console.error('OAuth Error:', error);
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : "Could not connect to GitHub"
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsAuthLoading(true);
      const response = await fetch('http://localhost:8000/auth/github/login');
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No redirect URL received");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Could not start GitHub login flow"
      });
      setIsAuthLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect from GitHub?')) {
      disconnect();
    }
  };

  if (isConnected && user) {
    return (
      <Card className="border-border/50 bg-background/50 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-12 h-12 rounded-full border-2 border-primary/20"
                />
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <CardTitle className="text-lg">{user.name}</CardTitle>
                <CardDescription>@{user.login}</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              className="gap-2"
            >
              <XCircle className="w-4 h-4" />
              Disconnect
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="border-green-500/20 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-sm">
              Connected to GitHub. You can now deploy repositories to Cloud Run.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-background/50 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Github className="w-5 h-5" />
          Connect to GitHub
        </CardTitle>
        <CardDescription>
          Connect your GitHub account to deploy repositories to Google Cloud Run
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <Alert>
            <AlertDescription className="text-sm">
              Authorize DevGem to access your repositories for deployment.
            </AlertDescription>
          </Alert>

          <Button
            className="w-full gap-2"
            size="lg"
            onClick={handleConnect}
            disabled={isAuthLoading || isLoading}
          >
            {isAuthLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Github className="w-5 h-5" />
            )}
            {isAuthLoading ? 'Connecting...' : 'Connect with GitHub'}
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-2">
            You will be redirected to GitHub to authorize the application.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
