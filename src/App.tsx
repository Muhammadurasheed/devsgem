import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import Index from "./pages/Index";
import Deploy from "./pages/Deploy";
import Dashboard from "./pages/Dashboard";
import Pricing from "./pages/Pricing";
import Usage from "./pages/Usage";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ChatWidget from "@/components/ChatWidget";
import { useState } from "react";

const queryClient = new QueryClient();

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
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleToggle = () => {
    // Auth check before opening
    const isGithubAuth = localStorage.getItem('devgem_github_token');
    const isEmailAuth = localStorage.getItem('servergem_user');
    const isGoogleAuth = localStorage.getItem('servergem_google_user');

    if (!isChatOpen && !isGithubAuth && !isEmailAuth && !isGoogleAuth) {
      window.location.href = '/auth';
      return;
    }
    setIsChatOpen(!isChatOpen);
  };

  return <ChatWidget isOpen={isChatOpen} onToggle={handleToggle} />;
};

export default App;
