import { Archive, ArchiveX, Trash } from 'lucide-react';
import { FC } from 'react';

type BulkSelectionActionsProps = {
  selectedCount: number;
  totalCount: number;
  showArchived: boolean;
  isBulkActionLoading: boolean;
  onSelectAll: () => void;
  onSelectRead: () => void;
  onSelectUnread: () => void;
  onMarkAsRead: () => void;
  onMarkAsUnread: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onCancel: () => void;
};

const BulkSelectionActions: FC<BulkSelectionActionsProps> = ({
  selectedCount,
  totalCount,
  showArchived,
  isBulkActionLoading,
  onSelectAll,
  onSelectRead,
  onSelectUnread,
  onMarkAsRead,
  onMarkAsUnread,
  onArchive,
  onUnarchive,
  onDelete,
  onCancel,
}) => (
  <div className="w-full bg-blue-50 px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between w-full">
      <div className="flex flex-wrap items-center gap-3 justify-center w-full sm:w-auto">
        <span className="text-sm text-gray-700">{selectedCount} selected</span>
        <div className="flex flex-wrap items-center gap-2 justify-center">
          <button
            onClick={onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-100 rounded"
          >
            {selectedCount === totalCount ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={onSelectRead}
            className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-100 rounded"
          >
            Select Read
          </button>
          <button
            onClick={onSelectUnread}
            className="text-sm text-blue-600 hover:text-blue-700 px-2 py-1 hover:bg-blue-100 rounded"
          >
            Select Unread
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 justify-center w-full sm:w-auto mt-2 sm:mt-0">
        <button
          onClick={onMarkAsRead}
          disabled={selectedCount === 0}
          className="px-3 py-1 bg-green-100 text-gray-800 rounded text-sm hover:bg-green-200 disabled:opacity-50"
        >
          Mark as Read
        </button>
        <button
          onClick={onMarkAsUnread}
          disabled={selectedCount === 0}
          className="px-3 py-1 bg-blue-100 text-gray-800 rounded text-sm hover:bg-blue-200 disabled:opacity-50"
        >
          Mark as Unread
        </button>
        {showArchived ? (
          <>
            <button
              onClick={onUnarchive}
              disabled={selectedCount === 0 || isBulkActionLoading}
              className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200 disabled:opacity-50 flex items-center gap-1"
            >
              <ArchiveX className="h-4 w-4" />
              <span>Unarchive</span>
            </button>
            <button
              onClick={onDelete}
              disabled={selectedCount === 0 || isBulkActionLoading}
              className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200 disabled:opacity-50 flex items-center gap-1"
              title="Delete selected permanently"
            >
              <Trash className="h-4 w-4" />
              <span>Trash</span>
            </button>
          </>
        ) : (
          <button
            onClick={onArchive}
            disabled={selectedCount === 0 || isBulkActionLoading}
            className="px-3 py-1 bg-amber-100 text-amber-800 rounded text-sm hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1"
          >
            <Archive className="h-4 w-4" />
            <span>Archive</span>
          </button>
        )}
        <button
          onClick={onCancel}
          className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm ml-2"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

export default BulkSelectionActions;
