import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NewsletterSourceGroupService } from '../newsletterSourceGroup/NewsletterSourceGroupService';
import { newsletterSourceGroupApi } from '../../api/newsletterSourceGroupApi';
import { NewsletterSourceGroup } from '../../types';
import { NotFoundError, ValidationError } from '../../api/errorHandling';

// Mock the API
vi.mock('../../api/newsletterSourceGroupApi');
vi.mock('../../utils/logger');

const mockNewsletterSourceGroupApi = vi.mocked(newsletterSourceGroupApi);

describe('NewsletterSourceGroupService', () => {
  let service: NewsletterSourceGroupService;

  const mockNewsletterSourceGroup: NewsletterSourceGroup = {
    id: 'group-1',
    name: 'Tech Newsletters',
    user_id: 'user-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    source_ids: ['source-1', 'source-2'],
    sources: [
      {
        id: 'source-1',
        name: 'Tech Source 1',
        from: 'tech1@example.com',
        user_id: 'user-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'source-2',
        name: 'Tech Source 2',
        from: 'tech2@example.com',
        user_id: 'user-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    service = new NewsletterSourceGroupService();
    vi.clearAllMocks();
  });

  describe('getGroups', () => {
    it('should return all newsletter source groups', async () => {
      mockNewsletterSourceGroupApi.getAll.mockResolvedValue([mockNewsletterSourceGroup]);

      const result = await service.getGroups();

      expect(result).toEqual([mockNewsletterSourceGroup]);
      expect(mockNewsletterSourceGroupApi.getAll).toHaveBeenCalledWith();
    });

    it('should handle empty results', async () => {
      mockNewsletterSourceGroupApi.getAll.mockResolvedValue([]);

      const result = await service.getGroups();

      expect(result).toEqual([]);
    });
  });

  describe('getGroup', () => {
    it('should return a newsletter source group when found', async () => {
      mockNewsletterSourceGroupApi.getById.mockResolvedValue(mockNewsletterSourceGroup);

      const result = await service.getGroup('group-1');

      expect(result).toEqual(mockNewsletterSourceGroup);
      expect(mockNewsletterSourceGroupApi.getById).toHaveBeenCalledWith('group-1');
    });

    it.skip('should throw NotFoundError when group not found', async () => {
      mockNewsletterSourceGroupApi.getById.mockResolvedValue(null);

      await expect(service.getGroup('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it.skip('should validate group ID', async () => {
      await expect(service.getGroup('')).rejects.toThrow('Group ID must be a non-empty string');
      await expect(service.getGroup('   ')).rejects.toThrow('Group ID must be a non-empty string');
    });
  });

  describe('createGroup', () => {
    it('should create group successfully with valid data', async () => {
      const createParams = {
        name: 'New Group',
        sourceIds: ['source-1', 'source-2'],
      };

      mockNewsletterSourceGroupApi.create.mockResolvedValue(mockNewsletterSourceGroup);

      const result = await service.createGroup(createParams);

      expect(result.success).toBe(true);
      expect(result.group).toEqual(mockNewsletterSourceGroup);
      expect(mockNewsletterSourceGroupApi.create).toHaveBeenCalledWith(createParams);
    });

    it('should create group with empty source IDs', async () => {
      const createParams = {
        name: 'Empty Group',
        sourceIds: [],
      };

      const emptyGroup = { ...mockNewsletterSourceGroup, name: 'Empty Group', source_ids: [] };
      mockNewsletterSourceGroupApi.create.mockResolvedValue(emptyGroup);

      const result = await service.createGroup(createParams);

      expect(result.success).toBe(true);
      expect(result.group).toEqual(emptyGroup);
    });

    it('should validate required fields', async () => {
      await expect(service.createGroup({ name: '', sourceIds: [] })).rejects.toThrow(
        'Group name is required'
      );

      await expect(service.createGroup({ name: 'A', sourceIds: [] })).rejects.toThrow(
        'Group name must be between 2 and 100 characters'
      );
    });

    it('should validate source IDs format', async () => {
      await expect(
        service.createGroup({ name: 'Valid Name', sourceIds: ['valid', '', 'another'] })
      ).rejects.toThrow('All source IDs must be non-empty strings');
    });

    it.skip('should handle API errors gracefully', async () => {
      mockNewsletterSourceGroupApi.create.mockRejectedValue(new Error('Create failed'));

      const result = await service.createGroup({ name: 'Test', sourceIds: [] });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Create failed');
    });
  });

  describe('updateGroup', () => {
    it('should update group successfully', async () => {
      const updateParams = {
        name: 'Updated Group',
        sourceIds: ['source-1'],
      };

      const updatedGroup = { ...mockNewsletterSourceGroup, name: 'Updated Group' };
      mockNewsletterSourceGroupApi.update.mockResolvedValue(updatedGroup);

      const result = await service.updateGroup('group-1', updateParams);

      expect(result.success).toBe(true);
      expect(result.group).toEqual(updatedGroup);
      expect(mockNewsletterSourceGroupApi.update).toHaveBeenCalledWith({
        id: 'group-1',
        name: 'Updated Group',
        sourceIds: ['source-1'],
      });
    });

    it('should handle partial updates', async () => {
      const updateParams = { name: 'New Name Only' };
      const updatedGroup = { ...mockNewsletterSourceGroup, name: 'New Name Only' };
      mockNewsletterSourceGroupApi.update.mockResolvedValue(updatedGroup);

      const result = await service.updateGroup('group-1', updateParams);

      expect(result.success).toBe(true);
      expect(mockNewsletterSourceGroupApi.update).toHaveBeenCalledWith({
        id: 'group-1',
        name: 'New Name Only',
        sourceIds: [],
      });
    });

    it('should validate update parameters', async () => {
      await expect(service.updateGroup('group-1', { name: 'A' })).rejects.toThrow(
        'Group name must be between 2 and 100 characters'
      );
    });

    it.skip('should handle API errors gracefully', async () => {
      mockNewsletterSourceGroupApi.update.mockRejectedValue(new Error('Update failed'));

      const result = await service.updateGroup('group-1', { name: 'Test' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('deleteGroup', () => {
    it('should delete group successfully', async () => {
      mockNewsletterSourceGroupApi.delete.mockResolvedValue(true);

      const result = await service.deleteGroup('group-1');

      expect(result.success).toBe(true);
      expect(mockNewsletterSourceGroupApi.delete).toHaveBeenCalledWith('group-1');
    });

    it.skip('should handle deletion errors', async () => {
      mockNewsletterSourceGroupApi.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await service.deleteGroup('group-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('addSourcesToGroup', () => {
    it('should add sources to group successfully', async () => {
      mockNewsletterSourceGroupApi.addSources.mockResolvedValue(true);
      mockNewsletterSourceGroupApi.getById.mockResolvedValue(mockNewsletterSourceGroup);

      const result = await service.addSourcesToGroup('group-1', ['source-3']);

      expect(result.success).toBe(true);
      expect(result.group).toEqual(mockNewsletterSourceGroup);
      expect(mockNewsletterSourceGroupApi.addSources).toHaveBeenCalledWith({
        groupId: 'group-1',
        sourceIds: ['source-3'],
      });
    });

    it('should validate input parameters', async () => {
      await expect(service.addSourcesToGroup('group-1', [])).rejects.toThrow(
        'Source IDs array cannot be empty'
      );
    });

    it.skip('should handle API errors gracefully', async () => {
      mockNewsletterSourceGroupApi.addSources.mockRejectedValue(new Error('Add failed'));

      const result = await service.addSourcesToGroup('group-1', ['source-3']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Add failed');
    });
  });

  describe('removeSourcesFromGroup', () => {
    it('should remove sources from group successfully', async () => {
      mockNewsletterSourceGroupApi.removeSources.mockResolvedValue(true);
      mockNewsletterSourceGroupApi.getById.mockResolvedValue(mockNewsletterSourceGroup);

      const result = await service.removeSourcesFromGroup('group-1', ['source-2']);

      expect(result.success).toBe(true);
      expect(result.group).toEqual(mockNewsletterSourceGroup);
      expect(mockNewsletterSourceGroupApi.removeSources).toHaveBeenCalledWith({
        groupId: 'group-1',
        sourceIds: ['source-2'],
      });
    });

    it('should validate input parameters', async () => {
      await expect(service.removeSourcesFromGroup('group-1', [])).rejects.toThrow(
        'Source IDs array cannot be empty'
      );
    });

    it.skip('should handle API errors gracefully', async () => {
      mockNewsletterSourceGroupApi.removeSources.mockRejectedValue(new Error('Remove failed'));

      const result = await service.removeSourcesFromGroup('group-1', ['source-2']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Remove failed');
    });
  });

  describe('getGroupsStats', () => {
    it('should return group statistics', async () => {
      const groups = [
        { ...mockNewsletterSourceGroup, sources: [{ id: 'source-1' }, { id: 'source-2' }] },
        { ...mockNewsletterSourceGroup, id: 'group-2', sources: [{ id: 'source-3' }] },
      ];
      mockNewsletterSourceGroupApi.getAll.mockResolvedValue(groups);

      const result = await service.getGroupsStats();

      expect(result).toEqual({
        total: 2,
        totalSources: 3,
        averageSourcesPerGroup: 1.5,
      });
    });

    it('should handle empty groups', async () => {
      mockNewsletterSourceGroupApi.getAll.mockResolvedValue([]);

      const result = await service.getGroupsStats();

      expect(result).toEqual({
        total: 0,
        totalSources: 0,
        averageSourcesPerGroup: 0,
      });
    });
  });

  describe('error handling and resilience', () => {
    it.skip('should handle network errors with retry', async () => {
      mockNewsletterSourceGroupApi.getById
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValue(mockNewsletterSourceGroup);

      const result = await service.getGroup('group-1');

      expect(result).toEqual(mockNewsletterSourceGroup);
      expect(mockNewsletterSourceGroupApi.getById).toHaveBeenCalledTimes(2);
    });

    it('should handle validation errors without retry', async () => {
      await expect(service.createGroup({ name: '', sourceIds: [] })).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('service configuration', () => {
    it('should handle optimistic updates when enabled', async () => {
      const optimisticService = new NewsletterSourceGroupService({
        enableOptimisticUpdates: true,
      });

      mockNewsletterSourceGroupApi.update.mockResolvedValue({
        ...mockNewsletterSourceGroup,
        name: 'Updated',
      });

      const result = await optimisticService.updateGroup('group-1', { name: 'Updated' });

      expect(result.success).toBe(true);
      expect(result.group?.name).toBe('Updated');
    });
  });
});
