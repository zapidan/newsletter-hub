import { userApi } from '../api/userApi';
import supabase from '../api/supabaseClient';
import emailConfig from '../config/email';
import { logger } from './logger';

// Initialize logger
const log = logger;

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
  const username =
    emailConfig.defaultUsername === 'user'
      ? email
          .split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
      : emailConfig.defaultUsername.toLowerCase().replace(/[^a-z0-9]/g, '');

  return `${username}@${emailConfig.defaultDomain}`;
}

/**
 * @deprecated Use generateEmailAliasFromEmail instead
 * Generates a unique email alias for a user
 */
export async function generateEmailAlias(email: string): Promise<EmailAliasResult> {
  try {
    const emailAlias = generateEmailAliasFromEmail(email);
    return await userApi.generateEmailAlias(emailAlias);
  } catch (error) {
    log.error(
      'Failed to validate email alias',
      {
        component: 'EmailAlias',
        action: 'validate_alias',
        metadata: { email },
      },
      error instanceof Error ? error : new Error(String(error))
    );
    return { email: '', error: 'Failed to generate email alias' };
  }
}

/**
 * Gets or creates an email alias for a user
 */
export async function getUserEmailAlias(): Promise<string> {
  try {
    return await userApi.getEmailAlias();
  } catch (error) {
    log.error(
      'Failed to get user email alias',
      {
        action: 'get_user_email_alias',
        metadata: {},
      },
      error instanceof Error ? error : new Error(String(error))
    );
    return '';
  }
}

/**
 * Updates a user's email alias
 */
export async function updateEmailAlias(newAlias: string): Promise<EmailAliasResult> {
  try {
    return await userApi.updateEmailAlias(newAlias);
  } catch (error) {
    log.error(
      'Failed to update email alias',
      {
        action: 'update_email_alias',
        metadata: { newAlias },
      },
      error instanceof Error ? error : new Error(String(error))
    );
    throw error;
  }
}

/**
 * Verifies and updates the email alias on startup based on environment variables
 * @returns Promise with the current or updated email alias
 */
export async function verifyAndUpdateEmailAlias(): Promise<string> {
  log.info('Starting email alias verification and update', {
    action: 'verify_and_update_email_alias',
    metadata: {},
  });

  // Add a timeout to prevent hanging (2 seconds - reduced for faster response)
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Email alias verification timed out')), 2000)
  );

  try {
    // Race between our operation and the timeout
    return await Promise.race([
      (async () => {
        // Get current user with shorter timeout
        log.debug('Fetching current user', {
          action: 'verify_and_update_email_alias',
          metadata: { step: 'fetch_user' },
        });

        const userPromise = supabase.auth.getUser();
        const userTimeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('getUser timed out')), 1000)
        );

        const {
          data: { user },
          error: userError,
        } = await Promise.race([userPromise, userTimeoutPromise]);

        if (userError) {
          log.error(
            'Failed to get current user',
            {
              action: 'verify_and_update_email_alias',
              metadata: { step: 'fetch_user' },
            },
            userError
          );
          throw userError;
        }

        if (!user?.email) {
          const errorMsg = 'User not authenticated or email not found';
          log.error(errorMsg, {
            action: 'verify_and_update_email_alias',
            metadata: { step: 'validate_user', hasUser: !!user },
          });
          throw new Error(errorMsg);
        }

        log.debug('User email retrieved', {
          action: 'verify_and_update_email_alias',
          metadata: { step: 'user_email', email: user.email },
        });

        // Generate expected alias using the common function
        const expectedAlias = generateEmailAliasFromEmail(user.email);
        log.debug('Generated expected alias', {
          action: 'verify_and_update_email_alias',
          metadata: { step: 'generate_alias', expectedAlias },
        });

        // Get current alias from database with a shorter timeout (1 second)
        log.debug('Fetching current alias from database', {
          action: 'verify_and_update_email_alias',
          metadata: { step: 'fetch_current_alias' },
        });

        let currentAlias: string;
        try {
          currentAlias = await Promise.race([
            userApi.getEmailAlias(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('getEmailAlias timed out')), 1000)
            ),
          ]);
        } catch (aliasError) {
          log.warn('Failed to get current alias, will use expected alias', {
            action: 'verify_and_update_email_alias',
            metadata: { step: 'alias_fallback', error: aliasError },
          });
          // If we can't get the current alias, assume it needs to be set
          currentAlias = '';
        }

        log.debug('Current alias retrieved from database', {
          action: 'verify_and_update_email_alias',
          metadata: { step: 'current_alias', currentAlias },
        });

        // If aliases match, return current alias
        if (currentAlias === expectedAlias && currentAlias !== '') {
          log.debug('Aliases match, no update needed', {
            action: 'verify_and_update_email_alias',
            metadata: { step: 'comparison', result: 'match' },
          });
          return currentAlias;
        }

        log.info('Aliases differ or empty, updating email alias', {
          action: 'verify_and_update_email_alias',
          metadata: {
            step: 'update',
            currentAlias,
            expectedAlias,
          },
        });

        // If different or empty, update to the expected alias
        const { email: updatedAlias, error: updateError } =
          await userApi.updateEmailAlias(expectedAlias);

        if (updateError) {
          log.error(
            'Failed to update email alias',
            {
              action: 'verify_and_update_email_alias',
              metadata: { step: 'update', expectedAlias },
            },
            new Error(updateError)
          );
          // Return the expected alias even if update failed
          return expectedAlias;
        }

        log.info('Successfully updated email alias', {
          action: 'verify_and_update_email_alias',
          metadata: { step: 'update_success', updatedAlias },
        });
        return updatedAlias;
      })(),
      timeoutPromise,
    ]);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log.error(
      'Error in email alias verification',
      {
        action: 'verify_and_update_email_alias',
        metadata: { step: 'error_handling', error: errorMsg },
      },
      error instanceof Error ? error : new Error(String(error))
    );

    // Don't block the auth flow if there's an error with the alias
    log.warn('Continuing without updating email alias due to error', {
      action: 'verify_and_update_email_alias',
      metadata: { step: 'error_recovery' },
    });

    // Try to return a fallback alias based on user email if available
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        return generateEmailAliasFromEmail(user.email);
      }
    } catch {
      // Ignore fallback errors
    }

    return ''; // Return empty string to indicate failure but don't block the auth flow
  }
}

export default {
  generateEmailAliasFromEmail,
  getUserEmailAlias,
  updateEmailAlias,
  verifyAndUpdateEmailAlias,
};
