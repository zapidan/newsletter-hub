import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useLogger } from "@common/utils/logger";

export type LoadingState = "idle" | "loading" | "success" | "error";

export interface LoadingStateInfo {
  state: LoadingState;
  startTime?: Date;
  endTime?: Date;
  error?: Error;
  duration?: number;
}

export interface UseLoadingStatesOptions {
  enableDebug?: boolean;
  trackTiming?: boolean;
  maxHistorySize?: number;
  onStateChange?: (
    key: string,
    state: LoadingState,
    info: LoadingStateInfo,
  ) => void;
}

export interface LoadingStatesReturn {
  // State queries
  isLoading: (key: string) => boolean;
  isIdle: (key: string) => boolean;
  isSuccess: (key: string) => boolean;
  isError: (key: string) => boolean;
  getState: (key: string) => LoadingState;
  getInfo: (key: string) => LoadingStateInfo;
  hasAnyLoading: () => boolean;
  getLoadingKeys: () => string[];

  // State management
  setLoading: (key: string) => void;
  setSuccess: (key: string) => void;
  setError: (key: string, error?: Error) => void;
  setIdle: (key: string) => void;
  reset: (key: string) => void;
  resetAll: () => void;

  // Async operation helpers
  withLoading: <T extends any[], R>(
    key: string,
    operation: (...args: T) => Promise<R>,
  ) => (...args: T) => Promise<R>;

  executeWithLoading: <T>(
    key: string,
    operation: () => Promise<T>,
  ) => Promise<T>;

  // Bulk operations
  setBulkLoading: (keys: string[]) => void;
  setBulkSuccess: (keys: string[]) => void;
  setBulkError: (keys: string[], error?: Error) => void;
  setBulkIdle: (keys: string[]) => void;

  // Utilities
  getStats: () => {
    totalOperations: number;
    activeLoading: number;
    averageDuration: number;
    errorRate: number;
  };

  // All current states
  states: Record<string, LoadingStateInfo>;
}

export const useLoadingStates = (
  options: UseLoadingStatesOptions = {},
): LoadingStatesReturn => {
  const {
    enableDebug = false,
    trackTiming = true,
    maxHistorySize = 100,
    onStateChange,
  } = options;

  const log = useLogger();

  const [states, setStates] = useState<Record<string, LoadingStateInfo>>({});
  const historyRef = useRef<
    Array<{
      key: string;
      state: LoadingState;
      timestamp: Date;
      info: LoadingStateInfo;
    }>
  >([]);
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach((timeout) => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Update state helper
  const updateState = useCallback(
    (key: string, newState: LoadingState, error?: Error) => {
      setStates((prev) => {
        const currentInfo = prev[key];
        const now = new Date();

        let newInfo: LoadingStateInfo = {
          state: newState,
          startTime: newState === "loading" ? now : currentInfo?.startTime,
          endTime: newState !== "loading" ? now : undefined,
          error: newState === "error" ? error : undefined,
        };

        // Calculate duration if we have timing info
        if (trackTiming && newInfo.startTime && newInfo.endTime) {
          newInfo.duration =
            newInfo.endTime.getTime() - newInfo.startTime.getTime();
        }

        const updatedStates = {
          ...prev,
          [key]: newInfo,
        };

        // Add to history
        if (historyRef.current.length >= maxHistorySize) {
          historyRef.current = historyRef.current.slice(1);
        }
        historyRef.current.push({
          key,
          state: newState,
          timestamp: now,
          info: newInfo,
        });

        // Debug logging
        if (enableDebug) {
          log.debug("Loading state changed", {
            action: "state_change",
            metadata: {
              key,
              newState,
              duration: newInfo.duration,
              errorMessage: error?.message,
            },
          });
        }

        // Notify listener
        onStateChange?.(key, newState, newInfo);

        return updatedStates;
      });
    },
    [trackTiming, maxHistorySize, enableDebug, onStateChange],
  );

  // State queries
  const isLoading = useCallback(
    (key: string): boolean => {
      return states[key]?.state === "loading";
    },
    [states],
  );

  const isIdle = useCallback(
    (key: string): boolean => {
      return !states[key] || states[key].state === "idle";
    },
    [states],
  );

  const isSuccess = useCallback(
    (key: string): boolean => {
      return states[key]?.state === "success";
    },
    [states],
  );

  const isError = useCallback(
    (key: string): boolean => {
      return states[key]?.state === "error";
    },
    [states],
  );

  const getState = useCallback(
    (key: string): LoadingState => {
      return states[key]?.state || "idle";
    },
    [states],
  );

  const getInfo = useCallback(
    (key: string): LoadingStateInfo => {
      return states[key] || { state: "idle" };
    },
    [states],
  );

  const hasAnyLoading = useCallback((): boolean => {
    return Object.values(states).some((info) => info.state === "loading");
  }, [states]);

  const getLoadingKeys = useCallback((): string[] => {
    return Object.entries(states)
      .filter(([, info]) => info.state === "loading")
      .map(([key]) => key);
  }, [states]);

  // State management
  const setLoading = useCallback(
    (key: string) => {
      updateState(key, "loading");
    },
    [updateState],
  );

  const setSuccess = useCallback(
    (key: string) => {
      updateState(key, "success");
    },
    [updateState],
  );

  const setError = useCallback(
    (key: string, error?: Error) => {
      updateState(key, "error", error);
    },
    [updateState],
  );

  const setIdle = useCallback(
    (key: string) => {
      updateState(key, "idle");
    },
    [updateState],
  );

  const reset = useCallback((key: string) => {
    setStates((prev) => {
      const { [key]: removed, ...rest } = prev;
      return rest;
    });

    // Clear any pending timeouts for this key
    if (timeoutRefs.current[key]) {
      clearTimeout(timeoutRefs.current[key]);
      delete timeoutRefs.current[key];
    }
  }, []);

  const resetAll = useCallback(() => {
    setStates({});

    // Clear all timeouts
    Object.values(timeoutRefs.current).forEach((timeout) => {
      clearTimeout(timeout);
    });
    timeoutRefs.current = {};
  }, []);

  // Async operation wrapper
  const withLoading = useCallback(
    <T extends any[], R>(
      key: string,
      operation: (...args: T) => Promise<R>,
    ) => {
      return async (...args: T): Promise<R> => {
        setLoading(key);

        try {
          const result = await operation(...args);
          setSuccess(key);
          return result;
        } catch (error) {
          setError(
            key,
            error instanceof Error ? error : new Error(String(error)),
          );
          throw error;
        }
      };
    },
    [setLoading, setSuccess, setError],
  );

  const executeWithLoading = useCallback(
    async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
      const wrappedOperation = withLoading(key, operation);
      return wrappedOperation();
    },
    [withLoading],
  );

  // Bulk operations
  const setBulkLoading = useCallback(
    (keys: string[]) => {
      keys.forEach((key) => setLoading(key));
    },
    [setLoading],
  );

  const setBulkSuccess = useCallback(
    (keys: string[]) => {
      keys.forEach((key) => setSuccess(key));
    },
    [setSuccess],
  );

  const setBulkError = useCallback(
    (keys: string[], error?: Error) => {
      keys.forEach((key) => setError(key, error));
    },
    [setError],
  );

  const setBulkIdle = useCallback(
    (keys: string[]) => {
      keys.forEach((key) => setIdle(key));
    },
    [setIdle],
  );

  // Statistics
  const getStats = useCallback(() => {
    const history = historyRef.current;
    const totalOperations = history.length;
    const activeLoading = Object.values(states).filter(
      (info) => info.state === "loading",
    ).length;

    const completedOperations = history.filter(
      (entry) => entry.info.duration !== undefined,
    );

    const averageDuration =
      completedOperations.length > 0
        ? completedOperations.reduce(
            (sum, entry) => sum + (entry.info.duration || 0),
            0,
          ) / completedOperations.length
        : 0;

    const errorOperations = history.filter(
      (entry) => entry.state === "error",
    ).length;
    const errorRate =
      totalOperations > 0 ? errorOperations / totalOperations : 0;

    return {
      totalOperations,
      activeLoading,
      averageDuration,
      errorRate,
    };
  }, [states]);

  return {
    // State queries
    isLoading,
    isIdle,
    isSuccess,
    isError,
    getState,
    getInfo,
    hasAnyLoading,
    getLoadingKeys,

    // State management
    setLoading,
    setSuccess,
    setError,
    setIdle,
    reset,
    resetAll,

    // Async operation helpers
    withLoading,
    executeWithLoading,

    // Bulk operations
    setBulkLoading,
    setBulkSuccess,
    setBulkError,
    setBulkIdle,

    // Utilities
    getStats,

    // All current states
    states,
  };
};

