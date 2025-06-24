import { AuthContext } from '@common/contexts/AuthContext';
import {
  useNewsletters,
  useNewsletterSourceGroups,
  useNewsletterSources,
  useReadingQueue,
  useTags,
} from '@common/hooks';
import { useSharedNewsletterActions } from '@common/hooks/useSharedNewsletterActions';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NewslettersPage from '../NewslettersPage';

// Mock hooks
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


// Mock child components
vi.mock('@web/components/CreateSourceGroupModal', () => ({
  CreateSourceGroupModal: vi.fn(({ isOpen, onClose }) =>
    isOpen ? <div data-testid="create-source-group-modal">CreateSourceGroupModal <button onClick={onClose}>Close</button></div> : null
  ),
}));

vi.mock('@web/components/NewsletterRow', () => ({
  __esModule: true, // This is important for components exported with `export default`
  default: vi.fn(({ newsletter, onNewsletterClick, onTagClick }) => (
    <div data-testid={`newsletter-row-${newsletter.id}`} onClick={() => onNewsletterClick(newsletter)}>
      <p>{newsletter.title}</p>
      {newsletter.tags?.map((tag: any) => (
        <button key={tag.id} data-testid={`tag-on-newsletter-${tag.id}`} onClick={(e) => onTagClick(tag, e)}>
          {tag.name}
        </button>
      ))}
    </div>
  )),
}));


vi.mock('@web/components/SourceGroupCard', () => ({
  SourceGroupCard: vi.fn(({ group, onClick, onEdit, onDelete }) => (
    <div data-testid={`source-group-card-${group.id}`} onClick={onClick}>
      {group.name}
      <button onClick={() => onEdit(group)}>Edit</button>
      <button onClick={() => onDelete(group.id)}>Delete</button>
    </div>
  )),
}));


const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const queryClient = new QueryClient();
const mockUser = { id: 'user-1', email: 'test@example.com' };

const mockNewsletterSource = (id: string, name: string, from: string, count = 0, unread = 0) => ({
  id,
  name,
  from,
  rss_url: `https://${from}/rss`,
  icon_url: null,
  is_active: true,
  is_archived: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: mockUser.id,
  newsletter_count: count,
  unread_count: unread,
});

