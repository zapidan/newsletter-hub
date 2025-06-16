import { renderHook, act } from '@testing-library/react';
import { useInfiniteScroll } from '../useInfiniteScroll';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
});

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver,
});

Object.defineProperty(global, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver,
});

describe('useInfiniteScroll', () => {
  let mockObserve: jest.Mock;
  let mockUnobserve: jest.Mock;
  let mockDisconnect: jest.Mock;
  let intersectionCallback: (entries: IntersectionObserverEntry[]) => void;

  beforeEach(() => {
    mockObserve = jest.fn();
    mockUnobserve = jest.fn();
    mockDisconnect = jest.fn();

    mockIntersectionObserver.mockImplementation((callback) => {
      intersectionCallback = callback;
      return {
        observe: mockObserve,
        unobserve: mockUnobserve,
        disconnect: mockDisconnect,
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useInfiniteScroll({}));

    expect(result.current.isIntersecting).toBe(false);
    expect(result.current.hasReachedEnd).toBe(false);
    expect(result.current.sentinelRef.current).toBe(null);
  });

  it('should create IntersectionObserver with correct options', () => {
    const threshold = 0.5;
    const rootMargin = '50px';

    renderHook(() =>
      useInfiniteScroll({
        threshold,
        rootMargin,
        enabled: true,
      })
    );

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      {
        threshold,
        rootMargin,
      }
    );
  });

  it('should not create observer when disabled', () => {
    renderHook(() =>
      useInfiniteScroll({
        enabled: false,
      })
    );

    expect(mockIntersectionObserver).not.toHaveBeenCalled();
  });

  it('should call onLoadMore when intersecting and conditions are met', () => {
    const mockOnLoadMore = jest.fn();

    renderHook(() =>
      useInfiniteScroll({
        enabled: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        onLoadMore: mockOnLoadMore,
      })
    );

    // Simulate intersection
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
  });

  it('should not call onLoadMore when not intersecting', () => {
    const mockOnLoadMore = jest.fn();

    renderHook(() =>
      useInfiniteScroll({
        enabled: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        onLoadMore: mockOnLoadMore,
      })
    );

    // Simulate no intersection
    act(() => {
      intersectionCallback([
        {
          isIntersecting: false,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(mockOnLoadMore).not.toHaveBeenCalled();
  });

  it('should not call onLoadMore when no next page', () => {
    const mockOnLoadMore = jest.fn();

    renderHook(() =>
      useInfiniteScroll({
        enabled: true,
        hasNextPage: false,
        isFetchingNextPage: false,
        onLoadMore: mockOnLoadMore,
      })
    );

    // Simulate intersection
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(mockOnLoadMore).not.toHaveBeenCalled();
  });

  it('should not call onLoadMore when already fetching', () => {
    const mockOnLoadMore = jest.fn();

    renderHook(() =>
      useInfiniteScroll({
        enabled: true,
        hasNextPage: true,
        isFetchingNextPage: true,
        onLoadMore: mockOnLoadMore,
      })
    );

    // Simulate intersection
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(mockOnLoadMore).not.toHaveBeenCalled();
  });

  it('should prevent duplicate load calls', () => {
    const mockOnLoadMore = jest.fn();

    renderHook(() =>
      useInfiniteScroll({
        enabled: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        onLoadMore: mockOnLoadMore,
      })
    );

    // Simulate multiple intersections without leaving viewport
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
        } as IntersectionObserverEntry,
      ]);
    });

    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
  });

  it('should reset load trigger when element leaves viewport', () => {
    const mockOnLoadMore = jest.fn();

    renderHook(() =>
      useInfiniteScroll({
        enabled: true,
        hasNextPage: true,
        isFetchingNextPage: false,
        onLoadMore: mockOnLoadMore,
      })
    );

    // First intersection
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
        } as IntersectionObserverEntry,
      ]);
    });

    // Leave viewport
    act(() => {
      intersectionCallback([
        {
          isIntersecting: false,
        } as IntersectionObserverEntry,
      ]);
    });

    // Second intersection after leaving
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(mockOnLoadMore).toHaveBeenCalledTimes(2);
  });

  it('should update hasReachedEnd when no more pages', () => {
    const { result, rerender } = renderHook(
      ({ hasNextPage, isFetchingNextPage }) =>
        useInfiniteScroll({
          enabled: true,
          hasNextPage,
          isFetchingNextPage,
        }),
      {
        initialProps: {
          hasNextPage: true,
          isFetchingNextPage: false,
        },
      }
    );

    expect(result.current.hasReachedEnd).toBe(false);

    // Update to no more pages
    rerender({
      hasNextPage: false,
      isFetchingNextPage: false,
    });

    expect(result.current.hasReachedEnd).toBe(true);
  });

  it('should update isIntersecting state', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll({
        enabled: true,
      })
    );

    expect(result.current.isIntersecting).toBe(false);

    // Simulate intersection
    act(() => {
      intersectionCallback([
        {
          isIntersecting: true,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(result.current.isIntersecting).toBe(true);

    // Simulate leaving intersection
    act(() => {
      intersectionCallback([
        {
          isIntersecting: false,
        } as IntersectionObserverEntry,
      ]);
    });

    expect(result.current.isIntersecting).toBe(false);
  });

  it('should disconnect observer on unmount', () => {
    const { unmount } = renderHook(() =>
      useInfiniteScroll({
        enabled: true,
      })
    );

    unmount();

    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});
