import { useMutation, useQuery } from '@tanstack/react-query';
import { useCache } from './useCache';
import { newsletterSourceGroupService } from '@common/services';

export const useNewsletterSourceGroups = () => {
  const { batchInvalidate } = useCache();

  // Fetch all groups for the current user with source counts
  const { data: groups = [], ...query } = useQuery({
    queryKey: ['newsletterSourceGroups'],
    queryFn: async () => {
      return await newsletterSourceGroupService.getGroups();
    },
  });

  // Create a new group with sources
  const createGroup = useMutation({
    mutationFn: async ({ name, sourceIds }: { name: string; sourceIds: string[] }) => {
      const result = await newsletterSourceGroupService.createGroup({ name, sourceIds });
      if (!result.success) {
        throw new Error(result.error || 'Failed to create group');
      }
      return result.group;
    },
    onSuccess: () => {
      batchInvalidate([{ queryKey: ['newsletterSourceGroups'] }]);
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
      name?: string;
      sourceIds?: string[];
    }) => {
      const result = await newsletterSourceGroupService.updateGroup(id, { name, sourceIds });
      if (!result.success) {
        throw new Error(result.error || 'Failed to update group');
      }
      return result.group;
    },
    onSuccess: () => {
      batchInvalidate([{ queryKey: ['newsletterSourceGroups'] }]);
    },
  });

  // Delete a group
  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const result = await newsletterSourceGroupService.deleteGroup(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete group');
      }
      return result.success;
    },
    onSuccess: () => {
      batchInvalidate([{ queryKey: ['newsletterSourceGroups'] }]);
    },
  });

  // Get a single group with its sources
  // Get a single group
  const getGroup = useMutation({
    mutationFn: async (id: string) => {
      return await newsletterSourceGroupService.getGroup(id);
    },
  });

  // Add sources to a group
  const addSourcesToGroup = useMutation({
    mutationFn: async ({ groupId, sourceIds }: { groupId: string; sourceIds: string[] }) => {
      const result = await newsletterSourceGroupService.addSourcesToGroup(groupId, sourceIds);
      if (!result.success) {
        throw new Error(result.error || 'Failed to add sources to group');
      }
      return result.group;
    },
    onSuccess: (_, variables) => {
      batchInvalidate([
        { queryKey: ['newsletterSourceGroups'] },
        { queryKey: ['newsletterSourceGroup', variables.groupId] },
      ]);
    },
  });

  // Remove sources from a group
  const removeSourcesFromGroup = useMutation({
    mutationFn: async ({ groupId, sourceIds }: { groupId: string; sourceIds: string[] }) => {
      const result = await newsletterSourceGroupService.removeSourcesFromGroup(groupId, sourceIds);
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove sources from group');
      }
      return sourceIds;
    },
    onSuccess: (_, variables) => {
      batchInvalidate([
        { queryKey: ['newsletterSourceGroups'] },
        { queryKey: ['newsletterSourceGroup', variables.groupId] },
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
