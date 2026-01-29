import { SearchService } from '../searchService';
import { NewsletterGroup } from '@common/types';

// Mock dependencies
const mockNewsletterGroupService = {
  getGroups: jest.fn(),
};

const mockLogger = {
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

const mockDeps = {
  getAllNewsletterSources: jest.fn(),
  updateNewsletter: jest.fn(),
  newsletterService: {} as any,
  newsletterGroupService: mockNewsletterGroupService,
  logger: mockLogger,
  window: {} as any,
  buildSearchParams: jest.fn(),
  validateSearchFilters: jest.fn(),
};

describe('SearchService - Group Methods', () => {
  let searchService: SearchService;

  beforeEach(() => {
    jest.clearAllMocks();
    searchService = new SearchService(mockDeps);
  });

  describe('getGroups', () => {
    it('should return groups successfully', async () => {
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

      mockNewsletterGroupService.getGroups.mockResolvedValue(mockGroups);

      const result = await searchService.getGroups();

      expect(result).toEqual(mockGroups);
      expect(mockNewsletterGroupService.getGroups).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle errors when getting groups', async () => {
      const error = new Error('Failed to load groups');
      mockNewsletterGroupService.getGroups.mockRejectedValue(error);

      await expect(searchService.getGroups()).rejects.toThrow('Failed to load newsletter groups');

      expect(mockNewsletterGroupService.getGroups).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to load newsletter groups',
        {
          action: 'get_groups',
          metadata: {},
        },
        error
      );
    });

    it('should handle empty groups array', async () => {
      mockNewsletterGroupService.getGroups.mockResolvedValue([]);

      const result = await searchService.getGroups();

      expect(result).toEqual([]);
      expect(mockNewsletterGroupService.getGroups).toHaveBeenCalledTimes(1);
    });

    it('should handle service returning null/undefined', async () => {
      mockNewsletterGroupService.getGroups.mockResolvedValue(null as any);

      const result = await searchService.getGroups();

      expect(result).toBeNull();
      expect(mockNewsletterGroupService.getGroups).toHaveBeenCalledTimes(1);
    });
  });

  describe('createDefaultFilters', () => {
    it('should create default filters with empty selectedGroups', () => {
      const filters = searchService.createDefaultFilters();

      expect(filters.selectedGroups).toEqual([]);
      expect(filters.selectedSources).toEqual([]);
      expect(filters.readStatus).toBe('all');
      expect(filters.archivedStatus).toBe('active');
      expect(filters.dateFrom).toBe('');
      expect(filters.dateTo).toBe('');
    });
  });

  describe('hasFiltersApplied', () => {
    it('should return true when groups are selected', () => {
      const filters = {
        selectedSources: [],
        selectedGroups: ['group1', 'group2'],
        readStatus: 'all' as const,
        archivedStatus: 'active' as const,
        dateFrom: '',
        dateTo: '',
      };

      expect(searchService.hasFiltersApplied(filters)).toBe(true);
    });

    it('should return false when no filters are applied', () => {
      const filters = searchService.createDefaultFilters();

      expect(searchService.hasFiltersApplied(filters)).toBe(false);
    });

    it('should return true when only groups are selected', () => {
      const filters = {
        selectedSources: [],
        selectedGroups: ['group1'],
        readStatus: 'all' as const,
        archivedStatus: 'active' as const,
        dateFrom: '',
        dateTo: '',
      };

      expect(searchService.hasFiltersApplied(filters)).toBe(true);
    });
  });
});
