import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './useAuth';

export const useUnreadCount = () => {
  const { user } = useAuth();

  const { data: unreadCount, isLoading, isError, error } = useQuery({
    queryKey: ['unreadCount', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('newsletters')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return {
    unreadCount: unreadCount || 0,
    isLoading,
    isError,
    error,
  };
};
