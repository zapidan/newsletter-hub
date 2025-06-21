import { tagService } from '@common/services';
import {
  updateNewsletterTags,
  toggleTagFilter,
  handleTagClick,
  handleTagClickWithNavigation,
  getOptimisticTags,
} from '../tagUtils';
import { vi } from 'vitest';

// Mock the tagService
vi.mock('@common/services', () => ({
  tagService: {
    getTag: vi.fn(),
    getOrCreateTag: vi.fn(),
    updateNewsletterTagsWithIds: vi.fn(),
    getTagsForNewsletter: vi.fn(),
  },
}));

const mockTagService = tagService as any;

describe('tagUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateNewsletterTags', () => {
    const mockTags = [
      {
        id: '1',
        name: 'Tech',
        color: '#3b82f6',
        user_id: 'user1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'News',
        color: '#ef4444',
        user_id: 'user1',
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
    ];

    it('should validate required inputs', async () => {
      await expect(updateNewsletterTags('', ['1'], [], 'user1')).rejects.toThrow(
        'Newsletter ID is required'
      );

      await expect(updateNewsletterTags('newsletter1', ['1'], [], '')).rejects.toThrow(
        'User ID is required'
      );

      await expect(updateNewsletterTags('newsletter1', null as any, [], 'user1')).rejects.toThrow(
        'tagIds must be an array'
      );

      await expect(
        updateNewsletterTags('newsletter1', ['1'], null as any, 'user1')
      ).rejects.toThrow('currentTagIds must be an array');
    });

    it('should handle existing tag IDs (UUIDs)', async () => {
      const existingTagId = '550e8400-e29b-41d4-a716-446655440000';
      mockTagService.getTag.mockResolvedValue(mockTags[0]);
      mockTagService.updateNewsletterTagsWithIds.mockResolvedValue({
        success: true,
        addedCount: 1,
        removedCount: 0,
      });
      mockTagService.getTagsForNewsletter.mockResolvedValue([mockTags[0]]);

      const result = await updateNewsletterTags('newsletter1', [existingTagId], [], 'user1');

      expect(mockTagService.getTag).toHaveBeenCalledWith(existingTagId);
      expect(mockTagService.updateNewsletterTagsWithIds).toHaveBeenCalledWith('newsletter1', [
        existingTagId,
      ]);
      expect(result.added).toBe(1);
      expect(result.removed).toBe(0);
    });

    it('should handle tag names by creating new tags', async () => {
      const tagName = 'New Tag';
      mockTagService.getOrCreateTag.mockResolvedValue({
        success: true,
        tag: mockTags[0],
      });
      mockTagService.updateNewsletterTagsWithIds.mockResolvedValue({
        success: true,
        addedCount: 1,
        removedCount: 0,
      });
      mockTagService.getTagsForNewsletter.mockResolvedValue([mockTags[0]]);

      const result = await updateNewsletterTags('newsletter1', [tagName], [], 'user1');

      expect(mockTagService.getOrCreateTag).toHaveBeenCalledWith(tagName);
      expect(mockTagService.updateNewsletterTagsWithIds).toHaveBeenCalledWith('newsletter1', [
        mockTags[0].id,
      ]);
      expect(result.tags).toEqual([mockTags[0]]);
    });

    it('should handle mixed tag IDs and names', async () => {
      const existingTagId = '550e8400-e29b-41d4-a716-446655440000';
      const tagName = 'New Tag';

      mockTagService.getTag.mockResolvedValue(mockTags[0]);
      mockTagService.getOrCreateTag.mockResolvedValue({
        success: true,
        tag: mockTags[1],
      });
      mockTagService.updateNewsletterTagsWithIds.mockResolvedValue({
        success: true,
        addedCount: 2,
        removedCount: 0,
      });
      mockTagService.getTagsForNewsletter.mockResolvedValue(mockTags);

      const result = await updateNewsletterTags(
        'newsletter1',
        [existingTagId, tagName],
        [],
        'user1'
      );

      expect(mockTagService.getTag).toHaveBeenCalledWith(existingTagId);
      expect(mockTagService.getOrCreateTag).toHaveBeenCalledWith(tagName);
      expect(result.added).toBe(2);
    });

    it('should skip non-existent tag IDs', async () => {
      const nonExistentTagId = '550e8400-e29b-41d4-a716-446655440000';
      mockTagService.getTag.mockResolvedValue(null);
      mockTagService.updateNewsletterTagsWithIds.mockResolvedValue({
        success: true,
        addedCount: 0,
        removedCount: 0,
      });
      mockTagService.getTagsForNewsletter.mockResolvedValue([]);

      const result = await updateNewsletterTags('newsletter1', [nonExistentTagId], [], 'user1');

      expect(mockTagService.updateNewsletterTagsWithIds).toHaveBeenCalledWith('newsletter1', []);
      expect(result.added).toBe(0);
    });

    it('should throw error if tag service update fails', async () => {
      mockTagService.updateNewsletterTagsWithIds.mockResolvedValue({
        success: false,
        error: 'Update failed',
      });

      await expect(updateNewsletterTags('newsletter1', ['tag1'], [], 'user1')).rejects.toThrow(
        'Update failed'
      );
    });

    it('should calculate added and removed counts correctly', async () => {
      const existingTagId = '550e8400-e29b-41d4-a716-446655440000';
      const currentTagIds = ['old-tag-1', 'old-tag-2'];

      mockTagService.getTag.mockResolvedValue(mockTags[0]);
      mockTagService.updateNewsletterTagsWithIds.mockResolvedValue({
        success: true,
        addedCount: 1,
        removedCount: 2,
      });
      mockTagService.getTagsForNewsletter.mockResolvedValue([mockTags[0]]);

      const result = await updateNewsletterTags(
        'newsletter1',
        [existingTagId],
        currentTagIds,
        'user1'
      );

      expect(result.added).toBe(1); // One new tag added
      expect(result.removed).toBe(2); // Two old tags removed
    });
  });

  describe('toggleTagFilter', () => {
    const mockTag = { id: '1', name: 'Tech' };

    it('should add tag to empty filter list', () => {
      const result = toggleTagFilter(mockTag, null);
      expect(result).toEqual(['1']);
    });

    it('should add tag to existing filter list', () => {
      const result = toggleTagFilter(mockTag, ['2']);
      expect(result).toEqual(['2', '1']);
    });

    it('should remove tag from filter list', () => {
      const result = toggleTagFilter(mockTag, ['1', '2']);
      expect(result).toEqual(['2']);
    });

    it('should handle string tag IDs', () => {
      const result = toggleTagFilter('1', ['2']);
      expect(result).toEqual(['2', '1']);
    });

    it('should handle empty current tags array', () => {
      const result = toggleTagFilter(mockTag, []);
      expect(result).toEqual(['1']);
    });
  });

  describe('handleTagClick', () => {
    it('should call setTagIds with toggled tags', () => {
      const mockSetTagIds = vi.fn();
      const mockTag = { id: '1', name: 'Tech' };
      const mockEvent = { stopPropagation: vi.fn() } as any;

      handleTagClick(mockTag, ['2'], mockSetTagIds, mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockSetTagIds).toHaveBeenCalledWith(['2', '1']);
    });

    it('should work without event parameter', () => {
      const mockSetTagIds = vi.fn();
      const mockTag = { id: '1', name: 'Tech' };

      handleTagClick(mockTag, ['2'], mockSetTagIds);

      expect(mockSetTagIds).toHaveBeenCalledWith(['2', '1']);
    });

    it('should handle string tag IDs', () => {
      const mockSetTagIds = vi.fn();
      const mockEvent = { stopPropagation: vi.fn() } as any;

      handleTagClick('1', ['2'], mockSetTagIds, mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockSetTagIds).toHaveBeenCalledWith(['2', '1']);
    });
  });

  describe('handleTagClickWithNavigation', () => {
    it('should navigate to default inbox path with tag filter', () => {
      const mockNavigate = vi.fn();
      const mockTag = { id: '1', name: 'Tech' };
      const mockEvent = { stopPropagation: vi.fn() } as any;

      handleTagClickWithNavigation(mockTag, mockNavigate, '/inbox', mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/inbox?tags=1');
    });

    it('should navigate to custom base path', () => {
      const mockNavigate = vi.fn();
      const mockTag = { id: '1', name: 'Tech' };
      const mockEvent = { stopPropagation: vi.fn() } as any;

      handleTagClickWithNavigation(mockTag, mockNavigate, '/archive', mockEvent);

      expect(mockNavigate).toHaveBeenCalledWith('/archive?tags=1');
    });

    it('should use default base path when not provided', () => {
      const mockNavigate = vi.fn();
      const mockTag = { id: '1', name: 'Tech' };
      const mockEvent = { stopPropagation: vi.fn() } as any;

      handleTagClickWithNavigation(mockTag, mockNavigate, undefined, mockEvent);

      expect(mockNavigate).toHaveBeenCalledWith('/inbox?tags=1');
    });

    it('should work without event parameter', () => {
      const mockNavigate = vi.fn();
      const mockTag = { id: '1', name: 'Tech' };

      handleTagClickWithNavigation(mockTag, mockNavigate, '/inbox');

      expect(mockNavigate).toHaveBeenCalledWith('/inbox?tags=1');
    });

    it('should handle string tag IDs', () => {
      const mockNavigate = vi.fn();
      const mockEvent = { stopPropagation: vi.fn() } as any;

      handleTagClickWithNavigation('1', mockNavigate, '/inbox', mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/inbox?tags=1');
    });
  });

  describe('getOptimisticTags', () => {
    const mockAllTags = [
      {
        id: '1',
        name: 'Tech',
        color: '#3b82f6',
        user_id: 'user1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      },
      {
        id: '2',
        name: 'News',
        color: '#ef4444',
        user_id: 'user1',
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
      },
    ];

    it('should return existing tags from allTags', () => {
      const result = getOptimisticTags(['1', '2'], 'user1', mockAllTags);

      expect(result).toEqual([mockAllTags[0], mockAllTags[1]]);
    });

    it('should create fallback tags for missing IDs', () => {
      const result = getOptimisticTags(['1', '3'], 'user1', mockAllTags);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockAllTags[0]);
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: '3',
          name: '',
          color: '#808080',
          user_id: 'user1',
        })
      );
      expect(result[1].created_at).toBeDefined();
      expect(result[1].updated_at).toBeDefined();
    });

    it('should handle empty tagIds array', () => {
      const result = getOptimisticTags([], 'user1', mockAllTags);

      expect(result).toEqual([]);
    });

    it('should handle empty allTags array', () => {
      const result = getOptimisticTags(['1', '2'], 'user1', []);

      expect(result).toHaveLength(2);
      result.forEach((tag, index) => {
        expect(tag).toEqual(
          expect.objectContaining({
            id: String(index + 1),
            name: '',
            color: '#808080',
            user_id: 'user1',
          })
        );
      });
    });

    it('should use correct userId for fallback tags', () => {
      const result = getOptimisticTags(['unknown'], 'user123', mockAllTags);

      expect(result[0].user_id).toBe('user123');
    });
  });
});
