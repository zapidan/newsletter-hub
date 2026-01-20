export interface Tag {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
  newsletter_count?: number;
}

export interface TagWithCount extends Tag {
  newsletter_count: number;
}

export interface NewsletterTag {
  id: string;
  newsletter_id: string;
  tag_id: string;
  created_at: string;
  tag: Tag;
}

export interface NewsletterSource {
  id: string;
  name: string;
  from: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_archived?: boolean;
  newsletter_count?: number;
  unread_count?: number;
}

export interface Newsletter {
  id: string;
  title: string;
  content: string;
  summary: string;
  image_url: string;
  received_at: string;
  updated_at: string;
  is_read: boolean;
  is_liked: boolean;
  is_archived: boolean;
  user_id: string;
  newsletter_source_id?: string | null;
  source_id?: string | null;
  source: NewsletterSource | null;
  tags?: Tag[];
  word_count: number;
  estimated_read_time: number;
}

export interface User {
  id: string;
  email: string;
  email_alias: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  onboarding_completed?: boolean;
  // Add other profile fields as needed
}

export interface NewsletterSourceGroup {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at: string;
  sources?: NewsletterSource[];
  _count?: {
    sources: number;
  };
}

export interface NewsletterSourceGroupMember {
  id: string;
  group_id: string;
  source_id: string;
  created_at: string;
  source?: NewsletterSource;
  group?: NewsletterSourceGroup;
}

export interface NewsletterGroup {
  id: string;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  /** Sources in this group. Newsletters inherit group membership from their source. */
  sources?: NewsletterSource[];
  _count?: { sources: number };
}

export interface NewsletterGroupMember {
  id: string;
  source_id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  source?: NewsletterSource;
  group?: NewsletterGroup;
}

export interface NewsletterWithRelations extends Omit<Newsletter, 'source' | 'tags'> {
  newsletter_source_id: string;
  source: NewsletterSource | null;
  tags: Tag[];
  is_archived: boolean;
}

export interface ReadingQueueItem {
  id: string;
  user_id: string;
  newsletter_id: string;
  position: number;
  added_at: string;
  priority?: string;
  notes?: string;
  newsletter: NewsletterWithRelations;
}

export interface NewsletterUpdate {
  title?: string;
  content?: string;
  summary?: string;
  image_url?: string;
  is_read?: boolean;
  tag_ids?: string[];
}

export interface TagCreate {
  name: string;
  color?: string;
}

export interface TagUpdate extends Partial<TagCreate> {
  id: string;
}

export interface NewsletterFilter {
  is_read?: boolean;
  is_archived?: boolean;
  is_liked?: boolean;
  tag_ids?: string[];
  source_id?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  group_id?: string;
}

export interface NewsletterQueryParams {
  limit?: number;
  offset?: number;
  search?: string;
  isRead?: boolean;
  isArchived?: boolean;
  isLiked?: boolean;
  sourceIds?: string[];
  tagIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  includeSource?: boolean;
  includeTags?: boolean;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page?: number;
  hasMore?: boolean;
  totalPages?: number;
  limit?: number;
  offset?: number;
}
