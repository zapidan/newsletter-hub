import { generateEmailAliasFromEmail } from '../utils/emailAlias';
import { logger } from '../utils/logger';
import {
  handleSupabaseError,
  requireAuth,
  supabase,
  withPerformanceLogging,
} from './supabaseClient';

interface UserProfile {
  id: string;
  email: string;
  email_alias?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface EmailAliasResult {
  email: string;
  error?: string;
}

interface UpdateUserParams {
  full_name?: string;
  avatar_url?: string;
  email_alias?: string;
}

// Initialize logger
const log = logger;

// User API Service
export const userApi = {
  // Get user by ID
  async getById(id: string): Promise<UserProfile | null> {
    return withPerformanceLogging('user.getById', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, created_at, updated_at')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      return data;
    });
  },

  // Get current user profile
  async getCurrentUser(): Promise<UserProfile | null> {
    return withPerformanceLogging('user.getCurrentUser', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, created_at, updated_at')
        .eq('id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      return data;
    });
  },

  // Get current user profile (alias)
  async getProfile(): Promise<UserProfile | null> {
    return this.getCurrentUser();
  },

  // Create a new user
  async create(params: {
    email: string;
    name: string;
    avatar_url?: string;
    preferences?: any;
  }): Promise<UserProfile> {
    return withPerformanceLogging('user.create', async () => {
      // Validate required fields
      if (!params.email) {
        throw new Error('Email is required');
      }
      if (!params.name) {
        throw new Error('Name is required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(params.email)) {
        throw new Error('Invalid email format');
      }

      // Check for duplicate email
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', params.email)
        .maybeSingle();

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create user with default preferences
      const defaultPreferences = {
        theme: 'light',
        notifications: {
          email: true,
          push: false,
          newsletter_digest: true,
        },
        reading: {
          auto_mark_read: false,
          reading_speed: 200,
          preferred_view: 'list',
        },
        ...params.preferences,
      };

      const { data, error } = await supabase
        .from('users')
        .insert({
          email: params.email,
          full_name: params.name,
          avatar_url: params.avatar_url,
          preferences: defaultPreferences,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Update user
  async update(params: {
    id: string;
    name?: string;
    email?: string;
    avatar_url?: string;
    preferences?: any;
  }): Promise<UserProfile> {
    return withPerformanceLogging('user.update', async () => {
      // Validate email format if provided
      if (params.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(params.email)) {
          throw new Error('Invalid email format');
        }

        // Check for duplicate email
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', params.email)
          .neq('id', params.id)
          .maybeSingle();

        if (existingUser) {
          throw new Error('User with this email already exists');
        }
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (params.name !== undefined) updateData.full_name = params.name;
      if (params.email !== undefined) updateData.email = params.email;
      if (params.avatar_url !== undefined) updateData.avatar_url = params.avatar_url;
      if (params.preferences !== undefined) updateData.preferences = params.preferences;

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Delete user
  async delete(id: string): Promise<boolean> {
    return withPerformanceLogging('user.delete', async () => {
      const { error } = await supabase.from('users').delete().eq('id', id);

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Update user profile
  async updateProfile(updates: UpdateUserParams): Promise<UserProfile> {
    return withPerformanceLogging('user.updateProfile', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Generate a unique email alias for a user
  async generateEmailAlias(email: string): Promise<EmailAliasResult> {
    return withPerformanceLogging('user.generateEmailAlias', async () => {
      const user = await requireAuth();
      let emailAlias = generateEmailAliasFromEmail(email);
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;

      try {
        // Try to find a unique email alias
        while (!isUnique && attempts < maxAttempts) {
          try {
            // Check if the alias already exists
            const { data: existingUser } = await supabase
              .from('user_profiles')
              .select('id')
              .eq('email_alias', emailAlias)
              .single();

            if (!existingUser) {
              // Alias is available
              isUnique = true;
            } else {
              // Generate a new alias with random numbers
              attempts++;
              const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
              const baseAlias = emailAlias.split('@')[0];
              emailAlias = `${baseAlias}${randomSuffix}@${emailAlias.split('@')[1]}`;

              log.info('Email alias already exists, trying with suffix', {
                component: 'UserApi',
                metadata: {
                  userId: user.id,
                  originalAlias: generateEmailAliasFromEmail(email),
                  newAlias: emailAlias,
                  attempt: attempts
                }
              });
            }
          } catch (_error) {
            // If there's an error checking the alias, assume it's available
            isUnique = true;
          }
        }

        // Save to the database
        const { error } = await supabase
          .from('users')
          .update({ email_alias: emailAlias })
          .eq('id', user.id);

        if (error) {
          log.error(
            'Error saving email alias',
            {
              component: 'UserApi',
              action: 'save_email_alias',
              metadata: { userId: user.id },
            },
            error
          );
          return { email: '', error: 'Failed to save email alias' };
        }

        return { email: emailAlias };
      } catch (error) {
        log.error(
          'Error generating email alias',
          {
            component: 'UserApi',
            action: 'generate_email_alias',
            metadata: { email },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        return { email: '', error: 'Failed to generate email alias' };
      }
    });
  },

  // Get or create an email alias for the current user
  async getEmailAlias(): Promise<string> {
    return withPerformanceLogging('user.getEmailAlias', async () => {
      const user = await requireAuth();

      try {
        // First check if user already has an email alias
        const { data: userData } = await supabase
          .from('users')
          .select('email_alias')
          .eq('id', user.id)
          .single();

        // If we got the user data and they have an alias, return it
        if (userData?.email_alias) {
          return userData.email_alias;
        }

        // If no alias exists, generate a new one
        if (!user.email) {
          throw new Error('User email not found');
        }

        const { email, error: genError } = await this.generateEmailAlias(user.email);

        if (genError || !email) {
          throw new Error(genError || 'Failed to generate email alias');
        }

        return email;
      } catch (error) {
        log.error(
          'Error in getEmailAlias',
          {
            component: 'UserApi',
            action: 'get_email_alias',
            metadata: { userId: user.id },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        throw error;
      }
    });
  },

  // Update a user's email alias
  async updateEmailAlias(newAlias: string): Promise<EmailAliasResult> {
    return withPerformanceLogging('user.updateEmailAlias', async () => {
      const user = await requireAuth();

      try {
        // Check if the alias is already taken
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('email_alias', newAlias)
          .neq('id', user.id)
          .maybeSingle();

        if (data) {
          return { email: '', error: 'This email alias is already taken' };
        }

        // Update the user's email alias
        const { error: updateError } = await supabase
          .from('users')
          .update({ email_alias: newAlias })
          .eq('id', user.id);

        if (updateError) {
          log.error(
            'Error updating user with email alias',
            {
              component: 'UserApi',
              action: 'update_email_alias',
              metadata: { userId: user.id, newAlias },
            },
            updateError
          );
          return { email: '', error: 'Error saving email alias' };
        }

        return { email: newAlias };
      } catch (error) {
        log.error(
          'Error in updateEmailAlias',
          {
            component: 'UserApi',
            action: 'update_email_alias',
            metadata: { userId: user.id, newAlias },
          },
          error instanceof Error ? error : new Error(String(error))
        );
        return { email: '', error: 'Internal server error' };
      }
    });
  },

  // Check if email alias is available
  async isEmailAliasAvailable(alias: string): Promise<boolean> {
    return withPerformanceLogging('user.isEmailAliasAvailable', async () => {
      const user = await requireAuth();

      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('email_alias', alias)
        .neq('id', user.id)
        .maybeSingle();

      return !data; // Available if no data found
    });
  },

  // Delete user account and all associated data
  async deleteAccount(): Promise<boolean> {
    return withPerformanceLogging('user.deleteAccount', async () => {
      const user = await requireAuth();

      // Note: This should cascade delete related data based on your database constraints
      const { error } = await supabase.from('users').delete().eq('id', user.id);

      if (error) handleSupabaseError(error);

      // Also delete from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
      if (authError) {
        log.error(
          'Error deleting user from auth',
          {
            component: 'UserApi',
            action: 'delete_user',
            metadata: { userId: user.id },
          },
          authError
        );
        // Continue anyway as the user data is deleted
      }

      return true;
    });
  },

  // Get user statistics (alias for current user)
  async getStats(): Promise<{
    newslettersCount: number;
    tagsCount: number;
    sourcesCount: number;
    readingQueueCount: number;
    joinedAt: string;
  }> {
    return this.getUserStats();
  },

  // Update user preferences (new signature for tests)
  async updatePreferences(userId: string, preferences: Record<string, unknown>): Promise<any> {
    return withPerformanceLogging('user.updatePreferences', async () => {
      // Get existing user to merge preferences
      const { data: existingUser } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', userId)
        .single();

      const mergedPreferences = {
        ...existingUser?.preferences,
        ...preferences,
      };

      const { data, error } = await supabase
        .from('users')
        .update({
          preferences: mergedPreferences,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Update user preferences (original method)
  async updateUserPreferences(preferences: Record<string, unknown>): Promise<boolean> {
    return withPerformanceLogging('user.updateUserPreferences', async () => {
      const user = await requireAuth();

      const { error } = await supabase.from('user_preferences').upsert(
        {
          user_id: user.id,
          preferences,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Update user subscription
  async updateSubscription(
    userId: string,
    subscription: { plan: string; status: string }
  ): Promise<any> {
    return withPerformanceLogging('user.updateSubscription', async () => {
      // Validate subscription plan
      const validPlans = ['free', 'premium', 'enterprise'];
      if (!validPlans.includes(subscription.plan)) {
        throw new Error('Invalid subscription plan');
      }

      // Validate subscription status
      const validStatuses = ['active', 'inactive', 'cancelled', 'expired'];
      if (!validStatuses.includes(subscription.status)) {
        throw new Error('Invalid subscription status');
      }

      const { data, error } = await supabase
        .from('users')
        .update({
          subscription,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Update last login timestamp
  async updateLastLogin(userId?: string): Promise<any> {
    return withPerformanceLogging('user.updateLastLogin', async () => {
      let targetUserId = userId;

      if (!targetUserId) {
        const user = await requireAuth();
        targetUserId = user.id;
      }

      const { data, error } = await supabase
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Get user statistics
  async getUserStats(userId?: string): Promise<{
    newslettersCount: number;
    tagsCount: number;
    sourcesCount: number;
    readingQueueCount: number;
    joinedAt: string;
  }> {
    return withPerformanceLogging('user.getUserStats', async () => {
      let targetUserId = userId;

      if (!targetUserId) {
        const user = await requireAuth();
        targetUserId = user.id;
      }

      // Get newsletters count
      const { count: newslettersCount } = await supabase
        .from('newsletters')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      // Get tags count
      const { count: tagsCount } = await supabase
        .from('tags')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      // Get sources count
      const { count: sourcesCount } = await supabase
        .from('newsletter_sources')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      // Get reading queue count
      const { count: readingQueueCount } = await supabase
        .from('reading_queue')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetUserId);

      // Get user profile for join date
      const userProfile = await this.getById(targetUserId);

      return {
        newslettersCount: newslettersCount || 0,
        tagsCount: tagsCount || 0,
        sourcesCount: sourcesCount || 0,
        readingQueueCount: readingQueueCount || 0,
        joinedAt: userProfile?.created_at || new Date().toISOString(),
      };
    });
  },

  // Search users
  async searchUsers(
    query: string,
    options?: { limit?: number; offset?: number }
  ): Promise<UserProfile[]> {
    return withPerformanceLogging('user.searchUsers', async () => {
      // Validate search query length
      if (query.length < 2) {
        throw new Error('Search query must be at least 2 characters long');
      }

      let searchQuery = supabase
        .from('users')
        .select('id, email, full_name, created_at, updated_at')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('full_name');

      if (options?.limit) {
        searchQuery = searchQuery.limit(options.limit);
      }

      if (options?.offset) {
        searchQuery = searchQuery.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error } = await searchQuery;

      if (error) handleSupabaseError(error);
      return data || [];
    });
  },

  // Bulk update users
  async bulkUpdate(
    updates: Array<{ id: string;[key: string]: any }>
  ): Promise<{ successCount: number; failures: Array<{ id: string; error: string }> }> {
    return withPerformanceLogging('user.bulkUpdate', async () => {
      // Validate bulk update input
      if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error('Updates array is required and cannot be empty');
      }

      const results = {
        successCount: 0,
        failures: [] as Array<{ id: string; error: string }>,
      };

      for (const update of updates) {
        try {
          await this.update(update);
          results.successCount++;
        } catch (error) {
          results.failures.push({
            id: update.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return results;
    });
  },

  // Export user data
  async exportUserData(userId: string): Promise<{
    user: UserProfile;
    newsletters: any[];
    tags: any[];
    sources: any[];
    readingQueue: any[];
  }> {
    return withPerformanceLogging('user.exportUserData', async () => {
      try {
        // Get user profile
        const user = await this.getById(userId);
        if (!user) {
          throw new Error('User not found');
        }

        // Get all user data with optimized queries (explicit columns and limits)
        const [newsletters, tags, sources, readingQueue] = await Promise.all([
          supabase.from('newsletters').select('id, title, content, summary, image_url, newsletter_source_id, word_count, estimated_read_time, is_read, is_liked, is_archived, received_at, created_at, updated_at, user_id').eq('user_id', userId).limit(10000),
          supabase.from('tags').select('id, name, color, created_at, updated_at, user_id').eq('user_id', userId).limit(1000),
          supabase.from('newsletter_sources').select('id, name, from, is_archived, created_at, updated_at, user_id').eq('user_id', userId).limit(1000),
          supabase.from('reading_queue').select('id, user_id, newsletter_id, position, priority, notes, added_at, updated_at').eq('user_id', userId).limit(1000),
        ]);

        return {
          user,
          newsletters: newsletters.data || [],
          tags: tags.data || [],
          sources: sources.data || [],
          readingQueue: readingQueue.data || [],
        };
      } catch (_) {
        throw new Error('Failed to export user data');
      }
    });
  },

  // Get user preferences
  async getPreferences(): Promise<Record<string, unknown> | null> {
    return withPerformanceLogging('user.getPreferences', async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', user.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No preferences found
        }
        handleSupabaseError(error);
      }

      return data?.preferences || null;
    });
  },
};

// Export individual functions for backward compatibility
export const {
  getById,
  getCurrentUser,
  getProfile: getUserProfile,
  create,
  update,
  delete: deleteUser,
  updateProfile: updateUserProfile,
  generateEmailAlias,
  getEmailAlias: getUserEmailAlias,
  updateEmailAlias,
  isEmailAliasAvailable,
  deleteAccount: deleteUserAccount,
  getStats,
  getUserStats,
  updatePreferences,
  updateUserPreferences,
  getPreferences: getUserPreferences,
  updateSubscription,
  updateLastLogin,
  searchUsers,
  bulkUpdate,
  exportUserData,
} = userApi;

export default userApi;
