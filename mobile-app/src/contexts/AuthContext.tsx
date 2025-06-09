import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { useSupabase } from './SupabaseContext';

type AppUser = User | null;

type PasswordRequirement = {
  regex: RegExp;
  label: string;
  satisfied: boolean;
};

type AuthContextType = {
  user: AppUser;
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
  const { supabase, user: supabaseUser, session } = useSupabase();
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

  // Update user state when supabase user changes
  useEffect(() => {
    setUser(supabaseUser);
  }, [supabaseUser]);

  // Sign in with email and password
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      return { error };
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      setUser(null);
    } catch (err) {
      const error = err as Error;
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error };
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Update password
  const updatePassword = async (newPassword: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error };
    } catch (err) {
      const error = err as Error;
      setError(error.message);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    checkPasswordStrength,
  };

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
