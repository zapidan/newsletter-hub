import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { AuthContext } from '../context/AuthContext';
import { useContext, useEffect } from 'react';

// Cache time constants (in milliseconds)
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

export const useUnreadCount = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();

  // Subscribe to newsletter changes to auto-update count
  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'newsletters' && 
          event?.type === 'updated') {
        // Invalidate unread count when newsletters change
        queryClient.invalidateQueries({ 
          queryKey: ['unreadCount', user?.id],
          refetchType: 'active'
        });
      }
    });
    
    return unsubscribe;
  }, [queryClient, user?.id]);

  const { data: unreadCount, isLoading, isError, error } = useQuery({
    queryKey: ['unreadCount', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('newsletters')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_archived', false); // Only count unread, non-archived newsletters

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return {
    unreadCount: unreadCount || 0,
    isLoading,
    isError,
    error,
  };
};


