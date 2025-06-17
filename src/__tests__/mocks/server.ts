import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import {
  mockNewsletters,
  mockUsers,
  mockSourceGroups,
  mockTags,
} from "./data.js";
import type { Newsletter, NewsletterSourceGroup, Tag } from "@common/types";

// Mock API handlers
export const handlers = [
  // Auth endpoints
  http.post("/auth/v1/token", () => {
    return HttpResponse.json({
      access_token: "mock-access-token",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: mockUsers[0],
    });
  }),

  http.get("/auth/v1/user", () => {
    return HttpResponse.json(mockUsers[0]);
  }),

  http.post("/auth/v1/logout", () => {
    return HttpResponse.json({ message: "Logged out successfully" });
  }),

  // Newsletter endpoints
  http.get("/rest/v1/newsletters", ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const search = url.searchParams.get("search");
    const tag = url.searchParams.get("tag");
    const source = url.searchParams.get("source");
    const isRead = url.searchParams.get("is_read");

    let filteredNewsletters = [...mockNewsletters];

    // Apply filters
    if (search) {
      filteredNewsletters = filteredNewsletters.filter(
        (newsletter: Newsletter) =>
          newsletter.title.toLowerCase().includes(search.toLowerCase()) ||
          newsletter.content.toLowerCase().includes(search.toLowerCase()),
      );
    }

    if (tag) {
      filteredNewsletters = filteredNewsletters.filter(
        (newsletter: Newsletter) => newsletter.tags?.some((t) => t.id === tag),
      );
    }

    if (source) {
      filteredNewsletters = filteredNewsletters.filter(
        (newsletter: Newsletter) => newsletter.newsletter_source_id === source,
      );
    }

    if (isRead !== null) {
      const readFilter = isRead === "true";
      filteredNewsletters = filteredNewsletters.filter(
        (newsletter: Newsletter) => newsletter.is_read === readFilter,
      );
    }

    // Apply pagination
    const paginatedNewsletters = filteredNewsletters.slice(
      offset,
      offset + limit,
    );

    return HttpResponse.json(paginatedNewsletters);
  }),

  http.get("/rest/v1/newsletters/:id", ({ params }) => {
    const newsletter = mockNewsletters.find(
      (n: Newsletter) => n.id === params.id,
    );
    if (!newsletter) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(newsletter);
  }),

  http.patch("/rest/v1/newsletters/:id", async ({ params, request }) => {
    const newsletter = mockNewsletters.find(
      (n: Newsletter) => n.id === params.id,
    );
    if (!newsletter) {
      return new HttpResponse(null, { status: 404 });
    }

    const updates = (await request.json()) as Partial<Newsletter>;
    const updatedNewsletter = { ...newsletter, ...updates };

    // Update the mock data
    const index = mockNewsletters.findIndex(
      (n: Newsletter) => n.id === params.id,
    );
    mockNewsletters[index] = updatedNewsletter;

    return HttpResponse.json(updatedNewsletter);
  }),

  http.delete("/rest/v1/newsletters/:id", ({ params }) => {
    const index = mockNewsletters.findIndex(
      (n: Newsletter) => n.id === params.id,
    );
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    mockNewsletters.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Source groups endpoints
  http.get("/rest/v1/source_groups", () => {
    return HttpResponse.json(mockSourceGroups);
  }),

  http.post("/rest/v1/source_groups", async ({ request }) => {
    const newGroup = (await request.json()) as Partial<NewsletterSourceGroup>;
    const sourceGroup: NewsletterSourceGroup = {
      id: `group-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: "user-1",
      name: newGroup.name || "New Group",
      ...newGroup,
    };
    mockSourceGroups.push(sourceGroup);
    return HttpResponse.json(sourceGroup);
  }),

  http.patch("/rest/v1/source_groups/:id", async ({ params, request }) => {
    const index = mockSourceGroups.findIndex(
      (g: NewsletterSourceGroup) => g.id === params.id,
    );
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    const updates = (await request.json()) as Partial<NewsletterSourceGroup>;
    mockSourceGroups[index] = { ...mockSourceGroups[index], ...updates };
    return HttpResponse.json(mockSourceGroups[index]);
  }),

  http.delete("/rest/v1/source_groups/:id", ({ params }) => {
    const index = mockSourceGroups.findIndex(
      (g: NewsletterSourceGroup) => g.id === params.id,
    );
    if (index === -1) {
      return new HttpResponse(null, { status: 404 });
    }

    mockSourceGroups.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // Tags endpoints
  http.get("/rest/v1/tags", () => {
    return HttpResponse.json(mockTags);
  }),

  http.post("/rest/v1/tags", async ({ request }) => {
    const newTag = (await request.json()) as Partial<Tag>;
    const tag: Tag = {
      id: `tag-${Date.now()}`,
      created_at: new Date().toISOString(),
      user_id: "user-1",
      name: newTag.name || "New Tag",
      color: newTag.color || "#3B82F6",
      ...newTag,
    };
    mockTags.push(tag);
    return HttpResponse.json(tag);
  }),

  // Bulk operations
  http.post("/rest/v1/newsletters/bulk-update", async ({ request }) => {
    const { ids, updates } = (await request.json()) as {
      ids: string[];
      updates: Partial<Newsletter>;
    };

    const updatedNewsletters = ids
      .map((id) => {
        const index = mockNewsletters.findIndex((n: Newsletter) => n.id === id);
        if (index !== -1) {
          mockNewsletters[index] = { ...mockNewsletters[index], ...updates };
          return mockNewsletters[index];
        }
        return null;
      })
      .filter(Boolean);

    return HttpResponse.json(updatedNewsletters);
  }),

  http.delete("/rest/v1/newsletters/bulk-delete", async ({ request }) => {
    const { ids } = (await request.json()) as { ids: string[] };

    ids.forEach((id) => {
      const index = mockNewsletters.findIndex((n: Newsletter) => n.id === id);
      if (index !== -1) {
        mockNewsletters.splice(index, 1);
      }
    });

    return new HttpResponse(null, { status: 204 });
  }),

  // Search endpoints
  http.get("/rest/v1/search", ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || "";
    const type = url.searchParams.get("type");

    const results: Array<
      (Newsletter & { type: string }) | (Tag & { type: string })
    > = [];

    if (!type || type === "newsletters") {
      const newsletterResults = mockNewsletters
        .filter(
          (newsletter: Newsletter) =>
            newsletter.title.toLowerCase().includes(query.toLowerCase()) ||
            newsletter.content.toLowerCase().includes(query.toLowerCase()),
        )
        .map((newsletter: Newsletter) => ({
          ...newsletter,
          type: "newsletter",
        }));
      results.push(...newsletterResults);
    }

    if (!type || type === "tags") {
      const tagResults = mockTags
        .filter((tag: Tag) =>
          tag.name.toLowerCase().includes(query.toLowerCase()),
        )
        .map((tag: Tag) => ({
          ...tag,
          type: "tag",
        }));
      results.push(...tagResults);
    }

    return HttpResponse.json(results);
  }),

  // Analytics endpoints
  http.get("/rest/v1/analytics/reading-stats", () => {
    return HttpResponse.json({
      total_newsletters: mockNewsletters.length,
      read_newsletters: mockNewsletters.filter((n: Newsletter) => n.is_read)
        .length,
      unread_newsletters: mockNewsletters.filter((n: Newsletter) => !n.is_read)
        .length,
      total_reading_time: 1250, // minutes
      newsletters_this_week: 15,
      reading_streak: 7,
    });
  }),

  http.get("/rest/v1/analytics/trending-topics", () => {
    return HttpResponse.json([
      { topic: "AI/ML", count: 25, trend: "up" },
      { topic: "Web Development", count: 20, trend: "stable" },
      { topic: "Startup News", count: 18, trend: "up" },
      { topic: "Technology", count: 15, trend: "down" },
      { topic: "Design", count: 12, trend: "stable" },
    ]);
  }),

  // Error simulation handlers
  http.get("/rest/v1/error/500", () => {
    return new HttpResponse(null, { status: 500 });
  }),

  http.get("/rest/v1/error/404", () => {
    return new HttpResponse(null, { status: 404 });
  }),

  http.get("/rest/v1/error/network", () => {
    return HttpResponse.error();
  }),
];

// Setup server
export const server = setupServer(...handlers);
