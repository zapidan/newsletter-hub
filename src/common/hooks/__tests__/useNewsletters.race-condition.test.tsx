import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useNewsletters } from "../useNewsletters";
import { newsletterApi } from "@common/api";
import { useAuth } from "@common/contexts/AuthContext";

// Mock dependencies
vi.mock("@common/api");
vi.mock("@common/contexts/AuthContext");
vi.mock("@common/utils/cacheUtils");

const mockNewsletterApi = vi.mocked(newsletterApi);
const mockUseAuth = vi.mocked(useAuth);

// Mock data
const mockUser = { id: "user-1", email: "test@example.com" };
const mockNewsletters = [
  {
    id: "newsletter-1",
    title: "Test Newsletter 1",
    newsletter_source_id: "source-1",
    is_read: false,
    is_archived: false,
    source: { id: "source-1", name: "Test Source" },
    tags: [],
  },
  {
    id: "newsletter-2",
    title: "Test Newsletter 2",
    newsletter_source_id: "source-2",
    is_read: true,
    is_archived: false,
    source: { id: "source-2", name: "Test Source 2" },
    tags: [],
  },
];

const mockApiResponse = {
  data: mockNewsletters,
  count: mockNewsletters.length,
  hasMore: false,
  nextPage: null,
  prevPage: null,
};

// Test wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe.skip("useNewsletters Race Condition Fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser } as any);
    mockNewsletterApi.getAll.mockResolvedValue(mockApiResponse);

    // Mock console methods for debug testing
    vi.spyOn(console, "group").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "groupEnd").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Single Source of Truth", () => {
    it("should provide newsletters data directly from the hook without race conditions", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () => useNewsletters({ isArchived: false }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      // Should have newsletters from the hook directly
      expect(result.current.newsletters).toEqual(mockNewsletters);
      expect(result.current.newsletters.length).toBe(2);

      // Should not need any local state management
      expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
    });

    it("should handle filter changes without race conditions", async () => {
      const wrapper = createWrapper();

      const { result, rerender } = renderHook(
        ({ filters }) => useNewsletters(filters),
        {
          wrapper,
          initialProps: { filters: { isArchived: false } },
        },
      );

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      // Change filters
      rerender({ filters: { isArchived: false, sourceIds: ["source-1"] } });

      await waitFor(() => {
        expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(2);
      });

      // Should have consistent data without race conditions
      expect(result.current.newsletters).toBeDefined();
    });
  });

  describe("Hook Usage Patterns", () => {
    it("should allow single hook call with all needed functionality", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () => useNewsletters({ isArchived: false }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      // Should provide all necessary functions in one call
      expect(result.current.newsletters).toBeDefined();
      expect(result.current.markAsRead).toBeDefined();
      expect(result.current.toggleLike).toBeDefined();
      expect(result.current.toggleArchive).toBeDefined();
      expect(result.current.bulkArchive).toBeDefined();
      expect(result.current.getNewsletter).toBeDefined();
    });

    it("should work correctly with disabled option for utility-only usage", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(
        () => useNewsletters({}, { enabled: false }),
        { wrapper },
      );

      // Should not make API calls when disabled
      expect(mockNewsletterApi.getAll).not.toHaveBeenCalled();

      // But should still provide utility functions
      expect(result.current.getNewsletter).toBeDefined();
      expect(result.current.markAsRead).toBeDefined();
    });
  });

  describe("Debug Logging", () => {
    it("should not log when debug is false or undefined", async () => {
      const wrapper = createWrapper();

      renderHook(() => useNewsletters({ isArchived: false }), { wrapper });

      await waitFor(() => {
        expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
      });

      // Should not call console methods when debug is off
      expect(console.group).not.toHaveBeenCalled();
      expect(console.log).not.toHaveBeenCalled();
      expect(console.groupEnd).not.toHaveBeenCalled();
    });

    it("should log when debug is true", async () => {
      const wrapper = createWrapper();

      renderHook(() => useNewsletters({ isArchived: false }, { debug: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
      });

      // Should call console methods when debug is on
      expect(console.group).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalled();
      expect(console.groupEnd).toHaveBeenCalled();
    });
  });

  describe("Filter Consistency", () => {
    it("should not make empty filter calls", async () => {
      const wrapper = createWrapper();

      renderHook(() => useNewsletters({ sourceIds: ["source-1"] }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
      });

      const apiCall = mockNewsletterApi.getAll.mock.calls[0][0];

      // Should have proper filter parameters
      expect(apiCall.sourceIds).toEqual(["source-1"]);
      expect(apiCall.sourceIds).not.toBeUndefined();
      expect(apiCall.sourceIds).not.toEqual([]);
    });

    it("should handle undefined filters gracefully", async () => {
      const wrapper = createWrapper();

      renderHook(() => useNewsletters(undefined as any), { wrapper });

      await waitFor(() => {
        expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
      });

      // Should work with undefined filters
      expect(mockNewsletterApi.getAll).toHaveBeenCalled();
    });
  });

  describe("Multiple Hook Instances", () => {
    it("should handle multiple hook instances with different filters correctly", async () => {
      const wrapper = createWrapper();

      // Simulate two components using the hook with different filters
      const { result: result1 } = renderHook(
        () => useNewsletters({ isArchived: false }),
        { wrapper },
      );

      const { result: result2 } = renderHook(
        () => useNewsletters({ isRead: false }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result1.current.isLoadingNewsletters).toBe(false);
        expect(result2.current.isLoadingNewsletters).toBe(false);
      });

      // Should make separate API calls for different filters
      expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(2);

      // Both should have newsletters
      expect(result1.current.newsletters).toBeDefined();
      expect(result2.current.newsletters).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors without causing race conditions", async () => {
      const wrapper = createWrapper();
      mockNewsletterApi.getAll.mockRejectedValueOnce(new Error("API Error"));

      const { result } = renderHook(
        () => useNewsletters({ isArchived: false }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoadingNewsletters).toBe(false);
      });

      // Should handle error gracefully
      expect(result.current.isErrorNewsletters).toBe(true);
      expect(result.current.errorNewsletters).toBeDefined();
      expect(result.current.newsletters).toEqual([]);
    });
  });

  describe("Performance Optimizations", () => {
    it("should not refetch when filters are the same", async () => {
      const wrapper = createWrapper();
      const filters = { isArchived: false };

      const { rerender } = renderHook(() => useNewsletters(filters), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
      });

      // Re-render with same filters
      rerender();

      // Should not make additional API calls
      expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
    });

    it("should use proper cache keys to prevent unnecessary requests", async () => {
      const wrapper = createWrapper();

      // First hook call
      const { unmount } = renderHook(
        () => useNewsletters({ isArchived: false }),
        { wrapper },
      );

      await waitFor(() => {
        expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Second hook call with same filters (should use cache)
      renderHook(() => useNewsletters({ isArchived: false }), { wrapper });

      // Should leverage cache and not make additional requests immediately
      expect(mockNewsletterApi.getAll).toHaveBeenCalledTimes(1);
    });
  });
});
