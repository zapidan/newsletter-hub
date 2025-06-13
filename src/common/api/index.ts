import { ApiError, ApiResponse, CrudOperations } from '../types/api';
import { setupGlobalErrorHandling } from './errorHandling';
import supabase, { handleSupabaseError, requireAuth, withPerformanceLogging } from './supabaseClient';

// Core Supabase client and utilities
export {
  supabase,
  handleSupabaseError,
  getCurrentUser,
  getCurrentSession,
  requireAuth,
  checkConnection,
  withPerformanceLogging,
  SupabaseError,
  default as supabaseClient,
} from './supabaseClient';

// Newsletter API
export {
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
  toggleBookmark,
  getNewslettersByTag,
  getNewslettersBySource,
  searchNewsletters,
  getNewsletterStats,
  default as newsletterService,
} from './newsletterApi';

// Newsletter Source API
export {
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
  default as newsletterSourceService,
} from './newsletterSourceApi';

// Error handling
export {
  AppError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  PermissionError,
  ErrorType,
  ErrorSeverity,
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
} from './errorHandling';

// API types - re-export from types
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
} from '../types/api';

// Convenience API factory for creating new services
export const createApiService = <T, TCreate = any, TUpdate = any>(
  tableName: string
): CrudOperations<T, TCreate, TUpdate> => {
  return {
    async getById(id: string) {
      const user = await requireAuth();
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        handleSupabaseError(error);
      }

      return data;
    },

    async getAll(params = {}) {
      const user = await requireAuth();
      let query = supabase.from(tableName).select('*').eq('user_id', user.id);

      if (params.limit) query = query.limit(params.limit);
      if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 50) - 1);

      const { data, error, count } = await query;
      if (error) handleSupabaseError(error);

      return {
        data: data || [],
        count: count || 0,
        page: Math.floor((params.offset || 0) / (params.limit || 50)) + 1,
        limit: params.limit || 50,
        hasMore: (data?.length || 0) === (params.limit || 50),
        nextPage: (data?.length || 0) === (params.limit || 50) ? Math.floor((params.offset || 0) / (params.limit || 50)) + 2 : null,
        prevPage: (params.offset || 0) > 0 ? Math.floor((params.offset || 0) / (params.limit || 50)) : null,
      };
    },

    async create(data: TCreate) {
      const user = await requireAuth();
      const { data: result, error } = await supabase
        .from(tableName)
        .insert({ ...data, user_id: user.id })
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return result;
    },

    async update(data: TUpdate) {
      const user = await requireAuth();
      const { id, ...updateData } = data as any;
      const { data: result, error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return result;
    },

    async delete(id: string) {
      const user = await requireAuth();
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) handleSupabaseError(error);
      return true;
    },

    async bulkCreate(items: TCreate[]) {
      const user = await requireAuth();
      const results: (T | null)[] = [];
      const errors: (Error | null)[] = [];

      const itemsWithUserId = items.map(item => ({ ...item, user_id: user.id }));
      const { data, error } = await supabase
        .from(tableName)
        .insert(itemsWithUserId)
        .select();

      if (error) {
        items.forEach(() => {
          results.push(null);
          errors.push(new Error(error.message));
        });
      } else {
        items.forEach((_, index) => {
          const result = data?.[index] || null;
          results.push(result);
          errors.push(result ? null : new Error('Item not created'));
        });
      }

      return {
        results,
        errors,
        successCount: results.filter(r => r !== null).length,
        errorCount: errors.filter(e => e !== null).length,
      };
    },

    async bulkUpdate(items: TUpdate[]) {
      const results: (T | null)[] = [];
      const errors: (Error | null)[] = [];

      for (const item of items) {
        try {
          const result = await this.update(item);
          results.push(result);
          errors.push(null);
        } catch (error) {
          results.push(null);
          errors.push(error as Error);
        }
      }

      return {
        results,
        errors,
        successCount: results.filter(r => r !== null).length,
        errorCount: errors.filter(e => e !== null).length,
      };
    },

    async bulkDelete(ids: string[]) {
      const user = await requireAuth();
      const results: (boolean | null)[] = [];
      const errors: (Error | null)[] = [];

      const { error } = await supabase
        .from(tableName)
        .delete()
        .in('id', ids)
        .eq('user_id', user.id);

      if (error) {
        ids.forEach(() => {
          results.push(null);
          errors.push(new Error(error.message));
        });
      } else {
        ids.forEach(() => {
          results.push(true);
          errors.push(null);
        });
      }

      return {
        results,
        errors,
        successCount: results.filter(r => r !== null).length,
        errorCount: errors.filter(e => e !== null).length,
      };
    },
  };
};

// Common query builders
export const buildPaginationQuery = (
  query: any,
  { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
) => {
  return query.range(offset, offset + limit - 1);
};

export const buildOrderQuery = (
  query: any,
  { orderBy = 'created_at', ascending = false }: { orderBy?: string; ascending?: boolean } = {}
) => {
  return query.order(orderBy, { ascending });
};

export const buildSearchQuery = (
  query: any,
  searchTerm: string,
  searchColumns: string[]
) => {
  if (!searchTerm || searchColumns.length === 0) return query;

  const searchConditions = searchColumns
    .map(column => `${column}.ilike.%${searchTerm}%`)
    .join(',');

  return query.or(searchConditions);
};

// API response helpers
export const createSuccessResponse = <T>(data: T): ApiResponse<T> => ({
  data,
  error: null,
});

export const createErrorResponse = (message: string, code?: string): ApiError => ({
  data: null,
  error: {
    message,
    code,
  },
});

// Performance monitoring helpers
export const measureApiCall = async <T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> => {
  return withPerformanceLogging(operationName, operation);
};

// Cache utilities for API responses
export const getCacheKey = (
  service: string,
  method: string,
  params?: Record<string, any>
): string => {
  const paramString = params ? JSON.stringify(params) : '';
  return `api:${service}:${method}:${paramString}`;
};

// Environment-based configuration
export const API_CONFIG = {
  retryAttempts: parseInt(import.meta.env.VITE_API_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(import.meta.env.VITE_API_RETRY_DELAY || '1000'),
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  enableLogging: import.meta.env.VITE_API_ENABLE_LOGGING === 'true',
  enablePerformanceMonitoring: import.meta.env.VITE_API_ENABLE_PERFORMANCE_MONITORING === 'true',
} as const;

// Initialize global error handling if needed
if (typeof window !== 'undefined' && import.meta.env.MODE === 'production') {
  setupGlobalErrorHandling();
}
