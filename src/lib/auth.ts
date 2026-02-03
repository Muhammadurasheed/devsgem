/**
 * Simple Auth Service - Enterprise Pattern
 * Lightweight authentication without complex dependencies
 */

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  githubToken?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();

  private constructor() {
    // Load from localStorage on init
    const stored = localStorage.getItem('servergem_user');
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }
    }
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  subscribe(listener: (user: User | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.currentUser));
  }

  async signIn(email: string, password: string): Promise<User> {
    // Simulate auth - replace with real Firebase/Auth provider
    await new Promise(resolve => setTimeout(resolve, 500));

    const user: User = {
      id: `user_${Date.now()}`,
      email,
      displayName: email.split('@')[0],
    };

    this.currentUser = user;
    localStorage.setItem('servergem_user', JSON.stringify(user));
    this.notifyListeners();

    return user;
  }

  async signUp(email: string, password: string, displayName?: string): Promise<User> {
    // Simulate auth - replace with real Firebase/Auth provider
    await new Promise(resolve => setTimeout(resolve, 500));

    const user: User = {
      id: `user_${Date.now()}`,
      email,
      displayName: displayName || email.split('@')[0],
    };

    this.currentUser = user;
    localStorage.setItem('servergem_user', JSON.stringify(user));
    this.notifyListeners();

    return user;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    localStorage.removeItem('servergem_user');
    this.notifyListeners();
  }

  updateGitHubToken(token: string) {
    if (this.currentUser) {
      this.currentUser.githubToken = token;
      localStorage.setItem('servergem_user', JSON.stringify(this.currentUser));
      this.notifyListeners();
    }
  }

  // [FAANG] Identity Unification: Allow external providers (GitHub) to set the core user
  setExternalUser(user: User) {
    console.log('[AuthService] 🔄 Syncing external user:', user.id);
    this.currentUser = user;
    localStorage.setItem('servergem_user', JSON.stringify(user));
    this.notifyListeners();
  }
}

export const authService = AuthService.getInstance();
