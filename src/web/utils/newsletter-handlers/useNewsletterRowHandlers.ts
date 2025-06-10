// import { useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useNewsletters } from '@common/hooks';
// import { Newsletter, NewsletterWithRelations } from '@common/types';

// /**
//  * Custom hook that provides event handlers for newsletter row interactions
//  * @returns Object containing handler functions and loading state
//  */
// export const useNewsletterRowHandlers = () => {
//   const navigate = useNavigate();
//   const { 
//     markAsRead, 
//     isMarkingAsRead, 
//     isMarkingAsUnread,
//     toggleLike,
//     isTogglingLike,
//     newsletters: allNewsletters,
//     // @ts-ignore - These properties are added in the useNewsletters hook
//     deleteNewsletter,
//     // @ts-ignore - These properties are added in the useNewsletters hook
//     isDeletingNewsletter
//   } = useNewsletters();

//   /**
//    * Handles row click - navigates to newsletter detail and marks as read if needed
//    * @param newsletter - The newsletter being clicked
//    */
//   const handleRowClick = useCallback((newsletter: Newsletter) => {
//     if (!newsletter.is_read) {
//       markAsRead(newsletter.id);
//     }
//     navigate(`/newsletter/${newsletter.id}`);
//   }, [markAsRead, navigate]);

//   /**
//    * Handles archive action - stops event propagation and deletes the newsletter
//    * @param id - Newsletter ID to archive
//    * @param e - Mouse event
//    */
//   const handleArchive = useCallback((id: string, e: React.MouseEvent) => {
//     e.stopPropagation();
//     deleteNewsletter(id);
//   }, [deleteNewsletter]);

//   /**
//    * Handles star/like action - stops event propagation and toggles like status
//    * @param id - Newsletter ID to star/unstar
//    * @param e - Mouse event
//    */
//   const handleStar = useCallback((id: string, e: React.MouseEvent) => {
//     e.stopPropagation();
//     const newsletter = allNewsletters?.find((n: NewsletterWithRelations) => n.id === id);
//     if (newsletter) {
//       // Cast to any to handle the type difference between Newsletter and NewsletterWithRelations
//       toggleLike({ id, isLiked: !(newsletter as any).is_liked });
//     }
//   }, [toggleLike, allNewsletters]);

//   return {
//     handleRowClick,
//     handleArchive,
//     handleStar,
//     isLoading: isMarkingAsRead || isMarkingAsUnread || isDeletingNewsletter || isTogglingLike
//   };
// };
