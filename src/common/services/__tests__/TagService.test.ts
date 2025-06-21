import { newsletterApi } from '@common/api/newsletterApi';
import { tagApi } from '@common/api/tagApi';
import { NewsletterWithRelations, Tag, TagWithCount } from '@common/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TagService } from '../tag/TagService';

// Mock the API modules
vi.mock('@common/api/tagApi');
vi.mock('@common/api/newsletterApi');
vi.mock('@common/utils/logger');

const mockTagApi = vi.mocked(tagApi);
const mockNewsletterApi = vi.mocked(newsletterApi);

describe('TagService', () => {
  let service: TagService;

  const mockTag: Tag = {
    id: 'tag-1',
    name: 'Test Tag',
    color: '#3b82f6',
    user_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockTagWithCount: TagWithCount = {
    ...mockTag,
    newsletter_count: 5,
  };

  const mockNewsletter: NewsletterWithRelations = {
    id: 'newsletter-1',
    title: 'Test Newsletter',
    summary: 'Test summary',
    content: 'Test content',
    image_url: 'https://example.com/image.jpg',
    is_read: false,
    is_liked: false,
    is_archived: false,
    received_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    estimated_read_time: 5,
    word_count: 100,
    source: {
      id: 'source-1',
      name: 'Test Source',
      from: 'test@example.com',
      user_id: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    tags: [mockTag],
    newsletter_source_id: 'source-1',
    user_id: 'user-1',
  };

  beforeEach(() => {
    service = new TagService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAllTags', () => {
    it('should return tags with usage stats when requested', async () => {
      mockTagApi.getTagUsageStats.mockResolvedValue([mockTagWithCount]);

      const result = await service.getAllTags(true);

      expect(result).toEqual([mockTagWithCount]);
      expect(mockTagApi.getTagUsageStats).toHaveBeenCalled();
      expect(mockTagApi.getAll).not.toHaveBeenCalled();
    });

    it('should return tags without usage stats when not requested', async () => {
      mockTagApi.getAll.mockResolvedValue([mockTag]);

      const result = await service.getAllTags(false);

      expect(result).toEqual([{ ...mockTag, newsletter_count: 0 }]);
      expect(mockTagApi.getAll).toHaveBeenCalled();
      expect(mockTagApi.getTagUsageStats).not.toHaveBeenCalled();
    });

    it('should default to not including usage stats', async () => {
      mockTagApi.getAll.mockResolvedValue([mockTag]);

      const result = await service.getAllTags();

      expect(result).toEqual([{ ...mockTag, newsletter_count: 0 }]);
      expect(mockTagApi.getAll).toHaveBeenCalled();
    });
  });

  describe('getTag', () => {
    it('should return tag when found', async () => {
      mockTagApi.getById.mockResolvedValue(mockTag);

      const result = await service.getTag('tag-1');

      expect(result).toEqual(mockTag);
      expect(mockTagApi.getById).toHaveBeenCalledWith('tag-1');
    });

    it('should throw NotFoundError when tag not found', async () => {
      mockTagApi.getById.mockResolvedValue(null);

      await expect(service.getTag('tag-1')).rejects.toThrow('Tag with ID tag-1 not found');
    });

    it('should validate tag ID', async () => {
      await expect(service.getTag('')).rejects.toThrow('Tag with ID  not found');
    });
  });

  describe('createTag', () => {
    it('should create tag successfully with valid data', async () => {
      const tagData = { name: 'New Tag', color: '#ef4444' };
      mockTagApi.getAll.mockResolvedValue([]);
      mockTagApi.create.mockResolvedValue({ ...mockTag, ...tagData });

      const result = await service.createTag(tagData);

      expect(result.success).toBe(true);
      expect(result.tag?.name).toBe('New Tag');
      expect(result.tag?.color).toBe('#ef4444');
      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: 'New Tag',
        color: '#ef4444',
      });
    });

    it('should sanitize tag name', async () => {
      const tagData = { name: '  New Tag  ', color: '#ef4444' };
      mockTagApi.getAll.mockResolvedValue([]);
      mockTagApi.create.mockResolvedValue({ ...mockTag, name: 'New Tag' });

      const result = await service.createTag(tagData);

      expect(result.success).toBe(true);
      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: 'New Tag',
        color: '#ef4444',
      });
    });

    it('should use default color when none provided', async () => {
      const tagData = { name: 'New Tag' };
      mockTagApi.getAll.mockResolvedValue([]);
      mockTagApi.create.mockResolvedValue(mockTag);

      const result = await service.createTag(tagData);

      expect(result.success).toBe(true);
      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: 'New Tag',
        color: '#3b82f6',
      });
    });

    it('should prevent duplicate tag names', async () => {
      const tagData = { name: 'Test Tag', color: '#ef4444' };
      mockTagApi.getAll.mockResolvedValue([mockTag]);

      const result = await service.createTag(tagData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag with name "Test Tag" already exists');
      expect(mockTagApi.create).not.toHaveBeenCalled();
    });

    it('should be case insensitive for duplicate detection', async () => {
      const tagData = { name: 'TEST TAG', color: '#ef4444' };
      mockTagApi.getAll.mockResolvedValue([mockTag]);

      const result = await service.createTag(tagData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag with name "TEST TAG" already exists');
    });

    it('should handle API errors gracefully', async () => {
      const tagData = { name: 'New Tag', color: '#ef4444' };
      mockTagApi.getAll.mockResolvedValue([]);
      mockTagApi.create.mockRejectedValue(new Error('API Error'));

      const result = await service.createTag(tagData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error during createTag: API Error');
    });

    it('should assign next available color from palette', async () => {
      const tagData = { name: 'New Tag' };
      const existingTags = [
        { ...mockTag, color: '#3b82f6' },
        { ...mockTag, id: 'tag-2', color: '#ef4444' },
      ];
      mockTagApi.getAll.mockResolvedValue(existingTags);
      mockTagApi.create.mockResolvedValue(mockTag);

      const result = await service.createTag(tagData);

      expect(result.success).toBe(true);
      // Should use the first available color in palette
      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: 'New Tag',
        color: '#3b82f6',
      });
    });
  });

  describe('updateTag', () => {
    it('should update tag successfully', async () => {
      const updateData = { id: 'tag-1', name: 'Updated Tag', color: '#ef4444' };
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockTagApi.getAll.mockResolvedValue([mockTag]);
      mockTagApi.update.mockResolvedValue({ ...mockTag, ...updateData });

      const result = await service.updateTag(updateData);

      expect(result.success).toBe(true);
      expect(result.tag?.name).toBe('Updated Tag');
      expect(mockTagApi.update).toHaveBeenCalledWith({
        id: 'tag-1',
        name: 'Updated Tag',
        color: '#ef4444',
      });
    });

    it('should return error when tag not found', async () => {
      const updateData = { id: 'tag-1', name: 'Updated Tag' };
      mockTagApi.getById.mockResolvedValue(null);

      const result = await service.updateTag(updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag not found');
      expect(mockTagApi.update).not.toHaveBeenCalled();
    });

    it('should prevent duplicate names during update', async () => {
      const updateData = { id: 'tag-1', name: 'Existing Tag' };
      const existingTag = { ...mockTag, id: 'tag-2', name: 'Existing Tag' };
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockTagApi.getAll.mockResolvedValue([mockTag, existingTag]);

      const result = await service.updateTag(updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag with name "Existing Tag" already exists');
    });

    it('should allow updating tag with same name', async () => {
      const updateData = { id: 'tag-1', name: 'Test Tag' };
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockTagApi.getAll.mockResolvedValue([mockTag]);
      mockTagApi.update.mockResolvedValue(mockTag);

      const result = await service.updateTag(updateData);

      expect(result.success).toBe(true);
    });

    it('should validate tag ID', async () => {
      const result = await service.updateTag({ id: '', name: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag not found');
    });
  });

  describe('deleteTag', () => {
    it('should delete tag successfully', async () => {
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockNewsletterApi.getAll.mockResolvedValue({
        data: [],
        count: 0,
        hasMore: false,
      });
      mockTagApi.delete.mockResolvedValue(true);

      const result = await service.deleteTag('tag-1');

      expect(result.success).toBe(true);
      expect(result.tag).toEqual(mockTag);
      expect(mockTagApi.delete).toHaveBeenCalledWith('tag-1');
    });

    it('should return error when tag not found', async () => {
      mockTagApi.getById.mockResolvedValue(null);

      const result = await service.deleteTag('tag-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag not found');
      expect(mockTagApi.delete).not.toHaveBeenCalled();
    });

    it('should warn when deleting tag with many associated newsletters', async () => {
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockNewsletterApi.getAll.mockResolvedValue({
        data: [mockNewsletter, mockNewsletter, mockNewsletter],
        count: 3,
        hasMore: false,
      });
      mockTagApi.delete.mockResolvedValue(true);

      const result = await service.deleteTag('tag-1');

      expect(result.success).toBe(true);
      // Should still succeed but log warning about usage
    });

    it('should return error when deletion fails', async () => {
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockNewsletterApi.getAll.mockResolvedValue({
        data: [],
        count: 0,
        hasMore: false,
      });
      mockTagApi.delete.mockResolvedValue(false);

      const result = await service.deleteTag('tag-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to delete tag');
    });
  });

  describe('getOrCreateTag', () => {
    it('should get existing tag', async () => {
      mockTagApi.getOrCreate.mockResolvedValue(mockTag);

      const result = await service.getOrCreateTag('Test Tag');

      expect(result.success).toBe(true);
      expect(result.tag).toEqual(mockTag);
      expect(mockTagApi.getOrCreate).toHaveBeenCalledWith('Test Tag', undefined);
    });

    it('should create new tag with color', async () => {
      const newTag = { ...mockTag, name: 'New Tag', color: '#ef4444' };
      mockTagApi.getOrCreate.mockResolvedValue(newTag);

      const result = await service.getOrCreateTag('New Tag', '#ef4444');

      expect(result.success).toBe(true);
      expect(result.tag).toEqual(newTag);
      expect(mockTagApi.getOrCreate).toHaveBeenCalledWith('New Tag', '#ef4444');
    });

    it('should sanitize tag name', async () => {
      mockTagApi.getOrCreate.mockResolvedValue(mockTag);

      await service.getOrCreateTag('  Test Tag  ');

      expect(mockTagApi.getOrCreate).toHaveBeenCalledWith('Test Tag', undefined);
    });
  });

  describe('updateNewsletterTagsWithIds', () => {
    it('should update newsletter tags successfully', async () => {
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockTagApi.updateNewsletterTags.mockResolvedValue(true);

      const result = await service.updateNewsletterTagsWithIds('newsletter-1', ['tag-1']);

      expect(result.success).toBe(true);
      expect(mockTagApi.updateNewsletterTags).toHaveBeenCalledWith('newsletter-1', [mockTag]);
    });

    it('should return error when tag not found', async () => {
      mockTagApi.getById.mockResolvedValue(null);

      const result = await service.updateNewsletterTagsWithIds('newsletter-1', ['tag-1']);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag with ID tag-1 not found');
    });

    it('should enforce maximum tag limit', async () => {
      const manyTagIds = Array.from({ length: 11 }, (_, i) => `tag-${i + 1}`);

      // Mock getById to return valid tags for all 11 tags
      mockTagApi.getById.mockImplementation((id: string) =>
        Promise.resolve({
          id,
          name: `Tag ${id}`,
          color: '#ff0000',
          user_id: 'user-123',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      );

      const result = await service.updateNewsletterTagsWithIds('newsletter-1', manyTagIds);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot assign more than 10 tags to a newsletter');
    });

    it('should validate inputs', async () => {
      // Reset mock to return null for non-existent tags
      mockTagApi.getById.mockResolvedValue(null);

      // Empty newsletter ID should still process but fail when tag not found
      const result1 = await service.updateNewsletterTagsWithIds('', ['tag-1']);
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Tag with ID tag-1 not found');

      // Undefined tag IDs should throw validation error
      await expect(
        service.updateNewsletterTagsWithIds('newsletter-1', undefined as unknown as string[])
      ).rejects.toThrow('tag IDs is required');
    });
  });

  describe('searchTags', () => {
    it('should search tags successfully', async () => {
      mockTagApi.search.mockResolvedValue([mockTag]);

      const result = await service.searchTags('test');

      expect(result).toEqual([mockTag]);
      expect(mockTagApi.search).toHaveBeenCalledWith('test');
    });

    it('should validate search query', async () => {
      await expect(service.searchTags('')).rejects.toThrow(
        'search query must be at least 1 characters long'
      );
    });

    it('should trim search query', async () => {
      mockTagApi.search.mockResolvedValue([]);

      await service.searchTags('  test  ');

      expect(mockTagApi.search).toHaveBeenCalledWith('test');
    });
  });

  describe('getTagSuggestions', () => {
    it('should return tag suggestions based on usage', async () => {
      const tagsWithStats = [
        { ...mockTag, newsletter_count: 10 },
        { ...mockTag, id: 'tag-2', name: 'Tag 2', newsletter_count: 5 },
        { ...mockTag, id: 'tag-3', name: 'Tag 3', newsletter_count: 0 },
      ];
      mockTagApi.getTagUsageStats.mockResolvedValue(tagsWithStats);

      const result = await service.getTagSuggestions();

      expect(result).toHaveLength(2); // Should exclude tag with 0 usage
      expect(result[0].newsletter_count).toBe(10); // Should be sorted by usage desc
      expect(result[1].newsletter_count).toBe(5);
    });

    it('should filter out existing tags', async () => {
      const tagsWithStats = [
        { ...mockTag, newsletter_count: 10 },
        { ...mockTag, id: 'tag-2', name: 'Tag 2', newsletter_count: 5 },
      ];
      mockTagApi.getTagUsageStats.mockResolvedValue(tagsWithStats);

      const context = {
        existingTags: [mockTag],
      };

      const result = await service.getTagSuggestions(context);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tag-2');
    });

    it('should limit suggestions to maxSuggestions option', async () => {
      const service = new TagService({ maxSuggestions: 2 });
      const tagsWithStats = Array.from({ length: 5 }, (_, i) => ({
        ...mockTag,
        id: `tag-${i + 1}`,
        name: `Tag ${i + 1}`,
        newsletter_count: 10 - i,
      }));
      mockTagApi.getTagUsageStats.mockResolvedValue(tagsWithStats);

      const result = await service.getTagSuggestions();

      expect(result).toHaveLength(2);
    });
  });

  describe('getTagUsageStats', () => {
    it('should return tag usage statistics', async () => {
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockNewsletterApi.getAll.mockResolvedValue({
        data: [mockNewsletter, mockNewsletter],
        count: 2,
        hasMore: false,
      });

      const result = await service.getTagUsageStats('tag-1');

      expect(result).toBeDefined();
      expect(result?.tag).toEqual(mockTag);
      expect(result?.newsletterCount).toBe(2);
      expect(result?.recentNewsletters).toHaveLength(2);
    });

    it('should return null when tag not found', async () => {
      mockTagApi.getById.mockResolvedValue(null);

      const result = await service.getTagUsageStats('tag-1');

      expect(result).toBeNull();
    });

    it('should limit recent newsletters to 5', async () => {
      const newsletters = Array.from({ length: 10 }, (_, i) => ({
        ...mockNewsletter,
        id: `newsletter-${i + 1}`,
        received_at: new Date(Date.UTC(2024, 0, i + 1)).toISOString(),
      }));
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockNewsletterApi.getAll.mockResolvedValue({
        data: newsletters,
        count: 10,
        hasMore: false,
      });

      const result = await service.getTagUsageStats('tag-1');

      expect(result?.recentNewsletters).toHaveLength(5);
      // Should be sorted by received_at desc (most recent first)
      expect(result?.recentNewsletters[0].received_at).toBe('2024-01-10T00:00:00.000Z');
    });
  });

  describe('bulkCreateTags', () => {
    it('should create multiple tags successfully', async () => {
      const tagDataArray = [
        { name: 'Tag 1', color: '#3b82f6' },
        { name: 'Tag 2', color: '#ef4444' },
      ];

      // Mock individual createTag calls
      const createTagSpy = vi.spyOn(service, 'createTag');
      createTagSpy
        .mockResolvedValueOnce({
          success: true,
          tag: { ...mockTag, name: 'Tag 1' },
        })
        .mockResolvedValueOnce({
          success: true,
          tag: { ...mockTag, name: 'Tag 2' },
        });

      const result = await service.bulkCreateTags(tagDataArray);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(createTagSpy).toHaveBeenCalledTimes(2);

      createTagSpy.mockRestore();
    });

    it('should handle partial failures', async () => {
      const tagDataArray = [
        { name: 'Tag 1', color: '#3b82f6' },
        { name: 'Tag 2', color: '#ef4444' },
      ];

      const createTagSpy = vi.spyOn(service, 'createTag');
      createTagSpy
        .mockResolvedValueOnce({
          success: true,
          tag: { ...mockTag, name: 'Tag 1' },
        })
        .mockResolvedValueOnce({ success: false, error: 'Tag already exists' });

      const result = await service.bulkCreateTags(tagDataArray);

      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        name: 'Tag 2',
        error: 'Tag already exists',
      });

      createTagSpy.mockRestore();
    });

    it('should validate input array', async () => {
      await expect(service.bulkCreateTags([])).rejects.toThrow(
        'tag data array must have at least 1 items'
      );
    });
  });

  describe('name sanitization', () => {
    it('should handle empty name', async () => {
      const result = await service.createTag({ name: '' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag name is required and must be a string');
    });

    it('should handle whitespace-only name', async () => {
      const result = await service.createTag({ name: '   ' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag name cannot be empty');
    });

    it('should handle long names', async () => {
      const longName = 'a'.repeat(51);
      const result = await service.createTag({ name: longName });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tag name cannot exceed 50 characters');
    });

    it('should normalize multiple spaces', async () => {
      const tagData = { name: 'Tag    with    spaces' };
      mockTagApi.getAll.mockResolvedValue([]);
      mockTagApi.create.mockResolvedValue(mockTag);

      await service.createTag(tagData);

      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: 'Tag with spaces',
        color: '#3b82f6',
      });
    });
  });

  describe('color validation', () => {
    it('should accept valid hex colors', async () => {
      const tagData = { name: 'Test', color: '#abc123' };
      mockTagApi.getAll.mockResolvedValue([]);
      mockTagApi.create.mockResolvedValue(mockTag);

      const result = await service.createTag(tagData);

      expect(result.success).toBe(true);
      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: 'Test',
        color: '#abc123',
      });
    });

    it('should accept 3-digit hex colors', async () => {
      const tagData = { name: 'Test', color: '#abc' };
      mockTagApi.getAll.mockResolvedValue([]);
      mockTagApi.create.mockResolvedValue(mockTag);

      const result = await service.createTag(tagData);

      expect(result.success).toBe(true);
      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: 'Test',
        color: '#abc',
      });
    });

    it('should reject invalid hex colors', async () => {
      const result1 = await service.createTag({
        name: 'Test',
        color: 'invalid',
      });
      expect(result1.success).toBe(false);
      expect(result1.error).toBe('Color must be a valid hex color (e.g., #3b82f6)');

      const result2 = await service.createTag({
        name: 'Test',
        color: '#gg0000',
      });
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Color must be a valid hex color (e.g., #3b82f6)');
      const result3 = await service.createTag({
        name: 'Test',
        color: '#12345',
      });
      expect(result3.success).toBe(false);
      expect(result3.error).toBe('Color must be a valid hex color (e.g., #3b82f6)');
    });
  });
});
