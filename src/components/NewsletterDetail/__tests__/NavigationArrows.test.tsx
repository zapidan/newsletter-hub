import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NavigationArrows } from '../NavigationArrows';

describe('NavigationArrows', () => {
  const mockOnPrevious = vi.fn();
  const mockOnNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render both navigation arrows', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={true}
      />
    );

    expect(screen.getByLabelText('Navigate to previous newsletter')).toBeInTheDocument();
    expect(screen.getByLabelText('Navigate to next newsletter')).toBeInTheDocument();
  });

  it('should call onPrevious when previous arrow is clicked', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={true}
      />
    );

    const previousButton = screen.getByLabelText('Navigate to previous newsletter');
    fireEvent.click(previousButton);

    expect(mockOnPrevious).toHaveBeenCalledTimes(1);
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it('should call onNext when next arrow is clicked', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={true}
      />
    );

    const nextButton = screen.getByLabelText('Navigate to next newsletter');
    fireEvent.click(nextButton);

    expect(mockOnNext).toHaveBeenCalledTimes(1);
    expect(mockOnPrevious).not.toHaveBeenCalled();
  });

  it('should disable previous button when hasPrevious is false', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={false}
        hasNext={true}
      />
    );

    const previousButton = screen.getByLabelText('Navigate to previous newsletter');
    expect(previousButton).toBeDisabled();
    expect(previousButton).toHaveClass('text-gray-300', 'cursor-not-allowed');

    fireEvent.click(previousButton);
    expect(mockOnPrevious).not.toHaveBeenCalled();
  });

  it('should disable next button when hasNext is false', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={false}
      />
    );

    const nextButton = screen.getByLabelText('Navigate to next newsletter');
    expect(nextButton).toBeDisabled();
    expect(nextButton).toHaveClass('text-gray-300', 'cursor-not-allowed');

    fireEvent.click(nextButton);
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it('should disable both buttons when isLoading is true', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={true}
        isLoading={true}
      />
    );

    const previousButton = screen.getByLabelText('Navigate to previous newsletter');
    const nextButton = screen.getByLabelText('Navigate to next newsletter');

    expect(previousButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={true}
        className="custom-class"
      />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should have correct title attributes', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={true}
      />
    );

    const previousButton = screen.getByLabelText('Navigate to previous newsletter');
    const nextButton = screen.getByLabelText('Navigate to next newsletter');

    expect(previousButton).toHaveAttribute('title', 'Previous newsletter');
    expect(nextButton).toHaveAttribute('title', 'Next newsletter');
  });

  it('should have correct title attributes when navigation is disabled', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={false}
        hasNext={false}
      />
    );

    const previousButton = screen.getByLabelText('Navigate to previous newsletter');
    const nextButton = screen.getByLabelText('Navigate to next newsletter');

    expect(previousButton).toHaveAttribute('title', 'No previous newsletter');
    expect(nextButton).toHaveAttribute('title', 'No next newsletter');
  });

  it('should render chevron icons', () => {
    const { container } = render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={true}
      />
    );

    // Check for SVG elements (Lucide icons render as SVGs)
    const svgElements = container.querySelectorAll('svg');
    expect(svgElements).toHaveLength(2);

    // Check for specific icon classes
    svgElements.forEach(svg => {
      expect(svg).toHaveClass('h-5', 'w-5');
    });
  });

  it('should handle enabled styles correctly', () => {
    render(
      <NavigationArrows
        onPrevious={mockOnPrevious}
        onNext={mockOnNext}
        hasPrevious={true}
        hasNext={true}
      />
    );

    const previousButton = screen.getByLabelText('Navigate to previous newsletter');
    const nextButton = screen.getByLabelText('Navigate to next newsletter');

    expect(previousButton).toHaveClass('text-gray-600', 'hover:text-gray-900');
    expect(nextButton).toHaveClass('text-gray-600', 'hover:text-gray-900');
  });
});
