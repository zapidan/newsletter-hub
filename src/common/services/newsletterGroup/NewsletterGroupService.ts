import { newsletterGroupApi } from '../../api/newsletterGroupApi';
import { NewsletterGroup } from '../../types';
import { BaseService, NotFoundError, ValidationError } from '../base/BaseService';

/** Max groups a source can belong to. Enforced by database trigger and service layer. */
const MAX_GROUPS_PER_SOURCE = 10;

/** Error message when a source would exceed the maximum number of groups */
const MAX_GROUPS_ERROR = `A source cannot belong to more than ${MAX_GROUPS_PER_SOURCE} groups`;

interface NewsletterGroupOperationResult {
  success: boolean;
  group?: NewsletterGroup;
  error?: string;
}

interface NewsletterGroupServiceOptions {
  batchSize?: number;
}

interface CreateNewsletterGroupParams {
  name: string;
  color?: string;
  sourceIds?: string[];
}

interface UpdateNewsletterGroupParams {
  name?: string;
  color?: string;
  sourceIds?: string[];
}

/**
 * Service for newsletter groups. Groups are associated with newsletter_sources;
 * newsletters inherit group membership from their source (newsletter_source_id).
 * All operations validate source ownership via the API/RLS.
 */
export class NewsletterGroupService extends BaseService {
  constructor(_options: NewsletterGroupServiceOptions = {}) {
    super({
      retryOptions: { maxRetries: 3, baseDelay: 1000 },
      timeout: 30000,
    });
  }

  async getGroups(): Promise<NewsletterGroup[]> {
    return this.withRetry(() => newsletterGroupApi.getAll(), 'getGroups');
  }

  async getGroup(id: string): Promise<NewsletterGroup> {
    this.validateString(id, 'Group ID');
    return this.withRetry(async () => {
      const group = await newsletterGroupApi.getById(id);
      if (!group) {
        throw new NotFoundError(`Newsletter group with ID ${id} not found`);
      }
      return group;
    }, 'getGroup');
  }

