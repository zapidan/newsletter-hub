import { useQuery, useQueryClient } from "@tanstack/react-query";
import { newsletterApi } from "@common/api/newsletterApi";
import { AuthContext } from "@common/contexts/AuthContext";
import { useContext, useEffect, useRef, useMemo } from "react";

import { useLogger } from "@common/utils/logger/useLogger";

// Cache time constants (in milliseconds) - Very short for real-time unread counts
const STALE_TIME = 0; // Always fresh data for unread count
const CACHE_TIME = 5 * 1000; // 5 seconds - very short cache for immediate updates

export const useUnreadCount = (sourceId?: string | null) => {
  const log = useLogger("useUnreadCount");
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();
  const initialLoadComplete = useRef(false);
  const previousCount = useRef<number | null>(null);

  // Only enable the query when we have a user
  const queryKey = useMemo(() => {
    const key = sourceId
      ? ["unreadCount", user?.id, "source", sourceId]
      : ["unreadCount", user?.id];
    log.debug("Unread count query key generated", {
      action: "generate_query_key",
      metadata: { key, sourceId, userId: user?.id },
    });
    return key;
  }, [user?.id, sourceId, log]);

  // Use a stable query function with refs to track state
  const {
    data: unreadCount = 0,
    isLoading,
    isError,
    error,
  } = useQuery<number, Error>({
    queryKey,
    queryFn: async () => {
      if (!user) {
        log.debug("No user, returning 0 for unread count", {
          action: "fetch_unread_count_no_user",
        });
        return 0;
      }

      log.debug("Fetching unread count", {
        action: "fetch_unread_count_start",
        metadata: { sourceId, userId: user.id },
      });

      try {
        const params = {
          isRead: false,
          isArchived: false,
          limit: 50, // Get actual data to count reliably
          ...(sourceId && { sourceIds: [sourceId] }),
        };

        log.debug("Unread count query params", {
          action: "fetch_unread_count_params",
          metadata: { params },
        });

        const result = await newsletterApi.getAll(params);
        const count = result.count || 0;

        log.debug("Unread count result", {
          action: "fetch_unread_count_result",
          metadata: {
            sourceId,
            count,
            actualDataLength: result.data?.length,
            resultCount: result.count,
          },
        });

        return count;
      } catch (error) {
        log.error(
          "Error fetching unread count",
          {
            action: "fetch_unread_count_error",
            metadata: { sourceId, userId: user.id },
          },
          error instanceof Error ? error : new Error(String(error)),
        );
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
    refetchInterval: 5 * 1000, // Refetch every 5 seconds as backup
    // Force refetch on every mount to ensure accuracy
    refetchIntervalInBackground: true,
    // Force network fetch
    networkMode: "always",
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
      log.debug("Invalidating unread count due to newsletter update", {
        action: "invalidate_unread_count",
      });

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
      // Force immediate and thorough refetch
      Promise.resolve().then(async () => {
        await queryClient.invalidateQueries({
          queryKey: ["unreadCount"],
          exact: false,
          refetchType: "all",
        });

        await queryClient.refetchQueries({
          queryKey,
          exact: true,
          type: "all",
        });
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

