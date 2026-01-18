/**
 * Protected Route Component
 * Redirects unauthenticated users to auth page
 * Supports both email/password auth AND GitHub/Google OAuth
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useGitHub } from '@/hooks/useGitHub';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/Logo';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated: isEmailAuthenticated, loading: emailLoading } = useAuth();
  const { isConnected: isGitHubConnected, isLoading: githubLoading } = useGitHub();

  // Check for Google auth from localStorage (set during OAuth callback)
  const googleUser = localStorage.getItem('servergem_google_user');
  const isGoogleAuthenticated = !!googleUser;

  const isLoading = emailLoading || githubLoading;
  const isAuthenticated = isEmailAuthenticated || isGitHubConnected || isGoogleAuthenticated;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
            <Logo size={64} />
          </div>
          <div className="space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
            <p className="text-sm text-gray-400 font-medium">Verifying authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};
