import { Session, User } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useState } from 'react'; // Removed useContext
import { userService } from '../services/user/UserService';
import { useLoggerStatic } from '../utils/logger';
import { useSupabase } from './SupabaseContext';

type AppUser = User | null;

type PasswordRequirement = {
  regex: RegExp;
  label: string;
  satisfied: boolean;
};

export type AuthContextType = { // Added export
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

// Removed: export const AuthContext = createContext<AuthContextType | undefined>(undefined);
import { AuthContext } from './AuthContextValue'; // Added import

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
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      log.auth('Auth state changed', {
        metadata: {
          event,
          hasSession: !!newSession,
          userId: newSession?.user?.id,
        },
      });
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      log.auth('Cleaning up auth listener');
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(async (email: string, password: string) => {
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
  }, [setLoading, setError, log, supabase]);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      log.auth('Attempting sign up', { metadata: { email } });

      // First, sign up the user
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        log.error('Sign up failed', { component: 'Auth', metadata: { email } }, signUpError);
        setError(signUpError.message);
        return { error: signUpError };
      }

      // If user was created successfully, generate and assign an email alias
      if (authData.user) {
        try {
          const result = await userService.generateEmailAlias(email);
          if (result.success && result.email) {
            log.auth('Email alias assigned on sign up', {
              component: 'Auth',
              metadata: {
                userId: authData.user.id,
                emailAlias: result.email
              }
            });
          } else {
            throw new Error(result.error || 'Failed to generate email alias');
          }
        } catch (aliasError) {
          // Log the error but don't fail the signup process
          log.warn('Failed to assign email alias on sign up', {
            component: 'Auth',
            metadata: { email },
            error: aliasError instanceof Error ? aliasError : new Error(String(aliasError))
          });
        }
      }

      log.auth('Sign up successful', {
        component: 'Auth',
        metadata: {
          email,
          userId: authData.user?.id
        }
      });
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
  }, [setLoading, setError, log, supabase.auth, userService]);

  const signOut = useCallback(async () => {
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
  }, [setLoading, setError, log, supabase.auth]);

  const resetPassword = useCallback(async (email: string) => {
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
  }, [setLoading, setError, log, supabase.auth]);

  const updatePassword = useCallback(async (newPassword: string) => {
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
  }, [setLoading, setError, log, supabase.auth]);

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

export default AuthProvider;
