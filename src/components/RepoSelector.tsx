import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Search, Star, Lock, Globe, GitBranch, ExternalLink, Loader2, RefreshCw, Rocket } from 'lucide-react';
import { useGitHub } from '@/hooks/useGitHub';
import { getTechLogo } from '@/lib/utils/logo-utils';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface RepoSelectorProps {
  onSelectRepo: (repoUrl: string, branch: string, rootDir?: string) => void;
}

export const RepoSelector = ({ onSelectRepo }: RepoSelectorProps) => {
  const { repositories, isLoading, fetchRepositories, isConnected } = useGitHub();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredRepos, setFilteredRepos] = useState(repositories);
  const [selectedRepoForConfig, setSelectedRepoForConfig] = useState<any>(null);
  const [rootDir, setRootDir] = useState('');
  const [branch, setBranch] = useState('');

  const handleDeployClick = (repo: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedRepoForConfig(repo);
    setRootDir('');
    setBranch(repo.default_branch);
  };

  const handleConfirmDeploy = () => {
    if (selectedRepoForConfig) {
      onSelectRepo(selectedRepoForConfig.clone_url, branch, rootDir);
      setSelectedRepoForConfig(null);
    }
  };

  useEffect(() => {
    if (isConnected && repositories.length === 0 && !isLoading) {
      fetchRepositories();
    }
  }, [isConnected, repositories.length, isLoading, fetchRepositories]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredRepos(repositories);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredRepos(
        repositories.filter(repo =>
          repo.name.toLowerCase().includes(query) ||
          repo.description?.toLowerCase().includes(query) ||
          repo.language?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, repositories]);

  if (!isConnected) {
    return (
      <Card className="border-border/50 bg-background/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Select Repository</CardTitle>
          <CardDescription>
            Please connect to GitHub first to see your repositories
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-background/50 backdrop-blur">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Select Repository</CardTitle>
            <CardDescription>
              Choose a repository to analyze and deploy
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRepositories}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Repository List */}
        <ScrollArea className="h-[400px] rounded-md border border-border/50">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="text-sm text-muted-foreground">Loading repositories...</p>
              </div>
            </div>
          ) : filteredRepos.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-2 p-4">
                <p className="text-sm text-muted-foreground">
                  {repositories.length === 0
                    ? 'No repositories found. Create one on GitHub first.'
                    : 'No repositories match your search.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {filteredRepos.map((repo, index) => (
                <div key={repo.id}>
                  <div
                    className="p-4 rounded-lg border border-border/50 bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                    onClick={(e) => handleDeployClick(repo, e)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {repo.full_name}
                          </h4>
                          {repo.private ? (
                            <Lock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          )}
                        </div>

                        {repo.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {repo.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 flex-wrap">
                          {repo.language && (
                            <Badge variant="secondary" className="text-xs gap-2 py-1.5 px-3 h-9 font-medium shadow-sm border-primary/5">
                              {(() => {
                                const logoPath = getTechLogo(repo.language);
                                return logoPath ? (
                                  <img src={logoPath} className="w-5 h-5 object-contain" alt={repo.language} />
                                ) : null;
                              })()}
                              {repo.language}
                            </Badge>
                          )}
                          {repo.stargazers_count > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="w-3 h-3 fill-current" />
                              {repo.stargazers_count}
                            </div>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <GitBranch className="w-3 h-3" />
                            {repo.default_branch}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(repo.html_url, '_blank');
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            handleDeployClick(repo, e);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Deploy
                        </Button>
                      </div>
                    </div>
                  </div>
                  {index < filteredRepos.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {!isLoading && filteredRepos.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            {filteredRepos.length} {filteredRepos.length === 1 ? 'repository' : 'repositories'} found
          </p>
        )}
      </CardContent>

      <Dialog open={!!selectedRepoForConfig} onOpenChange={(open) => !open && setSelectedRepoForConfig(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure Deployment</DialogTitle>
            <DialogDescription>
              Set up your deployment options for <strong>{selectedRepoForConfig?.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="branch" className="text-right">
                Branch
              </Label>
              <Input
                id="branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rootDir" className="text-right">
                Root Directory
              </Label>
              <Input
                id="rootDir"
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                placeholder="e.g. backend (Optional)"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRepoForConfig(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmDeploy}>
              <Rocket className="w-4 h-4 mr-2" />
              Deploy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
