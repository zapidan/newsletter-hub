import { BaseService, ValidationError, NotFoundError } from '../base/BaseService';
import { tagApi } from '@common/api/tagApi';
import { newsletterApi } from '@common/api/newsletterApi';
import { Tag, TagCreate, TagUpdate, TagWithCount, NewsletterWithRelations } from '@common/types';
import { logger } from '@common/utils/logger';

export interface TagOperationResult {
  success: boolean;
  tag?: Tag;
  error?: string;
}

export interface BulkTagOperationResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: Array<{ name: string; error: string }>;
}

export interface TagUsageStats {
  tag: Tag;
  newsletterCount: number;
  recentNewsletters: NewsletterWithRelations[];
}

export interface TagServiceOptions {
  enableAutoComplete?: boolean;
  maxSuggestions?: number;
  cacheTagUsage?: boolean;
}

export class TagService extends BaseService {
  private tagOptions: TagServiceOptions;
  private colorPalette: string[] = [
    '#3b82f6',
    '#ef4444',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#ec4899',
    '#6366f1',
    '#14b8a6',
    '#eab308',
    '#f43f5e',
    '#a855f7',
    '#0ea5e9',
  ];

  constructor(options: TagServiceOptions = {}) {
    super({
      retryOptions: {
        maxRetries: 3,
        baseDelay: 1000,
      },
      timeout: 30000,
    });
    this.tagOptions = {
      enableAutoComplete: true,
      maxSuggestions: 10,
      cacheTagUsage: true,
      ...options,
    };
  }

  /**
   * Get all tags for current user with optional usage statistics
   */
  async getAllTags(includeUsageStats: boolean = false): Promise<TagWithCount[]> {
    return this.executeWithLogging(
      async () => {
        if (includeUsageStats) {
          return await this.withRetry(() => tagApi.getTagUsageStats(), 'getAllTagsWithUsage');
        } else {
          const tags = await this.withRetry(() => tagApi.getAll(), 'getAllTags');
          return tags.map((tag) => ({ ...tag, newsletter_count: 0 }));
        }
      },
      'getAllTags',
      { includeUsageStats }
    );
  }

  /**
   * Get a single tag by ID
   */
  async getTag(id: string): Promise<Tag | null> {
    this.validateString(id, 'tag ID');

    return this.withRetry(async () => {
      const tag = await tagApi.getById(id);
      if (!tag) {
        throw new NotFoundError(`Tag with ID ${id} not found`);
      }
      return tag;
    }, 'getTag');
  }

