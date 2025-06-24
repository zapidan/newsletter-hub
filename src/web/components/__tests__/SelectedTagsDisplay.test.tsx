import { render, screen, fireEvent } from '@testing-library/react';
import SelectedTagsDisplay from '../SelectedTagsDisplay';
import { vi } from 'vitest';

const mockSelectedTags = [
  { id: 'tag1', name: 'Tech', color: '#3b82f6' },
  { id: 'tag2', name: 'Productivity', color: '#10b981' },
];

describe('SelectedTagsDisplay', () => {
  const mockOnRemoveTag = vi.fn();
  const mockOnClearAll = vi.fn();

  const defaultProps = {
    selectedTags: [],
    onRemoveTag: mockOnRemoveTag,
    onClearAll: mockOnClearAll,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders null when no tags are selected', () => {
    const { container } = render(<SelectedTagsDisplay {...defaultProps} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders correctly when tags are selected', () => {
    render(<SelectedTagsDisplay {...defaultProps} selectedTags={mockSelectedTags} />);
    expect(screen.getByText('Active Tag Filters (2)')).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('Productivity')).toBeInTheDocument();
    expect(screen.getByText('Clear all filters')).toBeInTheDocument();
  });

  test('displays correct count of selected tags', () => {
    render(<SelectedTagsDisplay {...defaultProps} selectedTags={mockSelectedTags} />);
    expect(screen.getByText('Active Tag Filters (2)')).toBeInTheDocument();
  });

  test('displays singular "this tag" message when one tag is selected', () => {
    render(<SelectedTagsDisplay {...defaultProps} selectedTags={[mockSelectedTags[0]]} />);
    expect(screen.getByText(/Showing newsletters matching this tag/)).toBeInTheDocument();
  });

  test('displays plural "any of these tags" message when multiple tags are selected', () => {
    render(<SelectedTagsDisplay {...defaultProps} selectedTags={mockSelectedTags} />);
    expect(screen.getByText(/Showing newsletters matching any of these tags/)).toBeInTheDocument();
  });

  test('calls onRemoveTag with correct tagId when a tag remove button is clicked', () => {
    render(<SelectedTagsDisplay {...defaultProps} selectedTags={mockSelectedTags} />);
    const techTagRemoveButton = screen.getByText('Tech').closest('span')?.querySelector('button');
    if (!techTagRemoveButton) throw new Error('Remove button for Tech tag not found');

    fireEvent.click(techTagRemoveButton);
    expect(mockOnRemoveTag).toHaveBeenCalledWith('tag1');
  });

  test('calls onClearAll when "Clear all filters" button is clicked', () => {
    render(<SelectedTagsDisplay {...defaultProps} selectedTags={mockSelectedTags} />);
    fireEvent.click(screen.getByText('Clear all filters'));
    expect(mockOnClearAll).toHaveBeenCalledTimes(1);
  });

  test('applies correct styles to tags based on their color', () => {
    render(<SelectedTagsDisplay {...defaultProps} selectedTags={mockSelectedTags} />);
    const techTagElement = screen.getByText('Tech');
    expect(techTagElement).toHaveStyle('color: #3b82f6');
    // Check if the backgroundColor starts with the RGB equivalent of #3b82f6
    expect(techTagElement.style.backgroundColor.startsWith('rgb(59, 130, 246)') || techTagElement.style.backgroundColor.startsWith('rgba(59, 130, 246')).toBe(true);


    const productivityTagElement = screen.getByText('Productivity');
    expect(productivityTagElement).toHaveStyle('color: #10b981');
    expect(productivityTagElement.style.backgroundColor.startsWith('rgb(16, 185, 129)') || productivityTagElement.style.backgroundColor.startsWith('rgba(16, 185, 129')).toBe(true);
  });
});
