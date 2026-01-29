import React from "react";

interface SearchParams {
  [key: string]: string | number | boolean | string[] | undefined;
}

/**
 * Highlights search terms in text with JSX elements
 */
export const highlightSearchTerms = (
  text: string,
  searchQuery: string,
): React.JSX.Element => {
  if (!searchQuery.trim() || !text) {
    return <span>{text}</span>;
  }

  const terms = searchQuery.split(" ").filter((term) => term.length > 1);
  let highlightedText = text;

  terms.forEach((term) => {
    const regex = new RegExp(`(${escapeRegExp(term)})`, "gi");
    highlightedText = highlightedText.replace(
      regex,
      "|||HIGHLIGHT_START|||$1|||HIGHLIGHT_END|||",
    );
  });

  const parts = highlightedText.split("|||");

  return (
    <span>
      {parts.map((part, index) => {
        if (part === "HIGHLIGHT_START" || part === "HIGHLIGHT_END") return null;

        const prevPart = parts[index - 1];
        const isHighlighted = prevPart === "HIGHLIGHT_START";

        return isHighlighted ? (
          <mark
            key={index}
            className="bg-yellow-200 text-yellow-900 px-1 rounded font-medium"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
};

/**
 * Extracts relevant context from content based on search query
 */
export const getSearchContext = (
  text: string,
  searchQuery: string,
  maxLength = 150,
): string => {
  if (!searchQuery.trim() || !text) return "";

  const terms = searchQuery.split(" ").filter((term) => term.length > 1);
  const lowerText = text.toLowerCase();

  // Find the first matching term and extract context around it
  for (const term of terms) {
    const index = lowerText.indexOf(term.toLowerCase());
    if (index !== -1) {
      const start = Math.max(0, index - 50);
      const end = Math.min(text.length, index + term.length + 100);
      let context = text.substring(start, end);

      if (start > 0) context = "..." + context;
      if (end < text.length) context = context + "...";

      return context;
    }
  }

  // If no terms found, return truncated text
  return text.substring(0, maxLength) + (text.length > maxLength ? "..." : "");
};

/**
 * Generates search suggestions based on query and recent searches
 */
export const generateSearchSuggestions = (
  query: string,
  recentSearches: string[] = [],
  maxSuggestions = 5,
): string[] => {
  if (query.length < 2) return [];

  const suggestions = new Set<string>();

  // Add matching recent searches
  recentSearches
    .filter((search) => search.toLowerCase().includes(query.toLowerCase()))
    .forEach((search) => suggestions.add(search));

  // Add topic-based suggestions
  const topicSuggestions = getTopicSuggestions(query);
  topicSuggestions.forEach((suggestion) => suggestions.add(suggestion));

  return Array.from(suggestions)
    .filter((suggestion) => suggestion.toLowerCase() !== query.toLowerCase())
    .slice(0, maxSuggestions);
};

/**
 * Gets topic-based suggestions for search queries
 */
export const getTopicSuggestions = (query: string): string[] => {
  const lowerQuery = query.toLowerCase();
  const suggestions: string[] = [];

  // Technology suggestions
  if (lowerQuery.includes("ai") || lowerQuery.includes("artificial")) {
    suggestions.push(
      "AI technology",
      "AI research",
      "artificial intelligence",
      "machine learning",
    );
  }

  if (lowerQuery.includes("tech")) {
    suggestions.push(
      "technology trends",
      "tech news",
      "tech startups",
      "tech innovation",
    );
  }

  if (lowerQuery.includes("crypto") || lowerQuery.includes("bitcoin")) {
    suggestions.push(
      "cryptocurrency",
      "crypto news",
      "blockchain",
      "bitcoin analysis",
    );
  }

  if (lowerQuery.includes("market") || lowerQuery.includes("finance")) {
    suggestions.push(
      "market analysis",
      "market trends",
      "stock market",
      "financial news",
    );
  }

  if (lowerQuery.includes("startup") || lowerQuery.includes("business")) {
    suggestions.push(
      "startup funding",
      "business strategy",
      "entrepreneurship",
      "venture capital",
    );
  }

  if (lowerQuery.includes("web") || lowerQuery.includes("development")) {
    suggestions.push(
      "web development",
      "software engineering",
      "programming",
      "web design",
    );
  }

  if (lowerQuery.includes("data") || lowerQuery.includes("analytics")) {
    suggestions.push("data science", "data analysis", "big data", "analytics");
  }

  if (lowerQuery.includes("design") || lowerQuery.includes("ui")) {
    suggestions.push(
      "design trends",
      "UI/UX design",
      "product design",
      "user experience",
    );
  }

  return suggestions;
};

/**
 * Processes search query to extract meaningful terms
 */
export const processSearchQuery = (
  query: string,
): {
  terms: string[];
  originalQuery: string;
  hasValidTerms: boolean;
} => {
  const trimmedQuery = query.trim();
  const terms = trimmedQuery
    .split(/\s+/)
    .filter((term) => term.length > 1)
    .map((term) => term.toLowerCase());

  return {
    terms,
    originalQuery: trimmedQuery,
    hasValidTerms: terms.length > 0,
  };
};

/**
 * Builds search query parameters for API calls
 */
export const buildSearchParams = (
  query: string,
  filters: {
    selectedSources?: string[];
    archivedStatus?: "all" | "archived" | "active";
    dateFrom?: string;
    dateTo?: string;
  },
  pagination: {
    page?: number;
    itemsPerPage?: number;
  } = {},
): SearchParams => {
  const { page = 1, itemsPerPage = 20 } = pagination;

  const params: SearchParams = {
    search: query,
    limit: itemsPerPage,
    offset: (page - 1) * itemsPerPage,
    includeSource: true,
    includeTags: true,
  };

  // Apply filters
  if (filters.selectedSources?.length) {
    params.sourceIds = filters.selectedSources;
  }

  if (filters.archivedStatus !== "all") {
    params.isArchived = filters.archivedStatus === "archived";
  }

  if (filters.dateFrom) {
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    params.dateTo = filters.dateTo;
  }

  return params;
};

/**
 * Validates search filters
 */
export const validateSearchFilters = (filters: {
  dateFrom?: string;
  dateTo?: string;
  selectedSources?: string[];
}): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  // Validate date range
  if (filters.dateFrom && filters.dateTo) {
    const fromDate = new Date(filters.dateFrom);
    const toDate = new Date(filters.dateTo);

    if (fromDate > toDate) {
      errors.push("Start date must be before end date");
    }

    if (toDate > new Date()) {
      errors.push("End date cannot be in the future");
    }
  }

  // Validate sources
  if (filters.selectedSources && filters.selectedSources.length > 50) {
    errors.push("Too many sources selected (maximum 50)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Formats search results count for display
 */
export const formatResultsCount = (
  count: number,
  hasFilters: boolean,
): string => {
  if (count === 0) {
    return hasFilters ? "No results match your filters" : "No results found";
  }

  if (count === 1) {
    return "1 result found";
  }

  return `${count.toLocaleString()} results found`;
};

/**
 * Formats pagination info for display
 */
export const formatPaginationInfo = (
  currentPage: number,
  itemsPerPage: number,
  totalCount: number,
): string => {
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalCount);

  return `Showing ${start.toLocaleString()} to ${end.toLocaleString()} of ${totalCount.toLocaleString()} results`;
};

/**
 * Calculates pagination metadata
 */
export const calculatePagination = (
  currentPage: number,
  itemsPerPage: number,
  totalCount: number,
) => {
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const hasMore = currentPage < totalPages;
  const hasPrevious = currentPage > 1;

  return {
    totalPages,
    hasMore,
    hasPrevious,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages,
  };
};

/**
 * Generates page numbers for pagination component
 */
export const generatePageNumbers = (
  currentPage: number,
  totalPages: number,
  maxVisiblePages = 5,
): (number | "ellipsis")[] => {
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];
  const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

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
};

/**
 * Escapes special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Debounces a function call
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * Throttles a function call
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
): ((...args: Parameters<T>) => void) => {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
};
