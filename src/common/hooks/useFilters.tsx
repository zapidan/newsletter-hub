import { useContext } from 'react';
import { FilterContext } from '../contexts/FilterContextValue'; // Updated import
import type { FilterContextType } from '../contexts/FilterContext'; // Type import remains

export const useFilters = (): FilterContextType => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};

// Convenience hooks for specific filter types
export const useStatusFilter = () => {
  const { filter, setFilter } = useFilters();
  return { filter, setFilter };
};

export const useSourceFilter = () => {
  const { sourceFilter, setSourceFilter } = useFilters();
  return { sourceFilter, setSourceFilter };
};

export const useTimeFilter = () => {
  const { timeRange, setTimeRange } = useFilters();
  return { timeRange, setTimeRange };
};

export const useTagFilter = () => {
  const { tagIds, setTagIds, toggleTag, addTag, removeTag, clearTags } = useFilters();
  return { tagIds, setTagIds, toggleTag, addTag, removeTag, clearTags };
};
