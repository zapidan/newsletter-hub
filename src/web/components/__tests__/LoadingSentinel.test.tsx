import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { LoadingSentinel } from '../InfiniteScroll/LoadingSentinel';

describe('LoadingSentinel', () => {
  it('renders loading spinner when loading is true', () => {
    const { container } = render(
      <LoadingSentinel
        isLoading={true}
        hasReachedEnd={false}
        onRetry={() => { }}
      />
    );

    expect(container).toMatchSnapshot();
    expect(screen.getByText('Loading more newsletters...')).toBeInTheDocument();
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('w-6', 'h-6', 'text-blue-500');
  });

  it('renders loading more indicator with counts when loading with counts', () => {
    const { container } = render(
      <LoadingSentinel
        isLoading={true}
        hasReachedEnd={false}
        onRetry={() => { }}
        loadedCount={10}
        totalCount={100}
      />
    );

    expect(container).toMatchSnapshot();
    expect(screen.getByText('Loading more newsletters...')).toBeInTheDocument();
    expect(screen.getByText('Loaded 10 of 100')).toBeInTheDocument();
  });

  it('renders error state when error is present', () => {
    // Use the same error message as in the snapshot
    const error = new Error('Failed to load');
    const handleRetry = vi.fn();

    const { container } = render(
      <LoadingSentinel
        isLoading={false}
        error={error}
        onRetry={handleRetry}
      />
    );

    expect(container).toMatchSnapshot();
    expect(screen.getByText('Failed to load more newsletters')).toBeInTheDocument();
    expect(screen.getByText('Failed to load')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /try again/i });
    retryButton.click();
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  it('renders end of content with counts when hasReachedEnd is true and counts are provided', () => {
    const { container } = render(
      <LoadingSentinel
        isLoading={false}
        hasReachedEnd={true}
        onRetry={() => { }}
        loadedCount={50}
        totalCount={50}
      />
    );

    expect(container).toMatchSnapshot();
    expect(screen.getByText('All 50 newsletters loaded')).toBeInTheDocument();
    expect(screen.getByText('Showing 50 of 50 newsletters')).toBeInTheDocument();
  });

  it('renders basic end of content when hasReachedEnd is true without counts', () => {
    const { container } = render(
      <LoadingSentinel
        isLoading={false}
        hasReachedEnd={true}
        onRetry={() => { }}
      />
    );

    expect(container).toMatchSnapshot();
    expect(screen.getByText('No more newsletters to load')).toBeInTheDocument();
  });

  it('renders a hidden div when not loading and no error', () => {
    const { container } = render(
      <LoadingSentinel
        isLoading={false}
        hasReachedEnd={false}
        onRetry={() => { }}
      />
    );

    expect(container).toMatchSnapshot();
    const hiddenDiv = container.firstChild as HTMLElement;
    expect(hiddenDiv).toHaveClass('h-4', 'w-full');
    expect(hiddenDiv).toHaveAttribute('aria-hidden', 'true');
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
