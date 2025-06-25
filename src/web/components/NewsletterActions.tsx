import { NewsletterWithRelations } from "@common/types";
import { useLogger } from "@common/utils/logger/useLogger";
import {
  Archive, ArchiveX, Eye, EyeOff, Heart, Trash, MoreVertical, BookmarkPlus, BookmarkMinus, Loader2
} from "lucide-react"; // Added MoreVertical, BookmarkPlus, BookmarkMinus, Loader2
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface NewsletterActionsProps {
  newsletter: NewsletterWithRelations;
  onToggleLike: (newsletter: NewsletterWithRelations) => Promise<void>;
  onToggleArchive: (id: string) => Promise<void>;
  onToggleRead: (id: string) => Promise<void>;
  onTrash: (id: string) => void;
  onToggleQueue?: (newsletterId: string) => Promise<void>; // Made optional for broader use
  loadingStates?: Record<string, string>; // newsletterId_action: 'loading' | 'success' | 'error'
  errorTogglingLike?: Error | null; // Specific error for like, can be expanded
  isInReadingQueue?: boolean; // Made optional
  showTrashButton?: boolean;
  showQueueButton?: boolean;
  showReadButton?: boolean;
  compact?: boolean;
  isMobile?: boolean; // New prop for mobile optimizations
}

// Reusable ActionButton component
const ActionButton: React.FC<{
  title: string;
  onClick: (e: React.MouseEvent) => void;
  isLoading?: boolean;
  className?: string;
  icon: React.ReactNode;
  baseClass: string; // Pass base class for consistency
  iconSizeClass: string; // Pass icon size class
  isMenuItem?: boolean; // For styling if inside a dropdown menu
}> = ({ title, onClick, isLoading, className = "", icon, baseClass, iconSizeClass, isMenuItem = false }) => (
  <button
    type="button"
    className={`${isMenuItem ? 'w-full text-left px-3 py-2 text-sm hover:bg-gray-100' : baseClass} ${className} flex items-center gap-2`}
    onClick={onClick}
    disabled={isLoading}
    title={title}
  >
    {isLoading ? <Loader2 className={`${iconSizeClass} animate-spin`} /> : icon}
    {isMenuItem && <span>{title}</span>}
  </button>
);


