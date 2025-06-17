import { useState, useCallback, useContext, useMemo } from "react";
import { supabase } from "@common/services/supabaseClient";
import { AuthContext } from "@common/contexts/AuthContext";
import { Tag, TagCreate, TagUpdate } from "@common/types";
import {
  getCacheManagerSafe,
  invalidateQueries,
} from "@common/utils/cacheUtils";
import { queryKeyFactory } from "@common/utils/queryKeyFactory";
import { tagApi } from "@common/api/tagApi";
import { useLogger } from "@common/utils/logger";

export const useTags = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const log = useLogger();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize cache manager safely
  const cacheManager = useMemo(() => {
    return getCacheManagerSafe();
  }, []);

  // Safe cache manager helper
  const safeCacheCall = useCallback(
    (
      fn: (
        manager: NonNullable<ReturnType<typeof getCacheManagerSafe>>,
      ) => void,
    ) => {
      if (cacheManager) {
        fn(cacheManager);
      }
    },
    [cacheManager],
  );

  // Get all tags for the current user
  const getTags = useCallback(async (): Promise<Tag[]> => {
    if (!user) return [];

    try {
      setLoading(true);
      return await tagApi.getAll();
    } catch (err: unknown) {
      const error = err as Error;
      log.error(
        "Failed to fetch tags",
        {
          action: "fetch_tags",
          metadata: { userId: user?.id },
        },
        error,
      );
      setError(error.message || "Failed to load tags");
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Create a new tag
  const createTag = useCallback(
    async (tag: TagCreate): Promise<Tag | null> => {
      if (!user) return null;

      try {
        setLoading(true);
        const data = await tagApi.create(tag);

        // Use cache manager for better tag cache management
        safeCacheCall((manager) => {
          manager.invalidateRelatedQueries([], "tag-create");
          manager.invalidateTagQueries();
        });
        if (!cacheManager) {
          // Fallback to cache utils
          await invalidateQueries({
            queryKey: queryKeyFactory.newsletters.tags(),
          });
          await invalidateQueries({ queryKey: ["newsletter_tags"] });
        }

        return data;
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          "Failed to create tag",
          {
            action: "create_tag",
            metadata: {
              userId: user?.id,
              tagName: tagData.name,
              tagColor: tagData.color,
            },
          },
          error,
        );
        setError(error.message || "Failed to create tag");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, cacheManager, safeCacheCall],
  );

  // Update an existing tag
  const updateTag = useCallback(
    async (tag: TagUpdate): Promise<Tag | null> => {
      if (!user) return null;

      try {
        setLoading(true);
        const data = await tagApi.update(tag);

        // Use cache manager for cross-feature cache synchronization
        safeCacheCall((manager) => {
          manager.invalidateRelatedQueries([data.id], "tag-update");
          manager.invalidateTagQueries();
        });
        if (!cacheManager) {
          // Fallback to cache utils
          await invalidateQueries({
            queryKey: queryKeyFactory.newsletters.tags(),
          });
          await invalidateQueries({ queryKey: ["newsletter_tags"] });
          await invalidateQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
          });
        }

        return data;
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          "Failed to update tag",
          {
            action: "update_tag",
            metadata: {
              userId: user?.id,
              tagId: id,
              updateFields: Object.keys(updates),
            },
          },
          error,
        );
        setError(error.message || "Failed to update tag");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, cacheManager, safeCacheCall],
  );

  // Delete a tag
  const deleteTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        setLoading(true);
        await tagApi.delete(tagId);

        // Use cache manager for comprehensive tag deletion cache management
        safeCacheCall((manager) => {
          manager.invalidateRelatedQueries([tagId], "tag-delete");
          manager.removeTagFromAllNewsletters(tagId);
        });
        if (!cacheManager) {
          // Fallback to cache utils
          await invalidateQueries({
            predicate: (query: { queryKey: unknown[] }) => {
              return (
                queryKeyFactory.matchers?.isAffectedByTagChange?.(
                  query.queryKey as unknown[],
                  tagId,
                ) || false
              );
            },
            refetchType: "active",
          });
          await invalidateQueries({
            queryKey: queryKeyFactory.newsletters.tags(),
          });
          await invalidateQueries({ queryKey: ["newsletter_tags"] });
          await invalidateQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
          });
        }

        return true;
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          "Failed to delete tag",
          {
            action: "delete_tag",
            metadata: {
              userId: user?.id,
              tagId: id,
            },
          },
          error,
        );
        setError(error.message || "Failed to delete tag");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, cacheManager, safeCacheCall],
  );

  // Get tags for a specific newsletter
  const getTagsForNewsletter = useCallback(
    async (newsletterId: string): Promise<Tag[]> => {
      if (!user) return [];

      try {
        setLoading(true);
        return await tagApi.getTagsForNewsletter(newsletterId);
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          "Failed to fetch newsletter tags",
          {
            action: "fetch_newsletter_tags",
            metadata: {
              userId: user?.id,
              newsletterId,
            },
          },
          error,
        );
        setError(error.message || "Failed to load newsletter tags");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  // Update tags for a newsletter
  const updateNewsletterTags = useCallback(
    async (newsletterId: string, tags: Tag[]) => {
      if (!user) return false;

      try {
        setLoading(true);
        await tagApi.updateNewsletterTags(newsletterId, tags);

        // Use cache manager for newsletter-tag relationship updates
        safeCacheCall((manager) => {
          manager.updateNewsletterTagsInCache(newsletterId, tags);
          manager.invalidateRelatedQueries([], "newsletter-tag-update");
        });

        if (!cacheManager) {
          // Fallback to cache utils
          await invalidateQueries({
            queryKey: queryKeyFactory.newsletters.detail(newsletterId),
          });
          await invalidateQueries({ queryKey: ["newsletter_tags"] });
          await invalidateQueries({
            queryKey: queryKeyFactory.newsletters.lists(),
          });
          await invalidateQueries({
            queryKey: queryKeyFactory.newsletters.tags(),
          });
        }

        return true;
      } catch (err: unknown) {
        const error = err as Error;
        log.error(
          "Failed to update newsletter tags",
          {
            action: "update_newsletter_tags",
            metadata: {
              userId: user?.id,
              newsletterId,
              tagIds: tagIds.length,
            },
          },
          error,
        );
        setError(error.message || "Failed to update newsletter tags");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, cacheManager, safeCacheCall],
  );

  return {
    loading,
    error,
    getTags,
    createTag,
    updateTag,
    deleteTag,
    getTagsForNewsletter,
    updateNewsletterTags,
  };
};
