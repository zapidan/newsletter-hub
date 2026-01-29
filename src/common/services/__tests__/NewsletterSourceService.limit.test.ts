import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newsletterSourceService } from '../newsletterSource/NewsletterSourceService';
import { newsletterSourceApi } from '../../api/newsletterSourceApi';

// Mock the API layer
vi.mock('../../api/newsletterSourceApi');

const mockNewsletterSourceApi = vi.mocked(newsletterSourceApi);

describe('NewsletterSourceService - Limit Override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockSource = (id: string, name: string) => ({
    id,
    name,
    from: `${name.toLowerCase()}@example.com`,
    user_id: 'user-123',
    is_archived: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    newsletter_count: 0,
    unread_count: 0,
  });

  it('should apply default limit when no limit is specified', async () => {
    const mockSources = Array.from({ length: 50 }, (_, i) =>
      createMockSource(`source-${i}`, `Source ${i}`)
    );

    mockNewsletterSourceApi.getAll.mockResolvedValue({
      data: mockSources,
      count: 164,
      page: 1,
      limit: 50,
      hasMore: true,
      nextPage: 2,
      prevPage: null,
    });

    const result = await newsletterSourceService.getSources({});

    expect(result.data).toHaveLength(50);
    expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
      limit: 50, // Default limit applied by service
      orderBy: 'created_at',
      ascending: false,
    });
  });

  it('should override default limit when specified', async () => {
    const mockSources = Array.from({ length: 164 }, (_, i) =>
      createMockSource(`source-${i}`, `Source ${i}`)
    );

    mockNewsletterSourceApi.getAll.mockResolvedValue({
      data: mockSources,
      count: 164,
      page: 1,
      limit: 1000,
      hasMore: false,
      nextPage: null,
      prevPage: null,
    });

    const result = await newsletterSourceService.getSources({
      limit: 1000,
      excludeArchived: false,
      includeCount: true,
    });

    expect(result.data).toHaveLength(164);
    expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
      limit: 1000, // Override limit applied
      orderBy: 'created_at',
      ascending: false,
      excludeArchived: false,
      includeCount: true,
    });
  });

  it('should pass through all parameters correctly with limit override', async () => {
    const mockSources = [createMockSource('reuters', 'Reuters')];

    mockNewsletterSourceApi.getAll.mockResolvedValue({
      data: mockSources,
      count: 1,
      page: 1,
      limit: 1000,
      hasMore: false,
      nextPage: null,
      prevPage: null,
    });

    const result = await newsletterSourceService.getSources({
      excludeArchived: false,
      includeCount: true,
      limit: 1000,
      search: 'reuters',
      orderBy: 'name',
      ascending: true,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Reuters');
    expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
      excludeArchived: false,
      includeCount: true,
      limit: 1000,
      search: 'reuters',
      orderBy: 'name',
      ascending: true,
    });
  });

  it('should validate search query length', async () => {
    const mockSources = [createMockSource('test', 'Test')];

    mockNewsletterSourceApi.getAll.mockResolvedValue({
      data: mockSources,
      count: 1,
      page: 1,
      limit: 50,
      hasMore: false,
      nextPage: null,
      prevPage: null,
    });

    // Search query too short should be filtered out
    await newsletterSourceService.getSources({
      search: 'r', // Only 1 character
    });

    expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
      limit: 50,
      orderBy: 'created_at',
      ascending: false,
      // search should not be included
    });
  });

  it('should handle excludeArchived parameter correctly', async () => {
    const mockSources = [
      createMockSource('active-source', 'Active Source'),
      { ...createMockSource('archived-source', 'Archived Source'), is_archived: true },
    ];

    mockNewsletterSourceApi.getAll.mockResolvedValue({
      data: [mockSources[0]], // Only active source returned
      count: 1,
      page: 1,
      limit: 1000,
      hasMore: false,
      nextPage: null,
      prevPage: null,
    });

    const result = await newsletterSourceService.getSources({
      excludeArchived: false,
      limit: 1000,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Active Source');
    expect(mockNewsletterSourceApi.getAll).toHaveBeenCalledWith({
      excludeArchived: false,
      limit: 1000,
      orderBy: 'created_at',
      ascending: false,
    });
  });
});
