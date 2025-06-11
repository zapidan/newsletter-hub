import { supabase } from '@common/services/supabaseClient';

/**
 * Updates tags for a newsletter
 * @param newsletterId - The ID of the newsletter to update
 * @param tagIds - Array of tag IDs to set for the newsletter
 * @param currentTagIds - Current tag IDs for the newsletter
 * @param userId - The ID of the current user
 * @returns Object containing update results
 */
export const updateNewsletterTags = async (
  newsletterId: string,
  tagIds: string[],
  currentTagIds: string[],
  userId: string
) => {
  // Validate inputs
  if (!newsletterId) {
    throw new Error('Newsletter ID is required');
  }
  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!Array.isArray(tagIds)) {
    throw new Error('tagIds must be an array');
  }
  if (!Array.isArray(currentTagIds)) {
    throw new Error('currentTagIds must be an array');
  }

  // Normalize tag IDs to ensure case-insensitive comparison
  const normalizedTagIds = tagIds.map(id => id.trim().toLowerCase());  
  const normalizedCurrentTagIds = currentTagIds.map(id => id.trim().toLowerCase());

  // Find tags to add and remove
  const tagsToAdd = normalizedTagIds.filter((id) => !normalizedCurrentTagIds.includes(id));
  const tagsToRemove = normalizedCurrentTagIds.filter((id) => !normalizedTagIds.includes(id));

  // Process tag removals
  if (tagsToRemove.length > 0) {
    // First, get the tag IDs to remove
    const { data: tagsToRemoveData, error: tagsError } = await supabase
      .from('tags')
      .select('id')
      .in('id', tagsToRemove)
      .eq('user_id', userId);

    if (tagsError) throw tagsError;

    if (tagsToRemoveData && tagsToRemoveData.length > 0) {
      const tagIdsToRemove = tagsToRemoveData.map(tag => tag.id);
      const { error: removeError } = await supabase
        .from('newsletter_tags')
        .delete()
        .eq('newsletter_id', newsletterId)
        .in('tag_id', tagIdsToRemove)
        .eq('user_id', userId);

      if (removeError) throw removeError;
    }
  }

  // Process tag additions
  if (tagsToAdd.length > 0) {
    // First, get or create tags
    const tagIdsToAdd = [];
    
    for (const tagIdOrName of tagsToAdd) {
      // Check if it's a UUID (existing tag)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tagIdOrName);
      
      if (isUuid) {
        // It's a UUID, verify it exists
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('id', tagIdOrName)
          .eq('user_id', userId)
          .single();

        if (!existingTag) continue; // Skip if tag doesn't exist
        tagIdsToAdd.push(existingTag.id);
      } else {
        // It's a tag name, try to find or create
        const tagName = tagIdOrName.trim();
        const { data: existingTag } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagName)
          .eq('user_id', userId)
          .single();

        if (existingTag) {
          tagIdsToAdd.push(existingTag.id);
        } else {
          // Create new tag
          const { data: newTag, error: createError } = await supabase
            .from('tags')
            .insert([
              {
                name: tagName,
                user_id: userId,
                color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
              }
            ])
            .select()
            .single();

          if (createError) throw createError;
          if (newTag) tagIdsToAdd.push(newTag.id);
        }
      }
    }


    // Add tags to newsletter
    if (tagIdsToAdd.length > 0) {
      const { error: addError } = await supabase
        .from('newsletter_tags')
        .insert(
          tagIdsToAdd.map(tagId => ({
            newsletter_id: newsletterId,
            tag_id: tagId,
            user_id: userId
          }))
        );

      if (addError) throw addError;
    }
  }

  // Define the type for the tag
  type Tag = {
    id: string;
    name: string;
    color: string;
  };

  // Get updated tags for the newsletter by joining with newsletter_tags
  const { data: updatedTags, error: tagsFetchError } = await supabase
    .from('newsletter_tags')
    .select(`
      tag:tags!inner(
        id,
        name,
        color
      )
    `)
    .eq('newsletter_id', newsletterId)
    .eq('user_id', userId);
    
  // Map the result to match the expected format
  const formattedTags: Tag[] = [];
  updatedTags?.forEach(item => {
    if (Array.isArray(item.tag)) {
      formattedTags.push(...item.tag);
    } else if (item.tag) {
      formattedTags.push(item.tag);
    }
  });

  if (tagsFetchError) throw tagsFetchError;

  return {
    newsletterId,
    tagIds: formattedTags.map(tag => tag.id),
    added: tagsToAdd.length,
    removed: tagsToRemove.length,
    tags: formattedTags
  };
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
): string[] => {
  const tagId = typeof tag === 'string' ? tag : tag.id;
  
  const currentTags = currentTagIds || [];
  const updatedTagIds = currentTags.includes(tagId)
    ? currentTags.filter(id => id !== tagId)
    : [...currentTags, tagId];
    
  return updatedTagIds;
};

/**
 * Handles tag click events
 * @param tag - The tag that was clicked (can be a tag ID or Tag object)
 * @param currentTagIds - Currently selected tag IDs
 * @param setTagIds - State setter function for updating selected tag IDs
 * @param event - Optional React mouse event to stop propagation
 */
export const handleTagClick = <T extends { id: string }>(
  tag: string | T,
  currentTagIds: string[] | null,
  setTagIds: (ids: string[]) => void,
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
