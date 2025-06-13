import { useQuery } from "@tanstack/react-query";
import { supabase } from "@common/services/supabaseClient";
import { newsletterApi } from "@common/api/newsletterApi";
import { AuthContext } from "@common/contexts/AuthContext";
import { useContext, useEffect, useRef, useMemo } from "react";
import { getCacheManagerSafe } from "@common/utils/cacheUtils";

// Cache time constants (in milliseconds)
const STALE_TIME = 5 * 60 * 1000; // 5 minutes
const CACHE_TIME = 30 * 60 * 1000; // 30 minutes

export const useUnreadCount = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const initialLoadComplete = useRef(false);
  const previousCount = useRef<number | null>(null);

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  // Only enable the query when we have a user
  const queryKey = useMemo(() => ["unreadCount", user?.id], [user?.id]);

  // Use a stable query function with refs to track state
  const {
    data: unreadCount = 0,
    isLoading,
    isError,
    error,
  } = useQuery<number, Error>({
    queryKey,
    queryFn: async () => {
      if (!user) return 0;

      try {
        // Get unread count excluding archived items by using getAll with filters
        const unreadNonArchived = await newsletterApi.getAll({
          isRead: false,
          isArchived: false,
          limit: 1, // We only need the count, not the actual data
        });

        return unreadNonArchived.count || 0;
      } catch (error) {
        console.error("Error fetching unread count:", error);
        throw error;
      }
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
      .channel("unread_count_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "newsletters",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Use cache manager to invalidate related queries if available
          if (cacheManager) {
            cacheManager.invalidateRelatedQueries([], "unread-count-change");
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, cacheManager, queryKey]);

  // During initial load, return undefined to hide the counter
  // After initial load, always return the previous count until we have a new stable value
  const displayCount = !initialLoadComplete.current
    ? undefined
    : unreadCount !== undefined
      ? unreadCount
      : previousCount.current || 0;

  return {
    unreadCount: displayCount,
    isLoading: !initialLoadComplete.current && isLoading,
    isError,
    error,
  };
};
