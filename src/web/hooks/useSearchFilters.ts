import { useState, useCallback, useMemo } from 'react';
import { NewsletterSource } from '@common/types';
import { validateSearchFilters } from '../utils/searchUtils';

export interface SearchFilters {
  selectedSources: string[];
  readStatus: "all" | "read" | "unread";
  archivedStatus: "all" | "archived" | "active";
  dateFrom: string;
  dateTo: string;
}

interface FilterValidation {
  isValid: boolean;
  errors: string[];
}

interface UseSearchFiltersReturn {
  // Current filter values
  filters: SearchFilters;

  // Update functions
  setSelectedSources: (sources: string[]) => void;
  setReadStatus: (status: "all" | "read" | "unread") => void;
  setArchivedStatus: (status: "all" | "archived" | "active") => void;
  setDateFrom: (date: string) => void;
  setDateTo: (date: string) => void;

  // Bulk operations
  updateFilters: (updates: Partial<SearchFilters>) => void;
  clearAllFilters: () => void;
  resetToDefaults: () => void;

  // Source management
  toggleSource: (sourceId: string) => void;
  selectAllSources: (sources: NewsletterSource[]) => void;
  clearSelectedSources: () => void;

  // Status helpers
  isSourceSelected: (sourceId: string) => boolean;
  getSelectedSourcesCount: () => number;

  // Validation
  validation: FilterValidation;
  isValid: boolean;

  // State checks
  hasFiltersApplied: boolean;
  hasSourceFilters: boolean;
  hasStatusFilters: boolean;
  hasDateFilters: boolean;

  // Export/Import
  exportFilters: () => string;
  importFilters: (filtersJson: string) => boolean;
}

const createDefaultFilters = (): SearchFilters => ({
  selectedSources: [],
  readStatus: "all",
  archivedStatus: "active",
  dateFrom: "",
  dateTo: "",
});

export const useSearchFilters = (initialFilters?: Partial<SearchFilters>): UseSearchFiltersReturn => {
  const [filters, setFilters] = useState<SearchFilters>(() => ({
    ...createDefaultFilters(),
    ...initialFilters,
  }));

  // Validation
  const validation = useMemo(() => {
    return validateSearchFilters(filters);
  }, [filters]);

  // Update functions
  const setSelectedSources = useCallback((sources: string[]) => {
    setFilters(prev => ({ ...prev, selectedSources: sources }));
  }, []);

  const setReadStatus = useCallback((status: "all" | "read" | "unread") => {
    setFilters(prev => ({ ...prev, readStatus: status }));
  }, []);

  const setArchivedStatus = useCallback((status: "all" | "archived" | "active") => {
    setFilters(prev => ({ ...prev, archivedStatus: status }));
  }, []);

  const setDateFrom = useCallback((date: string) => {
    setFilters(prev => ({ ...prev, dateFrom: date }));
  }, []);

  const setDateTo = useCallback((date: string) => {
    setFilters(prev => ({ ...prev, dateTo: date }));
  }, []);

  // Bulk operations
  const updateFilters = useCallback((updates: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters(createDefaultFilters());
  }, []);

  const resetToDefaults = useCallback(() => {
    setFilters(createDefaultFilters());
  }, []);

  // Source management
  const toggleSource = useCallback((sourceId: string) => {
    setSelectedSources(prev =>
      prev.includes(sourceId)
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId]
    );
  }, [setSelectedSources]);

  const selectAllSources = useCallback((sources: NewsletterSource[]) => {
    const allSourceIds = sources.map(source => source.id);
    setSelectedSources(allSourceIds);
  }, [setSelectedSources]);

  const clearSelectedSources = useCallback(() => {
    setSelectedSources([]);
  }, [setSelectedSources]);

  // Status helpers
  const isSourceSelected = useCallback((sourceId: string) => {
    return filters.selectedSources.includes(sourceId);
  }, [filters.selectedSources]);

  const getSelectedSourcesCount = useCallback(() => {
    return filters.selectedSources.length;
  }, [filters.selectedSources]);

  // State checks
  const hasFiltersApplied = useMemo(() => {
    const defaults = createDefaultFilters();
    return (
      filters.selectedSources.length > 0 ||
      filters.readStatus !== defaults.readStatus ||
      filters.archivedStatus !== defaults.archivedStatus ||
      filters.dateFrom !== defaults.dateFrom ||
      filters.dateTo !== defaults.dateTo
    );
  }, [filters]);

  const hasSourceFilters = useMemo(() => {
    return filters.selectedSources.length > 0;
  }, [filters.selectedSources]);

  const hasStatusFilters = useMemo(() => {
    const defaults = createDefaultFilters();
    return (
      filters.readStatus !== defaults.readStatus ||
      filters.archivedStatus !== defaults.archivedStatus
    );
  }, [filters.readStatus, filters.archivedStatus]);

  const hasDateFilters = useMemo(() => {
    return filters.dateFrom !== "" || filters.dateTo !== "";
  }, [filters.dateFrom, filters.dateTo]);

  // Export/Import
  const exportFilters = useCallback(() => {
    try {
      return JSON.stringify(filters);
    } catch (error) {
      console.error('Failed to export filters:', error);
      return "";
    }
  }, [filters]);

  const importFilters = useCallback((filtersJson: string): boolean => {
    try {
      const importedFilters = JSON.parse(filtersJson) as SearchFilters;

      // Validate the imported filters structure
      const expectedKeys: (keyof SearchFilters)[] = [
        'selectedSources', 'readStatus', 'archivedStatus', 'dateFrom', 'dateTo'
      ];

      const hasAllKeys = expectedKeys.every(key => key in importedFilters);
      if (!hasAllKeys) {
        return false;
      }

      // Validate enum values
      const validReadStatuses = ["all", "read", "unread"];
      const validArchivedStatuses = ["all", "archived", "active"];

      if (!validReadStatuses.includes(importedFilters.readStatus) ||
          !validArchivedStatuses.includes(importedFilters.archivedStatus)) {
        return false;
      }

      // Validate array types
      if (!Array.isArray(importedFilters.selectedSources)) {
        return false;
      }

      setFilters(importedFilters);
      return true;
    } catch (error) {
      console.error('Failed to import filters:', error);
      return false;
    }
  }, []);

  return {
    // Current filter values
    filters,

    // Update functions
    setSelectedSources,
    setReadStatus,
    setArchivedStatus,
    setDateFrom,
    setDateTo,

    // Bulk operations
    updateFilters,
    clearAllFilters,
    resetToDefaults,

    // Source management
    toggleSource,
    selectAllSources,
    clearSelectedSources,

    // Status helpers
    isSourceSelected,
    getSelectedSourcesCount,

    // Validation
    validation,
    isValid: validation.isValid,

    // State checks
    hasFiltersApplied,
    hasSourceFilters,
    hasStatusFilters,
    hasDateFilters,

    // Export/Import
    exportFilters,
    importFilters,
  };
};

