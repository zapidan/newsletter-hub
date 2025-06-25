import { useContext, useCallback } from 'react';
import { ToastContext } from '../contexts/ToastContextValue'; // Updated import
import type { ToastContextType } from '../contexts/ToastContext'; // Type import remains

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

// Helper hook for common toast patterns
export const useToastActions = () => {
  const { showSuccess, showError, showInfo, showWarning } = useToast();

  const toastSuccess = useCallback(
    (message: string) => {
      return showSuccess(message);
    },
    [showSuccess],
  );

  const toastError = useCallback(
    (error: Error | string, fallbackMessage = "An error occurred") => {
      const message =
        error instanceof Error ? error.message : error || fallbackMessage;
      return showError(message);
    },
    [showError],
  );

  const toastInfo = useCallback(
    (message: string) => {
      return showInfo(message);
    },
    [showInfo],
  );

  const toastWarning = useCallback(
    (message: string) => {
      return showWarning(message);
    },
    [showWarning],
  );

  return {
    toastSuccess,
    toastError,
    toastInfo,
    toastWarning,
  };
};
