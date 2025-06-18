import React, { useEffect, useState } from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { useToast, type Toast } from "@common/contexts/ToastContext";

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  isExiting?: boolean;
}

const ToastItem: React.FC<ToastItemProps> = ({
  toast,
  onDismiss,
  isExiting = false,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    // Wait for exit animation before calling onDismiss
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const getToastStyles = () => {
    const baseStyles = `
      relative flex items-start gap-3 p-4 rounded-lg shadow-lg border
      transition-all duration-200 ease-in-out transform
      ${
        isVisible && !isExiting
          ? "translate-x-0 opacity-100 scale-100"
          : "translate-x-full opacity-0 scale-95"
      }
      min-w-[320px] max-w-[480px]
    `;

    switch (toast.type) {
      case "success":
        return `${baseStyles} bg-green-50 border-green-200 text-green-800`;
      case "error":
        return `${baseStyles} bg-red-50 border-red-200 text-red-800`;
      case "warning":
        return `${baseStyles} bg-yellow-50 border-yellow-200 text-yellow-800`;
      case "info":
      default:
        return `${baseStyles} bg-blue-50 border-blue-200 text-blue-800`;
    }
  };

  const getIcon = () => {
    const iconClass = "h-5 w-5 flex-shrink-0 mt-0.5";

    switch (toast.type) {
      case "success":
        return <CheckCircle className={`${iconClass} text-green-500`} />;
      case "error":
        return <AlertCircle className={`${iconClass} text-red-500`} />;
      case "warning":
        return <AlertTriangle className={`${iconClass} text-yellow-500`} />;
      case "info":
      default:
        return <Info className={`${iconClass} text-blue-500`} />;
    }
  };

  const getAriaRole = () => {
    return toast.type === "error" ? "alert" : "status";
  };

  return (
    <div
      className={getToastStyles()}
      role={getAriaRole()}
      aria-live={toast.type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {/* Icon */}
      {getIcon()}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-5 break-words">
          {toast.message}
        </p>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Progress Bar for Auto-dismiss */}
      {toast.autoClose && toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 rounded-b-lg overflow-hidden">
          <div
            className="h-full bg-current opacity-30 transition-all linear"
            style={{
              width: "100%",
              animation: `toast-progress ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
};

interface ToastContainerProps {
  position?:
    | "top-right"
    | "top-left"
    | "top-center"
    | "bottom-right"
    | "bottom-left"
    | "bottom-center";
  maxToasts?: number;
  className?: string;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  position = "top-right",
  maxToasts = 5,
  className = "",
}) => {
  const { toasts, dismissToast } = useToast();
  const [exitingToasts, setExitingToasts] = useState<Set<string>>(new Set());

  // Limit the number of toasts displayed
  const visibleToasts = toasts.slice(-maxToasts);

  const handleDismiss = (id: string) => {
    setExitingToasts((prev) => new Set(prev).add(id));
    // Small delay to show exit animation
    setTimeout(() => {
      dismissToast(id);
      setExitingToasts((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }, 50);
  };

  const getContainerPosition = () => {
    const baseClasses =
      "fixed z-50 flex flex-col gap-2 p-4 pointer-events-none";

    switch (position) {
      case "top-left":
        return `${baseClasses} top-0 left-0`;
      case "top-center":
        return `${baseClasses} top-0 left-1/2 transform -translate-x-1/2`;
      case "top-right":
        return `${baseClasses} top-0 right-0`;
      case "bottom-left":
        return `${baseClasses} bottom-0 left-0`;
      case "bottom-center":
        return `${baseClasses} bottom-0 left-1/2 transform -translate-x-1/2`;
      case "bottom-right":
        return `${baseClasses} bottom-0 right-0`;
      default:
        return `${baseClasses} top-0 right-0`;
    }
  };

  const shouldReverseOrder = position.startsWith("bottom");

  if (visibleToasts.length === 0) {
    return null;
  }

  const orderedToasts = shouldReverseOrder
    ? [...visibleToasts].reverse()
    : visibleToasts;

  return (
    <>
      <div
        className={`${getContainerPosition()} ${className}`}
        aria-label="Notifications"
        role="region"
      >
        {orderedToasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem
              toast={toast}
              onDismiss={handleDismiss}
              isExiting={exitingToasts.has(toast.id)}
            />
          </div>
        ))}
      </div>

      {/* Add CSS for progress bar animation */}
      <style>{`
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </>
  );
};

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

export default ToastContainer;
