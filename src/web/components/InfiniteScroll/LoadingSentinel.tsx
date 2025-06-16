import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingSentinelProps {
  isLoading?: boolean;
  hasReachedEnd?: boolean;
  totalCount?: number;
  loadedCount?: number;
  error?: Error | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * Loading sentinel component for infinite scroll
 * Displays loading state, end state, or error state at the bottom of the list
 */
export const LoadingSentinel: React.FC<LoadingSentinelProps> = ({
  isLoading = false,
  hasReachedEnd = false,
  totalCount,
  loadedCount,
  error,
  onRetry,
  className = '',
}) => {
  // Error state
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
        <div className="text-red-500 mb-4">
          <svg
            className="w-12 h-12 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p className="text-sm font-medium">Failed to load more newsletters</p>
          <p className="text-xs text-gray-500 mt-1">
            {error.message || 'Something went wrong'}
          </p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // End state
  if (hasReachedEnd) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
        <div className="text-gray-400 mb-2">
          <svg
            className="w-8 h-8 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500 font-medium">
          {totalCount !== undefined && loadedCount !== undefined
            ? `All ${totalCount} newsletters loaded`
            : 'No more newsletters to load'}
        </p>
        {totalCount !== undefined && loadedCount !== undefined && totalCount > 0 && (
          <p className="text-xs text-gray-400 mt-1">
            Showing {Math.min(loadedCount, totalCount)} of {totalCount} newsletters
          </p>
        )}
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-gray-500 font-medium">Loading more newsletters...</p>
        {totalCount !== undefined && loadedCount !== undefined && (
          <p className="text-xs text-gray-400 mt-1">
            Loaded {loadedCount} of {totalCount}
          </p>
        )}
      </div>
    );
  }

  // Default invisible sentinel for intersection observer
  return (
    <div
      className={`h-4 w-full ${className}`}
      aria-hidden="true"
    />
  );
};

export default LoadingSentinel;
