import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useSupabase } from './SupabaseContext';
import { User, Session } from '@supabase/supabase-js';

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

  // Check password strength
  const checkPasswordStrength = useCallback((password: string): PasswordRequirement[] => {
    const requirements = [
      { regex: /.{8,}/, label: 'At least 8 characters', satisfied: false },
      { regex: /[0-9]/, label: 'Contains number', satisfied: false },
      { regex: /[a-z]/, label: 'Contains lowercase letter', satisfied: false },
      { regex: /[A-Z]/, label: 'Contains uppercase letter', satisfied: false },
      { regex: /[^A-Za-z0-9]/, label: 'Contains special character', satisfied: false },
    ];

    return requirements.map(req => ({
      ...req,
      satisfied: req.regex.test(password)
    }));
  }, []);

  // Check active session on mount and set up listener
  useEffect(() => {
    console.log('[Auth] Initializing auth state');
    
    const getInitialSession = async () => {
      try {
        setLoading(true);
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        console.log('[Auth] Initial session:', initialSession);
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
      } catch (error) {
        console.error('[Auth] Error getting initial session:', error);
        setError(error instanceof Error ? error.message : 'Failed to get session');
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[Auth] Auth state changed:', { event, hasSession: !!newSession });
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    );

    return () => {
      console.log('[Auth] Cleaning up auth listener');
      subscription?.unsubscribe();
    };
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('[Auth] Signing in with:', email);
      
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Sign in error:', error);
        setError(error.message);
        return { error };
      }

      console.log('[Auth] Sign in successful');
      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign in exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in';
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
      console.log('[Auth] Signing up with:', email);
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Sign up error:', error);
        setError(error.message);
        return { error };
      }

      console.log('[Auth] Sign up successful');
      return { error: null };
    } catch (error) {
      console.error('[Auth] Sign up exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign up';
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
      console.log('[Auth] Signing out');
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('[Auth] Sign out error:', error);
        throw error;
      }
      
      console.log('[Auth] Sign out successful');
    } catch (error) {
      console.error('[Auth] Sign out exception:', error);
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
      console.log('[Auth] Resetting password for:', email);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        console.error('[Auth] Reset password error:', error);
        setError(error.message);
        return { error };
      }
      
      console.log('[Auth] Password reset email sent');
      return { error: null };
    } catch (error) {
      console.error('[Auth] Reset password exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password';
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
      console.log('[Auth] Updating password');
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) {
        console.error('[Auth] Update password error:', error);
        setError(error.message);
        return { error };
      }
      
      console.log('[Auth] Password updated successfully');
      return { error: null };
    } catch (error) {
      console.error('[Auth] Update password exception:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password';
      setError(errorMessage);
      return { error: new Error(errorMessage) };
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(() => ({
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
  }), [user, session, loading, error, checkPasswordStrength]);

  console.log('[Auth] Rendering AuthProvider with state:', { 
    hasUser: !!user, 
    loading, 
    error: !!error,
    session: !!session
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
