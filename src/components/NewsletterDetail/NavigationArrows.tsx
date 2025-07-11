import { ChevronLeft, ChevronRight } from 'lucide-react';
import React from 'react';

interface NavigationArrowsProps {
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  isLoading?: boolean;
  className?: string;
}

export const NavigationArrows: React.FC<NavigationArrowsProps> = ({
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
  isLoading = false,
  className = '',
}) => {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      {/* Previous Arrow */}
      <button
        onClick={onPrevious}
        disabled={!hasPrevious || isLoading}
        className={`
          p-2 rounded-lg transition-all
          ${hasPrevious && !isLoading
            ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200'
            : 'text-gray-300 cursor-not-allowed'
          }
        `}
        title={hasPrevious ? 'Previous newsletter' : 'No previous newsletter'}
        aria-label="Navigate to previous newsletter"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Next Arrow */}
      <button
        onClick={onNext}
        disabled={!hasNext || isLoading}
        className={`
          p-2 rounded-lg transition-all
          ${hasNext && !isLoading
            ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200'
            : 'text-gray-300 cursor-not-allowed'
          }
        `}
        title={hasNext ? 'Next newsletter' : 'No next newsletter'}
        aria-label="Navigate to next newsletter"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
};

export default NavigationArrows;
