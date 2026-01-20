import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newsletterGroupApi } from '../newsletterGroupApi';
import { supabase } from '../supabaseClient';

vi.mock('../supabaseClient');

const GROUPS_TABLE = 'newsletter_source_groups';
const GROUP_MEMBERS_TABLE = 'newsletter_source_group_members';

const mockSupabase = vi.mocked(supabase);

const createMockQueryBuilder = () => {
  const b: any = {
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
    if (k !== 'single' && k !== 'then') (b[k] as any).mockReturnValue(b);
  });
  (b as { then: (r: (v: unknown) => void, rej?: (e: unknown) => void) => Promise<unknown> }).then = vi.fn((resolve) =>
    Promise.resolve({ data: [], error: null }).then(resolve as (v: unknown) => void)
  );
  return b;
};

describe('newsletterGroupApi ownership and limits', () => {
  const mockUser = { id: 'user-123' };
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

  it('addSources validates source ownership before inserting', async () => {
    // getById(group) succeeds
    vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue({ id: 'g1' } as any);

    // mock select from newsletter_sources
    const sourceQB = createMockQueryBuilder();
    (sourceQB.then as any).mockImplementation((resolve: any) => Promise.resolve({ data: [{ id: 's1' }], error: null }).then(resolve));

    let fromCalls: string[] = [];
    mockSupabase.from = vi.fn().mockImplementation((t: string) => {
      fromCalls.push(t);
      if (t === 'newsletter_sources') return sourceQB as any;
      return qb as any;
    });

    await newsletterGroupApi.addSources({ groupId: 'g1', sourceIds: ['s1'] });

    expect(fromCalls).toContain('newsletter_sources');
    expect(sourceQB.eq).toHaveBeenCalledWith('user_id', mockUser.id);
  });

  it('addSources handles 10-group limit database error', async () => {
    vi.spyOn(newsletterGroupApi, 'getById').mockResolvedValue({ id: 'g1' } as any);

    const sourceQB = createMockQueryBuilder();
    (sourceQB.then as any).mockImplementation((resolve: any) => Promise.resolve({ data: [{ id: 's1' }], error: null }).then(resolve));

    const insertQB = createMockQueryBuilder();
    (insertQB.then as any).mockImplementation((resolve: any) =>
      Promise.resolve({ data: null, error: { code: '23514', message: 'cannot belong to more than 10' } }).then(resolve)
    );

    mockSupabase.from = vi.fn().mockImplementation((t: string) => {
      if (t === 'newsletter_sources') return sourceQB as any;
      if (t === GROUP_MEMBERS_TABLE) return insertQB as any;
      return qb as any;
    });

    await expect(newsletterGroupApi.addSources({ groupId: 'g1', sourceIds: ['s1'] })).rejects.toThrow(
      'A source cannot belong to more than 10 groups'
    );
  });

  it('updateSourceGroups enforces client-side 10-group limit', async () => {
    const many = Array.from({ length: 11 }, (_, i) => `g-${i}`);
    await expect(newsletterGroupApi.updateSourceGroups('s1', many)).rejects.toThrow(
      'A source cannot belong to more than 10 groups'
    );
  });

  it('updateSourceGroups includes user_id on membership inserts', async () => {
    // first select current memberships returns []
    const selectQB = createMockQueryBuilder();
    (selectQB.then as any).mockImplementation((resolve: any) => Promise.resolve({ data: [], error: null }).then(resolve));

    // capture insert payload
    let capturedPayload: any;
    const insertQB = createMockQueryBuilder();
    (insertQB.insert as any).mockImplementation((payload: any) => {
      capturedPayload = payload;
      return insertQB;
    });

    mockSupabase.from = vi.fn().mockImplementation((t: string) => {
      if (t === GROUP_MEMBERS_TABLE) {
        // first call: select; second call: insert
        const callCount = (mockSupabase.from as any).mock.calls.length;
        return callCount === 0 ? (selectQB as any) : (insertQB as any);
      }
      return qb as any;
    });

    // stub getSourceGroups to finish flow
    vi.spyOn(newsletterGroupApi, 'getSourceGroups').mockResolvedValue([] as any);

    await newsletterGroupApi.updateSourceGroups('s1', ['g1']);

    expect(Array.isArray(capturedPayload)).toBe(true);
    expect(capturedPayload[0]).toEqual(expect.objectContaining({ group_id: 'g1', source_id: 's1', user_id: mockUser.id }));
  });
});
