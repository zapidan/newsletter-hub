// Re-export common modules
export * from "./types";
export * from "./contexts";
export * from "./components";

// Re-export services with explicit names to avoid conflicts
export {
  // Base service exports
  BaseService,
  ServiceError,
  NetworkError,
  ValidationError as ServiceValidationError,
  NotFoundError as ServiceNotFoundError,
  UnauthorizedError,
  ServiceOptions,
  RetryOptions as ServiceRetryOptions,

  // Newsletter service
  NewsletterService,
  newsletterService,

  // Tag service
  TagService,
  tagService,

  // Reading queue service
  ReadingQueueService,
  readingQueueService,

  // Search service
  SearchService,
  searchService,
} from "./services";

// Re-export hooks with explicit names to avoid conflicts
export {
  // Business logic hooks
  useNewsletterOperations,
  useTagOperations,
  useReadingQueueOperations,

  // UI hooks
  useNewsletters,
  useInfiniteNewsletters,
  useNewsletterDetail,
  useTags,
  useReadingQueue,
  useUnreadCount,
  useEmailAlias,
  useUrlParams,
  useInboxFilters,
  usePerformanceOptimizations,
  useTagsPageState,

  // Error handling
  useErrorHandling,
  RetryOptions as HookRetryOptions,
} from "./hooks";

// Explicitly re-export API to avoid conflicts with hooks
export {
  // Core Supabase client and utilities
  supabase,
  handleSupabaseError,
  getCurrentUser,
  getCurrentSession,
  requireAuth,
  checkConnection,
  withPerformanceLogging,
  SupabaseError,
  supabaseClient,

  // Newsletter API
  newsletterApi,
  getAllNewsletters,
  getNewsletterById,
  createNewsletter,
  updateNewsletter,
  deleteNewsletter,
  bulkUpdateNewsletters,
  markAsRead,
  markAsUnread,
  toggleArchive,
  bulkArchive,
  bulkUnarchive,
  toggleLike,
  getNewslettersByTag,
  getNewslettersBySource,
  searchNewsletters,
  getNewsletterStats,
  newsletterService,

  // Newsletter Source API
  newsletterSourceApi,
  getAllNewsletterSources,
  getNewsletterSourceById,
  createNewsletterSource,
  updateNewsletterSource,
  deleteNewsletterSource,
  archiveNewsletterSource,
  unarchiveNewsletterSource,
  toggleArchiveNewsletterSource,
  bulkArchiveNewsletterSources,
  bulkUnarchiveNewsletterSources,
  searchNewsletterSources,
  getNewsletterSourcesWithCounts,
  getActiveNewsletterSources,
  getArchivedNewsletterSources,
  getNewsletterSourceStats,
  newsletterSourceService,

  // Reading Queue API
  readingQueueApi,
  getReadingQueue,
  addToReadingQueue,
  removeFromReadingQueue,
  reorderReadingQueue,
  clearReadingQueue,
  getReadingQueueItemById,
  isNewsletterInQueue,
  getReadingQueueStats,
  moveQueueItemToPosition,
  readingQueueService,

  // Tag API
  tagApi,
  getAllTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  getTagsForNewsletter,
  updateNewsletterTags,
  addTagToNewsletter,
  removeTagFromNewsletter,
  getOrCreateTag,
  bulkCreateTags,
  getTagUsageStats,
  searchTags,
  getPaginatedTags,
  tagService,

  // Newsletter Source Group API
  newsletterSourceGroupApi,
  getAllNewsletterSourceGroups,
  getNewsletterSourceGroupById,
  createNewsletterSourceGroup,
  updateNewsletterSourceGroup,
  deleteNewsletterSourceGroup,
  addSourcesToGroup,
  removeSourcesFromGroup,
  getGroupSources,
  getSourceGroups,
  getNewsletterSourceGroupStats,
  searchNewsletterSourceGroups,
  newsletterSourceGroupService,

  // User API
  userApi,
  getUserProfile,
  updateUserProfile,
  generateEmailAlias,
  getUserEmailAlias,
  updateEmailAlias,
  isEmailAliasAvailable,
  deleteUserAccount,
  getUserStats,
  updateUserPreferences,
  getUserPreferences,
  userService,

  // Error handling from API (with different export names to avoid conflicts)
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  PermissionError,
  ErrorType,
  transformSupabaseError,
  getUserFriendlyMessage,
  logError,
  withRetry,
  handleAsyncError,
  createValidationError,
  validateRequired,
  validateEmail,
  validateMinLength,
  useErrorHandler,
  setupGlobalErrorHandling,
  simulateError,

  // API utilities
  createApiService,
  buildPaginationQuery,
  buildOrderQuery,
  buildSearchQuery,
  createSuccessResponse,
  createErrorResponse,
  measureApiCall,
  getCacheKey,
  API_CONFIG,
} from "./api";

// Re-export API types
export type {
  ApiResponse,
  ApiError,
  ApiResult,
  PaginationParams,
  PaginatedResponse,
  BaseQueryParams,
  FilterParams,
  NewsletterQueryParams,
  NewsletterSourceQueryParams,
  TagQueryParams,
  CreateNewsletterParams,
  UpdateNewsletterParams,
  BulkUpdateNewsletterParams,
  CreateNewsletterSourceParams,
  UpdateNewsletterSourceParams,
  CreateTagParams,
  UpdateTagParams,
  CreateNewsletterSourceGroupParams,
  UpdateNewsletterSourceGroupParams,
  DatabaseOperation,
  CacheInvalidationParams,
  AuthenticatedOperation,
  RealtimeSubscriptionParams,
  ValidationError as ValidationErrorType,
  ApiValidationError,
  PerformanceMetrics,
  BatchOperation,
  BatchResult,
  FileUploadParams,
  FileUploadResult,
  SearchParams,
  SearchResult,
  WithoutId,
  WithOptionalId,
  UpdateParams,
  CreateParams,
  CrudOperations,
} from "./api";

// Add more exports as needed
