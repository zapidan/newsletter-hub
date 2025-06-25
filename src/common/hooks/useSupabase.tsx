import { useContext } from 'react';
import { SupabaseContext } from '../contexts/SupabaseContextValue'; // Updated import
import type { SupabaseContextType } from '../contexts/SupabaseContext'; // Type import remains

export const useSupabase = (): SupabaseContextType => {
  const context = useContext(SupabaseContext);
  if (context === undefined) {
    throw new Error('useSupabase must be used within a SupabaseProvider');
  }
  return context;
};
