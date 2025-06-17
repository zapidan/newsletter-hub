import { vi } from 'vitest';
import type { Newsletter, NewsletterFilter } from '@common/types';
import { mockNewsletters } from './data.js';

export const newsletterApiMock = {
  getAll: vi.fn(async (params?: NewsletterFilter): Promise<Newsletter[]> => {
    let filteredNewsletters = [...mockNewsletters];

    if (params?.is_read !== undefined) {
      filteredNewsletters = filteredNewsletters.filter(n => n.is_read === params.is_read);
    }

    if (params?.is_archived !== undefined) {
      filteredNewsletters = filteredNewsletters.filter(n => n.is_archived === params.is_archived);
    }

    if (params?.is_liked !== undefined) {
      filteredNewsletters = filteredNewsletters.filter(n => n.is_liked === params.is_liked);
    }

    if (params?.search) {
      const searchTerm = params.search.toLowerCase();
      filteredNewsletters = filteredNewsletters.filter(n =>
        n.title.toLowerCase().includes(searchTerm) ||
        n.content.toLowerCase().includes(searchTerm) ||
        n.summary.toLowerCase().includes(searchTerm)
      );
    }

    if (params?.tag_ids && params.tag_ids.length > 0) {
      filteredNewsletters = filteredNewsletters.filter(n =>
        n.tags?.some(tag => params.tag_ids!.includes(tag.id))
      );
    }

    if (params?.source_id) {
      filteredNewsletters = filteredNewsletters.filter(n =>
        n.newsletter_source_id === params.source_id
      );
    }

    if (params?.start_date) {
      filteredNewsletters = filteredNewsletters.filter(n =>
        n.received_at >= params.start_date!
      );
    }

    if (params?.end_date) {
      filteredNewsletters = filteredNewsletters.filter(n =>
        n.received_at <= params.end_date!
      );
    }

    return filteredNewsletters;
  }),

  search: vi.fn(async (query: string): Promise<Newsletter[]> => {
    const searchTerm = query.toLowerCase();
    return mockNewsletters.filter(newsletter =>
      newsletter.title.toLowerCase().includes(searchTerm) ||
      newsletter.content.toLowerCase().includes(searchTerm) ||
      newsletter.summary.toLowerCase().includes(searchTerm)
    );
  }),

  getById: vi.fn(async (id: string): Promise<Newsletter | null> => {
    return mockNewsletters.find(n => n.id === id) || null;
  }),

  update: vi.fn(async (id: string, updates: Partial<Newsletter>): Promise<Newsletter> => {
    const newsletter = mockNewsletters.find(n => n.id === id);
    if (!newsletter) {
      throw new Error(`Newsletter with id ${id} not found`);
    }

    const updatedNewsletter = { ...newsletter, ...updates };
    const index = mockNewsletters.findIndex(n => n.id === id);
    mockNewsletters[index] = updatedNewsletter;

    return updatedNewsletter;
  }),

  delete: vi.fn(async (id: string): Promise<void> => {
    const index = mockNewsletters.findIndex(n => n.id === id);
    if (index === -1) {
      throw new Error(`Newsletter with id ${id} not found`);
    }
    mockNewsletters.splice(index, 1);
  }),

  bulkUpdate: vi.fn(async (ids: string[], updates: Partial<Newsletter>): Promise<Newsletter[]> => {
    const updatedNewsletters: Newsletter[] = [];

    ids.forEach(id => {
      const index = mockNewsletters.findIndex(n => n.id === id);
      if (index !== -1) {
        mockNewsletters[index] = { ...mockNewsletters[index], ...updates };
        updatedNewsletters.push(mockNewsletters[index]);
      }
    });

    return updatedNewsletters;
  }),

  bulkDelete: vi.fn(async (ids: string[]): Promise<void> => {
    ids.forEach(id => {
      const index = mockNewsletters.findIndex(n => n.id === id);
      if (index !== -1) {
        mockNewsletters.splice(index, 1);
      }
    });
  }),

  markAsRead: vi.fn(async (id: string): Promise<Newsletter> => {
    return newsletterApiMock.update(id, { is_read: true });
  }),

  markAsUnread: vi.fn(async (id: string): Promise<Newsletter> => {
    return newsletterApiMock.update(id, { is_read: false });
  }),

  toggleLike: vi.fn(async (id: string): Promise<Newsletter> => {
    const newsletter = mockNewsletters.find(n => n.id === id);
    if (!newsletter) {
      throw new Error(`Newsletter with id ${id} not found`);
    }
    return newsletterApiMock.update(id, { is_liked: !newsletter.is_liked });
  }),

  archive: vi.fn(async (id: string): Promise<Newsletter> => {
    return newsletterApiMock.update(id, { is_archived: true });
  }),

  unarchive: vi.fn(async (id: string): Promise<Newsletter> => {
    return newsletterApiMock.update(id, { is_archived: false });
  }),
};

vi.mock('@common/api/newsletter', () => ({
  newsletterApi: newsletterApiMock,
}));

export default newsletterApiMock;
