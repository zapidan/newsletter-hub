import { 
  useQuery, 
  useQueryClient
} from '@tanstack/react-query';
import { supabase } from '@common/services/supabaseClient';
import { AuthContext } from '@common/contexts/AuthContext';
import { useContext, useEffect, useRef } from 'react';

// Cache time constants (in milliseconds)
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

export const useUnreadCount = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();
  const initialLoadComplete = useRef(false);
  const previousCount = useRef<number | null>(null);

  // Only enable the query when we have a user
  const queryKey = ['unreadCount', user?.id];
  
  // Use a stable query function with refs to track state
  const { data: unreadCount = 0, isLoading, isError, error } = useQuery<number, Error>({
    queryKey,
    queryFn: async () => {
      if (!user) return 0;
      
      const { count, error } = await supabase
        .from('newsletters')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .eq('is_archived', false);

      if (error) {
        console.error('Error fetching unread count:', error);
        throw error;
      }
      
      return count || 0;
    },
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    // Keep the previous data while refetching
    placeholderData: (previousData) => previousData ?? 0,
  });

  // Track initial load
  useEffect(() => {
    if (!isLoading && !initialLoadComplete.current) {
      initialLoadComplete.current = true;
      previousCount.current = unreadCount;
    }
  }, [isLoading, unreadCount]);

  // Only update the previous count when we have a stable value
  // This prevents the count from changing during rapid updates
  useEffect(() => {
    if (initialLoadComplete.current && unreadCount !== undefined) {
      previousCount.current = unreadCount;
    }
  }, [unreadCount]);

  // Subscribe to newsletter changes to update the count
  useEffect(() => {
    if (!user) return;
    
    const channel = supabase
      .channel('unread_count_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'newsletters',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        // Invalidate the query to trigger a refetch
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, queryClient, queryKey]);

  // During initial load, return undefined to hide the counter
  // After initial load, always return the previous count until we have a new stable value
  const displayCount = !initialLoadComplete.current 
    ? undefined 
    : (unreadCount !== undefined ? unreadCount : previousCount.current || 0);

  return {
    unreadCount: displayCount,
    isLoading: !initialLoadComplete.current && isLoading,
    isError,
    error,
  };
};
