import { NewsletterGroup, NewsletterSource } from "../types";
import {
  handleSupabaseError,
  requireAuth,
  supabase,
  withPerformanceLogging,
} from "./supabaseClient";

const DEFAULT_GROUP_COLOR = "#3b82f6";
const GROUPS_TABLE = 'newsletter_source_groups';
const GROUP_MEMBERS_TABLE = 'newsletter_source_group_members';

/**
 * Groups are associated with newsletter_sources. Newsletters inherit group
 * membership from their source (newsletter_source_id).
 */
function transformGroup(data: {
  id: string;
  name: string;
  color: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  sources?: { source: NewsletterSource }[];
}): NewsletterGroup {
  return {
    id: data.id,
    name: data.name,
    color: data.color ?? DEFAULT_GROUP_COLOR,
    user_id: data.user_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    sources: data.sources?.map((s) => s.source).filter(Boolean) ?? [],
  };
}

export const newsletterGroupApi = {
  async getAll(): Promise<NewsletterGroup[]> {
    return withPerformanceLogging("newsletterGroups.getAll", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from(GROUPS_TABLE)
        .select(
          `
          *,
          sources:${GROUP_MEMBERS_TABLE}(source:newsletter_sources(*))
        `
        )
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) handleSupabaseError(error);

      return (data || []).map(transformGroup);
    });
  },

  async getById(id: string): Promise<NewsletterGroup | null> {
    return withPerformanceLogging("newsletterGroups.getById", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from(GROUPS_TABLE)
        .select(
          `
          *,
          sources:${GROUP_MEMBERS_TABLE}(source:newsletter_sources(*))
        `
        )
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        handleSupabaseError(error);
      }

      return data ? transformGroup(data) : null;
    });
  },

  async create(params: {
    name: string;
    color?: string;
    sourceIds?: string[];
  }): Promise<NewsletterGroup> {
    return withPerformanceLogging("newsletterGroups.create", async () => {
      const user = await requireAuth();
      const { name, color = DEFAULT_GROUP_COLOR, sourceIds = [] } = params;

      const { data: group, error: groupError } = await supabase
        .from(GROUPS_TABLE)
        .insert({ name, color, user_id: user.id })
        .select()
        .single();

      if (groupError) handleSupabaseError(groupError);

      if (sourceIds.length > 0) {
        // Validate all sources exist and are owned by the user
        const { data: validSources, error: sourcesError } = await supabase
          .from('newsletter_sources')
          .select('id')
          .in('id', sourceIds)
          .eq('user_id', user.id);

        if (sourcesError) handleSupabaseError(sourcesError);
        if (!validSources || validSources.length !== sourceIds.length) {
          throw new Error('One or more sources not found or access denied');
        }

        const { error: membersError } = await supabase
          .from(GROUP_MEMBERS_TABLE)
          .insert(
            sourceIds.map((sourceId) => ({
              group_id: group.id,
              source_id: sourceId,
              user_id: user.id  // Explicitly set user_id
            }))
          );

        if (membersError) {
          if (membersError.code === '23514' && membersError.message.includes('cannot belong to more than 10')) {
            throw new Error('A source cannot belong to more than 10 groups');
          }
          handleSupabaseError(membersError);
        }
      }

      const created = await this.getById(group.id);
      if (!created) throw new Error("Failed to retrieve created group");
      return created;
    });
  },

  async update(params: {
    id: string;
    name?: string;
    color?: string;
    sourceIds?: string[];
  }): Promise<NewsletterGroup> {
    return withPerformanceLogging("newsletterGroups.update", async () => {
      const user = await requireAuth();
      const { id, name, color, sourceIds } = params;

      const updates: { name?: string; color?: string } = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;

      if (Object.keys(updates).length > 0) {
        // First validate all sources exist and are owned by the user if sourceIds is provided
        if (sourceIds && sourceIds.length > 0) {
          const { data: validSources, error: sourcesError } = await supabase
            .from('newsletter_sources')
            .select('id')
            .in('id', sourceIds)
            .eq('user_id', user.id);

          if (sourcesError) handleSupabaseError(sourcesError);
          if (!validSources || validSources.length !== sourceIds.length) {
            throw new Error('One or more sources not found or access denied');
          }
        }

        const { data: _group, error: groupError } = await supabase
          .from(GROUPS_TABLE)
          .update({ name, color })
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single();

        if (groupError) handleSupabaseError(groupError);

        // Handle source updates if provided
        if (sourceIds) {
          // First, get existing sources for the group
          const { data: existingSources, error: fetchError } = await supabase
            .from(GROUP_MEMBERS_TABLE)
            .select("source_id")
            .eq("group_id", id);

          if (fetchError) handleSupabaseError(fetchError);

          const existingSourceIds = existingSources?.map((s) => s.source_id) || [];
          const sourcesToAdd = sourceIds.filter((id) => !existingSourceIds.includes(id));
          const sourcesToRemove = existingSourceIds.filter((id) => !sourceIds.includes(id));

          // Add new sources
          if (sourcesToAdd.length > 0) {
            const { error: addError } = await supabase
              .from(GROUP_MEMBERS_TABLE)
              .insert(
                sourcesToAdd.map((sourceId) => ({
                  group_id: id,
                  source_id: sourceId,
                  user_id: user.id  // Explicitly set user_id
                }))
              );

            if (addError) {
              if (addError.code === '23514' && addError.message.includes('cannot belong to more than 10')) {
                throw new Error('A source cannot belong to more than 10 groups');
              }
              handleSupabaseError(addError);
            }
          }

          // Remove old sources
          if (sourcesToRemove.length > 0) {
            const { error: removeError } = await supabase
              .from(GROUP_MEMBERS_TABLE)
              .delete()
              .eq("group_id", id)
              .in("source_id", sourcesToRemove);

            if (removeError) handleSupabaseError(removeError);
          }
        }
      }

      const updated = await this.getById(id);
      if (!updated) throw new Error("Failed to retrieve updated group");
      return updated;
    });
  },

  async delete(id: string): Promise<boolean> {
    return withPerformanceLogging("newsletterGroups.delete", async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from(GROUPS_TABLE)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  /** Add sources to a group. Validates source ownership via RLS. */
  async addSources(params: {
    groupId: string;
    sourceIds: string[];
  }): Promise<NewsletterSource[]> {
    return withPerformanceLogging(
      "newsletterGroups.addSources",
      async () => {
        const { groupId, sourceIds } = params;
        if (sourceIds.length === 0) return [];

        const group = await this.getById(groupId);
        if (!group) throw new Error("Group not found");

        const user = await requireAuth();
        // First validate all sources exist and are owned by the user
        const { data: validSources, error: sourcesError } = await supabase
          .from('newsletter_sources')
          .select('id')
          .in('id', sourceIds)
          .eq('user_id', user.id);

        if (sourcesError) handleSupabaseError(sourcesError);
        if (!validSources || validSources.length !== sourceIds.length) {
          throw new Error('One or more sources not found or access denied');
        }

        const { data, error } = await supabase
          .from(GROUP_MEMBERS_TABLE)
          .insert(
            sourceIds.map((sourceId) => ({
              group_id: groupId,
              source_id: sourceId,
              user_id: user.id  // Explicitly set user_id
            }))
          )
          .select("source:newsletter_sources(*)");

        if (error) {
          if (error.code === '23514' && error.message.includes('cannot belong to more than 10')) {
            throw new Error('A source cannot belong to more than 10 groups');
          }
          handleSupabaseError(error);
        }

        return (
          (data as unknown as { source: NewsletterSource }[])?.map((d) => d.source).filter(Boolean) ?? []
        );
      }
    );
  },

  /** Remove sources from a group. */
  async removeSources(params: {
    groupId: string;
    sourceIds: string[];
  }): Promise<boolean> {
    return withPerformanceLogging(
      "newsletterGroups.removeSources",
      async () => {
        const { groupId, sourceIds } = params;
        if (sourceIds.length === 0) return true;

        const group = await this.getById(groupId);
        if (!group) throw new Error("Group not found");

        const { error } = await supabase
          .from(GROUP_MEMBERS_TABLE)
          .delete()
          .eq("group_id", groupId)
          .in("source_id", sourceIds);

        if (error) handleSupabaseError(error);
        return true;
      }
    );
  },

  /** Get all sources in a group. */
  async getGroupSources(groupId: string): Promise<NewsletterSource[]> {
    return withPerformanceLogging(
      "newsletterGroups.getGroupSources",
      async () => {
        const user = await requireAuth();
        const group = await this.getById(groupId);
        if (!group) throw new Error("Group not found");

        const { data, error } = await supabase
          .from(GROUP_MEMBERS_TABLE)
          .select("source:newsletter_sources(*)")
          .eq("group_id", groupId)
          .eq('newsletter_sources.user_id', user.id);  // Ensure source ownership

        if (error) handleSupabaseError(error);

        return (
          (data as unknown as { source: NewsletterSource }[])
            ?.map((d) => d.source)
            .filter(Boolean) ?? []
        );
      }
    );
  },

  /** Get all groups that contain the given source. Newsletters inherit group membership from their source. */
  async getSourceGroups(sourceId: string): Promise<NewsletterGroup[]> {
    return withPerformanceLogging(
      "newsletterGroups.getSourceGroups",
      async () => {
        const user = await requireAuth();

        const { data, error } = await supabase
          .from(GROUP_MEMBERS_TABLE)
          .select(
            `
            group:${GROUPS_TABLE}!inner(*)
          `
          )
          .eq("source_id", sourceId)
          .eq('group.user_id', user.id);  // Ensure group ownership

        if (error) handleSupabaseError(error);

        type Row = { group: Parameters<typeof transformGroup>[0] | null };
        const rows = (data as unknown as Row[]) ?? [];
        return rows
          .map((d) => d.group)
          .filter((g): g is NonNullable<typeof g> => g != null)
          .map(transformGroup);
      }
    );
  },

  /** Set the groups for a source. Replaces existing memberships. Validates source ownership via RLS. */
  async updateSourceGroups(
    sourceId: string,
    groupIds: string[]
  ): Promise<NewsletterGroup[]> {
    return withPerformanceLogging(
      "newsletterGroups.updateSourceGroups",
      async () => {
        const user = await requireAuth();
        if (groupIds.length > 10) {
          throw new Error('A source cannot belong to more than 10 groups');
        }

        const { data: current } = await supabase
          .from(GROUP_MEMBERS_TABLE)
          .select("group_id, source_id")
          .eq("source_id", sourceId);

        const currentGroupIds = new Set(
          (current || []).map((m: { group_id: string }) => m.group_id)
        );
        const newGroupIds = new Set(groupIds);

        const toAdd = groupIds.filter((gid) => !currentGroupIds.has(gid));
        const toRemove = Array.from(currentGroupIds).filter((gid) => !newGroupIds.has(gid));

        if (toAdd.length > 0) {
          const { error: addErr } = await supabase
            .from(GROUP_MEMBERS_TABLE)
            .insert(
              toAdd.map((group_id) => ({ group_id, source_id: sourceId, user_id: user.id }))
            );
          if (addErr) handleSupabaseError(addErr);
        }

        if (toRemove.length > 0) {
          const { error: delErr } = await supabase
            .from(GROUP_MEMBERS_TABLE)
            .delete()
            .eq("source_id", sourceId)
            .in("group_id", toRemove);
          if (delErr) handleSupabaseError(delErr);
        }

        return this.getSourceGroups(sourceId);
      }
    );
  },

  async getStats(): Promise<{
    totalGroups: number;
    totalSources: number;
    averageSourcesPerGroup: number;
    groupsWithoutSources: number;
  }> {
    return withPerformanceLogging("newsletterGroups.getStats", async () => {
      const groups = await this.getAll();
      const totalSources = groups.reduce(
        (sum, g) => sum + (g.sources?.length ?? 0),
        0
      );
      return {
        totalGroups: groups.length,
        totalSources,
        averageSourcesPerGroup:
          groups.length > 0 ? totalSources / groups.length : 0,
        groupsWithoutSources: groups.filter(
          (g) => (g.sources?.length ?? 0) === 0
        ).length,
      };
    });
  },

  async search(query: string): Promise<NewsletterGroup[]> {
    return withPerformanceLogging("newsletterGroups.search", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from(GROUPS_TABLE)
        .select(
          `
          *,
          sources:${GROUP_MEMBERS_TABLE}(source:newsletter_sources(*))
        `
        )
        .eq("user_id", user.id)
        .ilike("name", `%${query}%`)
        .order("name", { ascending: true });

      if (error) handleSupabaseError(error);

      return (data || []).map(transformGroup);
    });
  },
};

export const getAllNewsletterGroups = newsletterGroupApi.getAll;
export const getNewsletterGroupById = newsletterGroupApi.getById;
export const createNewsletterGroup = newsletterGroupApi.create;
export const updateNewsletterGroup = newsletterGroupApi.update;
export const deleteNewsletterGroup = newsletterGroupApi.delete;
export const addSourcesToGroup = newsletterGroupApi.addSources;
export const removeSourcesFromGroup = newsletterGroupApi.removeSources;
export const getGroupSources = newsletterGroupApi.getGroupSources;
export const getSourceGroups = newsletterGroupApi.getSourceGroups;
export const updateSourceGroups = newsletterGroupApi.updateSourceGroups;
export const getNewsletterGroupStats = newsletterGroupApi.getStats;
export const searchNewsletterGroups = newsletterGroupApi.search;

export default newsletterGroupApi;
