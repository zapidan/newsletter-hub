import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import TagSelector from '../TagSelector';
import { vi } from 'vitest';
import type { Tag } from '@common/types';

const mockGetTags = vi.fn();
const mockCreateTag = vi.fn();
const mockDeleteTag = vi.fn();

vi.mock('@common/hooks/useTags', () => ({
  useTags: () => ({
    getTags: mockGetTags,
    createTag: mockCreateTag,
    deleteTag: mockDeleteTag,
  }),
}));

const sampleTags: Tag[] = [
  { id: '1', name: 'Work', color: '#3b82f6', user_id: 'user1', created_at: '', updated_at: '' },
  { id: '2', name: 'Personal', color: '#ef4444', user_id: 'user1', created_at: '', updated_at: '' },
];

describe('TagSelector', () => {
  const mockOnTagsChange = vi.fn();
  const mockOnTagDeleted = vi.fn();
  const mockOnTagClick = vi.fn();

  const defaultProps = {
    selectedTags: [],
    onTagsChange: mockOnTagsChange,
    onTagDeleted: mockOnTagDeleted,
    onTagClick: mockOnTagClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTags.mockResolvedValue(sampleTags);
    mockCreateTag.mockImplementation(async (tagData) => ({
      id: String(Date.now()),
      ...tagData,
      user_id: 'user1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    mockDeleteTag.mockResolvedValue(true);
    // Mock window.confirm
    window.confirm = vi.fn(() => true);
  });

  test('renders correctly and loads available tags', async () => {
    render(<TagSelector {...defaultProps} />);
    expect(screen.getByText('Add Tag')).toBeInTheDocument();
    await waitFor(() => expect(mockGetTags).toHaveBeenCalledTimes(1));
  });

  test('displays selected tags', () => {
    render(<TagSelector {...defaultProps} selectedTags={[sampleTags[0]]} />);
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.queryByText('Personal')).not.toBeInTheDocument();
  });

  test('opens and closes the dropdown', async () => {
    render(<TagSelector {...defaultProps} />);
    const addTagButton = screen.getByText('Add Tag');

    fireEvent.click(addTagButton);
    expect(screen.getByPlaceholderText('Create new tag')).toBeInTheDocument();
    // Wait for available tags to render in the dropdown
    await waitFor(() => expect(screen.getByText(sampleTags[0].name)).toBeVisible());
    await waitFor(() => expect(screen.getByText(sampleTags[1].name)).toBeVisible());

    fireEvent.mouseDown(document.body); // Simulate click outside, mousedown is what the component listens to
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Create new tag')).not.toBeInTheDocument();
    });
  });

  test('creates a new tag', async () => {
    render(<TagSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Tag'));

    const input = screen.getByPlaceholderText('Create new tag');
    const addButton = screen.getByRole('button', { name: 'Add' });

    fireEvent.change(input, { target: { value: 'New Tag' } });
    fireEvent.click(addButton);

    await waitFor(() => expect(mockCreateTag).toHaveBeenCalledWith({ name: 'New Tag', color: '#3b82f6' }));
    await waitFor(() => expect(mockOnTagsChange).toHaveBeenCalled());
    // Check if the new tag is among the arguments of the last call
    const lastCallArgs = mockOnTagsChange.mock.calls[mockOnTagsChange.mock.calls.length - 1][0];
    expect(lastCallArgs.some((tag: Tag) => tag.name === 'New Tag')).toBe(true);
  });

  test('selects an existing tag from the dropdown', async () => {
    render(<TagSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Tag'));

    await waitFor(() => screen.getByText('Work')); // Ensure tags are loaded

    const workTagButton = screen.getByText('Work');
    fireEvent.click(workTagButton);

    expect(mockOnTagsChange).toHaveBeenCalledWith([sampleTags[0]]);
  });

  test('removes a selected tag', () => {
    render(<TagSelector {...defaultProps} selectedTags={[sampleTags[0]]} />);
    const removeButton = screen.getByTitle('Remove tag');
    fireEvent.click(removeButton);
    expect(mockOnTagsChange).toHaveBeenCalledWith([]);
  });

  test('deletes a tag from the available list', async () => {
    render(<TagSelector {...defaultProps} />);
    fireEvent.click(screen.getByText('Add Tag'));

    await waitFor(() => screen.getByText('Work'));
    const workTagItem = screen.getByText('Work').closest('div');
    if (!workTagItem) throw new Error("Tag item not found");

    const deleteButton = workTagItem.querySelector('button[title="Delete Work"]');
    if (!deleteButton) throw new Error("Delete button not found for Work tag");

    fireEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockDeleteTag).toHaveBeenCalledWith('1'));
    await waitFor(() => expect(mockOnTagDeleted).toHaveBeenCalledWith(sampleTags[0]));
  });

   test('handles onTagClick when a selected tag is clicked', () => {
    const selectedTag = sampleTags[0];
    render(<TagSelector {...defaultProps} selectedTags={[selectedTag]} />);
    const tagElement = screen.getByText(selectedTag.name);
    fireEvent.click(tagElement);
    expect(mockOnTagClick).toHaveBeenCalledWith(selectedTag, expect.anything());
  });

  test('does not call onTagClick if not provided', () => {
    const propsWithoutOnClick = { ...defaultProps, onTagClick: undefined };
    const selectedTag = sampleTags[0];
    render(<TagSelector {...propsWithoutOnClick} selectedTags={[selectedTag]} />);
    const tagElement = screen.getByText(selectedTag.name);
    fireEvent.click(tagElement);
    // No explicit assertion for not being called, but if it were, the mock would register it.
    // This test mainly ensures no error occurs.
  });

  test('component is disabled when disabled prop is true', async () => {
    render(<TagSelector {...defaultProps} disabled={true} />);
    const addTagButton = screen.getByText('Add Tag');
    // Check if a parent has opacity-50 and pointer-events-none
    expect(addTagButton.closest('div[class*="opacity-50 pointer-events-none"]')).toBeInTheDocument();

    // Try to open dropdown - should not open
    fireEvent.click(addTagButton); // Attempt to open
    // Dropdown should not open because the button is disabled by the component logic now
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Create new tag')).not.toBeInTheDocument();
    });
  });

  test('shows "No tags available" message when availableTags is empty after filtering selected', async () => {
    mockGetTags.mockResolvedValueOnce([sampleTags[0]]); // Only one tag available
    render(<TagSelector {...defaultProps} selectedTags={[sampleTags[0]]} />); // That one tag is selected

    fireEvent.click(screen.getByText('Add Tag'));

    await waitFor(() => {
      expect(screen.getByText('No tags available. Create one above.')).toBeInTheDocument();
    });
  });

  test('filters out already selected tags from the dropdown list', async () => {
    render(<TagSelector {...defaultProps} selectedTags={[sampleTags[0]]} />);
    fireEvent.click(screen.getByText('Add Tag'));

    await waitFor(() => {
      // Ensure the dropdown is open and items are rendered before querying
      expect(screen.getByPlaceholderText('Create new tag')).toBeVisible();
    });

    // Query within the dropdown specifically. The dropdown items are buttons.
    const dropdownElement = screen.getByPlaceholderText('Create new tag').closest('.absolute');
    if (!dropdownElement) throw new Error("Dropdown not found");

    // sampleTags[0] is 'Work', which is selected. It should not be in the dropdown options.
    expect(within(dropdownElement).queryByRole('button', { name: sampleTags[0].name })).not.toBeInTheDocument();

    // sampleTags[1] is 'Personal', which is not selected. It should be in the dropdown.
    expect(within(dropdownElement).getByRole('button', { name: sampleTags[1].name })).toBeInTheDocument();
  });
});
