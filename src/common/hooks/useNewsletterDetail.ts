import { useQuery } from "@tanstack/react-query";
import { useContext, useCallback, useMemo } from "react";
import { supabase } from "@common/services/supabaseClient";
import { AuthContext } from "@common/contexts/AuthContext";
import { NewsletterWithRelations } from "@common/types";
import { queryKeyFactory } from "@common/utils/queryKeyFactory";
import {
  getCacheManagerSafe,
  getQueriesData,
  getQueryData,
  getQueryState,
  prefetchQuery,
} from "@common/utils/cacheUtils";

export interface UseNewsletterDetailOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  prefetchTags?: boolean;
  prefetchSource?: boolean;
}

export interface UseNewsletterDetailResult {
  newsletter: NewsletterWithRelations | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;
  prefetchRelated: () => Promise<void>;
}

interface SupabaseNewsletterResponse {
  id: string;
  title: string;
  content: string;
  summary: string;
  image_url: string;
  received_at: string;
  updated_at: string;
  is_read: boolean;
  is_liked: boolean;
  is_archived: boolean;
  is_bookmarked?: boolean;
  user_id: string;
  newsletter_source_id?: string | null;
  word_count: number;
  estimated_read_time: number;
  source?: {
    id: string;
    name: string;
    domain: string;
    user_id: string;
    created_at: string;
    updated_at: string;
    is_archived?: boolean;
  } | null;
  tags?: Array<{
    tag: {
      id: string;
      name: string;
      color: string;
      user_id: string;
      created_at: string;
    };
  }>;
}

/**
 * Custom hook for fetching and caching newsletter details with optimized caching
 * and prefetching capabilities for improved performance
 */
