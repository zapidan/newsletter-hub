import { NewsletterGroup } from '@common/types';
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { searchService } from '../../services/searchService';
import { useNewsletterGroups } from '../useSearch';

// Mock the searchService
vi.mock('../../services/searchService', () => ({
  searchService: vi.fn(),
}));

const mockSearchService = searchService as any;

describe('useNewsletterGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();

  });

  it('should load groups successfully', async () => {
    const mockGroups: NewsletterGroup[] = [
      {
        id: 'group1',
        name: 'Tech News',
        color: '#3b82f6',
        user_id: 'user1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sources: [],
      },
      {
        id: 'group2',
        name: 'Business Updates',
        color: '#10b981',
        user_id: 'user1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sources: [],
      },
    ];

    mockSearchService.mockReturnValue({
      getGroups: vi.fn().mockResolvedValue(mockGroups),
      formatSearchError: vi.fn().mockReturnValue('Error message'),
    } as any);

    const { result } = renderHook(() => useNewsletterGroups());

    expect(result.current.loading).toBe(true);
    expect(result.current.groups).toEqual([]);
    expect(result.current.error).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.groups).toEqual(mockGroups);
    expect(result.current.error).toBe(null);
    expect(mockSearchService().getGroups).toHaveBeenCalledTimes(1);
  });

  it('should handle errors when loading groups', async () => {
    const errorMessage = 'Failed to load groups';
    mockSearchService.mockReturnValue({
      getGroups: vi.fn().mockRejectedValue(new Error(errorMessage)),
      formatSearchError: vi.fn().mockReturnValue(errorMessage),

    } as any);

    const { result } = renderHook(() => useNewsletterGroups());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.error).toBe(errorMessage);
    expect(mockSearchService().getGroups).toHaveBeenCalledTimes(1);
    expect(mockSearchService().formatSearchError).toHaveBeenCalledWith(new Error(errorMessage));
  });

  it('should return empty groups array when service returns empty', async () => {
    mockSearchService.mockReturnValue({
      getGroups: vi.fn().mockResolvedValue([]),
      formatSearchError: vi.fn().mockReturnValue('Error message'),
    } as any);

    const { result } = renderHook(() => useNewsletterGroups());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.groups).toEqual([]);
    expect(result.current.error).toBe(null);
  });

  it('should not call getGroups on re-render', async () => {
    const mockGroups: NewsletterGroup[] = [
      {
        id: 'group1',
        name: 'Tech News',
        color: '#3b82f6',
        user_id: 'user1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        sources: [],
      },
    ];

    const getGroupsMock = vi.fn().mockResolvedValue(mockGroups);
    mockSearchService.mockReturnValue({
      getGroups: getGroupsMock,
      formatSearchError: vi.fn().mockReturnValue('Error message'),
    } as any);

    const { result, rerender } = renderHook(() => useNewsletterGroups());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Re-render the hook
    rerender();

    // Should not call getGroups again
    expect(getGroupsMock).toHaveBeenCalledTimes(1);
  });
});
