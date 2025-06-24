import { newsletterService } from "@common/services";
import { NewsletterOperationResult } from "@common/services/newsletter/NewsletterService";
import { NewsletterWithRelations } from "@common/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "react-hot-toast";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useNewsletterOperations } from "../useNewsletterOperations";

// Mock dependencies
vi.mock("@common/services");
vi.mock("react-hot-toast");

vi.mock("@common/utils/logger", () => ({
  useLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    auth: vi.fn(),
    api: vi.fn(),
    ui: vi.fn(),
    logUserAction: vi.fn(),
    logComponentError: vi.fn(),
    startTimer: vi.fn(() => ({ stop: vi.fn() })),
  }),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    auth: vi.fn(),
    api: vi.fn(),
    ui: vi.fn(),
    logUserAction: vi.fn(),
    logComponentError: vi.fn(),
    startTimer: vi.fn(() => ({ stop: vi.fn() })),
    setUserId: vi.fn(),
    setContext: vi.fn(),
    clearContext: vi.fn(),
  },
}));
vi.mock("@common/utils/queryKeyFactory", () => ({
  queryKeyFactory: {
    newsletters: {
      all: () => ["newsletters"],
      inbox: () => ["newsletters", "inbox"],
      detail: (id: string) => ["newsletters", "detail", id],
    },
    readingQueue: {
      all: () => ["readingQueue"],
    },
    tags: {
      all: () => ["tags"],
    },
  },
}));

const mockNewsletterService = vi.mocked(newsletterService);
const mockToast = vi.mocked(toast);

