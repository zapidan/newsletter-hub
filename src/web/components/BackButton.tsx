import { useLogger } from '@common/utils/logger/useLogger';
import { ArrowLeft } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

interface BackButtonProps {
  /** Custom target route, defaults to auto-detection */
  targetRoute?: string;
  /** Fallback route if no navigation context is found */
  fallbackRoute?: string;
  /** Additional CSS classes */
  className?: string;
  /** Custom children content */
  children?: React.ReactNode;
  /** Whether to preserve URL parameters when navigating back */
  preserveFilters?: boolean;
  /** Button text to show */
  text?: string;
}

const BackButton = memo(({
  targetRoute,
  fallbackRoute = '/inbox',
  className = '',
  children,
  preserveFilters = true,
  text
}: BackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const log = useLogger();

  // Check if we came from the reading queue using multiple indicators
  const isFromReadingQueue = useMemo(() => {
    return (
      location.state?.fromReadingQueue === true ||
      location.state?.from === '/reading-queue' ||
      (typeof location.state?.from === 'string' && location.state.from.includes('reading-queue')) ||
      (typeof document.referrer === 'string' && document.referrer.includes('reading-queue'))
    );
  }, [location.state]);

  // Helper function to get the correct back button text
  const getBackButtonText = useCallback(() => {
    if (text) return text;
    if (isFromReadingQueue) {
      return 'Back to Reading Queue';
    }
    return 'Back to Inbox';
  }, [text, isFromReadingQueue]);

  const handleBack = useCallback(() => {
    log.debug('Navigation state for back action', {
      action: 'navigate_back',
      metadata: {
        locationState: location.state,
        documentReferrer: document.referrer,
        targetRoute,
        preserveFilters,
      },
    });

    // Determine target route
    let finalTargetRoute = targetRoute;
    if (!finalTargetRoute) {
      if (isFromReadingQueue) {
        finalTargetRoute = '/queue';
      } else {
        finalTargetRoute = fallbackRoute;
      }
    }

    // Preserve URL parameters when navigating back
    if (preserveFilters && (finalTargetRoute === '/inbox' || finalTargetRoute === '/queue')) {
      const currentParams = new URLSearchParams();

      // Preserve all existing URL parameters
      for (const [key, value] of searchParams.entries()) {
        currentParams.set(key, value);
      }

      const paramString = currentParams.toString();
      const finalUrl = paramString ? `${finalTargetRoute}?${paramString}` : finalTargetRoute;

      navigate(finalUrl, {
        replace: true,
      });
    } else {
      // Navigate directly without preserving params
      navigate(finalTargetRoute, {
        replace: true,
      });
    }
  }, [navigate, location.state, log, searchParams, targetRoute, fallbackRoute, preserveFilters, isFromReadingQueue]);

  const defaultClasses = "px-4 py-2 text-sm font-medium text-neutral-700 dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 rounded-md flex items-center gap-1.5";

  return (
    <button
      onClick={handleBack}
      className={`${defaultClasses} ${className}`}
    >
      {children || <ArrowLeft className="h-4 w-4" />}
      {getBackButtonText()}
    </button>
  );
});

BackButton.displayName = 'BackButton';

export default BackButton;
