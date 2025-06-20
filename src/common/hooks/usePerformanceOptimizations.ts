import { useLogger } from '@common/utils/logger/useLogger';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Custom debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = { trailing: true }
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime: number | null = null;

  const debounced = (...args: Parameters<T>) => {
    const now = Date.now();
    const shouldCallLeading =
      options.leading && (lastCallTime === null || now - lastCallTime >= delay);

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (shouldCallLeading) {
      lastCallTime = now;
      return func(...args);
    }

    timeoutId = setTimeout(() => {
      if (options.trailing) {
        lastCallTime = now;
        func(...args);
      }
      timeoutId = null;
    }, delay);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced as T & { cancel: () => void };
}

// Custom throttle implementation
function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
  options: { leading?: boolean; trailing?: boolean } = { leading: true }
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastCallTime: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;

    if (lastCallTime === null) {
      if (options.leading) {
        lastCallTime = now;
        return func(...args);
      }
      lastCallTime = now;
    }

    const timeSinceLastCall = now - lastCallTime;
    const remaining = delay - timeSinceLastCall;

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastCallTime = now;
      return func(...args);
    }

    if (!timeoutId && options.trailing) {
      timeoutId = setTimeout(() => {
        lastCallTime = Date.now();
        timeoutId = null;
        if (lastArgs) {
          func(...lastArgs);
        }
      }, remaining);
    }
  };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastCallTime = null;
    lastArgs = null;
  };

  return throttled as T & { cancel: () => void };
}

// Performance monitoring utilities
interface PerformanceMetrics {
  renderTime: number;
  lastRender: number;
  renderCount: number;
  averageRenderTime: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const log = useLogger();
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    lastRender: 0,
    renderCount: 0,
    averageRenderTime: 0,
  });

  const startRender = useCallback(() => {
    metricsRef.current.lastRender = performance.now();
  }, []);

  const endRender = useCallback(() => {
    const now = performance.now();
    const renderTime = now - metricsRef.current.lastRender;

    metricsRef.current.renderTime = renderTime;
    metricsRef.current.renderCount += 1;
    metricsRef.current.averageRenderTime =
      (metricsRef.current.averageRenderTime * (metricsRef.current.renderCount - 1) + renderTime) /
      metricsRef.current.renderCount;

    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      log.warn('Component render performance warning', {
        action: 'performance_monitor',
        metadata: {
          componentName,
          renderTime: renderTime.toFixed(2),
          target: '16ms',
          renderCount: metricsRef.current.renderCount,
          averageRenderTime: metricsRef.current.averageRenderTime.toFixed(2),
        },
      });
    }
  }, [componentName, log]);

  const getMetrics = useCallback(() => metricsRef.current, []);

  return { startRender, endRender, getMetrics };
};

// Debounced state management
export const useDebouncedState = <T>(
  initialValue: T,
  delay: number = 300
): [T, T, (value: T) => void] => {
  const [immediateValue, setImmediateValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setValue = useCallback(
    (value: T) => {
      setImmediateValue(value);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
    },
    [delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [immediateValue, debouncedValue, setValue];
};

// Throttled callback hook
export const useThrottledCallback = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number = 100
): T => {
  const throttledCallback = useMemo(
    () => throttle(callback, delay, { leading: true, trailing: false }),
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      throttledCallback.cancel();
    };
  }, [throttledCallback]);

  return throttledCallback as T;
};

// Debounced callback hook
export const useDebouncedCallback = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T,
  delay: number = 300
): T => {
  const debouncedCallback = useMemo(
    () => debounce(callback, delay, { leading: false, trailing: true }),
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      debouncedCallback.cancel();
    };
  }, [debouncedCallback]);

  return debouncedCallback as T;
};

