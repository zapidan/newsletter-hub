import { newsletterSourceService } from '@common/services/newsletterSource/NewsletterSourceService';
import type { NewsletterSource } from '@common/types';
import type { NewsletterSourceQueryParams } from '@common/types/api';
import { useCallback, useState } from 'react';

interface UseSourceSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
}

interface UseSourceSearchReturn {
  searchResults: NewsletterSource[];
  isSearching: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  searchError: string | null;
}

export const useSourceSearch = (options: UseSourceSearchOptions = {}): UseSourceSearchReturn => {
  const { debounceMs = 300, minQueryLength = 2 } = options;

  const [searchResults, setSearchResults] = useState<NewsletterSource[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQueryState] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (query.length < minQueryLength) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const searchParams: NewsletterSourceQueryParams = {
        search: query.trim(),
        excludeArchived: false,
        limit: 50, // Limit search results for performance
        orderBy: 'name',
        orderDirection: 'asc',
        includeCount: false, // No need for counts in search results
      };

      const result = await newsletterSourceService.getSources(searchParams);

      setSearchResults(result.data);
    } catch (error) {
      console.error('Source search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [minQueryLength]);

  // Debounced search
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryState(query);

    // Clear results immediately if query is too short
    if (query.length < minQueryLength) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    // Debounce the actual search
    const timeoutId = setTimeout(() => {
      performSearch(query);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [performSearch, debounceMs, minQueryLength]);

  const clearSearch = useCallback(() => {
    setSearchQueryState('');
    setSearchResults([]);
    setSearchError(null);
  }, []);

  return {
    searchResults,
    isSearching,
    searchQuery,
    setSearchQuery,
    clearSearch,
    searchError,
  };
};
