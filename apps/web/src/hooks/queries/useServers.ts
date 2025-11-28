import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Server } from '@tracearr/shared';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

export function useServers() {
  return useQuery({
    queryKey: ['servers', 'list'],
    queryFn: api.servers.list,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { name: string; type: string; url: string; token: string }) =>
      api.servers.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', 'list'] });
      toast({
        title: 'Server Added',
        description: 'The server has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Server',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.servers.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers', 'list'] });
      toast({
        title: 'Server Removed',
        description: 'The server has been removed successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Remove Server',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSyncServer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => api.servers.sync(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['servers', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] });

      // Show detailed results
      const parts: string[] = [];
      if (data.usersAdded > 0) parts.push(`${data.usersAdded} users added`);
      if (data.usersUpdated > 0) parts.push(`${data.usersUpdated} users updated`);
      if (data.librariesSynced > 0) parts.push(`${data.librariesSynced} libraries`);
      if (data.errors.length > 0) parts.push(`${data.errors.length} errors`);

      const description = parts.length > 0
        ? parts.join(', ')
        : 'No changes detected';

      toast({
        title: data.success ? 'Server Synced' : 'Sync Completed with Errors',
        description,
        variant: data.errors.length > 0 ? 'destructive' : 'default',
      });

      // Log errors to console for debugging
      if (data.errors.length > 0) {
        console.error('Sync errors:', data.errors);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
