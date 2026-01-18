/**
 * DevGem Authentication
 * "FAANG-level" premium design with GitHub OAuth and Google Sign-In.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGitHub } from "@/hooks/useGitHub";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2,
    Github,
    Mail,
    ArrowRight,
    ShieldCheck,
    Zap,
    Cpu,
    Globe,
    Star,
} from "lucide-react";
import Logo from "@/components/Logo";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Google Icon component (inline SVG for crisp rendering)
const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
        <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
    </svg>
);

const Auth = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { signIn, signUp, loading: authLoading } = useAuth();
    const {
        initiateOAuth,
        handleOAuthCallback,
        isLoading: githubLoading,
        isConnected,
        user: githubUser,
    } = useGitHub();

    const [mode, setMode] = useState<"initial" | "email">("initial");
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
    const [oauthProvider, setOauthProvider] = useState<"github" | "google" | null>(null);

    // Handle Google OAuth callback
    const handleGoogleOAuthCallback = useCallback(async (code: string): Promise<boolean> => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Google OAuth callback failed');
            }

            const data = await response.json();

            // Store user info (simplified - you may want to integrate with your auth service)
            localStorage.setItem('servergem_google_token', data.token);
            localStorage.setItem('servergem_google_user', JSON.stringify(data.user));

            toast.success(`Welcome, ${data.user.name}!`);
            return true;
        } catch (error) {
            console.error('Google OAuth callback error:', error);
            toast.error('Google authentication failed. Please try again.');
            return false;
        }
    }, []);

    // Handle OAuth callback from GitHub or Google
    useEffect(() => {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (code && !isProcessingOAuth) {
            setIsProcessingOAuth(true);

            // Determine which provider based on stored state or URL pattern
            // For now, we'll check if there's a pending Google auth
            const pendingGoogleAuth = sessionStorage.getItem('pending_google_auth');

            const processCallback = async () => {
                let success = false;

                if (pendingGoogleAuth) {
                    sessionStorage.removeItem('pending_google_auth');
                    setOauthProvider("google");
                    success = await handleGoogleOAuthCallback(code);
                } else {
                    setOauthProvider("github");
                    success = await handleOAuthCallback(code);
                }

                // Clear the URL params
                window.history.replaceState({}, "", "/auth");

                if (success) {
                    navigate("/deploy");
                }

                setIsProcessingOAuth(false);
                setOauthProvider(null);
            };

            processCallback();
        }
    }, [searchParams, handleOAuthCallback, handleGoogleOAuthCallback, navigate, isProcessingOAuth]);

    // Redirect if already connected
    useEffect(() => {
        if (isConnected && githubUser && !isProcessingOAuth) {
            navigate("/deploy");
        }
    }, [isConnected, githubUser, navigate, isProcessingOAuth]);

    const handleGitHubAuth = async () => {
        setOauthProvider("github");
        await initiateOAuth();
    };

    const handleGoogleAuth = async () => {
        setOauthProvider("google");
        try {
            // Mark that we're doing Google auth (for callback detection)
            sessionStorage.setItem('pending_google_auth', 'true');

            const response = await fetch(`${API_BASE_URL}/auth/google/login`);
            if (!response.ok) {
                throw new Error('Failed to initiate Google OAuth');
            }
            const data = await response.json();

            // Redirect to Google authorization page
            window.location.href = data.url;
        } catch (error) {
            console.error('Google OAuth initiation failed:', error);
            toast.error('Failed to connect to Google. Please try again.');
            setOauthProvider(null);
        }
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (isSignUp) {
                await signUp(email, password, displayName);
                toast.success("Account created! Welcome to DevGem");
            } else {
                await signIn(email, password);
                toast.success("Welcome back!");
            }
            navigate("/deploy");
        } catch (error: any) {
            toast.error(error.message || "Authentication failed");
        }
    };

    if (isProcessingOAuth || githubLoading) {
        return (
            <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 w-full h-full bg-[#0A0A0B]">
                    <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
                </div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-8 relative z-10 flex flex-col items-center"
                >
                    <div className="relative w-24 h-24 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-blue-500 rounded-full opacity-20 blur-xl animate-pulse" />
                        <Logo size={64} />
                    </div>
                    <div className="space-y-3">
                        <div className="h-1 w-48 bg-gray-800 rounded-full overflow-hidden mx-auto">
                            <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 to-blue-500"
                                initial={{ x: "-100%" }}
                                animate={{ x: "0%" }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            />
                        </div>
                        <p className="text-gray-400 font-medium tracking-wide text-sm">
                            {oauthProvider === "google" ? "AUTHENTICATING WITH GOOGLE" : "AUTHENTICATING WITH GITHUB"}
                        </p>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0A0B] text-white overflow-hidden relative selection:bg-indigo-500/30">
            {/* Cinematic Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-500/5 to-transparent opacity-40" />
                <div className="absolute top-[-200px] left-[-200px] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[180px] mix-blend-screen" />
                <div className="absolute bottom-[-200px] right-[-200px] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[180px] mix-blend-screen" />
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
                        backgroundSize: '50px 50px'
                    }}
                />
            </div>

            <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

                {/* Left Side: Brand & Value Prop */}
                <div className="hidden lg:flex flex-1 flex-col justify-between p-16 xl:p-24 relative">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="flex items-center gap-3"
                    >
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-2 rounded-xl shadow-lg shadow-indigo-500/10">
                            <Logo size={32} />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white/90">DevGem</span>
                    </motion.div>

                    <div className="space-y-12 max-w-xl">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                        >
                            <h1 className="text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-white/50">Deploy faster</span><br />
                                than ever before.
                            </h1>
                            <p className="text-lg text-gray-400 leading-relaxed font-light">
                                Experience the future of cloud deployment.
                                Simply chat to deploy, scale, and manage your applications on Google Cloud Run.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-2 gap-6">
                            {[
                                { icon: Zap, label: "Instant Deploy", desc: "Zero to live in seconds" },
                                { icon: ShieldCheck, label: "Enterprise Security", desc: "Bank-grade protection" },
                                { icon: Cpu, label: "AI Powered", desc: "Smart infrastructure handling" },
                                { icon: Globe, label: "Global Edge", desc: "Low latency worldwide" }
                            ].map((feature, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.4 + (i * 0.1) }}
                                    className="bg-white/5 backdrop-blur-sm border border-white/5 p-4 rounded-2xl hover:bg-white/10 transition-colors cursor-default group"
                                >
                                    <feature.icon className="w-6 h-6 text-indigo-400 mb-3 group-hover:text-indigo-300 transition-colors" />
                                    <h3 className="font-semibold text-white/90">{feature.label}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{feature.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Auth Card */}
                <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.6, type: "spring", stiffness: 100 }}
                        className="w-full max-w-[440px]"
                    >
                        <div className="lg:hidden mb-8 text-center">
                            <div className="inline-block bg-white/5 p-3 rounded-2xl border border-white/10 mb-4">
                                <Logo size={40} />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Welcome to DevGem</h2>
                            <p className="text-gray-400 mt-2">Sign in to manage your deployments</p>
                        </div>

                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-3xl opacity-30 blur-2xl group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />

                            <div className="relative bg-[#0F0F11]/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden">

                                <AnimatePresence mode="wait">
                                    {mode === "initial" ? (
                                        <motion.div
                                            key="initial"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="space-y-6"
                                        >
                                            <div className="text-center space-y-2">
                                                <h3 className="text-2xl font-bold tracking-tight">Get Started</h3>
                                                <p className="text-gray-400 text-sm">Choose your preferred sign in method</p>
                                            </div>

                                            {/* GitHub Button */}
                                            <Button
                                                onClick={handleGitHubAuth}
                                                disabled={githubLoading || oauthProvider !== null}
                                                className="w-full h-14 bg-[#24292e] hover:bg-[#2c3137] text-white border border-white/10 rounded-xl text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/40 group/github"
                                            >
                                                <Github className="w-5 h-5 mr-3 group-hover/github:rotate-12 transition-transform" />
                                                Continue with GitHub
                                                <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover/github:opacity-100 -translate-x-2 group-hover/github:translate-x-0 transition-all" />
                                            </Button>

                                            {/* Google Button */}
                                            <Button
                                                onClick={handleGoogleAuth}
                                                disabled={oauthProvider !== null}
                                                variant="outline"
                                                className="w-full h-14 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl text-base font-medium transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg group/google"
                                            >
                                                <GoogleIcon />
                                                <span className="ml-3">Continue with Google</span>
                                                <ArrowRight className="w-4 h-4 ml-auto opacity-0 group-hover/google:opacity-100 -translate-x-2 group-hover/google:translate-x-0 transition-all text-gray-600" />
                                            </Button>

                                            <div className="relative">
                                                <div className="absolute inset-0 flex items-center">
                                                    <div className="w-full border-t border-white/10" />
                                                </div>
                                                <div className="relative flex justify-center text-xs uppercase tracking-widest">
                                                    <span className="bg-[#0F0F11]/90 px-4 text-gray-500 font-medium">Or using email</span>
                                                </div>
                                            </div>

                                            <div className="grid gap-3">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => { setMode("email"); setIsSignUp(false); }}
                                                    className="w-full h-12 bg-transparent border-white/10 hover:bg-white/5 hover:text-white text-gray-300 rounded-xl"
                                                >
                                                    <Mail className="w-4 h-4 mr-2" />
                                                    Sign In with Email
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => { setMode("email"); setIsSignUp(true); }}
                                                    className="w-full h-10 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl text-sm"
                                                >
                                                    Create an account
                                                </Button>
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="email"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="space-y-6"
                                        >
                                            <button
                                                onClick={() => setMode("initial")}
                                                className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors mb-2"
                                            >
                                                ← Back
                                            </button>

                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-bold tracking-tight">
                                                    {isSignUp ? "Create Account" : "Welcome Back"}
                                                </h3>
                                                <p className="text-gray-400 text-sm">
                                                    {isSignUp ? "Enter your details below" : "Enter your credentials to access your account"}
                                                </p>
                                            </div>

                                            <form onSubmit={handleEmailSubmit} className="space-y-4">
                                                {isSignUp && (
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Display Name</Label>
                                                        <div className="relative">
                                                            <Input
                                                                value={displayName}
                                                                onChange={(e) => setDisplayName(e.target.value)}
                                                                className="bg-black/20 border-white/10 h-11 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-white placeholder:text-gray-600 pl-10"
                                                                placeholder="John Doe"
                                                            />
                                                            <div className="absolute left-3 top-3 text-gray-500">
                                                                <Star className="w-5 h-5" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="email"
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            required
                                                            className="bg-black/20 border-white/10 h-11 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-white placeholder:text-gray-600 pl-10"
                                                            placeholder="name@example.com"
                                                        />
                                                        <div className="absolute left-3 top-3 text-gray-500">
                                                            <Mail className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="password"
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                            required
                                                            className="bg-black/20 border-white/10 h-11 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-white placeholder:text-gray-600 pl-10"
                                                            placeholder="••••••••"
                                                        />
                                                        <div className="absolute left-3 top-3 text-gray-500">
                                                            <ShieldCheck className="w-5 h-5" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <Button
                                                    type="submit"
                                                    disabled={authLoading}
                                                    className="w-full h-12 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02]"
                                                >
                                                    {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                                        <span className="flex items-center">
                                                            {isSignUp ? "Sign Up" : "Sign In"}
                                                            <ArrowRight className="w-4 h-4 ml-2" />
                                                        </span>
                                                    )}
                                                </Button>
                                            </form>

                                            <div className="text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsSignUp(!isSignUp)}
                                                    className="text-sm text-gray-500 hover:text-white transition-colors"
                                                >
                                                    {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Secure & Encrypted</p>
                                    <div className="flex justify-center gap-4 text-gray-700">
                                        <ShieldCheck className="w-4 h-4" />
                                        <div className="h-4 w-[1px] bg-white/5" />
                                        <Globe className="w-4 h-4" />
                                    </div>
                                </div>

                            </div>
                        </div>

                        <p className="text-center text-xs text-gray-600 mt-8">
                            By continuing, you agree to DevGem's Terms of Service and Privacy Policy
                        </p>
                    </motion.div>
                </div>

            </div>
        </div>
    );
};

export default Auth;
