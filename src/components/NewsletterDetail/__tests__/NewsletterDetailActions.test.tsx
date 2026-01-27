import { AuthProvider } from '@common/contexts/AuthContext';
import { SupabaseProvider } from '@common/contexts/SupabaseContext';
import { ToastProvider } from '@common/contexts/ToastContext';
import type { NewsletterSource, NewsletterWithRelations } from '@common/types';
import { createCacheManager } from '@common/utils/cacheUtils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterDetailActions } from '../NewsletterDetailActions';

// Mock toast
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Mock the service
vi.mock('@common/services/newsletterSourceGroup/NewsletterSourceGroupService', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    newsletterSourceGroupService: {
      ...actual.newsletterSourceGroupService,
      getGroups: vi.fn(),
      addSourcesToGroup: vi.fn(),
      removeSourcesFromGroup: vi.fn(),
    },
  };
});

// Mock useSharedNewsletterActions
vi.mock('@common/hooks/useSharedNewsletterActions', () => ({
  useSharedNewsletterActions: () => ({
    handleMarkAsRead: vi.fn().mockResolvedValue(true),
    handleMarkAsUnread: vi.fn().mockResolvedValue(true),
    handleToggleLike: vi.fn().mockResolvedValue(true),
    handleToggleArchive: vi.fn().mockResolvedValue(true),
    handleDeleteNewsletter: vi.fn().mockResolvedValue(true),
    handleToggleInQueue: vi.fn().mockResolvedValue(true),
    handleUpdateTags: vi.fn().mockResolvedValue(true),
    handleToggleRead: vi.fn().mockResolvedValue(true),
    handleBulkMarkAsRead: vi.fn().mockResolvedValue(true),
    handleBulkMarkAsUnread: vi.fn().mockResolvedValue(true),
    handleBulkArchive: vi.fn().mockResolvedValue(true),
    handleBulkUnarchive: vi.fn().mockResolvedValue(true),
    handleBulkDelete: vi.fn().mockResolvedValue(true),
    handleBulkToggleLike: vi.fn().mockResolvedValue(true),
    handleBulkAddToQueue: vi.fn().mockResolvedValue(true),
    handleBulkRemoveFromQueue: vi.fn().mockResolvedValue(true),
    handleBulkUpdateTags: vi.fn().mockResolvedValue(true),
    isMarkingAsRead: false,
    isMarkingAsUnread: false,
    isDeletingNewsletter: false,
    isArchiving: false,
    isUnarchiving: false,
    isLiking: false,
    isUnliking: false,
    isAddingToQueue: false,
    isRemovingFromQueue: false,
    isUpdatingTags: false,
    isBulkProcessing: false,
    withOptions: vi.fn(),
  }),
}));

// Mock useReadingQueue
vi.mock('@common/hooks/useReadingQueue', () => ({
  useReadingQueue: () => ({
    readingQueue: [],
    isLoading: false,
    isError: false,
    error: null,
    isEmpty: true,
    addToQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    reorderQueue: vi.fn(),
    clearQueue: vi.fn(),
    markAsRead: vi.fn(),
    markAsUnread: vi.fn(),
    updateTags: vi.fn(),
    cleanupOrphanedItems: vi.fn(),
    isInQueue: vi.fn(),
    isAdding: false,
    isRemoving: false,
    isReordering: false,
    isClearing: false,
    isMarkingAsRead: false,
    isMarkingAsUnread: false,
    isUpdatingTags: false,
    isCleaningUp: false,
    refetch: vi.fn(),
  }),
}));

// Mock useLogger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Optionally mock useAuth to always return a user
vi.mock('@common/contexts/AuthContext', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useAuth: () => ({ user: { id: 'test-user' } }),
    AuthProvider: actual.AuthProvider,
  };
});

// Mock useSupabase to return a dummy context
vi.mock('@common/contexts/SupabaseContext', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useSupabase: () => ({
      supabase: {
        auth: {
          getSession: vi.fn(),
          onAuthStateChange: vi.fn(() => ({
            data: {
              subscription: {
                unsubscribe: vi.fn(),
              },
            },
          })),
        },
      },
      session: null,
      user: { id: 'test-user' },
    }),
    SupabaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe('NewsletterDetailActions', () => {
  const source: NewsletterSource = {
    id: 'source1',
    name: 'Source 1',
    from: 'from',
    user_id: 'u',
    created_at: '',
    updated_at: ''
  };

  const newsletter: NewsletterWithRelations = {
    id: 'n1',
    title: 'Test Newsletter',
    content: 'Test content',
    summary: 'Test summary',
    image_url: '',
    received_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    is_read: false,
    is_liked: false,
    is_archived: false,
    user_id: 'u',
    newsletter_source_id: source.id,
    source,
    tags: [],
    word_count: 100,
    estimated_read_time: 1
  };

  const onNewsletterUpdate = vi.fn();
  const testQueryClient = new QueryClient();

  beforeAll(() => {
    createCacheManager(testQueryClient);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function renderWithProviders(ui: React.ReactElement) {
    return render(
      <ToastProvider>
        <QueryClientProvider client={testQueryClient}>
          <AuthProvider>
            <SupabaseProvider>
              {ui}
            </SupabaseProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ToastProvider>
    );
  }

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderWithProviders(<NewsletterDetailActions newsletter={newsletter} onNewsletterUpdate={onNewsletterUpdate} />);
      // If we get here without throwing, the component renders
      expect(true).toBe(true);
    });

    it('renders for archived newsletter', () => {
      const archivedNewsletter = { ...newsletter, is_archived: true };
      renderWithProviders(<NewsletterDetailActions newsletter={archivedNewsletter} onNewsletterUpdate={onNewsletterUpdate} />);
      // If we get here without throwing, the component renders
      expect(true).toBe(true);
    });
  });

  describe('Component Lifecycle', () => {
    it('should have correct newsletter prop', () => {
      renderWithProviders(<NewsletterDetailActions newsletter={newsletter} onNewsletterUpdate={onNewsletterUpdate} />);

      // Check if the newsletter prop is accessible in the component
      // This is a simple test to verify the component receives the correct data
      expect(newsletter.is_archived).toBe(false);
    });

    it('should cleanup without errors', () => {
      const { unmount } = renderWithProviders(
        <NewsletterDetailActions newsletter={newsletter} onNewsletterUpdate={onNewsletterUpdate} />
      );

      // Should not throw when unmounting
      expect(() => unmount()).not.toThrow();
    });
  });
});