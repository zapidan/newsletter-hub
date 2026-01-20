// Base API Response Types
export interface ApiResponse<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    message: string;
    code?: string;
    details?: any;
    hint?: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  nextPage?: number | null;
  prevPage?: number | null;
}

// Query Parameter Types
export interface BaseQueryParams {
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
  offset?: number;
  user_id?: string;
}

export interface FilterParams {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  isRead?: boolean;
  isArchived?: boolean;
  isLiked?: boolean;
  tagIds?: string[];
  sourceIds?: string[];
  groupIds?: string[];
}

export interface NewsletterQueryParams extends BaseQueryParams, FilterParams, PaginationParams {
  includeRelations?: boolean;
  includeTags?: boolean;
  includeSource?: boolean;
}

export interface NewsletterSourceQueryParams extends BaseQueryParams, PaginationParams {
  includeCount?: boolean;
  excludeArchived?: boolean;
  search?: string;
}

export interface TagQueryParams extends BaseQueryParams, PaginationParams {
  includeCount?: boolean;
  search?: string;
}

// Mutation Parameter Types
export interface CreateNewsletterParams {
  title: string;
  content: string;
  summary?: string;
  image_url?: string;
  newsletter_source_id?: string;
  tag_ids?: string[];
}

export interface UpdateNewsletterParams {
  id: string;
  title?: string;
  content?: string;
  summary?: string;
  image_url?: string;
  is_read?: boolean;
  is_liked?: boolean;
  is_archived?: boolean;
  tag_ids?: string[];
}

export interface BulkUpdateNewsletterParams {
  ids: string[];
  updates: Partial<{
    is_read: boolean;
    is_liked: boolean;
    is_archived: boolean;
  }>;
}

export interface CreateNewsletterSourceParams {
  name: string;
  from: string;
}

export interface UpdateNewsletterSourceParams {
  id: string;
  name?: string;
  from?: string;
  is_archived?: boolean;
}

export interface BulkUpdateNewsletterSourceParams {
  updates: Array<{ id: string; updates: Omit<UpdateNewsletterSourceParams, 'id'> }>;
}

export interface CreateTagParams {
  name: string;
  color: string;
}

export interface UpdateTagParams {
  id: string;
  name?: string;
  color?: string;
}

export interface CreateReadingQueueItemParams {
  newsletter_id: string;
  priority?: string;
  notes?: string;
}

export interface UpdateReadingQueueItemParams {
  id: string;
  priority?: string;
  notes?: string;
}

export interface CreateNewsletterSourceGroupParams {
  name: string;
  source_ids?: string[];
}

export interface UpdateNewsletterSourceGroupParams {
  id: string;
  name?: string;
  source_ids?: string[];
}

export interface CreateNewsletterGroupParams {
  name: string;
  color?: string;
  sourceIds?: string[];
}

export interface UpdateNewsletterGroupParams {
  id: string;
  name?: string;
  color?: string;
  sourceIds?: string[];
}

// Database Operation Types
export interface DatabaseOperation {
  table: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  filters?: Record<string, any>;
  data?: Record<string, any>;
}

// Cache-related Types
export interface CacheInvalidationParams {
  patterns?: string[];
  exact?: string[];
  tags?: string[];
}

// Auth-related API Types
export interface AuthenticatedOperation {
  requireAuth: true;
  userId?: string;
}

// Real-time subscription types
export interface RealtimeSubscriptionParams {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  schema?: string;
}

// Error handling types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiValidationError {
  message: string;
  errors: ValidationError[];
}

// Performance monitoring types
export interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

// Batch operation types
export interface BatchOperation<T> {
  operations: T[];
  options?: {
    continueOnError?: boolean;
    transactional?: boolean;
  };
}

export interface BatchResult<T> {
  results: (T | null)[];
  errors: (Error | null)[];
  successCount: number;
  errorCount: number;
}

// File upload types (for future use)
export interface FileUploadParams {
  file: File;
  bucket: string;
  path?: string;
  options?: {
    cacheControl?: string;
    contentType?: string;
    upsert?: boolean;
  };
}

export interface FileUploadResult {
  path: string;
  url: string;
  size: number;
  contentType: string;
}

// Search and indexing types
export interface SearchParams {
  query: string;
  table?: string;
  columns?: string[];
  limit?: number;
  offset?: number;
  options?: {
    fuzzy?: boolean;
    highlight?: boolean;
    language?: string;
  };
}

export interface SearchResult<T> {
  data: T[];
  count: number;
  query: string;
  processingTime: number;
  highlights?: Record<string, string[]>;
}

// Export utility type helpers
export type WithoutId<T> = Omit<T, 'id'>;
export type WithOptionalId<T> = Omit<T, 'id'> & { id?: string };
export type UpdateParams<T> = Partial<WithoutId<T>> & { id: string };
export type CreateParams<T> = WithoutId<T>;

// Generic CRUD operation types
export interface CrudOperations<T, TCreate = CreateParams<T>, TUpdate = UpdateParams<T>> {
  getById(id: string, params?: BaseQueryParams): Promise<T | null>;
  getAll(params?: BaseQueryParams & PaginationParams): Promise<PaginatedResponse<T>>;
  create(data: TCreate): Promise<T>;
  update(data: TUpdate): Promise<T>;
  delete(id: string): Promise<boolean>;
  bulkCreate(data: TCreate[]): Promise<BatchResult<T>>;
  bulkUpdate(data: TUpdate[]): Promise<BatchResult<T>>;
  bulkDelete(ids: string[]): Promise<BatchResult<boolean>>;
}
