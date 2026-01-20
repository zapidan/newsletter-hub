import React from 'react';

export interface SelectedFiltersDisplayProps {
  selectedGroups: string[];
  groups: { id: string; name: string }[];
  onClearGroup: (groupId: string) => void;
  onClearAll: () => void;
  className?: string;
}

export const SelectedFiltersDisplay: React.FC<SelectedFiltersDisplayProps> = ({
  selectedGroups,
  groups,
  onClearGroup,
  onClearAll,
  className = '',
}) => {
  if (!selectedGroups || selectedGroups.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 mb-2 ${className}`}>
      <span className="text-sm text-gray-600">Groups:</span>
      {selectedGroups.map((groupId) => {
        const group = groups.find((g) => g.id === groupId);
        if (!group) return null;
        return (
          <span
            key={groupId}
            className="inline-flex items-center gap-1 px-2 py-1 bg-neutral-100 text-neutral-800 border border-neutral-200 text-sm rounded-full"
            data-testid={`selected-group-chip-${groupId}`}
          >
            {group.name}
            <button
              type="button"
              onClick={() => onClearGroup(groupId)}
              className="ml-1 text-neutral-600 hover:text-neutral-800"
              aria-label={`Remove ${group.name} filter`}
            >
              ×
            </button>
          </span>
        );
      })}
      {selectedGroups.length > 1 && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
          data-testid="clear-all-groups"
        >
          Clear all
        </button>
      )}
    </div>
  );
};

export default SelectedFiltersDisplay;
