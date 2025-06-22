import { newsletterService } from "@common/services";
import { NewsletterOperationResult } from "@common/services/newsletter/NewsletterService";
import { NewsletterWithRelations } from "@common/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "react-hot-toast";
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

    it("should show success toast when showToasts is true", async () => {
      // Mock the service to return a proper NewsletterOperationResult
      mockNewsletterService.toggleArchive.mockResolvedValue({
        success: true,
        newsletter: {
          ...mockNewsletter,
          is_archived: true,
        },
      });

      const { result } = renderHook(
        () => useNewsletterOperations({ showToasts: true }),
        { wrapper },
      );

      await act(async () => {
        await result.current.toggleArchive("newsletter-1");
      });

      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining("archived"));
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