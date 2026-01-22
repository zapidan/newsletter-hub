import { useClickOutside } from "@common/hooks/useClickOutside";
import { useNewsletterSourceGroups } from "@common/hooks/useNewsletterSourceGroups";
import { NewsletterSourceGroup } from "@common/types";
import { useLogger } from "@common/utils/logger/useLogger";
import { Edit, Folder, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";

interface SourceGroupCardProps {
  group: NewsletterSourceGroup;
  onEdit: (group: NewsletterSourceGroup) => void;
  onDelete?: (groupId: string) => void;
  isAnyModalOpen?: boolean;
  // Remove isSelected and onClick props
}

export const SourceGroupCard = ({
  group,
  onEdit,
  onDelete,
  isAnyModalOpen = false,
  // Remove isSelected and onClick props
}: SourceGroupCardProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { deleteGroup } = useNewsletterSourceGroups();
  const log = useLogger();
  const dropdownRef = useClickOutside<HTMLDivElement>(() =>
    setShowDropdown(false),
  );

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (
      window.confirm(
        `Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`,
      )
    ) {
      try {
        await deleteGroup.mutateAsync(group.id);
        // Call onDelete callback if provided
        onDelete?.(group.id);
      } catch (error) {
        log.error(
          "Failed to delete source group",
          {
            action: "delete_source_group",
            metadata: {
              groupId: group.id,
              groupName: group.name,
            },
          },
          error as Error,
        );
        throw error; // Re-throw to allow error handling in the parent
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(group);
  };

  // Debug output - visible in development
  if (process.env.NODE_ENV === "development") {
    log.debug("SourceGroupCard debug info", {
      action: "debug_component_state",
      metadata: {
        groupId: group.id,
        isAnyModalOpen,
      },
    });
  }

  // Remove handleClick

  return (
    <div className="relative">
      <div
        // Remove onClick handler and cursor-pointer class
        className={`group relative flex flex-col p-4 bg-white dark:bg-neutral-900 rounded-lg border transition-all duration-200 overflow-hidden
          border-gray-200 dark:border-neutral-800 hover:border-blue-200 dark:hover:border-neutral-700 hover:shadow-md`}
      >
        {!isAnyModalOpen ? (
          <div className="absolute top-2 right-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="p-1 text-gray-400 dark:text-slate-300 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800/60"
              aria-label="Group options"
            >
              <MoreHorizontal size={18} />
            </button>
            {showDropdown && (
              <div
                ref={dropdownRef}
                className="absolute right-0 mt-1 w-40 bg-white dark:bg-neutral-900 rounded-md shadow-lg ring-1 ring-black/5 dark:ring-white/10 z-40 border border-slate-200/60 dark:border-neutral-800"
              >
                <div className="py-1">
                  <button
                    onClick={handleEdit}
                    className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-neutral-800/60"
                  >
                    <Edit size={16} className="mr-2 text-gray-500 dark:text-slate-300" />
                    Edit Group
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-neutral-800/60"
                  >
                    <Trash2 size={16} className="mr-2" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex flex-col items-center text-center">
          <div className="p-3 mb-3 bg-blue-100 dark:bg-blue-900/40 rounded-full text-blue-600 dark:text-blue-200">
            <Folder size={24} />
          </div>
          <h3 className="font-medium text-gray-900 dark:text-slate-100 mb-1">{group.name}</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {group._count?.sources || group.sources?.length || 0}
            {group._count?.sources === 1 || group.sources?.length === 1
              ? " source"
              : " sources"}
          </p>
        </div>

        {group.sources && group.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-neutral-800">
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium mb-1">Includes:</p>
            <div className="space-y-1">
              {group.sources.slice(0, 3).map((source) => (
                <div key={source.id} className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                  <span className="text-xs text-gray-600 dark:text-slate-300 truncate">
                    {source.name}
                  </span>
                </div>
              ))}
              {group.sources.length > 3 && (
                <div className="text-xs text-gray-400 dark:text-slate-500">
                  +{group.sources.length - 3} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
