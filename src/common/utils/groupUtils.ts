import { NewsletterGroup, NewsletterWithRelations } from '@common/types';

/**
 * Get the groups that a newsletter belongs to based on its source
 */
export const getNewsletterGroups = (
  newsletter: NewsletterWithRelations,
  allGroups: NewsletterGroup[]
): NewsletterGroup[] => {
  if (!newsletter.source || !allGroups.length) {
    return [];
  }

  return allGroups.filter(group =>
    group.sources?.some(source => source.id === newsletter.source?.id)
  );
};

/**
 * Get the IDs of groups that a newsletter belongs to
 */
export const getNewsletterGroupIds = (
  newsletter: NewsletterWithRelations,
  allGroups: NewsletterGroup[]
): string[] => {
  return getNewsletterGroups(newsletter, allGroups).map(group => group.id);
};

/**
 * Check if a newsletter belongs to any of the specified active group filters
 */
export const isNewsletterInActiveGroups = (
  newsletter: NewsletterWithRelations,
  activeGroupIds: string[],
  allGroups: NewsletterGroup[]
): boolean => {
  if (activeGroupIds.length === 0) {
    return true; // No group filter means include all
  }

  const newsletterGroupIds = getNewsletterGroupIds(newsletter, allGroups);
  return activeGroupIds.some(groupId => newsletterGroupIds.includes(groupId));
};

/**
 * Filter newsletters based on active group filters
 */
export const filterNewslettersByGroups = (
  newsletters: NewsletterWithRelations[],
  activeGroupIds: string[],
  allGroups: NewsletterGroup[]
): NewsletterWithRelations[] => {
  if (activeGroupIds.length === 0) {
    return newsletters; // No group filter means include all
  }

  return newsletters.filter(newsletter =>
    isNewsletterInActiveGroups(newsletter, activeGroupIds, allGroups)
  );
};
