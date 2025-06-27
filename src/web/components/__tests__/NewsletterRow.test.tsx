import { NewsletterWithRelations } from '@common/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import NewsletterRow from '../NewsletterRow';

// Mock useAuth to prevent "useAuth must be used within an AuthProvider"
vi.mock('@common/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    // Add other properties if NewsletterRow or its children use them (e.g., session)
  }),
}));

// Mock useLogger to prevent issues with its internal useAuth call
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock child components
vi.mock('../NewsletterActions', () => ({
  default: vi.fn((props) => <div data-testid="newsletter-actions" data-props={JSON.stringify(props)} />),
}));
vi.mock('../TagSelector', () => ({
  default: vi.fn((props) => <div data-testid="tag-selector" data-props={JSON.stringify(props)} />),
}));

const mockNewsletter: NewsletterWithRelations = {
  id: '1',
  title: 'Test Newsletter Title',
  summary: 'A brief summary of the newsletter.',
  content: 'https://example.com/newsletter/1',
  image_url: 'https://example.com/image.png',
  received_at: '2023-10-26T10:00:00.000Z',
  updated_at: '2023-10-26T10:00:00.000Z',
  is_read: false,
  is_liked: false,
  is_archived: false,
  user_id: 'user1',
  newsletter_source_id: 'source1',
  source_id: 'source1',
  source: {
    id: 'source1',
    name: 'Test Source',
    from: 'test@example.com',
    user_id: 'user1',
    created_at: '',
    updated_at: '',
    is_archived: false,
  },
  tags: [
    { id: 'tag1', name: 'Important', color: '#FF0000', user_id: 'user1', created_at: '' },
  ],
  word_count: 100,
  estimated_read_time: 1,
};

