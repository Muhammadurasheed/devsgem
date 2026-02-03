/**
 * GitHub Context - OAuth Integration
 * Handles GitHub OAuth flow with backend endpoints
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import { authService } from '@/lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface GitHubUser {
    login: string;
    name: string;
    avatar_url: string;
    email?: string;
    id?: number;
}

interface GitHubRepo {
    id: number;
    name: string;
    full_name: string;
    description: string;
    html_url: string;
    clone_url: string;
    language: string;
    stargazers_count: number;
    private: boolean;
    default_branch: string;
}

interface GitHubContextType {
    token: string | null;
    user: GitHubUser | null;
    repositories: GitHubRepo[];
    isLoading: boolean;
    isConnected: boolean;
    connect: (token: string) => Promise<boolean>;
    disconnect: () => void;
    fetchRepositories: () => Promise<void>;
    validateToken: (token: string) => Promise<boolean>;
    getToken: () => string | null;
    // New OAuth methods
    initiateOAuth: () => Promise<void>;
    handleOAuthCallback: (code: string) => Promise<boolean>;
}

const GitHubContext = createContext<GitHubContextType | null>(null);

export const GITHUB_TOKEN_KEY = 'devgem_github_token';
export const GITHUB_USER_KEY = 'devgem_github_user';

export function GitHubProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<GitHubUser | null>(null);
    const [repositories, setRepositories] = useState<GitHubRepo[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    // Initialize from localStorage
    useEffect(() => {
        const savedToken = localStorage.getItem(GITHUB_TOKEN_KEY);
        const savedUser = localStorage.getItem(GITHUB_USER_KEY);

        if (savedToken) {
            setToken(savedToken);
            setIsConnected(true);
        }

        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser);
                setUser(parsedUser);
                // [FAANG] Sync on load
                authService.setExternalUser({
                    id: String(parsedUser.login), // Use strictly the handle as ID to match backend expectation
                    email: parsedUser.email || `@${parsedUser.login}`,
                    displayName: parsedUser.name || parsedUser.login,
                    photoURL: parsedUser.avatar_url,
                    githubToken: savedToken || undefined
                });
            } catch (e) {
                console.error('Failed to parse saved user:', e);
                localStorage.removeItem(GITHUB_USER_KEY);
            }
        }
    }, []);

    // Validate token with GitHub API
    const validateToken = useCallback(async (tokenToValidate: string): Promise<boolean> => {
        try {
            const response = await fetch('https://api.github.com/user', {
                headers: {
                    'Authorization': `Bearer ${tokenToValidate}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                const githubUser: GitHubUser = {
                    login: userData.login,
                    name: userData.name || userData.login,
                    avatar_url: userData.avatar_url,
                    email: userData.email,
                    id: userData.id
                };

                setUser(githubUser);
                localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(githubUser));

                // [FAANG] Sync with Central Auth
                authService.setExternalUser({
                    id: String(githubUser.login),
                    email: githubUser.email || `@${githubUser.login}`,
                    displayName: githubUser.name || githubUser.login,
                    photoURL: githubUser.avatar_url,
                    githubToken: tokenToValidate
                });

                return true;
            } else {
                console.error('Token validation failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Error validating token:', error);
            return false;
        }
    }, []);

    // Connect with GitHub token (direct token - for backward compatibility)
    const connect = useCallback(async (githubToken: string) => {
        setIsLoading(true);
        try {
            const isValid = await validateToken(githubToken);

            if (isValid) {
                setToken(githubToken);
                setIsConnected(true);
                localStorage.setItem(GITHUB_TOKEN_KEY, githubToken);
                toast.success('Connected to GitHub!');
                return true;
            } else {
                toast.error('Invalid GitHub token');
                return false;
            }
        } catch (error) {
            console.error('Connection error:', error);
            toast.error('Failed to connect to GitHub');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [validateToken]);

    // Initiate OAuth flow - redirects to GitHub
    const initiateOAuth = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/github/login`);
            if (!response.ok) {
                throw new Error('Failed to initiate OAuth');
            }
            const data = await response.json();

            // Redirect to GitHub authorization page
            window.location.href = data.url;
        } catch (error) {
            console.error('OAuth initiation failed:', error);
            toast.error('Failed to connect to GitHub. Please try again.');
            setIsLoading(false);
        }
    }, []);

    // Handle OAuth callback - exchange code for token
    const handleOAuthCallback = useCallback(async (code: string): Promise<boolean> => {
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/auth/github/callback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'OAuth callback failed');
            }

            const data = await response.json();

            // Store token and user info
            const accessToken = data.token;
            const userInfo: GitHubUser = {
                login: data.user.login,
                name: data.user.name || data.user.login,
                avatar_url: data.user.avatar_url,
                email: data.user.email,
                id: data.user.id
            };

            setToken(accessToken);
            setUser(userInfo);
            setIsConnected(true);

            localStorage.setItem(GITHUB_TOKEN_KEY, accessToken);
            localStorage.setItem(GITHUB_USER_KEY, JSON.stringify(userInfo));

            // [FAANG] Sync with Central Auth
            authService.setExternalUser({
                id: String(userInfo.login),
                email: userInfo.email || `@${userInfo.login}`,
                displayName: userInfo.name || userInfo.login,
                photoURL: userInfo.avatar_url,
                githubToken: accessToken
            });

            toast.success(`Welcome, ${userInfo.name}!`);
            return true;
        } catch (error) {
            console.error('OAuth callback error:', error);
            toast.error('GitHub authentication failed. Please try again.');
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Disconnect from GitHub
    const disconnect = useCallback(() => {
        setToken(null);
        setUser(null);
        setRepositories([]);
        setIsConnected(false);
        localStorage.removeItem(GITHUB_TOKEN_KEY);
        localStorage.removeItem(GITHUB_USER_KEY);
        toast.success('Disconnected from GitHub');
    }, []);

    // Fetch user repositories
    const fetchRepositories = useCallback(async () => {
        if (!token) {
            return;
        }

        setIsLoading(true);
        try {
            const perPage = 100;
            let allRepos: GitHubRepo[] = [];
            let page = 1;
            let hasMore = true;

            while (hasMore && page <= 3) {
                const response = await fetch(
                    `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status}`);
                }

                const repos = await response.json();
                if (repos.length < perPage) {
                    hasMore = false;
                }

                allRepos = [...allRepos, ...repos];
                page++;
            }

            setRepositories(allRepos);
        } catch (error) {
            console.error('Error fetching repositories:', error);

            if (error instanceof Error && error.message.includes('401')) {
                toast.error('GitHub session expired. Please reconnect.');
                disconnect();
            } else {
                toast.error('Failed to load repositories');
            }
        } finally {
            setIsLoading(false);
        }
    }, [token, disconnect]);

    const getToken = useCallback(() => token, [token]);

    return (
        <GitHubContext.Provider value={{
            token,
            user,
            repositories,
            isLoading,
            isConnected,
            connect,
            disconnect,
            fetchRepositories,
            validateToken,
            getToken,
            initiateOAuth,
            handleOAuthCallback
        }}>
            {children}
        </GitHubContext.Provider>
    );
}

export function useGitHubContext() {
    const context = useContext(GitHubContext);
    if (!context) {
        throw new Error('useGitHubContext must be used within a GitHubProvider');
    }
    return context;
}
