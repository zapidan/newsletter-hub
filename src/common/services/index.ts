// Base service classes
export * from './base/BaseService';

// Service implementations
export * from './newsletter/NewsletterService';
export * from './newsletterGroup/NewsletterGroupService';
export * from './newsletterSource/NewsletterSourceService';
export * from './newsletterSourceGroup/NewsletterSourceGroupService';
export * from './readingQueue/ReadingQueueService';
export * from './tag/TagService';
export * from './user/UserService';

// Optimized services
export { optimizedNewsletterService } from './optimizedNewsletterService';

// Legacy exports (if needed)
export * from './supabaseClient';
