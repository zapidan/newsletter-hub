import { NotFoundError, ValidationError } from '../../api/errorHandling';
import { userApi } from '../../api/userApi';
import { User } from '../../types';
import { UpdateUserParams as ApiUpdateUserParams, CreateUserParams } from '../../types/api';
import { BaseService } from '../base/BaseService';

interface UserProfile {
  id: string;
  email: string;
  email_alias?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface UserStats {
  newslettersCount: number;
  tagsCount: number;
  sourcesCount: number;
  readingQueueCount: number;
  joinedAt: string;
}

interface UserOperationResult {
  success: boolean;
  profile?: UserProfile;
  user?: User;
  error?: string;
  data?: any;
}

interface EmailAliasResult {
  success: boolean;
  email?: string;
  error?: string;
}

interface UpdateUserParams {
  full_name?: string;
  avatar_url?: string;
  email_alias?: string;
}

interface SubscriptionParams {
  plan: string;
  status: string;
  expires_at?: string | null;
}

interface UserServiceOptions {
  enableOptimisticUpdates?: boolean;
  cacheTimeout?: number;
}

export class UserService extends BaseService {
  private userOptions: UserServiceOptions;

  constructor(options: UserServiceOptions = {}) {
    super({
      retryOptions: {
        maxRetries: 3,
        baseDelay: 1000,
      },
      timeout: 30000,
    });
    this.userOptions = {
      enableOptimisticUpdates: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      ...options,
    };
  }

  /**
   * Get user by ID
   */
  async getUser(id: string): Promise<User | null> {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new ValidationError('User ID is required');
    }

    return this.withRetry(async () => {
      const user = await userApi.getById(id);
      if (!user) {
        throw new NotFoundError(`User with ID ${id} not found`);
      }
      return user;
    }, 'getUser');
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    return this.withRetry(async () => {
      const user = await userApi.getCurrentUser();
      return user;
    }, 'getCurrentUser');
  }

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserProfile | null> {
    return this.withRetry(async () => {
      const profile = await userApi.getProfile();
      return profile;
    }, 'getProfile');
  }