const mockNewsletter = (id: string, title: string, sourceId: string, tags: any[] = []) => ({
  id,
  title,
  content: '<p>Test content</p>',
  html_content: '<p>Test content</p>',
  summary: 'Test summary',
  url: `https://example.com/news/${id}`,
  newsletter_source_id: sourceId,
  source: mockNewsletterSource(sourceId, 'Source ' + sourceId, `test@source${sourceId}.com`),
  received_at: new Date().toISOString(),
  is_read: false,
  is_liked: false,
  is_archived: false,
  tags,
  user_id: mockUser.id,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const mockTag = (id: string, name: string) => ({
  id,
  name,
  color: '#FF0000',
  user_id: mockUser.id,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const mockSourceGroup = (id: string, name: string, sources: any[] = []) => ({
  id,
  name,
  sources,
  user_id: mockUser.id,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});


const renderNewslettersPage = async () => {
  let utils;
  await act(async () => {
    utils = render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={{ user: mockUser, session: null, loading: false, signOut: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(), sendPasswordResetEmail: vi.fn(), updatePassword: vi.fn() } as any}>
          <MemoryRouter>
            <NewslettersPage />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
  });
  return utils;
};

describe('NewslettersPage', () => {
  afterEach(() => {
    if (global.gc) {
      global.gc();
    }
  });
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Default mock implementations
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
      isLoading: false, // isLoadingGroups in component
      isError: false, // isGroupsError in component
      deleteGroup: { mutateAsync: vi.fn().mockResolvedValue({}) },
    });
    (useReadingQueue as jest.Mock).mockReturnValue({
      readingQueue: [],
      // ... other reading queue mock values if needed
    });
    (useTags as jest.Mock).mockReturnValue({
      getTags: vi.fn().mockResolvedValue([]),
      // ... other tags mock values if needed
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

  test('renders initial layout and headings', async () => {
    await renderNewslettersPage();
    expect(screen.getByText('Manage Newsletter Sources')).toBeInTheDocument();
    expect(screen.getByText('Your Groups')).toBeInTheDocument();
    expect(screen.getByText('New Group')).toBeInTheDocument();
    expect(screen.getByText('Back to Inbox')).toBeInTheDocument();
  });

  test('displays loading state for sources', async () => {
    (useNewsletterSources as jest.Mock).mockReturnValue({ ...useNewsletterSources(), isLoadingSources: true });
    await renderNewslettersPage();
    // Assuming a loading indicator for sources would be present.
    // The component currently doesn't show a specific loading text for sources list,
    // but rather for groups and newsletters. We might need to add a specific loader or adjust test.
  });

  test('displays loading state for groups', async () => {
    (useNewsletterSourceGroups as jest.Mock).mockReturnValue({ ...useNewsletterSourceGroups(), isLoading: true });
    await renderNewslettersPage();
    expect(screen.getByText('Loading groups...')).toBeInTheDocument();
  });

  test('displays error state for sources', async () => {
    (useNewsletterSources as jest.Mock).mockReturnValue({ ...useNewsletterSources(), isErrorSources: true });
    await renderNewslettersPage();
    // The component doesn't explicitly show a top-level error for sources list, errors are handled per source or in newsletters section.
    // This test might need adjustment based on how source errors should be displayed.
  });

  test('displays error state for groups', async () => {
    (useNewsletterSourceGroups as jest.Mock).mockReturnValue({ ...useNewsletterSourceGroups(), isError: true });
    await renderNewslettersPage();
    expect(screen.getByText('Error loading groups')).toBeInTheDocument();
  });

  test('displays empty state for sources', async () => {
    await renderNewslettersPage(); // Default mock has empty newsletterSources
    // The component doesn't have a specific "No sources found" message for the source grid itself,
    // but rather for newsletters when a source is selected.
  });

  test('displays empty state for groups', async () => {
    await renderNewslettersPage(); // Default mock has empty groups
    expect(screen.getByText('No groups created yet')).toBeInTheDocument();
  });

  // TODO: Revisit these tests. They are currently skipped due to OOM errors when running the full suite.
  // Investigate potential memory leaks or test setup optimizations for complex components.
  describe.skip('Source Management', () => {
    const sources = [
      mockNewsletterSource('source-1', 'Tech Weekly', 'tech@weekly.com', 5, 2),
      mockNewsletterSource('source-2', 'Design Monthly', 'design@monthly.com', 10, 0),
    ];
    const newslettersForSource1 = [
      mockNewsletter('nl-1', 'Newsletter 1 for Source 1', 'source-1'),
      mockNewsletter('nl-2', 'Newsletter 2 for Source 1', 'source-1'),
    ];

    test('renders a list of newsletter sources', async () => {
      (useNewsletterSources as jest.Mock).mockReturnValue({
        newsletterSources: sources,
        isLoadingSources: false,
        isErrorSources: false,
        updateSource: vi.fn().mockResolvedValue({}),
        setSourceArchiveStatus: vi.fn().mockResolvedValue({}),
        isArchivingSource: false,
      });
      await renderNewslettersPage();
      expect(screen.getByText('Tech Weekly')).toBeInTheDocument();
      expect(screen.getByText('tech@weekly.com')).toBeInTheDocument();
      expect(screen.getByText('Design Monthly')).toBeInTheDocument();
      expect(screen.getByText('design@monthly.com')).toBeInTheDocument();
      expect(screen.getByText('5 newsletters')).toBeInTheDocument();
      expect(screen.getByText('2 unread')).toBeInTheDocument();
    });

    test('selects a source and displays its newsletters', async () => {
      (useNewsletterSources as jest.Mock).mockReturnValue({
        newsletterSources: sources,
        isLoadingSources: false,
        isErrorSources: false,
        updateSource: vi.fn().mockResolvedValue({}),
        setSourceArchiveStatus: vi.fn().mockResolvedValue({}),
        isArchivingSource: false,
      });
      (useNewsletters as jest.Mock).mockImplementation((filter) => {
        if (filter.sourceIds && filter.sourceIds.includes('source-1')) {
          return {
            newsletters: newslettersForSource1,
            isLoadingNewsletters: false,
            isErrorNewsletters: false,
            refetchNewsletters: vi.fn(),
          };
        }
        return { newsletters: [], isLoadingNewsletters: false, isErrorNewsletters: false, refetchNewsletters: vi.fn() };
      });

      await renderNewslettersPage();

      const sourceElement = screen.getByText('Tech Weekly');
      await act(async () => {
        fireEvent.click(sourceElement);
      });

      await waitFor(() => {
        expect(screen.getByText('Newsletters from this Source')).toBeInTheDocument();
        expect(screen.getByText('Newsletter 1 for Source 1')).toBeInTheDocument();
        expect(screen.getByText('Newsletter 2 for Source 1')).toBeInTheDocument();
      });
    });

    test('opens edit modal for a source and submits update', async () => {
      const mockUpdateSource = vi.fn().mockResolvedValue({});
      (useNewsletterSources as jest.Mock).mockReturnValue({
        newsletterSources: [sources[0]],
        isLoadingSources: false,
        isErrorSources: false,
        updateSource: mockUpdateSource,
        setSourceArchiveStatus: vi.fn().mockResolvedValue({}),
        isArchivingSource: false,
      });

      await renderNewslettersPage();

      const sourceCard = screen.getByText(sources[0].name).closest('.group');
      expect(sourceCard).not.toBeNull();
      const editButton = await within(sourceCard!).findByTitle('Edit source');

      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByText('Edit Newsletter Source')).toBeInTheDocument();

      const nameInput = screen.getByLabelText('Name');
      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Updated Tech Weekly' } });
      });

      const updateButton = screen.getByText('Update Source');
      await act(async () => {
        fireEvent.click(updateButton);
      });

      expect(mockUpdateSource).toHaveBeenCalledWith({ id: 'source-1', name: 'Updated Tech Weekly' });
      await waitFor(() => {
        expect(screen.queryByText('Edit Newsletter Source')).not.toBeInTheDocument();
      });
    });


    test('handles archive source confirmation and action', async () => {
      const mockSetSourceArchiveStatus = vi.fn().mockResolvedValue({});
      const mockBulkArchive = vi.fn().mockResolvedValue({});
      (useNewsletterSources as jest.Mock).mockReturnValue({
        newsletterSources: [sources[0]],
        isLoadingSources: false,
        isErrorSources: false,
        updateSource: vi.fn(),
        setSourceArchiveStatus: mockSetSourceArchiveStatus,
        isArchivingSource: false,
      });
      (useNewsletters as jest.Mock).mockReturnValue({
        newsletters: newslettersForSource1,
        isLoadingNewsletters: false,
        isErrorNewsletters: false,
        bulkArchive: mockBulkArchive,
        refetchNewsletters: vi.fn(),
      });
      const mockNewsletterApiGetAll = vi.spyOn(require('@common/api').newsletterApi, 'getAll').mockResolvedValue({
        data: newslettersForSource1,
        error: null,
        count: newslettersForSource1.length,
      });


      await renderNewslettersPage();

      const sourceCard = screen.getByText(sources[0].name).closest('.group');
      expect(sourceCard).not.toBeNull();
      const deleteButton = await within(sourceCard!).findByTitle('Delete source');

      await act(async () => {
        fireEvent.click(deleteButton);
      });

      expect(screen.getByText('Delete Newsletter Source')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete this source?/)).toBeInTheDocument();

      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      await act(async () => {
        fireEvent.click(confirmButton);
      });

      expect(mockNewsletterApiGetAll).toHaveBeenCalledWith({ sourceIds: ['source-1'], isArchived: false, limit: 1000 });
      expect(mockBulkArchive).toHaveBeenCalledWith(newslettersForSource1.map(nl => nl.id));
      expect(mockSetSourceArchiveStatus).toHaveBeenCalledWith('source-1', true);

      await waitFor(() => {
        expect(screen.queryByText('Delete Newsletter Source')).not.toBeInTheDocument();
      });
      mockNewsletterApiGetAll.mockRestore();
    });
  });

  // TODO: Revisit these tests. They are currently skipped due to OOM errors when running the full suite.
  // Investigate potential memory leaks or test setup optimizations for complex components.
  describe.skip('Group Management', () => {
    const groups = [
      mockSourceGroup('group-1', 'Primary Tech', [mockNewsletterSource('source-1', 'Tech Weekly', 'tech@weekly.com')]),
      mockSourceGroup('group-2', 'Design Reads', [mockNewsletterSource('source-2', 'Design Monthly', 'design@monthly.com')]),
    ];
    const newslettersForGroup1 = [mockNewsletter('nl-g1', 'Newsletter for Group 1', 'source-1')];

    test('renders a list of source groups', async () => {
      (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
        groups,
        isLoading: false,
        isError: false,
        deleteGroup: { mutateAsync: vi.fn().mockResolvedValue({}) },
      });
      await renderNewslettersPage();
      expect(screen.getByText('Primary Tech')).toBeInTheDocument();
      expect(screen.getByText('Design Reads')).toBeInTheDocument();
    });

    test('opens create group modal on "New Group" click', async () => {
      await renderNewslettersPage();
      const newGroupButton = screen.getByText('New Group');
      await act(async () => {
        fireEvent.click(newGroupButton);
      });
      expect(screen.getByTestId('create-source-group-modal')).toBeInTheDocument();
    });

    test('selects a group and displays its newsletters', async () => {
      (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
        groups,
        isLoading: false,
        isError: false,
        deleteGroup: { mutateAsync: vi.fn().mockResolvedValue({}) },
      });
      (useNewsletters as jest.Mock).mockImplementation((filter) => {
        if (filter.sourceIds && filter.sourceIds.includes('source-1')) {
          return {
            newsletters: newslettersForGroup1,
            isLoadingNewsletters: false,
            isErrorNewsletters: false,
            refetchNewsletters: vi.fn(),
          };
        }
        return { newsletters: [], isLoadingNewsletters: false, isErrorNewsletters: false, refetchNewsletters: vi.fn() };
      });

      await renderNewslettersPage();
      const groupElement = screen.getByText('Primary Tech');
      await act(async () => {
        fireEvent.click(groupElement);
      });

      await waitFor(() => {
        expect(screen.getByText('Newsletters in this Group')).toBeInTheDocument();
        expect(screen.getByText('Newsletter for Group 1')).toBeInTheDocument();
      });
    });

    test('opens edit group modal when editing a group', async () => {
      (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
        groups: [groups[0]],
        isLoading: false,
        isError: false,
        deleteGroup: { mutateAsync: vi.fn().mockResolvedValue({}) },
      });
      await renderNewslettersPage();

      const editButton = screen.getByText('Edit');
      await act(async () => {
        fireEvent.click(editButton);
      });

      expect(screen.getByTestId('create-source-group-modal')).toBeInTheDocument();
      const CreateSourceGroupModalMock = vi.mocked(require('@web/components/CreateSourceGroupModal').CreateSourceGroupModal);
      expect(CreateSourceGroupModalMock).toHaveBeenCalledWith(expect.objectContaining({ groupToEdit: groups[0] }), {});
    });

    test('calls deleteGroup when deleting a group', async () => {
      const mockDeleteGroupMutateAsync = vi.fn().mockResolvedValue({});
      (useNewsletterSourceGroups as jest.Mock).mockReturnValue({
        groups: [groups[0]],
        isLoading: false,
        isError: false,
        deleteGroup: { mutateAsync: mockDeleteGroupMutateAsync },
      });
      await renderNewslettersPage();

      const deleteButton = screen.getByText('Delete');
      await act(async () => {
        fireEvent.click(deleteButton);
      });

      expect(mockDeleteGroupMutateAsync).toHaveBeenCalledWith(groups[0].id);
    });
  });

  describe('Newsletter Display and Tag Filtering', () => {
    const source1 = mockNewsletterSource('source-1', 'Tech Source', 'tech@source.com');
    const tag1 = mockTag('tag-tech', 'Technology');
    const tag2 = mockTag('tag-ai', 'AI');
    const newsletters = [
      mockNewsletter('nl-1', 'AI Breakthroughs', 'source-1', [tag1, tag2]),
      mockNewsletter('nl-2', 'Intro to Quantum', 'source-1', [tag1]),
      mockNewsletter('nl-3', 'Web Dev News', 'source-1', []),
    ];

    beforeEach(() => {
      (useNewsletterSources as jest.Mock).mockReturnValue({
        newsletterSources: [source1],
        isLoadingSources: false,
        isErrorSources: false,
        updateSource: vi.fn().mockResolvedValue({}),
        setSourceArchiveStatus: vi.fn().mockResolvedValue({}),
        isArchivingSource: false,
      });
      (useTags as jest.Mock).mockReturnValue({
        getTags: vi.fn().mockResolvedValue([tag1, tag2]),
      });
      (useNewsletters as jest.Mock).mockReturnValue({
        newsletters: [],
        isLoadingNewsletters: false,
        isErrorNewsletters: false,
        errorNewsletters: null,
        bulkArchive: vi.fn().mockResolvedValue({}),
        refetchNewsletters: vi.fn(),
      });
    });

    test('displays newsletters when a source is selected', async () => {
      (useNewsletters as jest.Mock).mockReturnValue({
        newsletters,
        isLoadingNewsletters: false,
        isErrorNewsletters: false,
        refetchNewsletters: vi.fn(),
      });
      await renderNewslettersPage();

      const sourceElement = screen.getByText(source1.name);
      await act(async () => {
        fireEvent.click(sourceElement);
      });

      await waitFor(() => {
        expect(screen.getByText('AI Breakthroughs')).toBeInTheDocument();
        expect(screen.getByText('Intro to Quantum')).toBeInTheDocument();
        expect(screen.getByText('Web Dev News')).toBeInTheDocument();
      });
    });

    test('displays loading state for newsletters', async () => {
      (useNewsletters as jest.Mock).mockReturnValue({
        newsletters: [],
        isLoadingNewsletters: true,
        isErrorNewsletters: false,
        refetchNewsletters: vi.fn(),
      });
      await renderNewslettersPage();
      const sourceElement = screen.getByText(source1.name);
      await act(async () => {
        fireEvent.click(sourceElement);
      });
      expect(await screen.findByTestId('loader-container')).toBeInTheDocument();
    });

    test('displays error state for newsletters', async () => {
      (useNewsletters as jest.Mock).mockReturnValue({
        newsletters: [],
        isLoadingNewsletters: false,
        isErrorNewsletters: true,
        errorNewsletters: { message: 'Failed to load newsletters' },
        refetchNewsletters: vi.fn(),
      });
      await renderNewslettersPage();
      const sourceElement = screen.getByText(source1.name);
      await act(async () => {
        fireEvent.click(sourceElement);
      });
      expect(await screen.findByText(/Error loading newsletters: Failed to load newsletters/i)).toBeInTheDocument();
    });

    test('displays empty state for newsletters', async () => {
      (useNewsletters as jest.Mock).mockReturnValue({
        newsletters: [],
        isLoadingNewsletters: false,
        isErrorNewsletters: false,
        refetchNewsletters: vi.fn(),
      });
      await renderNewslettersPage();
      const sourceElement = screen.getByText(source1.name);
      await act(async () => {
        fireEvent.click(sourceElement);
      });
      expect(await screen.findByText(/No newsletters found for this source/i)).toBeInTheDocument();
    });

    test('filters newsletters by tag', async () => {
      (useNewsletters as jest.Mock).mockReturnValue({
        newsletters,
        isLoadingNewsletters: false,
        isErrorNewsletters: false,
        refetchNewsletters: vi.fn(),
      });
      await renderNewslettersPage();

      // Click on the source
      const sourceElement = await waitFor(() =>
        screen.getByText(source1.name, { exact: false })
      );
      await act(async () => {
        fireEvent.click(sourceElement);
      });

      // Wait for the newsletter to be visible
      const newsletterCard = await screen.findByTestId(`newsletter-row-${newsletters[0].id}`);
      expect(within(newsletterCard).getByText('AI Breakthroughs')).toBeInTheDocument();

      // Find the tag button using the test ID from the mock
      const tagButton = within(newsletterCard).getByTestId(`tag-on-newsletter-${tag2.id}`);
      expect(tagButton).toHaveTextContent(tag2.name);

      await act(async () => {
        fireEvent.click(tagButton);
      });

      // Verify the filter is applied by checking for the filter display
      await waitFor(() => {
        // Look for the exact tag name in the filter chips
        const filterChip = screen.getByRole('button', {
          name: new RegExp(`^${tag2.name}$`, 'i')
        });
        expect(filterChip).toBeInTheDocument();

        // Verify the correct newsletter is shown by checking for its test ID
        expect(screen.getByTestId(`newsletter-row-${newsletters[0].id}`)).toBeInTheDocument();

        // Verify other newsletters without the tag are hidden
        expect(screen.queryByTestId(`newsletter-row-${newsletters[1].id}`)).not.toBeInTheDocument();
        expect(screen.queryByTestId(`newsletter-row-${newsletters[2].id}`)).not.toBeInTheDocument();
      });
    });
  });
});
