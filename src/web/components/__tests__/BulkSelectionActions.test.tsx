import { render, screen, fireEvent } from '@testing-library/react';
import BulkSelectionActions from '../BulkSelectionActions';
import { vi } from 'vitest';

describe('BulkSelectionActions', () => {
  const mockOnSelectAll = vi.fn();
  const mockOnSelectRead = vi.fn();
  const mockOnSelectUnread = vi.fn();
  const mockOnMarkAsRead = vi.fn();
  const mockOnMarkAsUnread = vi.fn();
  const mockOnArchive = vi.fn();
  const mockOnUnarchive = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    selectedCount: 0,
    totalCount: 10,
    showArchived: false,
    isBulkActionLoading: false,
    onSelectAll: mockOnSelectAll,
    onSelectRead: mockOnSelectRead,
    onSelectUnread: mockOnSelectUnread,
    onMarkAsRead: mockOnMarkAsRead,
    onMarkAsUnread: mockOnMarkAsUnread,
    onArchive: mockOnArchive,
    onUnarchive: mockOnUnarchive,
    onDelete: mockOnDelete,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with default props', () => {
    render(<BulkSelectionActions {...defaultProps} />);
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByText('Select All')).toBeInTheDocument();
    expect(screen.getByText('Select Read')).toBeInTheDocument();
    expect(screen.getByText('Select Unread')).toBeInTheDocument();
    expect(screen.getByText('Mark as Read')).toBeInTheDocument();
    expect(screen.getByText('Mark as Unread')).toBeInTheDocument();
    expect(screen.getByText('Archive')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  test('displays correct selected count', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={5} />);
    expect(screen.getByText('5 selected')).toBeInTheDocument();
  });

  test('shows "Deselect All" when all items are selected', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={10} totalCount={10} />);
    expect(screen.getByText('Deselect All')).toBeInTheDocument();
  });

  test('calls onSelectAll when "Select All" button is clicked', () => {
    render(<BulkSelectionActions {...defaultProps} />);
    fireEvent.click(screen.getByText('Select All'));
    expect(mockOnSelectAll).toHaveBeenCalledTimes(1);
  });

  test('calls onSelectRead when "Select Read" button is clicked', () => {
    render(<BulkSelectionActions {...defaultProps} />);
    fireEvent.click(screen.getByText('Select Read'));
    expect(mockOnSelectRead).toHaveBeenCalledTimes(1);
  });

  test('calls onSelectUnread when "Select Unread" button is clicked', () => {
    render(<BulkSelectionActions {...defaultProps} />);
    fireEvent.click(screen.getByText('Select Unread'));
    expect(mockOnSelectUnread).toHaveBeenCalledTimes(1);
  });

  test('calls onMarkAsRead when "Mark as Read" button is clicked', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={1} />);
    fireEvent.click(screen.getByText('Mark as Read'));
    expect(mockOnMarkAsRead).toHaveBeenCalledTimes(1);
  });

  test('calls onMarkAsUnread when "Mark as Unread" button is clicked', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={1} />);
    fireEvent.click(screen.getByText('Mark as Unread'));
    expect(mockOnMarkAsUnread).toHaveBeenCalledTimes(1);
  });

  test('calls onArchive when "Archive" button is clicked (when showArchived is false)', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={1} showArchived={false} />);
    fireEvent.click(screen.getByText('Archive'));
    expect(mockOnArchive).toHaveBeenCalledTimes(1);
  });

  test('shows Unarchive and Trash buttons when showArchived is true', () => {
    render(<BulkSelectionActions {...defaultProps} showArchived={true} />);
    expect(screen.getByText('Unarchive')).toBeInTheDocument();
    expect(screen.getByText('Trash')).toBeInTheDocument();
    expect(screen.queryByText('Archive')).not.toBeInTheDocument();
  });

  test('calls onUnarchive when "Unarchive" button is clicked', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={1} showArchived={true} />);
    fireEvent.click(screen.getByText('Unarchive'));
    expect(mockOnUnarchive).toHaveBeenCalledTimes(1);
  });

  test('calls onDelete when "Trash" button is clicked', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={1} showArchived={true} />);
    fireEvent.click(screen.getByText('Trash'));
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  test('calls onCancel when "Cancel" button is clicked', () => {
    render(<BulkSelectionActions {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  test('action buttons are disabled when selectedCount is 0', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={0} />);
    expect(screen.getByRole('button', { name: /Mark as Read/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Mark as Unread/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Archive/i })).toBeDisabled();
  });

  test('action buttons are enabled when selectedCount > 0', () => {
    render(<BulkSelectionActions {...defaultProps} selectedCount={1} />);
    expect(screen.getByRole('button', { name: /Mark as Read/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Mark as Unread/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Archive/i })).not.toBeDisabled();
  });

  test('archive/unarchive/delete buttons are disabled when isBulkActionLoading is true', () => {
    // Test case for when showArchived is false
    const { rerender } = render(
      <BulkSelectionActions {...defaultProps} selectedCount={1} isBulkActionLoading={true} showArchived={false} />
    );
    expect(screen.getByRole('button', { name: /Archive/i })).toBeDisabled();

    // Test case for when showArchived is true
    rerender(
      <BulkSelectionActions {...defaultProps} selectedCount={1} isBulkActionLoading={true} showArchived={true} />
    );
    expect(screen.getByRole('button', { name: /Unarchive/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Trash/i })).toBeDisabled();
  });
});
