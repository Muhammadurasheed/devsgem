import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Menu, X, User as UserIcon, Rocket } from "lucide-react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGitHubContext } from '@/contexts/GitHubContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Logo from "@/components/Logo";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, signOut, isAuthenticated: isAuthAuthenticated } = useAuth();
  const { user: githubUser, isConnected: isGithubConnected, disconnect: disconnectGithub } = useGitHubContext();
  const isHomePage = location.pathname === '/';

  // Unify user identity & auth state
  const isAuthenticated = isAuthAuthenticated || isGithubConnected;
  const displayUser = isGithubConnected && githubUser ? {
    displayName: githubUser.name || githubUser.login,
    email: githubUser.email || `@${githubUser.login}`,
    photoURL: githubUser.avatar_url
  } : authUser;

  const handleSignOut = () => {
    if (isGithubConnected) disconnectGithub();
    signOut();
  };

  const scrollToSection = (id: string) => {
    if (!isHomePage) {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border/40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <Logo size={40} />
            <span className="text-xl font-bold gradient-text">DevGem</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={() => scrollToSection('features')}
              className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('architecture')}
              className="px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all duration-200"
            >
              Architecture
            </button>
            <div className="ml-2 pl-2 border-l border-border/50 flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={displayUser?.photoURL || undefined} />
                          <AvatarFallback className="text-xs">
                            {displayUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden lg:inline">{displayUser?.displayName}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium">{displayUser?.displayName}</p>
                          <p className="text-xs text-muted-foreground">{displayUser?.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                        <Rocket className="mr-2 h-4 w-4" />
                        <span>Dashboard</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/deploy')}>
                        <Rocket className="mr-2 h-4 w-4" />
                        <span>Deploy</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Sign Out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <Button variant="default" size="sm" onClick={() => navigate('/auth')} className="gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 space-y-2 border-t border-border/40 bg-background/95 backdrop-blur-xl animate-fade-in">
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left px-4 py-3 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left px-4 py-3 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all"
            >
              How It Works
            </button>
            <button
              onClick={() => scrollToSection('architecture')}
              className="block w-full text-left px-4 py-3 text-sm font-medium text-foreground/70 hover:text-foreground hover:bg-accent/50 rounded-lg transition-all"
            >
              Architecture
            </button>
            <div className="px-4 pt-4 border-t border-border/40 space-y-2">
              {isAuthenticated ? (
                <>
                  <div className="p-3 bg-accent/50 rounded-lg mb-2">
                    <p className="text-sm font-medium">{displayUser?.displayName || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{displayUser?.email}</p>
                  </div>
                  <Button variant="default" className="w-full gap-2" onClick={() => { navigate('/dashboard'); setIsOpen(false); }}>
                    <Rocket className="h-4 w-4" />
                    Dashboard
                  </Button>
                  <Button variant="outline" className="w-full gap-2" onClick={() => { signOut(); setIsOpen(false); }}>
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button variant="default" className="w-full gap-2" onClick={() => { navigate('/auth'); setIsOpen(false); }}>
                  <LogIn className="h-4 w-4" />
                  Sign In
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
