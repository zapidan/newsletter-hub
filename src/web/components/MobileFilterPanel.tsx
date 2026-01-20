import type { InboxFilterType } from '@common/hooks/useInboxFilters';
import { Building2, ChevronDown, ChevronUp, Clock, Tag, X } from 'lucide-react';
import React, { useState } from 'react';
import type { NewsletterSourceWithCount, TimeRange } from './InboxFilters';

export interface MobileFilterPanelProps {
  // Current filter state
  filter: InboxFilterType;
  sourceFilter: string | null;
  groupFilters: string[];
  timeRange: TimeRange;

  // Available options
  newsletterSources: NewsletterSourceWithCount[];
  newsletterGroups: { id: string; name: string; count?: number }[];

  // Actions
  onFilterChange: (filter: InboxFilterType) => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  onGroupFiltersChange: (groupIds: string[]) => void;
  onTimeRangeChange: (range: TimeRange) => void;

  // UI state
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onClearAll: () => void;

  // Loading states
  isLoadingSources?: boolean;
  isLoadingGroups?: boolean;
  disabled?: boolean;
}

const FILTER_OPTIONS = [
  { value: 'unread' as const, label: 'Unread' },
  { value: 'read' as const, label: 'Read' },
  { value: 'liked' as const, label: 'Liked' },
  { value: 'archived' as const, label: 'Archived' },
];

const TIME_RANGE_OPTIONS = [
  { value: 'all' as const, label: 'All Time' },
  { value: 'day' as const, label: 'Today' },
  { value: '2days' as const, label: '2 Days' },
  { value: 'week' as const, label: 'This Week' },
  { value: 'month' as const, label: 'This Month' },
];

export const MobileFilterPanel: React.FC<MobileFilterPanelProps> = ({
  filter,
  sourceFilter,
  groupFilters,
  timeRange,
  newsletterSources,
  newsletterGroups,
  onFilterChange,
  onSourceFilterChange,
  onGroupFiltersChange,
  onTimeRangeChange,
  isOpen,
  onClose,
  onApply,
  onClearAll,
  isLoadingSources = false,
  isLoadingGroups = false,
  disabled = false,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    status: true,
    source: false,
    group: false,
    time: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleGroupToggle = (groupId: string) => {
    const newGroups = groupFilters.includes(groupId)
      ? groupFilters.filter(id => id !== groupId)
      : [...groupFilters, groupId];
    onGroupFiltersChange(newGroups);
  };

  const handleClearAll = () => {
    onClearAll();
    onClose();
  };

  const handleApply = () => {
    onApply();
    onClose();
  };

  const hasActiveFilters = filter !== 'unread' || sourceFilter !== null || groupFilters.length > 0 || timeRange !== 'all';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-full"
          aria-label="Close filters"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Filter Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Status Filters */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('status')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <span className="font-medium text-gray-900">Status</span>
            {expandedSections.status ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
          </button>

          {expandedSections.status && (
            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-2">
                {FILTER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onFilterChange(option.value)}
                    disabled={disabled}
                    className={`
                      px-3 py-2 text-sm rounded-lg font-medium transition-colors
                      ${filter === option.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Source Filter */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('source')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            disabled={groupFilters.length > 0}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">Source</span>
            </div>
            <div className="flex items-center gap-2">
              {sourceFilter && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                  {newsletterSources.find(s => s.id === sourceFilter)?.name || 'Selected'}
                </span>
              )}
              {groupFilters.length > 0 ? (
                <ChevronDown className="h-5 w-5 text-gray-300" />
              ) : expandedSections.source ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </button>

          {expandedSections.source && groupFilters.length === 0 && (
            <div className="px-4 pb-4">
              {isLoadingSources ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-primary-600" />
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <button
                    onClick={() => onSourceFilterChange(null)}
                    disabled={disabled}
                    className={`
                      w-full text-left px-3 py-2 text-sm rounded-lg transition-colors
                      ${!sourceFilter
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    All Sources
                  </button>
                  {newsletterSources.map((source) => (
                    <button
                      key={source.id}
                      onClick={() => onSourceFilterChange(source.id)}
                      disabled={disabled}
                      className={`
                        w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between
                        ${sourceFilter === source.id
                          ? 'bg-primary-100 text-primary-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                    >
                      <span className="truncate">{source.name}</span>
                      {source.count !== undefined && source.count > 0 && (
                        <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full ml-2">
                          {source.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Group Filters */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('group')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
            disabled={sourceFilter !== null}
          >
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">Groups</span>
            </div>
            <div className="flex items-center gap-2">
              {groupFilters.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {groupFilters.length} selected
                </span>
              )}
              {sourceFilter !== null ? (
                <ChevronDown className="h-5 w-5 text-gray-300" />
              ) : expandedSections.group ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </button>

          {expandedSections.group && sourceFilter === null && (
            <div className="px-4 pb-4">
              {isLoadingGroups ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-primary-600" />
                </div>
              ) : (
                <>
                  <button
                    onClick={() => onGroupFiltersChange([])}
                    disabled={disabled}
                    className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg mb-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear All Groups
                  </button>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {newsletterGroups.map((group) => {
                      const isSelected = groupFilters.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          onClick={() => handleGroupToggle(group.id)}
                          disabled={disabled}
                          className={`
                            w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center justify-between
                            ${isSelected
                              ? 'bg-blue-100 text-blue-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                            }
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                        >
                          <span className="truncate">{group.name}</span>
                          <div className="flex items-center gap-2">
                            {group.count !== undefined && group.count > 0 && (
                              <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full">
                                {group.count}
                              </span>
                            )}
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'bg-white border-gray-300'
                              }`}>
                              {isSelected && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Time Range Filter */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => toggleSection('time')}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-900">Time Range</span>
            </div>
            <div className="flex items-center gap-2">
              {timeRange !== 'all' && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                  {TIME_RANGE_OPTIONS.find(opt => opt.value === timeRange)?.label}
                </span>
              )}
              {expandedSections.time ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </button>

          {expandedSections.time && (
            <div className="px-4 pb-4">
              <div className="space-y-2">
                {TIME_RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onTimeRangeChange(option.value)}
                    disabled={disabled}
                    className={`
                      w-full text-left px-3 py-2 text-sm rounded-lg transition-colors
                      ${timeRange === option.value
                        ? 'bg-green-100 text-green-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex gap-3">
          <button
            onClick={handleClearAll}
            disabled={!hasActiveFilters || disabled}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
          <button
            onClick={handleApply}
            disabled={disabled}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply Filters
          </button>
        </div>
        {hasActiveFilters && (
          <div className="mt-3 text-xs text-gray-500 text-center">
            {filter !== 'unread' && 'Status • '}
            {sourceFilter && 'Source • '}
            {groupFilters.length > 0 && `${groupFilters.length} Groups • `}
            {timeRange !== 'all' && 'Time Range'}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileFilterPanel;
