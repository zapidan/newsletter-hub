import { Tag, TagWithCount } from '@common/types';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTagsPageState } from '../useTagsPageState';

const mockTags: TagWithCount[] = [
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
  {
    id: 'tag-3',
    name: 'Personal',
    color: '#0000ff',
    created_at: '2023-01-03T00:00:00Z',
    updated_at: '2023-01-03T00:00:00Z',
    user_id: 'user-1',
    newsletter_count: 8,
  },
];

describe('useTagsPageState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useTagsPageState());

      expect(result.current.state.isCreating).toBe(false);
      expect(result.current.state.newTagName).toBe('');
      expect(result.current.state.newTagColor).toBe('#3b82f6');
      expect(result.current.state.editingTagId).toBeNull();
      expect(result.current.state.editTagName).toBe('');
      expect(result.current.state.editTagColor).toBe('');
      expect(result.current.state.searchQuery).toBe('');
      expect(result.current.state.selectedTags).toEqual(new Set());
      expect(result.current.state.sortBy).toBe('name');
      expect(result.current.state.sortOrder).toBe('asc');
      expect(result.current.state.showCreateForm).toBe(false);
      expect(result.current.state.showBulkActions).toBe(false);
      expect(result.current.state.isSelectMode).toBe(false);
    });

    it('should initialize with custom options', () => {
      const { result } = renderHook(() =>
        useTagsPageState({
          initialSortBy: 'usage',
          initialSortOrder: 'desc',
          defaultTagColor: '#custom',
        })
      );

      expect(result.current.state.sortBy).toBe('usage');
      expect(result.current.state.sortOrder).toBe('desc');
      expect(result.current.state.newTagColor).toBe('#custom');
    });
  });

  describe('create tag handlers', () => {
    it('should start create tag flow', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.startCreate();
      });

      expect(result.current.state.isCreating).toBe(true);
      expect(result.current.state.showCreateForm).toBe(true);
      expect(result.current.state.newTagName).toBe('');
      expect(result.current.state.newTagColor).toBe('#3b82f6');
      expect(result.current.state.createError).toBeNull();
    });

    it('should cancel create tag flow', () => {
      const { result } = renderHook(() => useTagsPageState());

      // Start create flow first
      act(() => {
        result.current.startCreate();
        result.current.setNewTagName('Test Tag');
      });

      expect(result.current.state.isCreating).toBe(true);
      expect(result.current.state.newTagName).toBe('Test Tag');

      // Cancel create flow
      act(() => {
        result.current.cancelCreate();
      });

      expect(result.current.state.isCreating).toBe(false);
      expect(result.current.state.showCreateForm).toBe(false);
      expect(result.current.state.newTagName).toBe('');
      expect(result.current.state.newTagColor).toBe('#3b82f6');
      expect(result.current.state.createError).toBeNull();
    });

    it('should handle tag creation lifecycle', () => {
      const onTagCreated = vi.fn();
      const { result } = renderHook(() => useTagsPageState({ onTagCreated }));

      const newTag: Tag = {
        id: 'new-tag',
        name: 'New Tag',
        color: '#purple',
        created_at: '2023-01-04T00:00:00Z',
        updated_at: '2023-01-04T00:00:00Z',
        user_id: 'user-1',
      };

      // Start creation
      act(() => {
        result.current.onCreateStart();
      });

      expect(result.current.state.isCreatingTag).toBe(true);
      expect(result.current.state.createError).toBeNull();

      // Successful creation
      act(() => {
        result.current.onCreateSuccess(newTag);
      });

      expect(result.current.state.isCreatingTag).toBe(false);
      expect(result.current.state.isCreating).toBe(false);
      expect(result.current.state.showCreateForm).toBe(false);
      expect(result.current.state.newTagName).toBe('');
      expect(result.current.state.createError).toBeNull();
      expect(onTagCreated).toHaveBeenCalledWith(newTag);
    });

    it('should handle tag creation error', () => {
      const { result } = renderHook(() => useTagsPageState());

      const errorMessage = 'Tag name already exists';

      act(() => {
        result.current.onCreateStart();
      });

      act(() => {
        result.current.onCreateError(errorMessage);
      });

      expect(result.current.state.isCreatingTag).toBe(false);
      expect(result.current.state.createError).toBe(errorMessage);
    });
  });

  describe('edit tag handlers', () => {
    it('should start edit tag flow', () => {
      const { result } = renderHook(() => useTagsPageState());

      const tagToEdit = mockTags[0];

      act(() => {
        result.current.startEdit(tagToEdit);
      });

      expect(result.current.state.editingTagId).toBe(tagToEdit.id);
      expect(result.current.state.editTagName).toBe(tagToEdit.name);
      expect(result.current.state.editTagColor).toBe(tagToEdit.color);
      expect(result.current.state.updateError).toBeNull();
    });

    it('should cancel edit tag flow', () => {
      const { result } = renderHook(() => useTagsPageState());

      // Start edit flow first
      act(() => {
        result.current.startEdit(mockTags[0]);
      });

      expect(result.current.state.editingTagId).toBe('tag-1');

      // Cancel edit flow
      act(() => {
        result.current.cancelEdit();
      });

      expect(result.current.state.editingTagId).toBeNull();
      expect(result.current.state.editTagName).toBe('');
      expect(result.current.state.editTagColor).toBe('');
      expect(result.current.state.updateError).toBeNull();
    });

    it('should handle tag update lifecycle', () => {
      const onTagUpdated = vi.fn();
      const { result } = renderHook(() => useTagsPageState({ onTagUpdated }));

      const updatedTag: Tag = {
        ...mockTags[0],
        name: 'Updated Tag',
      };

      // Start update
      act(() => {
        result.current.onUpdateStart();
      });

      expect(result.current.state.isUpdatingTag).toBe(true);
      expect(result.current.state.updateError).toBeNull();

      // Successful update
      act(() => {
        result.current.onUpdateSuccess(updatedTag);
      });

      expect(result.current.state.isUpdatingTag).toBe(false);
      expect(result.current.state.editingTagId).toBeNull();
      expect(result.current.state.editTagName).toBe('');
      expect(result.current.state.editTagColor).toBe('');
      expect(result.current.state.updateError).toBeNull();
      expect(onTagUpdated).toHaveBeenCalledWith(updatedTag);
    });
  });

  describe('delete tag handlers', () => {
    it('should handle tag deletion lifecycle', () => {
      const onTagDeleted = vi.fn();
      const { result } = renderHook(() => useTagsPageState({ onTagDeleted }));

      const tagId = 'tag-1';

      // Start deletion
      act(() => {
        result.current.onDeleteStart(tagId);
      });

      expect(result.current.state.isDeletingTag).toBe(tagId);
      expect(result.current.state.deleteError).toBeNull();

      // Add tag to selection first
      act(() => {
        result.current.toggleSelect(tagId);
      });

      expect(result.current.state.selectedTags.has(tagId)).toBe(true);

      // Successful deletion
      act(() => {
        result.current.onDeleteSuccess(tagId);
      });

      expect(result.current.state.isDeletingTag).toBeNull();
      expect(result.current.state.deleteError).toBeNull();
      expect(result.current.state.selectedTags.has(tagId)).toBe(false);
      expect(onTagDeleted).toHaveBeenCalledWith(tagId);
    });

    it('should handle tag deletion error', () => {
      const { result } = renderHook(() => useTagsPageState());

      const errorMessage = 'Cannot delete tag with newsletters';

      act(() => {
        result.current.onDeleteError(errorMessage);
      });

      expect(result.current.state.isDeletingTag).toBeNull();
      expect(result.current.state.deleteError).toBe(errorMessage);
    });
  });

  describe('selection handlers', () => {
    it('should toggle tag selection', () => {
      const { result } = renderHook(() => useTagsPageState());

      const tagId = 'tag-1';

      expect(result.current.state.selectedTags.has(tagId)).toBe(false);

      act(() => {
        result.current.toggleSelect(tagId);
      });

      expect(result.current.state.selectedTags.has(tagId)).toBe(true);

      act(() => {
        result.current.toggleSelect(tagId);
      });

      expect(result.current.state.selectedTags.has(tagId)).toBe(false);
    });

    it('should select all tags', () => {
      const { result } = renderHook(() => useTagsPageState());

      const tagIds = ['tag-1', 'tag-2', 'tag-3'];

      act(() => {
        result.current.selectAll(tagIds);
      });

      expect(result.current.state.selectedTags).toEqual(new Set(tagIds));
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => useTagsPageState());

      // Select some tags first
      act(() => {
        result.current.selectAll(['tag-1', 'tag-2']);
      });

      expect(result.current.state.selectedTags.size).toBe(2);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.state.selectedTags.size).toBe(0);
    });

    it('should toggle select mode', () => {
      const { result } = renderHook(() => useTagsPageState());

      expect(result.current.state.isSelectMode).toBe(false);

      // Select some tags first
      act(() => {
        result.current.toggleSelect('tag-1');
      });

      act(() => {
        result.current.toggleSelectMode();
      });

      expect(result.current.state.isSelectMode).toBe(true);

      // Toggle back to exit select mode
      act(() => {
        result.current.toggleSelectMode();
      });

      expect(result.current.state.isSelectMode).toBe(false);
      expect(result.current.state.selectedTags.size).toBe(0); // Should clear selection
    });
  });

  describe('search and filter handlers', () => {
    it('should handle search query changes', () => {
      const { result } = renderHook(() => useTagsPageState());

      const query = 'important';

      act(() => {
        result.current.setSearchQuery(query);
      });

      expect(result.current.state.searchQuery).toBe(query);
    });

    it('should handle sort changes', () => {
      const { result } = renderHook(() => useTagsPageState());

      // Initial sort
      expect(result.current.state.sortBy).toBe('name');
      expect(result.current.state.sortOrder).toBe('asc');

      // Change sort field
      act(() => {
        result.current.setSortBy('usage');
      });

      expect(result.current.state.sortBy).toBe('usage');
      expect(result.current.state.sortOrder).toBe('asc');

      // Same field should toggle order
      act(() => {
        result.current.setSortBy('usage');
      });

      expect(result.current.state.sortBy).toBe('usage');
      expect(result.current.state.sortOrder).toBe('desc');
    });
  });

  describe('bulk operation handlers', () => {
    it('should handle bulk operation lifecycle', () => {
      const onBulkOperation = vi.fn();
      const { result } = renderHook(() => useTagsPageState({ onBulkOperation }));

      const tagIds = ['tag-1', 'tag-2'];

      // Select tags first
      act(() => {
        result.current.selectAll(tagIds);
      });

      // Start bulk operation
      act(() => {
        result.current.onBulkStart();
      });

      expect(result.current.state.isBulkOperationInProgress).toBe(true);
      expect(result.current.state.bulkError).toBeNull();

      // Successful bulk operation
      act(() => {
        result.current.onBulkSuccess('delete', tagIds);
      });

      expect(result.current.state.isBulkOperationInProgress).toBe(false);
      expect(result.current.state.bulkError).toBeNull();
      expect(result.current.state.selectedTags.size).toBe(0); // Should clear selection
      expect(onBulkOperation).toHaveBeenCalledWith('delete', tagIds);
    });

    it('should handle bulk operation error', () => {
      const { result } = renderHook(() => useTagsPageState());

      const errorMessage = 'Bulk operation failed';

      act(() => {
        result.current.onBulkError(errorMessage);
      });

      expect(result.current.state.isBulkOperationInProgress).toBe(false);
      expect(result.current.state.bulkError).toBe(errorMessage);
    });
  });

  describe('error dismissal handlers', () => {
    it('should dismiss create error', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.onCreateError('Create error');
      });

      expect(result.current.state.createError).toBe('Create error');

      act(() => {
        result.current.dismissCreateError();
      });

      expect(result.current.state.createError).toBeNull();
    });

    it('should dismiss update error', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.onUpdateError('Update error');
      });

      expect(result.current.state.updateError).toBe('Update error');

      act(() => {
        result.current.dismissUpdateError();
      });

      expect(result.current.state.updateError).toBeNull();
    });

    it('should dismiss delete error', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.onDeleteError('Delete error');
      });

      expect(result.current.state.deleteError).toBe('Delete error');

      act(() => {
        result.current.dismissDeleteError();
      });

      expect(result.current.state.deleteError).toBeNull();
    });

    it('should dismiss bulk error', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.onBulkError('Bulk error');
      });

      expect(result.current.state.bulkError).toBe('Bulk error');

      act(() => {
        result.current.dismissBulkError();
      });

      expect(result.current.state.bulkError).toBeNull();
    });
  });

  describe('filter and sort tags', () => {
    it('should filter tags by search query', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.setSearchQuery('work');
      });

      const filtered = result.current.filterAndSortTags(mockTags);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Work');
    });

    it('should sort tags by name', () => {
      const { result } = renderHook(() => useTagsPageState());

      const sorted = result.current.filterAndSortTags(mockTags);

      expect(sorted.map((t) => t.name)).toEqual(['Important', 'Personal', 'Work']);
    });

    it('should sort tags by usage count', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.setSortBy('usage');
      });

      const sorted = result.current.filterAndSortTags(mockTags);

      expect(sorted.map((t) => t.newsletter_count)).toEqual([3, 5, 8]);
    });

    it('should sort tags by creation date', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.setSortBy('created_at');
      });

      const sorted = result.current.filterAndSortTags(mockTags);

      expect(sorted.map((t) => t.id)).toEqual(['tag-1', 'tag-2', 'tag-3']);
    });

    it('should sort in descending order', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.setSortBy('usage');
      });

      // Check that it's ascending first
      let sorted = result.current.filterAndSortTags(mockTags);
      expect(sorted.map((t) => t.newsletter_count)).toEqual([3, 5, 8]);

      act(() => {
        result.current.setSortBy('usage'); // Toggle to desc
      });

      sorted = result.current.filterAndSortTags(mockTags);
      expect(sorted.map((t) => t.newsletter_count)).toEqual([8, 5, 3]);
    });
  });

  describe('computed flags', () => {
    it('should compute hasSelection correctly', () => {
      const { result } = renderHook(() => useTagsPageState());

      expect(result.current.hasSelection).toBe(false);

      act(() => {
        result.current.toggleSelect('tag-1');
      });

      expect(result.current.hasSelection).toBe(true);
    });

    it('should compute hasMultipleSelection correctly', () => {
      const { result } = renderHook(() => useTagsPageState());

      expect(result.current.hasMultipleSelection).toBe(false);

      act(() => {
        result.current.toggleSelect('tag-1');
      });

      expect(result.current.hasMultipleSelection).toBe(false);

      act(() => {
        result.current.toggleSelect('tag-2');
      });

      expect(result.current.hasMultipleSelection).toBe(true);
    });

    it('should compute canPerformBulkActions correctly', () => {
      const { result } = renderHook(() => useTagsPageState());

      expect(result.current.canPerformBulkActions).toBe(false);

      act(() => {
        result.current.toggleSelect('tag-1');
      });

      expect(result.current.canPerformBulkActions).toBe(true);

      act(() => {
        result.current.onBulkStart();
      });

      expect(result.current.canPerformBulkActions).toBe(false);
    });

    it('should compute hasAnyError correctly', () => {
      const { result } = renderHook(() => useTagsPageState());

      expect(result.current.hasAnyError).toBe(false);

      act(() => {
        result.current.onCreateError('Create error');
      });

      expect(result.current.hasAnyError).toBe(true);
    });

    it('should compute hasAnyLoading correctly', () => {
      const { result } = renderHook(() => useTagsPageState());

      expect(result.current.hasAnyLoading).toBe(false);

      act(() => {
        result.current.onCreateStart();
      });

      expect(result.current.hasAnyLoading).toBe(true);
    });
  });

  describe('utility getters', () => {
    it('should get selected tag IDs', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.selectAll(['tag-1', 'tag-3']);
      });

      const selectedIds = result.current.getSelectedTagIds();

      expect(selectedIds).toEqual(['tag-1', 'tag-3']);
    });

    it('should check if tag is selected', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.toggleSelect('tag-1');
      });

      expect(result.current.isTagSelected('tag-1')).toBe(true);
      expect(result.current.isTagSelected('tag-2')).toBe(false);
    });

    it('should check if tag is being deleted', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.onDeleteStart('tag-1');
      });

      expect(result.current.isTagBeingDeleted('tag-1')).toBe(true);
      expect(result.current.isTagBeingDeleted('tag-2')).toBe(false);
    });

    it('should check if tag is being edited', () => {
      const { result } = renderHook(() => useTagsPageState());

      expect(result.current.isTagBeingEdited('tag-1')).toBe(false);

      const tagToEdit = mockTags[0];
      act(() => {
        result.current.startEdit(tagToEdit);
      });

      expect(result.current.state.editingTagId).toBe(tagToEdit.id);
      expect(result.current.isTagBeingEdited(tagToEdit.id)).toBe(true);
      expect(result.current.isTagBeingEdited('tag-2')).toBe(false);
    });
  });

  describe('state setters', () => {
    it('should set new tag name', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.setNewTagName('New Tag Name');
      });

      expect(result.current.state.newTagName).toBe('New Tag Name');
    });

    it('should set new tag color', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.setNewTagColor('#custom');
      });

      expect(result.current.state.newTagColor).toBe('#custom');
    });

    it('should set edit tag name', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.setEditTagName('Edit Tag Name');
      });

      expect(result.current.state.editTagName).toBe('Edit Tag Name');
    });

    it('should set edit tag color', () => {
      const { result } = renderHook(() => useTagsPageState());

      act(() => {
        result.current.setEditTagColor('#edit');
      });

      expect(result.current.state.editTagColor).toBe('#edit');
    });
  });
});
