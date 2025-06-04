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

export interface Newsletter {
  id: string;
  title: string;
  sender: string;
  content: string;
  summary: string;
  image_url: string;
  received_at: string;
  is_read: boolean;
  user_id: string;
  tags?: Tag[];
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

export interface NewsletterSource {
  id: string;
  user_id: string;
  name: string;
  domain: string;
  created_at: string;
  updated_at: string;
}

export interface ReadingQueueItem {
  id: string;
  user_id: string;
  newsletter_id: string;
  position: number;
  created_at: string;
  updated_at: string;
  newsletter: Newsletter;
}

export interface NewsletterUpdate {
  title?: string;
  sender?: string;
  content?: string;
  summary?: string;
  image_url?: string;
  is_read?: boolean;
  tag_ids?: string[];
}

export interface TagCreate {
  name: string;
  color: string;
}

export interface TagUpdate extends Partial<TagCreate> {
  id: string;
}
