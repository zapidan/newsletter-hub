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

      const filterReadingTime = {
        orderBy: 'estimated_read_time',
        orderDirection: 'asc',
      };

      const keyTitle = queryKeyFactory.newsletters.infinite(filterTitle);
      const keyDate = queryKeyFactory.newsletters.infinite(filterDate);
      const keyReadingTime = queryKeyFactory.newsletters.infinite(filterReadingTime);

      expect(keyTitle).not.toEqual(keyDate);
      expect(keyTitle).not.toEqual(keyReadingTime);
      expect(keyDate).not.toEqual(keyReadingTime);
      expect(keyTitle[2].orderBy).toBe('title');
      expect(keyDate[2].orderBy).toBe('received_at');
      expect(keyReadingTime[2].orderBy).toBe('estimated_read_time');
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

    it('should handle reading time sorting with ascending order', () => {
      const filter = {
        orderBy: 'estimated_read_time',
        orderDirection: 'asc',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
        },
      ]);
    });

    it('should handle reading time sorting with descending order', () => {
      const filter = {
        orderBy: 'estimated_read_time',
        orderDirection: 'desc',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          orderBy: 'estimated_read_time',
          orderDirection: 'desc',
        },
      ]);
    });

    it('should generate different keys for reading time sort orders', () => {
      const filterAsc = {
        orderBy: 'estimated_read_time',
        orderDirection: 'asc',
      };

      const filterDesc = {
        orderBy: 'estimated_read_time',
        orderDirection: 'desc',
      };

      const keyAsc = queryKeyFactory.newsletters.infinite(filterAsc);
      const keyDesc = queryKeyFactory.newsletters.infinite(filterDesc);

      expect(keyAsc).not.toEqual(keyDesc);
      expect(keyAsc[2].orderDirection).toBe('asc');
      expect(keyDesc[2].orderDirection).toBe('desc');
    });

    it('should combine reading time sort with other filters', () => {
      const filter = {
        search: 'tech',
        isRead: false,
        orderBy: 'estimated_read_time',
        orderDirection: 'asc',
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          search: 'tech',
          isRead: false,
          orderBy: 'estimated_read_time',
          orderDirection: 'asc',
        },
      ]);
    });

    it('should include groupIds in query key', () => {
      const filter = {
        groupIds: ['group1', 'group2'],
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual([
        'newsletters',
        'infinite',
        {
          groupIds: ['group1', 'group2'],
        },
      ]);
    });

    it('should generate different keys for different groupIds', () => {
      const filterGroup1 = {
        groupIds: ['group1'],
      };

      const filterGroup2 = {
        groupIds: ['group2'],
      };

      const filterBoth = {
        groupIds: ['group1', 'group2'],
      };

      const keyGroup1 = queryKeyFactory.newsletters.infinite(filterGroup1);
      const keyGroup2 = queryKeyFactory.newsletters.infinite(filterGroup2);
      const keyBoth = queryKeyFactory.newsletters.infinite(filterBoth);

      expect(keyGroup1).not.toEqual(keyGroup2);
      expect(keyGroup1).not.toEqual(keyBoth);
      expect(keyGroup2).not.toEqual(keyBoth);
      expect(keyGroup1[2].groupIds).toEqual(['group1']);
      expect(keyGroup2[2].groupIds).toEqual(['group2']);
      expect(keyBoth[2].groupIds).toEqual(['group1', 'group2']);
    });

    it('should sort groupIds in query key for consistency', () => {
      const filterUnsorted = {
        groupIds: ['group2', 'group1', 'group3'],
      };

      const filterSorted = {
        groupIds: ['group1', 'group2', 'group3'],
      };

      const keyUnsorted = queryKeyFactory.newsletters.infinite(filterUnsorted);
      const keySorted = queryKeyFactory.newsletters.infinite(filterSorted);

      expect(keyUnsorted).toEqual(keySorted);
      expect(keyUnsorted[2].groupIds).toEqual(['group1', 'group2', 'group3']);
    });

    it('should combine groupIds with other filters', () => {
      const filter = {
        search: 'newsletter',
        isRead: false,
        groupIds: ['group1', 'group2'],
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
          groupIds: ['group1', 'group2'],
          orderBy: 'title',
          orderDirection: 'asc',
        },
      ]);
    });

    it('should exclude empty groupIds array from query key', () => {
      const filter = {
        groupIds: [],
      };

      const result = queryKeyFactory.newsletters.infinite(filter);

      expect(result).toEqual(['newsletters', 'infinite']);
    });
  });
});
