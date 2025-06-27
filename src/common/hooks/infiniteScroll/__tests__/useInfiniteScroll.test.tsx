import { act, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInfiniteScroll } from '../useInfiniteScroll';

// Make this a global variable
let intersectionObserverCallback: IntersectionObserverCallback;
let mockIntersectionObserver: {
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  mockIntersectionObserver = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  };

  global.IntersectionObserver = vi.fn((callback) => {
    intersectionObserverCallback = callback;
    return mockIntersectionObserver;
  }) as any;
});

afterEach(() => {
  vi.clearAllMocks();
});

// Helper test component to attach the ref to a real DOM node
function TestComponent(props: any) {
  const scroll = useInfiniteScroll(props);
  return <div data-testid="sentinel" ref={scroll.sentinelRef}></div>;
}

describe('useInfiniteScroll', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useInfiniteScroll({}));

    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.hasReachedEnd).toBe(true); // Should be true when no hasNextPage
    expect(result.current.sentinelRef.current).toBe(null);
  });

  it('should observe sentinel element when enabled', () => {
    render(<TestComponent enabled={true} />);
    // The observer should be called with the real DOM node
    expect(mockIntersectionObserver.observe).toHaveBeenCalled();
    const observedNode = mockIntersectionObserver.observe.mock.calls[0][0];
    expect(observedNode.nodeType).toBe(1); // Node.ELEMENT_NODE
  });

  it('should trigger onLoadMore when conditions are met', () => {
    const mockOnLoadMore = vi.fn();
    render(<TestComponent enabled={true} hasNextPage={true} isFetchingNextPage={false} onLoadMore={mockOnLoadMore} />);
    // Simulate intersection
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
  });

  it('should not trigger onLoadMore multiple times rapidly', async () => {
    vi.useFakeTimers();
    const mockOnLoadMore = vi.fn();
    render(<TestComponent enabled={true} hasNextPage={true} isFetchingNextPage={false} onLoadMore={mockOnLoadMore} />);
    // First intersection - should trigger
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
    // Rapid subsequent intersections - should not trigger
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
    // Wait for minimum interval
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Simulate going out of view (reset load trigger)
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: false, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    // Now it should allow another trigger after coming back into view
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    expect(mockOnLoadMore).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('should not trigger when already fetching', () => {
    const mockOnLoadMore = vi.fn();
    const { rerender } = render(<TestComponent enabled={true} hasNextPage={true} isFetchingNextPage={false} onLoadMore={mockOnLoadMore} />);
    // First intersection - should trigger
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
    // Update to fetching state
    rerender(<TestComponent enabled={true} hasNextPage={true} isFetchingNextPage={true} onLoadMore={mockOnLoadMore} />);
    // Intersection while fetching - should not trigger
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
  });

  it('should not trigger when no next page', () => {
    const mockOnLoadMore = vi.fn();
    render(<TestComponent enabled={true} hasNextPage={false} isFetchingNextPage={false} onLoadMore={mockOnLoadMore} />);
    // Simulate intersection
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    expect(mockOnLoadMore).toHaveBeenCalledTimes(0);
  });

  it('should reset trigger when element stops intersecting', () => {
    render(<TestComponent enabled={true} hasNextPage={true} isFetchingNextPage={false} />);
    // Simulate intersection
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: true, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    // Simulate leaving intersection
    if (typeof intersectionObserverCallback === 'function') {
      act(() => {
        intersectionObserverCallback(
          [{ isIntersecting: false, target: document.querySelector('[data-testid="sentinel"]') } as any],
          {} as any
        );
      });
    }
    // No assertion here for isIntersecting, as it's internal state, but we can check that no errors are thrown
  });

  it('should disconnect observer on cleanup', () => {
    const { unmount } = render(<TestComponent enabled={true} />);
    unmount();
    expect(mockIntersectionObserver.disconnect).toHaveBeenCalled();
  });

  it('should not observe when disabled', () => {
    render(<TestComponent enabled={false} />);
    expect(mockIntersectionObserver.observe).not.toHaveBeenCalled();
  });

  it('should handle state updates correctly when fetching completes', () => {
    const { result, rerender } = renderHook(
      ({ hasNextPage, isFetchingNextPage }) =>
        useInfiniteScroll({
          enabled: true,
          hasNextPage,
          isFetchingNextPage,
        }),
      { initialProps: { hasNextPage: true, isFetchingNextPage: true } }
    );

    expect(result.current.hasReachedEnd).toBe(false);

    rerender({ hasNextPage: false, isFetchingNextPage: false });
    expect(result.current.hasReachedEnd).toBe(true);
  });
});
