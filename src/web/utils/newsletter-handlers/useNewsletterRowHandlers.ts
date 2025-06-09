import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNewsletters } from '@common/hooks';
import { Newsletter } from '@common/types';

/**
 * Custom hook that provides event handlers for newsletter row interactions
 * @returns Object containing handler functions and loading state
 */
export const useNewsletterRowHandlers = () => {
  const navigate = useNavigate();
  const { 
    markAsRead, 
    isMarkingAsRead, 
    isMarkingAsUnread,
    deleteNewsletter,
    isDeletingNewsletter,
    toggleLike,
    isTogglingLike
  } = useNewsletters();

  /**
   * Handles row click - navigates to newsletter detail and marks as read if needed
   * @param newsletter - The newsletter being clicked
   */
  const handleRowClick = useCallback((newsletter: Newsletter) => {
    if (!newsletter.is_read) {
      markAsRead(newsletter.id);
    }
    navigate(`/newsletter/${newsletter.id}`);
  }, [markAsRead, navigate]);

  /**
   * Handles archive action - stops event propagation and deletes the newsletter
   * @param id - Newsletter ID to archive
   * @param e - Mouse event
   */
  const handleArchive = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNewsletter(id);
  }, [deleteNewsletter]);

  /**
   * Handles star/like action - stops event propagation and toggles like status
   * @param id - Newsletter ID to star/unstar
   * @param e - Mouse event
   */
  const handleStar = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleLike(id);
  }, [toggleLike]);

  return {
    handleRowClick,
    handleArchive,
    handleStar,
    isLoading: isMarkingAsRead || isMarkingAsUnread || isDeletingNewsletter || isTogglingLike
  };
};
