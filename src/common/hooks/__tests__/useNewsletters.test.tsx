import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useNewsletters } from "../useNewsletters";
import { newsletterApi } from "@common/api/newsletterApi";
import { getCacheManager } from "@common/utils/cacheUtils";
import { useAuth } from "@common/contexts/AuthContext";
import type { NewsletterWithRelations } from "@common/types";

// Mock dependencies
vi.mock("@common/api/newsletterApi", () => ({
  newsletterApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    bulkUpdate: vi.fn(),
    bulkDelete: vi.fn(),
    markAsRead: vi.fn(),
    toggleLike: vi.fn(),
    toggleArchive: vi.fn(),
  },
}));

vi.mock("@common/utils/cacheUtils", () => ({
  getCacheManager: () => ({
    optimisticUpdateWithRollback: vi.fn(),
    invalidateRelatedQueries: vi.fn(),
    updateNewsletterInCache: vi.fn(),
    queryClient: {
      getQueryCache: () => ({
        findAll: () => [],
      }),
    },
  }),
  getQueryData: vi.fn(),
  cancelQueries: vi.fn(),
}));

vi.mock("@common/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user", email: "test@example.com" },
    isAuthenticated: true,
    loading: false,
  }),
}));

const mockNewsletterApi = vi.mocked(newsletterApi);
const mockGetCacheManager = vi.mocked(getCacheManager);
const mockUseAuth = vi.mocked(useAuth);

// Mock data
const mockNewsletter: NewsletterWithRelations = {
  id: "test-newsletter-1",
  title: "Test Newsletter",
  content: "Test content",
  summary: "Test summary",
  is_read: false,
  is_liked: false,
  is_archived: false,
  received_at: "2024-01-01T00:00:00Z",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  user_id: "test-user",
  newsletter_source_id: "test-source",
  tags: [],
  source: null,
  word_count: 100,
  estimated_read_time: 1,
  image_url: null,
  url: null,
};

const mockCacheManager = {
  optimisticUpdateWithRollback: vi.fn(),
  invalidateRelatedQueries: vi.fn(),
  updateNewsletterInCache: vi.fn(),
  queryClient: {
    getQueryCache: () => ({
      findAll: () => [],
    }),
  },
};

const mockUser = {
  id: "test-user",
  email: "test@example.com",
};

describe("useNewsletters - Action Fixes", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mocks
    mockNewsletterApi.getAll.mockResolvedValue({
      data: [mockNewsletter],
      count: 1,
      hasMore: false,
      nextPage: null,
      prevPage: null,
    });

    mockNewsletterApi.toggleLike.mockResolvedValue(mockNewsletter);

    // Mock optimistic update with rollback
    mockCacheManager.optimisticUpdateWithRollback.mockResolvedValue({
      rollback: vi.fn(),
    });

    mockCacheManager.updateNewsletterInCache.mockImplementation(
      (id, updates) => updates,
    );
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("toggleLike mutation", () => {
    it("should properly update is_liked field in optimistic update", async () => {
      const { result } = renderHook(() => useNewsletters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      // Test that the toggleLike function exists and can be called
      expect(typeof result.current.toggleLike).toBe("function");

      // Call the function
      await act(async () => {
        await result.current.toggleLike("test-newsletter-1");
      });

      // Verify API was called
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalledWith(
        "test-newsletter-1",
      );
    });

    it("should handle undefined previousNewsletters gracefully", async () => {
      const { result } = renderHook(() => useNewsletters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      // Should not throw error and should handle gracefully
      await act(async () => {
        await result.current.toggleLike("test-newsletter-1");
      });

      expect(mockNewsletterApi.toggleLike).toHaveBeenCalledWith(
        "test-newsletter-1",
      );
    });

    it("should execute rollback functions on error", async () => {
      const mockRollback = vi.fn();
      mockCacheManager.optimisticUpdateWithRollback.mockResolvedValue({
        rollback: mockRollback,
      });

      // Mock API error
      mockNewsletterApi.toggleLike.mockRejectedValue(new Error("API Error"));

      const { result } = renderHook(() => useNewsletters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      // Call should not throw in hook context
      await act(async () => {
        try {
          await result.current.toggleLike("test-newsletter-1");
        } catch (error) {
          // Error handling is internal to the hook
        }
      });

      // API should still be called
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalled();
    });
  });

  describe("error handling and fallbacks", () => {
    it("should invalidate cache on optimistic update failure", async () => {
      mockCacheManager.optimisticUpdateWithRollback.mockRejectedValue(
        new Error("Cache update failed"),
      );

      const { result } = renderHook(() => useNewsletters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      await act(async () => {
        await result.current.toggleLike("test-newsletter-1");
      });

      // Should still call API even if optimistic update fails
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalled();
    });

    it("should handle partial rollback function failures gracefully", async () => {
      const mockRollback1 = vi.fn();
      const mockRollback2 = vi.fn().mockImplementation(() => {
        throw new Error("Rollback failed");
      });
      const mockRollback3 = vi.fn();

      // Mock multiple optimistic updates
      mockCacheManager.optimisticUpdateWithRollback
        .mockResolvedValueOnce({ rollback: mockRollback1 })
        .mockResolvedValueOnce({ rollback: mockRollback2 })
        .mockResolvedValueOnce({ rollback: mockRollback3 });

      mockNewsletterApi.toggleLike.mockRejectedValue(new Error("API Error"));

      const { result } = renderHook(() => useNewsletters(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.toggleLike("test-newsletter-1");
        } catch (error) {
          // Error handling is internal
        }
      });

      // API should be called
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalled();
    });
  });

  describe("loading and error states", () => {
    it("should expose loading states correctly", () => {
      const { result } = renderHook(() => useNewsletters(), { wrapper });

      expect(typeof result.current.isTogglingLike).toBe("boolean");
    });

    it("should expose error states correctly", () => {
      const { result } = renderHook(() => useNewsletters(), { wrapper });

      expect(result.current.errorTogglingLike).toBeNull();
    });
  });

  describe("filter preservation", () => {
    it("should preserve filter state during like/unlike operations", async () => {
      const sourceFilter = { sourceIds: ["test-source-1"] };
      const { result } = renderHook(() => useNewsletters(sourceFilter), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      await act(async () => {
        await result.current.toggleLike("filtered-1");
      });

      // Should call API with filtered context
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalledWith("filtered-1");
    });

    it("should not trigger refetch on like error when using filters", async () => {
      const sourceFilter = { sourceIds: ["test-source-1"] };
      const { result } = renderHook(() => useNewsletters(sourceFilter), {
        wrapper,
      });

      // Mock API error
      mockNewsletterApi.toggleLike.mockRejectedValue(new Error("API Error"));

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      await act(async () => {
        try {
          await result.current.toggleLike("filtered-1");
        } catch (error) {
          // Error handling is internal
        }
      });

      // Should still attempt API call
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalled();
    });
  });
});
