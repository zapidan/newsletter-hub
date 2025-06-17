import React, { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader } from "lucide-react";
import { useNewsletterNavigation } from "@common/hooks/useNewsletterNavigation";
import { useSharedNewsletterActions } from "@common/hooks/useSharedNewsletterActions";
import { useLogger } from "@common/utils/logger";

interface NewsletterNavigationProps {
  currentNewsletterId: string;
  className?: string;
  showLabels?: boolean;
  showCounter?: boolean;
  disabled?: boolean;
  autoMarkAsRead?: boolean;
}

export const NewsletterNavigation: React.FC<NewsletterNavigationProps> = ({
  currentNewsletterId,
  className = "",
  showLabels = true,
  showCounter = true,
  disabled = false,
  autoMarkAsRead = true,
}) => {
  const navigate = useNavigate();
  const log = useLogger("NewsletterNavigation");

  const {
    hasPrevious,
    hasNext,
    currentIndex,
    totalCount,
    isLoading,
    currentNewsletter,
    navigateToPrevious,
    navigateToNext,
  } = useNewsletterNavigation(currentNewsletterId, {
    enabled: !disabled,
    preloadAdjacent: true,
    debug: false,
  });

  const { handleMarkAsRead, handleToggleArchive } = useSharedNewsletterActions({
    showToasts: false, // Don't show toasts for auto-mark-as-read and auto-archive
    optimisticUpdates: true,
  });

  // Auto-mark current newsletter as read when it loads (instantaneous)
  useEffect(() => {
    if (
      autoMarkAsRead &&
      currentNewsletter &&
      !currentNewsletter.is_read &&
      !disabled
    ) {
      const markAsRead = async () => {
        try {
          await handleMarkAsRead(currentNewsletter.id);
          log.debug("Auto-marked newsletter as read via navigation", {
            action: "auto_mark_read_navigation",
            metadata: {
              newsletterId: currentNewsletter.id,
              title: currentNewsletter.title,
            },
          });
        } catch (error) {
          log.error(
            "Failed to auto-mark newsletter as read via navigation",
            {
              action: "auto_mark_read_navigation_error",
              metadata: { newsletterId: currentNewsletter.id },
            },
            error,
          );
        }
      };

      // Mark as read immediately without delay
      markAsRead();
    }
  }, [currentNewsletter?.id, autoMarkAsRead, disabled]); // Remove functions from deps to prevent infinite loop

  const handlePrevious = useCallback(async () => {
    if (disabled || !hasPrevious) return;

    // Mark current newsletter as read and archive before navigating
    if (currentNewsletter && autoMarkAsRead) {
      try {
        if (!currentNewsletter.is_read) {
          await handleMarkAsRead(currentNewsletter.id);
        }
        if (!currentNewsletter.is_archived) {
          await handleToggleArchive(currentNewsletter);
        }
      } catch (error) {
        log.error(
          "Failed to process current newsletter before navigation",
          {
            action: "navigate_previous_process_error",
            metadata: { newsletterId: currentNewsletter.id },
          },
          error,
        );
      }
    }

    const previousId = navigateToPrevious();
    if (previousId) {
      log.debug("Navigating to previous newsletter", {
        action: "navigate_previous",
        metadata: {
          fromId: currentNewsletterId,
          toId: previousId,
        },
      });
      navigate(`/newsletters/${previousId}`, {
        state: {
          from: `/newsletters/${currentNewsletterId}`,
          autoMarkAsRead: autoMarkAsRead,
        },
      });
    }
  }, [
    disabled,
    hasPrevious,
    navigateToPrevious,
    navigate,
    currentNewsletterId,
    currentNewsletter,
    autoMarkAsRead,
    handleMarkAsRead,
    handleToggleArchive,
    log,
  ]);

  const handleNext = useCallback(async () => {
    if (disabled || !hasNext) return;

    // Mark current newsletter as read and archive before navigating
    if (currentNewsletter && autoMarkAsRead) {
      try {
        if (!currentNewsletter.is_read) {
          await handleMarkAsRead(currentNewsletter.id);
        }
        if (!currentNewsletter.is_archived) {
          await handleToggleArchive(currentNewsletter);
        }
      } catch (error) {
        log.error(
          "Failed to process current newsletter before navigation",
          {
            action: "navigate_next_process_error",
            metadata: { newsletterId: currentNewsletter.id },
          },
          error,
        );
      }
    }

    const nextId = navigateToNext();
    if (nextId) {
      log.debug("Navigating to next newsletter", {
        action: "navigate_next",
        metadata: {
          fromId: currentNewsletterId,
          toId: nextId,
        },
      });
      navigate(`/newsletters/${nextId}`, {
        state: {
          from: `/newsletters/${currentNewsletterId}`,
          autoMarkAsRead: autoMarkAsRead,
        },
      });
    }
  }, [
    disabled,
    hasNext,
    navigateToNext,
    navigate,
    currentNewsletterId,
    currentNewsletter,
    autoMarkAsRead,
    handleMarkAsRead,
    handleToggleArchive,
    log,
  ]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (disabled) return;

      // Only handle shortcuts when not typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "j") {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === "ArrowRight" || event.key === "k") {
        event.preventDefault();
        handleNext();
      }
    },
    [disabled, handlePrevious, handleNext],
  );

  // Add keyboard event listeners
  React.useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Don't render if we don't have enough data yet, but allow some time for loading
  if (currentIndex === -1 && !isLoading && !currentNewsletter) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Previous Button */}
      <button
        onClick={handlePrevious}
        disabled={disabled || !hasPrevious || isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${
            hasPrevious && !disabled && !isLoading
              ? "text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
              : "text-gray-400 cursor-not-allowed"
          }
        `}
        title={
          hasPrevious
            ? "Previous newsletter (← or J)"
            : "No previous newsletter"
        }
        aria-label="Navigate to previous newsletter"
      >
        {isLoading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
        {showLabels && <span>Previous</span>}
      </button>

      {/* Counter */}
      {showCounter && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : currentIndex >= 0 ? (
            <>
              <span className="font-medium text-gray-700">
                {currentIndex + 1}
              </span>
              <span>of</span>
              <span className="font-medium text-gray-700">
                {totalCount > 0 ? totalCount.toLocaleString() : "?"}
              </span>
            </>
          ) : (
            <span>Loading position...</span>
          )}
        </div>
      )}

      {/* Next Button */}
      <button
        onClick={handleNext}
        disabled={disabled || !hasNext || isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
          ${
            hasNext && !disabled && !isLoading
              ? "text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200"
              : "text-gray-400 cursor-not-allowed"
          }
        `}
        title={hasNext ? "Next newsletter (→ or K)" : "No next newsletter"}
        aria-label="Navigate to next newsletter"
      >
        {showLabels && <span>Next</span>}
        {isLoading ? (
          <Loader className="h-4 w-4 animate-spin" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
    </div>
  );
};

export default NewsletterNavigation;
