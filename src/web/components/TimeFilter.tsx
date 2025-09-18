import { Clock } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';

export type TimeRange = 'day' | '2days' | 'week' | 'month' | 'last7' | 'last30' | 'all';

interface TimeFilterProps {
  selectedRange: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

export const TimeFilter: FC<TimeFilterProps> = ({
  selectedRange,
  onChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options: { value: TimeRange; label: string }[] = [
    { value: 'day', label: 'Today' },
    { value: '2days', label: 'Last 2 days' },
    { value: 'last7', label: 'Last 7 days' },
    { value: 'week', label: 'This week' },
    { value: 'last30', label: 'Last 30 days' },
    { value: 'month', label: 'This month' },
    { value: 'all', label: 'All time' },
  ];

  const selectedLabel = options.find(opt => opt.value === selectedRange)?.label || 'All time';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (range: TimeRange) => {
    onChange(range);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800 rounded-full transition-colors duration-200"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Clock className="h-4 w-4" />
        <span className="ml-1">{selectedLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-40 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left px-4 py-2 text-sm ${selectedRange === option.value
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
