import { NewsletterGroup } from '@common/types';
import { Plus } from 'lucide-react';
import React from 'react';
import GroupBadge from './GroupBadge';

interface GroupBadgeListProps {
  groups: NewsletterGroup[];
  activeGroupIds?: string[];
  variant?: 'default' | 'filter' | 'preview';
  size?: 'sm' | 'md' | 'lg';
  maxVisible?: number;
  onGroupClick?: (groupId: string) => void;
  onGroupRemove?: (groupId: string) => void;
  onAddGroup?: () => void;
  showAddButton?: boolean;
  className?: string;
}

const GroupBadgeList: React.FC<GroupBadgeListProps> = ({
  groups,
  activeGroupIds = [],
  variant = 'default',
  size = 'sm',
  maxVisible = 5,
  onGroupClick,
  onGroupRemove,
  onAddGroup,
  showAddButton = false,
  className = '',
}) => {
  const visibleGroups = groups.slice(0, maxVisible);
  const hasMore = groups.length > maxVisible;
  const remainingCount = groups.length - maxVisible;

  const handleGroupClick = (groupId: string) => {
    if (onGroupClick) {
      onGroupClick(groupId);
    }
  };

  const handleGroupRemove = (groupId: string) => {
    if (onGroupRemove) {
      onGroupRemove(groupId);
    }
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1 ${className}`}
      data-testid="group-badge-list"
    >
      {visibleGroups.map((group) => (
        <GroupBadge
          key={group.id}
          id={group.id}
          name={group.name}
          color={group.color}
          isActive={activeGroupIds.includes(group.id)}
          isClickable={!!onGroupClick}
          onClick={handleGroupClick}
          onRemove={variant === 'filter' ? handleGroupRemove : undefined}
          size={size}
          variant={variant}
        />
      ))}

      {hasMore && (
        <span
          className={`
            inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium
            bg-gray-100 text-gray-600 border border-gray-200
            ${size === 'sm' ? 'px-2 py-0.5 text-xs' : ''}
            ${size === 'md' ? 'px-3 py-1 text-sm' : ''}
            ${size === 'lg' ? 'px-4 py-1.5 text-base' : ''}
          `}
          title={`+${remainingCount} more groups`}
        >
          +{remainingCount}
        </span>
      )}

      {showAddButton && onAddGroup && (
        <button
          type="button"
          onClick={onAddGroup}
          className={`
            inline-flex items-center rounded-full border-2 border-dashed border-gray-300
            text-gray-500 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50
            transition-all duration-200
            ${size === 'sm' ? 'px-2 py-0.5 text-xs' : ''}
            ${size === 'md' ? 'px-3 py-1 text-sm' : ''}
            ${size === 'lg' ? 'px-4 py-1.5 text-base' : ''}
          `}
          title="Add group filter"
          data-testid="add-group-filter-button"
        >
          <Plus size={size === 'sm' ? 10 : size === 'md' ? 12 : 14} />
          <span className="ml-1">Group</span>
        </button>
      )}
    </div>
  );
};

export default GroupBadgeList;
