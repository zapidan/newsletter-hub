import { createContext } from 'react';
import type { FilterContextType } from './FilterContext'; // Assuming FilterContextType is exported

export const FilterContext = createContext<FilterContextType | undefined>(undefined);
