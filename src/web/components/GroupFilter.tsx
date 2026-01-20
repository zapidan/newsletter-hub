import { NewsletterGroup } from '@common/types';
import { ChevronDown } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import GroupBadgeList from './GroupBadgeList';

interface GroupFilterProps {
  groups: NewsletterGroup[];
  activeGroupIds: string[];
  onGroupFilterChange: (groupIds: string[]) => void;
  isLoading?: boolean;
  disabled?: boolean;
  maxVisible?: number;
  className?: string;
}

const GroupFilter: React.FC<GroupFilterProps> = ({
  groups,
  activeGroupIds,
  onGroupFilterChange,
  isLoading = false,
  disabled = false,
  maxVisible = 5,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleGroupClick = useCallback((groupId: string) => {
    if (disabled) return;

    const isActive = activeGroupIds.includes(groupId);
    const newActiveIds = isActive
      ? activeGroupIds.filter(id => id !== groupId)
      : [...activeGroupIds, groupId];

    onGroupFilterChange(newActiveIds);
  }, [activeGroupIds, onGroupFilterChange, disabled]);

  const handleGroupRemove = useCallback((groupId: string) => {
    if (disabled) return;

    const newActiveIds = activeGroupIds.filter(id => id !== groupId);
    onGroupFilterChange(newActiveIds);
  }, [activeGroupIds, onGroupFilterChange, disabled]);

  const handleClearAll = useCallback(() => {
    if (disabled) return;
    onGroupFilterChange([]);
  }, [onGroupFilterChange, disabled]);

  const hasActiveFilters = activeGroupIds.length > 0;
  const visibleGroups = isExpanded ? groups : groups.slice(0, maxVisible);
  const hasMoreGroups = groups.length > maxVisible;

  if (groups.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`} data-testid="group-filter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-gray-700">Groups</h3>
          {hasActiveFilters && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {activeGroupIds.length} active
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            disabled={disabled}
            className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            data-testid="clear-group-filters"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-sm text-gray-500">Loading groups...</span>
        </div>
      )}

      {/* Active filters */}
      {hasActiveFilters && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Active Filters</div>
          <GroupBadgeList
            groups={groups.filter(group => activeGroupIds.includes(group.id))}
            activeGroupIds={activeGroupIds}
            variant="filter"
            size="sm"
            onGroupClick={handleGroupClick}
            onGroupRemove={handleGroupRemove}
          />
        </div>
      )}

      {/* Available groups */}
      {!isLoading && groups.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">
            {hasActiveFilters ? 'More Groups' : 'All Groups'}
          </div>

          <GroupBadgeList
            groups={visibleGroups.filter(group => !activeGroupIds.includes(group.id))}
            activeGroupIds={activeGroupIds}
            variant="default"
            size="sm"
            onGroupClick={handleGroupClick}
            maxVisible={maxVisible}
          />

          {hasMoreGroups && !isExpanded && (
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              disabled={disabled}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="show-more-groups"
            >
              <ChevronDown size={14} />
              Show {groups.length - maxVisible} more groups
            </button>
          )}

          {isExpanded && hasMoreGroups && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              disabled={disabled}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="show-less-groups"
            >
              <ChevronDown size={14} className="rotate-180" />
              Show less
            </button>
          )}
        </div>
      )}

      {/* No groups state */}
      {!isLoading && groups.length === 0 && (
        <div className="text-center py-4 text-sm text-gray-500">
          No groups available. Create your first group to organize newsletters.
        </div>
      )}
    </div>
  );
};

export default GroupFilter;
