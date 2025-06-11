import { supabase } from '@common/services/supabaseClient';

export const updateNewsletterTags = async (
  newsletterId: string,
  tagIds: string[],
  currentTagIds: string[],
  userId: string
) => {
  const tagsToAdd = tagIds.filter((id) => !currentTagIds.includes(id));
  const tagsToRemove = currentTagIds.filter((id) => !tagIds.includes(id));

  // Remove tags that are no longer selected
  if (tagsToRemove.length > 0) {
    const { error: removeError } = await supabase
      .from('newsletter_tags')
      .delete()
      .in('tag_id', tagsToRemove)
      .eq('newsletter_id', newsletterId);

    if (removeError) throw removeError;
  }

  // Add new tags
  if (tagsToAdd.length > 0) {
    const { error: addError } = await supabase
      .from('newsletter_tags')
      .insert(
        tagsToAdd.map((tagId) => ({
          newsletter_id: newsletterId,
          tag_id: tagId,
          user_id: userId,
        }))
      );

    if (addError) throw addError;
  }

  return { newsletterId, tagIds };
};

/**
 * Toggles a tag filter in the list of selected tag IDs
 * @param tag - The tag to toggle (can be a tag ID or Tag object)
 * @param currentTagIds - Currently selected tag IDs
 * @returns Updated array of selected tag IDs or null if no tags are selected
 */
export const toggleTagFilter = <T extends { id: string }>(
  tag: string | T,
  currentTagIds: string[] | null
): string[] | null => {
  const tagId = typeof tag === 'string' ? tag : tag.id;
  
  const currentTags = currentTagIds || [];
  const updatedTagIds = currentTags.includes(tagId)
    ? currentTags.filter(id => id !== tagId)
    : [...currentTags, tagId];
    
  return updatedTagIds.length > 0 ? updatedTagIds : null;
};

/**
 * Handles tag click events
 * @param tag - The tag that was clicked (can be a tag ID or Tag object)
 * @param currentTagIds - Currently selected tag IDs
 * @param setTagIds - State setter function for updating selected tag IDs
 * @param event - Optional React mouse event to stop propagation
 * @returns Updated array of selected tag IDs or null if no tags are selected
 */
export const handleTagClick = <T extends { id: string }>(
  tag: string | T,
  currentTagIds: string[] | null,
  setTagIds: (ids: string[] | null) => void,
  event?: React.MouseEvent
): void => {
  event?.stopPropagation();
  const newTagIds = toggleTagFilter(tag, currentTagIds);
  setTagIds(newTagIds);
};

/**
 * Handles tag click with navigation to a specific route
 * @param tag - The tag that was clicked (can be a tag ID or Tag object)
 * @param navigate - Navigation function from react-router
 * @param basePath - Base path to navigate to (e.g., '/inbox')
 * @param event - Mouse event to stop propagation
 */
export const handleTagClickWithNavigation = <T extends { id: string }>(
  tag: string | T,
  navigate: (to: string) => void,
  basePath: string = '/inbox',
  event?: React.MouseEvent
): void => {
  event?.stopPropagation();
  const tagId = typeof tag === 'string' ? tag : tag.id;
  navigate(`${basePath}?tags=${tagId}`);
};

export const getOptimisticTags = (tagIds: string[], userId: string, allTags: any[]) => {
  return tagIds.map((tagId) => {
    const existingTag = allTags.find((t) => t.id === tagId);
    if (existingTag) return existingTag;
    
    // Fallback with minimal tag data if not found in allTags
    return {
      id: tagId,
      name: '',
      color: '#808080', // Default gray color
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
};
