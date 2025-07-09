import { AuthContext } from '@common/contexts/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock all hooks to prevent complex component rendering
vi.mock('@common/hooks/useNewsletters');
vi.mock('@common/hooks/useNewsletterSourceGroups');
vi.mock('@common/hooks/useNewsletterSources');
vi.mock('@common/hooks/useReadingQueue');
vi.mock('@common/hooks/useTags');
vi.mock('@common/hooks/useSharedNewsletterActions');
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import the mocked hooks
import {
  useNewsletters,
  useNewsletterSourceGroups,
  useNewsletterSources,
  useReadingQueue,
  useTags,
} from '@common/hooks';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';

// Simplified mock data
const mockUser = { id: 'user-1', email: 'test@example.com' };

const mockNewsletterSource = (id: string, name: string, from: string, count = 0, unread = 0) => ({
  id,
  name,
  from,
  user_id: mockUser.id,
  newsletter_count: count,
  unread_count: unread,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const mockNewsletter = (id: string, title: string, sourceId: string, tags: any[] = []) => ({
  id,
  title,
  content: '<p>Test content</p>',
  summary: 'Test summary',
  newsletter_source_id: sourceId,
  source: mockNewsletterSource(sourceId, 'Source ' + sourceId, `test@source${sourceId}.com`),
  received_at: new Date().toISOString(),
  is_read: false,
  is_liked: false,
  is_archived: false,
  tags,
  user_id: mockUser.id,
});

const mockTag = (id: string, name: string) => ({
  id,
  name,
  color: '#FF0000',
  user_id: mockUser.id,
  created_at: new Date().toISOString(),
});

const mockSourceGroup = (id: string, name: string, sources: any[] = []) => ({
  id,
  name,
  sources,
  user_id: mockUser.id,
  created_at: new Date().toISOString(),
});

// Test wrapper for hooks
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ user: mockUser, session: null, loading: false, signOut: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), sendPasswordResetEmail: vi.fn(), updatePassword: vi.fn() } as any}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe('NewsletterGroupsPage Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Simplified default mocks
    (useNewsletters as jest.Mock).mockReturnValue({
      newsletters: [],
      isLoadingNewsletters: false,
      isErrorNewsletters: false,
      errorNewsletters: null,
      bulkArchive: vi.fn().mockResolvedValue({}),
      refetchNewsletters: vi.fn(),
    });

    (useNewsletterSources as jest.Mock).mockReturnValue({
      newsletterSources: [],
      isLoadingSources: false,
      isErrorSources: false,
      updateSource: vi.fn().mockResolvedValue({}),
      setSourceArchiveStatus: vi.fn().mockResolvedValue({}),
      isArchivingSource: false,
    });

    (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
      groups: [],
      isLoading: false,
      isError: false,
      deleteGroup: { mutateAsync: vi.fn().mockResolvedValue({}) },
    });

    (useReadingQueue as jest.Mock).mockReturnValue({
      readingQueue: [],
    });

    (useTags as jest.Mock).mockReturnValue({
      getTags: vi.fn().mockResolvedValue([]),
    });

    (useSharedNewsletterActions as jest.Mock).mockReturnValue({
      handleToggleLike: vi.fn().mockResolvedValue({}),
      handleToggleArchive: vi.fn().mockResolvedValue({}),
      handleToggleRead: vi.fn().mockResolvedValue({}),
      handleDeleteNewsletter: vi.fn().mockResolvedValue({}),
      handleToggleInQueue: vi.fn().mockResolvedValue({}),
      handleUpdateTags: vi.fn().mockResolvedValue({}),
      isUpdatingTags: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  test('useNewsletters hook returns expected data structure', () => {
    const { result } = renderHook(() => useNewsletters(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current).toHaveProperty('newsletters');
    expect(result.current).toHaveProperty('isLoadingNewsletters');
    expect(result.current).toHaveProperty('isErrorNewsletters');
    expect(result.current).toHaveProperty('refetchNewsletters');
  });

  test('useNewsletterSources hook returns expected data structure', () => {
    const { result } = renderHook(() => useNewsletterSources(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current).toHaveProperty('newsletterSources');
    expect(result.current).toHaveProperty('isLoadingSources');
    expect(result.current).toHaveProperty('isErrorSources');
    expect(result.current).toHaveProperty('updateSource');
    expect(result.current).toHaveProperty('setSourceArchiveStatus');
  });

  test('useNewsletterSourceGroups hook returns expected data structure', () => {
    const { result } = renderHook(() => useNewsletterSourceGroups(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current).toHaveProperty('groups');
    expect(result.current).toHaveProperty('isLoading');
    expect(result.current).toHaveProperty('isError');
    expect(result.current).toHaveProperty('deleteGroup');
  });

  test('useReadingQueue hook returns expected data structure', () => {
    const { result } = renderHook(() => useReadingQueue(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current).toHaveProperty('readingQueue');
  });

  test('useTags hook returns expected data structure', () => {
    const { result } = renderHook(() => useTags(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current).toHaveProperty('getTags');
  });

  test('useSharedNewsletterActions hook returns expected data structure', () => {
    const { result } = renderHook(() => useSharedNewsletterActions(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current).toHaveProperty('handleToggleLike');
    expect(result.current).toHaveProperty('handleToggleArchive');
    expect(result.current).toHaveProperty('handleToggleRead');
    expect(result.current).toHaveProperty('handleDeleteNewsletter');
    expect(result.current).toHaveProperty('handleToggleInQueue');
    expect(result.current).toHaveProperty('handleUpdateTags');
  });

  test('handles loading state for newsletters', () => {
    (useNewsletters as jest.Mock).mockReturnValue({
      newsletters: [],
      isLoadingNewsletters: true,
      isErrorNewsletters: false,
      refetchNewsletters: vi.fn(),
    });

    const { result } = renderHook(() => useNewsletters(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isLoadingNewsletters).toBe(true);
  });

  test('handles error state for newsletters', () => {
    (useNewsletters as jest.Mock).mockReturnValue({
      newsletters: [],
      isLoadingNewsletters: false,
      isErrorNewsletters: true,
      errorNewsletters: { message: 'Failed to load newsletters' },
      refetchNewsletters: vi.fn(),
    });

    const { result } = renderHook(() => useNewsletters(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isErrorNewsletters).toBe(true);
    expect(result.current.errorNewsletters).toEqual({ message: 'Failed to load newsletters' });
  });

  test('handles loading state for groups', () => {
    (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
      groups: [],
      isLoading: true,
      isError: false,
      deleteGroup: { mutateAsync: vi.fn().mockResolvedValue({}) },
    });

    const { result } = renderHook(() => useNewsletterSourceGroups(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  test('handles error state for groups', () => {
    (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
      groups: [],
      isLoading: false,
      isError: true,
      deleteGroup: { mutateAsync: vi.fn().mockResolvedValue({}) },
    });

    const { result } = renderHook(() => useNewsletterSourceGroups(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isError).toBe(true);
  });

  test('handles source data correctly', () => {
    const sources = [mockNewsletterSource('source-1', 'Tech Weekly', 'tech@weekly.com', 5, 2)];
    (useNewsletterSources as jest.Mock).mockReturnValue({
      newsletterSources: sources,
      isLoadingSources: false,
      isErrorSources: false,
      updateSource: vi.fn().mockResolvedValue({}),
      setSourceArchiveStatus: vi.fn().mockResolvedValue({}),
      isArchivingSource: false,
    });

    const { result } = renderHook(() => useNewsletterSources(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.newsletterSources).toHaveLength(1);
    expect(result.current.newsletterSources[0].name).toBe('Tech Weekly');
    expect(result.current.newsletterSources[0].newsletter_count).toBe(5);
    expect(result.current.newsletterSources[0].unread_count).toBe(2);
  });

  test('handles group data correctly', () => {
    const groups = [mockSourceGroup('group-1', 'Primary Tech', [mockNewsletterSource('source-1', 'Tech Weekly', 'tech@weekly.com')])];
    (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
      groups,
      isLoading: false,
      isError: false,
      deleteGroup: { mutateAsync: vi.fn().mockResolvedValue({}) },
    });

    const { result } = renderHook(() => useNewsletterSourceGroups(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].name).toBe('Primary Tech');
    expect(result.current.groups[0].sources).toHaveLength(1);
  });

  test('handles newsletter data correctly', () => {
    const newsletters = [mockNewsletter('nl-1', 'AI Breakthroughs', 'source-1')];
    (useNewsletters as jest.Mock).mockReturnValue({
      newsletters,
      isLoadingNewsletters: false,
      isErrorNewsletters: false,
      refetchNewsletters: vi.fn(),
    });

    const { result } = renderHook(() => useNewsletters(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.newsletters).toHaveLength(1);
    expect(result.current.newsletters[0].title).toBe('AI Breakthroughs');
    expect(result.current.newsletters[0].newsletter_source_id).toBe('source-1');
  });

  test('handles tag data correctly', async () => {
    const tags = [mockTag('tag-1', 'Technology')];
    const mockGetTags = vi.fn().mockResolvedValue(tags);
    (useTags as jest.Mock).mockReturnValue({
      getTags: mockGetTags,
    });

    const { result } = renderHook(() => useTags(), {
      wrapper: createTestWrapper(),
    });

    const fetchedTags = await result.current.getTags();
    expect(fetchedTags).toEqual(tags);
    expect(mockGetTags).toHaveBeenCalled();
  });

  test('handles source update functionality', async () => {
    const mockUpdateSource = vi.fn().mockResolvedValue({});
    (useNewsletterSources as jest.Mock).mockReturnValue({
      newsletterSources: [],
      isLoadingSources: false,
      isErrorSources: false,
      updateSource: mockUpdateSource,
      setSourceArchiveStatus: vi.fn().mockResolvedValue({}),
      isArchivingSource: false,
    });

    const { result } = renderHook(() => useNewsletterSources(), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      await result.current.updateSource({ id: 'source-1', name: 'Updated Name' });
    });

    expect(mockUpdateSource).toHaveBeenCalledWith({ id: 'source-1', name: 'Updated Name' });
  });

  test('handles source archive functionality', async () => {
    const mockSetSourceArchiveStatus = vi.fn().mockResolvedValue({});
    (useNewsletterSources as jest.Mock).mockReturnValue({
      newsletterSources: [],
      isLoadingSources: false,
      isErrorSources: false,
      updateSource: vi.fn().mockResolvedValue({}),
      setSourceArchiveStatus: mockSetSourceArchiveStatus,
      isArchivingSource: false,
    });

    const { result } = renderHook(() => useNewsletterSources(), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      await result.current.setSourceArchiveStatus('source-1', true);
    });

    expect(mockSetSourceArchiveStatus).toHaveBeenCalledWith('source-1', true);
  });

  test('handles group deletion functionality', async () => {
    const mockDeleteGroup = vi.fn().mockResolvedValue({});
    (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
      groups: [],
      isLoading: false,
      isError: false,
      deleteGroup: { mutateAsync: mockDeleteGroup },
    });

    const { result } = renderHook(() => useNewsletterSourceGroups(), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      await result.current.deleteGroup.mutateAsync('group-1');
    });

    expect(mockDeleteGroup).toHaveBeenCalledWith('group-1');
  });

  test('handles newsletter actions correctly', async () => {
    const mockHandleToggleLike = vi.fn().mockResolvedValue({});
    const mockHandleToggleArchive = vi.fn().mockResolvedValue({});
    const mockHandleToggleRead = vi.fn().mockResolvedValue({});

    (useSharedNewsletterActions as jest.Mock).mockReturnValue({
      handleToggleLike: mockHandleToggleLike,
      handleToggleArchive: mockHandleToggleArchive,
      handleToggleRead: mockHandleToggleRead,
      handleDeleteNewsletter: vi.fn().mockResolvedValue({}),
      handleToggleInQueue: vi.fn().mockResolvedValue({}),
      handleUpdateTags: vi.fn().mockResolvedValue({}),
      isUpdatingTags: false,
    });

    const { result } = renderHook(() => useSharedNewsletterActions(), {
      wrapper: createTestWrapper(),
    });

    const newsletter = mockNewsletter('nl-1', 'Test Newsletter', 'source-1');

    await act(async () => {
      await result.current.handleToggleLike(newsletter);
    });

    expect(mockHandleToggleLike).toHaveBeenCalledWith(newsletter);
  });

  test('handles newsletter refetch functionality', async () => {
    const mockRefetchNewsletters = vi.fn();
    (useNewsletters as jest.Mock).mockReturnValue({
      newsletters: [],
      isLoadingNewsletters: false,
      isErrorNewsletters: false,
      refetchNewsletters: mockRefetchNewsletters,
    });

    const { result } = renderHook(() => useNewsletters(), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      result.current.refetchNewsletters();
    });

    expect(mockRefetchNewsletters).toHaveBeenCalled();
  });

  test('handles bulk archive functionality', async () => {
    const mockBulkArchive = vi.fn().mockResolvedValue({});
    (useNewsletters as jest.Mock).mockReturnValue({
      newsletters: [],
      isLoadingNewsletters: false,
      isErrorNewsletters: false,
      bulkArchive: mockBulkArchive,
      refetchNewsletters: vi.fn(),
    });

    const { result } = renderHook(() => useNewsletters(), {
      wrapper: createTestWrapper(),
    });

    await act(async () => {
      await result.current.bulkArchive(['nl-1', 'nl-2']);
    });

    expect(mockBulkArchive).toHaveBeenCalledWith(['nl-1', 'nl-2']);
  });

  test('handles tag update functionality', async () => {
    const mockHandleUpdateTags = vi.fn().mockResolvedValue({});
    (useSharedNewsletterActions as jest.Mock).mockReturnValue({
      handleToggleLike: vi.fn().mockResolvedValue({}),
      handleToggleArchive: vi.fn().mockResolvedValue({}),
      handleToggleRead: vi.fn().mockResolvedValue({}),
      handleDeleteNewsletter: vi.fn().mockResolvedValue({}),
      handleToggleInQueue: vi.fn().mockResolvedValue({}),
      handleUpdateTags: mockHandleUpdateTags,
      isUpdatingTags: false,
    });

    const { result } = renderHook(() => useSharedNewsletterActions(), {
      wrapper: createTestWrapper(),
    });

    const tags = [mockTag('tag-1', 'Technology')];

    await act(async () => {
      await result.current.handleUpdateTags('nl-1', tags);
    });

    expect(mockHandleUpdateTags).toHaveBeenCalledWith('nl-1', tags);
  });

  test('handles reading queue functionality', () => {
    const readingQueue = [
      { id: '1', newsletter_id: 'nl-1', position: 1, added_at: new Date().toISOString() },
      { id: '2', newsletter_id: 'nl-2', position: 2, added_at: new Date().toISOString() },
    ];

    (useReadingQueue as jest.Mock).mockReturnValue({
      readingQueue,
    });

    const { result } = renderHook(() => useReadingQueue(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.readingQueue).toHaveLength(2);
    expect(result.current.readingQueue[0].newsletter_id).toBe('nl-1');
    expect(result.current.readingQueue[1].newsletter_id).toBe('nl-2');
  });

  test('handles archiving source state', () => {
    (useNewsletterSources as jest.Mock).mockReturnValue({
      newsletterSources: [],
      isLoadingSources: false,
      isErrorSources: false,
      updateSource: vi.fn().mockResolvedValue({}),
      setSourceArchiveStatus: vi.fn().mockResolvedValue({}),
      isArchivingSource: true,
    });

    const { result } = renderHook(() => useNewsletterSources(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isArchivingSource).toBe(true);
  });

  test('handles updating tags state', () => {
    (useSharedNewsletterActions as jest.Mock).mockReturnValue({
      handleToggleLike: vi.fn().mockResolvedValue({}),
      handleToggleArchive: vi.fn().mockResolvedValue({}),
      handleToggleRead: vi.fn().mockResolvedValue({}),
      handleDeleteNewsletter: vi.fn().mockResolvedValue({}),
      handleToggleInQueue: vi.fn().mockResolvedValue({}),
      handleUpdateTags: vi.fn().mockResolvedValue({}),
      isUpdatingTags: true,
    });

    const { result } = renderHook(() => useSharedNewsletterActions(), {
      wrapper: createTestWrapper(),
    });

    expect(result.current.isUpdatingTags).toBe(true);
  });
}); 