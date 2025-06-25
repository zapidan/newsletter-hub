import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContextValue'; // Updated import
import type { AuthContextType } from '../contexts/AuthContext'; // Type import remains

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
