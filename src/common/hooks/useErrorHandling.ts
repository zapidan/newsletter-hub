import { useCallback, useState, useRef, useEffect } from "react";
import { useToastActions } from "@common/contexts/ToastContext";
import { useLogger } from "@common/utils/logger/useLogger";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export type ErrorCategory =
  | "network"
  | "auth"
  | "validation"
  | "business"
  | "system"
  | "unknown";

export interface AppError extends Error {
  code?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  context?: Record<string, any>;
  retryable?: boolean;
  timestamp?: Date;
  userId?: string;
}

export interface ErrorState {
  hasError: boolean;
  lastError: AppError | null;
  errorCount: number;
  errorHistory: AppError[];
}

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
  shouldRetry?: (error: AppError, attempt: number) => boolean;
}

export interface UseErrorHandlingOptions {
  enableToasts?: boolean;
  enableLogging?: boolean;
  maxErrorHistory?: number;
  defaultRetryOptions?: RetryOptions;
  onError?: (error: AppError) => void;
  onRecovery?: () => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  delayMs: 1000,
  exponentialBackoff: true,
  shouldRetry: (error, attempt) => {
    // Don't retry auth errors or validation errors
    if (error.category === "auth" || error.category === "validation") {
      return false;
    }
    // Don't retry if explicitly marked as non-retryable
    if (error.retryable === false) {
      return false;
    }
    return attempt < (DEFAULT_RETRY_OPTIONS.maxAttempts || 3);
  },
};

export const useErrorHandling = (options: UseErrorHandlingOptions = {}) => {
  const {
    enableToasts = true,
    enableLogging = true,
    maxErrorHistory = 10,
    defaultRetryOptions = DEFAULT_RETRY_OPTIONS,
    onError,
    onRecovery,
  } = options;

  const { toastError, toastWarning } = useToastActions();
  const log = useLogger("useErrorHandling");
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    lastError: null,
    errorCount: 0,
    errorHistory: [],
  });

  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Create an AppError from various error types
  const createAppError = useCallback(
    (
      error: Error | string | unknown,
      context?: {
        code?: string;
        category?: ErrorCategory;
        severity?: ErrorSeverity;
        context?: Record<string, any>;
        retryable?: boolean;
      },
    ): AppError => {
      let baseError: Error;

      if (error instanceof Error) {
        baseError = error;
      } else if (typeof error === "string") {
        baseError = new Error(error);
      } else {
        baseError = new Error("Unknown error occurred");
      }

      const appError: AppError = {
        ...baseError,
        name: baseError.name || "AppError",
        message: baseError.message || "An unexpected error occurred",
        code: context?.code,
        category: context?.category || "unknown",
        severity: context?.severity || "medium",
        context: context?.context,
        retryable: context?.retryable,
        timestamp: new Date(),
      };

      return appError;
    },
    [],
  );

  // Log error (could be extended to send to external service)
  const logError = useCallback(
    (error: AppError) => {
      if (!enableLogging) return;

      const logData = {
        message: error.message,
        code: error.code,
        category: error.category,
        severity: error.severity,
        stack: error.stack,
        context: error.context,
        timestamp: error.timestamp?.toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };

      // Log based on severity
      switch (error.severity) {
        case "critical":
          log.error(
            "Critical Error",
            {
              action: "log_critical_error",
              metadata: logData,
            },
            error,
          );
          break;
        case "high":
          log.error(
            "High Severity Error",
            {
              action: "log_high_severity_error",
              metadata: logData,
            },
            error,
          );
          break;
        case "medium":
          log.warn(
            "Medium Severity Error",
            {
              action: "log_medium_severity_error",
              metadata: logData,
            },
            error,
          );
          break;
        case "low":
          log.info("Low Severity Error", {
            action: "log_low_severity_error",
            metadata: logData,
          });
          break;
        default:
          log.error(
            "Unknown Severity Error",
            {
              action: "log_unknown_severity_error",
              metadata: logData,
            },
            error,
          );
      }
    },
    [enableLogging, log],
  );

  // Show user-friendly error message
  const showErrorToast = useCallback(
    (error: AppError) => {
      if (!enableToasts) return;

      const message = getUserFriendlyMessage(error);

      if (error.severity === "critical" || error.severity === "high") {
        toastError(message, 8000);
      } else {
        toastWarning(message, 5000);
      }
    },
    [enableToasts, toastError, toastWarning],
  );

  // Handle error with full processing
  const handleError = useCallback(
    (
      error: Error | string | unknown,
      context?: Parameters<typeof createAppError>[1],
    ) => {
      const appError = createAppError(error, context);

      // Update error state
      setErrorState((prev) => ({
        hasError: true,
        lastError: appError,
        errorCount: prev.errorCount + 1,
        errorHistory: [appError, ...prev.errorHistory].slice(
          0,
          maxErrorHistory,
        ),
      }));

      // Log the error
      logError(appError);

      // Show toast notification
      showErrorToast(appError);

      // Call custom error handler
      onError?.(appError);

      return appError;
    },
    [createAppError, logError, showErrorToast, onError, maxErrorHistory],
  );

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState((prev) => ({
      ...prev,
      hasError: false,
      lastError: null,
    }));

    onRecovery?.();
  }, [onRecovery]);

  // Clear all errors and history
  const clearAllErrors = useCallback(() => {
    setErrorState({
      hasError: false,
      lastError: null,
      errorCount: 0,
      errorHistory: [],
    });

    onRecovery?.();
  }, [onRecovery]);

  // Retry a failed operation with exponential backoff
  const retryOperation = useCallback(
    async <T>(
      operation: () => Promise<T>,
      retryOptions: RetryOptions = {},
    ): Promise<T> => {
      const options = { ...defaultRetryOptions, ...retryOptions };
      let lastError: AppError;
      let attempt = 0;

      while (attempt < (options.maxAttempts || 3)) {
        try {
          const result = await operation();
          // Clear error on successful retry
          if (attempt > 0) {
            clearError();
          }
          return result;
        } catch (error) {
          attempt++;
          lastError = createAppError(error, {
            context: { attempt, maxAttempts: options.maxAttempts },
          });

          // Check if we should retry
          if (!options.shouldRetry?.(lastError, attempt)) {
            break;
          }

          // Don't wait after the last attempt
          if (attempt < (options.maxAttempts || 3)) {
            const delay = options.exponentialBackoff
              ? (options.delayMs || 1000) * Math.pow(2, attempt - 1)
              : options.delayMs || 1000;

            await new Promise((resolve) => {
              retryTimeoutRef.current = setTimeout(resolve, delay);
            });
          }
        }
      }

      // All retries failed, handle the final error
      throw handleError(lastError!, {
        context: {
          ...lastError!.context,
          finalAttempt: true,
          totalAttempts: attempt,
        },
      });
    },
    [defaultRetryOptions, createAppError, clearError, handleError],
  );

  // Wrap an async operation with error handling
  const withErrorHandling = useCallback(
    <T extends any[], R>(
      operation: (...args: T) => Promise<R>,
      errorContext?: Omit<Parameters<typeof createAppError>[1], "context"> & {
        context?: Record<string, any>;
      },
    ) => {
      return async (...args: T): Promise<R> => {
        try {
          return await operation(...args);
        } catch (error) {
          throw handleError(error, {
            ...errorContext,
            context: {
              ...errorContext?.context,
              operationArgs: args,
            },
          });
        }
      };
    },
    [handleError],
  );

  // Check if a specific error type has occurred recently
  const hasRecentError = useCallback(
    (
      category?: ErrorCategory,
      timeWindowMs: number = 5 * 60 * 1000, // 5 minutes
    ): boolean => {
      const cutoff = new Date(Date.now() - timeWindowMs);

      return errorState.errorHistory.some((error) => {
        const matchesCategory = !category || error.category === category;
        const isRecent = error.timestamp && error.timestamp > cutoff;
        return matchesCategory && isRecent;
      });
    },
    [errorState.errorHistory],
  );

  // Get error statistics
  const getErrorStats = useCallback(() => {
    const categoryCounts = errorState.errorHistory.reduce(
      (acc, error) => {
        const category = error.category || "unknown";
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      },
      {} as Record<ErrorCategory, number>,
    );

    const severityCounts = errorState.errorHistory.reduce(
      (acc, error) => {
        const severity = error.severity || "unknown";
        acc[severity] = (acc[severity] || 0) + 1;
        return acc;
      },
      {} as Record<ErrorSeverity | "unknown", number>,
    );

    return {
      totalErrors: errorState.errorCount,
      recentErrors: errorState.errorHistory.length,
      categoryCounts,
      severityCounts,
      lastErrorTime: errorState.lastError?.timestamp,
    };
  }, [errorState]);

  return {
    // State
    ...errorState,

    // Actions
    handleError,
    clearError,
    clearAllErrors,
    createAppError,

    // Utilities
    retryOperation,
    withErrorHandling,
    hasRecentError,
    getErrorStats,

    // Helpers
    logError,
    showErrorToast,
  };
};

