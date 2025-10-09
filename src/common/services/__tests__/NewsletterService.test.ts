import { newsletterApi } from "@common/api/newsletterApi";
import { readingQueueApi } from "@common/api/readingQueueApi";
import { tagApi } from "@common/api/tagApi";
import { NewsletterWithRelations, Tag } from "@common/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NewsletterService } from "../newsletter/NewsletterService";

// Mock the API modules
vi.mock("@common/api/newsletterApi");
vi.mock("@common/api/readingQueueApi");
vi.mock("@common/api/tagApi");
vi.mock("@common/utils/logger");

const mockNewsletterApi = vi.mocked(newsletterApi);
const mockReadingQueueApi = vi.mocked(readingQueueApi);
const mockTagApi = vi.mocked(tagApi);

describe("NewsletterService", () => {
  let service: NewsletterService;

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

  const mockTag: Tag = {
    id: "tag-1",
    name: "Test Tag",
    color: "#3b82f6",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    service = new NewsletterService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getNewsletter", () => {
    it("should return newsletter when found", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);

      const result = await service.getNewsletter("newsletter-1");

      expect(result).toEqual(mockNewsletter);
      expect(mockNewsletterApi.getById).toHaveBeenCalledWith("newsletter-1");
    });

    it("should throw NotFoundError when newsletter not found", async () => {
      mockNewsletterApi.getById.mockResolvedValue(null);

      await expect(service.getNewsletter("newsletter-1")).rejects.toThrow(
        "Newsletter with ID newsletter-1 not found",
      );
    });

    it("should validate newsletter ID", async () => {
      await expect(service.getNewsletter("bad-id")).rejects.toThrow(
        "Newsletter with ID bad-id not found",
      );
      await expect(service.getNewsletter("")).rejects.toThrow(
        "newsletter ID is required",
      );
    });
  });

  describe("getNewsletters", () => {
    it("should return paginated newsletters with processed params", async () => {
      const mockResponse = {
        data: [mockNewsletter],
        count: 1,
        hasMore: false,
      };
      mockNewsletterApi.getAll.mockResolvedValue(mockResponse);

      const result = await service.getNewsletters({ limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mockNewsletterApi.getAll).toHaveBeenCalledWith({
        limit: 10,
        orderBy: "received_at",
        orderDirection: "desc",
        includeSource: true,
        includeTags: true,
      });
    });

    it("should apply default parameters when none provided", async () => {
      const mockResponse = {
        data: [mockNewsletter],
        count: 1,
        hasMore: false,
      };
      mockNewsletterApi.getAll.mockResolvedValue(mockResponse);

      await service.getNewsletters();

      expect(mockNewsletterApi.getAll).toHaveBeenCalledWith({
        limit: 50,
        orderBy: "received_at",
        orderDirection: "desc",
        includeSource: true,
        includeTags: true,
      });
    });

    it("should use getByTags when tagIds are provided", async () => {
      const mockResponse = {
        data: [mockNewsletter],
        count: 1,
        hasMore: false,
      };
      mockNewsletterApi.getByTags.mockResolvedValue(mockResponse);

      const result = await service.getNewsletters({
        tagIds: ["tag-1", "tag-2"],
        limit: 10
      });

      expect(result).toEqual(mockResponse);
      expect(mockNewsletterApi.getByTags).toHaveBeenCalledWith(
        ["tag-1", "tag-2"],
        expect.objectContaining({
          limit: 10,
          includeSource: true,
          includeTags: true,
          orderBy: "received_at",
          orderDirection: "desc",
        })
      );
      expect(mockNewsletterApi.getAll).not.toHaveBeenCalled();
    });
  });

  describe("getNewslettersByTags", () => {
    it("should return newsletters filtered by tags", async () => {
      const mockResponse = {
        data: [mockNewsletter],
        count: 1,
        hasMore: false,
      };
      mockNewsletterApi.getByTags.mockResolvedValue(mockResponse);

      const result = await service.getNewslettersByTags(["tag-1", "tag-2"], {
        limit: 10,
        isRead: false,
      });

      expect(result).toEqual(mockResponse);
      expect(mockNewsletterApi.getByTags).toHaveBeenCalledWith(
        ["tag-1", "tag-2"],
        expect.objectContaining({
          limit: 10,
          isRead: false,
          includeSource: true,
          includeTags: true,
          orderBy: "received_at",
          orderDirection: "desc",
        })
      );
    });

    it("should validate tagIds parameter", async () => {
      await expect(service.getNewslettersByTags([])).rejects.toThrow(
        "tag IDs must have at least 1 items"
      );

      await expect(service.getNewslettersByTags("invalid" as any)).rejects.toThrow(
        "tag IDs must be an array"
      );
    });

    it("should handle API errors gracefully", async () => {
      const error = new Error("API Error");
      mockNewsletterApi.getByTags.mockRejectedValue(error);

      await expect(
        service.getNewslettersByTags(["tag-1"], { limit: 10 })
      ).rejects.toThrow("API Error");

      expect(mockNewsletterApi.getByTags).toHaveBeenCalledWith(
        ["tag-1"],
        expect.objectContaining({
          limit: 10,
          includeTags: true,
        })
      );
    });

    it("should always include tags when filtering by tags", async () => {
      const mockResponse = {
        data: [],
        count: 0,
        hasMore: false,
      };
      mockNewsletterApi.getByTags.mockResolvedValue(mockResponse);

      await service.getNewslettersByTags(["tag-1"], {
        includeTags: false, // This should be overridden
      });

      expect(mockNewsletterApi.getByTags).toHaveBeenCalledWith(
        ["tag-1"],
        expect.objectContaining({
          includeTags: true, // Should be forced to true
        })
      );
    });

    it("should handle empty tag results", async () => {
      const mockResponse = {
        data: [],
        count: 0,
        hasMore: false,
      };
      mockNewsletterApi.getByTags.mockResolvedValue(mockResponse);

      const result = await service.getNewslettersByTags(["non-existent-tag"]);

      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(0);
    });

    it("should work with multiple tags (AND logic)", async () => {
      const mockResponse = {
        data: [mockNewsletter],
        count: 1,
        hasMore: false,
      };
      mockNewsletterApi.getByTags.mockResolvedValue(mockResponse);

      const result = await service.getNewslettersByTags(["tag-1", "tag-2", "tag-3"]);

      expect(result).toEqual(mockResponse);
      expect(mockNewsletterApi.getByTags).toHaveBeenCalledWith(
        ["tag-1", "tag-2", "tag-3"],
        expect.any(Object)
      );
    });
  });

  describe("markAsRead", () => {
    it("should mark newsletter as read successfully", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockNewsletterApi.markAsRead.mockResolvedValue({
        ...mockNewsletter,
        is_read: true,
      });

      const result = await service.markAsRead("newsletter-1");

      expect(result.success).toBe(true);
      expect(mockNewsletterApi.markAsRead).toHaveBeenCalledWith("newsletter-1");
    });

    it("should return error when API call fails", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockNewsletterApi.markAsRead.mockRejectedValue(new Error("API Error"));

      const result = await service.markAsRead("newsletter-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Error during markAsRead: API Error");
    });

    it("should handle API errors gracefully", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockNewsletterApi.markAsRead.mockRejectedValue(new Error("API Error"));

      const result = await service.markAsRead("newsletter-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Error during markAsRead: API Error");
    });
  });

  describe("markAsUnread", () => {
    it("should mark newsletter as unread successfully", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockNewsletterApi.markAsUnread.mockResolvedValue(mockNewsletter);

      const result = await service.markAsUnread("newsletter-1");

      expect(result.success).toBe(true);
      expect(mockNewsletterApi.markAsUnread).toHaveBeenCalledWith(
        "newsletter-1",
      );
    });
  });

  describe("bulkMarkAsRead", () => {
    it("should mark multiple newsletters as read", async () => {
      mockNewsletterApi.markAsRead.mockResolvedValue({
        ...mockNewsletter,
        is_read: true,
      });

      const result = await service.bulkMarkAsRead([
        "newsletter-1",
        "newsletter-2",
      ]);

      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(mockNewsletterApi.markAsRead).toHaveBeenCalledTimes(2);
    });

    it("should handle partial failures", async () => {
      mockNewsletterApi.markAsRead
        .mockResolvedValueOnce({
          ...mockNewsletter,
          is_read: true,
        })
        .mockRejectedValueOnce(new Error("API Error"));

      const result = await service.bulkMarkAsRead([
        "newsletter-1",
        "newsletter-2",
      ]);

      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe("newsletter-2");
    });

    it("should validate input array", async () => {
      await expect(service.bulkMarkAsRead([])).rejects.toThrow(
        "newsletter IDs must have at least 1 items",
      );
    });
  });

  describe("toggleLike", () => {
    it("should toggle like status successfully", async () => {
      const unlikedNewsletter = { ...mockNewsletter, is_liked: false };
      const likedNewsletter = { ...mockNewsletter, is_liked: true };
      mockNewsletterApi.getById.mockResolvedValue(unlikedNewsletter);
      mockNewsletterApi.toggleLike.mockResolvedValue(likedNewsletter);

      const result = await service.toggleLike("newsletter-1");

      expect(result.success).toBe(true);
      expect(result.newsletter?.is_liked).toBe(true);
      expect(mockNewsletterApi.toggleLike).toHaveBeenCalledWith("newsletter-1");
    });

    it("should return error when newsletter not found", async () => {
      mockNewsletterApi.toggleLike.mockRejectedValue(
        new Error("Newsletter not found"),
      );

      const result = await service.toggleLike("newsletter-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Newsletter not found");
    });
  });

  describe("toggleArchive", () => {
    it("should toggle archive status and remove from reading queue when archived", async () => {
      const unarchivedNewsletter = { ...mockNewsletter, is_archived: false };
      mockNewsletterApi.getById.mockResolvedValue(unarchivedNewsletter);
      mockNewsletterApi.toggleArchive.mockResolvedValue({
        ...unarchivedNewsletter,
        is_archived: true,
      });
      mockReadingQueueApi.remove.mockResolvedValue(true);

      const result = await service.toggleArchive("newsletter-1");

      expect(result.success).toBe(true);
      expect(result.newsletter?.is_archived).toBe(true);
      expect(mockNewsletterApi.toggleArchive).toHaveBeenCalledWith(
        "newsletter-1",
      );
      expect(mockReadingQueueApi.remove).toHaveBeenCalledWith("newsletter-1");
    });

    it("should not remove from reading queue when unarchiving", async () => {
      const archivedNewsletter = { ...mockNewsletter, is_archived: true };
      mockNewsletterApi.getById.mockResolvedValue(archivedNewsletter);
      mockNewsletterApi.toggleArchive.mockResolvedValue({
        ...archivedNewsletter,
        is_archived: false,
      });

      const result = await service.toggleArchive("newsletter-1");

      expect(result.success).toBe(true);
      expect(result.newsletter?.is_archived).toBe(false);
      expect(mockReadingQueueApi.remove).not.toHaveBeenCalled();
    });
  });

  describe("addToReadingQueue", () => {
    it("should add newsletter to reading queue successfully", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      const mockReadingQueueItem = {
        id: "queue-1",
        user_id: "user-1",
        newsletter_id: "newsletter-1",
        position: 1,
        added_at: "2024-01-15T10:00:00Z",
        newsletter: mockNewsletter,
      };
      mockReadingQueueApi.add.mockResolvedValue(mockReadingQueueItem);

      const result = await service.addToReadingQueue("newsletter-1");

      expect(result.success).toBe(true);
      expect(result.newsletter).toEqual(mockNewsletter);
      expect(mockReadingQueueApi.add).toHaveBeenCalledWith("newsletter-1");
    });

    it("should prevent adding archived newsletter to reading queue", async () => {
      const archivedNewsletter = { ...mockNewsletter, is_archived: true };
      mockNewsletterApi.getById.mockResolvedValue(archivedNewsletter);

      const result = await service.addToReadingQueue("newsletter-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Cannot add archived newsletter to reading queue",
      );
      expect(mockReadingQueueApi.add).not.toHaveBeenCalled();
    });

    it("should return error when newsletter not found", async () => {
      mockNewsletterApi.getById.mockResolvedValue(null);

      const result = await service.addToReadingQueue("newsletter-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Newsletter with ID newsletter-1 not found");
    });
  });

  describe("removeFromReadingQueue", () => {
    it("should remove newsletter from reading queue successfully", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.remove.mockResolvedValue(true);

      const result = await service.removeFromReadingQueue("newsletter-1");

      expect(result.success).toBe(true);
      expect(mockReadingQueueApi.remove).toHaveBeenCalledWith("newsletter-1");
    });

    it("should return error when removal fails", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.remove.mockRejectedValue(new Error("Removal failed"));

      const result = await service.removeFromReadingQueue("newsletter-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Error during removeFromReadingQueue: Removal failed",
      );
    });
  });

  describe("updateTags", () => {
    it("should update newsletter tags successfully", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockTagApi.updateNewsletterTags.mockResolvedValue(true);

      const result = await service.updateTags("newsletter-1", ["tag-1"]);

      expect(result.success).toBe(true);
      expect(result.newsletter?.tags).toEqual([mockTag]);
      expect(mockTagApi.updateNewsletterTags).toHaveBeenCalledWith(
        "newsletter-1",
        [mockTag],
      );
    });

    it("should return error when newsletter not found", async () => {
      mockNewsletterApi.getById.mockResolvedValue(null);

      const result = await service.updateTags("newsletter-1", ["tag-1"]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Newsletter with ID newsletter-1 not found");
    });

    it("should return error when tag not found", async () => {
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockTagApi.getById.mockResolvedValue(null);

      const result = await service.updateTags("newsletter-1", ["tag-1"]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Tag with ID tag-1 not found");
    });

    it("should validate tag IDs array", async () => {
      await expect(
        service.updateTags("newsletter-1", undefined as unknown as string[]),
      ).rejects.toThrow("tag IDs is required");
    });
  });

  describe("searchNewsletters", () => {
    it("should search newsletters with query and filters", async () => {
      const mockResponse = {
        data: [mockNewsletter],
        count: 1,
        hasMore: false,
      };
      mockNewsletterApi.getAll.mockResolvedValue(mockResponse);

      const result = await service.searchNewsletters("test query", {
        is_read: false,
      });

      expect(result).toEqual(mockResponse);
      expect(mockNewsletterApi.getAll).toHaveBeenCalledWith({
        search: "test query",
        isRead: false,
        isArchived: undefined,
        isLiked: undefined,
        tagIds: undefined,
        sourceIds: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        limit: 50,
        orderBy: "received_at",
        orderDirection: "desc",
        includeSource: true,
        includeTags: true,
      });
    });

    it("should validate search query", async () => {
      await expect(service.searchNewsletters("")).rejects.toThrow(
        "search query is required",
      );
    });

    it("should trim search query", async () => {
      const mockResponse = {
        data: [mockNewsletter],
        count: 1,
        hasMore: false,
      };
      mockNewsletterApi.getAll.mockResolvedValue(mockResponse);

      await service.searchNewsletters("  test query  ");

      expect(mockNewsletterApi.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          search: "test query",
        }),
      );
    });
  });

  describe("error handling and retries", () => {
    it("should retry failed operations", async () => {
      // Mock first two calls to fail with network error, third to succeed
      const networkError = new Error("Network error") as Error & {
        code: string;
      };
      networkError.code = "NETWORK_ERROR";

      mockNewsletterApi.getById
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockNewsletter);

      const result = await service.getNewsletter("newsletter-1");

      expect(result).toEqual(mockNewsletter);
      expect(mockNewsletterApi.getById).toHaveBeenCalledTimes(3);
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Operation timed out");
      mockNewsletterApi.getById.mockRejectedValue(timeoutError);

      await expect(service.getNewsletter("newsletter-1")).rejects.toThrow(
        "Operation timed out",
      );
    });

    it("should normalize different error types", async () => {
      const networkError = new Error("fetch failed");
      mockNewsletterApi.getById.mockRejectedValue(networkError);

      await expect(service.getNewsletter("newsletter-1")).rejects.toThrow(
        "Network error during getNewsletter",
      );
    });
  });

  describe("validation", () => {
    it("should validate required string parameters", async () => {
      await expect(
        service.getNewsletter(null as unknown as string),
      ).rejects.toThrow("newsletter ID is required");
      await expect(
        service.getNewsletter(undefined as unknown as string),
      ).rejects.toThrow("newsletter ID is required");
      await expect(service.getNewsletter("")).rejects.toThrow(
        "newsletter ID is required",
      );
      await expect(service.getNewsletter("bad-id")).rejects.toThrow(
        "Newsletter with ID bad-id not found",
      );
    });

    it("should validate array parameters", async () => {
      await expect(
        service.bulkMarkAsRead(null as unknown as string[]),
      ).rejects.toThrow("newsletter IDs is required");
      await expect(
        service.bulkMarkAsRead(undefined as unknown as string[]),
      ).rejects.toThrow("newsletter IDs is required");
      await expect(service.bulkMarkAsRead([])).rejects.toThrow(
        "newsletter IDs must have at least 1 items",
      );
    });
  });
});
