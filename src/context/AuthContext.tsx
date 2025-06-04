import * as React from 'react';
import { ReactNode } from 'react';

type User = {
  id: string;
  email: string;
  emailAlias?: string;
};

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

import { supabase } from '../services/supabaseClient';
export const AuthContext = React.createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Real Supabase sign-in
  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      setUser({ id: data.user.id, email: data.user.email ?? '' });
    }
    setLoading(false);
  };

  // Real Supabase sign-up
  const signUp = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      setUser({ id: data.user.id, email: data.user.email ?? '' });
    }
    setLoading(false);
  };

  // Real Supabase sign-out
  const signOut = async () => {
    setLoading(true);
    setError(null);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
  };

  // Persist session and listen to auth changes
  React.useEffect(() => {
    const getSession = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setUser(null);
      } else if (data?.user) {
        setUser({ id: data.user.id, email: data.user.email ?? '' });
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    getSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email ?? '' });
      } else {
        setUser(null);
      }
    });
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthProvider;
