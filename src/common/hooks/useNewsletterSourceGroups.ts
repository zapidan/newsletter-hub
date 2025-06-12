import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@common/services/supabaseClient";
import { NewsletterSourceGroup, NewsletterSource } from "@common/types";
import { useCache } from "./useCache";

export const useNewsletterSourceGroups = () => {
  const { batchInvalidate } = useCache();

  // Fetch all groups for the current user with source counts
  const { data: groups = [], ...query } = useQuery({
    queryKey: ["newsletterSourceGroups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_source_groups")
        .select(
          `
          *,
          sources:newsletter_source_group_members(source:newsletter_sources(*))
        `,
        )
        .order("name", { ascending: true });

      if (error) throw error;

      // Transform the data to match our types
      return (data || []).map((group) => ({
        ...group,
        sources:
          (
            group as unknown as { sources: { source: NewsletterSource }[] }
          ).sources?.map((s) => s.source) || [],
      })) as NewsletterSourceGroup[];
    },
  });

  // Create a new group with sources
  const createGroup = useMutation({
    mutationFn: async ({
      name,
      sourceIds,
    }: {
      name: string;
      sourceIds: string[];
    }) => {
      // Get the current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: group, error: groupError } = await supabase
        .from("newsletter_source_groups")
        .insert({
          name,
          user_id: user.id,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      if (sourceIds.length > 0) {
        const { error: membersError } = await supabase
          .from("newsletter_source_group_members")
          .insert(
            sourceIds.map((sourceId) => ({
              group_id: group.id,
              source_id: sourceId,
            })),
          );

        if (membersError) throw membersError;
      }

      return group as NewsletterSourceGroup;
    },
    onSuccess: () => {
      batchInvalidate([{ queryKey: ["newsletterSourceGroups"] }]);
    },
  });

  // Update a group
  const updateGroup = useMutation({
    mutationFn: async ({
      id,
      name,
      sourceIds,
    }: {
      id: string;
      name: string;
      sourceIds: string[];
    }) => {
      // Update the group name
      const { data: group, error: groupError } = await supabase
        .from("newsletter_source_groups")
        .update({ name })
        .eq("id", id)
        .select()
        .single();

      if (groupError) throw groupError;

      // Update group members
      // First, get current members
      const { data: currentMembers, error: membersError } = await supabase
        .from("newsletter_source_group_members")
        .select("source_id")
        .eq("group_id", id);

      if (membersError) throw membersError;

      const currentSourceIds = new Set(
        (currentMembers || []).map((m: { source_id: string }) => m.source_id),
      );
      const newSourceIds = new Set(sourceIds);

      // Find sources to add and remove
      const toAdd = sourceIds.filter((sid) => !currentSourceIds.has(sid));
      const toRemove = Array.from(currentSourceIds).filter(
        (sid) => !newSourceIds.has(sid),
      );

      // Perform updates
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from("newsletter_source_group_members")
          .insert(
            toAdd.map((sourceId) => ({
              group_id: id,
              source_id: sourceId,
            })),
          );
        if (addError) throw addError;
      }
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("newsletter_source_group_members")
          .delete()
          .eq("group_id", id)
          .in("source_id", toRemove);
        if (removeError) throw removeError;
      }

      return { ...group, sourceIds } as NewsletterSourceGroup;
    },
    onSuccess: () => {
      batchInvalidate([{ queryKey: ["newsletterSourceGroups"] }]);
    },
  });

  // Delete a group
  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("newsletter_source_groups")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      batchInvalidate([{ queryKey: ["newsletterSourceGroups"] }]);
    },
  });

  // Get a single group with its sources
  const getGroup = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("newsletter_source_groups")
        .select(
          `
          *,
          sources:newsletter_source_group_members(source:newsletter_sources(*))
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      return {
        ...data,
        sources:
          (
            data as unknown as { sources: { source: NewsletterSource }[] }
          ).sources?.map((s) => s.source) || [],
      } as NewsletterSourceGroup;
    },
  });

  // Add sources to a group
  const addSourcesToGroup = useMutation({
    mutationFn: async ({
      groupId,
      sourceIds,
    }: {
      groupId: string;
      sourceIds: string[];
    }) => {
      if (sourceIds.length === 0) return [];

      const { data, error } = await supabase
        .from("newsletter_source_group_members")
        .insert(
          sourceIds.map((sourceId) => ({
            group_id: groupId,
            source_id: sourceId,
          })),
        )
        .select("source:newsletter_sources(*)");

      if (error) throw error;

      return (data as unknown as { source: NewsletterSource }[]).map(
        (d) => d.source,
      ) as NewsletterSource[];
    },
    onSuccess: (_, variables) => {
      batchInvalidate([
        { queryKey: ["newsletterSourceGroups"] },
        { queryKey: ["newsletterSourceGroup", variables.groupId] },
      ]);
    },
  });

  // Remove sources from a group
  const removeSourcesFromGroup = useMutation({
    mutationFn: async ({
      groupId,
      sourceIds,
    }: {
      groupId: string;
      sourceIds: string[];
    }) => {
      if (sourceIds.length === 0) return [];

      const { error } = await supabase
        .from("newsletter_source_group_members")
        .delete()
        .eq("group_id", groupId)
        .in("source_id", sourceIds);

      if (error) throw error;
      return sourceIds;
    },
    onSuccess: (_, variables) => {
      batchInvalidate([
        { queryKey: ["newsletterSourceGroups"] },
        { queryKey: ["newsletterSourceGroup", variables.groupId] },
      ]);
    },
  });

  return {
    groups,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroup,
    addSourcesToGroup,
    removeSourcesFromGroup,
    ...query,
  } as const;
};
