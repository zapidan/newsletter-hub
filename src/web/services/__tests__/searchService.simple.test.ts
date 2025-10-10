import { ILogger } from "@common/utils/logger";
import {
  buildSearchParams,
  validateSearchFilters,
} from "@web/utils/searchUtils";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSearchService, SearchServiceDependencies } from "../searchService";

// Mock dependencies
const mockGetAllNewsletterSources = vi.fn();
const mockUpdateNewsletter = vi.fn();
const mockNewsletterService = {
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  getNewsletterCountBySource: vi.fn(),
  getReadCount: vi.fn(),
  getArchivedCount: vi.fn(),
  getFeed: vi.fn(),
  getFavorites: vi.fn(),
};

const mockLogger: ILogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  auth: vi.fn(),
  api: vi.fn(),
  ui: vi.fn(),
  logUserAction: vi.fn(),
  logApiRequest: vi.fn(),
  logNavigation: vi.fn(),
  logError: vi.fn(),
};

const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

const mockWindow = {
  location: {
    href: "",
  },
  history: {
    pushState: vi.fn(),
  },
  localStorage: mockLocalStorage,
};

const mockBuildSearchParams =
  vi.fn<Parameters<typeof buildSearchParams>[0], any>();
const mockValidateSearchFilters =
  vi.fn<Parameters<typeof validateSearchFilters>[0], any>();

// Default mock dependencies
const defaultMockDependencies: SearchServiceDependencies = {
  getAllNewsletterSources: mockGetAllNewsletterSources,
  updateNewsletter: mockUpdateNewsletter,
  newsletterService: mockNewsletterService,
  logger: mockLogger,
  window: mockWindow as any,
  buildSearchParams: mockBuildSearchParams,
  validateSearchFilters: mockValidateSearchFilters,
};

// Create a new instance of the service with mock dependencies
const createMockedSearchService = (
  overrides: Partial<SearchServiceDependencies> = {},
) => {
  return createSearchService({ ...defaultMockDependencies, ...overrides });
};

