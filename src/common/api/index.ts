import {
  ApiError,
  ApiResponse,
  BaseQueryParams,
  CrudOperations,
  PaginationParams,
} from "../types/api";
import { setupGlobalErrorHandling } from "./errorHandling";
import supabase, {
  handleSupabaseError,
  requireAuth,
  withPerformanceLogging,
} from "./supabaseClient";

// Core Supabase client and utilities
export {
  checkConnection, getCurrentSession, getCurrentUser, handleSupabaseError, requireAuth, supabase, default as supabaseClient, SupabaseError, withPerformanceLogging
} from "./supabaseClient";

// Newsletter API
export {
  bulkArchive,
  bulkUnarchive, bulkUpdateNewsletters, createNewsletter, deleteNewsletter, getAllNewsletters,
  getNewsletterById, getNewslettersBySource, getNewslettersByTag, getNewsletterStats, markAsRead,
  markAsUnread, newsletterApi, default as newsletterService, searchNewsletters, toggleArchive, toggleLike, updateNewsletter
} from "./newsletterApi";

// Newsletter Source API
export {
  archiveNewsletterSource, bulkArchiveNewsletterSources,
  bulkUnarchiveNewsletterSources, createNewsletterSource, deleteNewsletterSource, getActiveNewsletterSources, getAllNewsletterSources, getArchivedNewsletterSources, getNewsletterSourceById, getNewsletterSourceStats, getNewsletterSourcesWithCounts, newsletterSourceApi, default as newsletterSourceService, searchNewsletterSources, toggleArchiveNewsletterSource, unarchiveNewsletterSource, updateNewsletterSource
} from "./newsletterSourceApi";

// Reading Queue API
export {
  addToReadingQueue, clearReadingQueue, getReadingQueue, getReadingQueueItemById, getReadingQueueStats, isNewsletterInQueue, moveQueueItemToPosition, readingQueueApi, default as readingQueueService, removeFromReadingQueue,
  reorderReadingQueue
} from "./readingQueueApi";

// Tag API
export {
  addTagToNewsletter, bulkCreateTags, createTag, deleteTag, getAllTags, getOrCreateTag, getPaginatedTags, getTagById, getTagsForNewsletter, getTagUsageStats, removeTagFromNewsletter, searchTags, tagApi, default as tagService, updateNewsletterTags, updateTag
} from "./tagApi";

// Newsletter Source Group API
export {
  createNewsletterSourceGroup, deleteNewsletterSourceGroup, getAllNewsletterSourceGroups,
  getNewsletterSourceGroupById, getNewsletterSourceGroupStats, newsletterSourceGroupApi, default as newsletterSourceGroupService, searchNewsletterSourceGroups, updateNewsletterSourceGroup
} from "./newsletterSourceGroupApi";

// Newsletter Group API (source-based: groups contain sources; newsletters inherit from source)
export {
  addSourcesToGroup, createNewsletterGroup, deleteNewsletterGroup, getAllNewsletterGroups, getGroupSources, getNewsletterGroupById, getNewsletterGroupStats, getSourceGroups, newsletterGroupApi, default as newsletterGroupService, removeSourcesFromGroup, searchNewsletterGroups, updateNewsletterGroup, updateSourceGroups
} from "./newsletterGroupApi";

// User API
export {
  deleteUserAccount, generateEmailAlias,
  getUserEmailAlias, getUserPreferences, getUserProfile, getUserStats, isEmailAliasAvailable, updateEmailAlias, updateUserPreferences, updateUserProfile, userApi, default as userService
} from "./userApi";

// Error handling
export {
  AppError, AuthenticationError, createValidationError, ErrorSeverity, ErrorType, getUserFriendlyMessage, handleAsyncError, logError, NetworkError, NotFoundError,
  PermissionError, setupGlobalErrorHandling,
  simulateError, transformSupabaseError, useErrorHandler, validateEmail,
  validateMinLength, validateRequired, ValidationError, withRetry
} from "./errorHandling";

// API types - re-export from types
export type {
  ApiError, ApiResponse, ApiResult, ApiValidationError, AuthenticatedOperation, BaseQueryParams, BatchOperation,
  BatchResult, BulkUpdateNewsletterParams, CacheInvalidationParams, CreateNewsletterGroupParams, CreateNewsletterParams, CreateNewsletterSourceGroupParams, CreateNewsletterSourceParams, CreateParams, CreateTagParams, CrudOperations, DatabaseOperation, FileUploadParams,
  FileUploadResult, FilterParams,
  NewsletterQueryParams,
  NewsletterSourceQueryParams, PaginatedResponse, PaginationParams, PerformanceMetrics, RealtimeSubscriptionParams, SearchParams,
  SearchResult, TagQueryParams, UpdateNewsletterGroupParams, UpdateNewsletterParams, UpdateNewsletterSourceGroupParams, UpdateNewsletterSourceParams, UpdateParams, UpdateTagParams, ValidationError as ValidationErrorType, WithOptionalId, WithoutId
} from "../types/api";

