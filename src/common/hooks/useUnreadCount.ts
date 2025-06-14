import { useQuery, useQueryClient } from "@tanstack/react-query";
import { newsletterApi } from "@common/api/newsletterApi";
import { AuthContext } from "@common/contexts/AuthContext";
import { useContext, useEffect, useRef, useMemo } from "react";
import { getCacheManagerSafe } from "@common/utils/cacheUtils";
import { queryKeyFactory } from "@common/utils/queryKeyFactory";

// Cache time constants (in milliseconds) - Very short for real-time unread counts
const STALE_TIME = 0; // Always fresh data for unread count
const CACHE_TIME = 10 * 1000; // 10 seconds - very short cache for immediate updates

export const useUnreadCount = (sourceId?: string | null) => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();
  const initialLoadComplete = useRef(false);
  const previousCount = useRef<number | null>(null);

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  // Only enable the query when we have a user
  const queryKey = useMemo(() => {
    if (sourceId) {
      return ["unreadCount", user?.id, "source", sourceId];
    }
    return ["unreadCount", user?.id];
  }, [user?.id, sourceId]);

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
        if (sourceId) {
          // Get unread count for specific source
          const unreadNonArchived = await newsletterApi.getAll({
            isRead: false,
            isArchived: false,
            sourceIds: [sourceId],
            limit: 1, // We only need the count, not the actual data
          });
          return unreadNonArchived.count || 0;
        } else {
          // Get total unread count excluding archived items
          const unreadNonArchived = await newsletterApi.getAll({
            isRead: false,
            isArchived: false,
            limit: 1, // We only need the count, not the actual data
          });
          return unreadNonArchived.count || 0;
        }
      } catch (error) {
        console.error("Error fetching unread count:", error);
        throw error;
      }
    },
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    // Don't use placeholder data to ensure fresh updates
    refetchInterval: 10 * 1000, // Refetch every 10 seconds as backup
    // Force refetch on every mount to ensure accuracy
    refetchIntervalInBackground: true,
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

  // Listen for newsletter updates and invalidate unread count
  useEffect(() => {
    if (!user) return;

    const handleNewsletterUpdate = () => {
      console.log("🔄 Invalidating unread count due to newsletter update");

      // Force immediate invalidation and refetch - more aggressive
      queryClient.invalidateQueries({
        queryKey: ["unreadCount"],
        exact: false,
        refetchType: "all", // Refetch all, not just active
      });

      // Also invalidate source-specific queries
      queryClient.invalidateQueries({
        queryKey: ["unreadCount", user.id, "source"],
        exact: false,
        refetchType: "all",
      });

      // Force immediate refetch of current query with timeout to ensure execution
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey,
          exact: true,
        });
      }, 100);

      // Also trigger immediate refetch without timeout
      queryClient.refetchQueries({
        queryKey,
        exact: true,
      });
    };

    // Listen for custom events from newsletter actions
    window.addEventListener(
      "newsletter:read-status-changed",
      handleNewsletterUpdate,
    );
    window.addEventListener("newsletter:archived", handleNewsletterUpdate);
    window.addEventListener("newsletter:deleted", handleNewsletterUpdate);

    return () => {
      window.removeEventListener(
        "newsletter:read-status-changed",
        handleNewsletterUpdate,
      );
      window.removeEventListener("newsletter:archived", handleNewsletterUpdate);
      window.removeEventListener("newsletter:deleted", handleNewsletterUpdate);
    };
  }, [user, queryClient]);

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

// Hook for getting unread counts by all sources
export const useUnreadCountsBySource = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  const queryKey = useMemo(
    () => queryKeyFactory.newsletters.unreadCountsBySource(),
    [],
  );

  const {
    data: unreadCountsBySource = {},
    isLoading,
    isError,
    error,
  } = useQuery<Record<string, number>, Error>({
    queryKey,
    queryFn: async () => {
      if (!user) return {};

      try {
        return await newsletterApi.getUnreadCountBySource();
      } catch (error) {
        console.error("Error fetching unread counts by source:", error);
        throw error;
      }
    },
    enabled: !!user,
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds as backup
    refetchIntervalInBackground: true,
  });

  // Listen for newsletter updates and invalidate unread counts by source
  useEffect(() => {
    if (!user) return;

    const handleNewsletterUpdate = () => {
      console.log(
        "🔄 Invalidating unread counts by source due to newsletter update",
      );

      // Force immediate invalidation and refetch for unread counts by source - more aggressive
      queryClient.invalidateQueries({
        queryKey: queryKeyFactory.newsletters.unreadCountsBySource(),
        exact: true,
        refetchType: "all", // Refetch all, not just active
      });

      // Force immediate refetch with timeout to ensure execution
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: queryKeyFactory.newsletters.unreadCountsBySource(),
          exact: true,
        });
      }, 100);

      // Also trigger immediate refetch without timeout
      queryClient.refetchQueries({
        queryKey: queryKeyFactory.newsletters.unreadCountsBySource(),
        exact: true,
      });
    };

    // Listen for custom events from newsletter actions
    window.addEventListener(
      "newsletter:read-status-changed",
      handleNewsletterUpdate,
    );
    window.addEventListener("newsletter:archived", handleNewsletterUpdate);
    window.addEventListener("newsletter:deleted", handleNewsletterUpdate);

    return () => {
      window.removeEventListener(
        "newsletter:read-status-changed",
        handleNewsletterUpdate,
      );
      window.removeEventListener("newsletter:archived", handleNewsletterUpdate);
      window.removeEventListener("newsletter:deleted", handleNewsletterUpdate);
    };
  }, [user, queryClient]);

  return {
    unreadCountsBySource,
    isLoading,
    isError,
    error,
  };
};
