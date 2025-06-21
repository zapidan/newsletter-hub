import { NotFoundError, ValidationError } from '../../api/errorHandling';
import { newsletterSourceApi } from '../../api/newsletterSourceApi';
import { NewsletterSource } from '../../types';
import {
  CreateNewsletterSourceParams,
  NewsletterSourceQueryParams,
  PaginatedResponse,
  UpdateNewsletterSourceParams,
} from '../../types/api';
import { BaseService } from '../base/BaseService';

interface NewsletterSourceOperationResult {
  success: boolean;
  source?: NewsletterSource;
  error?: string;
}

interface BulkNewsletterSourceOperationResult {
  success: boolean;
  sources?: NewsletterSource[];
  failedIds?: string[];
  error?: string;
}

interface NewsletterSourceServiceOptions {
  enableOptimisticUpdates?: boolean;
  batchSize?: number;
}

export class NewsletterSourceService extends BaseService {
  private sourceOptions: NewsletterSourceServiceOptions;

  constructor(options: NewsletterSourceServiceOptions = {}) {
    super({
      retryOptions: {
        maxRetries: 3,
        baseDelay: 1000,
      },
      timeout: 30000,
    });
    this.sourceOptions = {
      enableOptimisticUpdates: true,
      batchSize: 50,
      ...options,
    };
  }

