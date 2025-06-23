import { NewsletterWithRelations } from '@common/types';
import { vi } from 'vitest';

// Create hoisted mocks using IIFE pattern
const {
  createMockNewsletter,
  createQueryBuilder,
  mockUser,
} = vi.hoisted(() => {
  const createMockNewsletter = (overrides: Partial<NewsletterWithRelations> = {}): NewsletterWithRelations => ({
    id: 'newsletter-1',
    title: 'Test Newsletter',
    summary: 'Test summary',
    content: 'Test content',
    image_url: 'https://example.com/image.jpg',
    is_read: false,
    is_liked: false,
    is_archived: false,
    received_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    estimated_read_time: 5,
    word_count: 100,
    source: {
      id: 'source-1',
      name: 'Test Source',
      from: 'test@example.com',
      user_id: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    tags: [],
    newsletter_source_id: 'source-1',
    user_id: 'user-1',
    ...overrides,
  });

  const createQueryBuilder = () => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: { name: 'Test User' },
    app_metadata: { provider: 'email' },
    created_at: new Date().toISOString(),
  };
  return { createMockNewsletter, createQueryBuilder, mockUser };
});

vi.mock('../supabaseClient', () => {
  const queryBuilder = createQueryBuilder();
  const fromSpy = vi.fn().mockReturnValue(queryBuilder);
  const mockSupabase = {
    from: fromSpy,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: { user: vi.fn().mockReturnValue(mockUser) },
  };
  return {
    supabase: mockSupabase,
    requireAuth: vi.fn().mockResolvedValue(mockUser),
    handleSupabaseError: vi.fn((error) => { throw new Error(error.message); }),
    withPerformanceLogging: vi.fn((name, fn) => fn()),
    fromSpy,
  };
});

import { newsletterApi } from '../newsletterApi';
import * as supabaseClient from '../supabaseClient';

const { fromSpy, requireAuth } = vi.mocked(supabaseClient);

