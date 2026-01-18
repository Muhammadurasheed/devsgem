/**
 * Dashboard Layout with Sidebar Navigation
 * Used for all authenticated pages after login
 */

import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Rocket,
  BarChart3,
  Settings,
  CreditCard,
  LogOut,
  Menu,
  X,
  Sparkles,
  PieChart
} from 'lucide-react';
import { useGitHubContext } from '@/contexts/GitHubContext';
import { useState } from 'react';
import Logo from './Logo';
import { DeploymentSettings } from './DeploymentSettings';

interface DashboardLayoutProps {
  children: ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, signOut } = useAuth();
  const { user: githubUser, isConnected: isGithubConnected, disconnect: disconnectGithub } = useGitHubContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Unify user identity - prefer GitHub if connected for development context
  const displayUser = isGithubConnected && githubUser ? {
    displayName: githubUser.name || githubUser.login,
    email: githubUser.email || `@${githubUser.login}`,
    photoURL: githubUser.avatar_url
  } : authUser;

  const handleSignOut = () => {
    if (isGithubConnected) disconnectGithub();
    signOut();
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard', badge: null },
    { icon: Rocket, label: 'Deploy', path: '/deploy', badge: null },
    { icon: PieChart, label: 'Analytics', path: '/dashboard/analytics', badge: 'NEW' },
    { icon: BarChart3, label: 'Usage & Billing', path: '/dashboard/usage', badge: null },
    { icon: Settings, label: 'Settings', path: '/dashboard/settings', badge: null },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-primary/5">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="flex items-center justify-between px-4 h-16">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-accent rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <span className="text-lg font-bold gradient-text">ServerGem</span>
          </div>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`
        fixed md:sticky top-0 left-0 h-screen
        w-64 bg-background/95 backdrop-blur-xl border-r border-border/40
        flex flex-col
        transition-transform duration-300 ease-in-out z-40
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo - Desktop */}
        <div className="hidden md:flex items-center gap-2 px-6 py-4 border-b border-border/40">
          <Logo size={40} />
          <span className="text-xl font-bold gradient-text">ServerGem</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-all duration-200
                  ${active
                    ? 'bg-primary/10 text-primary font-medium shadow-sm'
                    : 'text-foreground/70 hover:text-foreground hover:bg-accent/50'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 text-xs bg-primary/20 text-primary rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Upgrade Banner - Free Tier */}
        <div className="px-4 pb-4">
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg p-4 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Upgrade to Pro</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Unlimited deployments, custom domains, and more
            </p>
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => handleNavigation('/dashboard/pricing')}
            >
              <CreditCard className="w-4 h-4" />
              View Plans
            </Button>
          </div>
        </div>

        {/* User Profile */}
        <div className="border-t border-border/40 p-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                <Avatar className="w-9 h-9">
                  <AvatarImage src={displayUser?.photoURL || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {displayUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium truncate">{displayUser?.displayName || 'Guest User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{displayUser?.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{displayUser?.displayName}</p>
                  <p className="text-xs text-muted-foreground">{displayUser?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNavigation('/dashboard/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/dashboard/pricing')}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Billing</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 md:pt-0">
        {children}
      </main>
    </div>
  );
};