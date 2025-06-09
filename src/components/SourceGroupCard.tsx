import { Link } from 'react-router-dom';
import { Folder, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { useState } from 'react';
import { useNewsletterSourceGroups } from '../hooks/useNewsletterSourceGroups';
import { NewsletterSourceGroup } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

interface SourceGroupCardProps {
  group: NewsletterSourceGroup;
  onEdit: (group: NewsletterSourceGroup) => void;
  isAnyModalOpen?: boolean;
}

export const SourceGroupCard = ({ group, onEdit, isAnyModalOpen = false }: SourceGroupCardProps) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const { deleteGroup } = useNewsletterSourceGroups();
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setShowDropdown(false));

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)) {
      try {
        await deleteGroup.mutateAsync(group.id);
      } catch (error) {
        console.error('Failed to delete group:', error);
      }
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onEdit(group);
  };

  // Debug output - visible in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] SourceGroupCard ${group.id} - isAnyModalOpen:`, isAnyModalOpen);
  }

  return (
    <div className="relative">
      {/* Debug overlay - always visible for now */}
      <div className="absolute -top-5 left-0 bg-red-500 text-white text-xs px-2 py-0.5 rounded-t-md z-50">
        Modal: {String(isAnyModalOpen)}
      </div>
      <Link
        to={`/inbox?group=${group.id}`}
        className="group relative flex flex-col p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-200 hover:shadow-md transition-all duration-200 overflow-hidden"
      >
      {!isAnyModalOpen ? (
        <div className="absolute top-2 right-2">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            aria-label="Group options"
          >
            <MoreHorizontal size={18} />
          </button>
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-40"
            >
              <div className="py-1">
                <button
                  onClick={handleEdit}
                  className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Edit size={16} className="mr-2 text-gray-500" />
                  Edit Group
                </button>
                <button
                  onClick={handleDelete}
                  className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
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
        <div className="p-3 mb-3 bg-blue-100 rounded-full text-blue-600">
          <Folder size={24} />
        </div>
        <h3 className="font-medium text-gray-900 mb-1">{group.name}</h3>
        <p className="text-sm text-gray-500">
          {group._count?.sources || group.sources?.length || 0} 
          {group._count?.sources === 1 || group.sources?.length === 1 ? 'source' : 'sources'}
        </p>
      </div>
      
      {group.sources && group.sources.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 font-medium mb-1">Includes:</p>
          <div className="space-y-1">
            {group.sources.slice(0, 3).map((source) => (
              <div key={source.id} className="flex items-center">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-xs text-gray-600 truncate">
                  {source.name}
                </span>
              </div>
            ))}
            {group.sources.length > 3 && (
              <div className="text-xs text-gray-400">
                +{group.sources.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}
      </Link>
    </div>
  );
};
