import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { TimeRange } from '../TimeFilter';
import { TimeFilter } from '../TimeFilter';

describe('TimeFilter', () => {
  const mockOnChange = vi.fn();

  const defaultProps = {
    selectedRange: 'all' as TimeRange,
    onChange: mockOnChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders correctly with default selected range "All time"', () => {
    render(<TimeFilter {...defaultProps} />);
    expect(screen.getByText('All time')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /All time/i })).toBeInTheDocument();
  });

  test('displays the correct label for the selected range', () => {
    render(<TimeFilter {...defaultProps} selectedRange="week" />);
    expect(screen.getByText('This week')).toBeInTheDocument();
  });

  test('opens dropdown on button click', () => {
    render(<TimeFilter {...defaultProps} />);
    const button = screen.getByRole('button', { name: /All time/i });
    fireEvent.click(button);
    expect(screen.getByText('Today')).toBeVisible(); // One of the dropdown options
    expect(screen.getByText('Last 2 days')).toBeVisible();
    // No rolling 7-day preset anymore
    expect(screen.getByText('This week')).toBeVisible();
    // No rolling 30-day preset anymore
    expect(screen.getByText('This month')).toBeVisible();
  });

  test('closes dropdown when an option is selected', async () => {
    render(<TimeFilter {...defaultProps} />);
    const button = screen.getByRole('button', { name: /All time/i });
    fireEvent.click(button);

    const todayOption = screen.getByText('Today');
    expect(todayOption).toBeVisible();

    fireEvent.click(todayOption);

    await waitFor(() => {
      // When closed, the options should not be in the document
      expect(screen.queryByText('Last 2 days')).not.toBeInTheDocument();
    });
  });

  test('closes dropdown when clicking outside', async () => {
    render(
      <div>
        <TimeFilter {...defaultProps} />
        <button>Outside</button>
      </div>
    );
    const button = screen.getByRole('button', { name: /All time/i });
    fireEvent.click(button);
    expect(screen.getByText('Today')).toBeVisible(); // Dropdown is open

    fireEvent.mouseDown(screen.getByText('Outside')); // Click outside

    await waitFor(() => {
      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });
  });


  test('calls onChange with the correct value when an option is selected', () => {
    render(<TimeFilter {...defaultProps} />);
    const button = screen.getByRole('button', { name: /All time/i });
    fireEvent.click(button);

    const weekOption = screen.getByText('This week');
    fireEvent.click(weekOption);

    expect(mockOnChange).toHaveBeenCalledWith('week');
  });

  test('supports selecting presets (week, month)', () => {
    render(<TimeFilter {...defaultProps} />);
    const button = screen.getByRole('button', { name: /All time/i });
    fireEvent.click(button);

    fireEvent.click(screen.getByText('This week'));
    expect(mockOnChange).toHaveBeenCalledWith('week');

    fireEvent.click(button);
    fireEvent.click(screen.getByText('This month'));
    expect(mockOnChange).toHaveBeenCalledWith('month');
  });

  test('highlights selected option in dropdown', () => {
    render(<TimeFilter {...defaultProps} selectedRange="month" />);
    const mainButton = screen.getByRole('button', { name: /This month/i });
    fireEvent.click(mainButton);

    // Get all buttons with "This month" text and select the dropdown one (should have bg-primary-50 class)
    const monthButtons = screen.getAllByRole('button', { name: 'This month' });
    const monthOptionButton = monthButtons.find(button =>
      button.classList.contains('bg-primary-50')
    );

    expect(monthOptionButton).toHaveClass('bg-primary-50');

    const allTimeButtons = screen.getAllByRole('button', { name: 'All time' });
    const allTimeOptionButton = allTimeButtons.find(button =>
      !button.classList.contains('bg-primary-50')
    );
    expect(allTimeOptionButton).not.toHaveClass('bg-primary-50');
  });
});
