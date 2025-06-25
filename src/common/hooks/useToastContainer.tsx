import { useToast, type Toast } from "@common/contexts/ToastContext";

// Hook for managing toast container state
export const useToastContainer = () => {
  const { toasts, clearAllToasts } = useToast();

  const hasToasts = toasts.length > 0;
  const toastCount = toasts.length;

  const getToastsByType = () => {
    return toasts.reduce(
      (acc, toast) => {
        acc[toast.type] = (acc[toast.type] || 0) + 1;
        return acc;
      },
      {} as Record<Toast["type"], number>,
    );
  };

  return {
    hasToasts,
    toastCount,
    toastsByType: getToastsByType(),
    clearAll: clearAllToasts,
  };
};