// Batch state updates
export const useBatchedUpdates = <T>() => {
  const [pendingUpdates, setPendingUpdates] = useState<Array<(prev: T) => T>>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const batchUpdate = useCallback((updater: (prev: T) => T) => {
    setPendingUpdates((prev) => [...prev, updater]);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setIsProcessing(true);
    }, 50); // Batch updates within 50ms window
  }, []);

  const processBatch = useCallback(
    (currentState: T, setState: (value: T) => void) => {
      if (isProcessing && pendingUpdates.length > 0) {
        const finalState = pendingUpdates.reduce((state, updater) => updater(state), currentState);
        setState(finalState);
        setPendingUpdates([]);
        setIsProcessing(false);
      }
    },
    [isProcessing, pendingUpdates]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    batchUpdate,
    processBatch,
    hasPendingUpdates: pendingUpdates.length > 0,
  };
};

// Memoized expensive computations
export const useExpensiveComputation = <T, U>(
  computation: (input: T) => U,
  dependencies: T,
  isEqual?: (a: T, b: T) => boolean
): U => {
  const log = useLogger();
  const previousDeps = useRef<T>(dependencies);
  const previousResult = useRef<U>();
  const computationCount = useRef(0);

  return useMemo(() => {
    const hasChanged = isEqual
      ? !isEqual(previousDeps.current, dependencies)
      : previousDeps.current !== dependencies;

    if (hasChanged || previousResult.current === undefined) {
      const startTime = performance.now();
      const result = computation(dependencies);
      const endTime = performance.now();

      computationCount.current += 1;

      if (process.env.NODE_ENV === 'development') {
        log.debug('Expensive computation completed', {
          action: 'expensive_computation',
          metadata: {
            computationNumber: computationCount.current,
            duration: (endTime - startTime).toFixed(2),
            threshold: 'N/A',
          },
        });
      }

      previousDeps.current = dependencies;
      previousResult.current = result;
      return result;
    }

    return previousResult.current;
  }, [computation, dependencies, isEqual, log]);
};

// Virtual scrolling utilities
export const useVirtualScrolling = (
  items: unknown[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 5
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end + 1).map((item, index) => ({
      ...(item as object),
      index: visibleRange.start + index,
      top: (visibleRange.start + index) * itemHeight,
    }));
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop,
    visibleRange,
  };
};

// Intersection Observer for infinite scrolling
export const useInfiniteScroll = (
  hasNextPage: boolean,
  isFetching: boolean,
  fetchNextPage: () => void,
  threshold: number = 0.5
) => {
  const observerRef = useRef<IntersectionObserver>();
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasNextPage && !isFetching) {
          fetchNextPage();
        }
      },
      {
        threshold,
        rootMargin: '100px',
      }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasNextPage, isFetching, fetchNextPage, threshold]);

  return loadingRef;
};

// Memory cleanup utilities
export const useMemoryCleanup = () => {
  const log = useLogger();
  const cleanupFunctions = useRef<Array<() => void>>([]);

  const addCleanup = useCallback((cleanup: () => void) => {
    cleanupFunctions.current.push(cleanup);
  }, []);

  const runCleanup = useCallback(() => {
    cleanupFunctions.current.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        log.error(
          'Error during memory cleanup',
          {
            action: 'memory_cleanup',
            metadata: { cleanupType: 'useMemoryCleanup' },
          },
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });
    cleanupFunctions.current = [];
  }, [log]);

  useEffect(() => {
    return runCleanup;
  }, [runCleanup, log]);

  return { addCleanup, runCleanup };
};

// Component-level performance optimizations
export const useComponentOptimizations = (componentName: string) => {
  const { startRender, endRender, getMetrics } = usePerformanceMonitor(componentName);
  const { addCleanup, runCleanup } = useMemoryCleanup();
  const renderCount = useRef(0);

  useEffect(() => {
    startRender();
    renderCount.current += 1;

    return () => {
      endRender();
    };
  });

  // Note: optimizedCallback and optimizedMemo have been removed
  // because they violate React's rules of hooks - hooks cannot be called
  // inside regular functions, only at the top level of React functions

  return {
    renderCount: renderCount.current,
    getMetrics,
    addCleanup,
    runCleanup,
  };
};
