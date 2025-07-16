import { NotFoundError, ValidationError } from '../../api/errorHandling';
import { newsletterSourceGroupApi } from '../../api/newsletterSourceGroupApi';
import { NewsletterSourceGroup } from '../../types';
import { BaseService } from '../base/BaseService';

interface NewsletterSourceGroupOperationResult {
  success: boolean;
  group?: NewsletterSourceGroup;
  error?: string;
}

interface NewsletterSourceGroupServiceOptions {
  enableOptimisticUpdates?: boolean;
  batchSize?: number;
}

interface CreateNewsletterSourceGroupParams {
  name: string;
  sourceIds: string[];
}

interface UpdateNewsletterSourceGroupParams {
  name?: string;
  sourceIds?: string[];
}

export class NewsletterSourceGroupService extends BaseService {
  private groupOptions: NewsletterSourceGroupServiceOptions;

  constructor(options: NewsletterSourceGroupServiceOptions = {}) {
    super({
      retryOptions: {
        maxRetries: 3,
        baseDelay: 1000,
      },
      timeout: 30000,
    });
    this.groupOptions = {
      enableOptimisticUpdates: true,
      batchSize: 50,
      ...options,
    };
  }

  /**
   * Get all newsletter source groups
   */
  async getGroups(): Promise<NewsletterSourceGroup[]> {
    return this.withRetry(async () => {
      return await newsletterSourceGroupApi.getAll();
    }, 'getGroups');
  }

  /**
   * Get a single newsletter source group by ID
   */
  async getGroup(id: string): Promise<NewsletterSourceGroup | null> {
    this.validateString(id, 'Group ID')

    return this.withRetry(async () => {
      const group = await newsletterSourceGroupApi.getById(id);
      if (!group) {
        throw new NotFoundError(`Newsletter source group with ID ${id} not found`);
      }
      return group;
    }, 'getGroup');
  }

