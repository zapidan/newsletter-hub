// Re-export common modules
export * from "./components";
export * from "./contexts";
export * from "./types";

// Re-export services with explicit names to avoid conflicts
export {
  // Base service exports
  BaseService, NetworkError,
  // Newsletter service
  NewsletterService,
  // Reading queue service
  ReadingQueueService,

  // Search service
  searchService, ServiceError, NotFoundError as ServiceNotFoundError, ServiceOptions,
  RetryOptions as ServiceRetryOptions, ValidationError as ServiceValidationError,
  tagService, UnauthorizedError
} from "./services";

// Re-export hooks with explicit names to avoid conflicts
export {
  RetryOptions as HookRetryOptions, useEmailAlias,
  // Error handling
  useErrorHandling, useInboxFilters, useInfiniteNewsletters,
  useNewsletterDetail,
  // Business logic hooks
  useNewsletterOperations,
  // UI hooks
  useNewsletters, usePerformanceOptimizations, useReadingQueue, useReadingQueueOperations, useTagOperations, useTags, useTagsPageState, useUnreadCount, useUrlParams
} from "./hooks";

// Explicitly re-export API to avoid conflicts with hooks
export {
  addSourcesToGroup, addTagToNewsletter, addToReadingQueue, API_CONFIG, archiveNewsletterSource, AuthenticationError, buildOrderQuery, buildPaginationQuery, buildSearchQuery, bulkArchive, bulkArchiveNewsletterSources, bulkCreateTags, bulkUnarchive, bulkUnarchiveNewsletterSources, bulkUpdateNewsletters, checkConnection, clearReadingQueue,
  // API utilities
  createApiService, createErrorResponse, createNewsletter, createNewsletterSource, createNewsletterSourceGroup, createSuccessResponse, createTag, createValidationError, deleteNewsletter, deleteNewsletterSource, deleteNewsletterSourceGroup, deleteTag, deleteUserAccount, ErrorType, generateEmailAlias, getActiveNewsletterSources, getAllNewsletters, getAllNewsletterSourceGroups, getAllNewsletterSources, getAllTags, getArchivedNewsletterSources, getCacheKey, getCurrentSession, getCurrentUser, getGroupSources, getNewsletterById, getNewslettersBySource, getNewslettersByTag, getNewsletterSourceById, getNewsletterSourceGroupById, getNewsletterSourceGroupStats, getNewsletterSourceStats, getNewsletterSourcesWithCounts, getNewsletterStats, getOrCreateTag, getPaginatedTags, getReadingQueue, getReadingQueueItemById, getReadingQueueStats, getSourceGroups, getTagById, getTagsForNewsletter, getTagUsageStats, getUserEmailAlias, getUserFriendlyMessage, getUserPreferences, getUserProfile, getUserStats, handleAsyncError, handleSupabaseError, isEmailAliasAvailable, isNewsletterInQueue, logError, markAsRead,
  markAsUnread, measureApiCall, moveQueueItemToPosition,
  // Error handling from API (with different export names to avoid conflicts)
  // Newsletter API
  newsletterApi, newsletterService,

  // Newsletter Source API
  newsletterSourceApi,
  // Newsletter Source Group API
  newsletterSourceGroupApi, newsletterSourceGroupService, newsletterSourceService, NotFoundError,
  PermissionError,
  // Reading Queue API
  readingQueueApi, readingQueueService, removeFromReadingQueue, removeSourcesFromGroup, removeTagFromNewsletter, reorderReadingQueue, requireAuth, searchNewsletters, searchNewsletterSourceGroups, searchNewsletterSources, searchTags, setupGlobalErrorHandling,
  simulateError,
  // Core Supabase client and utilities
  supabase, supabaseClient, SupabaseError,
  // Tag API
  tagApi, toggleArchive, toggleArchiveNewsletterSource, toggleLike, transformSupabaseError, unarchiveNewsletterSource, updateEmailAlias, updateNewsletter, updateNewsletterSource, updateNewsletterSourceGroup, updateNewsletterTags, updateTag, updateUserPreferences, updateUserProfile, useErrorHandler,
  // User API
  userApi, validateEmail,
  validateMinLength, validateRequired, ValidationError, withPerformanceLogging, withRetry
} from "./api";

// Re-export API types
export type {
  ApiError, ApiResponse, ApiResult, ApiValidationError, AuthenticatedOperation, BaseQueryParams, BatchOperation,
  BatchResult, BulkUpdateNewsletterParams, CacheInvalidationParams, CreateNewsletterParams, CreateNewsletterSourceGroupParams, CreateNewsletterSourceParams, CreateParams, CreateTagParams, CrudOperations, DatabaseOperation, FileUploadParams,
  FileUploadResult, FilterParams,
  NewsletterQueryParams,
  NewsletterSourceQueryParams, PaginatedResponse, PaginationParams, PerformanceMetrics, RealtimeSubscriptionParams, SearchParams,
  SearchResult, TagQueryParams, UpdateNewsletterParams, UpdateNewsletterSourceGroupParams, UpdateNewsletterSourceParams, UpdateParams, UpdateTagParams, ValidationError as ValidationErrorType, WithOptionalId, WithoutId
} from "./api";

// Add more exports as needed
