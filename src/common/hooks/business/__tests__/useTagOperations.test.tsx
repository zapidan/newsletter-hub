import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useTagOperations } from '../useTagOperations';
import { tagService } from '@common/services';
import { toast } from 'react-hot-toast';

// Mock the service
vi.mock('@common/services', () => ({
  tagService: {
    getAllTags: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    getOrCreateTag: vi.fn(),
    updateNewsletterTagsWithIds: vi.fn(),
    searchTags: vi.fn(),
    getTagSuggestions: vi.fn(),
    getTagUsageStats: vi.fn(),
    bulkCreateTags: vi.fn(),
  },
}));

// Mock logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock queryKeyFactory
vi.mock('@common/utils/queryKeyFactory', () => ({
  queryKeyFactory: {
    tags: {
      all: () => ['tags', 'all'],
      detail: (id: string) => ['tags', 'detail', id],
      search: (query: string) => ['tags', 'search', query],
      suggestions: (context: unknown) => ['tags', 'suggestions', context],
      usageStats: (tagId: string) => ['tags', 'usageStats', tagId],
    },
    newsletters: {
      all: () => ['newsletters', 'all'],
      inbox: () => ['newsletters', 'inbox'],
      detail: (id: string) => ['newsletters', 'detail', id],
    },
  },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockTags = [
  {
    id: 'tag-1',
    name: 'Important',
    color: '#ff0000',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    user_id: 'user-1',
    newsletter_count: 5,
  },
  {
    id: 'tag-2',
    name: 'Work',
    color: '#00ff00',
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    user_id: 'user-1',
    newsletter_count: 3,
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTagOperations', () => {
  let wrapper: ReturnType<typeof createWrapper>;

  beforeEach(() => {
    wrapper = createWrapper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllTags', () => {
    it('should fetch all tags successfully', async () => {
      vi.mocked(tagService.getAllTags).mockResolvedValue(mockTags as any);

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      expect(result.current.isLoadingTags).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoadingTags).toBe(false);
      });

      expect(result.current.tags).toEqual(mockTags);
      expect(result.current.isErrorTags).toBe(false);
      expect(tagService.getAllTags).toHaveBeenCalledWith(true);
    });

    it('should handle fetch error', async () => {
      const error = new Error('Failed to fetch tags');
      vi.mocked(tagService.getAllTags).mockRejectedValue(error);

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoadingTags).toBe(false);
      });

      expect(result.current.isErrorTags).toBe(true);
      expect(result.current.errorTags).toBe(error);
      expect(result.current.tags).toEqual([]);
    });
  });

  describe('createTag', () => {
    it('should create tag successfully', async () => {
      const newTag = { name: 'New Tag', color: '#blue' };
      const createdTag = { ...mockTags[0], ...newTag };

      vi.mocked(tagService.createTag).mockResolvedValue({
        success: true,
        tag: createdTag,
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(() => useTagOperations({ onSuccess }), { wrapper });

      await act(async () => {
        await result.current.createTag(newTag);
      });

      expect(tagService.createTag).toHaveBeenCalledWith(newTag);
      expect(onSuccess).toHaveBeenCalledWith('createTag', createdTag);
      expect(toast.success).toHaveBeenCalledWith('Tag "New Tag" created');
      expect(result.current.isCreatingTag).toBe(false);
    });

    it('should handle creation error', async () => {
      const newTag = { name: 'New Tag', color: '#blue' };
      const error = 'Tag name already exists';

      vi.mocked(tagService.createTag).mockResolvedValue({
        success: false,
        error,
      });

      const onError = vi.fn();
      const { result } = renderHook(() => useTagOperations({ onError }), { wrapper });

      await act(async () => {
        await result.current.createTag(newTag);
      });

      expect(onError).toHaveBeenCalledWith('createTag', error);
      expect(toast.error).toHaveBeenCalledWith(error);
    });

    it('should disable toasts when showToasts is false', async () => {
      const newTag = { name: 'New Tag', color: '#blue' };

      vi.mocked(tagService.createTag).mockResolvedValue({
        success: true,
        tag: mockTags[0],
      });

      const { result } = renderHook(() => useTagOperations({ showToasts: false }), { wrapper });

      await act(async () => {
        await result.current.createTag(newTag);
      });

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe('updateTag', () => {
    it('should update tag successfully', async () => {
      const tagUpdate = { id: 'tag-1', name: 'Updated Tag', color: '#purple' };
      const updatedTag = { ...mockTags[0], ...tagUpdate };

      vi.mocked(tagService.updateTag).mockResolvedValue({
        success: true,
        tag: updatedTag,
      });

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        await result.current.updateTag(tagUpdate);
      });

      expect(tagService.updateTag).toHaveBeenCalledWith(tagUpdate);
      expect(toast.success).toHaveBeenCalledWith('Tag "Updated Tag" updated');
    });

    it('should handle update error', async () => {
      const tagUpdate = { id: 'tag-1', name: 'Updated Tag' };

      vi.mocked(tagService.updateTag).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        try {
          await result.current.updateTag(tagUpdate);
        } catch (_error) {
          // Expected to throw
        }
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update tag');
    });
  });

  describe('deleteTag', () => {
    it('should delete tag successfully', async () => {
      const tagId = 'tag-1';
      const deletedTag = mockTags[0];

      vi.mocked(tagService.deleteTag).mockResolvedValue({
        success: true,
        tag: deletedTag,
      });

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        await result.current.deleteTag(tagId);
      });

      expect(tagService.deleteTag).toHaveBeenCalledWith(tagId);
      expect(toast.success).toHaveBeenCalledWith('Tag "Important" deleted');
    });

    it('should handle deletion error', async () => {
      const tagId = 'tag-1';

      vi.mocked(tagService.deleteTag).mockResolvedValue({
        success: false,
        error: 'Cannot delete tag with newsletters',
      });

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        await result.current.deleteTag(tagId);
      });

      expect(toast.error).toHaveBeenCalledWith('Cannot delete tag with newsletters');
    });
  });

  describe('getOrCreateTag', () => {
    it('should get or create tag successfully', async () => {
      const tagData = { name: 'Auto Tag', color: '#auto' };
      const resultTag = { ...mockTags[0], ...tagData };

      vi.mocked(tagService.getOrCreateTag).mockResolvedValue({
        success: true,
        tag: resultTag,
      });

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        await result.current.getOrCreateTag(tagData);
      });

      expect(tagService.getOrCreateTag).toHaveBeenCalledWith(tagData.name, tagData.color);
      expect(toast.success).toHaveBeenCalledWith('Tag "Auto Tag" ready');
    });
  });

  describe('updateNewsletterTags', () => {
    it('should update newsletter tags successfully', async () => {
      const newsletterId = 'newsletter-1';
      const tagIds = ['tag-1', 'tag-2'];

      vi.mocked(tagService.updateNewsletterTagsWithIds).mockResolvedValue({
        success: true,
      });

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        await result.current.updateNewsletterTags({ newsletterId, tagIds });
      });

      expect(tagService.updateNewsletterTagsWithIds).toHaveBeenCalledWith(newsletterId, tagIds);
      expect(toast.success).toHaveBeenCalledWith('Newsletter tags updated');
    });

    it('should handle update newsletter tags error', async () => {
      const newsletterId = 'newsletter-1';
      const tagIds = ['tag-1'];

      vi.mocked(tagService.updateNewsletterTagsWithIds).mockResolvedValue({
        success: false,
        error: 'Failed to update',
      });

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        await result.current.updateNewsletterTags({ newsletterId, tagIds });
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update');
    });
  });

  describe('bulkCreateTags', () => {
    it('should bulk create tags successfully', async () => {
      const tagDataArray = [
        { name: 'Bulk Tag 1', color: '#red' },
        { name: 'Bulk Tag 2', color: '#blue' },
      ];

      vi.mocked(tagService.bulkCreateTags).mockResolvedValue({
        success: true,
        processedCount: 2,
        failedCount: 0,
        errors: [],
      } as any);

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        await result.current.bulkCreateTags(tagDataArray);
      });

      expect(tagService.bulkCreateTags).toHaveBeenCalledWith(tagDataArray);
      expect(toast.success).toHaveBeenCalledWith('Created 2 tags');
    });

    it('should handle partial bulk creation failure', async () => {
      const tagDataArray = [
        { name: 'Bulk Tag 1', color: '#red' },
        { name: 'Bulk Tag 2', color: '#blue' },
      ];

      vi.mocked(tagService.bulkCreateTags).mockResolvedValue({
        success: false,
        processedCount: 1,
        failedCount: 1,
        errors: ['Failed to create tag'],
      } as any);

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        await result.current.bulkCreateTags(tagDataArray);
      });

      expect(toast.error).toHaveBeenCalledWith('Created 1 tags, 1 failed');
    });
  });

  describe('query helpers', () => {
    it('should create search tags query', () => {
      const { result } = renderHook(() => useTagOperations(), { wrapper });

      const query = result.current.createSearchTagsQuery('test query');

      expect(query.enabled).toBe(true);
      expect(query.queryKey).toContain('test query');
      expect(query.staleTime).toBe(2 * 60 * 1000);
    });

    it('should create tag suggestions query', () => {
      const { result } = renderHook(() => useTagOperations(), { wrapper });

      const context = { newsletterContent: 'test content' };
      const query = result.current.createTagSuggestionsQuery(context);

      expect(query.enabled).toBe(true);
      expect(query.staleTime).toBe(10 * 60 * 1000);
    });

    it('should create tag usage stats query', () => {
      const { result } = renderHook(() => useTagOperations(), { wrapper });

      const query = result.current.createTagUsageStatsQuery('tag-1');

      expect(query.enabled).toBe(true);
      expect(query.staleTime).toBe(5 * 60 * 1000);
    });

    it('should disable search query for empty string', () => {
      const { result } = renderHook(() => useTagOperations(), { wrapper });

      const query = result.current.createSearchTagsQuery('');

      expect(query.enabled).toBe(false);
    });
  });

  describe('loading states', () => {
    it('should track loading states correctly', async () => {
      vi.mocked(tagService.createTag).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ success: true, tag: mockTags[0] }), 100)
          )
      );

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      expect(result.current.isCreatingTag).toBe(false);

      act(() => {
        result.current.createTag({ name: 'Test', color: '#test' });
      });

      // Should be loading
      await waitFor(() => {
        expect(result.current.isCreatingTag).toBe(true);
      });

      // Should finish loading
      await waitFor(() => {
        expect(result.current.isCreatingTag).toBe(false);
      });
    });
  });

  describe('error reset functions', () => {
    it('should reset create tag error', async () => {
      vi.mocked(tagService.createTag).mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => useTagOperations(), { wrapper });

      await act(async () => {
        try {
          await result.current.createTag({ name: 'Test', color: '#test' });
        } catch (_error) {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.errorCreatingTag).toBeTruthy();
      });

      await act(async () => {
        result.current.resetCreateTagError();
      });

      await waitFor(() => {
        expect(result.current.errorCreatingTag).toBeNull();
      });
    });
  });
});