// Convenience API factory for creating new services
export const createApiService = <T, TCreate = any, TUpdate = any>(
  tableName: string,
): CrudOperations<T, TCreate, TUpdate> => {
  return {
    async getById(id: string) {
      const user = await requireAuth();
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null;
        handleSupabaseError(error);
      }

      return data;
    },

    async getAll(params: BaseQueryParams & PaginationParams = {}) {
      const user = await requireAuth();
      let query = supabase.from(tableName).select("*").eq("user_id", user.id);

      const limit = params.limit || 50;
      const offset = params.offset || 0;

      if (params.limit) query = query.limit(limit);
      if (params.offset) query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) handleSupabaseError(error);

      return {
        data: data || [],
        count: count || 0,
        page: Math.floor(offset / limit) + 1,
        limit: limit,
        hasMore: (data?.length || 0) === limit,
        nextPage:
          (data?.length || 0) === limit ? Math.floor(offset / limit) + 2 : null,
        prevPage: offset > 0 ? Math.floor(offset / limit) : null,
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
      const { id, ...updateData } = data as TUpdate & { id: string };
      const { data: result, error } = await supabase
        .from(tableName)
        .update(updateData)
        .eq("id", id)
        .eq("user_id", user.id)
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
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) handleSupabaseError(error);
      return true;
    },

    async bulkCreate(items: TCreate[]) {
      const user = await requireAuth();
      const results: (T | null)[] = [];
      const errors: (Error | null)[] = [];

      const itemsWithUserId = items.map((item) => ({
        ...item,
        user_id: user.id,
      }));
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
          errors.push(result ? null : new Error("Item not created"));
        });
      }

      return {
        results,
        errors,
        successCount: results.filter((r) => r !== null).length,
        errorCount: errors.filter((e) => e !== null).length,
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
        successCount: results.filter((r) => r !== null).length,
        errorCount: errors.filter((e) => e !== null).length,
      };
    },

    async bulkDelete(ids: string[]) {
      const user = await requireAuth();
      const results: (boolean | null)[] = [];
      const errors: (Error | null)[] = [];

      const { error } = await supabase
        .from(tableName)
        .delete()
        .in("id", ids)
        .eq("user_id", user.id);

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
        successCount: results.filter((r) => r !== null).length,
        errorCount: errors.filter((e) => e !== null).length,
      };
    },
  };
};

// Common query builders
export const buildPaginationQuery = (
  query: any,
  { offset = 0, limit = 50 }: { offset?: number; limit?: number } = {},
) => {
  return query.range(offset, offset + limit - 1);
};

export const buildOrderQuery = (
  query: any,
  {
    orderBy = "created_at",
    ascending = false,
  }: { orderBy?: string; ascending?: boolean } = {},
) => {
  return query.order(orderBy, { ascending });
};

export const buildSearchQuery = (
  query: any,
  searchTerm: string,
  searchColumns: string[],
) => {
  if (!searchTerm || searchColumns.length === 0) return query;

  const searchConditions = searchColumns
    .map((column) => `${column}.ilike.%${searchTerm}%`)
    .join(",");

  return query.or(searchConditions);
};

// API response helpers
export const createSuccessResponse = <T>(data: T): ApiResponse<T> => ({
  data,
  error: null,
});

export const createErrorResponse = (
  message: string,
  code?: string,
): ApiError => ({
  data: null,
  error: {
    message,
    code,
  },
});

// Performance monitoring helpers
export const measureApiCall = async <T>(
  operationName: string,
  operation: () => Promise<T>,
): Promise<T> => {
  return withPerformanceLogging(operationName, operation);
};

// Cache utilities for API responses
export const getCacheKey = (
  service: string,
  method: string,
  params?: Record<string, unknown>,
): string => {
  const paramString = params ? JSON.stringify(params) : "";
  return `api:${service}:${method}:${paramString}`;
};

// Environment-based configuration
export const API_CONFIG = {
  retryAttempts: parseInt(
    (import.meta as any).env.VITE_API_RETRY_ATTEMPTS || "3",
  ),
  retryDelay: parseInt((import.meta as any).env.VITE_API_RETRY_DELAY || "1000"),
  timeout: parseInt((import.meta as any).env.VITE_API_TIMEOUT || "30000"),
  enableLogging: (import.meta as any).env.VITE_API_ENABLE_LOGGING === "true",
  enablePerformanceMonitoring:
    (import.meta as any).env.VITE_API_ENABLE_PERFORMANCE_MONITORING === "true",
} as const;

// Initialize global error handling if needed
if (
  typeof window !== "undefined" &&
  (import.meta as any).env.MODE === "production"
) {
  setupGlobalErrorHandling();
}
