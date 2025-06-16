import {
  newsletterApi,
  getAllNewsletterSources,
  markAsRead,
} from "@common/api";
import { Newsletter, NewsletterSource } from "@common/types";
import { buildSearchParams, validateSearchFilters } from "../utils/searchUtils";

export interface SearchFilters {
  selectedSources: string[];
  readStatus: "all" | "read" | "unread";
  archivedStatus: "all" | "archived" | "active";
  dateFrom: string;
  dateTo: string;
}

export interface SearchOptions {
  query: string;
  filters: SearchFilters;
  page: number;
  itemsPerPage: number;
}

export interface SearchResult {
  data: Newsletter[];
  count: number;
  page: number;
  hasMore: boolean;
  totalPages: number;
}

export interface SearchState {
  results: Newsletter[];
  loading: boolean;
  error: string | null;
  searchPerformed: boolean;
  totalCount: number;
  currentPage: number;
  hasMore: boolean;
}

class SearchService {
  private static readonly RECENT_SEARCHES_KEY = "newsletter_recent_searches";
  private static readonly MAX_RECENT_SEARCHES = 10;

  /**
   * Performs a search with the given options
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    const { query, filters, page, itemsPerPage } = options;

    // Validate search query
    if (!query.trim()) {
      throw new Error("Search query cannot be empty");
    }

    // Validate filters
    const validation = validateSearchFilters(filters);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(", "));
    }

    // Build search parameters
    const searchParams = buildSearchParams(query, filters, {
      page,
      itemsPerPage,
    });

    try {
      const response = await newsletterApi.search(query, searchParams);

      return {
        data: response.data,
        count: response.count,
        page: response.page,
        hasMore: response.hasMore,
        totalPages: Math.ceil(response.count / itemsPerPage),
      };
    } catch (error) {
      console.error("Search failed:", error);
      throw new Error("Failed to search newsletters. Please try again.");
    }
  }

  /**
   * Gets all newsletter sources for filtering
   */
  async getSources(): Promise<NewsletterSource[]> {
    try {
      const response = await getAllNewsletterSources({
        includeStats: true,
        isArchived: false,
      });
      return response.data;
    } catch (error) {
      console.error("Failed to load sources:", error);
      throw new Error("Failed to load newsletter sources");
    }
  }

  /**
   * Marks a newsletter as read and archives it
   */
  async markAsReadAndArchive(newsletterId: string): Promise<void> {
    try {
      console.log("🔄 Updating newsletter status:", newsletterId);

      // Update both read and archived status in one call
      await newsletterApi.update({
        id: newsletterId,
        is_read: true,
        is_archived: true,
      });

      console.log("✅ Newsletter marked as read and archived:", newsletterId);
    } catch (error) {
      console.error("❌ Failed to mark newsletter as read and archive:", error);
      throw new Error("Failed to update newsletter status");
    }
  }

  /**
   * Opens newsletter detail view and updates status
   */
  async openNewsletterDetail(newsletterId: string): Promise<void> {
    try {
      console.log("🚀 Opening newsletter detail:", newsletterId);

      // Update newsletter status
      await this.markAsReadAndArchive(newsletterId);

      // Navigate to detail view
      console.log("🔗 Navigating to:", `/newsletters/${newsletterId}`);
      window.location.href = `/newsletters/${newsletterId}`;
    } catch (error) {
      console.error("❌ Failed to open newsletter detail:", error);
      // Still navigate even if status update fails
      window.location.href = `/newsletters/${newsletterId}`;
    }
  }

  /**
   * Saves a search query to recent searches
   */
  saveRecentSearch(query: string): void {
    if (!query.trim()) return;

    const recentSearches = this.getRecentSearches();
    const updatedSearches = [
      query.trim(),
      ...recentSearches.filter((search) => search !== query.trim()),
    ].slice(0, SearchService.MAX_RECENT_SEARCHES);

    this.setRecentSearches(updatedSearches);
  }

