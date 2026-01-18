/**
 * Usage Hook
 * Manages usage metrics and limits
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient, APIError } from '@/lib/api/client';
import { useAuth } from './useAuth';

export interface UsageData {
  usage: {
    user_id: string;
    date: string;
    requests: number;
    deployments: number;
    memory_used_mb: number;
    bandwidth_gb: number;
  };
  limits: {
    max_services: number;
    max_requests_per_day: number;
    max_memory_mb: number;
  };
  plan_tier: 'free' | 'pro' | 'enterprise';
}

export interface UsageSummary {
  period_days: number;
  total_requests: number;
  total_deployments: number;
  total_bandwidth_gb: number;
  avg_memory_mb: number;
  daily_average_requests: number;
}

export const useUsage = () => {
  const { user } = useAuth();
  const [todayUsage, setTodayUsage] = useState<UsageData | null>(null);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch today's usage
  const fetchTodayUsage = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const data: any = await apiClient.getTodayUsage(user.id);
      setTodayUsage(data);
    } catch (err) {
      const message = err instanceof APIError ? err.message : 'Failed to load usage';
      setError(message);
      console.error('Error fetching usage:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Fetch usage summary
  const fetchSummary = useCallback(async (days: number = 30) => {
    if (!user) return;

    try {
      const data: any = await apiClient.getUsageSummary(user.id, days);
      setSummary(data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, [user]);

  // Load on mount
  useEffect(() => {
    fetchTodayUsage();
    fetchSummary();
  }, [fetchTodayUsage, fetchSummary]);

  // Calculate usage percentages
  const getRequestsPercentage = () => {
    if (!todayUsage) return 0;
    const { requests } = todayUsage.usage;
    const { max_requests_per_day } = todayUsage.limits;
    
    if (max_requests_per_day === -1) return 0; // unlimited
    return (requests / max_requests_per_day) * 100;
  };

  const getMemoryPercentage = () => {
    if (!todayUsage) return 0;
    const { memory_used_mb } = todayUsage.usage;
    const { max_memory_mb } = todayUsage.limits;
    return (memory_used_mb / max_memory_mb) * 100;
  };

  // Check if approaching limits
  const isApproachingLimit = () => {
    return getRequestsPercentage() > 80 || getMemoryPercentage() > 80;
  };

  const hasExceededLimit = () => {
    return getRequestsPercentage() >= 100;
  };

  return {
    todayUsage,
    summary,
    isLoading,
    error,
    getRequestsPercentage,
    getMemoryPercentage,
    isApproachingLimit,
    hasExceededLimit,
    refresh: fetchTodayUsage,
  };
};
