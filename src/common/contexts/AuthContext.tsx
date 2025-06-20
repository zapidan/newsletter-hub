import { Session, User } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { verifyAndUpdateEmailAlias } from '../utils/emailAlias';
import { useLoggerStatic } from '../utils/logger';
import { useSupabase } from './SupabaseContext';

type AppUser = User | null;

type PasswordRequirement = {
  regex: RegExp;
  label: string;
  satisfied: boolean;
};

type AuthContextType = {
  user: AppUser;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  checkPasswordStrength: (password: string) => PasswordRequirement[];
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { supabase } = useSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const log = useLoggerStatic();

  // Check password strength
  const checkPasswordStrength = useCallback((password: string): PasswordRequirement[] => {
    const requirements = [
      { regex: /.{8,}/, label: 'At least 8 characters', satisfied: false },
      { regex: /[0-9]/, label: 'Contains number', satisfied: false },
      {
        regex: /[a-z]/,
        label: 'Contains lowercase letter',
        satisfied: false,
      },
      {
        regex: /[A-Z]/,
        label: 'Contains uppercase letter',
        satisfied: false,
      },
      {
        regex: /[^A-Za-z0-9]/,
        label: 'Contains special character',
        satisfied: false,
      },
    ];

    return requirements.map((req) => ({
      ...req,
      satisfied: req.regex.test(password),
    }));
  }, []);

  // Check active session on mount and set up listener
  useEffect(() => {
    log.auth('Initializing auth state');

    const getInitialSession = async () => {
      try {
        setLoading(true);
        const {
          data: { session: initialSession },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        log.auth('Initial session retrieved', {
          metadata: {
            hasSession: !!initialSession,
            userId: initialSession?.user?.id,
          },
        });
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        // Verify email alias if user is authenticated - don't await this and don't block auth
        if (initialSession?.user && initialSession.access_token) {
          // Add a small delay to ensure session is fully established
          setTimeout(() => {
            // Double-check session is still valid before calling
            supabase.auth
              .getSession()
              .then(({ data: { session: currentSession } }) => {
                if (currentSession?.user && currentSession.access_token) {
                  // Use a timeout to ensure this doesn't hang the auth flow
                  Promise.race([
                    verifyAndUpdateEmailAlias(),
                    new Promise<string>((_, reject) =>
                      setTimeout(() => reject(new Error('Email verification timeout')), 2000)
                    ),
                  ])
                    .then((alias) => {
                      if (alias) {
                        log.auth('Email alias verified/updated on initial session', {
                          metadata: { alias },
                        });
                      }
                    })
                    .catch((error) => {
                      log.warn(
                        'Initial email alias verification failed, continuing with auth',
                        { component: 'Auth' },
                        error instanceof Error ? error : new Error(String(error))
                      );
                      // Don't block the auth flow on alias verification errors
                    });
                }
              })
              .catch(() => {
                // Session check failed, skip alias verification
                log.debug('Session check failed, skipping initial alias verification');
              });
          }, 500); // 500ms delay to ensure session is stable
        }
      } catch (error) {
        log.error(
          'Error getting initial session',
          { component: 'Auth' },
          error instanceof Error ? error : new Error(String(error))
        );
        setError(error instanceof Error ? error.message : 'Failed to get session');
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      log.auth('Auth state changed', {
        metadata: {
          event,
          hasSession: !!newSession,
          userId: newSession?.user?.id,
        },
      });
      setSession(newSession);
      setUser(newSession?.user ?? null);

      // Verify email alias on sign in or when session is refreshed - don't await and don't block
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
        newSession?.user &&
        newSession.access_token
      ) {
        // Add a small delay to ensure the session is fully established
        setTimeout(() => {
          // Double-check session is still valid and hasn't changed
          supabase.auth
            .getSession()
            .then(({ data: { session: currentSession } }) => {
              if (
                currentSession?.user &&
                currentSession.access_token &&
                currentSession.user.id === newSession.user.id
              ) {
                // Use a shorter timeout to prevent hanging
                Promise.race([
                  verifyAndUpdateEmailAlias(),
                  new Promise<string>((_, reject) =>
                    setTimeout(() => reject(new Error('Email verification timeout')), 2000)
                  ),
                ])
                  .then((alias) => {
                    if (alias) {
                      log.auth('Email alias verified/updated after sign in', {
                        metadata: { alias, event },
                      });
                    }
                  })
                  .catch((error) => {
                    log.warn(
                      'Post-signin email alias verification failed, continuing',
                      { component: 'Auth', metadata: { event } },
                      error instanceof Error ? error : new Error(String(error))
                    );
                  });
              } else {
                log.debug('Session changed during alias verification delay, skipping', {
                  metadata: { event, hadSession: !!currentSession },
                });
              }
            })
            .catch(() => {
              // Session check failed, skip alias verification
              log.debug(
                'Session check failed during auth state change, skipping alias verification',
                {
                  metadata: { event },
                }
              );
            });
        }, 300); // 300ms delay to ensure session is stable
      }
    });

    return () => {
      log.auth('Cleaning up auth listener');
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      log.auth('Attempting sign in', { metadata: { email } });

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        log.error('Sign in failed', { component: 'Auth', metadata: { email } }, error);
        setError(error.message);
        return { error };
      }

      log.auth('Sign in successful', { metadata: { email } });
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in';
      log.error(
        'Sign in exception',
        { component: 'Auth', metadata: { email } },
        error instanceof Error ? error : new Error(errorMessage)
      );
      setError(errorMessage);
      return { error: new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      log.auth('Attempting sign up', { metadata: { email } });

      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        log.error('Sign up failed', { component: 'Auth', metadata: { email } }, error);
        setError(error.message);
        return { error };
      }

      log.auth('Sign up successful', { metadata: { email } });
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign up';
      log.error(
        'Sign up exception',
        { component: 'Auth', metadata: { email } },
        error instanceof Error ? error : new Error(errorMessage)
      );
      setError(errorMessage);
      return { error: new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      log.auth('Attempting sign out');

      const { error } = await supabase.auth.signOut();

      if (error) {
        log.error('Sign out failed', { component: 'Auth' }, error);
        throw error;
      }

      log.auth('Sign out successful');
    } catch (error) {
      log.error(
        'Sign out exception',
        { component: 'Auth' },
        error instanceof Error ? error : new Error(String(error))
      );
      setError(error instanceof Error ? error.message : 'Failed to sign out');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      setError(null);
      log.auth('Attempting password reset', { metadata: { email } });

      // Get the current origin (e.g., http://localhost:3000)
      const siteUrl = window.location.origin;
      // Point to the reset password page
      const redirectTo = `${siteUrl}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        log.error('Password reset failed', { component: 'Auth', metadata: { email } }, error);
        setError(error.message);
        return { error };
      }

      log.auth('Password reset email sent', { metadata: { email } });
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
      log.error(
        'Password reset exception',
        { component: 'Auth', metadata: { email } },
        error instanceof Error ? error : new Error(errorMessage)
      );
      setError(errorMessage);
      return { error: new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      log.auth('Attempting password update');

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        log.error('Password update failed', { component: 'Auth' }, error);
        setError(error.message);
        return { error };
      }

      log.auth('Password updated successfully');
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password';
      log.error(
        'Password update exception',
        { component: 'Auth' },
        error instanceof Error ? error : new Error(errorMessage)
      );
      setError(errorMessage);
      return { error: new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      error,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      checkPasswordStrength,
    }),
    [
      user,
      session,
      loading,
      error,
      checkPasswordStrength,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    ]
  );

  log.debug('Rendering AuthProvider', {
    component: 'Auth',
    metadata: {
      hasUser: !!user,
      loading,
      hasError: !!error,
      hasSession: !!session,
      userId: user?.id,
    },
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