// Helper function to convert technical errors to user-friendly messages
function getUserFriendlyMessage(error: AppError): string {
  // Check for specific error codes first
  if (error.code) {
    const codeMessages: Record<string, string> = {
      NETWORK_ERROR:
        "Connection problem. Please check your internet connection.",
      AUTH_REQUIRED: "Please sign in to continue.",
      AUTH_EXPIRED: "Your session has expired. Please sign in again.",
      FORBIDDEN: "You don't have permission to perform this action.",
      NOT_FOUND: "The requested item could not be found.",
      VALIDATION_ERROR: "Please check your input and try again.",
      RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
      SERVER_ERROR: "Server error. Please try again later.",
    };

    if (codeMessages[error.code]) {
      return codeMessages[error.code];
    }
  }

  // Fallback to category-based messages
  switch (error.category) {
    case "network":
      return "Network error. Please check your connection and try again.";
    case "auth":
      return "Authentication error. Please sign in and try again.";
    case "validation":
      return "Invalid input. Please check your data and try again.";
    case "business":
      return error.message || "Unable to complete this action.";
    default:
      return error.message || "An unexpected error occurred. Please try again.";
  }
}

// Error boundary hook for React components
export const useErrorBoundary = () => {
  const { handleError } = useErrorHandling({
    enableToasts: true,
    enableLogging: true,
  });

  const captureError = useCallback(
    (error: Error, errorInfo?: { componentStack: string }) => {
      handleError(error, {
        category: "system",
        severity: "high",
        context: {
          componentStack: errorInfo?.componentStack,
          errorBoundary: true,
        },
      });
    },
    [handleError],
  );

  return { captureError };
};

export default useErrorHandling;
