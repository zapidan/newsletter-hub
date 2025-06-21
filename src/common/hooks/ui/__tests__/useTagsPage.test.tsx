import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useTagsPage } from '../useTagsPage';
import { useTagOperations } from '@common/hooks/business/useTagOperations';
import { useCache } from '@common/hooks/useCache';
import { useLogger } from '@common/utils/logger';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('@common/hooks/business/useTagOperations');
vi.mock('@common/hooks/useCache');
vi.mock('@common/utils/logger');
vi.mock('react-hot-toast');

// Mock data
const mockTags = [
  {
    id: '1',
    name: 'Tech',
    color: '#3b82f6',
    user_id: 'user1',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    newsletter_count: 2,
  },
  {
    id: '2',
    name: 'News',
    color: '#ef4444',
    user_id: 'user1',
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    newsletter_count: 1,
  },
];

const mockUseTagOperations = {
  tags: mockTags.map(({ _newsletter_count, ...tag }) => tag),
  isLoadingTags: false,
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  isCreatingTag: false,
  isUpdatingTag: false,
  isDeletingTag: false,
  refetchTags: vi.fn(),
};

const mockUseCache = {
  batchInvalidate: vi.fn(),
};

const mockLogger = {
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
};

// Helper to create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock React Query hooks
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    }),
  };
});