export const useNewsletterDetail = (
  newsletterId: string,
  options: UseNewsletterDetailOptions = {},
) => {
  const auth = useContext(AuthContext);
  const user = auth?.user;

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  const {
    enabled = true,
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus = false,
    prefetchTags = true,
    prefetchSource = true,
  } = options;

  // Fetch newsletter detail from Supabase
  const fetchNewsletterDetail =
    useCallback(async (): Promise<NewsletterWithRelations> => {
      if (!user) {
        throw new Error("User not authenticated");
      }

      if (!newsletterId) {
        throw new Error("Newsletter ID is required");
      }

      const { data, error } = await supabase
        .from("newsletters")
        .select(
          `
        *,
        source:newsletter_sources(
          id,
          name,
          domain,
          user_id,
          created_at,
          updated_at,
          is_archived
        ),
        tags:newsletter_tags(
          tag:tags(
            id,
            name,
            color,
            user_id,
            created_at
          )
        )
      `,
        )
        .eq("id", newsletterId)
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error fetching newsletter detail:", error);
        throw new Error(error.message || "Failed to fetch newsletter details");
      }

      if (!data) {
        throw new Error("Newsletter not found");
      }

      // Transform the data to match our expected format
      const typedData = data as SupabaseNewsletterResponse;
      const transformedData: NewsletterWithRelations = {
        ...typedData,
        source: typedData.source || null,
        tags: typedData.tags?.map((t) => t.tag).filter(Boolean) || [],
        newsletter_source_id: typedData.newsletter_source_id || null,
      };

      return transformedData;
    }, [user, newsletterId]);

  // Main query for newsletter detail
  const query = useQuery({
    queryKey: queryKeyFactory.newsletters.detail(newsletterId),
    queryFn: fetchNewsletterDetail,
    enabled: enabled && !!user && !!newsletterId,
    staleTime,
    gcTime: cacheTime,
    refetchOnWindowFocus,
    // Optimistic updates - try to get data from newsletter lists first
    initialData: () => {
      const listsData = getQueriesData<NewsletterWithRelations[]>(
        queryKeyFactory.newsletters.lists(),
      );

      for (const [, newsletters] of listsData) {
        if (newsletters) {
          const found = newsletters.find((n) => n.id === newsletterId);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      // Get the timestamp of when the list data was last updated
      const listsData = getQueriesData<NewsletterWithRelations[]>(
        queryKeyFactory.newsletters.lists(),
      );

      let latestUpdate = 0;
      for (const [queryKey, newsletters] of listsData) {
        if (newsletters) {
          const found = newsletters.find((n) => n.id === newsletterId);
          if (found) {
            const state = getQueryState(queryKey);
            latestUpdate = Math.max(latestUpdate, state?.dataUpdatedAt || 0);
          }
        }
      }

      return latestUpdate || 0;
    },
    // Retry configuration
    retry: (failureCount, error: Error) => {
      // Don't retry on 404 or authentication errors
      if (
        error?.message?.includes("not found") ||
        error?.message?.includes("authenticated")
      ) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Prefetch related data for better performance
  const prefetchRelated = useCallback(async (): Promise<void> => {
    if (!query.data || !user) return;

    const newsletter = query.data;
    const prefetchPromises: Promise<unknown>[] = [];

    // Prefetch tags if enabled and newsletter has tags
    if (prefetchTags && newsletter.tags && newsletter.tags.length > 0) {
      // Prefetch individual tag details
      newsletter.tags.forEach((tag) => {
        prefetchPromises.push(
          prefetchQuery(
            [...queryKeyFactory.newsletters.tag(tag.id)],
            async () => {
              const { data, error } = await supabase
                .from("tags")
                .select("*")
                .eq("id", tag.id)
                .eq("user_id", user.id)
                .single();

              if (error) throw error;
              return data;
            },
            { staleTime: 10 * 60 * 1000 }, // 10 minutes
          ),
        );
      });

      // Prefetch newsletters with same tags
      const tagIds = newsletter.tags.map((t) => t.id);
      if (tagIds.length > 0) {
        prefetchPromises.push(
          prefetchQuery(
            [...queryKeyFactory.newsletters.list({ tagIds })],
            async () => {
              const { data, error } = await supabase
                .from("newsletters")
                .select(
                  `
                    *,
                    source:newsletter_sources(*),
                    tags:newsletter_tags(tag:tags(*))
                  `,
                )
                .eq("user_id", user.id)
                .limit(20);

              if (error) throw error;

              return (
                data?.map((n: SupabaseNewsletterResponse) => ({
                  ...n,
                  source: n.source || null,
                  tags: n.tags?.map((t) => t.tag).filter(Boolean) || [],
                  newsletter_source_id: n.newsletter_source_id || null,
                })) || []
              );
            },
            { staleTime: 2 * 60 * 1000 }, // 2 minutes
          ),
        );
      }
    }

    // Prefetch source if enabled and newsletter has a source
    if (prefetchSource && newsletter.source) {
      prefetchPromises.push(
        prefetchQuery(
          [...queryKeyFactory.newsletters.source(newsletter.source.id)],
          async () => {
            const { data, error } = await supabase
              .from("newsletter_sources")
              .select("*")
              .eq("id", newsletter.source!.id)
              .eq("user_id", user.id)
              .single();

            if (error) throw error;
            return data;
          },
          { staleTime: 15 * 60 * 1000 }, // 15 minutes
        ),
      );

      // Prefetch other newsletters from same source
      prefetchPromises.push(
        prefetchQuery(
          [
            ...queryKeyFactory.newsletters.list({
              sourceId: newsletter.source.id,
            }),
          ],
          async () => {
            const { data, error } = await supabase
              .from("newsletters")
              .select(
                `
                *,
                source:newsletter_sources(*),
                tags:newsletter_tags(tag:tags(*))
              `,
              )
              .eq("user_id", user.id)
              .eq("newsletter_source_id", newsletter.source!.id)
              .order("received_at", { ascending: false })
              .limit(10);

            if (error) throw error;

            return (
              data?.map((n: SupabaseNewsletterResponse) => ({
                ...n,
                source: n.source || null,
                tags: n.tags?.map((t) => t.tag).filter(Boolean) || [],
                newsletter_source_id: n.newsletter_source_id || null,
              })) || []
            );
          },
          { staleTime: 2 * 60 * 1000 }, // 2 minutes
        ),
      );
    }

    // Execute all prefetch operations
    try {
      await Promise.allSettled(prefetchPromises);
    } catch (error) {
      console.warn("Some prefetch operations failed:", error);
      // Don't throw - prefetching failures shouldn't break the main functionality
    }
  }, [query.data, user, prefetchTags, prefetchSource]);

  // Enhanced refetch that also updates cache manager
  const refetch = useCallback(() => {
    // Refetch the main query
    const refetchPromise = query.refetch();

    // Update cache manager performance metrics
    if (cacheManager && user) {
      // Note: warmCache method not available in SimpleCacheManager
      // This is for future enhancement
      refetchPromise.then(() => {
        // Could add cache warming functionality here in the future
      });
    }

    return refetchPromise;
  }, [query, user, cacheManager]);

  return {
    newsletter: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    isFetching: query.isFetching,
    refetch,
    prefetchRelated,
  };
};

/**
 * Hook for prefetching newsletter details without subscribing to the query
 * Useful for hover states and anticipatory loading
 */
export const usePrefetchNewsletterDetail = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;

  const prefetchNewsletter = useCallback(
    async (newsletterId: string, options: { priority?: boolean } = {}) => {
      if (!user || !newsletterId) return;

      const { priority = false } = options;

      // Check if already cached and fresh
      const existingData = getQueryData(
        queryKeyFactory.newsletters.detail(newsletterId),
      );
      const queryState = getQueryState(
        queryKeyFactory.newsletters.detail(newsletterId),
      );

      // If we have fresh data, no need to prefetch
      if (
        existingData &&
        queryState?.dataUpdatedAt &&
        Date.now() - queryState.dataUpdatedAt < 5 * 60 * 1000
      ) {
        return;
      }

      try {
        await prefetchQuery(
          queryKeyFactory.newsletters.detail(newsletterId),
          async () => {
            const { data, error } = await supabase
              .from("newsletters")
              .select(
                `
                *,
                source:newsletter_sources(*),
                tags:newsletter_tags(tag:tags(*))
              `,
              )
              .eq("id", newsletterId)
              .eq("user_id", user.id)
              .single();

            if (error) throw error;

            const typedData = data as SupabaseNewsletterResponse;
            return {
              ...typedData,
              source: typedData.source || null,
              tags: typedData.tags?.map((t) => t.tag).filter(Boolean) || [],
              newsletter_source_id: typedData.newsletter_source_id || null,
            };
          },
          {
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Higher priority prefetches get longer cache time
            gcTime: priority ? 60 * 60 * 1000 : 30 * 60 * 1000,
          },
        );
      } catch (error) {
        console.warn(`Failed to prefetch newsletter ${newsletterId}:`, error);
        // Don't throw - prefetch failures shouldn't break the app
      }
    },
    [user],
  );

  return { prefetchNewsletter };
};
