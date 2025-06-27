import { NewsletterSource, Tag } from '@common/types';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SortableNewsletterRow } from '../SortableNewsletterRow';

// Mock NewsletterRow as it's a complex child component
vi.mock('../../NewsletterRow', () => ({
  default: vi.fn((props) => (
    <div data-testid="newsletter-row" data-props={JSON.stringify(props)}>
      {props.newsletter.title}
    </div>
  )),
}));

// Import the mocked component to access its .mock property
import NewsletterRow from '../../NewsletterRow';

// Create a Newsletter type that matches what SortableNewsletterRow expects
type Newsletter = {
  id: string;
  title: string;
  summary: string;
  content: string;
  image_url: string;
  received_at: string;
  updated_at: string;
  is_read: boolean;
  is_liked: boolean;
  is_archived: boolean;
  user_id: string;
  newsletter_source_id?: string | null;
  source_id?: string | null;
  source?: NewsletterSource | null;
  tags?: Tag[];
  word_count: number;
  estimated_read_time: number;
  [key: string]: unknown; // Index signature for additional properties
};

const mockNewsletter: Newsletter = {
  id: 'newsletter1',
  title: 'Sortable Newsletter',
  summary: 'Summary here',
  content: '<p>Content</p>',
  image_url: 'http://example.com/image.png',
  received_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  is_read: false,
  is_liked: false,
  is_archived: false,
  user_id: 'user1',
  newsletter_source_id: 'source1',
  source_id: 'source1',
  source: {
    id: 'source1',
    name: 'Source Name',
    from: 'source@example.com',
    user_id: 'user1',
    created_at: '',
    updated_at: '',
    is_archived: false
  },
  tags: [{
    id: 'tag1',
    name: 'SortableTag',
    color: '#00FF00',
    user_id: 'user1',
    created_at: ''
  }],
  word_count: 120,
  estimated_read_time: 2,
};

// A simplified DndContext setup for testing sortable items
const TestDndContext: React.FC<{ children: React.ReactNode; items: string[] }> = ({ children, items }) => (
  <DndContext onDragEnd={() => { }}>
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  </DndContext>
);

