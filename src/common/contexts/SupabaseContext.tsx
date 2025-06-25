import { useEffect, useState } from 'react'; // Removed createContext, useContext
import { Session, User, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';

// Original type definition (before potential duplication)
// type SupabaseContextType = {
//   supabase: SupabaseClient;
//   session: Session | null;
//   user: User | null;
// };

export type SupabaseContextType = {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
};

// Removed: const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);
import { SupabaseContext } from './SupabaseContextValue'; // Added import

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Cleanup function
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <SupabaseContext.Provider value={{ supabase, session, user }}>
      {children}
    </SupabaseContext.Provider>
  );
};

// useSupabase hook has been moved to src/common/hooks/useSupabase.tsx

// SupabaseContext has been moved to src/common/contexts/SupabaseContextValue.tsx
export default SupabaseProvider; // Provider should be the default export
