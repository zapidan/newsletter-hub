import {
  supabase,
  handleSupabaseError,
  requireAuth,
  withPerformanceLogging,
} from "./supabaseClient";
import { generateEmailAliasFromEmail } from "../utils/emailAlias";
import { useLoggerStatic } from "../utils/logger";

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

// Initialize logger lazily
let log: ReturnType<typeof useLoggerStatic> | null = null;
const getLogger = () => {
  if (!log) {
    log = useLoggerStatic();
  }
  return log;
};

// User API Service
export const userApi = {
  // Get current user profile
  async getProfile(): Promise<UserProfile | null> {
    return withPerformanceLogging("user.getProfile", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        handleSupabaseError(error);
      }

      return data;
    });
  },

  // Update user profile
  async updateProfile(updates: UpdateUserParams): Promise<UserProfile> {
    return withPerformanceLogging("user.updateProfile", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("users")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)
        .select()
        .single();

      if (error) handleSupabaseError(error);
      return data;
    });
  },

  // Generate a unique email alias for a user
  async generateEmailAlias(email: string): Promise<EmailAliasResult> {
    return withPerformanceLogging("user.generateEmailAlias", async () => {
      const user = await requireAuth();

      try {
        const emailAlias = generateEmailAliasFromEmail(email);

        // Save to the database
        const { error } = await supabase
          .from("users")
          .update({ email_alias: emailAlias })
          .eq("id", user.id);

        if (error) {
          getLogger().error(
            "Error saving email alias",
            {
              component: "UserApi",
              action: "save_email_alias",
              metadata: { userId: user.id },
            },
            error,
          );
          return { email: "", error: "Failed to save email alias" };
        }

        return { email: emailAlias };
      } catch (error) {
        getLogger().error(
          "Error generating email alias",
          {
            component: "UserApi",
            action: "generate_email_alias",
            metadata: { email },
          },
          error instanceof Error ? error : new Error(String(error)),
        );
        return { email: "", error: "Failed to generate email alias" };
      }
    });
  },

  // Get or create an email alias for the current user
  async getEmailAlias(): Promise<string> {
    return withPerformanceLogging("user.getEmailAlias", async () => {
      const user = await requireAuth();

      try {
        // First check if user already has an email alias
        const { data: userData } = await supabase
          .from("users")
          .select("email_alias")
          .eq("id", user.id)
          .single();

        // If we got the user data and they have an alias, return it
        if (userData?.email_alias) {
          return userData.email_alias;
        }

        // If no alias exists, generate a new one
        if (!user.email) {
          throw new Error("User email not found");
        }

        const { email, error: genError } = await this.generateEmailAlias(
          user.email,
        );

        if (genError || !email) {
          throw new Error(genError || "Failed to generate email alias");
        }

        return email;
      } catch (error) {
        getLogger().error(
          "Error in getEmailAlias",
          {
            component: "UserApi",
            action: "get_email_alias",
            metadata: { userId: user.id },
          },
          error instanceof Error ? error : new Error(String(error)),
        );
        throw error;
      }
    });
  },

  // Update a user's email alias
  async updateEmailAlias(newAlias: string): Promise<EmailAliasResult> {
    return withPerformanceLogging("user.updateEmailAlias", async () => {
      const user = await requireAuth();

      try {
        // Check if the alias is already taken
        const { data } = await supabase
          .from("users")
          .select("id")
          .eq("email_alias", newAlias)
          .neq("id", user.id)
          .single();

        if (data) {
          return { email: "", error: "This email alias is already taken" };
        }

        // Update the user's email alias
        const { error: updateError } = await supabase
          .from("users")
          .update({ email_alias: newAlias })
          .eq("id", user.id);

        if (updateError) {
          getLogger().error(
            "Error updating user with email alias",
            {
              component: "UserApi",
              action: "update_email_alias",
              metadata: { userId: user.id, newAlias },
            },
            updateError,
          );
          return { email: "", error: "Error saving email alias" };
        }

        return { email: newAlias };
      } catch (error) {
        getLogger().error(
          "Error in updateEmailAlias",
          {
            component: "UserApi",
            action: "update_email_alias",
            metadata: { userId: user.id, newAlias },
          },
          error instanceof Error ? error : new Error(String(error)),
        );
        return { email: "", error: "Internal server error" };
      }
    });
  },

  // Check if email alias is available
  async isEmailAliasAvailable(alias: string): Promise<boolean> {
    return withPerformanceLogging("user.isEmailAliasAvailable", async () => {
      const user = await requireAuth();

      const { data } = await supabase
        .from("users")
        .select("id")
        .eq("email_alias", alias)
        .neq("id", user.id)
        .maybeSingle();

      return !data; // Available if no data found
    });
  },

  // Delete user account and all associated data
  async deleteAccount(): Promise<boolean> {
    return withPerformanceLogging("user.deleteAccount", async () => {
      const user = await requireAuth();

      // Note: This should cascade delete related data based on your database constraints
      const { error } = await supabase.from("users").delete().eq("id", user.id);

      if (error) handleSupabaseError(error);

      // Also delete from auth
      const { error: authError } = await supabase.auth.admin.deleteUser(
        user.id,
      );
      if (authError) {
        getLogger().error(
          "Error deleting user from auth",
          {
            component: "UserApi",
            action: "delete_user",
            metadata: { userId: user.id },
          },
          authError,
        );
        // Continue anyway as the user data is deleted
      }

      return true;
    });
  },

  // Get user statistics
  async getStats(): Promise<{
    newslettersCount: number;
    tagsCount: number;
    sourcesCount: number;
    readingQueueCount: number;
    joinedAt: string;
  }> {
    return withPerformanceLogging("user.getStats", async () => {
      const user = await requireAuth();

      // Get newsletters count
      const { count: newslettersCount } = await supabase
        .from("newsletters")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Get tags count
      const { count: tagsCount } = await supabase
        .from("tags")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Get sources count
      const { count: sourcesCount } = await supabase
        .from("newsletter_sources")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Get reading queue count
      const { count: readingQueueCount } = await supabase
        .from("reading_queue")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Get user profile for join date
      const profile = await this.getProfile();

      return {
        newslettersCount: newslettersCount || 0,
        tagsCount: tagsCount || 0,
        sourcesCount: sourcesCount || 0,
        readingQueueCount: readingQueueCount || 0,
        joinedAt: profile?.created_at || new Date().toISOString(),
      };
    });
  },

  // Update user preferences
  async updatePreferences(
    preferences: Record<string, unknown>,
  ): Promise<boolean> {
    return withPerformanceLogging("user.updatePreferences", async () => {
      const user = await requireAuth();

      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          preferences,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

      if (error) handleSupabaseError(error);
      return true;
    });
  },

  // Get user preferences
  async getPreferences(): Promise<Record<string, unknown> | null> {
    return withPerformanceLogging("user.getPreferences", async () => {
      const user = await requireAuth();

      const { data, error } = await supabase
        .from("user_preferences")
        .select("preferences")
        .eq("user_id", user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
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
  getProfile: getUserProfile,
  updateProfile: updateUserProfile,
  generateEmailAlias,
  getEmailAlias: getUserEmailAlias,
  updateEmailAlias,
  isEmailAliasAvailable,
  deleteAccount: deleteUserAccount,
  getStats: getUserStats,
  updatePreferences: updateUserPreferences,
  getPreferences: getUserPreferences,
} = userApi;

export default userApi;