  /**
   * Create a new newsletter source group
   */
  async createGroup(
    params: CreateNewsletterSourceGroupParams
  ): Promise<NewsletterSourceGroupOperationResult> {
    this.validateCreateParams(params);

    return this.executeWithLogging(
      async () => {
        try {
          const group = await this.withRetry(
            () => newsletterSourceGroupApi.create(params),
            'createGroup'
          );

          return {
            success: true,
            group,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'createGroup',
      { params }
    );
  }

  /**
   * Update an existing newsletter source group
   */
  async updateGroup(
    id: string,
    updates: UpdateNewsletterSourceGroupParams
  ): Promise<NewsletterSourceGroupOperationResult> {
    this.validateString(id, 'group ID');
    this.validateUpdateParams(updates);

    return this.executeWithLogging(
      async () => {
        try {
          const group = await this.withRetry(
            () => newsletterSourceGroupApi.update({ id, name: updates.name || '', sourceIds: updates.sourceIds || [] }),
            'updateGroup'
          );

          return {
            success: true,
            group,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'updateGroup',
      { id, updates }
    );
  }

  /**
   * Delete a newsletter source group
   */
  async deleteGroup(id: string): Promise<NewsletterSourceGroupOperationResult> {
    this.validateString(id, 'group ID');

    return this.executeWithLogging(
      async () => {
        try {
          await this.withRetry(
            () => newsletterSourceGroupApi.delete(id),
            'deleteGroup'
          );

          return {
            success: true,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'deleteGroup',
      { id }
    );
  }

  /**
   * Add sources to a group
   */
  async addSourcesToGroup(
    groupId: string,
    sourceIds: string[]
  ): Promise<NewsletterSourceGroupOperationResult> {
    this.validateString(groupId, 'group ID');

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      throw new ValidationError('Source IDs array cannot be empty');
    }

    return this.executeWithLogging(
      async () => {
        try {
          // First add the sources
          await this.withRetry(
            () => newsletterSourceGroupApi.addSources({ groupId, sourceIds }),
            'addSourcesToGroup'
          );

          // Then fetch the updated group
          const updatedGroup = await this.getGroup(groupId);
          if (!updatedGroup) {
            throw new Error('Failed to fetch updated group after adding sources');
          }

          return {
            success: true,
            group: updatedGroup,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'addSourcesToGroup',
      { groupId, sourceIds }
    );
  }

  /**
   * Remove sources from a group
   */
  async removeSourcesFromGroup(
    groupId: string,
    sourceIds: string[]
  ): Promise<NewsletterSourceGroupOperationResult> {
    this.validateString(groupId, 'group ID');

    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      throw new ValidationError('Source IDs array cannot be empty');
    }

    return this.executeWithLogging(
      async () => {
        try {
          // First remove the sources
          const success = await this.withRetry(
            () => newsletterSourceGroupApi.removeSources({ groupId, sourceIds }),
            'removeSourcesFromGroup'
          );

          if (!success) {
            throw new Error('Failed to remove sources from group');
          }

          // Then fetch the updated group
          const updatedGroup = await this.getGroup(groupId);
          if (!updatedGroup) {
            throw new Error('Failed to fetch updated group after removing sources');
          }

          return {
            success: true,
            group: updatedGroup,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'removeSourcesFromGroup',
      { groupId, sourceIds }
    );
  }

  /**
   * Find the group that contains a given sourceId
   */
  findGroupBySourceId(groups: NewsletterSourceGroup[], sourceId: string): NewsletterSourceGroup | null {
    for (const group of groups) {
      if (group.sources && group.sources.some(source => source.id === sourceId)) {
        return group;
      }
    }
    return null;
  }

  // /**
  //  * Delete multiple newsletter source groups
  //  */
  // async bulkDelete(ids: string[]): Promise<BulkNewsletterSourceGroupOperationResult> {
  //   if (!Array.isArray(ids) || ids.length === 0) {
  //     throw new ValidationError('IDs array cannot be empty');
  //   }

  //   return this.executeWithLogging(
  //     async () => {
  //       try {
  //         const result = await this.withRetry(
  //           () => newsletterSourceGroupApi.bulkDelete(ids),
  //           'bulkDelete'
  //         );

  //         return {
  //           success: true,
  //           failedIds: result.failed,
  //         };
  //       } catch (error) {
  //         return {
  //           success: false,
  //           error: error instanceof Error ? error.message : 'Unknown error',
  //           failedIds: ids,
  //         };
  //       }
  //     },
  //     'bulkDelete',
  //     { idsCount: ids.length }
  //   );
  // }

  /**
   * Get groups statistics
   */
  async getGroupsStats(): Promise<{
    total: number;
    totalSources: number;
    averageSourcesPerGroup: number;
  }> {
    return this.withRetry(async () => {
      const groups = await newsletterSourceGroupApi.getAll();
      const totalSources = groups.reduce((sum, group) => sum + (group.sources?.length || 0), 0);

      return {
        total: groups.length,
        totalSources,
        averageSourcesPerGroup: groups.length > 0 ? Math.round(totalSources / groups.length * 100) / 100 : 0,
      };
    }, 'getGroupsStats');
  }

  /**
   * Validate create group parameters
   */
  private validateCreateParams(params: CreateNewsletterSourceGroupParams): void {
    if (!params.name || typeof params.name !== 'string') {
      throw new ValidationError('Group name is required');
    }

    if (params.name.length < 2 || params.name.length > 100) {
      throw new ValidationError('Group name must be between 2 and 100 characters');
    }

    if (!Array.isArray(params.sourceIds)) {
      throw new ValidationError('Source IDs must be an array');
    }

    // Allow empty sourceIds array for creating empty groups
    if (params.sourceIds.some(id => typeof id !== 'string' || !id.trim())) {
      throw new ValidationError('All source IDs must be non-empty strings');
    }
  }

  /**
   * Validate update group parameters
   */
  private validateUpdateParams(params: UpdateNewsletterSourceGroupParams): void {
    if (params.name !== undefined) {
      if (typeof params.name !== 'string' || params.name.length < 2 || params.name.length > 100) {
        throw new ValidationError('Group name must be between 2 and 100 characters');
      }
    }

    if (params.sourceIds !== undefined) {
      if (!Array.isArray(params.sourceIds)) {
        throw new ValidationError('Source IDs must be an array');
      }

      if (params.sourceIds.some(id => typeof id !== 'string' || !id.trim())) {
        throw new ValidationError('All source IDs must be non-empty strings');
      }
    }
  }
}

/**
 * Standalone helper to find the group containing a sourceId
 */
export function findGroupBySourceId(groups: NewsletterSourceGroup[], sourceId: string): NewsletterSourceGroup | null {
  for (const group of groups) {
    if (group.sources && group.sources.some(source => source.id === sourceId)) {
      return group;
    }
  }
  return null;
}

// Export singleton instance
export const newsletterSourceGroupService = new NewsletterSourceGroupService();
