import { NewsletterGroup } from "@common/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  SearchFilters,
  SearchOptions,
  searchService,
  SearchState,
} from "../services/searchService";
import { debounce, generateSearchSuggestions } from "../utils/searchUtils";

/**
 * Main search hook that manages search state and operations
 */
export const useSearch = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialQuery = searchParams.get("q") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);

  const [state, setState] = useState<SearchState>(() => ({
    ...searchService().createInitialState(),
    currentPage: initialPage,
  }));

  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(
    searchService().createDefaultFilters(),
  );

  const itemsPerPage = 20;

  /**
   * Performs the actual search
   */
  const performSearch = useCallback(
    async (searchQuery: string, searchFilters: SearchFilters, page = 1) => {
      if (!searchQuery.trim()) return;

      // Validate input
      const validation = searchService().validateSearchInput(searchQuery);
      if (!validation.isValid) {
        setState((prev) => ({ ...prev, error: validation.error || null }));
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const options: SearchOptions = {
          query: searchQuery,
          filters: searchFilters,
          page,
          itemsPerPage,
        };

        const result = await searchService().search(options);

        setState((prev) => ({
          ...prev,
          results: result.data,
          totalCount: result.count,
          currentPage: page,
          hasMore: result.hasMore,
          searchPerformed: true,
          loading: false,
        }));

        // Save to recent searches
        searchService().saveRecentSearch(searchQuery.trim());

        // Update URL
        searchService().updateUrl(searchQuery, page > 1 ? page : undefined);
      } catch (error) {
        const errorMessage = searchService().formatSearchError(error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
          results: [],
          totalCount: 0,
          hasMore: false,
        }));
      }
    },
    [itemsPerPage],
  );

  /**
   * Handles search execution
   */
  const handleSearch = useCallback(() => {
    performSearch(query, filters, 1);
  }, [query, filters, performSearch]);

  /**
   * Handles page changes
   */
  const handlePageChange = useCallback(
    (page: number) => {
      performSearch(query, filters, page);
    },
    [query, filters, performSearch],
  );

  /**
   * Clears search and resets state
   */
  const clearSearch = useCallback(() => {
    setQuery("");
    setFilters(searchService().createDefaultFilters());
    setState(searchService().createInitialState());
    searchService().updateUrl("");
  }, []);

  /**
   * Updates search query
   */
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
    if (!newQuery.trim()) {
      setState((prev) => ({
        ...prev,
        results: [],
        searchPerformed: false,
        error: null,
      }));
    }
  }, []);

  /**
   * Handles newsletter result click - marks as read, archives, and opens detail
   */
  const handleResultClick = useCallback(async (newsletterId: string) => {
    try {
      // Update the newsletter status in local state immediately for optimistic UI
      setState((prev) => ({
        ...prev,
        results: prev.results.map((result) =>
          result.id === newsletterId
            ? { ...result, is_read: true, is_archived: true }
            : result,
        ),
      }));

      await searchService().openNewsletterDetail(newsletterId);
    } catch (error) {
      console.error("Failed to open newsletter detail:", error);
      // Revert optimistic update on error
      setState((prev) => ({
        ...prev,
        results: prev.results.map((result) =>
          result.id === newsletterId
            ? { ...result, is_read: false, is_archived: false }
            : result,
        ),
      }));
      // Still navigate even if status update fails
      window.location.href = `/newsletters/${newsletterId}`;
    }
  }, []);

  /**
   * Updates search filters
   */
  const updateFilters = useCallback((newFilters: Partial<SearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Clears all filters
   */
  const clearFilters = useCallback(() => {
    setFilters(searchService().createDefaultFilters());
  }, []);

  /**
   * Checks if filters are applied
   */
  const hasFiltersApplied = useCallback(() => {
    return searchService().hasFiltersApplied(filters);
  }, [filters]);

  // Initial search if query exists
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, filters, initialPage);
    }
  }, [initialQuery, initialPage, filters, performSearch]); // Only run on mount

  return {
    // State
    query,
    filters,
    results: state.results,
    loading: state.loading,
    error: state.error,
    searchPerformed: state.searchPerformed,
    totalCount: state.totalCount,
    currentPage: state.currentPage,
    hasMore: state.hasMore,
    itemsPerPage,

    // Actions
    updateQuery,
    updateFilters,
    handleSearch,
    handlePageChange,
    handleResultClick,
    clearSearch,
    clearFilters,

    // Computed
    hasFiltersApplied: hasFiltersApplied(),
    hasResults: searchService().hasResults(state),
    isSearching: searchService().isSearching(state),
    hasSearched: searchService().hasSearched(state),
  };
};

