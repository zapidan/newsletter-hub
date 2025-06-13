import { tagApi } from "@common/api/tagApi";
import { Tag } from "@common/types";

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
  userId: string,
) => {
  // Validate inputs
  if (!newsletterId) {
    throw new Error("Newsletter ID is required");
  }
  if (!userId) {
    throw new Error("User ID is required");
  }
  if (!Array.isArray(tagIds)) {
    throw new Error("tagIds must be an array");
  }
  if (!Array.isArray(currentTagIds)) {
    throw new Error("currentTagIds must be an array");
  }

  // Create tag objects from IDs for the API call
  const tags: Tag[] = [];

  for (const tagIdOrName of tagIds) {
    // Check if it's a UUID (existing tag)
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        tagIdOrName,
      );

    if (isUuid) {
      // It's a UUID, get the tag
      const existingTag = await tagApi.getById(tagIdOrName);
      if (existingTag) {
        tags.push(existingTag);
      }
    } else {
      // It's a tag name, get or create
      const tag = await tagApi.getOrCreate(tagIdOrName.trim());
      tags.push(tag);
    }
  }

  // Use the API to update newsletter tags
  await tagApi.updateNewsletterTags(newsletterId, tags);

  // Get updated tags for the newsletter
  const updatedTags = await tagApi.getTagsForNewsletter(newsletterId);

  return {
    newsletterId,
    tagIds: updatedTags.map((tag) => tag.id),
    added: tags.filter((tag) => !currentTagIds.includes(tag.id)).length,
    removed: currentTagIds.filter((id) => !tags.some((tag) => tag.id === id))
      .length,
    tags: updatedTags,
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
  currentTagIds: string[] | null,
): string[] => {
  const tagId = typeof tag === "string" ? tag : tag.id;

  const currentTags = currentTagIds || [];
  const updatedTagIds = currentTags.includes(tagId)
    ? currentTags.filter((id) => id !== tagId)
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
  event?: React.MouseEvent,
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
  basePath: string = "/inbox",
  event?: React.MouseEvent,
): void => {
  event?.stopPropagation();
  const tagId = typeof tag === "string" ? tag : tag.id;
  navigate(`${basePath}?tags=${tagId}`);
};

export const getOptimisticTags = (
  tagIds: string[],
  userId: string,
  allTags: Tag[],
) => {
  return tagIds.map((tagId) => {
    const existingTag = allTags.find((t) => t.id === tagId);
    if (existingTag) return existingTag;

    // Fallback with minimal tag data if not found in allTags
    return {
      id: tagId,
      name: "",
      color: "#808080", // Default gray color
      user_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
};
