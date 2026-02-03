/**
 * API Client for DevGem Backend
 * Type-safe REST API calls with error handling
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new APIError(
        error.detail || error.message || 'Request failed',
        response.status,
        error.code
      );
    }

    return response.json();
  }

  // ========================================================================
  // User Operations
  // ========================================================================

  async createUser(data: {
    email: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    github_token?: string;
  }) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUser(userId: string) {
    return this.request(`/api/users/${userId}`, {
      method: 'GET',
    });
  }

  async updateUser(userId: string, updates: Record<string, any>) {
    return this.request(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async upgradeUser(userId: string, tier: string) {
    return this.request(`/api/users/${userId}/upgrade`, {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
  }

  // ========================================================================
  // Deployment Operations
  // ========================================================================

  async listDeployments(userId: string) {
    return this.request(`/api/deployments?user_id=${userId}`, {
      method: 'GET',
    });
  }

  async getDeployment(deploymentId: string) {
    return this.request(`/api/deployments/${deploymentId}`, {
      method: 'GET',
    });
  }

  async createDeployment(data: {
    user_id: string;
    service_name: string;
    repo_url: string;
    region?: string;
    env_vars?: Record<string, string>;
  }) {
    return this.request('/api/deployments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDeploymentStatus(
    deploymentId: string,
    status: string,
    errorMessage?: string,
    gcpUrl?: string
  ) {
    return this.request(`/api/deployments/${deploymentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        error_message: errorMessage,
        gcp_url: gcpUrl,
      }),
    });
  }

  async deleteDeployment(deploymentId: string) {
    return this.request(`/api/deployments/${deploymentId}`, {
      method: 'DELETE',
    });
  }

  async getDeploymentEvents(deploymentId: string, limit: number = 50) {
    return this.request(`/api/deployments/${deploymentId}/events?limit=${limit}`, {
      method: 'GET',
    });
  }

  async addDeploymentLog(deploymentId: string, logLine: string) {
    return this.request(`/api/deployments/${deploymentId}/logs`, {
      method: 'POST',
      body: JSON.stringify({ log_line: logLine }),
    });
  }

  // ========================================================================
  // Usage Operations
  // ========================================================================

  async getTodayUsage(userId: string) {
    return this.request(`/api/usage/${userId}/today`, {
      method: 'GET',
    });
  }

  async getUsageSummary(userId: string, days: number = 30) {
    return this.request(`/api/usage/${userId}/summary?days=${days}`, {
      method: 'GET',
    });
  }

  async getMonthlyUsage(userId: string, year: number, month: number) {
    return this.request(`/api/usage/${userId}/monthly?year=${year}&month=${month}`, {
      method: 'GET',
    });
  }

  async getAnalytics(userId: string) {
    return this.request(`/api/analytics/${userId}`, {
      method: 'GET',
    });
  }
}

export const apiClient = new APIClient();
