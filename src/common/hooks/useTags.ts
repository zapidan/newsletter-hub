import { useState, useCallback, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@common/services/supabaseClient";
import { AuthContext } from "@common/contexts/AuthContext";
import { Tag, TagCreate, TagUpdate } from "@common/types";
import { getCacheManager } from "@common/utils/cacheUtils";
import { queryKeyFactory } from "@common/utils/queryKeyFactory";

export const useTags = () => {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheManager = getCacheManager();

  // Get all tags for the current user
  const getTags = useCallback(async (): Promise<Tag[]> => {
    if (!user) return [];

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .eq("user_id", user.id)
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error fetching tags:", error);
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
        const { data, error } = await supabase
          .from("tags")
          .insert([{ ...tag, user_id: user.id }])
          .select()
          .single();

        if (error) throw error;

        // Use cache manager for better tag cache management
        if (cacheManager) {
          cacheManager.invalidateTagQueries();
        } else {
          // Fallback to manual invalidation
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: queryKeyFactory.newsletters.tags(),
            }),
            queryClient.invalidateQueries({ queryKey: ["newsletter_tags"] }),
          ]);
        }

        return data;
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error creating tag:", error);
        setError(error.message || "Failed to create tag");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient, cacheManager],
  );

  // Update an existing tag
  const updateTag = useCallback(
    async (tag: TagUpdate): Promise<Tag | null> => {
      if (!user) return null;

      try {
        setLoading(true);
        const { id, ...updates } = tag;
        const { data, error } = await supabase
          .from("tags")
          .update(updates)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (error) throw error;

        // Use cache manager for cross-feature cache synchronization
        if (cacheManager) {
          cacheManager.handleTagUpdate(data.id, data, {
            invalidateRelated: true,
          });
        } else {
          // Fallback to manual invalidation
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: queryKeyFactory.newsletters.tags(),
            }),
            queryClient.invalidateQueries({ queryKey: ["newsletter_tags"] }),
            queryClient.invalidateQueries({
              queryKey: queryKeyFactory.newsletters.lists(),
            }),
          ]);
        }

        return data;
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error updating tag:", error);
        setError(error.message || "Failed to update tag");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient, cacheManager],
  );

  // Delete a tag
  const deleteTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      if (!user) return false;

      try {
        setLoading(true);
        const { error } = await supabase
          .from("tags")
          .delete()
          .eq("id", tagId)
          .eq("user_id", user.id);

        if (error) throw error;

        // Use cache manager for comprehensive tag deletion cache management
        if (cacheManager) {
          cacheManager.invalidateTagQueries([tagId]);
          // Also invalidate any newsletter lists that might have been filtered by this tag
          queryClient.invalidateQueries({
            predicate: (query) => {
              return queryKeyFactory.matchers.isAffectedByTagChange(
                query.queryKey as unknown[],
                tagId,
              );
            },
            refetchType: "active",
          });
        } else {
          // Fallback to manual invalidation
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: queryKeyFactory.newsletters.tags(),
            }),
            queryClient.invalidateQueries({ queryKey: ["newsletter_tags"] }),
            queryClient.invalidateQueries({
              queryKey: queryKeyFactory.newsletters.lists(),
            }),
          ]);
        }

        return true;
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error deleting tag:", error);
        setError(error.message || "Failed to delete tag");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient, cacheManager],
  );

  // Get tags for a specific newsletter
  interface NewsletterTagJoin {
    tag: Tag;
  }

  const getTagsForNewsletter = useCallback(
    async (newsletterId: string): Promise<Tag[]> => {
      if (!user) return [];

      try {
        setLoading(true);
        const { data, error } = (await supabase
          .from("newsletter_tags")
          .select("tag:tags(*)")
          .eq("newsletter_id", newsletterId)) as {
          data: NewsletterTagJoin[] | null;
          error: Error | null;
        };

        if (error) throw error;
        return data?.map((item) => item.tag) || [];
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error fetching newsletter tags:", error);
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

        // Get current tags
        const { data: currentTags, error: currentTagsError } = await supabase
          .from("newsletter_tags")
          .select("tag_id")
          .eq("newsletter_id", newsletterId);

        if (currentTagsError) throw currentTagsError;

        // Compute tags to add and remove
        const currentTagIds = (currentTags || []).map(
          (t: { tag_id: string }) => t.tag_id,
        );
        const newTagIds = tags.map((tag) => tag.id);
        const tagsToAdd = newTagIds.filter(
          (id: string) => !currentTagIds.includes(id),
        );
        const tagsToRemove = currentTagIds.filter(
          (id: string) => !newTagIds.includes(id),
        );

        // Add new tags
        if (tagsToAdd.length > 0) {
          const { error: addError } = await supabase
            .from("newsletter_tags")
            .insert(
              tagsToAdd.map((tagId) => ({
                newsletter_id: newsletterId,
                tag_id: tagId,
                user_id: user.id,
              })),
            );

          if (addError) throw addError;
        }

        // Remove tags
        if (tagsToRemove.length > 0) {
          const { error: removeError } = await supabase
            .from("newsletter_tags")
            .delete()
            .eq("newsletter_id", newsletterId)
            .in("tag_id", tagsToRemove);

          if (removeError) throw removeError;
        }

        // Use cache manager for newsletter-tag relationship updates
        if (cacheManager) {
          // Update the specific newsletter in cache with new tags
          cacheManager.updateNewsletterInCache({
            id: newsletterId,
            updates: { tags },
          });

          // Invalidate tag-related queries
          cacheManager.invalidateTagQueries();

          // Invalidate newsletter detail if it exists
          queryClient.invalidateQueries({
            queryKey: queryKeyFactory.newsletters.detail(newsletterId),
          });
        } else {
          // Fallback to manual invalidation
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["newsletter_tags"] }),
            queryClient.invalidateQueries({
              queryKey: queryKeyFactory.newsletters.lists(),
            }),
            queryClient.invalidateQueries({
              queryKey: queryKeyFactory.newsletters.tags(),
            }),
            queryClient.invalidateQueries({
              queryKey: queryKeyFactory.newsletters.detail(newsletterId),
            }),
          ]);
        }

        return true;
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error updating newsletter tags:", error);
        setError(error.message || "Failed to update newsletter tags");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, queryClient, cacheManager],
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
