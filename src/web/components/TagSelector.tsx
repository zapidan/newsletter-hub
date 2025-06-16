import { useState, useEffect, useCallback, useRef } from "react";
import type { Tag } from "@common/types";
import { useTags } from "@common/hooks/useTags";
import { Plus, X, Trash2 } from "lucide-react";

type TagSelectorProps = {
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  onTagDeleted?: (deletedTag: Tag) => void;
  onTagClick?: (tag: Tag, e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
};

const colors = [
  "#3b82f6", // blue-500
  "#ef4444", // red-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
];

export default function TagSelector({
  selectedTags,
  onTagsChange,
  onTagDeleted,
  onTagClick,
  className = "",
  disabled = false,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(colors[0]);
  const { getTags, createTag, deleteTag } = useTags();
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      const tags = await getTags();
      setAvailableTags(tags);
    };
    loadTags();
  }, [getTags]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (isOpen && event.key === "Escape") {
        setIsOpen(false);
      }
    };

    // Only add event listeners if the dropdown is open
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);

      // Cleanup function to remove event listeners
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen]);

  const handleAddTag = useCallback(async () => {
    if (!newTagName.trim()) return;

    try {
      // Check if tag already exists
      const existingTag = availableTags.find(
        (tag) => tag.name.toLowerCase() === newTagName.toLowerCase(),
      );

      if (existingTag) {
        // Add existing tag if not already selected
        if (!selectedTags.some((tag) => tag.id === existingTag.id)) {
          onTagsChange([...selectedTags, existingTag]);
        }
      } else {
        // Create new tag
        const newTag = await createTag({
          name: newTagName.trim(),
          color: selectedColor,
        });

        if (newTag) {
          setAvailableTags((prev) => [...prev, newTag]);
          onTagsChange([...selectedTags, newTag]);
        }
      }

      setNewTagName("");
      setIsOpen(false);
    } catch (error) {
      console.error("Error adding tag:", error);
    }
  }, [
    newTagName,
    selectedColor,
    availableTags,
    selectedTags,
    onTagsChange,
    createTag,
  ]);

  const handleRemoveTag = useCallback(
    (tagId: string) => {
      onTagsChange(selectedTags.filter((tag) => tag.id !== tagId));
    },
    [selectedTags, onTagsChange],
  );

  const handleDeleteTag = useCallback(
    async (tagId: string, tagName: string) => {
      if (
        !window.confirm(
          `Are you sure you want to delete the tag "${tagName}"? This action cannot be undone.`,
        )
      ) {
        return;
      }

      try {
        const tagToDelete = availableTags.find((tag) => tag.id === tagId);
        if (!tagToDelete) return;

        const success = await deleteTag(tagId);
        if (success) {
          // Update local state
          setAvailableTags((prev) => prev.filter((tag) => tag.id !== tagId));

          // Remove from selected tags if it's selected
          const wasSelected = selectedTags.some((tag) => tag.id === tagId);
          if (wasSelected) {
            const newSelectedTags = selectedTags.filter(
              (tag) => tag.id !== tagId,
            );
            onTagsChange(newSelectedTags);
          }

          // Notify parent component
          onTagDeleted?.(tagToDelete);
        }
      } catch (err) {
        console.error("Failed to delete tag:", err);
        alert("Failed to delete tag. Please try again.");
      }
    },
    [deleteTag, selectedTags, onTagsChange, onTagDeleted, availableTags],
  );

  const toggleTag = useCallback(
    (tag: Tag) => {
      const isSelected = selectedTags.some((t) => t.id === tag.id);
      if (isSelected) {
        handleRemoveTag(tag.id);
      } else {
        onTagsChange([...selectedTags, tag]);
      }
      setIsOpen(false);
    },
    [selectedTags, onTagsChange, handleRemoveTag],
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={`flex flex-wrap items-center gap-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        {selectedTags.map((tag) => (
          <div
            key={tag.id}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2 mb-2 ${onTagClick ? "cursor-pointer hover:opacity-80" : ""}`}
            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
            onClick={onTagClick ? (e) => onTagClick(tag, e) : undefined}
          >
            {tag.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag.id);
              }}
              className="ml-1 text-gray-400 hover:text-gray-600"
              title="Remove tag"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200"
        >
          <Plus size={14} className="mr-1" />
          Add Tag
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200">
          <div className="p-3 border-b">
            <div className="flex items-center mb-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                placeholder="Create new tag"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!newTagName.trim()}
                className="ml-2 px-2 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-5 h-5 rounded-full border-2 ${selectedColor === color ? "border-gray-800" : "border-transparent"}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                  title={color}
                />
              ))}
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {availableTags.filter(
              (tag) => !selectedTags.some((t) => t.id === tag.id),
            ).length > 0 ? (
              <div className="p-1">
                {availableTags
                  .filter((tag) => !selectedTags.some((t) => t.id === tag.id))
                  .map((tag) => (
                    <div
                      key={`tag-${tag.id}`}
                      className="group flex items-center justify-between w-full hover:bg-gray-100"
                    >
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="flex-1 text-left px-3 py-2 text-sm flex items-center"
                      >
                        <span
                          className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTag(tag.id, tag.name);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title={`Delete ${tag.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-3 text-center text-sm text-gray-500">
                No tags available. Create one above.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