describe("useNewsletterOperations", () => {
  let queryClient: QueryClient;

  const mockNewsletter: NewsletterWithRelations = {
    id: "newsletter-1",
    title: "Test Newsletter",
    summary: "Test summary",
    content: "Test content",
    image_url: "https://example.com/image.jpg",
    is_read: false,
    is_liked: false,
    is_archived: false,
    received_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
    estimated_read_time: 5,
    word_count: 100,
    source: {
      id: "source-1",
      name: "Test Source",
      from: "test@example.com",
      user_id: "user-1",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    tags: [],
    newsletter_source_id: "source-1",
    user_id: "user-1",
  };

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    // Spy on queryClient.invalidateQueries to check invalidations
    vi.spyOn(queryClient, 'invalidateQueries');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("markAsRead", () => {
    it("should mark newsletter as read successfully", async () => {
      mockNewsletterService.markAsRead.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_read: true },
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsRead("newsletter-1");
      });

      expect(mockNewsletterService.markAsRead).toHaveBeenCalledWith(
        "newsletter-1",
      );
      expect(onSuccess).toHaveBeenCalledWith(
        "markAsRead",
        expect.objectContaining({ is_read: true }),
      );
      expect(result.current.isMarkingAsRead).toBe(false);
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("should handle service errors and not show toast when showToasts is false", async () => {
      mockNewsletterService.markAsRead.mockResolvedValue({
        success: false,
        error: "Service error",
      });

      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsRead("newsletter-1");
      });

      expect(onError).toHaveBeenCalledWith("markAsRead", "Service error");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show toast notifications when enabled", async () => {
      mockNewsletterService.markAsRead.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_read: true },
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsRead("newsletter-1");
      });

      expect(mockToast.success).toHaveBeenCalledWith(
        "Newsletter marked as read",
      );
    });

    it("should show error toast on failure", async () => {
      mockNewsletterService.markAsRead.mockResolvedValue({
        success: false,
        error: "Service error",
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsRead("newsletter-1");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Service error");
    });

    it("should handle network errors", async () => {
      mockNewsletterService.markAsRead.mockRejectedValue(
        new Error("Network error"),
      );

      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        try {
          await result.current.markAsRead("newsletter-1");
        } catch {
          // Expected to throw
        }
      });

      expect(onError).toHaveBeenCalledWith("markAsRead", "Network error");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should track loading state correctly", async () => {
      let resolvePromise: (value: NewsletterOperationResult) => void;
      const promise = new Promise<NewsletterOperationResult>((resolve) => {
        resolvePromise = resolve;
      });

      mockNewsletterService.markAsRead.mockReturnValue(
        promise as Promise<{
          success: boolean;
          newsletter?: NewsletterWithRelations;
          error?: string;
        }>,
      );

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: false }),
        { wrapper },
      );

      // Start the mutation
      act(() => {
        result.current.markAsRead("newsletter-1").catch(() => {
          // Handle promise rejection
        });
      });

      // Wait for loading state to become true
      await waitFor(() => {
        expect(result.current.isMarkingAsRead).toBe(true);
      });

      // Resolve the promise
      await act(async () => {
        resolvePromise!({ success: true, newsletter: mockNewsletter });
        await promise;
      });

      // Check that loading state is false after completion
      await waitFor(() => {
        expect(result.current.isMarkingAsRead).toBe(false);
      });
    });

    describe("bulkMarkAsRead", () => {
      it("should mark multiple newsletters as read", async () => {
        mockNewsletterService.bulkMarkAsRead.mockResolvedValue({
          success: true,
          processedCount: 2,
          failedCount: 0,
          errors: [],
        });

        const onSuccess = vi.fn();
        const { result } = renderHook(
          () => useNewsletterOperations({ onSuccess, showToasts: false }),
          { wrapper },
        );

        await act(async () => {
          await result.current.bulkMarkAsRead(["newsletter-1", "newsletter-2"]);
        });

        expect(mockNewsletterService.bulkMarkAsRead).toHaveBeenCalledWith([
          "newsletter-1",
          "newsletter-2",
        ]);
        expect(onSuccess).toHaveBeenCalledWith("bulkMarkAsRead");
        expect(mockToast.success).not.toHaveBeenCalled();
      });

      it("should handle partial failures and not show toast when showToasts is false", async () => {
        mockNewsletterService.bulkMarkAsRead.mockResolvedValue({
          success: false,
          processedCount: 1,
          failedCount: 1,
          errors: [{ id: "newsletter-2", error: "Error" }],
        });

        const onError = vi.fn();
        const { result } = renderHook(
          () => useNewsletterOperations({ onError, showToasts: false }),
          { wrapper },
        );

        await act(async () => {
          await result.current.bulkMarkAsRead(["newsletter-1", "newsletter-2"]);
        });

        expect(onError).toHaveBeenCalledWith(
          "bulkMarkAsRead",
          "Marked 1 as read, 1 failed",
        );
        expect(mockToast.error).not.toHaveBeenCalled();
      });

      it("should handle network error in bulkMarkAsRead and not show toast when showToasts is false", async () => {
        mockNewsletterService.bulkMarkAsRead.mockRejectedValue(
          new Error("Network error bulk read"),
        );
        const onError = vi.fn();
        const { result } = renderHook(
          () => useNewsletterOperations({ onError, showToasts: false }),
          { wrapper },
        );

        await act(async () => {
          try {
            await result.current.bulkMarkAsRead(["newsletter-1"]);
          } catch { /* Expected */ }
        });
        expect(onError).toHaveBeenCalledWith("bulkMarkAsRead", "Network error bulk read");
        expect(mockToast.error).not.toHaveBeenCalled();
      });

      it("should show appropriate toast messages", async () => {
        mockNewsletterService.bulkMarkAsRead.mockResolvedValue({
          success: true,
          processedCount: 3,
          failedCount: 0,
          errors: [],
        });

        const { result } = renderHook(
          () => useNewsletterOperations({ showToasts: true }),
          { wrapper },
        );

        await act(async () => {
          await result.current.bulkMarkAsRead([
            "newsletter-1",
            "newsletter-2",
            "newsletter-3",
          ]);
        });

        expect(mockToast.success).toHaveBeenCalledWith(
          "Marked 3 newsletters as read",
        );
      });

      it("should handle empty array of IDs", async () => {
        const { result } = renderHook(() => useNewsletterOperations(), { wrapper });

        await act(async () => {
          const response = await result.current.bulkMarkAsRead([]);
          expect(response).toEqual({
            success: true,
            processedCount: 0,
            failedCount: 0,
            errors: []
          });
        });

        expect(mockNewsletterService.bulkMarkAsRead).not.toHaveBeenCalled();
      });
    });

    it("should toggle like status successfully", async () => {
      // Mock the service to return a properly shaped response
      mockNewsletterService.toggleLike.mockResolvedValueOnce({
        success: true,
        newsletter: {
          ...mockNewsletter,
          is_liked: true,
        },
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.toggleLike("newsletter-1");
      });

      expect(mockNewsletterService.toggleLike).toHaveBeenCalledWith("newsletter-1");
      expect(onSuccess).toHaveBeenCalledWith(
        "toggleLike",
        expect.objectContaining({ is_liked: true })
      );
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("should show appropriate toast for unlike action", async () => {
      mockNewsletterService.toggleLike.mockResolvedValueOnce({
        success: true,
        newsletter: { ...mockNewsletter, is_liked: false },
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.toggleLike("newsletter-1");
      });

      expect(mockToast.success).toHaveBeenCalledWith("Newsletter unliked");
    });

    it("should handle optimistic updates and rollback on error", async () => {
      mockNewsletterService.toggleLike.mockRejectedValueOnce(new Error("Failed to toggle like"));
      const { result } = renderHook(() => useNewsletterOperations(), { wrapper });

      // Mock the query data
      queryClient.setQueryData(["newsletters", "detail", "newsletter-1"], { ...mockNewsletter, is_liked: false });

      await act(async () => {
        await expect(result.current.toggleLike("newsletter-1")).rejects.toThrow();
      });

      // Verify rollback
      const cachedData = queryClient.getQueryData(["newsletters", "detail", "newsletter-1"]);
      expect(cachedData).toEqual({ ...mockNewsletter, is_liked: false });
    });

    it("should show success toast for 'like' action when showToasts is true", async () => {
      mockNewsletterService.toggleLike.mockResolvedValueOnce({
        success: true,
        newsletter: { ...mockNewsletter, is_liked: true }, // Simulating a "like" action
      });
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        await result.current.toggleLike("newsletter-1");
      });
      expect(mockToast.success).toHaveBeenCalledWith("Newsletter liked");
    });

    it("should handle service error for toggleLike", async () => {
      mockNewsletterService.toggleLike.mockResolvedValueOnce({
        success: false,
        error: "Service error toggling like",
      });
      const onError = vi.fn();
      const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
      await act(async () => {
        await result.current.toggleLike("newsletter-1");
      });
      expect(onError).toHaveBeenCalledWith("toggleLike", "Service error toggling like");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show error toast for toggleLike service error when showToasts is true", async () => {
      mockNewsletterService.toggleLike.mockResolvedValueOnce({
        success: false,
        error: "Service error toggling like toast",
      });
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        await result.current.toggleLike("newsletter-1");
      });
      expect(mockToast.error).toHaveBeenCalledWith("Service error toggling like toast");
    });

    it("should handle network error for toggleLike", async () => {
      mockNewsletterService.toggleLike.mockRejectedValueOnce(new Error("Network error toggleLike"));
      const onError = vi.fn();
      const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
      await act(async () => {
        try {
          await result.current.toggleLike("newsletter-1");
        } catch { /* Expected */ }
      });
      expect(onError).toHaveBeenCalledWith("toggleLike", "Network error toggleLike");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show error toast for toggleLike network error when showToasts is true", async () => {
      mockNewsletterService.toggleLike.mockRejectedValueOnce(new Error("Network error toggleLike toast"));
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        try {
          await result.current.toggleLike("newsletter-1");
        } catch { /* Expected */ }
      });
      expect(mockToast.error).toHaveBeenCalledWith("Failed to toggle like");
    });

    it("should track loading state (isTogglingLike) correctly", async () => {
      let resolver: (value: any) => void;
      const promise = new Promise((res) => { resolver = res; });
      mockNewsletterService.toggleLike.mockReturnValue(promise);
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
      act(() => {
        result.current.toggleLike("id1").catch(() => { });
      });
      await waitFor(() => expect(result.current.isTogglingLike).toBe(true));
      await act(async () => {
        resolver!({ success: true, newsletter: { ...mockNewsletter, is_liked: true } });
        await promise;
      });
      await waitFor(() => expect(result.current.isTogglingLike).toBe(false));
    });

    it("should expose and reset error state for toggleLike", async () => {
      const networkError = new Error("Network error for toggleLike");
      mockNewsletterService.toggleLike.mockRejectedValueOnce(networkError);
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
      await act(async () => {
        try {
          await result.current.toggleLike("newsletter-1");
        } catch (_) { /* error expected */ }
      });
      await waitFor(() => expect(result.current.errorTogglingLike).toBe(networkError));
      act(() => result.current.resetToggleLikeError());
      await waitFor(() => expect(result.current.errorTogglingLike).toBe(null));
    });
  });

  describe("updateTags", () => {
    const newsletterId = "newsletter-1";
    const tagIds = ["tag-1", "tag-2"];

    it("should update tags successfully", async () => {
      mockNewsletterService.updateTags.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, tags: [{ id: "tag-1", name: "Tag 1" }] }, // Simplified
      });
      const onSuccess = vi.fn();
      const { result } = renderHook(() => useNewsletterOperations({ onSuccess, showToasts: false }), { wrapper });
      await act(async () => {
        await result.current.updateTags({ id: newsletterId, tagIds });
      });
      expect(mockNewsletterService.updateTags).toHaveBeenCalledWith(newsletterId, tagIds);
      expect(onSuccess).toHaveBeenCalledWith("updateTags", expect.objectContaining({ id: newsletterId }));
      expect(result.current.isUpdatingTags).toBe(false);
      // Verify query invalidation (basic check, more specific checks could be added if needed)
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["newsletters", "detail", newsletterId] });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["tags"] });
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("should show success toast for updateTags when showToasts is true", async () => {
      mockNewsletterService.updateTags.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter },
      });
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        await result.current.updateTags({ id: newsletterId, tagIds });
      });
      expect(mockToast.success).toHaveBeenCalledWith("Tags updated");
    });

    it("should handle service error for updateTags", async () => {
      mockNewsletterService.updateTags.mockResolvedValue({
        success: false,
        error: "Service error updating tags",
      });
      const onError = vi.fn();
      const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
      await act(async () => {
        await result.current.updateTags({ id: newsletterId, tagIds });
      });
      expect(onError).toHaveBeenCalledWith("updateTags", "Service error updating tags");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show error toast for updateTags service error when showToasts is true", async () => {
      mockNewsletterService.updateTags.mockResolvedValue({
        success: false,
        error: "Service error updating tags toast",
      });
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        await result.current.updateTags({ id: newsletterId, tagIds });
      });
      expect(mockToast.error).toHaveBeenCalledWith("Service error updating tags toast");
    });

    it("should handle network error for updateTags", async () => {
      mockNewsletterService.updateTags.mockRejectedValueOnce(new Error("Network error updateTags"));
      const onError = vi.fn();
      const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
      await act(async () => {
        try { await result.current.updateTags({ id: newsletterId, tagIds }); } catch { /* Expected */ }
      });
      expect(onError).toHaveBeenCalledWith("updateTags", "Network error updateTags");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show error toast for updateTags network error when showToasts is true", async () => {
      mockNewsletterService.updateTags.mockRejectedValueOnce(new Error("Network error updateTags toast"));
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        try { await result.current.updateTags({ id: newsletterId, tagIds }); } catch { /* Expected */ }
      });
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update tags");
    });

    it("should track loading state (isUpdatingTags) correctly", async () => {
      let resolver: (value: any) => void;
      const promise = new Promise((res) => { resolver = res; });
      mockNewsletterService.updateTags.mockReturnValue(promise);
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
      act(() => { result.current.updateTags({ id: newsletterId, tagIds }).catch(() => { }); });
      await waitFor(() => expect(result.current.isUpdatingTags).toBe(true));
      await act(async () => {
        resolver!({ success: true, newsletter: mockNewsletter });
        await promise;
      });
      await waitFor(() => expect(result.current.isUpdatingTags).toBe(false));
    });

    it("should expose and reset error state for updateTags", async () => {
      const networkError = new Error("Network error for updateTags");
      mockNewsletterService.updateTags.mockRejectedValueOnce(networkError);
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
      await act(async () => {
        try { await result.current.updateTags({ id: newsletterId, tagIds }); } catch (_) { /* error expected */ }
      });
      await waitFor(() => expect(result.current.errorUpdatingTags).toBe(networkError));
      act(() => result.current.resetUpdateTagsError());
      await waitFor(() => expect(result.current.errorUpdatingTags).toBe(null));
    });
  });

  describe("Reading Queue Operations", () => {
    describe("addToQueue", () => {
      it("should add to queue successfully", async () => {
        mockNewsletterService.addToReadingQueue.mockResolvedValue({
          success: true,
          newsletter: { ...mockNewsletter },
        });
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useNewsletterOperations({ onSuccess, showToasts: false }), { wrapper });
        await act(async () => {
          await result.current.addToQueue("newsletter-1");
        });
        expect(mockNewsletterService.addToReadingQueue).toHaveBeenCalledWith("newsletter-1");
        expect(onSuccess).toHaveBeenCalledWith("addToQueue", mockNewsletter);
        expect(result.current.isAddingToQueue).toBe(false);
        expect(mockToast.success).not.toHaveBeenCalled();
      });

      it("should show success toast for addToQueue when showToasts is true", async () => {
        mockNewsletterService.addToReadingQueue.mockResolvedValue({
          success: true,
          newsletter: { ...mockNewsletter },
        });
        const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
        await act(async () => {
          await result.current.addToQueue("newsletter-1");
        });
        expect(mockToast.success).toHaveBeenCalledWith("Added to reading queue");
      });

      it("should handle service error for addToQueue", async () => {
        mockNewsletterService.addToReadingQueue.mockResolvedValue({
          success: false,
          error: "Service error adding to queue",
        });
        const onError = vi.fn();
        const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
        await act(async () => {
          await result.current.addToQueue("newsletter-1");
        });
        expect(onError).toHaveBeenCalledWith("addToQueue", "Service error adding to queue");
        expect(mockToast.error).not.toHaveBeenCalled();
      });

      it("should show error toast for addToQueue service error when showToasts is true", async () => {
        mockNewsletterService.addToReadingQueue.mockResolvedValue({
          success: false,
          error: "Service error adding to queue toast",
        });
        const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
        await act(async () => {
          await result.current.addToQueue("newsletter-1");
        });
        expect(mockToast.error).toHaveBeenCalledWith("Service error adding to queue toast");
      });

      it("should handle network error for addToQueue", async () => {
        mockNewsletterService.addToReadingQueue.mockRejectedValueOnce(new Error("Network error addToQueue"));
        const onError = vi.fn();
        const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
        await act(async () => {
          try { await result.current.addToQueue("newsletter-1"); } catch { /* Expected */ }
        });
        expect(onError).toHaveBeenCalledWith("addToQueue", "Network error addToQueue");
        expect(mockToast.error).not.toHaveBeenCalled();
      });

      it("should track loading state (isAddingToQueue) correctly", async () => {
        let resolver: (value: any) => void;
        const promise = new Promise((res) => { resolver = res; });
        mockNewsletterService.addToReadingQueue.mockReturnValue(promise);
        const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
        act(() => { result.current.addToQueue("id1").catch(() => { }); });
        await waitFor(() => expect(result.current.isAddingToQueue).toBe(true));
        await act(async () => {
          resolver!({ success: true, newsletter: mockNewsletter });
          await promise;
        });
        await waitFor(() => expect(result.current.isAddingToQueue).toBe(false));
      });

      it("should expose and reset error state for addToQueue", async () => {
        const networkError = new Error("Network error for addToQueue");
        mockNewsletterService.addToReadingQueue.mockRejectedValueOnce(networkError);
        const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
        await act(async () => {
          try { await result.current.addToQueue("newsletter-1"); } catch (_) { /* error expected */ }
        });
        await waitFor(() => expect(result.current.errorAddingToQueue).toBe(networkError));
        act(() => result.current.resetAddToQueueError());
        await waitFor(() => expect(result.current.errorAddingToQueue).toBe(null));
      });
    });

    describe("removeFromQueue", () => {
      it("should remove from queue successfully", async () => {
        mockNewsletterService.removeFromReadingQueue.mockResolvedValue({ success: true });
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useNewsletterOperations({ onSuccess, showToasts: false }), { wrapper });
        await act(async () => {
          await result.current.removeFromQueue("newsletter-1");
        });
        expect(mockNewsletterService.removeFromReadingQueue).toHaveBeenCalledWith("newsletter-1");
        expect(onSuccess).toHaveBeenCalledWith("removeFromQueue");
        expect(result.current.isRemovingFromQueue).toBe(false);
        expect(mockToast.success).not.toHaveBeenCalled();
      });

      it("should show success toast for removeFromQueue when showToasts is true", async () => {
        mockNewsletterService.removeFromReadingQueue.mockResolvedValue({ success: true });
        const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
        await act(async () => {
          await result.current.removeFromQueue("newsletter-1");
        });
        expect(mockToast.success).toHaveBeenCalledWith("Removed from reading queue");
      });

      it("should handle service error for removeFromQueue", async () => {
        mockNewsletterService.removeFromReadingQueue.mockResolvedValue({
          success: false,
          error: "Service error removing from queue",
        });
        const onError = vi.fn();
        const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
        await act(async () => {
          await result.current.removeFromQueue("newsletter-1");
        });
        expect(onError).toHaveBeenCalledWith("removeFromQueue", "Service error removing from queue");
        expect(mockToast.error).not.toHaveBeenCalled();
      });

      it("should show error toast for removeFromQueue service error when showToasts is true", async () => {
        mockNewsletterService.removeFromReadingQueue.mockResolvedValue({
          success: false,
          error: "Service error removing from queue toast",
        });
        const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
        await act(async () => {
          await result.current.removeFromQueue("newsletter-1");
        });
        expect(mockToast.error).toHaveBeenCalledWith("Service error removing from queue toast");
      });

      it("should handle network error for removeFromQueue", async () => {
        mockNewsletterService.removeFromReadingQueue.mockRejectedValueOnce(new Error("Network error removeFromQueue"));
        const onError = vi.fn();
        const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
        await act(async () => {
          try { await result.current.removeFromQueue("newsletter-1"); } catch { /* Expected */ }
        });
        expect(onError).toHaveBeenCalledWith("removeFromQueue", "Network error removeFromQueue");
        expect(mockToast.error).not.toHaveBeenCalled();
      });

      it("should track loading state (isRemovingFromQueue) correctly", async () => {
        let resolver: (value: any) => void;
        const promise = new Promise((res) => { resolver = res; });
        mockNewsletterService.removeFromReadingQueue.mockReturnValue(promise);
        const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
        act(() => { result.current.removeFromQueue("id1").catch(() => { }); });
        await waitFor(() => expect(result.current.isRemovingFromQueue).toBe(true));
        await act(async () => {
          resolver!({ success: true });
          await promise;
        });
        await waitFor(() => expect(result.current.isRemovingFromQueue).toBe(false));
      });

      it("should expose and reset error state for removeFromQueue", async () => {
        const networkError = new Error("Network error for removeFromQueue");
        mockNewsletterService.removeFromReadingQueue.mockRejectedValueOnce(networkError);
        const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
        await act(async () => {
          try { await result.current.removeFromQueue("newsletter-1"); } catch (_) { /* error expected */ }
        });
        await waitFor(() => expect(result.current.errorRemovingFromQueue).toBe(networkError));
        act(() => result.current.resetRemoveFromQueueError());
        await waitFor(() => expect(result.current.errorRemovingFromQueue).toBe(null));
      });
    });
  });

  describe("bulkMarkAsUnread", () => {
    it("should bulk mark newsletters as unread successfully", async () => {
      mockNewsletterService.bulkMarkAsUnread.mockResolvedValue({
        success: true,
        processedCount: 2,
        failedCount: 0,
        errors: [],
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.bulkMarkAsUnread(["newsletter-1", "newsletter-2"]);
      });

      expect(mockNewsletterService.bulkMarkAsUnread).toHaveBeenCalledWith([
        "newsletter-1",
        "newsletter-2",
      ]);
      expect(onSuccess).toHaveBeenCalledWith("bulkMarkAsUnread");
      expect(result.current.isBulkMarkingAsUnread).toBe(false);
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("should handle partial failures in bulkMarkAsUnread and not show toast if showToasts is false", async () => {
      mockNewsletterService.bulkMarkAsUnread.mockResolvedValue({
        success: false,
        processedCount: 1,
        failedCount: 1,
        errors: [{ id: "newsletter-2", error: "Error unreading" }],
      });

      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.bulkMarkAsUnread(["newsletter-1", "newsletter-2"]);
      });

      expect(onError).toHaveBeenCalledWith(
        "bulkMarkAsUnread",
        "Marked 1 as unread, 1 failed",
      );
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show success toast for bulkMarkAsUnread when showToasts is true", async () => {
      mockNewsletterService.bulkMarkAsUnread.mockResolvedValue({
        success: true,
        processedCount: 3,
        failedCount: 0,
        errors: [],
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.bulkMarkAsUnread([
          "newsletter-1",
          "newsletter-2",
          "newsletter-3",
        ]);
      });

      expect(mockToast.success).toHaveBeenCalledWith(
        "Marked 3 newsletters as unread",
      );
    });

    it("should show error toast for partial failure in bulkMarkAsUnread when showToasts is true", async () => {
      mockNewsletterService.bulkMarkAsUnread.mockResolvedValue({
        success: false,
        processedCount: 1,
        failedCount: 1,
        errors: [{ id: "newsletter-2", error: "Error unreading toast" }],
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.bulkMarkAsUnread(["newsletter-1", "newsletter-2"]);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Marked 1 as unread, 1 failed",
      );
    });

    it("should handle network error in bulkMarkAsUnread", async () => {
      mockNewsletterService.bulkMarkAsUnread.mockRejectedValue(
        new Error("Network error bulk unread"),
      );
      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        try {
          await result.current.bulkMarkAsUnread(["newsletter-1"]);
        } catch { /* Expected */ }
      });
      expect(onError).toHaveBeenCalledWith("bulkMarkAsUnread", "Network error bulk unread");
      expect(mockToast.error).not.toHaveBeenCalled();
    });


    it("should handle empty array of IDs for bulkMarkAsUnread", async () => {
      const { result } = renderHook(() => useNewsletterOperations(), { wrapper });
      await act(async () => {
        // The actual implementation of bulkMarkAsUnread in the hook returns early
        // if ids.length === 0, so we might not see a specific service call or toast.
        // We're testing that it doesn't throw and the service isn't called.
        await result.current.bulkMarkAsUnread([]);
      });
      expect(mockNewsletterService.bulkMarkAsUnread).not.toHaveBeenCalled();
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should track loading state (isBulkMarkingAsUnread) correctly", async () => {
      let resolver: (value: any) => void;
      const promise = new Promise((res) => { resolver = res; });
      mockNewsletterService.bulkMarkAsUnread.mockReturnValue(promise);

      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });

      act(() => {
        result.current.bulkMarkAsUnread(["id1"]).catch(() => { });
      });
      await waitFor(() => expect(result.current.isBulkMarkingAsUnread).toBe(true));

      await act(async () => {
        resolver!({ success: true, processedCount: 1, failedCount: 0, errors: [] });
        await promise;
      });
      await waitFor(() => expect(result.current.isBulkMarkingAsUnread).toBe(false));
    });

    it("should expose and reset error state for bulkMarkAsUnread", async () => {
      const networkError = new Error("Network error for bulkMarkAsUnread");
      mockNewsletterService.bulkMarkAsUnread.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });

      await act(async () => {
        try {
          await result.current.bulkMarkAsUnread(["newsletter-1"]);
        } catch (_) { /* error expected */ }
      });

      await waitFor(() => {
        expect(result.current.errorBulkMarkingAsUnread).toBe(networkError);
      });

      act(() => {
        result.current.resetBulkMarkAsUnreadError();
      });

      await waitFor(() => {
        expect(result.current.errorBulkMarkingAsUnread).toBe(null);
      });
    });
  });

  describe("markAsUnread", () => {
    it("should mark newsletter as unread successfully", async () => {
      mockNewsletterService.markAsUnread.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_read: false },
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsUnread("newsletter-1");
      });

      expect(mockNewsletterService.markAsUnread).toHaveBeenCalledWith(
        "newsletter-1",
      );
      expect(onSuccess).toHaveBeenCalledWith(
        "markAsUnread",
        expect.objectContaining({ is_read: false }),
      );
      expect(result.current.isMarkingAsUnread).toBe(false);
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("should handle service errors when marking as unread and not show toast if showToasts is false", async () => {
      mockNewsletterService.markAsUnread.mockResolvedValue({
        success: false,
        error: "Service error markAsUnread",
      });

      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsUnread("newsletter-1");
      });

      expect(onError).toHaveBeenCalledWith("markAsUnread", "Service error markAsUnread");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show success toast when marking as unread and showToasts is true", async () => {
      mockNewsletterService.markAsUnread.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_read: false },
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsUnread("newsletter-1");
      });

      expect(mockToast.success).toHaveBeenCalledWith(
        "Newsletter marked as unread",
      );
    });

    it("should show error toast on failure when marking as unread and showToasts is true", async () => {
      mockNewsletterService.markAsUnread.mockResolvedValue({
        success: false,
        error: "Failed to mark as unread toast",
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsUnread("newsletter-1");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Failed to mark as unread toast");
    });

    it("should handle network errors when marking as unread", async () => {
      mockNewsletterService.markAsUnread.mockRejectedValue(
        new Error("Network error markAsUnread"),
      );

      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        try {
          await result.current.markAsUnread("newsletter-1");
        } catch {
          // Expected to throw
        }
      });

      expect(onError).toHaveBeenCalledWith("markAsUnread", "Network error markAsUnread");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should track loading state (isMarkingAsUnread) correctly", async () => {
      let resolvePromise: (value: NewsletterOperationResult) => void;
      const promise = new Promise<NewsletterOperationResult>((resolve) => {
        resolvePromise = resolve;
      });
      mockNewsletterService.markAsUnread.mockReturnValue(promise as any);

      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });

      act(() => {
        result.current.markAsUnread("newsletter-1").catch(() => { });
      });
      await waitFor(() => expect(result.current.isMarkingAsUnread).toBe(true));

      await act(async () => {
        resolvePromise({ success: true, newsletter: mockNewsletter });
        await promise;
      });
      await waitFor(() => expect(result.current.isMarkingAsUnread).toBe(false));
    });

    it("should expose and reset error state for markAsUnread", async () => {
      const networkError = new Error("Network error for markAsUnread");
      mockNewsletterService.markAsUnread.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });

      await act(async () => {
        try {
          await result.current.markAsUnread("newsletter-1");
        } catch (_) {
          // error expected
        }
      });

      await waitFor(() => {
        expect(result.current.errorMarkingAsUnread).toBe(networkError);
      });

      act(() => {
        result.current.resetMarkAsUnreadError();
      });

      await waitFor(() => {
        expect(result.current.errorMarkingAsUnread).toBe(null);
      });
    });
  });

  describe("toggleArchive", () => {
    it("should toggle archive status successfully", async () => {
      mockNewsletterService.toggleArchive.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_archived: true },
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.toggleArchive("newsletter-1");
      });

      expect(mockNewsletterService.toggleArchive).toHaveBeenCalledWith(
        "newsletter-1",
      );
      expect(onSuccess).toHaveBeenCalledWith(
        "toggleArchive",
        expect.objectContaining({ is_archived: true }),
      );
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("should show success toast for 'archive' action when showToasts is true", async () => {
      mockNewsletterService.toggleArchive.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_archived: true },
      });
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        await result.current.toggleArchive("newsletter-1");
      });
      expect(mockToast.success).toHaveBeenCalledWith("Newsletter archived");
    });

    it("should show success toast for 'unarchive' action when showToasts is true", async () => {
      mockNewsletterService.toggleArchive.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_archived: false }, // Simulating unarchive
      });
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        await result.current.toggleArchive("newsletter-1");
      });
      expect(mockToast.success).toHaveBeenCalledWith("Newsletter unarchived");
    });

    it("should handle service error for toggleArchive", async () => {
      mockNewsletterService.toggleArchive.mockResolvedValueOnce({
        success: false,
        error: "Service error toggling archive",
      });
      const onError = vi.fn();
      const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
      await act(async () => {
        await result.current.toggleArchive("newsletter-1");
      });
      expect(onError).toHaveBeenCalledWith("toggleArchive", "Service error toggling archive");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show error toast for toggleArchive service error when showToasts is true", async () => {
      mockNewsletterService.toggleArchive.mockResolvedValueOnce({
        success: false,
        error: "Service error toggling archive toast",
      });
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        await result.current.toggleArchive("newsletter-1");
      });
      expect(mockToast.error).toHaveBeenCalledWith("Service error toggling archive toast");
    });

    it("should handle network error for toggleArchive", async () => {
      mockNewsletterService.toggleArchive.mockRejectedValueOnce(new Error("Network error toggleArchive"));
      const onError = vi.fn();
      const { result } = renderHook(() => useNewsletterOperations({ onError, showToasts: false }), { wrapper });
      await act(async () => {
        try {
          await result.current.toggleArchive("newsletter-1");
        } catch { /* Expected */ }
      });
      expect(onError).toHaveBeenCalledWith("toggleArchive", "Network error toggleArchive");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should show error toast for toggleArchive network error when showToasts is true", async () => {
      mockNewsletterService.toggleArchive.mockRejectedValueOnce(new Error("Network error toggleArchive toast"));
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: true }), { wrapper });
      await act(async () => {
        try {
          await result.current.toggleArchive("newsletter-1");
        } catch { /* Expected */ }
      });
      expect(mockToast.error).toHaveBeenCalledWith("Failed to toggle archive");
    });

    it("should track loading state (isTogglingArchive) correctly", async () => {
      let resolver: (value: any) => void;
      const promise = new Promise((res) => { resolver = res; });
      mockNewsletterService.toggleArchive.mockReturnValue(promise);
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
      act(() => {
        result.current.toggleArchive("id1").catch(() => { });
      });
      await waitFor(() => expect(result.current.isTogglingArchive).toBe(true));
      await act(async () => {
        resolver!({ success: true, newsletter: { ...mockNewsletter, is_archived: true } });
        await promise;
      });
      await waitFor(() => expect(result.current.isTogglingArchive).toBe(false));
    });

    it("should expose and reset error state for toggleArchive", async () => {
      const networkError = new Error("Network error for toggleArchive");
      mockNewsletterService.toggleArchive.mockRejectedValueOnce(networkError);
      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });
      await act(async () => {
        try {
          await result.current.toggleArchive("newsletter-1");
        } catch (_) { /* error expected */ }
      });
      await waitFor(() => expect(result.current.errorTogglingArchive).toBe(networkError));
      act(() => result.current.resetToggleArchiveError());
      await waitFor(() => expect(result.current.errorTogglingArchive).toBe(null));
    });
  });

  describe("deleteNewsletter", () => {
    it("should show confirmation dialog and delete on confirm", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      mockNewsletterService.deleteNewsletter.mockResolvedValueOnce({
        success: true,
        newsletter: mockNewsletter,
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.deleteNewsletter("newsletter-1");
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(mockNewsletterService.deleteNewsletter).toHaveBeenCalledWith("newsletter-1");
    });

    it("should not delete if user cancels confirmation", async () => {
      window.confirm = vi.fn().mockReturnValue(false);
      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.deleteNewsletter("newsletter-1");
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(mockNewsletterService.deleteNewsletter).not.toHaveBeenCalled();
    });

    it("should show success toast when deletion is successful and showToasts is true", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      mockNewsletterService.deleteNewsletter.mockResolvedValueOnce({
        success: true,
      });
      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );
      await act(async () => {
        await result.current.deleteNewsletter("newsletter-1");
      });
      expect(mockToast.success).toHaveBeenCalledWith("Newsletter deleted successfully");
    });

    it("should show error toast when deletion fails and showToasts is true", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      mockNewsletterService.deleteNewsletter.mockResolvedValueOnce({
        success: false,
        error: "Failed to delete",
      });
      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );
      await act(async () => {
        await result.current.deleteNewsletter("newsletter-1");
      });
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete");
    });

    it("should show error toast on network error when showToasts is true", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      mockNewsletterService.deleteNewsletter.mockRejectedValueOnce(new Error("Network Delete Error"));
      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );
      await act(async () => {
        await result.current.deleteNewsletter("newsletter-1");
      });
      // The hook's onError for the mutation will call toast.error with a generic message
      // if the error is a network error.
      expect(mockToast.error).toHaveBeenCalledWith("Failed to delete newsletter");
    });


    it("should track loading state (isDeleting) correctly", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      let resolver: (value: any) => void;
      const promise = new Promise((res) => { resolver = res; });
      mockNewsletterService.deleteNewsletter.mockReturnValue(promise);

      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });

      act(() => {
        result.current.deleteNewsletter("newsletter-1").catch(() => { });
      });
      await waitFor(() => expect(result.current.isDeleting).toBe(true));

      await act(async () => {
        resolver!({ success: true });
        // Wait for the deleteNewsletter's internal try/catch to resolve
      });
      await waitFor(() => expect(result.current.isDeleting).toBe(false));
    });

    it("should expose and reset error state for deleteNewsletter", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      const networkError = new Error("Network error for delete");
      // Mock the service to reject, which will cause the mutation to have an error
      mockNewsletterService.deleteNewsletter.mockRejectedValueOnce(networkError);

      const { result } = renderHook(() => useNewsletterOperations({ showToasts: false }), { wrapper });

      await act(async () => {
        // The deleteNewsletter function in the hook catches the error from mutateAsync
        // and returns it in its own result. The mutation's error state is updated separately.
        await result.current.deleteNewsletter("newsletter-1");
      });

      // The error is exposed on result.current.deleteError via the mutation's state
      await waitFor(() => {
        expect(result.current.deleteError).toBe(networkError);
      });

      act(() => {
        result.current.resetDeleteError();
      });

      await waitFor(() => {
        expect(result.current.deleteError).toBe(null);
      });
    });

    it("should call onSuccess callback when deletion is successful", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      mockNewsletterService.deleteNewsletter.mockResolvedValueOnce({ success: true });
      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );
      await act(async () => {
        await result.current.deleteNewsletter("newsletter-1");
      });
      expect(onSuccess).toHaveBeenCalledWith("deleteNewsletter");
      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("should call onError callback when deletion fails (service error) and not show toast if showToasts false", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      mockNewsletterService.deleteNewsletter.mockResolvedValueOnce({ success: false, error: "Service Delete Error" });
      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );
      await act(async () => {
        await result.current.deleteNewsletter("newsletter-1");
      });
      // The hook's deleteNewsletter returns the error, the mutation's onError handles the callback.
      // This means the callback is triggered from the mutation's own error handling.
      expect(onError).toHaveBeenCalledWith("deleteNewsletter", "Service Delete Error");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    it("should call onError callback when deletion fails (network error) and not show toast if showToasts false", async () => {
      window.confirm = vi.fn().mockReturnValue(true);
      mockNewsletterService.deleteNewsletter.mockRejectedValueOnce(new Error("Network Delete Error"));
      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );
      await act(async () => {
        await result.current.deleteNewsletter("newsletter-1");
      });
      expect(onError).toHaveBeenCalledWith("deleteNewsletter", "Network Delete Error");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

  });

  describe("callbacks", () => {
    it("should call onSuccess callback when operation succeeds", async () => {
      const onSuccess = vi.fn();

      // Mock the successful response
      mockNewsletterService.markAsRead.mockResolvedValueOnce({
        success: true,
        newsletter: { ...mockNewsletter, is_read: true },
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsRead("newsletter-1");
      });

      expect(onSuccess).toHaveBeenCalledWith("markAsRead", expect.any(Object));
    });

    it("should call onError callback when operation fails", async () => {
      const onError = vi.fn();
      const errorMessage = "Failed to mark newsletter as read";
      mockNewsletterService.markAsRead.mockRejectedValueOnce(new Error(errorMessage));

      const { result } = renderHook(
        () => useNewsletterOperations({ onError }),
        { wrapper },
      );

      await act(async () => {
        await expect(result.current.markAsRead("newsletter-1")).rejects.toThrow(errorMessage);
      });

      expect(onError).toHaveBeenCalledWith("markAsRead", expect.stringContaining(errorMessage));
    });
  });

  describe("concurrent operations", () => {
    it("should handle multiple concurrent operations", async () => {
      const { result } = renderHook(() => useNewsletterOperations(), { wrapper });

      // Mock different responses for each call
      mockNewsletterService.markAsRead
        .mockResolvedValueOnce({
          success: true,
          newsletter: { ...mockNewsletter, id: "newsletter-1", is_read: true },
        })
        .mockResolvedValueOnce({
          success: true,
          newsletter: { ...mockNewsletter, id: "newsletter-2", is_read: true },
        });

      await act(async () => {
        const [result1, result2] = await Promise.all([
          result.current.markAsRead("newsletter-1"),
          result.current.markAsRead("newsletter-2"),
        ]);

        expect(result1).toEqual(expect.objectContaining({ success: true }));
        expect(result2).toEqual(expect.objectContaining({ success: true }));
      });

      expect(mockNewsletterService.markAsRead).toHaveBeenCalledTimes(2);
    });
  });
});