  /**
   * Create a new tag with business validation
   */
  async createTag(tagData: Omit<TagCreate, 'user_id'>): Promise<TagOperationResult> {
    return this.executeWithLogging(
      async () => {
        try {
          // Validate and sanitize input
          const sanitizedName = this.sanitizeTagName(tagData.name);
          const validatedColor = this.validateColor(tagData.color);

          // Check for duplicates
          const existingTags = await tagApi.getAll();
          const duplicate = existingTags.find(
            (tag) => tag.name.toLowerCase() === sanitizedName.toLowerCase()
          );

          if (duplicate) {
            return {
              success: false,
              error: `Tag with name "${sanitizedName}" already exists`,
            };
          }

          // Apply business logic for color selection
          const finalColor = validatedColor || this.getNextAvailableColor(existingTags);

          const newTag = await this.withRetry(
            () =>
              tagApi.create({
                name: sanitizedName,
                color: finalColor,
              }),
            'createTag'
          );

          return {
            success: true,
            tag: newTag,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'createTag',
      { name: tagData.name }
    );
  }

  /**
   * Update an existing tag
   */
  async updateTag(tagData: TagUpdate): Promise<TagOperationResult> {
    this.validateString(tagData.id, 'tag ID');

    return this.executeWithLogging(
      async () => {
        try {
          // Validate tag exists
          const existingTag = await tagApi.getById(tagData.id);
          if (!existingTag) {
            return {
              success: false,
              error: 'Tag not found',
            };
          }

          // Validate and sanitize input
          const updates: Partial<TagUpdate> = {};

          if (tagData.name !== undefined) {
            const sanitizedName = this.sanitizeTagName(tagData.name);

            // Check for duplicates (excluding current tag)
            const existingTags = await tagApi.getAll();
            const duplicate = existingTags.find(
              (tag) =>
                tag.id !== tagData.id && tag.name.toLowerCase() === sanitizedName.toLowerCase()
            );

            if (duplicate) {
              return {
                success: false,
                error: `Tag with name "${sanitizedName}" already exists`,
              };
            }

            updates.name = sanitizedName;
          }

          if (tagData.color !== undefined) {
            updates.color = this.validateColor(tagData.color);
          }

          const updatedTag = await this.withRetry(
            () => tagApi.update({ id: tagData.id, ...updates }),
            'updateTag'
          );

          return {
            success: true,
            tag: updatedTag,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'updateTag',
      { tagId: tagData.id }
    );
  }

  /**
   * Delete a tag with business validation
   */
  async deleteTag(id: string): Promise<TagOperationResult> {
    this.validateString(id, 'tag ID');

    return this.executeWithLogging(
      async () => {
        try {
          // Check if tag exists
          const tag = await tagApi.getById(id);
          if (!tag) {
            return {
              success: false,
              error: 'Tag not found',
            };
          }

          // Check usage - warn if tag is heavily used
          const newsletters = await this.getNewslettersWithTag(id);

          if (newsletters.length > 0) {
            logger.warn(`Deleting tag with ${newsletters.length} associated newsletters`, {
              component: 'TagService',
              action: 'delete_tag_with_usage',
              metadata: {
                tagId: id,
                tagName: tag.name,
                usageCount: newsletters.length,
              },
            });
          }

          const success = await this.withRetry(() => tagApi.delete(id), 'deleteTag');

          if (!success) {
            return {
              success: false,
              error: 'Failed to delete tag',
            };
          }

          return {
            success: true,
            tag,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'deleteTag',
      { tagId: id }
    );
  }

  /**
   * Get or create a tag by name (smart tag creation)
   */
  async getOrCreateTag(name: string, color?: string): Promise<TagOperationResult> {
    const sanitizedName = this.sanitizeTagName(name);

    return this.executeWithLogging(
      async () => {
        try {
          const tag = await this.withRetry(
            () => tagApi.getOrCreate(sanitizedName, color),
            'getOrCreateTag'
          );

          return {
            success: true,
            tag,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'getOrCreateTag',
      { name: sanitizedName }
    );
  }

  /**
   * Update newsletter tags with business validation
   */
  async updateNewsletterTagsWithIds(
    newsletterId: string,
    tagIds: string[]
  ): Promise<TagOperationResult> {
    this.validateString(newsletterId, 'newsletter ID');
    this.validateArray(tagIds, 'tag IDs');

    return this.executeWithLogging(
      async () => {
        try {
          // Validate all tags exist
          const tags: Tag[] = [];
          for (const tagId of tagIds) {
            const tag = await tagApi.getById(tagId);
            if (!tag) {
              return {
                success: false,
                error: `Tag with ID ${tagId} not found`,
              };
            }
            tags.push(tag);
          }

          // Apply business rules
          if (tags.length > 10) {
            return {
              success: false,
              error: 'Cannot assign more than 10 tags to a newsletter',
            };
          }

          const success = await this.withRetry(
            () => tagApi.updateNewsletterTags(newsletterId, tags),
            'updateNewsletterTags'
          );

          if (!success) {
            return {
              success: false,
              error: 'Failed to update newsletter tags',
            };
          }

          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'updateNewsletterTags',
      { newsletterId, tagCount: tagIds.length }
    );
  }

  /**
   * Search tags with intelligent suggestions
   */
  async searchTags(query: string): Promise<Tag[]> {
    this.validateString(query, 'search query', { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const trimmedQuery = query.trim();

        if (trimmedQuery.length === 0) {
          return [];
        }

        return await this.withRetry(() => tagApi.search(trimmedQuery), 'searchTags');
      },
      'searchTags',
      { query }
    );
  }

  /**
   * Get tag suggestions based on usage patterns
   */
  async getTagSuggestions(context?: {
    newsletterContent?: string;
    existingTags?: Tag[];
    sourceId?: string;
  }): Promise<Tag[]> {
    return this.executeWithLogging(
      async () => {
        // Get all tags with usage stats
        const tagsWithStats = await this.getAllTags(true);

        // Apply business logic for suggestions
        let suggestions = tagsWithStats
          .filter((tag) => tag.newsletter_count > 0)
          .sort((a, b) => b.newsletter_count - a.newsletter_count)
          .slice(0, this.tagOptions.maxSuggestions!);

        // Filter out already applied tags
        if (context?.existingTags) {
          const existingTagIds = new Set(context.existingTags.map((t) => t.id));
          suggestions = suggestions.filter((tag) => !existingTagIds.has(tag.id));
        }

        // Future: Add content-based suggestions using NLP
        if (context?.newsletterContent) {
          suggestions = this.enhanceWithContentBasedSuggestions(
            suggestions,
            context.newsletterContent
          );
        }

        return suggestions.slice(0, this.tagOptions.maxSuggestions!);
      },
      'getTagSuggestions',
      { hasContext: !!context }
    );
  }

  /**
   * Get detailed tag usage statistics
   */
  async getTagUsageStats(tagId: string): Promise<TagUsageStats | null> {
    this.validateString(tagId, 'tag ID');

    return this.executeWithLogging(
      async () => {
        const tag = await tagApi.getById(tagId);
        if (!tag) {
          return null;
        }

        const newsletters = await this.getNewslettersWithTag(tagId);

        return {
          tag,
          newsletterCount: newsletters.length,
          recentNewsletters: newsletters
            .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
            .slice(0, 5),
        };
      },
      'getTagUsageStats',
      { tagId }
    );
  }

  /**
   * Bulk create tags with validation
   */
  async bulkCreateTags(
    tagDataArray: Array<Omit<TagCreate, 'user_id'>>
  ): Promise<BulkTagOperationResult> {
    this.validateArray(tagDataArray, 'tag data array', { minLength: 1 });

    return this.executeWithLogging(
      async () => {
        const results: Array<{
          name: string;
          success: boolean;
          error?: string;
        }> = [];

        for (const tagData of tagDataArray) {
          try {
            const result = await this.createTag(tagData);
            results.push({
              name: tagData.name,
              success: result.success,
              error: result.error,
            });
          } catch (error) {
            results.push({
              name: tagData.name,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        const processedCount = results.filter((r) => r.success).length;
        const failedCount = results.length - processedCount;
        const errors = results
          .filter((r) => !r.success)
          .map((r) => ({ name: r.name, error: r.error || 'Unknown error' }));

        return {
          success: failedCount === 0,
          processedCount,
          failedCount,
          errors,
        };
      },
      'bulkCreateTags',
      { count: tagDataArray.length }
    );
  }

  /**
   * Private helper methods
   */

  private sanitizeTagName(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Tag name is required and must be a string');
    }

    const sanitized = name.trim().replace(/\s+/g, ' ');

    if (sanitized.length === 0) {
      throw new ValidationError('Tag name cannot be empty');
    }

    if (sanitized.length > 50) {
      throw new ValidationError('Tag name cannot exceed 50 characters');
    }

    return sanitized;
  }

  private validateColor(color?: string): string {
    if (!color) {
      return '#3b82f6'; // default blue
    }

    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(color)) {
      throw new ValidationError('Color must be a valid hex color (e.g., #3b82f6)');
    }

    return color;
  }

  private getNextAvailableColor(existingTags: Tag[]): string {
    const usedColors = new Set(existingTags.map((tag) => tag.color.toLowerCase()));

    for (const color of this.colorPalette) {
      if (!usedColors.has(color.toLowerCase())) {
        return color;
      }
    }

    // If all palette colors are used, generate a random one
    return (
      '#' +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0')
    );
  }

  private async getNewslettersWithTag(tagId: string): Promise<NewsletterWithRelations[]> {
    try {
      const response = await newsletterApi.getAll({
        tagIds: [tagId],
        includeSource: true,
        includeTags: true,
        limit: 1000,
      });
      return response.data;
    } catch (error) {
      logger.warn(
        'Failed to get newsletters for tag',
        {
          component: 'TagService',
          action: 'get_newsletters_with_tag',
          metadata: { tagId },
        },
        error instanceof Error ? error : new Error(String(error))
      );
      return [];
    }
  }

  private enhanceWithContentBasedSuggestions(
    suggestions: TagWithCount[],
    content: string // eslint-disable-line @typescript-eslint/no-unused-vars
  ): TagWithCount[] {
    // Future implementation: Use NLP to analyze content and suggest relevant tags
    // For now, return suggestions as-is
    return suggestions;
  }

  /**
   * Alias methods for backward compatibility
   */

  // Alias for getAllTags
  async getAll(): Promise<Tag[]> {
    const tagsWithCount = await this.getAllTags(false);
    return tagsWithCount.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      user_id: tag.user_id,
      created_at: tag.created_at,
      updated_at: tag.updated_at,
    }));
  }

  // Alias for createTag
  async create(tagData: TagCreate): Promise<Tag> {
    const result = await this.createTag(tagData);
    if (!result.success || !result.tag) {
      throw new Error(result.error || 'Failed to create tag');
    }
    return result.tag;
  }

  // Alias for updateTag
  async update(tagData: TagUpdate): Promise<Tag> {
    const result = await this.updateTag(tagData);
    if (!result.success || !result.tag) {
      throw new Error(result.error || 'Failed to update tag');
    }
    return result.tag;
  }

  // Alias for deleteTag
  async delete(id: string): Promise<void> {
    const result = await this.deleteTag(id);
    if (!result.success) {
      throw new Error(result.error || 'Failed to delete tag');
    }
  }

  // Get tags for a specific newsletter
  async getTagsForNewsletter(newsletterId: string): Promise<Tag[]> {
    this.validateString(newsletterId, 'newsletter ID');
    return await this.withRetry(
      () => tagApi.getTagsForNewsletter(newsletterId),
      'getTagsForNewsletter'
    );
  }

  // Update newsletter tags (alias method)
  async updateNewsletterTags(newsletterId: string, tags: Tag[]): Promise<void> {
    const tagIds = tags.map((tag) => tag.id);
    const result = await this.updateNewsletterTagsWithIds(newsletterId, tagIds);
    if (!result.success) {
      throw new Error(result.error || 'Failed to update newsletter tags');
    }
  }
}

// Export singleton instance
export const tagService = new TagService();
