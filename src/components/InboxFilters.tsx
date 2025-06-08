import { FC } from 'react';
import { Archive } from 'lucide-react';
import { SourceFilterDropdown } from './SourceFilterDropdown';
import { TimeFilter, TimeRange } from './TimeFilter';

interface InboxFiltersProps {
  filter: 'all' | 'unread' | 'liked' | 'archived';
  sourceFilter: string | null;
  timeRange: TimeRange;
  newsletterSources: Array<{ id: string; name: string }>;
  onFilterChange: (filter: 'all' | 'unread' | 'liked' | 'archived') => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  onTimeRangeChange: (range: TimeRange) => void;
}

export const InboxFilters: FC<InboxFiltersProps> = ({
  filter,
  sourceFilter,
  timeRange,
  newsletterSources,
  onFilterChange,
  onSourceFilterChange,
  onTimeRangeChange,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <TimeFilter 
          selectedRange={timeRange}
          onChange={onTimeRangeChange}
          className="mr-2"
        />
      <button
        onClick={() => onFilterChange('all')}
        className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
          filter === 'all'
            ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        All
      </button>
      <button
        onClick={() => onFilterChange('unread')}
        className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
          filter === 'unread' 
            ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        Unread
      </button>
      <button
        onClick={() => onFilterChange('liked')}
        className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
          filter === 'liked' 
            ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        Liked
      </button>
      <button
        onClick={() => onFilterChange('archived')}
        className={`px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
          filter === 'archived'
            ? 'bg-primary-600 text-white shadow-sm hover:bg-primary-700' 
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
        }`}
      >
        <div className="flex items-center gap-1">
          <Archive className="h-4 w-4" />
          <span>Archived</span>
        </div>
      </button>
        <SourceFilterDropdown 
          sources={newsletterSources}
          selectedSourceId={sourceFilter}
          onSourceSelect={onSourceFilterChange}
          className="ml-2"
        />
      </div>
    </div>
  );
};
