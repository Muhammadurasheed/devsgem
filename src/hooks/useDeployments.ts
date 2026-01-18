/**
 * Deployments Hook
 * Manages deployment data with backend integration
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient, APIError } from '@/lib/api/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Deployment {
  id: string;
  user_id: string;
  service_name: string;
  repo_url: string;
  status: 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'stopped';
  url: string;
  gcp_url?: string;
  region: string;
  memory: string;
  cpu: string;
  env_vars: Record<string, string>;
  created_at: string;
  updated_at: string;
  last_deployed?: string;
  build_logs: string[];
  error_message?: string;
  request_count: number;
  uptime_percentage: number;
}

export const useDeployments = () => {
  const { user } = useAuth();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch deployments
  const fetchDeployments = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const response: any = await apiClient.listDeployments(user.id);
      setDeployments(response.deployments || []);
    } catch (err) {
      const message = err instanceof APIError ? err.message : 'Failed to load deployments';
      setError(message);
      console.error('Error fetching deployments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load on mount
  useEffect(() => {
    fetchDeployments();
  }, [fetchDeployments]);

  // Create deployment
  const createDeployment = async (data: {
    service_name: string;
    repo_url: string;
    region?: string;
    env_vars?: Record<string, string>;
  }) => {
    if (!user) {
      toast.error('You must be logged in to deploy');
      return null;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.createDeployment({
        user_id: user.id,
        ...data,
      });

      toast.success('Deployment created!');
      await fetchDeployments();
      return response;
    } catch (err) {
      const message = err instanceof APIError ? err.message : 'Failed to create deployment';
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Delete deployment
  const deleteDeployment = async (deploymentId: string) => {
    setIsLoading(true);
    try {
      await apiClient.deleteDeployment(deploymentId);
      toast.success('Deployment deleted');
      await fetchDeployments();
    } catch (err) {
      const message = err instanceof APIError ? err.message : 'Failed to delete deployment';
      toast.error(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Get single deployment
  const getDeployment = async (deploymentId: string) => {
    try {
      return await apiClient.getDeployment(deploymentId);
    } catch (err) {
      console.error('Error fetching deployment:', err);
      return null;
    }
  };

  // Refresh deployments
  const refresh = fetchDeployments;

  return {
    deployments,
    isLoading,
    error,
    createDeployment,
    deleteDeployment,
    getDeployment,
    refresh,
  };
};
