import { useMutation, useQuery } from "@tanstack/react-query";
import { useCache } from "./useCache";
import { newsletterSourceGroupApi } from "@common/api/newsletterSourceGroupApi";

export const useNewsletterSourceGroups = () => {
  const { batchInvalidate } = useCache();

  // Fetch all groups for the current user with source counts
  const { data: groups = [], ...query } = useQuery({
    queryKey: ["newsletterSourceGroups"],
    queryFn: async () => {
      return await newsletterSourceGroupApi.getAll();
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
      return await newsletterSourceGroupApi.create({ name, sourceIds });
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
      return await newsletterSourceGroupApi.update({ id, name, sourceIds });
    },
    onSuccess: () => {
      batchInvalidate([{ queryKey: ["newsletterSourceGroups"] }]);
    },
  });

  // Delete a group
  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      await newsletterSourceGroupApi.delete(id);
      return id;
    },
    onSuccess: () => {
      batchInvalidate([{ queryKey: ["newsletterSourceGroups"] }]);
    },
  });

  // Get a single group with its sources
  const getGroup = useMutation({
    mutationFn: async (id: string) => {
      return await newsletterSourceGroupApi.getById(id);
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
      return await newsletterSourceGroupApi.addSources({ groupId, sourceIds });
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
      await newsletterSourceGroupApi.removeSources({ groupId, sourceIds });
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
