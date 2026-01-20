import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsletterGroup } from '../../types';
import { newsletterGroupApi } from '../newsletterGroupApi';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient');

const mockSupabase = vi.mocked(supabase);

describe('newsletterGroupApi', () => {
  const mockUser = { id: 'user-123' };

  const mockNewsletterGroup: NewsletterGroup = {
    id: 'group-1',
    name: 'Tech',
    color: '#3b82f6',
    user_id: 'user-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    sources: [],
  };

  const createMockQueryBuilder = () => {
    const b: Record<string, ReturnType<typeof vi.fn>> = {
      select: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      single: vi.fn(),
      then: vi.fn(),
      ilike: vi.fn(),
    };
    Object.keys(b).forEach((k) => {
      if (k !== 'single' && k !== 'then') (b[k] as ReturnType<typeof vi.fn>).mockReturnValue(b);
    });
    (b as { then: (r: (v: unknown) => void, rej?: (e: unknown) => void) => Promise<unknown> }).then = vi.fn((resolve) =>
      Promise.resolve({ data: [], error: null }).then(resolve as (v: unknown) => void)
    );
    return b;
  };

  let qb: ReturnType<typeof createMockQueryBuilder>;

  beforeEach(() => {
    vi.clearAllMocks();
    qb = createMockQueryBuilder();
    mockSupabase.auth = { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) } as any;
    mockSupabase.from = vi.fn().mockReturnValue(qb);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAll', () => {
    it('fetches all newsletter groups', async () => {
      (qb.then as ReturnType<typeof vi.fn>).mockImplementation((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [mockNewsletterGroup], error: null }).then(resolve)
      );

      const result = await newsletterGroupApi.getAll();

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_source_groups');
      expect(qb.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result).toEqual([mockNewsletterGroup]);
    });

    it('handles database errors', async () => {
      (qb.then as ReturnType<typeof vi.fn>).mockImplementation((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: { message: 'DB error', code: '42P01' } }).then(resolve)
      );

      await expect(newsletterGroupApi.getAll()).rejects.toThrow();
    });
  });

  describe('getById', () => {
    it('returns group when found', async () => {
      qb.single.mockResolvedValue({ data: mockNewsletterGroup, error: null });

      const result = await newsletterGroupApi.getById('group-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_source_groups');
      expect(qb.eq).toHaveBeenCalledWith('id', 'group-1');
      expect(qb.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result).toEqual(mockNewsletterGroup);
    });

    it('returns null when not found', async () => {
      qb.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await newsletterGroupApi.getById('missing');

      expect(result).toBeNull();
    });

    it('throws on other errors', async () => {
      qb.single.mockResolvedValue({ data: null, error: { message: 'Other', code: 'X' } });

      await expect(newsletterGroupApi.getById('group-1')).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('creates a group', async () => {
      qb.single.mockResolvedValue({
        data: { id: 'new-id', name: 'New', color: '#3b82f6', user_id: mockUser.id },
        error: null,
      });
      vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue({ ...mockNewsletterGroup, id: 'new-id', name: 'New' });

      const result = await newsletterGroupApi.create({ name: 'New', sourceIds: [] });

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_source_groups');
      expect(qb.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'New', user_id: mockUser.id }));
      expect(result.name).toBe('New');
    });

    it('creates with sourceIds', async () => {
      let fromCalls = 0;
      mockSupabase.from = vi.fn().mockImplementation((t: string) => {
        fromCalls++;
        if (fromCalls === 1) {
          // first call inserts the group
          return qb;
        }
        if (t === 'newsletter_sources') {
          // ownership validation should return the provided source IDs
          const m = createMockQueryBuilder();
          (m.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
            Promise.resolve({ data: [{ id: 's1' }, { id: 's2' }], error: null }).then(r)
          );
          return m;
        }
        // default for membership insert
        const m = createMockQueryBuilder();
        (m.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
          Promise.resolve({ data: null, error: null }).then(r)
        );
        return m;
      });
      qb.single.mockResolvedValue({
        data: { id: 'new-id', name: 'G', color: '#3b82f6', user_id: mockUser.id },
        error: null,
      });
      vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue(mockNewsletterGroup);

      await newsletterGroupApi.create({ name: 'G', sourceIds: ['s1', 's2'] });

      expect(mockSupabase.from).toHaveBeenCalledWith('newsletter_source_group_members');
    });
  });

  describe('update', () => {
    it('updates group', async () => {
      qb.single = vi.fn();
      let fromCalls = 0;
      mockSupabase.from = vi.fn().mockImplementation((t: string) => {
        fromCalls++;
        if (t === 'newsletter_source_groups') return qb;
        return createMockQueryBuilder();
      });
      (qb.single as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ...mockNewsletterGroup, name: 'Updated' }, error: null });
      vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue({ ...mockNewsletterGroup, name: 'Updated' });

      const result = await newsletterGroupApi.update({ id: 'group-1', name: 'Updated' });

      expect(qb.update).toHaveBeenCalledWith({ name: 'Updated' });
      expect(qb.eq).toHaveBeenCalledWith('id', 'group-1');
      expect(result.name).toBe('Updated');
    });
  });

  describe('delete', () => {
    it('deletes group', async () => {
      (qb.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(r)
      );

      const result = await newsletterGroupApi.delete('group-1');

      expect(qb.delete).toHaveBeenCalled();
      expect(qb.eq).toHaveBeenCalledWith('id', 'group-1');
      expect(qb.eq).toHaveBeenCalledWith('user_id', mockUser.id);
      expect(result).toBe(true);
    });
  });

  describe('addSources', () => {
    it('adds sources to group', async () => {
      vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue(mockNewsletterGroup);
      (qb.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
        Promise.resolve({ data: [{ source: { id: 's1' } }], error: null }).then(r)
      );

      const result = await newsletterGroupApi.addSources({ groupId: 'group-1', sourceIds: ['s1'] });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });

    it('returns [] for empty sourceIds', async () => {
      const result = await newsletterGroupApi.addSources({ groupId: 'g', sourceIds: [] });
      expect(result).toEqual([]);
    });

    it('throws when group not found', async () => {
      vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue(null);

      await expect(
        newsletterGroupApi.addSources({ groupId: 'missing', sourceIds: ['s1'] })
      ).rejects.toThrow('Group not found');
    });
  });

  describe('removeSources', () => {
    it('removes sources from group', async () => {
      vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue(mockNewsletterGroup);
      (qb.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(r)
      );

      const result = await newsletterGroupApi.removeSources({ groupId: 'group-1', sourceIds: ['s1'] });

      expect(result).toBe(true);
    });

    it('returns true for empty sourceIds', async () => {
      const result = await newsletterGroupApi.removeSources({ groupId: 'g', sourceIds: [] });
      expect(result).toBe(true);
    });
  });

  describe('getGroupSources', () => {
    it('returns sources in group', async () => {
      vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue(mockNewsletterGroup);
      (qb.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
        Promise.resolve({ data: [{ source: { id: 's1' } }], error: null }).then(r)
      );

      const result = await newsletterGroupApi.getGroupSources('group-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });
  });

  describe('getSourceGroups', () => {
    it('returns groups for source', async () => {
      (qb.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
        Promise.resolve({ data: [{ group: { ...mockNewsletterGroup, sources: [] } }], error: null }).then(r)
      );

      const result = await newsletterGroupApi.getSourceGroups('s1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('group-1');
    });
  });

  describe('updateSourceGroups', () => {
    it('updates groups for source', async () => {
      let fromCalls = 0;
      mockSupabase.from = vi.fn().mockImplementation((t: string) => {
        fromCalls++;
        const m = createMockQueryBuilder();
        if (t === 'newsletter_source_group_members' && fromCalls <= 2) {
          (m.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
            Promise.resolve({ data: fromCalls === 1 ? [] : null, error: null }).then(r)
          );
        } else {
          (m.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
            Promise.resolve({ data: [{ group: { ...mockNewsletterGroup, sources: [] } }], error: null }).then(r)
          );
        }
        return m;
      });
      vi.spyOn(newsletterGroupApi, 'getSourceGroups').mockResolvedValue([mockNewsletterGroup]);

      const result = await newsletterGroupApi.updateSourceGroups('s1', ['group-1']);

      expect(result).toHaveLength(1);
    });
  });

  describe('getStats', () => {
    it('returns stats', async () => {
      vi.spyOn(newsletterGroupApi, 'getAll').mockResolvedValue([
        { ...mockNewsletterGroup, sources: [{ id: 's1' } as any, { id: 's2' } as any] },
        { ...mockNewsletterGroup, id: 'g2', sources: [] },
      ]);

      const result = await newsletterGroupApi.getStats();

      expect(result.totalGroups).toBe(2);
      expect(result.totalSources).toBe(2);
      expect(result.averageSourcesPerGroup).toBe(1);
      expect(result.groupsWithoutSources).toBe(1);
    });
  });

  describe('search', () => {
    it('searches by name', async () => {
      (qb.then as ReturnType<typeof vi.fn>).mockImplementation((r: (v: unknown) => void) =>
        Promise.resolve({ data: [mockNewsletterGroup], error: null }).then(r)
      );

      const result = await newsletterGroupApi.search('tech');

      expect(qb.ilike).toHaveBeenCalledWith('name', '%tech%');
      expect(result).toHaveLength(1);
    });
  });
});
