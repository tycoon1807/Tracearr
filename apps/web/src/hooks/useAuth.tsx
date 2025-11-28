import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@tracearr/shared';
import { api, tokenStorage } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const {
    data: userData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      // Don't even try if no token
      if (!tokenStorage.getAccessToken()) {
        return null;
      }
      try {
        const user = await api.auth.me();
        // The /auth/me endpoint returns the right shape
        return {
          userId: user.userId ?? user.id,
          username: user.username,
          role: user.role ?? (user.isOwner ? 'owner' : 'guest'),
          serverIds: user.serverIds ?? [user.serverId],
        } as AuthUser;
      } catch {
        // Token invalid, clear it
        tokenStorage.clearTokens();
        return null;
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      try {
        await api.auth.logout();
      } finally {
        tokenStorage.clearTokens();
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
      window.location.href = '/login';
    },
  });

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: userData ?? null,
      isLoading,
      isAuthenticated: !!userData,
      logout,
      refetch,
    }),
    [userData, isLoading, logout, refetch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for protected routes
export function useRequireAuth(): AuthContextValue {
  const auth = useAuth();

  if (!auth.isLoading && !auth.isAuthenticated) {
    // Redirect to login if not authenticated
    window.location.href = '/login';
  }

  return auth;
}