/**
 * Hook for managing search suggestions
 */
export const useSearchSuggestions = (query: string) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const suggestionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(searchService().getRecentSearches());
  }, []);

  // Generate suggestions based on query
  const debouncedGenerateSuggestions = useCallback(
    debounce((...args: unknown[]) => {
      const searchQuery = args[0] as string;
      if (searchQuery.length >= 2) {
        const generatedSuggestions = generateSearchSuggestions(
          searchQuery,
          recentSearches,
        );
        setSuggestions(generatedSuggestions);
        setShowSuggestions(generatedSuggestions.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300),
    [recentSearches],
  );

  useEffect(() => {
    debouncedGenerateSuggestions(query);
  }, [query, debouncedGenerateSuggestions]);

  // Handle clicks outside suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setShowSuggestions(false);
    return suggestion;
  }, []);

  const removeRecentSearch = useCallback((searchQuery: string) => {
    searchService().removeRecentSearch(searchQuery);
    setRecentSearches(searchService().getRecentSearches());
  }, []);

  const showSuggestionsDropdown = useCallback(() => {
    if (query.length >= 2 || recentSearches.length > 0) {
      setShowSuggestions(true);
    }
  }, [query, recentSearches]);

  const hideSuggestions = useCallback(() => {
    setShowSuggestions(false);
  }, []);

  return {
    suggestions,
    showSuggestions,
    recentSearches,
    suggestionsRef,
    inputRef,
    handleSuggestionClick,
    removeRecentSearch,
    showSuggestionsDropdown,
    hideSuggestions,
  };
};

/**
 * Hook for managing newsletter sources for filtering
 */
export const useNewsletterSources = () => {
  const [sources, setSources] = useState<NewsletterSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSources = async () => {
      setLoading(true);
      setError(null);

      try {
        const loadedSources = await searchService().getSources();
        setSources(loadedSources);
      } catch (err) {
        setError(searchService().formatSearchError(err));
      } finally {
        setLoading(false);
      }
    };

    loadSources();
  }, []);

  return {
    sources,
    loading,
    error,
  };
};

/**
 * Hook for managing newsletter groups for filtering
 */
export const useNewsletterGroups = () => {
  const [groups, setGroups] = useState<NewsletterGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGroups = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('Loading groups...');
        const loadedGroups = await searchService().getGroups();
        console.log('Groups loaded:', loadedGroups);
        setGroups(loadedGroups);
      } catch (err) {
        console.error('Error loading groups:', err);
        setError(searchService().formatSearchError(err));
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, []);

  return {
    groups,
    loading,
    error,
  };
};

/**
 * Hook for managing pagination logic
 */
export const usePagination = (
  currentPage: number,
  totalCount: number,
  itemsPerPage: number,
  onPageChange: (page: number) => void,
) => {
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const hasMore = currentPage < totalPages;
  const hasPrevious = currentPage > 1;

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        onPageChange(page);
      }
    },
    [totalPages, onPageChange],
  );

  const goToNext = useCallback(() => {
    if (hasMore) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, hasMore, goToPage]);

  const goToPrevious = useCallback(() => {
    if (hasPrevious) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, hasPrevious, goToPage]);

  const getVisiblePages = useCallback(
    (maxVisible = 5) => {
      if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const pages: (number | "ellipsis")[] = [];
      const startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
      const endPage = Math.min(totalPages, startPage + maxVisible - 1);

      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) {
          pages.push("ellipsis");
        }
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push("ellipsis");
        }
        pages.push(totalPages);
      }

      return pages;
    },
    [currentPage, totalPages],
  );

  return {
    totalPages,
    hasMore,
    hasPrevious,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
    goToPage,
    goToNext,
    goToPrevious,
    getVisiblePages,
  };
};

/**
 * Hook for managing search URL state
 */
export const useSearchUrl = () => {
  const location = useLocation();

  const getSearchParams = useCallback(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchService().parseUrlParams(searchParams);
  }, [location.search]);

  const updateSearchUrl = useCallback((query: string, page?: number) => {
    searchService().updateUrl(query, page);
  }, []);

  return {
    getSearchParams,
    updateSearchUrl,
  };
};

/**
 * Hook for keyboard navigation
 */
export const useSearchKeyboard = (
  onSearch: () => void,
  onEscape: () => void,
) => {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case "Enter":
          event.preventDefault();
          onSearch();
          break;
        case "Escape":
          event.preventDefault();
          onEscape();
          break;
      }
    },
    [onSearch, onEscape],
  );

  return { handleKeyDown };
};