  /**
   * Create a new user
   */
  async createUser(params: CreateUserParams): Promise<UserOperationResult> {
    const sanitizedParams = this.sanitizeCreateUserParams(params);
    this.validateCreateUserParams(sanitizedParams);

    try {
      const user = await this.withRetry(() => userApi.create(sanitizedParams), 'createUser');
      return {
        success: true,
        user,
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
   * Update user
   */
  async updateUser(id: string, updates: ApiUpdateUserParams): Promise<UserOperationResult> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('User ID is required');
    }

    const sanitizedUpdates = this.sanitizeApiUpdateParams(updates);
    this.validateApiUpdateParams(sanitizedUpdates);

    try {
      const user = await this.withRetry(
        () => userApi.update({ id, ...sanitizedUpdates }),
        'updateUser'
      );

      return {
        success: true,
        user: user,
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
   * Delete user
   */
  async deleteUser(id: string): Promise<UserOperationResult> {
    if (!id || typeof id !== 'string') {
      throw new ValidationError('User ID is required');
    }

    try {
      await this.withRetry(() => userApi.delete(id), 'deleteUser');

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
   * Update user profile
   */
  async updateProfile(updates: UpdateUserParams): Promise<UserOperationResult> {
    this.validateUpdateParams(updates);

    return this.executeWithLogging(
      async () => {
        try {
          const profile = await this.withRetry(
            () => userApi.updateProfile(updates),
            'updateProfile'
          );

          return {
            success: true,
            profile,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'updateProfile',
      { updates }
    );
  }

  /**
   * Generate email alias
   */
  async generateEmailAlias(email: string): Promise<EmailAliasResult> {
    this.validateEmail(email);

    return this.executeWithLogging(
      async () => {
        try {
          const result = await this.withRetry(
            () => userApi.generateEmailAlias(email),
            'generateEmailAlias'
          );

          if (result.error) {
            return {
              success: false,
              error: result.error,
            };
          }

          return {
            success: true,
            email: result.email,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'generateEmailAlias',
      { email }
    );
  }

  /**
   * Get or create email alias
   */
  async getEmailAlias(): Promise<EmailAliasResult> {
    return this.executeWithLogging(async () => {
      try {
        const email = await this.withRetry(() => userApi.getEmailAlias(), 'getEmailAlias');

        return {
          success: true,
          email,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }, 'getEmailAlias');
  }

  /**
   * Update email alias
   */
  async updateEmailAlias(newAlias: string): Promise<EmailAliasResult> {
    this.validateEmail(newAlias);

    return this.executeWithLogging(
      async () => {
        try {
          const result = await this.withRetry(
            () => userApi.updateEmailAlias(newAlias),
            'updateEmailAlias'
          );

          if (result.error) {
            return {
              success: false,
              error: result.error,
            };
          }

          return {
            success: true,
            email: result.email,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      },
      'updateEmailAlias',
      { newAlias }
    );
  }

  /**
   * Check if email alias is available
   */
  async isEmailAliasAvailable(alias: string): Promise<boolean> {
    this.validateEmail(alias);

    return this.withRetry(async () => {
      return await userApi.isEmailAliasAvailable(alias);
    }, 'isEmailAliasAvailable');
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<UserOperationResult> {
    return this.executeWithLogging(async () => {
      try {
        await this.withRetry(() => userApi.deleteAccount(), 'deleteAccount');

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }, 'deleteAccount');
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<UserStats> {
    return this.withRetry(async () => {
      return await userApi.getStats();
    }, 'getStats');
  }

  /**
   * Update user preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Record<string, unknown>
  ): Promise<UserOperationResult> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    if (!preferences || typeof preferences !== 'object') {
      throw new ValidationError('Preferences must be a valid object');
    }

    // Validate preferences structure
    this.validatePreferencesStructure(preferences);

    try {
      const user = await this.withRetry(
        () => userApi.updatePreferences(userId, preferences),
        'updatePreferences'
      );

      return {
        success: true,
        user,
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
   * Update user subscription
   */
  async updateSubscription(
    userId: string,
    subscription: SubscriptionParams
  ): Promise<UserOperationResult> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    if (!subscription || typeof subscription !== 'object') {
      throw new ValidationError('Subscription data is required');
    }

    this.validateSubscriptionParams(subscription);

    try {
      const user = await this.withRetry(
        () => userApi.updateSubscription(userId, subscription),
        'updateSubscription'
      );

      return {
        success: true,
        user,
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
   * Search users
   */
  async searchUsers(
    query: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<User[]> {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      throw new ValidationError('Search query is required');
    }

    const sanitizedQuery = query.trim();

    if (sanitizedQuery.length < 2) {
      throw new ValidationError('Search query must be at least 2 characters');
    }

    return this.withRetry(async () => {
      return await userApi.searchUsers(sanitizedQuery, options);
    }, 'searchUsers');
  }

  /**
   * Get user statistics
   */
  async getUserStats(
    userId?: string
  ): Promise<{ success: boolean; stats?: UserStats; error?: string }> {
    try {
      const stats = await this.withRetry(async () => {
        return await userApi.getUserStats(userId);
      }, 'getUserStats');

      return {
        success: true,
        stats,
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
   * Update last login timestamp
   */
  async updateLastLogin(userId?: string): Promise<UserOperationResult> {
    try {
      const user = await this.withRetry(() => userApi.updateLastLogin(userId), 'updateLastLogin');

      return {
        success: true,
        user,
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
   * Bulk update users
   */
  async bulkUpdate(
    updates: Array<{ id: string; updates: UpdateUserParams }>
  ): Promise<UserOperationResult> {
    if (!updates || !Array.isArray(updates)) {
      throw new ValidationError('Updates array is required');
    }

    if (updates.length === 0) {
      throw new ValidationError('Updates array cannot be empty');
    }

    const bulkParams = { users: updates };

    try {
      const result = await this.withRetry(() => userApi.bulkUpdate(bulkParams), 'bulkUpdate');

      return {
        success: true,
        users: Array.isArray(result) ? result : result.users || [],
        ...result,
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
   * Export user data
   */
  async exportUserData(userId: string): Promise<UserOperationResult> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    try {
      const data = await this.withRetry(() => userApi.exportUserData(userId), 'exportUserData');

      return {
        success: true,
        data,
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
   * Get user preferences
   */
  async getPreferences(): Promise<Record<string, unknown> | null> {
    return this.withRetry(async () => {
      return await userApi.getPreferences();
    }, 'getPreferences');
  }

  /**
   * Validate email format
   */
  private validateEmail(email: string): void {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
  }

  /**
   * Validate create user parameters
   */
  private validateCreateUserParams(params: CreateUserParams): void {
    if (!params.email || typeof params.email !== 'string') {
      throw new ValidationError('Email is required');
    }
    this.validateEmail(params.email);

    if (!params.name || typeof params.name !== 'string') {
      throw new ValidationError('Name is required');
    }
    if (params.name.length < 2 || params.name.length > 100) {
      throw new ValidationError('Name must be between 2 and 100 characters');
    }

    if (params.avatar_url !== undefined) {
      if (typeof params.avatar_url !== 'string') {
        throw new ValidationError('Avatar URL must be a string');
      }
      if (params.avatar_url.length > 500) {
        throw new ValidationError('Avatar URL must be 500 characters or less');
      }
      this.validateUrl(params.avatar_url);
    }
  }

  /**
   * Sanitize create user parameters
   */
  private sanitizeCreateUserParams(params: CreateUserParams): CreateUserParams {
    return {
      ...params,
      email: params.email?.trim().toLowerCase(),
      name: params.name?.trim(),
      avatar_url: params.avatar_url?.trim(),
    };
  }

  /**
   * Validate URL format
   */
  private validateUrl(url: string): void {
    try {
      const parsedUrl = new URL(url);

      // Only allow safe protocols
      const allowedProtocols = ['http:', 'https:'];
      if (!allowedProtocols.includes(parsedUrl.protocol)) {
        throw new ValidationError('Invalid avatar URL format');
      }

      // Must have a hostname
      if (!parsedUrl.hostname) {
        throw new ValidationError('Invalid avatar URL format');
      }
    } catch {
      throw new ValidationError('Invalid avatar URL format');
    }
  }

  /**
   * Validate subscription parameters
   */
  private validateSubscriptionParams(subscription: SubscriptionParams): void {
    const validPlans = ['free', 'premium', 'enterprise'];
    const validStatuses = ['active', 'inactive', 'cancelled', 'expired'];

    if (!validPlans.includes(subscription.plan)) {
      throw new ValidationError('Invalid subscription plan');
    }

    if (!validStatuses.includes(subscription.status)) {
      throw new ValidationError('Invalid subscription status');
    }

    if (subscription.expires_at !== undefined && subscription.expires_at !== null) {
      if (typeof subscription.expires_at !== 'string') {
        throw new ValidationError('Invalid expiration date format');
      }

      const date = new Date(subscription.expires_at);
      if (isNaN(date.getTime())) {
        throw new ValidationError('Invalid expiration date format');
      }
    }
  }

  /**
   * Validate API update parameters
   */
  private validateApiUpdateParams(params: ApiUpdateUserParams): void {
    if (params.name !== undefined) {
      if (typeof params.name !== 'string') {
        throw new ValidationError('Name must be a string');
      }
      if (params.name.length < 2 || params.name.length > 100) {
        throw new ValidationError('Name must be between 2 and 100 characters');
      }
    }

    if (params.email !== undefined) {
      this.validateEmail(params.email);
    }

    if (params.avatar_url !== undefined) {
      if (typeof params.avatar_url !== 'string') {
        throw new ValidationError('Avatar URL must be a string');
      }
      if (params.avatar_url.length > 500) {
        throw new ValidationError('Avatar URL must be 500 characters or less');
      }
      this.validateUrl(params.avatar_url);
    }
  }

  /**
   * Sanitize API update parameters
   */
  private sanitizeApiUpdateParams(params: ApiUpdateUserParams): ApiUpdateUserParams {
    const sanitized: ApiUpdateUserParams = { ...params };

    if (sanitized.email !== undefined) {
      sanitized.email = sanitized.email.trim().toLowerCase();
    }

    if (sanitized.name !== undefined) {
      sanitized.name = sanitized.name.trim();
    }

    if (sanitized.avatar_url !== undefined) {
      sanitized.avatar_url = sanitized.avatar_url.trim();
    }

    return sanitized;
  }

  /**
   * Validate preferences structure
   */
  private validatePreferencesStructure(preferences: Record<string, unknown>): void {
    // Check for invalid structure that tests expect to fail
    if (preferences === null || Array.isArray(preferences)) {
      throw new ValidationError('Invalid preferences format');
    }

    // Check for required fields in invalid format
    if (preferences.theme !== undefined && typeof preferences.theme !== 'string') {
      throw new ValidationError('Invalid preferences format');
    }
    if (
      preferences.notifications !== undefined &&
      (typeof preferences.notifications !== 'object' || preferences.notifications === null)
    ) {
      throw new ValidationError('Invalid preferences format');
    }
    if (
      preferences.reading !== undefined &&
      (typeof preferences.reading !== 'object' || preferences.reading === null)
    ) {
      throw new ValidationError('Invalid preferences format');
    }
  }

  /**
   * Validate update parameters
   */
  private validateUpdateParams(params: UpdateUserParams): void {
    if (params.full_name !== undefined) {
      if (typeof params.full_name !== 'string') {
        throw new ValidationError('Full name must be a string');
      }
      if (params.full_name.length > 100) {
        throw new ValidationError('Full name must be 100 characters or less');
      }
    }

    if (params.avatar_url !== undefined) {
      if (typeof params.avatar_url !== 'string') {
        throw new ValidationError('Avatar URL must be a string');
      }
      if (params.avatar_url.length > 500) {
        throw new ValidationError('Avatar URL must be 500 characters or less');
      }
    }

    if (params.email_alias !== undefined) {
      this.validateEmail(params.email_alias);
    }
  }
}

// Export singleton instance
export const userService = new UserService();
