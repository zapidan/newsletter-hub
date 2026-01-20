import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newsletterGroupApi } from '../../api/newsletterGroupApi';
import { NewsletterGroup } from '../../types';
import { NewsletterGroupService } from '../newsletterGroup/NewsletterGroupService';

vi.mock('../../api/newsletterGroupApi');

const mockApi = vi.mocked(newsletterGroupApi);

const mockGroup: NewsletterGroup = {
  id: 'group-1',
  name: 'Tech',
  color: '#3b82f6',
  user_id: 'user-123',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  sources: [],
};

describe('NewsletterGroupService', () => {
  let service: NewsletterGroupService;

  beforeEach(() => {
    service = new NewsletterGroupService();
    vi.clearAllMocks();
  });

  describe('getGroups', () => {
    it('returns all groups', async () => {
      mockApi.getAll.mockResolvedValue([mockGroup]);

      const result = await service.getGroups();

      expect(result).toEqual([mockGroup]);
      expect(mockApi.getAll).toHaveBeenCalled();
    });

    it('returns empty array when none', async () => {
      mockApi.getAll.mockResolvedValue([]);

      const result = await service.getGroups();

      expect(result).toEqual([]);
    });
  });

  describe('getGroup', () => {
    it('returns group when found', async () => {
      mockApi.getById.mockResolvedValue(mockGroup);

      const result = await service.getGroup('group-1');

      expect(result).toEqual(mockGroup);
      expect(mockApi.getById).toHaveBeenCalledWith('group-1');
    });

    it('throws when not found', async () => {
      mockApi.getById.mockResolvedValue(null);

      await expect(service.getGroup('missing')).rejects.toThrow(
        'Newsletter group with ID missing not found'
      );
    });

    it('validates group ID', async () => {
      await expect(service.getGroup('')).rejects.toThrow('Group ID is required');
      await expect(service.getGroup('   ')).rejects.toThrow('Group ID is required');
      await expect(service.getGroup(null as any)).rejects.toThrow('Group ID is required');
      await expect(service.getGroup(undefined as any)).rejects.toThrow('Group ID is required');
    });
  });

  describe('createGroup', () => {
    it('creates with valid params', async () => {
      mockApi.create.mockResolvedValue(mockGroup);

      const result = await service.createGroup({ name: 'Tech', sourceIds: [] });

      expect(result.success).toBe(true);
      expect(result.group).toEqual(mockGroup);
      expect(mockApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Tech', sourceIds: [] })
      );
    });

    it('creates with color and sourceIds', async () => {
      mockApi.create.mockResolvedValue({ ...mockGroup, color: '#ef4444' });

      const result = await service.createGroup({
        name: 'Tech',
        color: '#ef4444',
        sourceIds: ['s1'],
      });

      expect(result.success).toBe(true);
      expect(mockApi.create).toHaveBeenCalledWith({
        name: 'Tech',
        color: '#ef4444',
        sourceIds: ['s1'],
      });
    });

    it('validates name required', async () => {
      await expect(service.createGroup({ name: '', sourceIds: [] })).rejects.toThrow(
        'Group name is required'
      );
    });

    it('validates name length', async () => {
      await expect(service.createGroup({ name: 'A', sourceIds: [] })).rejects.toThrow(
        'Group name must be between 2 and 100 characters'
      );
    });

    it('validates source IDs', async () => {
      await expect(
        service.createGroup({ name: 'Tech', sourceIds: ['a', '', 'b'] })
      ).rejects.toThrow('All source IDs must be non-empty strings');
    });

    it('validates color format', async () => {
      await expect(
        service.createGroup({ name: 'Tech', color: 'red', sourceIds: [] })
      ).rejects.toThrow('Color must be a valid hex color');
    });

    it('handles API errors', async () => {
      mockApi.create.mockRejectedValue(new Error('Create failed'));

      const result = await service.createGroup({ name: 'Tech', sourceIds: [] });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Create failed');
    });
  });

  describe('updateGroup', () => {
    it('updates successfully', async () => {
      mockApi.update.mockResolvedValue({ ...mockGroup, name: 'Updated' });

      const result = await service.updateGroup('group-1', { name: 'Updated' });

      expect(result.success).toBe(true);
      expect(result.group?.name).toBe('Updated');
      expect(mockApi.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'group-1', name: 'Updated' })
      );
    });

    it('validates name length', async () => {
      await expect(service.updateGroup('group-1', { name: 'A' })).rejects.toThrow(
        'Group name must be between 2 and 100 characters'
      );
    });

    it('handles API errors', async () => {
      mockApi.update.mockRejectedValue(new Error('Update failed'));

      const result = await service.updateGroup('group-1', { name: 'Updated' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('addSourcesToGroup', () => {
    it('adds sources', async () => {
      mockApi.addSources.mockResolvedValue([{ id: 's1' } as any]);
      mockApi.getById.mockResolvedValue(mockGroup);

      const result = await service.addSourcesToGroup('group-1', ['s1']);

      expect(result.success).toBe(true);
      expect(result.group).toEqual(mockGroup);
      expect(mockApi.addSources).toHaveBeenCalledWith({ groupId: 'group-1', sourceIds: ['s1'] });
    });

    it('validates sourceIds non-empty', async () => {
      await expect(service.addSourcesToGroup('group-1', [])).rejects.toThrow(
        'Source IDs array cannot be empty'
      );
    });

    it('handles API errors', async () => {
      mockApi.addSources.mockRejectedValue(new Error('Add failed'));

      const result = await service.addSourcesToGroup('group-1', ['s1']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Add failed');
    });
  });

  describe('removeSourcesFromGroup', () => {
    it('removes sources', async () => {
      mockApi.removeSources.mockResolvedValue(true);
      mockApi.getById.mockResolvedValue(mockGroup);

      const result = await service.removeSourcesFromGroup('group-1', ['s1']);

      expect(result.success).toBe(true);
      expect(mockApi.removeSources).toHaveBeenCalledWith({ groupId: 'group-1', sourceIds: ['s1'] });
    });

    it('validates sourceIds non-empty', async () => {
      await expect(service.removeSourcesFromGroup('group-1', [])).rejects.toThrow(
        'Source IDs array cannot be empty'
      );
    });
  });

  describe('updateSourceGroups', () => {
    it('updates groups for source', async () => {
      mockApi.updateSourceGroups.mockResolvedValue([mockGroup]);

      const result = await service.updateSourceGroups('s1', ['group-1']);

      expect(result.success).toBe(true);
      expect(result.groups).toHaveLength(1);
      expect(mockApi.updateSourceGroups).toHaveBeenCalledWith('s1', ['group-1']);
    });

    it('validates max 10 groups', async () => {
      const many = Array.from({ length: 11 }, (_, i) => `g-${i}`);

      await expect(service.updateSourceGroups('s1', many)).rejects.toThrow(
        'A source cannot belong to more than 10 groups'
      );
    });

    it('validates groupIds array', async () => {
      await expect(
        service.updateSourceGroups('s1', ['g1', '', 'g2'])
      ).rejects.toThrow('All group IDs must be non-empty strings');
    });

    it('handles API errors', async () => {
      mockApi.updateSourceGroups.mockRejectedValue(new Error('Update failed'));

      const result = await service.updateSourceGroups('s1', ['group-1']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Update failed');
    });
  });

  describe('getSourceGroups', () => {
    it('returns groups for source', async () => {
      mockApi.getSourceGroups.mockResolvedValue([mockGroup]);

      const result = await service.getSourceGroups('s1');

      expect(result).toEqual([mockGroup]);
      expect(mockApi.getSourceGroups).toHaveBeenCalledWith('s1');
    });
  });

  describe('getGroupSources', () => {
    it('returns sources in group', async () => {
      mockApi.getGroupSources.mockResolvedValue([{ id: 's1' } as any]);

      const result = await service.getGroupSources('group-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });
  });

  describe('getGroupsStats', () => {
    it('returns stats', async () => {
      mockApi.getStats.mockResolvedValue({
        totalGroups: 2,
        totalSources: 3,
        averageSourcesPerGroup: 1.5,
        groupsWithoutSources: 0,
      });

      const result = await service.getGroupsStats();

      expect(result).toEqual({
        total: 2,
        totalSources: 3,
        averageSourcesPerGroup: 1.5,
        groupsWithoutSources: 0,
      });
    });
  });

  describe('searchGroups', () => {
    it('searches by query', async () => {
      mockApi.search.mockResolvedValue([mockGroup]);

      const result = await service.searchGroups('tech');

      expect(result).toEqual([mockGroup]);
      expect(mockApi.search).toHaveBeenCalledWith('tech');
    });

    it('validates query', async () => {
      await expect(service.searchGroups('')).rejects.toThrow('search query is required');
    });
  });
});
