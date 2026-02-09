/**
 * Centralized API & WebSocket Configuration
 * [FAANG] Authoritative source for endpoint resolution
 */

const isDevelopment = import.meta.env.DEV;

// Authoritative Production URL
export const PRODUCTION_BACKEND_URL = 'https://deploy-1-devgem-server-n3vlci4vfq-uc.a.run.app';
export const LOCAL_BACKEND_URL = 'http://localhost:8000';

// Resolution Logic
export const API_BASE_URL = import.meta.env.VITE_API_URL ||
    (isDevelopment ? LOCAL_BACKEND_URL : PRODUCTION_BACKEND_URL);

// WebSocket URL Resolution
export const getWebSocketUrl = (): string => {
    const base = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
    return `${base}/ws/chat`;
};

export const WS_URL = getWebSocketUrl();