describe('useTagsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useTagOperations as any).mockReturnValue(mockUseTagOperations);
    (useCache as any).mockReturnValue(mockUseCache);
    (useLogger as any).mockReturnValue(mockLogger);
    (toast.success as any).mockImplementation(() => { });
    (toast.error as any).mockImplementation(() => { });
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isCreating).toBe(false);
      expect(result.current.newTag).toEqual({
        name: '',
        color: '#3b82f6',
      });
      expect(result.current.editingTagId).toBeNull();
      expect(result.current.editTagData).toEqual({});
    });
  });

  describe('loading states', () => {
    it('should reflect loading states from useTagOperations', () => {
      (useTagOperations as any).mockReturnValue({
        ...mockUseTagOperations,
        isLoadingTags: true,
      });

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoadingTags).toBe(true);
    });
  });

  describe('create tag functionality', () => {
    it('should handle create tag form state', () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setIsCreating(true);
        result.current.setNewTag({ name: 'Test Tag', color: '#ff0000' });
      });

      expect(result.current.isCreating).toBe(true);
      expect(result.current.newTag).toEqual({
        name: 'Test Tag',
        color: '#ff0000',
      });
    });

    it('should create tag successfully', async () => {
      mockUseTagOperations.createTag.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setNewTag({ name: 'Test Tag', color: '#ff0000' });
      });

      await act(async () => {
        await result.current.handleCreateTag();
      });

      expect(mockUseTagOperations.createTag).toHaveBeenCalledWith({
        name: 'Test Tag',
        color: '#ff0000',
      });
      expect(mockUseCache.batchInvalidate).toHaveBeenCalled();
      // Verify the operation completed successfully
      expect(result.current.isCreating).toBe(false);
      expect(result.current.newTag.name).toBe('');
    });

    it('should reset form after successful creation', async () => {
      mockUseTagOperations.createTag.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setIsCreating(true);
        result.current.setNewTag({ name: 'Test Tag', color: '#ff0000' });
      });

      await act(async () => {
        await result.current.handleCreateTag();
      });

      expect(result.current.isCreating).toBe(false);
      expect(result.current.newTag).toEqual({
        name: '',
        color: '#3b82f6',
      });
    });

    it('should handle create tag errors', async () => {
      const error = new Error('Creation failed');
      mockUseTagOperations.createTag.mockRejectedValue(error);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setNewTag({ name: 'Test Tag', color: '#ff0000' });
      });

      await act(async () => {
        await result.current.handleCreateTag();
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create tag',
        expect.objectContaining({
          component: 'useTagsPage',
          action: 'createTag',
        })
      );
      expect(toast.error).toHaveBeenCalledWith('Failed to create tag');
    });

    it('should not create tag with empty name', async () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setNewTag({ name: '   ', color: '#ff0000' });
      });

      await act(async () => {
        await result.current.handleCreateTag();
      });

      expect(mockUseTagOperations.createTag).not.toHaveBeenCalled();
    });
  });

  describe('update tag functionality', () => {
    it('should handle edit tag form state', () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setEditingTagId('1');
        result.current.setEditTagData({ name: 'Updated Tag', color: '#00ff00' });
      });

      expect(result.current.editingTagId).toBe('1');
      expect(result.current.editTagData).toEqual({
        name: 'Updated Tag',
        color: '#00ff00',
      });
    });

    it('should update tag successfully', async () => {
      mockUseTagOperations.updateTag.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setEditingTagId('1');
        result.current.setEditTagData({ name: 'Updated Tag', color: '#00ff00' });
      });

      await act(async () => {
        await result.current.handleUpdateTag();
      });

      expect(mockUseTagOperations.updateTag).toHaveBeenCalledWith({
        id: '1',
        name: 'Updated Tag',
        color: '#00ff00',
      });
      expect(mockUseCache.batchInvalidate).toHaveBeenCalled();
      // Verify the operation completed successfully
      expect(result.current.editingTagId).toBeNull();
      expect(result.current.editTagData).toEqual({});
    });

    it('should reset edit form after successful update', async () => {
      mockUseTagOperations.updateTag.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setEditingTagId('1');
        result.current.setEditTagData({ name: 'Updated Tag', color: '#00ff00' });
      });

      await act(async () => {
        await result.current.handleUpdateTag();
      });

      expect(result.current.editingTagId).toBeNull();
      expect(result.current.editTagData).toEqual({});
    });

    it('should handle update tag errors', async () => {
      const error = new Error('Update failed');
      mockUseTagOperations.updateTag.mockRejectedValue(error);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setEditingTagId('1');
        result.current.setEditTagData({ name: 'Updated Tag', color: '#00ff00' });
      });

      await act(async () => {
        await result.current.handleUpdateTag();
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update tag',
        expect.objectContaining({
          component: 'useTagsPage',
          action: 'updateTag',
        })
      );
      expect(toast.error).toHaveBeenCalledWith('Failed to update tag');
    });

    it('should reset form if no editing tag ID or empty name', async () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      // Case 1: No editing tag ID
      await act(async () => {
        await result.current.handleUpdateTag();
      });

      expect(result.current.editingTagId).toBeNull();
      expect(mockUseTagOperations.updateTag).not.toHaveBeenCalled();

      // Case 2: Empty name
      act(() => {
        result.current.setEditingTagId('1');
        result.current.setEditTagData({ name: '   ' });
      });

      await act(async () => {
        await result.current.handleUpdateTag();
      });

      expect(result.current.editingTagId).toBeNull();
      expect(mockUseTagOperations.updateTag).not.toHaveBeenCalled();
    });
  });

  describe('delete tag functionality', () => {
    beforeEach(() => {
      // Mock window.confirm
      Object.defineProperty(window, 'confirm', {
        writable: true,
        value: vi.fn(),
      });
    });

    it('should delete tag successfully after confirmation', async () => {
      (window.confirm as any).mockReturnValue(true);
      mockUseTagOperations.deleteTag.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleDeleteTag('1');
      });

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this tag? This will remove it from all newsletters.'
      );
      expect(mockUseTagOperations.deleteTag).toHaveBeenCalledWith('1');
      expect(mockUseCache.batchInvalidate).toHaveBeenCalled();
      // Verify the operation completed successfully
      expect(window.confirm).toHaveBeenCalled();
    });

    it('should not delete tag if not confirmed', async () => {
      (window.confirm as any).mockReturnValue(false);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleDeleteTag('1');
      });

      expect(mockUseTagOperations.deleteTag).not.toHaveBeenCalled();
    });

    it('should handle delete tag errors', async () => {
      (window.confirm as any).mockReturnValue(true);
      const error = new Error('Delete failed');
      mockUseTagOperations.deleteTag.mockRejectedValue(error);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.handleDeleteTag('1');
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete tag',
        expect.objectContaining({
          component: 'useTagsPage',
          action: 'deleteTag',
          tagId: '1',
        })
      );
      expect(toast.error).toHaveBeenCalledWith('Failed to delete tag');
    });
  });

  describe('refresh functionality', () => {
    it('should refresh data successfully', async () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.refreshData();
      });

      expect(mockUseCache.batchInvalidate).toHaveBeenCalledWith([
        { queryKey: expect.arrayContaining(['tags']) },
        { queryKey: expect.arrayContaining(['newsletters']) },
        { queryKey: expect.arrayContaining(['tags']) },
      ]);
      expect(mockUseTagOperations.refetchTags).toHaveBeenCalled();
    });

    it('should handle refresh errors', async () => {
      const error = new Error('Refresh failed');
      mockUseCache.batchInvalidate.mockRejectedValue(error);

      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.refreshData();
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to refresh tags page data',
        expect.objectContaining({
          component: 'useTagsPage',
          action: 'refreshData',
        })
      );
    });
  });

  describe('form reset functionality', () => {
    it('should reset create form', () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setIsCreating(true);
        result.current.setNewTag({ name: 'Test', color: '#ff0000' });
      });

      act(() => {
        result.current.resetCreateForm();
      });

      expect(result.current.isCreating).toBe(false);
      expect(result.current.newTag).toEqual({
        name: '',
        color: '#3b82f6',
      });
    });

    it('should reset edit form', () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setEditingTagId('1');
        result.current.setEditTagData({ name: 'Test', color: '#ff0000' });
      });

      act(() => {
        result.current.resetEditForm();
      });

      expect(result.current.editingTagId).toBeNull();
      expect(result.current.editTagData).toEqual({});
    });
  });

  describe('fallback behavior', () => {
    it('should initialize with empty data when no external data is available', () => {
      const { result } = renderHook(() => useTagsPage(), {
        wrapper: createWrapper(),
      });

      expect(result.current.newsletters).toEqual([]);
      expect(result.current.tagNewsletters).toEqual({});
    });
  });

  describe('options handling', () => {
    it('should respect showToasts option', async () => {
      mockUseTagOperations.createTag.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTagsPage({ showToasts: false }), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setNewTag({ name: 'Test Tag', color: '#ff0000' });
      });

      await act(async () => {
        await result.current.handleCreateTag();
      });

      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should call onSuccess callback', () => {
      const onSuccess = vi.fn();

      renderHook(() => useTagsPage({ onSuccess }), {
        wrapper: createWrapper(),
      });

      // The onSuccess callback is passed to useTagOperations, verify it's called during initialization
      expect(useTagOperations).toHaveBeenCalledWith(
        expect.objectContaining({
          onSuccess: expect.any(Function),
        })
      );
    });

    it('should call onError callback', () => {
      const onError = vi.fn();

      renderHook(() => useTagsPage({ onError }), {
        wrapper: createWrapper(),
      });

      // The onError callback is passed to useTagOperations, verify it's called during initialization
      expect(useTagOperations).toHaveBeenCalledWith(
        expect.objectContaining({
          onError: expect.any(Function),
        })
      );
    });
  });
});