  /**
   * Get a single newsletter source by ID
   */
  async getSource(id: string): Promise<NewsletterSource> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('Source ID is required');
    }

    try {
      const source = await this.withRetry(
        () => newsletterSourceApi.getById(id),
        'getSource',
        {
          // Don't retry on NotFoundError
          retryCondition: (error) => !(error instanceof NotFoundError)
        }
      );

      if (!source) {
        throw new NotFoundError(`Newsletter source with ID ${id} not found`);
      }

      return source;
    } catch (error) {
      // Re-throw the error to preserve its type
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Get newsletter sources with filtering and pagination
   */
  async getSources(
    params: NewsletterSourceQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterSource>> {
    return this.withRetry(async () => {
      // Apply business logic for default parameters
      const processedParams = this.processSourceParams(params);
      return await newsletterSourceApi.getAll(processedParams);
    }, 'getSources');
  }

  /**
   * Create a new newsletter source
   */
  async createSource(
    params: CreateNewsletterSourceParams
  ): Promise<NewsletterSourceOperationResult> {
    this.validateCreateParams(params);

    try {
      const source = await this.withRetry(
        () => newsletterSourceApi.create(params),
        'createSource',
        {
          // Retry on network errors and timeouts
          retryCondition: (error) => {
            return !(error instanceof ValidationError);
          }
        }
      );

      return {
        success: true,
        source,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message.replace(/^Error during \w+: /, '')
            : 'Unknown error',
      };
    }
  }

  /**
   * Update an existing newsletter source
   */
  async updateSource(
    id: string,
    params: UpdateNewsletterSourceParams
  ): Promise<NewsletterSourceOperationResult> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('Source ID is required');
    }
    this.validateUpdateParams(params);

    try {
      const source = await this.withRetry(
        () => newsletterSourceApi.update({ id, ...params }),
        'updateSource'
      );

      return {
        success: true,
        source,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message.replace(/^Error during \w+: /, '')
            : 'Unknown error',
      };
    }
  }

  /**
   * Delete a newsletter source
   */
  async deleteSource(id: string): Promise<NewsletterSourceOperationResult> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('Source ID is required');
    }

    try {
      await this.withRetry(() => newsletterSourceApi.delete(id), 'deleteSource');

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message.replace(/^Error during \w+: /, '')
            : 'Unknown error',
      };
    }
  }

  /**
   * Archive/unarchive a newsletter source
   */
  async toggleArchive(id: string): Promise<NewsletterSourceOperationResult> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('Source ID is required');
    }

    try {
      const source = await this.withRetry(
        () => newsletterSourceApi.toggleArchive(id),
        'toggleArchive'
      );

      return {
        success: true,
        source,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message.replace(/^Error during \w+: /, '')
            : 'Unknown error',
      };
    }
  }

  /**
   * Update multiple newsletter sources
   */
  async bulkUpdate(
    updates: Array<{ id: string; updates: UpdateNewsletterSourceParams }>
  ): Promise<BulkNewsletterSourceOperationResult> {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new ValidationError('Updates array cannot be empty');
    }

    return this.executeWithLogging(
      async () => {
        try {
          const result = await this.withRetry(
            () => newsletterSourceApi.bulkUpdate(updates),
            'bulkUpdate'
          );

          return {
            success: true,
            sources: result.successful,
            failedIds: result.failed,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message.replace(/^Error during \w+: /, '')
                : 'Unknown error',
            failedIds: updates.map((u) => u.id),
          };
        }
      },
      'bulkUpdate',
      { updateCount: updates.length }
    );
  }

  /**
   * Delete multiple newsletter sources
   */
  async bulkDelete(ids: string[]): Promise<BulkNewsletterSourceOperationResult> {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('IDs array cannot be empty');
    }

    return this.executeWithLogging(
      async () => {
        try {
          const result = await this.withRetry(
            () => newsletterSourceApi.bulkDelete(ids),
            'bulkDelete'
          );

          return {
            success: true,
            failedIds: result.failed,
          };
        } catch (error) {
          return {
            success: false,
            error:
              error instanceof Error
                ? error.message.replace(/^Error during \w+: /, '')
                : 'Unknown error',
            failedIds: ids,
          };
        }
      },
      'bulkDelete',
      { idsCount: ids.length }
    );
  }

  /**
   * Search newsletter sources
   */
  async searchSources(
    query: string,
    params: NewsletterSourceQueryParams = {}
  ): Promise<PaginatedResponse<NewsletterSource>> {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      throw new ValidationError('Search query is required');
    }

    if (query.trim().length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    return this.withRetry(async () => {
      const searchParams = {
        ...params,
        search: query.trim(),
        limit: params.limit || 10,
        orderBy: params.orderBy || 'created_at',
        ascending: params.ascending !== undefined ? params.ascending : false,
      };
      return await newsletterSourceApi.getAll(searchParams);
    }, 'searchSources');
  }

  /**
   * Get newsletter sources statistics
   */
  async getSourcesStats(): Promise<{
    total: number;
    active: number;
    archived: number;
  }> {
    return this.withRetry(async () => {
      const [allSources, activeSources, archivedSources] = await Promise.all([
        newsletterSourceApi.getAll({ limit: 1 }),
        newsletterSourceApi.getAll({ excludeArchived: true, limit: 1 }),
        newsletterSourceApi.getAll({ excludeArchived: false, limit: 1 }),
      ]);

      return {
        total: allSources.count || 0,
        active: activeSources.count || 0,
        archived: (archivedSources.count || 0) - (activeSources.count || 0),
      };
    }, 'getSourcesStats');
  }

  /**
   * Process and validate source query parameters
   */
  private processSourceParams(params: NewsletterSourceQueryParams): NewsletterSourceQueryParams {
    const processedParams = { ...params };

    // Set default values
    if (!processedParams.limit) {
      processedParams.limit = this.sourceOptions.batchSize;
    }

    if (!processedParams.orderBy) {
      processedParams.orderBy = 'created_at';
    }

    if (processedParams.ascending === undefined) {
      processedParams.ascending = false;
    }

    // Validate search query length
    if (processedParams.search && processedParams.search.length < 2) {
      delete processedParams.search;
    }

    return processedParams;
  }

  /**
   * Validate create source parameters
   */
  private validateCreateParams(params: CreateNewsletterSourceParams): void {
    if (!params.name || typeof params.name !== 'string') {
      throw new ValidationError('Source name is required');
    }

    if (!params.from || typeof params.from !== 'string') {
      throw new ValidationError('Source from address is required');
    }

    if (params.name.length < 2 || params.name.length > 100) {
      throw new ValidationError('Source name must be between 2 and 100 characters');
    }

    // Basic email validation for from address
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.from)) {
      throw new ValidationError('Invalid from email address');
    }
  }

  /**
   * Validate update source parameters
   */
  private validateUpdateParams(params: UpdateNewsletterSourceParams): void {
    if (params.name !== undefined) {
      if (typeof params.name !== 'string' || params.name.length < 2 || params.name.length > 100) {
        throw new ValidationError('Source name must be between 2 and 100 characters');
      }
    }

    if (params.from !== undefined) {
      if (typeof params.from !== 'string') {
        throw new ValidationError('From address must be a string');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(params.from)) {
        throw new ValidationError('Invalid from email address');
      }
    }
  }
}

// Export singleton instance
export const newsletterSourceService = new NewsletterSourceService();
