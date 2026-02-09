/**
 * Deployments Hook
 * [FAANG-LEVEL] Manages deployment data with TanStack Query for high performance
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  framework?: string;
  language?: string;
  // [FAANG] Git Metadata
  commit_hash?: string;
  commit_message?: string;
  commit_author?: string;
  commit_date?: string;
}

export const useDeployments = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 1. Fetch deployments Query
  const {
    data: deployments = [],
    isLoading,
    error: queryError,
    refetch: refresh
  } = useQuery({
    queryKey: ['deployments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const response: any = await apiClient.listDeployments(user.id);
      return response.deployments || [];
    },
    enabled: !!user,
  });

  // 2. Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      service_name: string;
      repo_url: string;
      region?: string;
      env_vars?: Record<string, string>;
    }) => {
      if (!user) throw new Error('You must be logged in to deploy');
      return await apiClient.createDeployment({
        user_id: user.id,
        ...data,
      });
    },
    onSuccess: () => {
      toast.success('Deployment initiated!');
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
    onError: (err) => {
      const message = err instanceof APIError ? err.message : 'Failed to create deployment';
      toast.error(message);
    }
  });

  // 3. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (deploymentId: string) => {
      return await apiClient.deleteDeployment(deploymentId);
    },
    onSuccess: () => {
      toast.success('Deployment deleted');
      queryClient.invalidateQueries({ queryKey: ['deployments'] });
    },
    onError: (err) => {
      const message = err instanceof APIError ? err.message : 'Failed to delete deployment';
      toast.error(message);
    }
  });

  // Helper for single deployment (can also be a query)
  const getDeployment = async (deploymentId: string) => {
    // Check cache first for instant UX
    const cached = deployments.find(d => d.id === deploymentId);
    if (cached) return cached;

    try {
      return await apiClient.getDeployment(deploymentId);
    } catch (err) {
      console.error('Error fetching deployment:', err);
      return null;
    }
  };

  return {
    deployments,
    isLoading,
    error: queryError ? (queryError as any).message : null,
    createDeployment: createMutation.mutateAsync,
    deleteDeployment: deleteMutation.mutateAsync,
    getDeployment,
    refresh,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
