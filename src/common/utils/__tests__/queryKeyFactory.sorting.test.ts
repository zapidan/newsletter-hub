import { queryKeyFactory } from '../queryKeyFactory';

describe('queryKeyFactory - Sorting', () => {
  describe('newsletters.infinite', () => {
    it('should include orderBy in query key', () => {
      const filter = {
        orderBy: 'title',
        orderDirection: 'asc',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          orderBy: 'title',
          orderDirection: 'asc',
        },
      ]);
    });

    it('should include orderDirection in query key', () => {
      const filter = {
        orderBy: 'received_at',
        orderDirection: 'desc',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          orderBy: 'received_at',
          orderDirection: 'desc',
        },
      ]);
    });

    it('should include both orderBy and orderDirection when both are present', () => {
      const filter = {
        search: 'test',
        isRead: false,
        orderBy: 'title',
        orderDirection: 'asc',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          search: 'test',
          isRead: false,
          orderBy: 'title',
          orderDirection: 'asc',
        },
      ]);
    });

    it('should exclude undefined orderBy from query key', () => {
      const filter = {
        orderDirection: 'asc',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          orderDirection: 'asc',
        },
      ]);
    });

    it('should exclude undefined orderDirection from query key', () => {
      const filter = {
        orderBy: 'title',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          orderBy: 'title',
        },
      ]);
    });

    it('should generate different keys for different sort orders', () => {
      const filterAsc = {
        orderBy: 'received_at',
        orderDirection: 'asc',
      };

      const filterDesc = {
        orderBy: 'received_at',
        orderDirection: 'desc',
      };

      const keyAsc = queryKeyFactory.newsletters.infinite(filterAsc);
      const keyDesc = queryKeyFactory.newsletters.infinite(filterDesc);

      expect(keyAsc).not.toEqual(keyDesc);
      expect(keyAsc[2].orderDirection).toBe('asc');
      expect(keyDesc[2].orderDirection).toBe('desc');
    });

    it('should generate different keys for different sort fields', () => {
      const filterTitle = {
        orderBy: 'title',
        orderDirection: 'desc',
      };

      const filterDate = {
        orderBy: 'received_at',
        orderDirection: 'desc',
      };

      const keyTitle = queryKeyFactory.newsletters.infinite(filterTitle);
      const keyDate = queryKeyFactory.newsletters.infinite(filterDate);

      expect(keyTitle).not.toEqual(keyDate);
      expect(keyTitle[2].orderBy).toBe('title');
      expect(keyDate[2].orderBy).toBe('received_at');
    });

    it('should generate same key for identical sort parameters', () => {
      const filter1 = {
        orderBy: 'title',
        orderDirection: 'asc',
      };

      const filter2 = {
        orderBy: 'title',
        orderDirection: 'asc',
      };

      const key1 = queryKeyFactory.newsletters.infinite(filter1);
      const key2 = queryKeyFactory.newsletters.infinite(filter2);

      expect(key1).toEqual(key2);
    });

    it('should handle empty filter object', () => {
      const filter = {};

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual(['newsletters', 'infinite']);
    });

    it('should handle filter with only non-sort parameters', () => {
      const filter = {
        search: 'test',
        isRead: false,
        tagIds: ['tag1', 'tag2'],
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          search: 'test',
          isRead: false,
          tagIds: ['tag1', 'tag2'],
        },
      ]);
    });

    it('should combine sort parameters with other filters', () => {
      const filter = {
        search: 'newsletter',
        isRead: false,
        isArchived: false,
        tagIds: ['tag1'],
        sourceIds: ['source1'],
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        orderBy: 'title',
        orderDirection: 'asc',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          search: 'newsletter',
          isRead: false,
          isArchived: false,
          tagIds: ['tag1'],
          sourceIds: ['source1'],
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          orderBy: 'title',
          orderDirection: 'asc',
        },
      ]);
    });
  });
});