  async createGroup(params: CreateNewsletterGroupParams): Promise<NewsletterGroupOperationResult> {
    this.validateCreateParams(params);

    return this.executeWithLogging(
      async () => {
        try {
          const group = await this.withRetry(
            () => newsletterGroupApi.create({
              name: params.name,
              color: params.color,
              sourceIds: params.sourceIds ?? [],
            }),
            'createGroup'
          );
          return { success: true, group };
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

  async updateGroup(
    id: string,
    updates: UpdateNewsletterGroupParams
  ): Promise<NewsletterGroupOperationResult> {
    this.validateString(id, 'group ID');
    this.validateUpdateParams(updates);

    return this.executeWithLogging(
      async () => {
        try {
          const group = await this.withRetry(
            () =>
              newsletterGroupApi.update({
                id,
                name: updates.name,
                color: updates.color,
                sourceIds: updates.sourceIds,
              }),
            'updateGroup'
          );
          return { success: true, group };
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

  async deleteGroup(id: string): Promise<NewsletterGroupOperationResult> {
    this.validateString(id, 'group ID');

    return this.executeWithLogging(
      async () => {
        try {
          await this.withRetry(() => newsletterGroupApi.delete(id), 'deleteGroup');
          return { success: true };
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

  /** Add sources to a group. Source ownership is validated by RLS. */
  async addSourcesToGroup(
    groupId: string,
    sourceIds: string[]
  ): Promise<NewsletterGroupOperationResult> {
    this.validateString(groupId, 'group ID');
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      throw new ValidationError('Source IDs array cannot be empty');
    }
    this.validateSourceIds(sourceIds);

    // Check if adding these sources would exceed the group limit
    for (const sourceId of sourceIds) {
      try {
        const currentGroups = await this.getSourceGroups(sourceId);
        const groupIds = currentGroups.map(g => g.id);

        // If the source is already in this group, skip the check
        if (groupIds.includes(groupId)) {
          continue;
        }

        // Check if adding this source would exceed the limit
        if (currentGroups.length >= MAX_GROUPS_PER_SOURCE) {
          throw new ValidationError(MAX_GROUPS_ERROR);
        }
      } catch (error) {
        if (error instanceof ValidationError) throw error;
        // If we can't verify the current groups, let the API handle the limit
      }
    }

    return this.executeWithLogging(
      async () => {
        try {
          await this.withRetry(
            () => newsletterGroupApi.addSources({ groupId, sourceIds }),
            'addSourcesToGroup'
          );
          const group = await this.getGroup(groupId);
          return { success: true, group };
        } catch (error) {
          return {
            success: false,
            error: this.normalizeErrorMessage(error),
          };
        }
      },
      'addSourcesToGroup',
      { groupId, sourceIds }
    );
  }

  /** Remove sources from a group. */
  async removeSourcesFromGroup(
    groupId: string,
    sourceIds: string[]
  ): Promise<NewsletterGroupOperationResult> {
    this.validateString(groupId, 'group ID');
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
      throw new ValidationError('Source IDs array cannot be empty');
    }
    this.validateSourceIds(sourceIds);

    return this.executeWithLogging(
      async () => {
        try {
          await this.withRetry(
            () => newsletterGroupApi.removeSources({ groupId, sourceIds }),
            'removeSourcesFromGroup'
          );
          const group = await this.getGroup(groupId);
          return { success: true, group };
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

  /** Set the groups for a source. Replaces existing memberships. Source ownership validated by RLS. */
  async updateSourceGroups(
    sourceId: string,
    groupIds: string[]
  ): Promise<{ success: boolean; groups?: NewsletterGroup[]; error?: string }> {
    this.validateString(sourceId, 'source ID');
    if (!Array.isArray(groupIds)) {
      throw new ValidationError('Group IDs must be an array');
    }

    // Remove duplicates
    const uniqueGroupIds = [...new Set(groupIds)];

    if (uniqueGroupIds.length > MAX_GROUPS_PER_SOURCE) {
      throw new ValidationError(MAX_GROUPS_ERROR);
    }

    if (uniqueGroupIds.some((id) => typeof id !== 'string' || !id.trim())) {
      throw new ValidationError('All group IDs must be non-empty strings');
    }

    return this.executeWithLogging(
      async () => {
        try {
          const groups = await this.withRetry(
            () => newsletterGroupApi.updateSourceGroups(sourceId, groupIds),
            'updateSourceGroups'
          );
          return { success: true, groups };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'updateSourceGroups',
      { sourceId, groupIds }
    );
  }

  /** Get all groups that contain the given source. Newsletters inherit from their source. */
  async getSourceGroups(sourceId: string): Promise<NewsletterGroup[]> {
    this.validateString(sourceId, 'source ID');
    return this.withRetry(
      () => newsletterGroupApi.getSourceGroups(sourceId),
      'getSourceGroups'
    );
  }

  /** Get all sources in a group. */
  async getGroupSources(groupId: string): Promise<Awaited<ReturnType<typeof newsletterGroupApi.getGroupSources>>> {
    this.validateString(groupId, 'group ID');
    return this.withRetry(
      () => newsletterGroupApi.getGroupSources(groupId),
      'getGroupSources'
    );
  }

  async getGroupsStats(): Promise<{
    total: number;
    totalSources: number;
    averageSourcesPerGroup: number;
    groupsWithoutSources: number;
  }> {
    return this.withRetry(async () => {
      const stats = await newsletterGroupApi.getStats();
      return {
        total: stats.totalGroups,
        totalSources: stats.totalSources,
        averageSourcesPerGroup: Math.round(stats.averageSourcesPerGroup * 100) / 100,
        groupsWithoutSources: stats.groupsWithoutSources || 0,
      };
    }, 'getGroupsStats');
  }

  async searchGroups(query: string): Promise<NewsletterGroup[]> {
    this.validateString(query, 'search query');
    return this.withRetry(() => newsletterGroupApi.search(query), 'searchGroups');
  }

  private validateSourceIds(ids: string[]): void {
    if (!Array.isArray(ids)) {
      throw new ValidationError('Source IDs must be an array');
    }
    if (ids.some((id) => typeof id !== 'string' || !id.trim())) {
      throw new ValidationError('All source IDs must be non-empty strings');
    }
  }

  private validateCreateParams(params: CreateNewsletterGroupParams): void {
    if (!params.name || typeof params.name !== 'string') {
      throw new ValidationError('Group name is required');
    }
    if (params.name.length < 2 || params.name.length > 100) {
      throw new ValidationError('Group name must be between 2 and 100 characters');
    }
    if (params.color !== undefined && !/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(params.color)) {
      throw new ValidationError('Color must be a valid hex color (e.g. #3b82f6)');
    }
    const ids = params.sourceIds ?? [];
    if (!Array.isArray(ids)) throw new ValidationError('Source IDs must be an array');
    if (ids.length > MAX_GROUPS_PER_SOURCE) {
      throw new ValidationError(MAX_GROUPS_ERROR);
    }
    if (ids.some((id) => typeof id !== 'string' || !id.trim())) {
      throw new ValidationError('All source IDs must be non-empty strings');
    }
  }

  private validateUpdateParams(params: UpdateNewsletterGroupParams): void {
    if (params.name !== undefined) {
      if (typeof params.name !== 'string' || params.name.length < 2 || params.name.length > 100) {
        throw new ValidationError('Group name must be between 2 and 100 characters');
      }
    }
    if (params.color !== undefined && !/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(params.color)) {
      throw new ValidationError('Color must be a valid hex color (e.g. #3b82f6)');
    }
    if (params.sourceIds !== undefined) {
      if (!Array.isArray(params.sourceIds)) {
        throw new ValidationError('Source IDs must be an array');
      }
      if (params.sourceIds.length > MAX_GROUPS_PER_SOURCE) {
        throw new ValidationError(MAX_GROUPS_ERROR);
      }
      if (params.sourceIds.some((id) => typeof id !== 'string' || !id.trim())) {
        throw new ValidationError('All source IDs must be non-empty strings');
      }
    }
  }

  /**
   * Normalizes error messages from different sources (API, validation, etc.)
   * to ensure consistent error messages across the application.
   */
  private normalizeErrorMessage(error: unknown): string {
    if (!error) return 'An unknown error occurred';
    if (typeof error === 'string') return error;
    if (error instanceof Error) {
      // Handle common error messages from the API
      if (error.message.includes('cannot belong to more than 10')) {
        return MAX_GROUPS_ERROR;
      }
      if (error.message.includes('violates row-level security')) {
        return 'You do not have permission to perform this action';
      }
      if (error.message.includes('duplicate key value violates unique constraint')) {
        return 'This source is already in the specified group';
      }
      return error.message;
    }
    return 'An unexpected error occurred';
  }

}

export const newsletterGroupService = new NewsletterGroupService();
