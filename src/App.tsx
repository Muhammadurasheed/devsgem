import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WebSocketProvider, useWebSocketContext } from "@/contexts/WebSocketContext";
import Index from "./pages/Index";
import Deploy from "./pages/Deploy";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import Usage from "./pages/Usage";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import EnvManager from "./pages/EnvManager";
import Monitor from "./pages/Monitor";
import DeploymentDetails from "./pages/DeploymentDetails";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ChatWidget from "@/components/ChatWidget";
import { useState } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes (FAANG Standard: Cache heavily, push updates via Socket)
      gcTime: 1000 * 60 * 30,    // 30 minutes
      refetchOnWindowFocus: false, // Prevent "flicker" when user switches back to DevGem
      retry: 1,
    },
  },
});

import { GitHubProvider } from "@/contexts/GitHubContext";

import { GlobalStickyTimer } from "@/components/GlobalStickyTimer";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WebSocketProvider>
      <GitHubProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <GlobalStickyTimer />
          <BrowserRouter>
            <ChatWidgetWrapper />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />

              {/* Protected Dashboard Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/usage"
                element={
                  <ProtectedRoute>
                    <Usage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/pricing"
                element={
                  <ProtectedRoute>
                    <Pricing />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deploy"
                element={
                  <ProtectedRoute>
                    <Deploy />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/env-manager/:deploymentId"
                element={
                  <ProtectedRoute>
                    <EnvManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/monitor/:deploymentId"
                element={
                  <ProtectedRoute>
                    <Monitor />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/deployments/:deploymentId"
                element={
                  <ProtectedRoute>
                    <DeploymentDetails />
                  </ProtectedRoute>
                }
              />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </GitHubProvider>
    </WebSocketProvider>
  </QueryClientProvider>
);

const ChatWidgetWrapper = () => {
  const { isChatWindowOpen, toggleChatWindow } = useWebSocketContext();

  const handleToggle = () => {
    // Auth check before opening
    const isGithubAuth = localStorage.getItem('devgem_github_token');
    const isEmailAuth = localStorage.getItem('servergem_user');
    const isGoogleAuth = localStorage.getItem('servergem_google_user');

    if (!isChatWindowOpen && !isGithubAuth && !isEmailAuth && !isGoogleAuth) {
      window.location.href = '/auth';
      return;
    }
    toggleChatWindow();
  };

  return <ChatWidget isOpen={isChatWindowOpen} onToggle={handleToggle} />;
};

export default App;