// Helper functions for common filter operations
export const createFiltersFromUrl = (searchParams: URLSearchParams): Partial<SearchFilters> => {
  const filters: Partial<SearchFilters> = {};

  const sources = searchParams.get('sources');
  if (sources) {
    filters.selectedSources = sources.split(',').filter(Boolean);
  }

  const readStatus = searchParams.get('read') as "all" | "read" | "unread";
  if (readStatus && ["all", "read", "unread"].includes(readStatus)) {
    filters.readStatus = readStatus;
  }

  const archivedStatus = searchParams.get('archived') as "all" | "archived" | "active";
  if (archivedStatus && ["all", "archived", "active"].includes(archivedStatus)) {
    filters.archivedStatus = archivedStatus;
  }

  const dateFrom = searchParams.get('from');
  if (dateFrom) {
    filters.dateFrom = dateFrom;
  }

  const dateTo = searchParams.get('to');
  if (dateTo) {
    filters.dateTo = dateTo;
  }

  return filters;
};

export const addFiltersToUrl = (filters: SearchFilters, searchParams: URLSearchParams): URLSearchParams => {
  const newParams = new URLSearchParams(searchParams);

  // Add source filters
  if (filters.selectedSources.length > 0) {
    newParams.set('sources', filters.selectedSources.join(','));
  } else {
    newParams.delete('sources');
  }

  // Add read status filter
  if (filters.readStatus !== 'all') {
    newParams.set('read', filters.readStatus);
  } else {
    newParams.delete('read');
  }

  // Add archived status filter
  if (filters.archivedStatus !== 'active') {
    newParams.set('archived', filters.archivedStatus);
  } else {
    newParams.delete('archived');
  }

  // Add date filters
  if (filters.dateFrom) {
    newParams.set('from', filters.dateFrom);
  } else {
    newParams.delete('from');
  }

  if (filters.dateTo) {
    newParams.set('to', filters.dateTo);
  } else {
    newParams.delete('to');
  }

  return newParams;
};

// Preset filter configurations
export const PRESET_FILTERS = {
  UNREAD_ONLY: {
    readStatus: "unread" as const,
    archivedStatus: "active" as const,
  },
  RECENT: {
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 7 days
    archivedStatus: "active" as const,
  },
  LIKED_ONLY: {
    archivedStatus: "active" as const,
    // Note: We don't have a liked filter in the current structure
    // This would need to be added to the filters interface
  },
  ARCHIVED_ONLY: {
    archivedStatus: "archived" as const,
  },
} as const;

export default useSearchFilters;