describe("SearchService Simple Tests", () => {
  let serviceInstance = createMockedSearchService();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue("[]");
    mockWindow.location.href = "";
    mockValidateSearchFilters.mockReturnValue({ isValid: true, errors: [] });
    mockBuildSearchParams.mockImplementation(
      (query, filters, pagination) => ({
        search: query,
        limit: pagination.itemsPerPage || 20,
        offset: ((pagination.page || 1) - 1) * (pagination.itemsPerPage || 20),
        ...filters,
      }),
    );
    serviceInstance = createMockedSearchService();
  });

  describe("Basic functionality", () => {
    it("should create default filters", () => {
      const filters = serviceInstance.createDefaultFilters();
      expect(filters).toEqual({
        selectedSources: [],
        readStatus: "all",
        archivedStatus: "active",
        dateFrom: "",
        dateTo: "",
      });
    });

    it("should create initial state", () => {
      const state = serviceInstance.createInitialState();
      expect(state).toEqual({
        results: [],
        loading: false,
        error: null,
        searchPerformed: false,
        totalCount: 0,
        currentPage: 1,
        hasMore: false,
      });
    });

    it("should detect when filters are applied", () => {
      const defaultFilters = serviceInstance.createDefaultFilters();
      const appliedFilters = {
        ...defaultFilters,
        selectedSources: ["source-1"],
      };
      expect(serviceInstance.hasFiltersApplied(defaultFilters)).toBe(false);
      expect(serviceInstance.hasFiltersApplied(appliedFilters)).toBe(true);
    });

    it("should reset filters to default", () => {
      const resetFilters = serviceInstance.resetFilters();
      const defaultFilters = serviceInstance.createDefaultFilters();
      expect(resetFilters).toEqual(defaultFilters);
    });
  });

  describe("Search validation", () => {
    it("should validate search input successfully", () => {
      const result = serviceInstance.validateSearchInput("valid search term");
      expect(result).toEqual({ isValid: true });
    });

    it("should reject empty search input", () => {
      const result = serviceInstance.validateSearchInput("   ");
      expect(result).toEqual({
        isValid: false,
        error: "Search query cannot be empty",
      });
    });

    it("should reject short search input", () => {
      const result = serviceInstance.validateSearchInput("a");
      expect(result).toEqual({
        isValid: false,
        error: "Search query must be at least 2 characters long",
      });
    });

    it("should reject long search input", () => {
      const longQuery = "a".repeat(501);
      const result = serviceInstance.validateSearchInput(longQuery);
      expect(result).toEqual({
        isValid: false,
        error: "Search query is too long (maximum 500 characters)",
      });
    });
  });

  describe("Recent searches", () => {
    it("should save recent search", () => {
      mockLocalStorage.getItem.mockReturnValue("[]");
      serviceInstance.saveRecentSearch("test search");
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        "newsletter_recent_searches",
        JSON.stringify(["test search"]),
      );
    });

    it("should not save empty search", () => {
      serviceInstance.saveRecentSearch("   ");
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it("should get recent searches", () => {
      const mockSearches = ["search1", "search2"];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSearches));
      const result = serviceInstance.getRecentSearches();
      expect(result).toEqual(mockSearches);
    });

    it("should handle corrupted localStorage data", () => {
      mockLocalStorage.getItem.mockReturnValue("invalid json");
      const result = serviceInstance.getRecentSearches();
      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should clear all recent searches", () => {
      serviceInstance.clearRecentSearches();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        "newsletter_recent_searches",
      );
    });
  });

  describe("URL management", () => {
    it("should build URL parameters", () => {
      const params = serviceInstance.buildUrlParams("test search", 2);
      expect(params.get("q")).toBe("test search");
      expect(params.get("page")).toBe("2");
    });

    it("should not include empty parameters", () => {
      const params = serviceInstance.buildUrlParams("", 1);
      expect(params.has("q")).toBe(false);
      expect(params.has("page")).toBe(false);
    });

    it("should parse URL parameters", () => {
      const searchParams = new URLSearchParams("q=test+search&page=3");
      const result = serviceInstance.parseUrlParams(searchParams);
      expect(result).toEqual({ query: "test search", page: 3 });
    });

    it("should handle missing URL parameters", () => {
      const searchParams = new URLSearchParams();
      const result = serviceInstance.parseUrlParams(searchParams);
      expect(result).toEqual({ query: "", page: 1 });
    });

    it("should update URL", () => {
      serviceInstance.updateUrl("test", 2);
      expect(mockWindow.history.pushState).toHaveBeenCalledWith(
        { path: "/search?q=test&page=2" },
        "",
        "/search?q=test&page=2",
      );
    });
  });

  describe("State management", () => {
    it("should check if has results", () => {
      const emptyState = serviceInstance.createInitialState();
      const stateWithResults = {
        ...emptyState,
        results: [{ id: "1", title: "Test" } as any],
      };
      expect(serviceInstance.hasResults(emptyState)).toBe(false);
      expect(serviceInstance.hasResults(stateWithResults)).toBe(true);
    });

    it("should check if searching", () => {
      const idleState = serviceInstance.createInitialState();
      const loadingState = { ...idleState, loading: true };
      expect(serviceInstance.isSearching(idleState)).toBe(false);
      expect(serviceInstance.isSearching(loadingState)).toBe(true);
    });

    it("should check if has searched", () => {
      const initialState = serviceInstance.createInitialState();
      const searchedState = { ...initialState, searchPerformed: true };
      expect(serviceInstance.hasSearched(initialState)).toBe(false);
      expect(serviceInstance.hasSearched(searchedState)).toBe(true);
    });

    it("should get search statistics", () => {
      const state = {
        ...serviceInstance.createInitialState(),
        totalCount: 100,
        currentPage: 2,
        hasMore: true,
      };
      const stats = serviceInstance.getSearchStats(state);
      expect(stats).toEqual({
        totalResults: 100,
        currentPage: 2,
        totalPages: 5,
        hasMore: true,
      });
    });
  });

  describe("Error handling", () => {
    it("should format Error objects", () => {
      const error = new Error("Test error");
      const result = serviceInstance.formatSearchError(error);
      expect(result).toBe("Test error");
    });

    it("should format string errors", () => {
      const result = serviceInstance.formatSearchError("String error");
      expect(result).toBe("String error");
    });

    it("should format unknown errors", () => {
      const result = serviceInstance.formatSearchError({ unknown: "error" });
      expect(result).toBe("An unexpected error occurred while searching");
    });
  });

  describe.skip("Search functionality", () => {
    it("should perform search successfully", async () => {
      const mockResponse = {
        data: [{ id: "1", title: "Test Newsletter" }],
        count: 1,
        page: 1,
        hasMore: false,
      };
      mockNewsletterService.getAll.mockResolvedValue(mockResponse);

      const searchOptions = {
        query: "test",
        filters: serviceInstance.createDefaultFilters(),
        page: 1,
        itemsPerPage: 20,
      };

      const result = await serviceInstance.search(searchOptions);

      expect(mockNewsletterService.getAll).toHaveBeenCalled();
      expect(result).toEqual({
        data: mockResponse.data,
        count: mockResponse.count,
        page: 1,
        hasMore: false,
        totalPages: 1,
      });
    });

    it("should handle API errors gracefully", async () => {
      mockNewsletterService.getAll.mockRejectedValue(new Error("API Error"));

      const searchOptions = {
        query: "test",
        filters: serviceInstance.createDefaultFilters(),
        page: 1,
        itemsPerPage: 20,
      };

      await expect(serviceInstance.search(searchOptions)).rejects.toThrow(
        "Failed to search newsletters. Please try again.",
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should throw error for empty query", async () => {
      const searchOptions = {
        query: "   ",
        filters: serviceInstance.createDefaultFilters(),
        page: 1,
        itemsPerPage: 20,
      };

      await expect(serviceInstance.search(searchOptions)).rejects.toThrow(
        "Search query cannot be empty",
      );
    });

    it("should throw error for invalid filters", async () => {
      mockValidateSearchFilters.mockReturnValue({
        isValid: false,
        errors: ["Invalid filter"],
      });
      const searchOptions = {
        query: "test",
        filters: serviceInstance.createDefaultFilters(),
        page: 1,
        itemsPerPage: 20,
      };

      await expect(serviceInstance.search(searchOptions)).rejects.toThrow(
        "Invalid filter",
      );
    });
  });

  describe("Sources functionality", () => {
    it("should get newsletter sources successfully", async () => {
      const mockSources = [
        { id: "1", name: "Source 1" },
        { id: "2", name: "Source 2" },
      ];
      mockGetAllNewsletterSources.mockResolvedValue({ data: mockSources });

      const result = await serviceInstance.getSources();

      expect(mockGetAllNewsletterSources).toHaveBeenCalledWith();
      expect(result).toEqual(mockSources);
    });

    it("should handle sources API errors", async () => {
      mockGetAllNewsletterSources.mockRejectedValue(new Error("API Error"));
      await expect(serviceInstance.getSources()).rejects.toThrow(
        "Failed to load newsletter sources",
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe("Newsletter actions", () => {
    it("should mark newsletter as read and archived", async () => {
      mockUpdateNewsletter.mockResolvedValue({});
      await serviceInstance.markAsReadAndArchive("newsletter-1");
      expect(mockUpdateNewsletter).toHaveBeenCalledWith({
        id: "newsletter-1",
        is_read: true,
        is_archived: true,
      });
    });

    it("should handle update errors", async () => {
      mockUpdateNewsletter.mockRejectedValue(new Error("Update failed"));
      await expect(
        serviceInstance.markAsReadAndArchive("newsletter-1"),
      ).rejects.toThrow("Failed to update newsletter status");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should open newsletter detail and update status", async () => {
      mockUpdateNewsletter.mockResolvedValue({});
      await serviceInstance.openNewsletterDetail("newsletter-1");
      expect(mockUpdateNewsletter).toHaveBeenCalledWith({
        id: "newsletter-1",
        is_read: true,
        is_archived: true,
      });
      expect(mockWindow.location.href).toBe("/newsletters/newsletter-1");
    });

    it("should navigate even if status update fails", async () => {
      mockUpdateNewsletter.mockRejectedValue(new Error("Update failed"));
      await serviceInstance.openNewsletterDetail("newsletter-1");
      expect(mockWindow.location.href).toBe("/newsletters/newsletter-1");
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});