describe('SortableNewsletterRow', () => {
  const mockOnToggleLike = vi.fn();
  const mockOnToggleQueue = vi.fn();
  const mockOnNewsletterClick = vi.fn();
  const mockOnToggleArchive = vi.fn();
  const mockOnToggleRead = vi.fn();
  const mockOnTrash = vi.fn();
  const mockOnUpdateTags = vi.fn();
  const mockOnTagClick = vi.fn();
  const mockOnToggleTagVisibility = vi.fn();
  const mockOnRemoveFromQueue = vi.fn();

  const defaultProps = {
    id: mockNewsletter.id,
    newsletter: mockNewsletter,
    onToggleLike: mockOnToggleLike,
    onToggleQueue: mockOnToggleQueue,
    onNewsletterClick: mockOnNewsletterClick,
    onToggleArchive: mockOnToggleArchive,
    onToggleRead: mockOnToggleRead,
    onTrash: mockOnTrash,
    onUpdateTags: mockOnUpdateTags,
    onTagClick: mockOnTagClick,
    onToggleTagVisibility: mockOnToggleTagVisibility,
    onRemoveFromQueue: mockOnRemoveFromQueue,
    isInReadingQueue: false,
    visibleTags: new Set<string>(),
    readingQueue: [],
    isDeletingNewsletter: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders the NewsletterRow with given newsletter data', () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} />
      </TestDndContext>
    );

    expect(screen.getByTestId('newsletter-row')).toBeInTheDocument();
    expect(screen.getByText(mockNewsletter.title)).toBeInTheDocument();
  });

  test('shows drag handle when isDraggable is true (default)', () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} />
      </TestDndContext>
    );

    expect(screen.getByLabelText('Drag to reorder')).toBeInTheDocument();
  });

  test('hides drag handle when isDraggable is false', () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} isDraggable={false} />
      </TestDndContext>
    );

    expect(screen.queryByLabelText('Drag to reorder')).not.toBeInTheDocument();
  });

  test('applies correct CSS classes and data-testid', () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} />
      </TestDndContext>
    );

    const sortableRowElement = screen.getByTestId(`sortable-row-${mockNewsletter.id}`);
    expect(sortableRowElement).toHaveClass('relative group w-full');
  });

  test('calls onToggleLike with newsletter id when like is toggled via NewsletterRow', async () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} />
      </TestDndContext>
    );

    // Get the props passed to NewsletterRow
    const newsletterRowProps = (NewsletterRow as any).mock.calls[0][0];

    // Simulate the call from NewsletterRow
    await newsletterRowProps.onToggleLike(newsletterRowProps.newsletter);

    expect(mockOnToggleLike).toHaveBeenCalledWith(mockNewsletter.id);
  });

  test('calls onToggleQueue with newsletter id when queue is toggled via NewsletterRow', async () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} />
      </TestDndContext>
    );

    // Get the props passed to NewsletterRow
    const newsletterRowProps = (NewsletterRow as any).mock.calls[0][0];

    // Simulate the call from NewsletterRow
    await newsletterRowProps.onToggleQueue(mockNewsletter.id);

    expect(mockOnToggleQueue).toHaveBeenCalledWith(mockNewsletter.id);
  });

  test('calls onNewsletterClick with newsletter data when NewsletterRow is clicked', () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} />
      </TestDndContext>
    );

    // Get the props passed to NewsletterRow
    const newsletterRowProps = (NewsletterRow as any).mock.calls[0][0];

    // Simulate the click from NewsletterRow
    newsletterRowProps.onNewsletterClick(newsletterRowProps.newsletter);

    // The callback should receive the newsletter data
    expect(mockOnNewsletterClick).toHaveBeenCalledWith(expect.objectContaining({
      id: mockNewsletter.id,
      title: mockNewsletter.title,
      source: mockNewsletter.source,
      tags: mockNewsletter.tags,
    }));
  });

  test('drag handle click does not propagate to row click', () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} />
      </TestDndContext>
    );

    const dragHandle = screen.getByLabelText('Drag to reorder');
    fireEvent.click(dragHandle);

    // The drag handle should have stopPropagation, so onNewsletterClick should not be called
    expect(mockOnNewsletterClick).not.toHaveBeenCalled();
  });

  test('passes correct props to NewsletterRow', () => {
    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} />
      </TestDndContext>
    );

    const newsletterRowProps = (NewsletterRow as any).mock.calls[0][0];

    // Check that the newsletter is converted to NewsletterWithRelations
    expect(newsletterRowProps.newsletter).toEqual(expect.objectContaining({
      id: mockNewsletter.id,
      title: mockNewsletter.title,
      source: mockNewsletter.source,
      tags: mockNewsletter.tags,
    }));

    // Check that other props are passed correctly
    expect(newsletterRowProps.isSelected).toBe(false);
    expect(newsletterRowProps.isInReadingQueue).toBe(false);
    expect(newsletterRowProps.showCheckbox).toBe(false);
    expect(newsletterRowProps.showTags).toBe(true);
  });

  test('handles missing optional props gracefully', () => {
    const minimalProps = {
      id: mockNewsletter.id,
      newsletter: mockNewsletter,
    };

    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...minimalProps} />
      </TestDndContext>
    );

    expect(screen.getByTestId('newsletter-row')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    const customClassName = 'custom-class';

    render(
      <TestDndContext items={[mockNewsletter.id]}>
        <SortableNewsletterRow {...defaultProps} className={customClassName} />
      </TestDndContext>
    );

    const sortableRowElement = screen.getByTestId(`sortable-row-${mockNewsletter.id}`);
    expect(sortableRowElement).toHaveClass(customClassName);
  });
});
