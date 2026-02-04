import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useGitHub } from '@/hooks/useGitHub';
import { toast } from 'sonner';
import { ApiKeySettings } from '@/components/ApiKeySettings';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Github,
  Bell,
  Shield,
  Trash2,
  LogOut,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Rocket,
  Globe,
  Lock,
  Zap,
  Cpu,
  Database,
  ChevronRight,
  Settings as SettingsIcon,
  CreditCard,
  Code2,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Personal identity and account' },
  { id: 'github', label: 'GitHub', icon: Github, description: 'Source code integration' },
  { id: 'deployment', label: 'Deployment', icon: Rocket, description: 'Global build & naming logic' },
  { id: 'api', label: 'AI Engine', icon: Cpu, description: 'Gemini Brain configuration' },
  { id: 'security', label: 'Security', icon: Lock, description: 'Access and authentication' },
  { id: 'billing', label: 'Billing', icon: CreditCard, description: 'Usage and quotas' },
  { id: 'danger', label: 'Danger Zone', icon: Trash2, description: 'Irreversible account actions' },
];

const Settings = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const { user, signOut } = useAuth();
  const { isConnected: isGitHubConnected, user: githubUser, disconnect: disconnectGitHub } = useGitHub();
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-12 pt-8">
          {/* Settings Sidebar - Apple Style */}
          <div className="w-full md:w-64 space-y-8">
            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold tracking-tight px-2">Settings</h1>
              <p className="text-xs text-muted-foreground px-2 font-medium uppercase tracking-widest">Global Configuration</p>
            </div>

            <nav className="space-y-1">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                    activeSection === section.id
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <section.icon className={cn(
                    "w-4 h-4 transition-transform group-hover:scale-110",
                    activeSection === section.id ? "text-white" : "text-muted-foreground"
                  )} />
                  {section.label}
                  {activeSection === section.id && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute right-2 w-1.5 h-1.5 rounded-full bg-primary-foreground/50"
                    />
                  )}
                </button>
              ))}
            </nav>

            <div className="pt-8 px-2 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="w-full rounded-xl gap-2 border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 hover:text-red-500 transition-all font-bold"
              >
                <LogOut className="w-4 h-4" />
                Definitively Sign Out
              </Button>
            </div>
          </div>

          {/* Main Content Pane */}
          <div className="flex-1 min-w-0 pb-20">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-8"
              >
                {/* Section Header */}
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {SECTIONS.find(s => s.id === activeSection)?.label}
                  </h2>
                  <p className="text-sm text-muted-foreground font-medium">
                    {SECTIONS.find(s => s.id === activeSection)?.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {activeSection === 'profile' && <ProfileSection user={user} />}
                  {activeSection === 'github' && <GitHubSection isConnected={isGitHubConnected} githubUser={githubUser} onDisconnect={disconnectGitHub} />}
                  {activeSection === 'deployment' && <DeploymentConfigSection />}
                  {activeSection === 'api' && <ApiKeySettings />}
                  {activeSection === 'security' && <SecuritySection />}
                  {activeSection === 'billing' && <BillingSection />}
                  {activeSection === 'danger' && <DangerSection onSignOut={signOut} />}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

const ProfileSection = ({ user }: { user: any }) => {
  const [displayName, setDisplayName] = useState(user?.displayName || '');

  return (
    <Card className="border-border/40 bg-card/40 backdrop-blur-md rounded-[1.5rem] shadow-xl overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/40 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl border border-primary/20 shadow-inner">
            {displayName[0]?.toUpperCase() || 'U'}
          </div>
          <div className="space-y-1">
            <CardTitle className="text-xl">Public Profile</CardTitle>
            <CardDescription className="text-xs">Your identity across the DevGem ecosystem</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="display-name" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">Visible Name</Label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            className="rounded-xl bg-background/50 border-border/40 focus:ring-primary/20 transition-all h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">Auth Entity (Read-only)</Label>
          <Input
            id="email"
            type="email"
            defaultValue={user?.email || ''}
            disabled
            className="rounded-xl bg-muted/20 border-border/40 h-11 opacity-60 cursor-not-allowed font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 ml-1">
            <Lock className="w-3 h-3" />
            Immutable for security. Contact infrastructure for revisions.
          </p>
        </div>
        <div className="pt-2">
          <Button onClick={() => toast.success('Profile updated!')} className="rounded-xl px-8 h-11 font-bold shadow-lg shadow-primary/20 bg-primary hover:scale-[1.02] active:scale-95 transition-all">
            Commit Changes
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const GitHubSection = ({ isConnected, githubUser, onDisconnect }: any) => {
  return (
    <Card className="border-border/40 bg-card/40 backdrop-blur-md rounded-[1.5rem] shadow-xl overflow-hidden">
      <CardContent className="p-0">
        <div className="p-8 flex items-center justify-between border-b border-border/40">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-[#24292f]/10 dark:bg-[#24292f]/50 border border-[#24292f]/20">
              <Github className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Source Control Engine</h3>
              <p className="text-xs text-muted-foreground font-medium">Automatic repository synchronization and analysis</p>
            </div>
          </div>
          <Badge variant={isConnected ? "success" : "secondary"} className="rounded-full px-3 py-1 font-bold tracking-tighter uppercase text-[10px]">
            {isConnected ? 'operational' : 'offline'}
          </Badge>
        </div>

        <div className="p-8">
          {isConnected && githubUser ? (
            <div className="flex items-center justify-between p-6 rounded-2xl border border-border/40 bg-accent/20 group hover:border-primary/20 transition-all shadow-sm">
              <div className="flex items-center gap-4">
                <img
                  src={githubUser.avatar_url}
                  alt={githubUser.name}
                  className="w-14 h-14 rounded-2xl shadow-lg ring-2 ring-background border border-border/20 group-hover:scale-105 transition-transform"
                />
                <div className="space-y-0.5">
                  <p className="font-bold text-lg">{githubUser.name}</p>
                  <p className="text-sm text-muted-foreground font-mono">@{githubUser.login}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                className="rounded-xl border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-all px-4 font-bold"
              >
                Sever Connection
              </Button>
            </div>
          ) : (
            <div className="text-center py-8 space-y-6">
              <div className="mx-auto w-16 h-16 rounded-full bg-accent/30 flex items-center justify-center">
                <Github className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-xl">Connect your GitHub Identity</h4>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  DevGem requires source control access to analyze architectures and initiate global deployments.
                </p>
              </div>
              <Button className="rounded-full px-10 h-12 font-bold bg-[#24292f] hover:bg-[#24292f]/90 text-white shadow-xl shadow-[#24292f]/20">
                Connect GitHub
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const DeploymentConfigSection = () => {
  const [autoNaming, setAutoNaming] = useState(() => localStorage.getItem('devgem_param_auto_naming') !== 'false');
  const [customName, setCustomName] = useState(() => localStorage.getItem('devgem_param_custom_name') || '');

  const handleToggleAutoNaming = (checked: boolean) => {
    setAutoNaming(checked);
    localStorage.setItem('devgem_param_auto_naming', String(checked));
    toast.info(`Naming strategy set to ${checked ? 'Autonomous' : 'Manual'}`);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/40 backdrop-blur-md rounded-[1.5rem] shadow-xl overflow-hidden hover:border-primary/20 transition-all">
        <CardHeader className="bg-primary/5 pb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Naming Intelligence</CardTitle>
          </div>
          <CardDescription className="text-xs">How DevGem defines your service identity across Google Cloud.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 space-y-8">
          <div className="flex items-center justify-between p-6 rounded-2xl border border-primary/10 bg-primary/5 group">
            <div className="space-y-1.5 pr-8">
              <h4 className="text-sm font-bold flex items-center gap-2">
                Predictive Naming Strategy
                <Badge className="bg-primary/20 text-primary border-none text-[8px] h-4">SMART</Badge>
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed font-normal">
                Gemini Brain will synthesize a unique, human-readable identity based on your code signature.
                (e.g., <code className="text-primary/80 font-bold bg-primary/10 px-1 rounded">quantum-nexus-v1</code>)
              </p>
            </div>
            <Switch
              checked={autoNaming}
              onCheckedChange={handleToggleAutoNaming}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          <AnimatePresence>
            {!autoNaming && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                className="space-y-4 pt-2 overflow-hidden"
              >
                <div className="space-y-3">
                  <Label htmlFor="custom-service-name" className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground ml-1">Manual Identity Override</Label>
                  <div className="relative group/input">
                    <Input
                      id="custom-service-name"
                      value={customName}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-');
                        setCustomName(val);
                        localStorage.setItem('devgem_param_custom_name', val);
                      }}
                      placeholder="e.g. production-gateway-01"
                      className="rounded-xl bg-background/50 border-border/40 h-12 font-mono text-sm focus:ring-primary/20 pl-4 pr-12"
                    />
                    <Code2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within/input:text-primary transition-colors" />
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 flex items-start gap-2 ml-1 leading-normal italic">
                    <AlertTriangle className="w-3 h-3 text-yellow-500 shrink-0 mt-0.5" />
                    Warning: Manual overrides may conflict with existing global resources. DevGem will attempt automated reconciliation if collisions occur.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 bg-card/40 backdrop-blur-md border-border/40 rounded-2xl hover:border-primary/20 transition-all cursor-not-allowed opacity-60 grayscale group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
              <Globe className="w-5 h-5 text-blue-400" />
            </div>
            <Badge variant="outline" className="text-[8px] font-bold tracking-widest">ADVANCED</Badge>
          </div>
          <h4 className="font-bold text-sm mb-1">Regional Optimization</h4>
          <p className="text-[10px] text-muted-foreground">Select optimal data center locations based on latency telemetry.</p>
        </Card>

        <Card className="p-6 bg-card/40 backdrop-blur-md border-border/40 rounded-2xl hover:border-primary/20 transition-all cursor-not-allowed opacity-60 grayscale group">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <Badge variant="outline" className="text-[8px] font-bold tracking-widest">PREMIUM</Badge>
          </div>
          <h4 className="font-bold text-sm mb-1">Persistent Storage</h4>
          <p className="text-[10px] text-muted-foreground">Attach GCS buckets or Cloud SQL clusters to automatically provisioned environments.</p>
        </Card>
      </div>
    </div>
  );
};

const SecuritySection = () => {
  return (
    <Card className="border-border/40 bg-card/40 backdrop-blur-md rounded-[1.5rem] shadow-xl overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Access Governance</CardTitle>
        </div>
        <CardDescription className="text-xs">Advanced security protocols for your engineering session.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/40">
          <div className="space-y-0.5">
            <p className="text-sm font-bold">Encrypted Session Tokens</p>
            <p className="text-[10px] text-muted-foreground">Rotate encryption keys for your current session.</p>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl text-xs h-9 px-4 font-bold border-primary/20 text-primary hover:bg-primary/5 transition-all">
            Initiate Rotation
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-background/40">
          <div className="space-y-0.5">
            <p className="text-sm font-bold">Two-Factor Authentication</p>
            <p className="text-[10px] text-muted-foreground">Enforced via your primary identity provider.</p>
          </div>
          <Badge className="bg-green-500/10 text-green-500 border-none font-bold text-[10px]">VERIFIED</Badge>
        </div>
      </CardContent>
    </Card>
  );
};

const BillingSection = () => {
  return (
    <Card className="border-border/40 bg-card/40 backdrop-blur-md rounded-[1.5rem] shadow-xl overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-indigo-400" />
          <CardTitle className="text-lg">Resource Exhaustion Metrics</CardTitle>
        </div>
        <CardDescription className="text-xs">Real-time usage analysis of your current tier footprint.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 pt-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Core Computing Hours</span>
            <span className="text-foreground">12.4 / 100</span>
          </div>
          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '12.4%' }}
              className="h-full bg-indigo-500 rounded-full"
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Build Pipeline Parallelism</span>
            <span className="text-foreground">2 / 5</span>
          </div>
          <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '40%' }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 text-center space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Infrastructure Tier: <span className="text-indigo-400 font-bold">SOVEREIGN PRO</span></p>
          <Button className="w-full rounded-full bg-indigo-500 hover:bg-indigo-600 shadow-lg shadow-indigo-500/20 font-bold h-11 text-sm">
            Scale Infrastructure Capacity
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const DangerSection = ({ onSignOut }: { onSignOut: () => void }) => {
  return (
    <div className="space-y-6">
      <Card className="border-red-500/30 bg-red-500/5 backdrop-blur-md rounded-[1.5rem] shadow-xl overflow-hidden">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <CardTitle className="text-lg text-red-500">Atomic Deletions</CardTitle>
          </div>
          <CardDescription className="text-xs">These actions cannot be rolled back. Execute with extreme caution.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex items-center justify-between p-5 rounded-2xl border border-red-500/20 bg-background/40">
            <div className="space-y-1">
              <p className="text-sm font-bold">Exterminate Account</p>
              <p className="text-xs text-muted-foreground">Permanently purge all data, deployments, and metadata.</p>
            </div>
            <Button variant="destructive" className="rounded-xl px-6 font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-all">
              Initiate Purge
            </Button>
          </div>

          <div className="flex items-center justify-between p-5 rounded-2xl border border-border/40 bg-background/40">
            <div className="space-y-1">
              <p className="text-sm font-bold">Wipe Global Cache</p>
              <p className="text-xs text-muted-foreground">Invalidate all CDN edges and local build artifacts.</p>
            </div>
            <Button variant="outline" className="rounded-xl px-6 font-bold border-red-500/20 text-red-400 hover:bg-red-500/5 transition-all">
              Execute Wipe
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Session Instance ID: <span className="font-mono opacity-60">DG-{Math.random().toString(36).substr(2, 9).toUpperCase()}</span></p>
        <Button variant="ghost" size="sm" onClick={onSignOut} className="text-xs font-bold text-muted-foreground hover:text-foreground">
          Sign Out
        </Button>
      </div>
    </div>
  );
};


export default Settings;
