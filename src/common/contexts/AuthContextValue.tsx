import { createContext } from 'react';
import type { AuthContextType } from './AuthContext'; // Assuming AuthContextType is exported from AuthContext.tsx

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
