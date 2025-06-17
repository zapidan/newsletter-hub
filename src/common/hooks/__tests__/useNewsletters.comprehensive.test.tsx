import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useNewsletters } from "../useNewsletters";
import {
  mockNewsletters,
  createMockNewsletters,
} from "../../../__tests__/mocks/data";

// Mock dependencies
vi.mock("@common/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1", email: "test@example.com" },
  }),
}));

vi.mock("@common/utils/logger", () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logUserAction: vi.fn(),
    logNavigation: vi.fn(),
    logError: vi.fn(),
  }),
  useLoggerStatic: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    logUserAction: vi.fn(),
    logNavigation: vi.fn(),
    logError: vi.fn(),
  }),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@common/services/newsletterService", () => ({
  newsletterService: {
    getNewsletters: vi.fn(),
    updateNewsletter: vi.fn(),
    deleteNewsletter: vi.fn(),
    bulkUpdateNewsletters: vi.fn(),
    bulkDeleteNewsletters: vi.fn(),
  },
}));

vi.mock("@common/utils/cacheManager", () => ({
  getCacheManager: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    invalidate: vi.fn(),
  }),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe.skip("useNewsletters", () => {
  let mockNewsletterService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNewsletterService =
      require("@common/services/newsletterService").newsletterService;
    mockNewsletterService.getNewsletters.mockResolvedValue({
      data: mockNewsletters,
      count: mockNewsletters.length,
      hasMore: false,
    });
  });

  describe("Basic functionality", () => {
    it("should fetch newsletters successfully", async () => {
      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      expect(result.current.newsletters).toEqual(mockNewsletters);
      expect(result.current.isErrorNewsletters).toBe(false);
      expect(result.current.errorNewsletters).toBeNull();

      // Verify the service was called with correct parameters
      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith({
        search: undefined,
        isRead: undefined,
        isArchived: undefined,
        isLiked: undefined,
        tagIds: undefined,
        sourceIds: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        limit: 50,
        offset: 0,
        orderBy: "received_at",
        ascending: false,
        includeRelations: true,
        includeTags: true,
        includeStats: false,
      });
    });

    it("should handle loading state", () => {
      mockNewsletterService.getNewsletters.mockImplementation(
        () => new Promise(() => {}), // Never resolves
      );

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoadingNewsletters).toBe(true);
      expect(result.current.newsletters).toEqual([]);
    });

    it("should handle error state", async () => {
      const errorMessage = "Failed to fetch newsletters";
      mockNewsletterService.getNewsletters.mockRejectedValue(
        new Error(errorMessage),
      );

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      expect(result.current.isErrorNewsletters).toBe(true);
      expect(result.current.errorNewsletters?.message).toBe(errorMessage);
      expect(result.current.newsletters).toEqual([]);
    });
  });

  describe("Filtering", () => {
    it("should apply search filter", async () => {
      const filters = { search: "AI" };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "AI",
        }),
      );
    });

    it("should apply read status filter", async () => {
      const filters = { isRead: true };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          isRead: true,
        }),
      );
    });

    it("should apply archived status filter", async () => {
      const filters = { isArchived: false };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          isArchived: false,
        }),
      );
    });

    it("should apply tag filters", async () => {
      const filters = { tagIds: ["tag-1", "tag-2"] };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          tagIds: ["tag-1", "tag-2"],
        }),
      );
    });

    it("should apply source filters", async () => {
      const filters = { sourceIds: ["source-1", "source-2"] };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceIds: ["source-1", "source-2"],
        }),
      );
    });

    it("should apply date range filters", async () => {
      const filters = {
        dateFrom: "2024-01-01",
        dateTo: "2024-01-31",
      };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFrom: "2024-01-01",
          dateTo: "2024-01-31",
        }),
      );
    });

    it("should apply multiple filters simultaneously", async () => {
      const filters = {
        search: "AI",
        isRead: false,
        tagIds: ["tag-1"],
        limit: 20,
        offset: 10,
      };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "AI",
          isRead: false,
          tagIds: ["tag-1"],
          limit: 20,
          offset: 10,
        }),
      );
    });
  });

  describe("Sorting and pagination", () => {
    it("should apply custom sorting", async () => {
      const filters = {
        orderBy: "title",
        ascending: true,
      };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: "title",
          ascending: true,
        }),
      );
    });

    it("should handle pagination parameters", async () => {
      const filters = {
        limit: 25,
        offset: 50,
      };
      const { result } = renderHook(() => useNewsletters(filters), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 25,
          offset: 50,
        }),
      );
    });

    it("should indicate when more data is available", async () => {
      mockNewsletterService.getNewsletters.mockResolvedValue({
        data: mockNewsletters,
        count: 100,
        hasMore: true,
      });

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.hasMore).toBe(true);
      expect(result.current.totalCount).toBe(100);
    });
  });

  describe("Mutations", () => {
    it("should update newsletter successfully", async () => {
      mockNewsletterService.updateNewsletter.mockResolvedValue({
        ...mockNewsletters[0],
        is_read: true,
      });

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const updatePromise = result.current.updateNewsletter.mutateAsync({
        id: "newsletter-1",
        updates: { is_read: true },
      });

      await expect(updatePromise).resolves.toBeDefined();
      expect(mockNewsletterService.updateNewsletter).toHaveBeenCalledWith(
        "newsletter-1",
        { is_read: true },
      );
    });

    it("should delete newsletter successfully", async () => {
      mockNewsletterService.deleteNewsletter.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const deletePromise =
        result.current.deleteNewsletter.mutateAsync("newsletter-1");

      await expect(deletePromise).resolves.toBeDefined();
      expect(mockNewsletterService.deleteNewsletter).toHaveBeenCalledWith(
        "newsletter-1",
      );
    });

    it("should bulk update newsletters successfully", async () => {
      const updatedNewsletters = mockNewsletters.slice(0, 2).map((n) => ({
        ...n,
        is_read: true,
      }));
      mockNewsletterService.bulkUpdateNewsletters.mockResolvedValue(
        updatedNewsletters,
      );

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const bulkUpdatePromise =
        result.current.bulkUpdateNewsletters.mutateAsync({
          ids: ["newsletter-1", "newsletter-2"],
          updates: { is_read: true },
        });

      await expect(bulkUpdatePromise).resolves.toBeDefined();
      expect(mockNewsletterService.bulkUpdateNewsletters).toHaveBeenCalledWith(
        ["newsletter-1", "newsletter-2"],
        { is_read: true },
      );
    });

    it("should bulk delete newsletters successfully", async () => {
      mockNewsletterService.bulkDeleteNewsletters.mockResolvedValue(undefined);

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const bulkDeletePromise =
        result.current.bulkDeleteNewsletters.mutateAsync([
          "newsletter-1",
          "newsletter-2",
        ]);

      await expect(bulkDeletePromise).resolves.toBeDefined();
      expect(mockNewsletterService.bulkDeleteNewsletters).toHaveBeenCalledWith([
        "newsletter-1",
        "newsletter-2",
      ]);
    });
  });

  describe("Error handling", () => {
    it("should handle update mutation errors", async () => {
      mockNewsletterService.updateNewsletter.mockRejectedValue(
        new Error("Update failed"),
      );

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const updatePromise = result.current.updateNewsletter.mutateAsync({
        id: "newsletter-1",
        updates: { is_read: true },
      });

      await expect(updatePromise).rejects.toThrow("Update failed");
    });

    it("should handle delete mutation errors", async () => {
      mockNewsletterService.deleteNewsletter.mockRejectedValue(
        new Error("Delete failed"),
      );

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const deletePromise =
        result.current.deleteNewsletter.mutateAsync("newsletter-1");

      await expect(deletePromise).rejects.toThrow("Delete failed");
    });

    it("should handle network errors gracefully", async () => {
      mockNewsletterService.getNewsletters.mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.newsletters).toEqual([]);
    });
  });

  describe("Options and configuration", () => {
    it("should respect enabled option", () => {
      const { result } = renderHook(
        () => useNewsletters({}, { enabled: false }),
        {
          wrapper: createWrapper(),
        },
      );

      expect(result.current.isLoading).toBe(false);
      expect(mockNewsletterService.getNewsletters).not.toHaveBeenCalled();
    });

    it("should respect refetchOnWindowFocus option", async () => {
      const { result } = renderHook(
        () => useNewsletters({}, { refetchOnWindowFocus: true }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Simulate window focus
      window.dispatchEvent(new Event("focus"));

      await waitFor(() => {
        expect(mockNewsletterService.getNewsletters).toHaveBeenCalledTimes(2);
      });
    });

    it("should use custom stale time", async () => {
      const { result } = renderHook(
        () => useNewsletters({}, { staleTime: 10000 }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // The specific stale time behavior would be tested at the QueryClient level
      expect(result.current.newsletters).toEqual(mockNewsletters);
    });
  });

  describe("Performance optimizations", () => {
    it("should memoize query parameters", async () => {
      const filters = { search: "AI" };
      const { rerender } = renderHook(
        ({ filters }) => useNewsletters(filters),
        {
          wrapper: createWrapper(),
          initialProps: { filters },
        },
      );

      await waitFor(() => {
        expect(mockNewsletterService.getNewsletters).toHaveBeenCalledTimes(1);
      });

      // Rerender with same filters should not trigger new request
      rerender({ filters });

      expect(mockNewsletterService.getNewsletters).toHaveBeenCalledTimes(1);
    });

    it("should handle large datasets efficiently", async () => {
      const largeDataset = createMockNewsletters(1000);
      mockNewsletterService.getNewsletters.mockResolvedValue({
        data: largeDataset,
        count: largeDataset.length,
        hasMore: false,
      });

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.newsletters).toHaveLength(1000);
      expect(result.current.totalCount).toBe(1000);
    });
  });

  describe("Race condition handling", () => {
    it("should handle rapid filter changes", async () => {
      let resolveFirst: (value: any) => void;
      let resolveSecond: (value: any) => void;

      const firstPromise = new Promise((resolve) => {
        resolveFirst = resolve;
      });
      const secondPromise = new Promise((resolve) => {
        resolveSecond = resolve;
      });

      mockNewsletterService.getNewsletters
        .mockImplementationOnce(() => firstPromise)
        .mockImplementationOnce(() => secondPromise);

      const { result, rerender } = renderHook(
        ({ filters }) => useNewsletters(filters),
        {
          wrapper: createWrapper(),
          initialProps: { filters: { search: "first" } },
        },
      );

      // Start second request before first completes
      rerender({ filters: { search: "second" } });

      // Resolve second request first
      resolveSecond!({
        data: [mockNewsletters[1]],
        count: 1,
        hasMore: false,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Resolve first request (should be ignored)
      resolveFirst!({
        data: [mockNewsletters[0]],
        count: 1,
        hasMore: false,
      });

      // Should still have results from second request
      expect(result.current.newsletters).toEqual([mockNewsletters[1]]);
    });
  });

  describe("Cache integration", () => {
    it("should use cache manager for optimization", async () => {
      const mockCacheManager =
        require("@common/utils/cacheManager").getCacheManager();

      const { result } = renderHook(() => useNewsletters(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Cache manager should be called for cache operations
      expect(mockCacheManager.get).toHaveBeenCalled();
    });
  });
});
