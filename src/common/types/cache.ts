import { NewsletterWithRelations } from './index';

export type NewsletterFilter = 'all' | 'unread' | 'liked' | 'archived';

export interface NewsletterQueryKey {
  entity: 'newsletters';
  scope: 'list' | 'detail' | 'tags' | 'sources';
  params: {
    userId?: string;
    id?: string;
    filter?: NewsletterFilter;
    tagIds?: string[];
    sourceId?: string | null;
    groupSourceIds?: string[];
    timeRange?: string;
  };
}

export interface NewsletterCacheUpdate {
  id: string;
  updates: Partial<NewsletterWithRelations>;
}

export interface NewsletterBulkUpdate {
  ids: string[];
  updates: Partial<NewsletterWithRelations>;
}

export const CACHE_DURATION = {
  SHORT: 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  DAY: 24 * 60 * 60 * 1000, // 24 hours
};