  /**
   * Gets recent searches from localStorage
   */
  getRecentSearches(): string[] {
    try {
      const saved = localStorage.getItem(SearchService.RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error("Failed to parse recent searches:", error);
      return [];
    }
  }

  /**
   * Sets recent searches in localStorage
   */
  private setRecentSearches(searches: string[]): void {
    try {
      localStorage.setItem(
        SearchService.RECENT_SEARCHES_KEY,
        JSON.stringify(searches),
      );
    } catch (error) {
      console.error("Failed to save recent searches:", error);
    }
  }

  /**
   * Removes a specific search from recent searches
   */
  removeRecentSearch(query: string): void {
    const recentSearches = this.getRecentSearches();
    const updatedSearches = recentSearches.filter((search) => search !== query);
    this.setRecentSearches(updatedSearches);
  }

  /**
   * Clears all recent searches
   */
  clearRecentSearches(): void {
    try {
      localStorage.removeItem(SearchService.RECENT_SEARCHES_KEY);
    } catch (error) {
      console.error("Failed to clear recent searches:", error);
    }
  }

  /**
   * Creates default search filters
   */
  createDefaultFilters(): SearchFilters {
    return {
      selectedSources: [],
      readStatus: "all",
      archivedStatus: "active",
      dateFrom: "",
      dateTo: "",
    };
  }

  /**
   * Creates initial search state
   */
  createInitialState(): SearchState {
    return {
      results: [],
      loading: false,
      error: null,
      searchPerformed: false,
      totalCount: 0,
      currentPage: 1,
      hasMore: false,
    };
  }

  /**
   * Checks if filters are applied (not default)
   */
  hasFiltersApplied(filters: SearchFilters): boolean {
    const defaultFilters = this.createDefaultFilters();

    return (
      filters.selectedSources.length > 0 ||
      filters.readStatus !== defaultFilters.readStatus ||
      filters.archivedStatus !== defaultFilters.archivedStatus ||
      filters.dateFrom !== defaultFilters.dateFrom ||
      filters.dateTo !== defaultFilters.dateTo
    );
  }

  /**
   * Resets filters to default values
   */
  resetFilters(): SearchFilters {
    return this.createDefaultFilters();
  }

  /**
   * Builds URL search parameters for browser history
   */
  buildUrlParams(query: string, page?: number): URLSearchParams {
    const params = new URLSearchParams();

    if (query.trim()) {
      params.set("q", query.trim());
    }

    if (page && page > 1) {
      params.set("page", page.toString());
    }

    return params;
  }

  /**
   * Parses URL search parameters
   */
  parseUrlParams(searchParams: URLSearchParams): {
    query: string;
    page: number;
  } {
    return {
      query: searchParams.get("q") || "",
      page: parseInt(searchParams.get("page") || "1", 10),
    };
  }

  /**
   * Updates browser URL with search state
   */
  updateUrl(query: string, page?: number): void {
    const params = this.buildUrlParams(query, page);
    const newUrl = `/search${params.toString() ? `?${params.toString()}` : ""}`;

    window.history.pushState({ path: newUrl }, "", newUrl);
  }

  /**
   * Validates search input
   */
  validateSearchInput(query: string): { isValid: boolean; error?: string } {
    if (!query.trim()) {
      return { isValid: false, error: "Search query cannot be empty" };
    }

    if (query.trim().length < 2) {
      return {
        isValid: false,
        error: "Search query must be at least 2 characters long",
      };
    }

    if (query.length > 500) {
      return {
        isValid: false,
        error: "Search query is too long (maximum 500 characters)",
      };
    }

    return { isValid: true };
  }

  /**
   * Formats search error for display
   */
  formatSearchError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return "An unexpected error occurred while searching";
  }

  /**
   * Checks if search results are empty
   */
  hasResults(state: SearchState): boolean {
    return state.results.length > 0;
  }

  /**
   * Checks if search is in progress
   */
  isSearching(state: SearchState): boolean {
    return state.loading;
  }

  /**
   * Checks if search has been performed
   */
  hasSearched(state: SearchState): boolean {
    return state.searchPerformed;
  }

  /**
   * Gets search statistics for display
   */
  getSearchStats(state: SearchState): {
    totalResults: number;
    currentPage: number;
    totalPages: number;
    hasMore: boolean;
  } {
    return {
      totalResults: state.totalCount,
      currentPage: state.currentPage,
      totalPages: Math.ceil(state.totalCount / 20), // Default page size
      hasMore: state.hasMore,
    };
  }
}

// Export singleton instance
export const searchService = new SearchService();
export default searchService;
