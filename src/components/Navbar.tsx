import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Menu, X, User as UserIcon, Rocket, Zap } from "lucide-react";
import { useState, useEffect } from "react";
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
import { motion, useScroll, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser, signOut, isAuthenticated: isAuthAuthenticated } = useAuth();
  const { user: githubUser, isConnected: isGithubConnected, disconnect: disconnectGithub } = useGitHubContext();
  const isHomePage = location.pathname === '/';

  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
      scrolled ? "bg-black/60 backdrop-blur-3xl border-b border-white/5 py-2" : "bg-transparent py-4"
    )}>
      {/* [GOOGLE] High-perf Scroll Progress */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 origin-left z-50"
        style={{ scaleX }}
      />

      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
              <Logo size={36} className="relative z-10" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white">DevGem</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-6">
              {['features', 'how-it-works', 'architecture'].map((id) => (
                <button
                  key={id}
                  onClick={() => scrollToSection(id)}
                  className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors"
                >
                  {id.replace('-', ' ')}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 pl-6 border-l border-white/5">
              {isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-2 outline-none group">
                      <Avatar className="w-8 h-8 border border-white/10 group-hover:border-cyan-500/50 transition-colors">
                        <AvatarImage src={displayUser?.photoURL || undefined} />
                        <AvatarFallback className="bg-zinc-900 text-white text-[10px] font-bold">
                          {displayUser?.displayName?.charAt(0).toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-zinc-950 border-white/10 text-white">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-bold">{displayUser?.displayName}</p>
                        <p className="text-[10px] text-zinc-500 font-mono italic">{displayUser?.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={() => navigate('/dashboard')} className="hover:bg-white/5 cursor-pointer">
                      <Rocket className="mr-2 h-4 w-4 text-cyan-500" />
                      <span className="font-bold">Dashboard</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/deploy')} className="hover:bg-white/5 cursor-pointer">
                      <Zap className="mr-2 h-4 w-4 text-purple-500" />
                      <span className="font-bold">Launch New</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/5" />
                    <DropdownMenuItem onClick={handleSignOut} className="text-red-400 hover:bg-red-500/10 cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span className="font-bold">Sign Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className="bg-white text-black hover:bg-zinc-200 font-black text-[10px] uppercase tracking-widest px-6"
                >
                  Sign In
                </Button>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        <motion.div
          initial={false}
          animate={isOpen ? { height: 'auto', opacity: 1 } : { height: 0, opacity: 0 }}
          className="md:hidden overflow-hidden bg-black/95 backdrop-blur-2xl px-6"
        >
          <div className="py-8 space-y-6">
            {['features', 'how-it-works', 'architecture'].map((id) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="block w-full text-left text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 hover:text-white"
              >
                {id.replace('-', ' ')}
              </button>
            ))}

            <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
              {isAuthenticated ? (
                <Button className="w-full bg-cyan-500 hover:bg-cyan-600 font-bold" onClick={() => navigate('/dashboard')}>
                  Dashboard
                </Button>
              ) : (
                <Button className="w-full bg-white text-black font-bold" onClick={() => navigate('/auth')}>
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </nav>
  );
};

export default Navbar;