describe('newsletterApi', () => {
  const now = new Date().toISOString();
  let currentQueryBuilder: ReturnType<typeof createQueryBuilder>;
  let currentMockNewsletter: NewsletterWithRelations;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
    currentQueryBuilder = createQueryBuilder();
    currentMockNewsletter = createMockNewsletter();
    fromSpy.mockClear().mockReset().mockReturnValue(currentQueryBuilder);
    requireAuth.mockClear().mockResolvedValue(mockUser);
  });

  afterEach(() => { vi.useRealTimers(); });

  // ... (getAll, getById, create tests remain the same as the last working version) ...
  describe('getAll', () => {
    it('should fetch all newsletters with default params', async () => {
      const testData = [currentMockNewsletter];
      const mockResponse = {
        data: testData,
        count: testData.length,
        error: null,
      };
      currentQueryBuilder.order.mockResolvedValueOnce(mockResponse);
      const result = await newsletterApi.getAll();
      expect(supabaseClient.supabase.from).toHaveBeenCalledWith('newsletters');
      expect(currentQueryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(currentQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(currentQueryBuilder.order).toHaveBeenCalledWith('received_at', { ascending: false });
      expect(result).toEqual({
        data: testData,
        count: testData.length,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      });
    });

    it('should handle pagination parameters', async () => {
      const pageItems = Array(5).fill(null).map((_, i) => createMockNewsletter({ id: `nl-page-${i + 1}` }));
      const mockResponse = { data: pageItems, count: 15, error: null };
      currentQueryBuilder.range.mockResolvedValueOnce(mockResponse);
      const result = await newsletterApi.getAll({ limit: 5, offset: 5 });
      expect(currentQueryBuilder.limit).toHaveBeenCalledWith(5);
      expect(currentQueryBuilder.range).toHaveBeenCalledWith(5, 9);
      expect(result.data.length).toBe(5);
      result.data.forEach(item => {
        expect(item).toEqual(expect.objectContaining({ id: expect.stringContaining('nl-page-')}));
      });
      expect(result.count).toBe(15);
      expect(result.limit).toBe(5);
      expect(result.page).toBe(2);
      expect(result.hasMore).toBe(true);
      expect(result.nextPage).toBe(3);
      expect(result.prevPage).toBe(1);
    });

    it('should apply boolean filters like isRead and isArchived', async () => {
      currentQueryBuilder.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
      await newsletterApi.getAll({ isRead: true, isArchived: false });
      expect(currentQueryBuilder.eq).toHaveBeenCalledWith('is_read', true);
      expect(currentQueryBuilder.eq).toHaveBeenCalledWith('is_archived', false);
    });

    it('should apply sourceIds filter', async () => {
      currentQueryBuilder.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
      await newsletterApi.getAll({ sourceIds: ['src-1', 'src-2'] });
      expect(currentQueryBuilder.in).toHaveBeenCalledWith('newsletter_source_id', ['src-1', 'src-2']);
    });

    it('should apply single sourceId filter with eq', async () => {
      currentQueryBuilder.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
      await newsletterApi.getAll({ sourceIds: ['src-1'] });
      expect(currentQueryBuilder.eq).toHaveBeenCalledWith('newsletter_source_id', 'src-1');
      expect(currentQueryBuilder.in).not.toHaveBeenCalled();
    });

    it('should apply date filters', async () => {
      currentQueryBuilder.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
      const dateFrom = '2023-01-01T00:00:00Z';
      const dateTo = '2023-01-31T23:59:59Z';
      await newsletterApi.getAll({ dateFrom, dateTo });
      expect(currentQueryBuilder.gte).toHaveBeenCalledWith('received_at', dateFrom);
      expect(currentQueryBuilder.lte).toHaveBeenCalledWith('received_at', dateTo);
    });

    it('should apply orderBy and ascending filters', async () => {
      currentQueryBuilder.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
      await newsletterApi.getAll({ orderBy: 'title', ascending: true });
      expect(currentQueryBuilder.order).toHaveBeenCalledWith('title', { ascending: true });
    });

    it('should include relations when specified', async () => {
      currentQueryBuilder.order.mockResolvedValueOnce({ data: [], count: 0, error: null });
      await newsletterApi.getAll({ includeSource: true, includeTags: true });
      expect(currentQueryBuilder.select).toHaveBeenCalledWith(
        "*, source:newsletter_sources(*), tags:newsletter_tags(tag:tags(*))",
        { count: "exact" }
      );
    });

    it('should filter by tagIds post-query', async () => {
      const tag1Raw = { tag: { id: 'tag1', name: 'Tag 1', color: 'red', user_id: 'user-1', created_at: now }};
      const tag2Raw = { tag: { id: 'tag2', name: 'Tag 2', color: 'blue', user_id: 'user-1', created_at: now }};
      const rawNewsletter1 = { ...createMockNewsletter({ id: 'nl1' }), tags: [tag1Raw] };
      const rawNewsletter2 = { ...createMockNewsletter({ id: 'nl2' }), tags: [tag2Raw] };
      const rawNewsletter3 = { ...createMockNewsletter({ id: 'nl3' }), tags: [tag1Raw, tag2Raw] };
      const allRawNewsletters = [rawNewsletter1, rawNewsletter2, rawNewsletter3];
      currentQueryBuilder.order.mockResolvedValueOnce({ data: allRawNewsletters, count: 3, error: null });

      const result = await newsletterApi.getAll({ tagIds: ['tag1'] });
      expect(result.data.length).toBe(2);
      expect(result.data.map(n => n.id)).toEqual(expect.arrayContaining(['nl1', 'nl3']));

      fromSpy.mockClear().mockReturnValue(currentQueryBuilder);
      currentQueryBuilder.order.mockResolvedValueOnce({ data: allRawNewsletters, count: 3, error: null });
      const result2 = await newsletterApi.getAll({ tagIds: ['tag1', 'tag2'] });
      expect(result2.data.length).toBe(1);
      expect(result2.data.map(n => n.id)).toEqual(expect.arrayContaining(['nl3']));
    });

    it('should handle errors during getAll query', async () => {
      const mockError = new Error('DB Query Failed');
      currentQueryBuilder.order.mockResolvedValueOnce({ data: null, count: 0, error: mockError });
      await expect(newsletterApi.getAll()).rejects.toThrow(mockError.message);
      expect(supabaseClient.handleSupabaseError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getById', () => {
    it('should fetch newsletter by id with relations by default', async () => {
      currentQueryBuilder.single.mockResolvedValueOnce({ data: currentMockNewsletter, error: null });
      const result = await newsletterApi.getById('newsletter-1');
      expect(currentQueryBuilder.select).toHaveBeenCalledWith(expect.stringContaining('source:newsletter_sources(*)'));
      expect(result).toEqual(currentMockNewsletter);
    });

    it('should fetch newsletter by id without relations when specified', async () => {
      const mockNewsletterData = { ...currentMockNewsletter, source: undefined, tags: undefined };
      currentQueryBuilder.single.mockResolvedValueOnce({ data: mockNewsletterData, error: null });
      const result = await newsletterApi.getById('newsletter-1', false);
      expect(currentQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(result).toEqual(expect.objectContaining({ id: 'newsletter-1', source: null, tags: [] }));
    });

    it('should return null when newsletter not found', async () => {
      currentQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } as any});
      const result = await newsletterApi.getById('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new newsletter', async () => {
      const newNewsletter = { title: 'New Newsletter', content: 'New content'};
      const createdNewsletter = createMockNewsletter({...newNewsletter, id: 'new-id'});
      currentQueryBuilder.insert.mockReturnValueOnce({ select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: createdNewsletter, error: null }) });
      fromSpy.mockImplementationOnce(() => currentQueryBuilder); // For getById after create
      currentQueryBuilder.single.mockResolvedValueOnce({ data: createdNewsletter, error: null }); // For getById

      const result = await newsletterApi.create(newNewsletter as any);
      expect(currentQueryBuilder.insert).toHaveBeenCalledWith(expect.objectContaining(newNewsletter));
      expect(result).toEqual(createdNewsletter);
    });

    it('should create newsletter with tags', async () => {
      const newNewsletter = { title: 'New', tag_ids: ['tag-1'] };
      const createdNlData = createMockNewsletter({ id: 'new-id', title: 'New'});

      // Mock for first from (newsletter insert)
      const nlInsertSingleMock = vi.fn().mockResolvedValue({ data: createdNlData, error: null });
      const nlInsertSelectMock = vi.fn().mockReturnValue({ single: nlInsertSingleMock });
      const nlInsertMock = vi.fn().mockReturnValue({ select: nlInsertSelectMock });
      fromSpy.mockImplementationOnce(() => ({ insert: nlInsertMock }));

      // Mock for second from (tag insert)
      const tagInsertMock = vi.fn().mockResolvedValue({ error: null });
      fromSpy.mockImplementationOnce(() => ({ insert: tagInsertMock }));

      // Mock for third from (final getById)
      const finalGetByIdSingleMock = vi.fn().mockResolvedValue({data: {...createdNlData, tags: [{tag: {id: 'tag-1'}} as any]}, error: null});
      const finalGetByIdSelectMock = vi.fn().mockReturnThis(); // not used directly, but part of builder
      const finalGetByIdEqMock = vi.fn().mockReturnThis();
      fromSpy.mockImplementationOnce(() => ({ select: finalGetByIdSelectMock, eq: finalGetByIdEqMock, single: finalGetByIdSingleMock }));


      const result = await newsletterApi.create(newNewsletter as any);
      expect(nlInsertMock).toHaveBeenCalledWith(expect.objectContaining({title: 'New'}));
      expect(tagInsertMock).toHaveBeenCalledWith([{newsletter_id: 'new-id', tag_id: 'tag-1'}]);
      expect(result.tags.length).toBe(1);
    });

    it('should handle error during newsletter insertion in create', async () => {
      const newNewsletter = { title: 'Test' };
      const mockError = new Error('Insert failed');
      currentQueryBuilder.insert.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      });
      await expect(newsletterApi.create(newNewsletter as any)).rejects.toThrow(mockError.message);
    });

    it('should handle error during tag association in create', async () => {
      const newNewsletter = { title: 'Test', tag_ids: ['tag1'] };
      const createdNlData = createMockNewsletter({ id: 'new-id' });
      const mockError = new Error('Tag association failed');

      fromSpy.mockImplementationOnce(() => ({ // For newsletter insert (success)
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: createdNlData, error: null })
          }))
        }))
      }));
      fromSpy.mockImplementationOnce(() => ({ // For tag insert (fail)
        insert: vi.fn().mockResolvedValue({ error: mockError })
      }));

      await expect(newsletterApi.create(newNewsletter as any)).rejects.toThrow(mockError.message);
    });
  });

  describe('update', () => {
    const setupUpdateMocks = (
      initialNlData: any,
      mainUpdateResult: { data?: any, error?: any },
      deleteTagsResult?: { error?: any },
      insertTagsResult?: { error?: any },
      finalGetByIdData?: any
    ) => {
      // 1. Initial getById in update()
      fromSpy.mockImplementationOnce(() => {
        currentQueryBuilder.single.mockClear().mockResolvedValueOnce({ data: initialNlData, error: null });
        return currentQueryBuilder;
      });

      // 2. Main update call for 'newsletters' table
      const mainUpdateSingleMock = vi.fn().mockResolvedValue(mainUpdateResult);
      const mainUpdateSelectMock = vi.fn(() => ({ single: mainUpdateSingleMock }));
      const mainUpdateEqUserMock = vi.fn(() => ({ select: mainUpdateSelectMock }));
      const mainUpdateEqIdMock = vi.fn(() => ({ eq: mainUpdateEqUserMock }));
      const mainUpdateMock = vi.fn(() => ({ eq: mainUpdateEqIdMock }));
      fromSpy.mockImplementationOnce(() => ({ update: mainUpdateMock }));

      // 3. Delete existing tags (if tag_ids are part of update)
      if (deleteTagsResult !== undefined) {
        const deleteEqUserMock = vi.fn().mockResolvedValue(deleteTagsResult);
        const deleteEqNewsletterMock = vi.fn(() => ({ eq: deleteEqUserMock }));
        const deleteTagsMockFn = vi.fn(() => ({ eq: deleteEqNewsletterMock }));
        fromSpy.mockImplementationOnce(() => ({ delete: deleteTagsMockFn }));
      }

      // 4. Insert new tags (if tag_ids are part of update and > 0)
      if (insertTagsResult !== undefined) {
        const insertNewTagsMock = vi.fn().mockResolvedValue(insertTagsResult);
        fromSpy.mockImplementationOnce(() => ({ insert: insertNewTagsMock }));
      }

      // 5. Final getById in update()
      if (finalGetByIdData !== undefined) {
        fromSpy.mockImplementationOnce(() => {
          currentQueryBuilder.single.mockClear().mockResolvedValueOnce({ data: finalGetByIdData, error: null });
          return currentQueryBuilder;
        });
      }
    };

    it('should update an existing newsletter (no tag changes)', async () => {
      const updates = { title: 'Updated Title' };
      const initialNl = createMockNewsletter({ id: 'newsletter-1' });
      const updatedNlData = { ...initialNl, ...updates, updated_at: now };
      setupUpdateMocks(initialNl, {data: updatedNlData}, undefined, undefined, updatedNlData);

      const result = await newsletterApi.update({ id: 'newsletter-1', ...updates });
      expect(result.title).toBe('Updated Title');
    });

    it('should update newsletter tags (remove all, then add new)', async () => {
      const newsletterId = 'newsletter-1';
      const initialNl = createMockNewsletter({ id: newsletterId, tags: [{tag: {id: 'old-tag'}} as any]});
      const updates = { tag_ids: ['new-tag1', 'new-tag2'] };
      const finalNlDataWithNewTags = {
        ...initialNl,
        updated_at: now,
        tags: updates.tag_ids.map(tid => ({ tag: { id: tid, name: `Tag ${tid}`} }))
      };

      setupUpdateMocks(initialNl, {data: {...initialNl, ...updates, updated_at:now}}, {error: null}, {error: null}, finalNlDataWithNewTags);

      const result = await newsletterApi.update({ id: newsletterId, ...updates });
      expect(result.tags.length).toBe(2);
      expect(result.tags.map(t => t.id)).toEqual(expect.arrayContaining(['new-tag1', 'new-tag2']));
    });

    it('should throw error if newsletter not found during update', async () => {
      fromSpy.mockImplementationOnce(() => { // For initial getById
        currentQueryBuilder.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } as any });
        return currentQueryBuilder;
      });
      await expect(newsletterApi.update({ id: 'nonexistent-id', title: 'Attempt Update' }))
        .rejects.toThrow('Newsletter not found or you do not have permission to update it');
    });

    it('should handle error during main newsletter update query', async () => {
      const mockError = new Error('DB Update Failed');
      setupUpdateMocks(currentMockNewsletter, {data: null, error: mockError});
      await expect(newsletterApi.update({id: 'newsletter-1', title: 'Fail Update'}))
        .rejects.toThrow(mockError.message);
    });

    it('should handle error during tag deletion in update', async () => {
      const mockError = new Error('Tag Deletion Failed');
      const initialNl = createMockNewsletter({ id: 'newsletter-1' });
      setupUpdateMocks(initialNl, {data: {...initialNl, updated_at: now}}, {error: mockError});
      await expect(newsletterApi.update({id: 'newsletter-1', tag_ids: []}))
        .rejects.toThrow(`Tag update failed: Failed to remove existing tags: ${mockError.message}`);
    });

    it('should handle error during new tag insertion in update', async () => {
      const mockError = new Error('New Tag Insertion Failed');
      const initialNl = createMockNewsletter({ id: 'newsletter-1' });
      setupUpdateMocks(initialNl, {data: {...initialNl, updated_at: now}}, {error: null}, {error: mockError});
      await expect(newsletterApi.update({id: 'newsletter-1', tag_ids: ['new-tag']}))
        .rejects.toThrow(`Tag update failed: Failed to add new tags: ${mockError.message}`);
    });
  });

  // ... (delete, markAsRead, toggleArchive, getStats, bulkUpdate, search tests remain the same) ...
  describe('delete', () => {
    it('should delete a newsletter successfully', async () => {
      const id = '11111111-1111-1111-1111-111111111111';
      const qb1 = createQueryBuilder();
      const qb2 = createQueryBuilder();
      const qb3 = createQueryBuilder();
      fromSpy.mockReset().mockReturnValueOnce(qb1).mockReturnValueOnce(qb2).mockReturnValueOnce(qb3);
      qb1.maybeSingle.mockResolvedValueOnce({ data: { id, user_id: 'user-1' }, error: null });
      qb2.delete.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
      qb3.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const result = await newsletterApi.delete(id);
      expect(result).toBe(true);
    });

    it('should return false when newsletter not found', async () => {
      fromSpy.mockReset().mockReturnValue(currentQueryBuilder);
      currentQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const result = await newsletterApi.delete('nonexistent-id');
      expect(result).toBe(false);
    });

    it('should return false when newsletter belongs to different user', async () => {
      fromSpy.mockReset().mockReturnValue(currentQueryBuilder);
      currentQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: 'newsletter-1', user_id: 'different-user' }, error: null });
      const result = await newsletterApi.delete('newsletter-1');
      expect(result).toBe(false);
    });
  });

  describe('markAsRead', () => {
    it('should mark a newsletter as read', async () => {
      const updatedNl = { ...currentMockNewsletter, is_read: true, updated_at: now };
      // Setup for initial getById in update
      fromSpy.mockImplementationOnce(() => {
        currentQueryBuilder.single.mockClear().mockResolvedValueOnce({ data: currentMockNewsletter, error: null });
        return currentQueryBuilder;
      });
      // Setup for main update
      const mainUpdateSingleMock = vi.fn().mockResolvedValue({ data: updatedNl, error: null });
      fromSpy.mockImplementationOnce(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: mainUpdateSingleMock
              }))
            }))
          }))
        }))
      }));
      // Setup for final getById in update
      fromSpy.mockImplementationOnce(() => {
        currentQueryBuilder.single.mockClear().mockResolvedValueOnce({ data: updatedNl, error: null });
        return currentQueryBuilder;
      });

      const result = await newsletterApi.markAsRead('newsletter-1');
      expect(mainUpdateSingleMock).toHaveBeenCalled(); // Check if the update's single was called
      expect(result.is_read).toBe(true);
    });
  });

  describe('toggleArchive', () => {
    it('should toggle archive status', async () => {
      const initialNl = { ...currentMockNewsletter, is_archived: false };
      const archivedNl = { ...currentMockNewsletter, is_archived: true, updated_at: now };

      // 1. getById in toggleArchive
      fromSpy.mockImplementationOnce(() => {
        currentQueryBuilder.single.mockClear().mockResolvedValueOnce({ data: initialNl, error: null });
        return currentQueryBuilder;
      });
      // 2. getById in update
      fromSpy.mockImplementationOnce(() => {
        currentQueryBuilder.single.mockClear().mockResolvedValueOnce({ data: initialNl, error: null });
        return currentQueryBuilder;
      });
      // 3. Main update
      const mainUpdateSingleMock = vi.fn().mockResolvedValue({ data: archivedNl, error: null });
      fromSpy.mockImplementationOnce(() => ({ update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ select: vi.fn(() => ({ single: mainUpdateSingleMock }))}))}))}))}));
      // 4. Final getById in update
      fromSpy.mockImplementationOnce(() => {
        currentQueryBuilder.single.mockClear().mockResolvedValueOnce({ data: archivedNl, error: null });
        return currentQueryBuilder;
      });

      const result = await newsletterApi.toggleArchive('newsletter-1');
      expect(result.is_archived).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return newsletter statistics', async () => {
      const mockNlData = [ { is_read: true, is_archived: false, is_liked: true }];
      const eqMock = vi.fn().mockResolvedValue({ data: mockNlData, error: null });
      currentQueryBuilder.select.mockReturnValue({ eq: eqMock });
      const result = await newsletterApi.getStats();
      expect(result.total).toBe(1);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple newsletters', async () => {
      const ids = ['n1', 'n2'];
      const updates = { is_read: true };
      const updatedNls = ids.map(id => createMockNewsletter({ id, is_read: true, updated_at: now }));
      currentQueryBuilder.update.mockReturnValue({
        in: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: updatedNls, error: null })
      });
      const result = await newsletterApi.bulkUpdate({ ids, updates });
      expect(result.successCount).toBe(2);
    });
  });

  describe('search', () => {
    it('should search newsletters by query', async () => {
      const testData = [currentMockNewsletter];
      currentQueryBuilder.order.mockResolvedValueOnce({ data: testData, count: 1, error: null });
      const result = await newsletterApi.search('test query');
      expect(currentQueryBuilder.or).toHaveBeenCalledWith(expect.stringContaining('test query'));
      expect(result.data).toEqual(testData);
    });
  });
});
