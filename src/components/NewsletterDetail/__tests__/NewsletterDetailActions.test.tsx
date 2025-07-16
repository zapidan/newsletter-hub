import { AuthProvider } from '@common/contexts/AuthContext';
import { SupabaseProvider } from '@common/contexts/SupabaseContext';
import { ToastProvider } from '@common/contexts/ToastContext';
import type { NewsletterSource, NewsletterWithRelations } from '@common/types';
import { createCacheManager } from '@common/utils/cacheUtils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
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
  const source: NewsletterSource = { id: 'source1', name: 'Source 1', from: 'from', user_id: 'u', created_at: '', updated_at: '' };
  const newsletter: NewsletterWithRelations = {
    id: 'n1', title: 'T', content: '', summary: '', image_url: '', received_at: '', updated_at: '', is_read: false, is_liked: false, is_archived: false, user_id: 'u', newsletter_source_id: source.id, source, tags: [], word_count: 0, estimated_read_time: 0
  };
  const onNewsletterUpdate = vi.fn();
  const testQueryClient = new QueryClient();

  beforeAll(() => {
    createCacheManager(testQueryClient);
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

  it('renders action buttons', () => {
    renderWithProviders(<NewsletterDetailActions newsletter={newsletter} onNewsletterUpdate={onNewsletterUpdate} />);
    expect(screen.getAllByLabelText(/mark as read/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/like/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/archive newsletter/i).length).toBeGreaterThan(0);
    // Test for the queue button by test id (should find both desktop and mobile)
    expect(screen.getAllByTestId('add-to-queue-btn').length).toBeGreaterThan(0);
  });

  // Add more tests for other actions as needed
}); 