const NewsletterActions: React.FC<NewsletterActionsProps> = ({
  newsletter,
  onToggleLike,
  onToggleArchive,
  onToggleRead,
  onTrash,
  onToggleQueue,
  loadingStates = {},
  errorTogglingLike,
  isInReadingQueue = false,
  showTrashButton = true,
  showQueueButton = true,
  showReadButton = true,
  compact = false,
  isMobile = false,
}) => {
  const log = useLogger("NewsletterActions");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Use a map for isLoading state for individual actions
  const [actionLoadingStates, setActionLoadingStates] = useState<Record<string, boolean>>({});

  const handleActionClick = async (actionName: string, actionFn: () => Promise<void> | void, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (actionLoadingStates[actionName]) return;

    setActionLoadingStates(prev => ({ ...prev, [actionName]: true }));
    log.debug(`Performing action: ${actionName}`, { action: `action_${actionName}`, metadata: { newsletterId: newsletter.id } });
    try {
      await actionFn();
    } catch (error) {
      log.error(`Error performing action: ${actionName}`, { action: `action_error_${actionName}`, metadata: { newsletterId: newsletter.id } }, error instanceof Error ? error : new Error(String(error)));
    } finally {
      setActionLoadingStates(prev => ({ ...prev, [actionName]: false }));
      if (isMobile) setShowMoreMenu(false);
    }
  };


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMoreMenu]);

  const baseButtonClass = compact ? "btn btn-ghost btn-xs p-1.5 rounded-md hover:bg-gray-200/70 transition-all" : "btn btn-ghost btn-sm p-2 rounded-lg hover:bg-gray-200/70 transition-all";
  const iconSizeClass = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  // Centralized loading check
  const isLoading = (action: string) => actionLoadingStates[action] || loadingStates[`${newsletter.id}_${action}`] === 'loading';


  const likeAction = {
    name: "like",
    title: newsletter.is_liked ? "Unlike" : "Like",
    icon: <Heart className={`${iconSizeClass} ${newsletter.is_liked ? "text-red-500 fill-current" : "text-gray-500 hover:text-red-500"}`} />,
    fn: () => onToggleLike(newsletter),
    className: newsletter.is_liked ? "text-red-500 hover:text-red-600" : "text-gray-500 hover:text-red-500",
  };

  const readAction = {
    name: "read",
    title: newsletter.is_read ? "Mark as unread" : "Mark as read",
    icon: newsletter.is_read ? <EyeOff className={`${iconSizeClass} text-gray-500`} /> : <Eye className={`${iconSizeClass} text-blue-500`} />,
    fn: () => onToggleRead(newsletter.id),
    show: showReadButton,
    className: "text-gray-500",
  };

  const archiveAction = {
    name: "archive",
    title: newsletter.is_archived ? "Unarchive" : "Archive",
    icon: newsletter.is_archived ? <ArchiveX className={`${iconSizeClass} text-green-600`} /> : <Archive className={`${iconSizeClass} text-amber-600`} />,
    fn: () => onToggleArchive(newsletter.id),
    className: newsletter.is_archived ? "text-green-600" : "text-amber-600",
  };

  const queueAction = {
    name: "queue",
    title: isInReadingQueue ? "Remove from Queue" : "Add to Queue",
    icon: isInReadingQueue ? <BookmarkMinus className={`${iconSizeClass} text-yellow-500 fill-current`} /> : <BookmarkPlus className={`${iconSizeClass} text-gray-500 hover:text-yellow-500`} />,
    fn: () => onToggleQueue?.(newsletter.id),
    show: showQueueButton && onToggleQueue,
    className: isInReadingQueue ? "text-yellow-500 hover:text-yellow-600" : "text-gray-500 hover:text-yellow-500",
  };

  const trashAction = {
    name: "trash",
    title: "Delete Permanently",
    icon: <Trash className={`${iconSizeClass} text-gray-500 hover:text-red-500`} />,
    fn: () => onTrash(newsletter.id),
    show: showTrashButton && newsletter.is_archived, // Only show trash for archived items
    className: "text-gray-500 hover:text-red-500",
  };

  const allActions = [likeAction, readAction, archiveAction, queueAction, trashAction].filter(a => a.show !== false);
  const primaryActions = isMobile ? [likeAction] : allActions; // On mobile, only Like is primary. All others in menu.
  const menuActions = isMobile ? allActions.filter(a => a.name !== 'like') : []; // Actions for the "More" menu on mobile

  if (errorTogglingLike) {
    log.error("Error toggling like passed to NewsletterActions", { action: "error_toggle_like_prop", metadata: { newsletterId: newsletter.id } }, errorTogglingLike);
  }

  return (
    <div className={`flex items-center ${compact ? "gap-0.5" : "gap-1"}`} onClick={(e) => e.stopPropagation()}>
      {primaryActions.map(action => (
        <ActionButton
          key={action.name}
          title={action.title}
          onClick={(e) => handleActionClick(action.name, action.fn, e)}
          isLoading={isLoading(action.name)}
          icon={action.icon}
          baseClass={baseButtonClass}
          iconSizeClass={iconSizeClass}
          className={action.className}
        />
      ))}

      {isMobile && menuActions.length > 0 && (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className={`${baseButtonClass} ${showMoreMenu ? 'bg-gray-200/80 text-primary-600' : 'text-gray-500'}`}
            onClick={(e) => { e.stopPropagation(); setShowMoreMenu(!showMoreMenu); }}
            aria-haspopup="true"
            aria-expanded={showMoreMenu}
            title="More actions"
          >
            <MoreVertical className={iconSizeClass} />
          </button>
          <AnimatePresence>
            {showMoreMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 mt-1.5 w-48 bg-white rounded-md shadow-xl border border-gray-200/70 z-30 py-1"
              >
                {menuActions.map(action => (
                   <ActionButton
                    key={action.name}
                    title={action.title}
                    onClick={(e) => handleActionClick(action.name, action.fn, e)}
                    isLoading={isLoading(action.name)}
                    icon={action.icon}
                    baseClass={baseButtonClass} // Base class is for non-menu items, direct styling for menu items
                    iconSizeClass={iconSizeClass}
                    className={action.className} // This will be for icon color primarily
                    isMenuItem={true}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {errorTogglingLike && !isMobile && ( // Only show error text on desktop if needed
        <div className="text-red-500 text-xs ml-1" title="Error toggling like">⚠️</div>
      )}
    </div>
  );
};

export default NewsletterActions;