describe('NewsletterRow', () => {
  const mockOnToggleSelect = vi.fn();
  const mockOnToggleLike = vi.fn();
  const mockOnToggleArchive = vi.fn();
  const mockOnToggleRead = vi.fn();
  const mockOnTrash = vi.fn();
  const mockOnToggleQueue = vi.fn();
  const mockOnToggleTagVisibility = vi.fn();
  const mockOnUpdateTags = vi.fn();
  const mockOnTagClick = vi.fn();
  const mockOnRowClick = vi.fn();
  const mockOnMouseEnter = vi.fn();
  const mockOnDismissTagError = vi.fn();

  const defaultProps = {
    newsletter: mockNewsletter,
    onToggleLike: mockOnToggleLike,
    onToggleArchive: mockOnToggleArchive,
    onToggleRead: mockOnToggleRead,
    onTrash: mockOnTrash,
    onToggleQueue: mockOnToggleQueue,
    onToggleTagVisibility: mockOnToggleTagVisibility,
    onUpdateTags: mockOnUpdateTags,
    onTagClick: mockOnTagClick,
    isInReadingQueue: false,
    visibleTags: new Set<string>(),
    readingQueue: [],
    isDeletingNewsletter: false,
    onDismissTagError: mockOnDismissTagError,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders newsletter information correctly', () => {
    render(<NewsletterRow {...defaultProps} />);
    expect(screen.getByText(mockNewsletter.title)).toBeInTheDocument();
    expect(screen.getByText(mockNewsletter.source!.name)).toBeInTheDocument();
    expect(screen.getByText(mockNewsletter.summary)).toBeInTheDocument();
    expect(screen.getByText('Important')).toBeInTheDocument(); // Tag name
    expect(screen.getByText(/min read/)).toBeInTheDocument();
  });

  test('calls onRowClick when the row is clicked (but not on a button/link)', () => {
    render(<NewsletterRow {...defaultProps} onRowClick={mockOnRowClick} />);
    fireEvent.click(screen.getByText(mockNewsletter.title).closest('div[role="listitem"] > div') || screen.getByText(mockNewsletter.title)); // Click on a non-interactive part
    expect(mockOnRowClick).toHaveBeenCalledWith(mockNewsletter, expect.anything());
  });

  test('does not call onRowClick when a button within the row is clicked', () => {
    render(<NewsletterRow {...defaultProps} onRowClick={mockOnRowClick} showActions={true} />);
    // Simulate clicking on the external link button instead of tag visibility toggle
    const externalLinkButton = screen.getByLabelText('Open newsletter in new tab');
    fireEvent.click(externalLinkButton);
    expect(mockOnRowClick).not.toHaveBeenCalled();
  });

  test('calls onMouseEnter when mouse enters the row', () => {
    render(<NewsletterRow {...defaultProps} onMouseEnter={mockOnMouseEnter} />);
    fireEvent.mouseEnter(screen.getByText(mockNewsletter.title).closest('div[role="listitem"] > div') || screen.getByText(mockNewsletter.title));
    expect(mockOnMouseEnter).toHaveBeenCalledWith(mockNewsletter);
  });

  test('shows checkbox and calls onToggleSelect when showCheckbox is true', () => {
    render(<NewsletterRow {...defaultProps} showCheckbox={true} onToggleSelect={mockOnToggleSelect} />);
    const checkboxContainer = screen.getByTitle('Select newsletter');
    expect(checkboxContainer).toBeInTheDocument();
    fireEvent.click(checkboxContainer);
    expect(mockOnToggleSelect).toHaveBeenCalledWith(mockNewsletter.id);
  });

  test('displays unread styles when newsletter is unread', () => {
    render(<NewsletterRow {...defaultProps} newsletter={{ ...mockNewsletter, is_read: false }} />);
    const rowElement = screen.getByTestId(`newsletter-row-main-${mockNewsletter.id}`);
    expect(rowElement).toHaveClass('bg-blue-50/60');
  });

  test('displays read styles when newsletter is read', () => {
    render(<NewsletterRow {...defaultProps} newsletter={{ ...mockNewsletter, is_read: true }} />);
    const rowElement = screen.getByTestId(`newsletter-row-main-${mockNewsletter.id}`);
    expect(rowElement).toHaveClass('bg-white');
  });

  test('displays selected styles when isSelected is true', () => {
    render(<NewsletterRow {...defaultProps} isSelected={true} />);
    const rowElement = screen.getByTestId(`newsletter-row-main-${mockNewsletter.id}`);
    expect(rowElement).toHaveClass('ring-2 ring-primary-400');
  });

  test('calls onTagClick when tag is clicked', () => {
    render(<NewsletterRow {...defaultProps} />);
    const tagElement = screen.getByText('Important');
    fireEvent.click(tagElement);
    expect(mockOnTagClick).toHaveBeenCalledWith(mockNewsletter.tags![0], expect.anything());
  });

  test('passes correct props to NewsletterActions', () => {
    render(<NewsletterRow {...defaultProps} />);
    const actions = screen.getByTestId('newsletter-actions');
    const props = JSON.parse(actions.getAttribute('data-props') || '{}');
    expect(props.newsletter.id).toBe(mockNewsletter.id);
    expect(props.compact).toBe(true);
  });

  test('shows tag update error and dismiss button when visibleTags contains newsletter ID', () => {
    const errorMessage = "Failed to update tags!";
    render(<NewsletterRow {...defaultProps} visibleTags={new Set([mockNewsletter.id])} tagUpdateError={errorMessage} />);
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);
    expect(mockOnDismissTagError).toHaveBeenCalledTimes(1);
  });

  test('shows loading spinner when isUpdatingTags is true and visibleTags contains newsletter ID', () => {
    render(<NewsletterRow {...defaultProps} visibleTags={new Set([mockNewsletter.id])} isUpdatingTags={true} />);
    expect(screen.getByText('Updating tags...')).toBeInTheDocument();
    // Check for loader icon if it has a specific data-testid or class
    expect(screen.getByTitle('Updating tags...').querySelector('.animate-spin')).toBeInTheDocument();
  });

});

