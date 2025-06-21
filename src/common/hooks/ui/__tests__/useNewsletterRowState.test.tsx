import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useNewsletterRowState } from '../useNewsletterRowState';
import { NewsletterWithRelations } from '@common/types';

const mockNewsletter: NewsletterWithRelations = {
  id: 'newsletter-1',
  title: 'Test Newsletter',
  content: 'Test content',
  subject: 'Test Subject',
  sender_email: 'test@example.com',
  sender_name: 'Test Sender',
  received_at: '2023-01-01T00:00:00Z',
  is_read: false,
  is_liked: false,
  is_archived: false,
  is_in_reading_queue: false,
  created_at: '2023-01-01T00:00:00Z',
  updated_at: '2023-01-01T00:00:00Z',
  user_id: 'user-1',
  newsletter_source_id: 'source-1',
  newsletter_source: {
    id: 'source-1',
    name: 'Test Source',
    email: 'source@example.com',
    description: 'Test source description',
    is_subscribed: true,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    user_id: 'user-1',
  },
  tags: [],
};

describe('useNewsletterRowState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      expect(result.current.state.isSelected).toBe(false);
      expect(result.current.state.showTags).toBe(false);
      expect(result.current.state.showCheckbox).toBe(false);
      expect(result.current.state.isHovered).toBe(false);
      expect(result.current.state.isDragging).toBe(false);
      expect(result.current.state.isTogglingRead).toBe(false);
      expect(result.current.state.isTogglingLike).toBe(false);
      expect(result.current.state.isTogglingArchive).toBe(false);
      expect(result.current.state.isTogglingQueue).toBe(false);
      expect(result.current.state.isUpdatingTags).toBe(false);
      expect(result.current.state.tagUpdateError).toBeNull();
    });

    it('should initialize with custom initial values', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({
          newsletter: mockNewsletter,
          initialSelected: true,
          initialShowTags: true,
          initialShowCheckbox: true,
        })
      );

      expect(result.current.state.isSelected).toBe(true);
      expect(result.current.state.showTags).toBe(true);
      expect(result.current.state.showCheckbox).toBe(true);
    });
  });

  describe('selection handlers', () => {
    it('should toggle selection', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useNewsletterRowState({
          newsletter: mockNewsletter,
          onSelectionChange,
        })
      );

      expect(result.current.state.isSelected).toBe(false);

      act(() => {
        result.current.toggleSelect();
      });

      expect(result.current.state.isSelected).toBe(true);
      expect(onSelectionChange).toHaveBeenCalledWith('newsletter-1', true);

      act(() => {
        result.current.toggleSelect();
      });

      expect(result.current.state.isSelected).toBe(false);
      expect(onSelectionChange).toHaveBeenCalledWith('newsletter-1', false);
    });

    it('should set selection directly', () => {
      const onSelectionChange = vi.fn();
      const { result } = renderHook(() =>
        useNewsletterRowState({
          newsletter: mockNewsletter,
          onSelectionChange,
        })
      );

      act(() => {
        result.current.setSelected(true);
      });

      expect(result.current.state.isSelected).toBe(true);
      expect(onSelectionChange).toHaveBeenCalledWith('newsletter-1', true);

      act(() => {
        result.current.setSelected(false);
      });

      expect(result.current.state.isSelected).toBe(false);
      expect(onSelectionChange).toHaveBeenCalledWith('newsletter-1', false);
    });
  });

  describe('tag visibility handlers', () => {
    it('should toggle tag visibility', () => {
      const onTagVisibilityChange = vi.fn();
      const { result } = renderHook(() =>
        useNewsletterRowState({
          newsletter: mockNewsletter,
          onTagVisibilityChange,
        })
      );

      expect(result.current.state.showTags).toBe(false);

      act(() => {
        result.current.toggleTagVisibility();
      });

      expect(result.current.state.showTags).toBe(true);
      expect(onTagVisibilityChange).toHaveBeenCalledWith('newsletter-1', true);

      act(() => {
        result.current.toggleTagVisibility();
      });

      expect(result.current.state.showTags).toBe(false);
      expect(onTagVisibilityChange).toHaveBeenCalledWith('newsletter-1', false);
    });

    it('should handle toggle tag visibility with mock event', () => {
      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as any;

      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      act(() => {
        result.current.toggleTagVisibility(mockEvent);
      });

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(result.current.state.showTags).toBe(true);
    });

    it('should set tag visibility directly', () => {
      const onTagVisibilityChange = vi.fn();
      const { result } = renderHook(() =>
        useNewsletterRowState({
          newsletter: mockNewsletter,
          onTagVisibilityChange,
        })
      );

      act(() => {
        result.current.setTagVisibility(true);
      });

      expect(result.current.state.showTags).toBe(true);
      expect(onTagVisibilityChange).toHaveBeenCalledWith('newsletter-1', true);
    });
  });

  describe('interaction handlers', () => {
    it('should handle mouse enter and leave', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      expect(result.current.state.isHovered).toBe(false);

      act(() => {
        result.current.onMouseEnter();
      });

      expect(result.current.state.isHovered).toBe(true);

      act(() => {
        result.current.onMouseLeave();
      });

      expect(result.current.state.isHovered).toBe(false);
    });

    it('should handle drag start and end', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      expect(result.current.state.isDragging).toBe(false);

      act(() => {
        result.current.onDragStart();
      });

      expect(result.current.state.isDragging).toBe(true);

      act(() => {
        result.current.onDragEnd();
      });

      expect(result.current.state.isDragging).toBe(false);
    });
  });

  describe('loading state handlers', () => {
    it('should set loading state for different operations', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      // Test read operation
      act(() => {
        result.current.setLoadingState('read', true);
      });
      expect(result.current.state.isTogglingRead).toBe(true);

      act(() => {
        result.current.setLoadingState('read', false);
      });
      expect(result.current.state.isTogglingRead).toBe(false);

      // Test like operation
      act(() => {
        result.current.setLoadingState('like', true);
      });
      expect(result.current.state.isTogglingLike).toBe(true);

      // Test archive operation
      act(() => {
        result.current.setLoadingState('archive', true);
      });
      expect(result.current.state.isTogglingArchive).toBe(true);

      // Test queue operation
      act(() => {
        result.current.setLoadingState('queue', true);
      });
      expect(result.current.state.isTogglingQueue).toBe(true);

      // Test tags operation
      act(() => {
        result.current.setLoadingState('tags', true);
      });
      expect(result.current.state.isUpdatingTags).toBe(true);
    });
  });

  describe('error handlers', () => {
    it('should handle tag update error', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      const errorMessage = 'Failed to update tags';

      act(() => {
        result.current.setTagUpdateError(errorMessage);
      });

      expect(result.current.state.tagUpdateError).toBe(errorMessage);

      act(() => {
        result.current.dismissTagError();
      });

      expect(result.current.state.tagUpdateError).toBeNull();
    });
  });

  describe('computed flags', () => {
    it('should compute hasAnyLoading correctly', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      expect(result.current.hasAnyLoading).toBe(false);

      act(() => {
        result.current.setLoadingState('read', true);
      });

      expect(result.current.hasAnyLoading).toBe(true);

      act(() => {
        result.current.setLoadingState('read', false);
        result.current.setLoadingState('like', true);
      });

      expect(result.current.hasAnyLoading).toBe(true);

      act(() => {
        result.current.setLoadingState('like', false);
      });

      expect(result.current.hasAnyLoading).toBe(false);
    });

    it('should compute canInteract correctly', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      expect(result.current.canInteract).toBe(true);

      act(() => {
        result.current.setLoadingState('read', true);
      });

      expect(result.current.canInteract).toBe(false);

      act(() => {
        result.current.setLoadingState('read', false);
        result.current.onDragStart();
      });

      expect(result.current.canInteract).toBe(false);

      act(() => {
        result.current.onDragEnd();
      });

      expect(result.current.canInteract).toBe(true);
    });

    it('should compute showLoadingIndicator correctly', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      expect(result.current.showLoadingIndicator).toBe(false);

      act(() => {
        result.current.setLoadingState('read', true);
      });

      expect(result.current.showLoadingIndicator).toBe(true);

      act(() => {
        result.current.setLoadingState('read', false);
        result.current.onDragStart();
      });

      expect(result.current.showLoadingIndicator).toBe(true);

      act(() => {
        result.current.onDragEnd();
      });

      expect(result.current.showLoadingIndicator).toBe(false);
    });
  });

  describe('convenience setters', () => {
    it('should set showCheckbox directly', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      expect(result.current.state.showCheckbox).toBe(false);

      act(() => {
        result.current.setShowCheckbox(true);
      });

      expect(result.current.state.showCheckbox).toBe(true);
    });

    it('should set showTags directly', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      expect(result.current.state.showTags).toBe(false);

      act(() => {
        result.current.setShowTags(true);
      });

      expect(result.current.state.showTags).toBe(true);
    });
  });

  describe('state stability', () => {
    it('should maintain state object reference when values do not change', () => {
      const { result, rerender } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      const initialState = result.current.state;

      rerender();

      expect(result.current.state).toBe(initialState);
    });

    it('should create new state object when values change', () => {
      const { result } = renderHook(() =>
        useNewsletterRowState({ newsletter: mockNewsletter })
      );

      const initialState = result.current.state;

      act(() => {
        result.current.setSelected(true);
      });

      expect(result.current.state).not.toBe(initialState);
      expect(result.current.state.isSelected).toBe(true);
    });
  });
});