// Specialized hooks for common patterns

// Hook for tracking individual newsletter actions
export const useNewsletterLoadingStates = () => {
  const loadingStates = useLoadingStates({
    enableDebug: true,
    trackTiming: true,
  });

  // Helper methods for common newsletter operations
  const withNewsletterAction = useCallback(
    (action: string, newsletterId: string, operation: () => Promise<void>) => {
      const key = `${action}-${newsletterId}`;
      return loadingStates.executeWithLoading(key, operation);
    },
    [loadingStates],
  );

  const isNewsletterLoading = useCallback(
    (action: string, newsletterId: string) => {
      return loadingStates.isLoading(`${action}-${newsletterId}`);
    },
    [loadingStates],
  );

  const isAnyNewsletterLoading = useCallback(
    (newsletterId: string) => {
      const keys = loadingStates.getLoadingKeys();
      return keys.some((key) => key.endsWith(`-${newsletterId}`));
    },
    [loadingStates],
  );

  return {
    ...loadingStates,
    withNewsletterAction,
    isNewsletterLoading,
    isAnyNewsletterLoading,
  };
};

// Hook for tracking bulk operations
export const useBulkLoadingStates = () => {
  const loadingStates = useLoadingStates({
    enableDebug: true,
    trackTiming: true,
  });

  const bulkOperationStates = useMemo(
    () => ({
      isBulkMarkingAsRead: loadingStates.isLoading("bulk-mark-read"),
      isBulkMarkingAsUnread: loadingStates.isLoading("bulk-mark-unread"),
      isBulkArchiving: loadingStates.isLoading("bulk-archive"),
      isBulkUnarchiving: loadingStates.isLoading("bulk-unarchive"),
      isBulkDeleting: loadingStates.isLoading("bulk-delete"),
      isBulkActionInProgress: loadingStates.hasAnyLoading(),
    }),
    [loadingStates],
  );

  const withBulkAction = useCallback(
    (action: string, operation: () => Promise<void>) => {
      return loadingStates.executeWithLoading(`bulk-${action}`, operation);
    },
    [loadingStates],
  );

  return {
    ...loadingStates,
    ...bulkOperationStates,
    withBulkAction,
  };
};

export default useLoadingStates;
