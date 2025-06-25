import React, { useContext, useState, useCallback } from "react"; // Removed createContext

export interface Toast {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
  autoClose?: boolean;
}

export interface ToastContextType {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => string;
  showSuccess: (message: string, duration?: number) => string;
  showError: (message: string, duration?: number) => string;
  showInfo: (message: string, duration?: number) => string;
  showWarning: (message: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

// Exporting ToastContextType for use in the hook file
export type { ToastContextType };

// Removed: const ToastContext = createContext<ToastContextType | undefined>(undefined);
import { ToastContext } from './ToastContextValue'; // Added import

interface ToastProviderProps {
  children: React.ReactNode;
  defaultDuration?: number;
  maxToasts?: number;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultDuration = 5000,
  maxToasts = 5,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const generateId = useCallback(() => {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = generateId();
      const newToast: Toast = {
        id,
        duration: defaultDuration,
        autoClose: true,
        ...toast,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Keep only the most recent toasts if we exceed maxToasts
        return updated.slice(-maxToasts);
      });

      // Auto-dismiss if autoClose is enabled
      if (newToast.autoClose && newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, newToast.duration);
      }

      return id;
    },
    [generateId, defaultDuration, maxToasts, dismissToast],
  );

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      return showToast({ type: "success", message, duration });
    },
    [showToast],
  );

  const showError = useCallback(
    (message: string, duration?: number) => {
      return showToast({
        type: "error",
        message,
        duration: duration || 8000, // Errors show longer by default
      });
    },
    [showToast],
  );

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      return showToast({ type: "info", message, duration });
    },
    [showToast],
  );

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      return showToast({ type: "warning", message, duration });
    },
    [showToast],
  );

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue: ToastContextType = {
    toasts,
    showToast,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    dismissToast,
    clearAllToasts,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

// Hooks are moved, ToastContext is moved. ToastProvider should be the default export.
export default ToastProvider;
