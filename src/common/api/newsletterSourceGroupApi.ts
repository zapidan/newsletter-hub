import {
  supabase,
  handleSupabaseError,
  requireAuth,
  withPerformanceLogging,
} from "./supabaseClient";
import { NewsletterSourceGroup, NewsletterSource } from "../types";

// Transform raw Supabase response to NewsletterSourceGroup
const transformSourceGroup = (data: {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  sources?: { source: NewsletterSource }[];
}): NewsletterSourceGroup => {
  return {
    id: data.id,
    name: data.name,
    user_id: data.user_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    sources: data.sources?.map((s) => s.source).filter(Boolean) || [],
  };
};

// Newsletter Source Group API Service
export const newsletterSourceGroupApi = {
  // Get all groups for the current user with source counts
  async getAll(): Promise<NewsletterSourceGroup[]> {
    return withPerformanceLogging("newsletterSourceGroups.getAll", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("newsletter_source_groups")
        .select(
          `
          *,
          sources:newsletter_source_group_members(source:newsletter_sources(*))
        `,
        )
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) handleSupabaseError(error);

      return (data || []).map(transformSourceGroup);
    });
  },

  // Get a single group by ID with its sources
  async getById(id: string): Promise<NewsletterSourceGroup | null> {
    return withPerformanceLogging(
      "newsletterSourceGroups.getById",
      async () => {
        const user = await requireAuth();

        const { data, error } = await supabase
          .from("newsletter_source_groups")
          .select(
            `
          *,
          sources:newsletter_source_group_members(source:newsletter_sources(*))
        `,
          )
          .eq("id", id)
          .eq("user_id", user.id)
          .single();

        if (error) {
          if (error.code === "PGRST116") {
            return null; // Not found
          }
          handleSupabaseError(error);
        }

        return data ? transformSourceGroup(data) : null;
      },
    );
  },

  // Create a new group with sources
  async create(params: {
    name: string;
    sourceIds: string[];
  }): Promise<NewsletterSourceGroup> {
    return withPerformanceLogging("newsletterSourceGroups.create", async () => {
      const user = await requireAuth();
      const { name, sourceIds } = params;

      const { data: group, error: groupError } = await supabase
        .from("newsletter_source_groups")
        .insert({
          name,
          user_id: user.id,
        })
        .select()
        .single();

      if (groupError) handleSupabaseError(groupError);

      if (sourceIds.length > 0) {
        const { error: membersError } = await supabase
          .from("newsletter_source_group_members")
          .insert(
            sourceIds.map((sourceId) => ({
              group_id: group.id,
              source_id: sourceId,
            })),
          );

        if (membersError) handleSupabaseError(membersError);
      }

      // Fetch the complete group with sources
      const createdGroup = await this.getById(group.id);
      if (!createdGroup) {
        throw new Error("Failed to retrieve created group");
      }

      return createdGroup;
    });
  },

  // Update a group
  async update(params: {
    id: string;
    name: string;
    sourceIds: string[];
  }): Promise<NewsletterSourceGroup> {
    return withPerformanceLogging("newsletterSourceGroups.update", async () => {
      const user = await requireAuth();
      const { id, name, sourceIds } = params;

      // Update the group name
      const { error: groupError } = await supabase
        .from("newsletter_source_groups")
        .update({ name })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (groupError) handleSupabaseError(groupError);

      // Update group members
      // First, get current members
      const { data: currentMembers, error: membersError } = await supabase
        .from("newsletter_source_group_members")
        .select("source_id")
        .eq("group_id", id);

      if (membersError) handleSupabaseError(membersError);

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
        if (addError) handleSupabaseError(addError);
      }

      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("newsletter_source_group_members")
          .delete()
          .eq("group_id", id)
          .in("source_id", toRemove);
        if (removeError) handleSupabaseError(removeError);
      }

      // Fetch the updated group with sources
      const updatedGroup = await this.getById(id);
      if (!updatedGroup) {
        throw new Error("Failed to retrieve updated group");
      }

      return updatedGroup;
    });
  },

  // Delete a group
  async delete(id: string): Promise<boolean> {
    return withPerformanceLogging("newsletterSourceGroups.delete", async () => {
      const user = await requireAuth();

      const { error } = await supabase
        .from("newsletter_source_groups")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Add sources to a group
  async addSources(params: {
    groupId: string;
    sourceIds: string[];
  }): Promise<NewsletterSource[]> {
    return withPerformanceLogging(
      "newsletterSourceGroups.addSources",
      async () => {
        const { groupId, sourceIds } = params;

        if (sourceIds.length === 0) return [];

        // Verify group ownership
        const group = await this.getById(groupId);
        if (!group) {
          throw new Error("Group not found");
        }

        const { data, error } = await supabase
          .from("newsletter_source_group_members")
          .insert(
            sourceIds.map((sourceId) => ({
              group_id: groupId,
              source_id: sourceId,
            })),
          )
          .select("source:newsletter_sources(*)");

        if (error) handleSupabaseError(error);

        return (
          (data as unknown as { source: NewsletterSource }[])?.map(
            (d) => d.source,
          ) || []
        );
      },
    );
  },

  // Remove sources from a group
  async removeSources(params: {
    groupId: string;
    sourceIds: string[];
  }): Promise<boolean> {
    return withPerformanceLogging(
      "newsletterSourceGroups.removeSources",
      async () => {
        const { groupId, sourceIds } = params;

        if (sourceIds.length === 0) return true;

        // Verify group ownership
        const group = await this.getById(groupId);
        if (!group) {
          throw new Error("Group not found");
        }

        const { error } = await supabase
          .from("newsletter_source_group_members")
          .delete()
          .eq("group_id", groupId)
          .in("source_id", sourceIds);

        if (error) handleSupabaseError(error);
        return true;
      },
    );
  },

  // Get all sources for a specific group
  async getGroupSources(groupId: string): Promise<NewsletterSource[]> {
    return withPerformanceLogging(
      "newsletterSourceGroups.getGroupSources",
      async () => {
        // Verify group ownership
        const group = await this.getById(groupId);
        if (!group) {
          throw new Error("Group not found");
        }

        const { data, error } = await supabase
          .from("newsletter_source_group_members")
          .select("source:newsletter_sources(*)")
          .eq("group_id", groupId);

        if (error) handleSupabaseError(error);

        return (
          (data as unknown as { source: NewsletterSource }[])
            ?.map((d) => d.source)
            .filter(Boolean) || []
        );
      },
    );
  },

  // Check if a source belongs to any group
  async getSourceGroups(sourceId: string): Promise<NewsletterSourceGroup[]> {
    return withPerformanceLogging(
      "newsletterSourceGroups.getSourceGroups",
      async () => {
        const user = await requireAuth();

        const { data, error } = await supabase
          .from("newsletter_source_group_members")
          .select(
            `
          group:newsletter_source_groups(
            *,
            sources:newsletter_source_group_members(source:newsletter_sources(*))
          )
        `,
          )
          .eq("source_id", sourceId)
          .eq("group.user_id", user.id);

        if (error) handleSupabaseError(error);

        return (
          (
            data as unknown as {
              group: {
                id: string;
                name: string;
                user_id: string;
                created_at: string;
                updated_at: string;
                sources?: { source: NewsletterSource }[];
              };
            }[]
          )
            ?.map((d) => transformSourceGroup(d.group))
            .filter(Boolean) || []
        );
      },
    );
  },

  // Get group statistics
  async getStats(): Promise<{
    totalGroups: number;
    totalSources: number;
    averageSourcesPerGroup: number;
    groupsWithoutSources: number;
  }> {
    return withPerformanceLogging(
      "newsletterSourceGroups.getStats",
      async () => {
        const groups = await this.getAll();

        const stats = {
          totalGroups: groups.length,
          totalSources: groups.reduce(
            (sum, group) => sum + (group.sources?.length || 0),
            0,
          ),
          averageSourcesPerGroup:
            groups.length > 0
              ? groups.reduce(
                  (sum, group) => sum + (group.sources?.length || 0),
                  0,
                ) / groups.length
              : 0,
          groupsWithoutSources: groups.filter(
            (group) => (group.sources?.length || 0) === 0,
          ).length,
        };

        return stats;
      },
    );
  },

  // Search groups by name
  async search(query: string): Promise<NewsletterSourceGroup[]> {
    return withPerformanceLogging("newsletterSourceGroups.search", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("newsletter_source_groups")
        .select(
          `
          *,
          sources:newsletter_source_group_members(source:newsletter_sources(*))
        `,
        )
        .eq("user_id", user.id)
        .ilike("name", `%${query}%`)
        .order("name", { ascending: true });

      if (error) handleSupabaseError(error);

      return (data || []).map(transformSourceGroup);
    });
  },
};

// Export individual functions for backward compatibility
export const {
  getAll: getAllNewsletterSourceGroups,
  getById: getNewsletterSourceGroupById,
  create: createNewsletterSourceGroup,
  update: updateNewsletterSourceGroup,
  delete: deleteNewsletterSourceGroup,
  addSources: addSourcesToGroup,
  removeSources: removeSourcesFromGroup,
  getGroupSources,
  getSourceGroups,
  getStats: getNewsletterSourceGroupStats,
  search: searchNewsletterSourceGroups,
} = newsletterSourceGroupApi;

export default newsletterSourceGroupApi;
