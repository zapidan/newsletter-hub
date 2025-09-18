import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    expect(screen.getByText('Last 7 days')).toBeVisible();
    expect(screen.getByText('This week')).toBeVisible();
    expect(screen.getByText('Last 30 days')).toBeVisible();
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

  test('supports selecting new explicit presets', () => {
    render(<TimeFilter {...defaultProps} />);
    const button = screen.getByRole('button', { name: /All time/i });
    fireEvent.click(button);

    fireEvent.click(screen.getByText('Last 7 days'));
    expect(mockOnChange).toHaveBeenCalledWith('last7');

    // Re-open and select Last 30 days (component is controlled, label stays 'All time')
    fireEvent.click(button);
    fireEvent.click(screen.getByText('Last 30 days'));
    expect(mockOnChange).toHaveBeenCalledWith('last30');
  });

  test('highlights the selected option in the dropdown', () => {
    render(<TimeFilter {...defaultProps} selectedRange="month" />);
    const mainButton = screen.getByRole('button', { name: /This month/i }); // Button label updates
    fireEvent.click(mainButton);

    // The dropdown itself has a specific structure. We need to find the button *within* the dropdown.
    // The options are buttons within a div that appears.
    const dropdownContainer = mainButton.nextElementSibling; // Assuming dropdown is sibling
    expect(dropdownContainer).toBeInTheDocument();

    if (!dropdownContainer) throw new Error("Dropdown container not found");

    const monthOptionButton = within(dropdownContainer).getByRole('button', { name: 'This month' });
    expect(monthOptionButton).toHaveClass('bg-primary-50');

    const allTimeOptionButton = within(dropdownContainer).getByRole('button', { name: 'All time' });
    expect(allTimeOptionButton).not.toHaveClass('bg-primary-50');
  });
});
