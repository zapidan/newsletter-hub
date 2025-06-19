import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { useNewsletterOperations } from "../useNewsletterOperations";
import { newsletterService } from "@common/services";
import { NewsletterWithRelations } from "@common/types";
import { NewsletterOperationResult } from "@common/services/newsletter/NewsletterService";
import { toast } from "react-hot-toast";

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
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
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
    });

    it("should handle service errors", async () => {
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
    });

    it("should handle partial failures", async () => {
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
  });

  describe("toggleLike", () => {
    it("should toggle like status successfully", async () => {
      mockNewsletterService.toggleLike.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_liked: true },
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.toggleLike("newsletter-1");
      });

      expect(mockNewsletterService.toggleLike).toHaveBeenCalledWith(
        "newsletter-1",
      );
      expect(onSuccess).toHaveBeenCalledWith(
        "toggleLike",
        expect.objectContaining({ is_liked: true }),
      );
    });

    it("should show appropriate toast for like action", async () => {
      mockNewsletterService.toggleLike.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_liked: true },
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.toggleLike("newsletter-1");
      });

      expect(mockToast.success).toHaveBeenCalledWith("Newsletter liked");
    });

    it("should show appropriate toast for unlike action", async () => {
      mockNewsletterService.toggleLike.mockResolvedValue({
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
    });

    it("should show appropriate toast messages", async () => {
      mockNewsletterService.toggleArchive.mockResolvedValue({
        success: true,
        newsletter: { ...mockNewsletter, is_archived: true },
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.toggleArchive("newsletter-1");
      });

      expect(mockToast.success).toHaveBeenCalledWith("Newsletter archived");
    });
  });

  describe("reading queue operations", () => {
    it("should add to reading queue successfully", async () => {
      mockNewsletterService.addToReadingQueue.mockResolvedValue({
        success: true,
        newsletter: mockNewsletter,
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.addToQueue("newsletter-1");
      });

      expect(mockNewsletterService.addToReadingQueue).toHaveBeenCalledWith(
        "newsletter-1",
      );
      expect(onSuccess).toHaveBeenCalledWith("addToQueue", mockNewsletter);
    });

    it("should remove from reading queue successfully", async () => {
      mockNewsletterService.removeFromReadingQueue.mockResolvedValue({
        success: true,
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.removeFromQueue("newsletter-1");
      });

      expect(mockNewsletterService.removeFromReadingQueue).toHaveBeenCalledWith(
        "newsletter-1",
      );
      expect(onSuccess).toHaveBeenCalledWith("removeFromQueue");
    });

    it("should show appropriate toast messages for queue operations", async () => {
      mockNewsletterService.addToReadingQueue.mockResolvedValue({
        success: true,
        newsletter: mockNewsletter,
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.addToQueue("newsletter-1");
      });

      expect(mockToast.success).toHaveBeenCalledWith("Added to reading queue");
    });
  });

  describe("updateTags", () => {
    it("should update newsletter tags successfully", async () => {
      const updatedNewsletter = {
        ...mockNewsletter,
        tags: [
          {
            id: "tag-1",
            name: "Test Tag",
            color: "#3b82f6",
            user_id: "user-1",
            created_at: "2024-01-01T00:00:00Z",
          },
        ],
      };

      mockNewsletterService.updateTags.mockResolvedValue({
        success: true,
        newsletter: updatedNewsletter,
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.updateTags({
          id: "newsletter-1",
          tagIds: ["tag-1"],
        });
      });

      expect(mockNewsletterService.updateTags).toHaveBeenCalledWith(
        "newsletter-1",
        ["tag-1"],
      );
      expect(onSuccess).toHaveBeenCalledWith("updateTags", updatedNewsletter);
    });

    it("should handle tag update errors", async () => {
      mockNewsletterService.updateTags.mockResolvedValue({
        success: false,
        error: "Tag not found",
      });

      const onError = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onError, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.updateTags({
          id: "newsletter-1",
          tagIds: ["tag-1"],
        });
      });

      expect(onError).toHaveBeenCalledWith("updateTags", "Tag not found");
    });

    it("should show success toast for tag updates", async () => {
      mockNewsletterService.updateTags.mockResolvedValue({
        success: true,
        newsletter: mockNewsletter,
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.updateTags({
          id: "newsletter-1",
          tagIds: ["tag-1"],
        });
      });

      expect(mockToast.success).toHaveBeenCalledWith("Tags updated");
    });
  });

  describe("error handling", () => {
    it("should provide error reset functions", async () => {
      mockNewsletterService.markAsRead.mockRejectedValue(
        new Error("Test error"),
      );

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        try {
          await result.current.markAsRead("newsletter-1");
        } catch {
          // Expected to throw
        }
      });

      await waitFor(() => {
        expect(result.current.errorMarkingAsRead).toBeTruthy();
      });

      act(() => {
        result.current.resetMarkAsReadError();
      });

      await waitFor(() => {
        expect(result.current.errorMarkingAsRead).toBeNull();
      });
    });

    it("should expose all error states", () => {
      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: false }),
        { wrapper },
      );

      expect(result.current.errorMarkingAsRead).toBeNull();
      expect(result.current.errorMarkingAsUnread).toBeNull();
      expect(result.current.errorBulkMarkingAsRead).toBeNull();
      expect(result.current.errorBulkMarkingAsUnread).toBeNull();
      expect(result.current.errorTogglingLike).toBeNull();
      expect(result.current.errorTogglingArchive).toBeNull();
      expect(result.current.errorAddingToQueue).toBeNull();
      expect(result.current.errorRemovingFromQueue).toBeNull();
      expect(result.current.errorUpdatingTags).toBeNull();
    });
  });

  describe("loading states", () => {
    it("should expose all loading states", () => {
      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: false }),
        { wrapper },
      );

      expect(result.current.isMarkingAsRead).toBe(false);
      expect(result.current.isMarkingAsUnread).toBe(false);
      expect(result.current.isBulkMarkingAsRead).toBe(false);
      expect(result.current.isBulkMarkingAsUnread).toBe(false);
      expect(result.current.isTogglingLike).toBe(false);
      expect(result.current.isTogglingArchive).toBe(false);
      expect(result.current.isAddingToQueue).toBe(false);
      expect(result.current.isRemovingFromQueue).toBe(false);
      expect(result.current.isUpdatingTags).toBe(false);
    });
  });

  describe("query invalidation", () => {
    it("should invalidate related queries after successful operations", async () => {
      mockNewsletterService.markAsRead.mockResolvedValue({
        success: true,
        newsletter: mockNewsletter,
      });

      const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsRead("newsletter-1");
      });

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalled();
      });

      invalidateQueriesSpy.mockRestore();
    });
  });

  describe("callback integration", () => {
    it("should not call callbacks when showToasts is disabled and no callbacks provided", async () => {
      mockNewsletterService.markAsRead.mockResolvedValue({
        success: true,
        newsletter: mockNewsletter,
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: false }),
        { wrapper },
      );

      // Should not throw even without callbacks
      await act(async () => {
        await result.current.markAsRead("newsletter-1");
      });

      expect(mockToast.success).not.toHaveBeenCalled();
    });

    it("should handle undefined newsletter in success callbacks", async () => {
      mockNewsletterService.markAsRead.mockResolvedValue({
        success: true,
        // newsletter: undefined
      });

      const onSuccess = vi.fn();
      const { result } = renderHook(
        () => useNewsletterOperations({ onSuccess, showToasts: false }),
        { wrapper },
      );

      await act(async () => {
        await result.current.markAsRead("newsletter-1");
      });

      expect(onSuccess).toHaveBeenCalledWith("markAsRead", undefined);
    });
  });
});
