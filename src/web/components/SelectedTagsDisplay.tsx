import React, { memo } from 'react';

// Define the props for the component
interface SelectedTagsDisplayProps {
  selectedTags: Array<{ id: string; name: string; color: string }>;
  onRemoveTag: (tagId: string) => void;
  onClearAll: () => void;
}

// SelectedTagsDisplay component
const SelectedTagsDisplay: React.FC<SelectedTagsDisplayProps> = memo(
  ({ selectedTags, onRemoveTag, onClearAll }) => {
    if (selectedTags.length === 0) return null;

    return (
      <div className="px-6 pt-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-900">
              Active Tag Filters ({selectedTags.length})
            </h3>
            <button
              onClick={onClearAll}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              Clear all filters
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium cursor-pointer hover:opacity-80"
                style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
              >
                {tag.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveTag(tag.id);
                  }}
                  className="ml-1.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                  title="Remove this filter"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Showing newsletters matching{' '}
            {selectedTags.length === 1 ? 'this tag' : 'any of these tags'}. Click tag names in
            newsletter rows to add more filters.
          </p>
        </div>
      </div>
    );
  }
);

SelectedTagsDisplay.displayName = 'SelectedTagsDisplay';

export default SelectedTagsDisplay;