// Add role="listitem" to the parent div of NewsletterRow for better accessibility if it's part of a list
// This is a suggestion for the component itself.
// For the test, if the structure is div > div, the .closest selector might need adjustment.
// Let's assume the clickable area is the direct parent of the title for simplicity in test.
// A more robust way is to add data-testid to the main clickable div of NewsletterRow.
// For now, using closest with a more generic selector assuming the structure.
// const findClickableRowArea = (titleElement: HTMLElement) => {
//   let current: HTMLElement | null = titleElement;
//   while (current) {
//     if (current.classList.contains('rounded-lg') && current.classList.contains('p-4')) { // Classes of the main div
//       return current;
//     }
//     current = current.parentElement;
//   }
//   return titleElement; // Fallback
// }

describe('NewsletterRow - Click Propagation Refined', () => {
  const mockOnRowClick = vi.fn();
  const mockOnToggleSelect = vi.fn();
  const mockOnToggleLike = vi.fn(); // Add other necessary mocks from the outer scope
  const mockOnToggleArchive = vi.fn();
  const mockOnToggleRead = vi.fn();
  const mockOnTrash = vi.fn();
  const mockOnToggleQueue = vi.fn();
  const mockOnToggleTagVisibility = vi.fn();
  const mockOnUpdateTags = vi.fn();
  const mockOnTagClick = vi.fn();


  const refinedDefaultProps = { // Renamed to avoid conflict if outer scope was accessible
    newsletter: mockNewsletter,
    onToggleLike: mockOnToggleLike,
    onToggleArchive: mockOnToggleArchive,
    onToggleRead: mockOnToggleRead,
    onTrash: mockOnTrash,
    onToggleQueue: mockOnToggleQueue,
    onToggleTagVisibility: mockOnToggleTagVisibility,
    onUpdateTags: mockOnUpdateTags,
    onTagClick: mockOnTagClick,
    isInReadingQueue: false,
    visibleTags: new Set<string>(),
    readingQueue: [],
    isDeletingNewsletter: false,
    onDismissTagError: vi.fn(),
  };

  const propsWithRowClick = {
    ...refinedDefaultProps,
    onRowClick: mockOnRowClick,
    showCheckbox: true,
    onToggleSelect: mockOnToggleSelect,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('calls onRowClick when clicking the main content area', () => {
    render(<NewsletterRow {...propsWithRowClick} />);
    const mainContentArea = screen.getByTestId(`newsletter-row-main-${mockNewsletter.id}`);
    fireEvent.click(mainContentArea);
    expect(mockOnRowClick).toHaveBeenCalledWith(mockNewsletter, expect.anything());
    expect(mockOnToggleSelect).not.toHaveBeenCalled(); // Ensure select isn't called by this click
  });

  test('does not call onRowClick when clicking the checkbox container', () => {
    render(<NewsletterRow {...propsWithRowClick} />);
    const checkboxContainer = screen.getByTitle('Select newsletter');
    fireEvent.click(checkboxContainer);
    expect(mockOnRowClick).not.toHaveBeenCalled();
    expect(mockOnToggleSelect).toHaveBeenCalledWith(mockNewsletter.id);
  });

  test('does not call onRowClick when clicking the TagSelector area (simulated)', () => {
    render(<NewsletterRow {...propsWithRowClick} visibleTags={new Set([mockNewsletter.id])} showActions={true} />);
    // Since TagSelector was removed, test clicking on the external link instead
    const externalLinkButton = screen.getByLabelText('Open newsletter in new tab');
    fireEvent.click(externalLinkButton);
    expect(mockOnRowClick).not.toHaveBeenCalled();
  });

  test('does not call onRowClick when clicking a tag', () => {
    render(<NewsletterRow {...propsWithRowClick} />);
    const tagElement = screen.getByText('Important'); // Assuming 'Important' is a tag name
    fireEvent.click(tagElement);
    expect(mockOnRowClick).not.toHaveBeenCalled();
    expect(mockOnTagClick).toHaveBeenCalledWith(mockNewsletter.tags![0], expect.anything());
  });
});
