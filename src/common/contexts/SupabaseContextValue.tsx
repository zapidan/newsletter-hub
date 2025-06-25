import { createContext } from 'react';
import type { SupabaseContextType } from './SupabaseContext';

export const SupabaseContext = createContext<SupabaseContextType | undefined>(undefined);
