import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NewsletterService } from "../../newsletter/NewsletterService";
import { TagService } from "../../tag/TagService";
import { ReadingQueueService } from "../../readingQueue/ReadingQueueService";
import { newsletterApi } from "@common/api/newsletterApi";
import { tagApi } from "@common/api/tagApi";
import { readingQueueApi } from "@common/api/readingQueueApi";
import { NewsletterWithRelations, Tag, ReadingQueueItem } from "@common/types";

// Mock all API modules
vi.mock("@common/api/newsletterApi");
vi.mock("@common/api/tagApi");
vi.mock("@common/api/readingQueueApi");
vi.mock("@common/utils/logger");

const mockNewsletterApi = vi.mocked(newsletterApi);
const mockTagApi = vi.mocked(tagApi);
const mockReadingQueueApi = vi.mocked(readingQueueApi);

describe("Service Integration Tests", () => {
  let newsletterService: NewsletterService;
  let tagService: TagService;
  let readingQueueService: ReadingQueueService;

  // Mock data
  const mockNewsletter: NewsletterWithRelations = {
    id: "newsletter-1",
    title: "Test Newsletter",
    summary: "Test summary",
    content: "Test content",
    image_url: "https://example.com/image.jpg",
    received_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    is_read: false,
    is_archived: false,
    is_liked: false,
    user_id: "user-1",
    estimated_read_time: 5,
    word_count: 100,
    newsletter_source_id: "source-1",
    source: {
      id: "source-1",
      name: "Test Source",
      from: "source@example.com",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      user_id: "user-1",
    },
    tags: [],
  };

  const mockTag: Tag = {
    id: "tag-1",
    name: "Test Tag",
    color: "#3b82f6",
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00Z",
  };

  const mockReadingQueueItem: ReadingQueueItem = {
    id: "queue-1",
    user_id: "user-1",
    newsletter_id: "newsletter-1",
    position: 1,
    added_at: "2024-01-01T00:00:00Z",
    newsletter: mockNewsletter,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks for commonly used methods
    mockTagApi.getAll.mockResolvedValue([]);
    mockTagApi.getById.mockResolvedValue(null);
    mockReadingQueueApi.getAll.mockResolvedValue([]);
    mockNewsletterApi.getAll.mockResolvedValue({ data: [], total: 0 });

    newsletterService = new NewsletterService();
    tagService = new TagService();
    readingQueueService = new ReadingQueueService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Newsletter and Tag Integration", () => {
    it("should handle newsletter retrieval and add tags in sequence", async () => {
      // Setup mocks
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockTagApi.getAll.mockResolvedValue([]); // No existing tags to avoid duplicates
      mockTagApi.create.mockResolvedValue(mockTag);
      mockTagApi.getById.mockResolvedValue(mockTag);
      mockTagApi.updateNewsletterTags.mockResolvedValue(true);

      // Get newsletter
      const newsletter = await newsletterService.getNewsletter("newsletter-1");
      expect(newsletter).toEqual(mockNewsletter);

      // Create tag
      const tagResult = await tagService.createTag({
        name: "Test Tag",
        color: "#3b82f6",
      });

      expect(tagResult.success).toBe(true);
      expect(tagResult.tag).toEqual(mockTag);

      // Add tag to newsletter
      const updateResult = await tagService.updateNewsletterTags(
        "newsletter-1",
        ["tag-1"],
      );

      expect(updateResult.success).toBe(true);

      // Verify the integration
      expect(mockNewsletterApi.getById).toHaveBeenCalledWith("newsletter-1");
      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: "Test Tag",
        color: "#3b82f6",
      });
      expect(mockTagApi.updateNewsletterTags).toHaveBeenCalledWith(
        "newsletter-1",
        [mockTag],
      );
    });

    it("should handle tag creation failure gracefully", async () => {
      // Setup mocks
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockTagApi.getAll.mockResolvedValue([]); // No existing tags
      mockTagApi.create.mockRejectedValue(new Error("Tag creation failed"));

      // Get newsletter successfully
      const newsletter = await newsletterService.getNewsletter("newsletter-1");
      expect(newsletter).toEqual(mockNewsletter);

      // Attempt to create tag (should fail)
      const tagResult = await tagService.createTag({
        name: "Test Tag",
        color: "#3b82f6",
      });

      expect(tagResult.success).toBe(false);
      expect(tagResult.error).toBe(
        "Error during createTag: Tag creation failed",
      );
    });
  });

  describe("Newsletter and Reading Queue Integration", () => {
    it("should add newsletter to reading queue and manage position", async () => {
      // Setup mocks
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.add.mockResolvedValue(true); // Should return boolean success
      mockReadingQueueApi.getAll
        .mockResolvedValueOnce([]) // First call for duplicate check in addToQueue
        .mockResolvedValueOnce([mockReadingQueueItem]) // Second call for getting new item
        .mockResolvedValueOnce([mockReadingQueueItem]); // Third call for reorder validation
      mockReadingQueueApi.reorder.mockResolvedValue(true);

      // Add newsletter to reading queue via newsletter service
      const addResult =
        await newsletterService.addToReadingQueue("newsletter-1");

      expect(addResult.success).toBe(true);

      // Verify queue operations via reading queue service
      const queueResult = await readingQueueService.addToQueue("newsletter-1");

      expect(queueResult.success).toBe(true);

      // Reorder queue - expects newsletter IDs, not ReadingQueueItem objects
      const reorderResult = await readingQueueService.reorderQueue([
        "newsletter-1",
      ]);

      expect(reorderResult.success).toBe(true);

      // Verify API calls
      expect(mockNewsletterApi.getById).toHaveBeenCalledWith("newsletter-1");
      expect(mockReadingQueueApi.add).toHaveBeenCalledWith("newsletter-1");
      expect(mockReadingQueueApi.reorder).toHaveBeenCalled();
    });

    it("should remove newsletter from queue when archived", async () => {
      // Setup mocks
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockNewsletterApi.toggleArchive.mockResolvedValue({
        ...mockNewsletter,
        is_archived: true,
      });
      mockReadingQueueApi.remove.mockResolvedValue(true);

      // Archive newsletter (should remove from queue)
      const archiveResult =
        await newsletterService.toggleArchive("newsletter-1");

      expect(archiveResult.success).toBe(true);
      expect(archiveResult.newsletter?.is_archived).toBe(true);

      // Verify reading queue removal was called
      expect(mockReadingQueueApi.remove).toHaveBeenCalledWith("newsletter-1");
    });

    it("should handle queue operations with error handling", async () => {
      // Setup mocks
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockReadingQueueApi.add.mockRejectedValue(new Error("Queue is full"));

      // Attempt to add to queue (should fail)
      const result = await newsletterService.addToReadingQueue("newsletter-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Error during addToReadingQueue: Queue is full",
      );
    });
  });

  describe("Complex Multi-Service Workflows", () => {
    it("should handle complete newsletter workflow", async () => {
      // Setup mocks for a complete workflow
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockTagApi.getAll.mockResolvedValue([mockTag]);
      mockTagApi.updateNewsletterTags.mockResolvedValue(true);
      mockReadingQueueApi.add.mockResolvedValue(mockReadingQueueItem);
      mockNewsletterApi.markAsRead.mockResolvedValue({
        ...mockNewsletter,
        is_read: true,
      });

      // Step 1: Get newsletter
      const newsletter = await newsletterService.getNewsletter("newsletter-1");
      expect(newsletter).toEqual(mockNewsletter);

      // Step 2: Get available tags
      // Step 2: Get all tags with usage stats
      mockTagApi.getTagUsageStats.mockResolvedValue([
        { ...mockTag, newsletter_count: 0 },
      ]);
      const tagsResult = await tagService.getAllTags(true);
      expect(Array.isArray(tagsResult)).toBe(true);
      expect(tagsResult).toEqual([{ ...mockTag, newsletter_count: 0 }]);

      // Step 3: Add tags to newsletter
      mockTagApi.getById.mockResolvedValue(mockTag);
      const tagResult = await tagService.updateNewsletterTags("newsletter-1", [
        "tag-1",
      ]);
      expect(tagResult.success).toBe(true);

      // Step 4: Add to reading queue
      const queueResult = await readingQueueService.addToQueue("newsletter-1");
      expect(queueResult.success).toBe(true);

      // Step 5: Mark as read
      const readResult = await newsletterService.markAsRead("newsletter-1");
      expect(readResult.success).toBe(true);

      // Verify all API calls were made
      expect(mockNewsletterApi.getById).toHaveBeenCalledWith("newsletter-1");
      expect(mockTagApi.getTagUsageStats).toHaveBeenCalled();
      expect(mockTagApi.updateNewsletterTags).toHaveBeenCalledWith(
        "newsletter-1",
        [mockTag],
      );
      expect(mockReadingQueueApi.add).toHaveBeenCalledWith("newsletter-1");
      expect(mockNewsletterApi.markAsRead).toHaveBeenCalledWith("newsletter-1");
    });

    it("should handle bulk operations across services", async () => {
      // Setup mocks - bulk operations use individual API calls
      mockNewsletterApi.markAsRead = vi.fn().mockResolvedValue({
        ...mockNewsletter,
        is_read: true,
      });
      mockTagApi.create = vi.fn().mockResolvedValue(mockTag);

      // Bulk mark as read
      const readResult = await newsletterService.bulkMarkAsRead([
        "newsletter-1",
        "newsletter-2",
        "newsletter-3",
      ]);

      expect(readResult.success).toBe(true);
      expect(readResult.processedCount).toBe(3);

      // Bulk create tags
      const tagResult = await tagService.bulkCreateTags([
        { name: "Bulk Tag 1", color: "#3b82f6" },
      ]);

      expect(tagResult.success).toBe(true);
      expect(tagResult.processedCount).toBe(1);

      // Verify API calls
      expect(mockNewsletterApi.markAsRead).toHaveBeenCalledTimes(3);
      expect(mockTagApi.create).toHaveBeenCalledWith({
        name: "Bulk Tag 1",
        color: "#3b82f6",
      });
    });

    it("should handle cascading failures appropriately", async () => {
      // Setup mocks with cascading failures
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockTagApi.getById.mockResolvedValue(mockTag); // Need this for tag validation
      mockTagApi.updateNewsletterTags.mockRejectedValue(
        new Error("Tag update failed"),
      );
      mockReadingQueueApi.add.mockResolvedValue(mockReadingQueueItem);

      // Attempt workflow where tagging fails but queue addition succeeds
      const newsletter = await newsletterService.getNewsletter("newsletter-1");
      expect(newsletter).toEqual(mockNewsletter);

      // This should fail
      const tagResult = await tagService.updateNewsletterTags("newsletter-1", [
        "tag-1",
      ]);
      expect(tagResult.success).toBe(false);

      // This should still succeed
      const queueResult =
        await newsletterService.addToReadingQueue("newsletter-1");
      expect(queueResult.success).toBe(true);

      // Verify partial success
      expect(mockNewsletterApi.getById).toHaveBeenCalled();
      expect(mockTagApi.getById).toHaveBeenCalledWith("tag-1");
      expect(mockReadingQueueApi.add).toHaveBeenCalled();
    });
  });

  describe("Service Error Handling Integration", () => {
    it("should handle network errors with retry logic", async () => {
      const networkError = new Error("Network error") as Error & {
        code: string;
      };
      networkError.code = "NETWORK_ERROR";

      // Setup mocks with network error followed by success
      mockNewsletterApi.getById
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockNewsletter);

      // Should retry and eventually succeed
      const result = await newsletterService.getNewsletter("newsletter-1");
      expect(result).toEqual(mockNewsletter);
      expect(mockNewsletterApi.getById).toHaveBeenCalledTimes(3);
    });

    it("should handle validation errors without retry", async () => {
      // Setup mocks
      mockNewsletterApi.markAsRead.mockRejectedValue(
        new Error("Validation failed"),
      );

      // Should fail immediately without retry
      const result = await newsletterService.markAsRead("invalid-id");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Error during markAsRead: Validation failed");
      expect(mockNewsletterApi.markAsRead).toHaveBeenCalledTimes(1);
    });

    it("should handle timeout errors appropriately", async () => {
      const timeoutError = new Error("Operation timed out") as Error & {
        code: string;
      };
      timeoutError.code = "TIMEOUT";

      // Setup mocks
      mockTagApi.getAll.mockRejectedValue(timeoutError);

      // Should handle timeout gracefully and throw error
      await expect(tagService.getAllTags()).rejects.toThrow(
        "Operation timed out",
      );
    });
  });

  describe("Performance and Concurrency", () => {
    it("should handle concurrent operations correctly", async () => {
      // Setup mocks for concurrent operations
      mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
      mockTagApi.getAll.mockResolvedValue([mockTag]);
      mockReadingQueueApi.getAll.mockResolvedValue([mockReadingQueueItem]);

      // Execute concurrent operations
      const [newsletter, tags, queue] = await Promise.all([
        newsletterService.getNewsletter("newsletter-1"),
        tagService.getAllTags(),
        readingQueueService.getReadingQueue(),
      ]);

      // Verify all operations completed successfully
      expect(newsletter).toEqual(mockNewsletter);
      expect(Array.isArray(tags)).toBe(true);
      expect(queue).toEqual([mockReadingQueueItem]);

      // Verify all API calls were made
      expect(mockNewsletterApi.getById).toHaveBeenCalledWith("newsletter-1");
      expect(mockTagApi.getAll).toHaveBeenCalledWith();
      expect(mockReadingQueueApi.getAll).toHaveBeenCalled();
    });

    it("should handle batch processing efficiently", async () => {
      const batchSize = 10;
      const newsletters = Array.from({ length: 25 }, (_, i) => ({
        ...mockNewsletter,
        id: `newsletter-${i + 1}`,
      }));

      // Setup mocks for batch processing - bulk operations use individual API calls
      mockNewsletterApi.markAsRead = vi.fn().mockResolvedValue({
        ...mockNewsletter,
        is_read: true,
      });

      // Process in batches
      const batchPromises = [];
      for (let i = 0; i < newsletters.length; i += batchSize) {
        const batch = newsletters.slice(i, i + batchSize);
        const ids = batch.map((n) => n.id);
        batchPromises.push(newsletterService.bulkMarkAsRead(ids));
      }

      const results = await Promise.all(batchPromises);

      // Verify all batches processed successfully
      results.forEach((result) => {
        expect(result.success).toBe(true);
      });

      // Verify total processed count
      const totalProcessed = results.reduce(
        (sum, result) => sum + result.processedCount,
        0,
      );
      expect(totalProcessed).toBe(25);
    });
  });

  describe("Data Consistency", () => {
    it("should maintain data consistency across services", async () => {
      // Setup mocks with proper sequencing
      const mockNewsletterWithoutTags = { ...mockNewsletter, tags: [] };
      const mockNewsletterWithTags = { ...mockNewsletter, tags: [mockTag] };

      mockNewsletterApi.getById
        .mockResolvedValueOnce(mockNewsletterWithoutTags) // First call
        .mockResolvedValueOnce(mockNewsletterWithTags); // Second call after update

      mockTagApi.getById.mockResolvedValue(mockTag); // For tag validation
      mockTagApi.updateNewsletterTags.mockResolvedValue(true);

      // Get initial state
      const initialNewsletter =
        await newsletterService.getNewsletter("newsletter-1");
      expect(initialNewsletter).not.toBeNull();
      expect(initialNewsletter!.tags).toEqual([]);

      // Update tags
      const updateResult = await tagService.updateNewsletterTags(
        "newsletter-1",
        ["tag-1"],
      );
      expect(updateResult.success).toBe(true);

      // Verify updated state
      const updatedNewsletter =
        await newsletterService.getNewsletter("newsletter-1");
      expect(updatedNewsletter).not.toBeNull();
      expect(updatedNewsletter!.tags).toEqual([mockTag]);
    });

    it("should handle data synchronization issues", async () => {
      // Simulate race condition where data changes between operations
      let callCount = 0;
      mockNewsletterApi.getById.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ...mockNewsletter, is_read: false };
        } else {
          return { ...mockNewsletter, is_read: true };
        }
      });

      // First call gets unread newsletter
      const newsletter1 = await newsletterService.getNewsletter("newsletter-1");
      expect(newsletter1).not.toBeNull();
      expect(newsletter1!.is_read).toBe(false);

      // Second call gets read newsletter (simulating concurrent modification)
      const newsletter2 = await newsletterService.getNewsletter("newsletter-1");
      expect(newsletter2).not.toBeNull();
      expect(newsletter2!.is_read).toBe(true);

      // Verify both calls were made
      expect(mockNewsletterApi.getById).toHaveBeenCalledTimes(2);
    });
  });

  describe("Resource Management", () => {
    it("should handle resource cleanup properly", async () => {
      const services = [
        new NewsletterService(),
        new TagService(),
        new ReadingQueueService(),
      ];

      // Simulate operations that might create resources
      const promises = services.map(async (service, index) => {
        if (service instanceof NewsletterService) {
          mockNewsletterApi.getById.mockResolvedValue(mockNewsletter);
          return service.getNewsletter(`newsletter-${index}`);
        } else if (service instanceof TagService) {
          mockTagApi.getAll.mockResolvedValue([mockTag]);
          return service.getAllTags();
        } else {
          mockReadingQueueApi.getAll.mockResolvedValue([mockReadingQueueItem]);
          return service.getReadingQueue();
        }
      });

      const results = await Promise.all(promises);

      // Verify all operations completed
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual(mockNewsletter);
      expect(Array.isArray(results[1])).toBe(true);
      expect(Array.isArray(results[2])).toBe(true);
    });
  });
});
