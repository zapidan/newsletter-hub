import { useCallback, useRef, useState } from 'react';
import { useLogger } from '@common/utils/logger/useLogger';

export interface OptimisticUpdateOptions<T> {
  /** Custom rollback function - if not provided, uses the original value */
  rollback?: (originalValue: T, error: Error) => T;
  /** Called when the update succeeds */
  onSuccess?: (newValue: T) => void;
  /** Called when the update fails */
  onError?: (error: Error, originalValue: T) => void;
  /** Called when rollback occurs */
  onRollback?: (rolledBackValue: T, error: Error) => void;
  /** Enable debug logging */
  debug?: boolean;
}

export interface OptimisticUpdateResult<T> {
  /** Current value (optimistic or confirmed) */
  value: T;
  /** Whether an optimistic update is in progress */
  isPending: boolean;
  /** Whether the last operation failed */
  hasError: boolean;
  /** The error from the last failed operation */
  error: Error | null;
  /** Execute an optimistic update */
  execute: (
    optimisticValue: T,
    asyncOperation: () => Promise<T | void>,
    options?: Partial<OptimisticUpdateOptions<T>>
  ) => Promise<T>;
  /** Reset to original value and clear error state */
  reset: () => void;
}

/**
 * Hook for managing optimistic updates with automatic rollback on failure
 *
 * @param initialValue - The initial value
 * @param globalOptions - Default options for all operations
 * @returns Object with current value, state, and execution function
 *
 * @example
 * ```typescript
 * const { value, execute, isPending } = useOptimisticUpdate(newsletter, {
 *   onError: (error) => toast.error('Update failed'),
 *   debug: true
 * });
 *
 * // Toggle like status optimistically
 * const handleToggleLike = async () => {
 *   await execute(
 *     { ...newsletter, is_liked: !newsletter.is_liked },
 *     () => toggleLikeAPI(newsletter.id)
 *   );
 * };
 * ```
 */
export const useOptimisticUpdate = <T>(
  initialValue: T,
  globalOptions: OptimisticUpdateOptions<T> = {}
): OptimisticUpdateResult<T> => {
  const log = useLogger('useOptimisticUpdate');
  const { debug = false } = globalOptions;

  // State management
  const [value, setValue] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Keep track of the original value for rollback
  const originalValueRef = useRef<T>(initialValue);
  const pendingOperationRef = useRef<Promise<T> | null>(null);

  // Update original value when initialValue changes
  if (initialValue !== originalValueRef.current && !isPending) {
    originalValueRef.current = initialValue;
    setValue(initialValue);
  }

  const execute = useCallback(
    async (
      optimisticValue: T,
      asyncOperation: () => Promise<T | void>,
      operationOptions: Partial<OptimisticUpdateOptions<T>> = {}
    ): Promise<T> => {
      // Merge options
      const options = { ...globalOptions, ...operationOptions };

      // Prevent concurrent operations
      if (isPending) {
        if (debug) {
          log.debug('Optimistic update already in progress, waiting for completion');
        }
        if (pendingOperationRef.current) {
          return await pendingOperationRef.current;
        }
      }

      setIsPending(true);
      setHasError(false);
      setError(null);

      // Store original value for rollback
      const originalValue = value;
      originalValueRef.current = originalValue;

      // Apply optimistic update immediately
      setValue(optimisticValue);

      if (debug) {
        log.debug('Applying optimistic update', {
          action: 'optimistic_update_start',
          metadata: {
            hasOriginalValue: !!originalValue,
            hasOptimisticValue: !!optimisticValue,
          }
        });
      }

      // Create and store the promise
      const operationPromise = (async (): Promise<T> => {
        try {
          // Execute the async operation
          const result = await asyncOperation();

          // If operation returns a value, use it; otherwise keep optimistic value
          const finalValue = result !== undefined ? result : optimisticValue;

          // Confirm the update
          setValue(finalValue);
          originalValueRef.current = finalValue;

          if (debug) {
            log.debug('Optimistic update confirmed', {
              action: 'optimistic_update_success',
              metadata: {
                hasResult: !!result,
                usedOptimisticValue: result === undefined,
              }
            });
          }

          // Call success callback
          options.onSuccess?.(finalValue);

          return finalValue;

        } catch (operationError) {
          // Determine rollback value
          const rollbackValue = options.rollback
            ? options.rollback(originalValue, operationError as Error)
            : originalValue;

          // Rollback to original or custom value
          setValue(rollbackValue);
          setHasError(true);
          setError(operationError as Error);

          if (debug) {
            log.error('Optimistic update failed, rolling back', {
              action: 'optimistic_update_rollback',
              metadata: {
                hasCustomRollback: !!options.rollback,
              }
            }, operationError as Error);
          }

          // Call error callbacks
          options.onError?.(operationError as Error, originalValue);
          options.onRollback?.(rollbackValue, operationError as Error);

          // Re-throw the error so callers can handle it
          throw operationError;

        } finally {
          setIsPending(false);
          pendingOperationRef.current = null;
        }
      })();

      pendingOperationRef.current = operationPromise;

      return operationPromise;
    },
    [value, isPending, globalOptions, debug, log]
  );

  const reset = useCallback(() => {
    setValue(originalValueRef.current);
    setIsPending(false);
    setHasError(false);
    setError(null);
    pendingOperationRef.current = null;

    if (debug) {
      log.debug('Optimistic update state reset', {
        action: 'optimistic_update_reset'
      });
    }
  }, [debug, log]);

  return {
    value,
    isPending,
    hasError,
    error,
    execute,
    reset,
  };
};

/**
 * Hook for managing multiple optimistic updates
 * Useful when you need to track several independent optimistic operations
 */
export const useMultipleOptimisticUpdates = <T extends Record<string, any>>(
  initialValues: T,
  globalOptions: OptimisticUpdateOptions<T> = {}
) => {
  const optimisticUpdates = useOptimisticUpdate(initialValues, globalOptions);

  const updateField = useCallback(
    async <K extends keyof T>(
      field: K,
      optimisticValue: T[K],
      asyncOperation: () => Promise<T[K] | void>,
      options?: Partial<OptimisticUpdateOptions<T>>
    ) => {
      const optimisticState = {
        ...optimisticUpdates.value,
        [field]: optimisticValue,
      };

      return await optimisticUpdates.execute(
        optimisticState,
        async () => {
          const result = await asyncOperation();
          if (result !== undefined) {
            return {
              ...optimisticUpdates.value,
              [field]: result,
            };
          }
          return optimisticState;
        },
        options
      );
    },
    [optimisticUpdates]
  );

  return {
    ...optimisticUpdates,
    updateField,
  };
};

export default useOptimisticUpdate;
