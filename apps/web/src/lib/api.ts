import type {
  Server,
  User,
  Session,
  ActiveSession,
  Rule,
  Violation,
  ViolationWithDetails,
  DashboardStats,
  PlayStats,
  UserStats,
  LocationStats,
  Settings,
  PaginatedResponse,
} from '@tracearr/shared';
import { API_BASE_PATH } from '@tracearr/shared';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_PATH) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message ?? `Request failed: ${response.status}`);
    }

    return response.json();
  }

  // Auth
  auth = {
    me: () => this.request<User>('/auth/me'),
    logout: () => this.request<void>('/auth/logout', { method: 'POST' }),
  };

  // Servers
  servers = {
    list: () => this.request<Server[]>('/servers'),
    create: (data: { name: string; type: string; url: string; token: string }) =>
      this.request<Server>('/servers', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => this.request<void>(`/servers/${id}`, { method: 'DELETE' }),
    sync: (id: string) => this.request<void>(`/servers/${id}/sync`, { method: 'POST' }),
  };

  // Users
  users = {
    list: () => this.request<User[]>('/users'),
    get: (id: string) => this.request<User>(`/users/${id}`),
    update: (id: string, data: Partial<User>) =>
      this.request<User>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    sessions: (id: string, params?: { page?: number; pageSize?: number }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return this.request<PaginatedResponse<Session>>(`/users/${id}/sessions?${query}`);
    },
  };

  // Sessions
  sessions = {
    list: (params?: { page?: number; pageSize?: number; userId?: string }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return this.request<PaginatedResponse<Session>>(`/sessions?${query}`);
    },
    getActive: () => this.request<ActiveSession[]>('/sessions/active'),
    get: (id: string) => this.request<Session>(`/sessions/${id}`),
  };

  // Rules
  rules = {
    list: () => this.request<Rule[]>('/rules'),
    create: (data: Omit<Rule, 'id' | 'createdAt' | 'updatedAt'>) =>
      this.request<Rule>('/rules', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Rule>) =>
      this.request<Rule>(`/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => this.request<void>(`/rules/${id}`, { method: 'DELETE' }),
  };

  // Violations
  violations = {
    list: (params?: { page?: number; pageSize?: number; userId?: string }) => {
      const query = new URLSearchParams(params as Record<string, string>).toString();
      return this.request<PaginatedResponse<ViolationWithDetails>>(`/violations?${query}`);
    },
    acknowledge: (id: string) =>
      this.request<Violation>(`/violations/${id}`, { method: 'PATCH' }),
    dismiss: (id: string) => this.request<void>(`/violations/${id}`, { method: 'DELETE' }),
  };

  // Stats
  stats = {
    dashboard: () => this.request<DashboardStats>('/stats/dashboard'),
    plays: (period?: string) => this.request<PlayStats[]>(`/stats/plays?period=${period ?? 'week'}`),
    users: () => this.request<UserStats[]>('/stats/users'),
    locations: () => this.request<LocationStats[]>('/stats/locations'),
  };

  // Settings
  settings = {
    get: () => this.request<Settings>('/settings'),
    update: (data: Partial<Settings>) =>
      this.request<Settings>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  };
}

export const api = new ApiClient();
