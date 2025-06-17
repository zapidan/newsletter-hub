import { userApi } from "../api/userApi";
import supabase from "../api/supabaseClient";
import emailConfig from '../config/email';

type EmailAliasResult = {
  email: string;
  error?: string;
};

/**
 * Generates an email alias based on the provided email and configuration
 * @param email User's email address
 * @returns Generated email alias string
 */
export function generateEmailAliasFromEmail(email: string): string {
  const username = emailConfig.defaultUsername === 'user'
    ? email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "")
    : emailConfig.defaultUsername.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  return `${username}@${emailConfig.defaultDomain}`;
}

/**
 * @deprecated Use generateEmailAliasFromEmail instead
 * Generates a unique email alias for a user
 */
export async function generateEmailAlias(
  email: string,
): Promise<EmailAliasResult> {
  try {
    const emailAlias = generateEmailAliasFromEmail(email);
    return await userApi.generateEmailAlias(emailAlias);
  } catch (error) {
    console.error("Error generating email alias:", error);
    return { email: "", error: "Failed to generate email alias" };
  }
}

/**
 * Gets or creates an email alias for a user
 */
export async function getUserEmailAlias(): Promise<string> {
  try {
    return await userApi.getEmailAlias();
  } catch (error) {
    console.error("Error in getUserEmailAlias:", error);
    throw error;
  }
}

/**
 * Updates a user's email alias
 */
export async function updateEmailAlias(
  newAlias: string,
): Promise<EmailAliasResult> {
  try {
    return await userApi.updateEmailAlias(newAlias);
  } catch (error) {
    console.error("Error in updateEmailAlias:", error);
    return { email: "", error: "Internal server error" };
  }
}

/**
 * Verifies and updates the email alias on startup based on environment variables
 * @returns Promise with the current or updated email alias
 */
export async function verifyAndUpdateEmailAlias(): Promise<string> {
  console.log('[EmailAlias] Starting email alias verification and update');
  
  // Add a timeout to prevent hanging (5 seconds)
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error('Email alias verification timed out')), 5000)
  );

  try {
    // Race between our operation and the timeout
    return await Promise.race([
      (async () => {
        // Get current user
        console.log('[EmailAlias] Fetching current user...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.error('[EmailAlias] Error getting user:', userError);
          throw userError;
        }
        
        if (!user?.email) {
          const errorMsg = 'User not authenticated or email not found';
          console.error(`[EmailAlias] ${errorMsg}`, { user });
          throw new Error(errorMsg);
        }

        console.log('[EmailAlias] User email:', user.email);
        
        // Generate expected alias using the common function
        const expectedAlias = generateEmailAliasFromEmail(user.email);
        console.log('[EmailAlias] Generated expected alias:', expectedAlias);
        
        // Get current alias from database with a timeout
        console.log('[EmailAlias] Fetching current alias from database...');
        const currentAlias = await Promise.race([
          userApi.getEmailAlias(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('getEmailAlias timed out')), 3000)
          )
        ]);
        
        console.log('[EmailAlias] Current alias from database:', currentAlias);
        
        // If aliases match, return current alias
        if (currentAlias === expectedAlias) {
          console.log('[EmailAlias] Aliases match, no update needed');
          return currentAlias;
        }
        
        console.log('[EmailAlias] Aliases differ, updating...');
        
        // If different, update to the expected alias
        const { email: updatedAlias, error: updateError } = await userApi.updateEmailAlias(expectedAlias);
        
        if (updateError) {
          console.error('[EmailAlias] Error updating alias:', updateError);
          throw new Error(`Failed to update email alias: ${updateError}`);
        }
        
        console.log('[EmailAlias] Successfully updated alias to:', updatedAlias);
        return updatedAlias;
      })(),
      timeoutPromise
    ]);
  } catch (error) {
    console.error('[EmailAlias] Error in verifyAndUpdateEmailAlias:', error);
    // Don't block the auth flow if there's an error with the alias
    console.warn('[EmailAlias] Continuing without updating email alias due to error');
    return ''; // Return empty string to indicate failure but don't block the auth flow
  }
}

export default {
  generateEmailAliasFromEmail,
  getUserEmailAlias,
  updateEmailAlias,
  verifyAndUpdateEmailAlias,
};
