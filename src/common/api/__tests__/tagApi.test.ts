import { vi, describe, it, expect, beforeEach } from 'vitest';
import { tagApi } from '../tagApi';
import type { Tag, TagCreate, TagUpdate } from '../../types';

vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    single: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
  },
  handleSupabaseError: vi.fn(),
  requireAuth: vi.fn(),
  withPerformanceLogging: vi.fn((_name, fn) => fn()),
}));

let mockedSupabaseClient: {
  supabase: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    range: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
  handleSupabaseError: ReturnType<typeof vi.fn>;
  requireAuth: ReturnType<typeof vi.fn>;
  withPerformanceLogging: ReturnType<typeof vi.fn>;
};

describe('tagApi', () => {
  beforeEach(async () => {
    mockedSupabaseClient = await import('../supabaseClient');
    vi.clearAllMocks();

    const supabaseObject = mockedSupabaseClient.supabase;

    supabaseObject.from.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.select.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.insert.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.update.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.delete.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.eq.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.ilike.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.order.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.range.mockClear().mockImplementation(() => supabaseObject);
    supabaseObject.in.mockClear().mockImplementation(() => supabaseObject);

    // Default for terminal methods that usually resolve promises
    supabaseObject.single.mockClear().mockResolvedValue({ data: null, error: null });
    supabaseObject.maybeSingle.mockClear().mockResolvedValue({ data: null, error: null });

    // If a chain itself is awaited (e.g. await from(...).delete().eq(...)),
    // the last method in that chain needs to resolve.
    // Tests will override these with mockResolvedValueOnce as needed.
    // For example, if .delete() is directly awaited: supabaseObject.delete.mockResolvedValueOnce(...);
    // If .eq() is the end of an awaited chain: supabaseObject.eq.mockResolvedValueOnce(...);

    mockedSupabaseClient.handleSupabaseError.mockClear();
    mockedSupabaseClient.requireAuth.mockClear().mockResolvedValue({ id: 'test-user-id' });
    mockedSupabaseClient.withPerformanceLogging.mockClear().mockImplementation((_name, fn) => fn());
  });

  describe('getAll', () => {
    it('should fetch all tags for the current user', async () => {
      const mockTags: Tag[] = [{ id: '1', name: 'Tag 1', color: '#ff0000', user_id: 'test-user-id', created_at: new Date().toISOString() }];
      mockedSupabaseClient.supabase.order.mockResolvedValueOnce({ data: mockTags, error: null }); // order is terminal here

      const result = await tagApi.getAll();

      expect(mockedSupabaseClient.requireAuth).toHaveBeenCalledTimes(1);
      expect(mockedSupabaseClient.supabase.from).toHaveBeenCalledWith('tags');
      expect(mockedSupabaseClient.supabase.select).toHaveBeenCalledWith('*');
      expect(mockedSupabaseClient.supabase.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(mockedSupabaseClient.supabase.order).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockTags);
    });

    it('should return an empty array if no tags are found', async () => {
      mockedSupabaseClient.supabase.order.mockResolvedValueOnce({ data: null, error: null });
      const result = await tagApi.getAll();
      expect(result).toEqual([]);
    });

    it('should call handleSupabaseError on error', async () => {
      const mockError = new Error('Fetch error');
      mockedSupabaseClient.supabase.order.mockResolvedValueOnce({ data: null, error: mockError });
      await tagApi.getAll();
      expect(mockedSupabaseClient.handleSupabaseError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getById', () => {
    it('should fetch a tag by its ID for the current user', async () => {
      const mockTag: Tag = { id: '1', name: 'Tag 1', color: '#ff0000', user_id: 'test-user-id', created_at: new Date().toISOString() };
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: mockTag, error: null }); // single is terminal

      const result = await tagApi.getById('1');
      expect(mockedSupabaseClient.supabase.eq).toHaveBeenCalledWith('id', '1');
      expect(mockedSupabaseClient.supabase.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(result).toEqual(mockTag);
    });

    it('should return null if tag is not found (PGRST116 error)', async () => {
      const mockError = { code: 'PGRST116', message: 'Not found' };
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: null, error: mockError as any });
      const result = await tagApi.getById('1');
      expect(result).toBeNull();
    });

    it('should call handleSupabaseError for other errors', async () => {
      const mockError = new Error('Fetch error');
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: null, error: mockError });
      await tagApi.getById('1');
      expect(mockedSupabaseClient.handleSupabaseError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('create', () => {
    it('should create a new tag for the current user', async () => {
      const newTagData: TagCreate = { name: 'New Tag', color: '#00ff00' };
      const createdTag: Tag = { ...newTagData, id: '2', user_id: 'test-user-id', created_at: new Date().toISOString() };
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: createdTag, error: null }); // single is terminal

      const result = await tagApi.create(newTagData);
      expect(mockedSupabaseClient.supabase.insert).toHaveBeenCalledWith([{ ...newTagData, user_id: 'test-user-id' }]);
      expect(result).toEqual(createdTag);
    });

     it('should call handleSupabaseError on creation error', async () => {
      const mockError = new Error('Create error');
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: null, error: mockError });
      await tagApi.create({ name: 'New Tag', color: '#00ff00' });
      expect(mockedSupabaseClient.handleSupabaseError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('update', () => {
    it('should update an existing tag for the current user', async () => {
      const tagUpdateData: TagUpdate = { id: '1', name: 'Updated Tag', color: '#0000ff' };
      const updatedTag: Tag = { ...tagUpdateData, user_id: 'test-user-id', created_at: new Date().toISOString() } as Tag;
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: updatedTag, error: null }); // single is terminal

      const result = await tagApi.update(tagUpdateData);
      const { id, ...updates } = tagUpdateData;
      expect(mockedSupabaseClient.supabase.update).toHaveBeenCalledWith(updates);
      expect(mockedSupabaseClient.supabase.eq).toHaveBeenCalledWith('id', id);
      expect(mockedSupabaseClient.supabase.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
      expect(result).toEqual(updatedTag);
    });

    it('should call handleSupabaseError on update error', async () => {
      const mockError = new Error('Update error');
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: null, error: mockError });
      await tagApi.update({ id: '1', name: 'Updated Tag' });
      expect(mockedSupabaseClient.handleSupabaseError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('delete', () => {
    it('should delete a tag for the current user', async () => {
      // The chain is: .delete().eq().eq() -> the last .eq() is awaited and should resolve
      // First .eq() call for 'id'
      mockedSupabaseClient.supabase.eq.mockImplementationOnce(() => mockedSupabaseClient.supabase);
      // Second .eq() call for 'user_id' is terminal for this chain
      mockedSupabaseClient.supabase.eq.mockResolvedValueOnce({ error: null });

      const result = await tagApi.delete('1');
      expect(result).toBe(true);
      expect(mockedSupabaseClient.supabase.delete).toHaveBeenCalledTimes(1);
      expect(mockedSupabaseClient.supabase.eq).toHaveBeenCalledWith('id', '1');
      expect(mockedSupabaseClient.supabase.eq).toHaveBeenCalledWith('user_id', 'test-user-id');
    });

    it('should call handleSupabaseError on delete error', async () => {
      const mockError = new Error('Delete error');
      mockedSupabaseClient.supabase.eq.mockImplementationOnce(() => mockedSupabaseClient.supabase);
      mockedSupabaseClient.supabase.eq.mockResolvedValueOnce({ error: mockError });

      await tagApi.delete('1');
      expect(mockedSupabaseClient.handleSupabaseError).toHaveBeenCalledWith(mockError);
    });
  });

  describe('getTagsForNewsletter', () => {
    it('should fetch tags for a specific newsletter', async () => {
      const mockData = [ { tag: { id: 't1', name: 'Tag1' } } ];
      const expectedResult: Tag[] = [ { id: 't1', name: 'Tag1' } as Tag ];
      // .select().eq().eq() -> last eq resolves
      mockedSupabaseClient.supabase.eq.mockImplementationOnce(() => mockedSupabaseClient.supabase);
      mockedSupabaseClient.supabase.eq.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await tagApi.getTagsForNewsletter('nl-1');
      expect(mockedSupabaseClient.supabase.select).toHaveBeenCalledWith('tag:tags(*)');
      expect(result).toEqual(expectedResult);
    });
    // Other getTagsForNewsletter tests...
  });

  describe('updateNewsletterTags', () => {
    it('should add and remove tags for a newsletter as needed', async () => {
        const newsletterId = 'nl-1';
        const currentDbTags = [{ tag_id: 't1' }, { tag_id: 't2' }];
        const newTagsToSet: Tag[] = [
            { id: 't2', name: 'Tag 2', color: '', user_id: 'test-user-id', created_at: '' },
            { id: 't3', name: 'Tag 3', color: '', user_id: 'test-user-id', created_at: '' }
        ];

        // 1. Get current tags: .select().eq().eq() -> last eq resolves
        mockedSupabaseClient.supabase.eq.mockImplementationOnce(() => mockedSupabaseClient.supabase); // for newsletter_id
        mockedSupabaseClient.supabase.eq.mockResolvedValueOnce({ data: currentDbTags, error: null });   // for user_id

        // 2. Delete tags: .delete().eq().eq().in() -> in resolves
        const inMock = vi.fn().mockResolvedValueOnce({ error: null });
        const eqDel2 = vi.fn(() => ({ in: inMock }));
        const eqDel1 = vi.fn(() => ({ eq: eqDel2 }));
        mockedSupabaseClient.supabase.delete.mockImplementationOnce(() => ({ eq: eqDel1 }));

        // 3. Add tags: .insert() -> insert resolves
        mockedSupabaseClient.supabase.insert.mockResolvedValueOnce({ error: null });

        const result = await tagApi.updateNewsletterTags(newsletterId, newTagsToSet);
        expect(result).toBe(true);
        // Add more specific call order/count checks if necessary
    });
    // Other updateNewsletterTags tests...
  });

  describe('addToNewsletter', () => {
    it('should add a tag to a newsletter if not already present', async () => {
      // .select().eq().eq().eq().maybeSingle() -> maybeSingle resolves
      mockedSupabaseClient.supabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // .insert() -> insert resolves
      mockedSupabaseClient.supabase.insert.mockResolvedValueOnce({ error: null });

      const result = await tagApi.addToNewsletter('nl-1', 't1');
      expect(result).toBe(true);
      expect(mockedSupabaseClient.supabase.insert).toHaveBeenCalledWith(expect.objectContaining({ newsletter_id: 'nl-1', tag_id: 't1' }));
    });
     // Other addToNewsletter tests...
  });

  describe('removeFromNewsletter', () => {
    it('should remove a tag from a newsletter', async () => {
      // .delete().eq().eq().eq() -> last eq resolves
      mockedSupabaseClient.supabase.eq.mockImplementationOnce(() => mockedSupabaseClient.supabase);
      mockedSupabaseClient.supabase.eq.mockImplementationOnce(() => mockedSupabaseClient.supabase);
      mockedSupabaseClient.supabase.eq.mockResolvedValueOnce({ error: null });

      const result = await tagApi.removeFromNewsletter('nl-1', 't1');
      expect(result).toBe(true);
    });
    // Other removeFromNewsletter tests...
  });

  describe('getOrCreate', () => {
    it('should return existing tag if found', async () => {
      const existingTag: Tag = { id: 't1', name: 'Existing', color: '#123', user_id: 'test-user-id', created_at: '' };
      // .select().eq().eq().single() -> single resolves
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: existingTag, error: null });

      const result = await tagApi.getOrCreate('Existing');
      expect(result).toEqual(existingTag);
      expect(mockedSupabaseClient.supabase.insert).not.toHaveBeenCalled();
    });

    it('should create a new tag if not found, with specified color', async () => {
      const newTagName = 'New Tag';
      const newTagColor = '#abc';
      const createdTag: Tag = { id: 't2', name: newTagName, color: newTagColor, user_id: 'test-user-id', created_at: '' };

      // For find existing: .select().eq().eq().single() -> returns null
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: null, error: null });
      // For create: .insert().select().single() -> returns createdTag
      mockedSupabaseClient.supabase.single.mockResolvedValueOnce({ data: createdTag, error: null });

      const result = await tagApi.getOrCreate(newTagName, newTagColor);
      expect(result).toEqual(createdTag);
      expect(mockedSupabaseClient.supabase.insert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ name: newTagName })]));
    });
    // Other getOrCreate tests...
  });

  describe('bulkCreate', () => {
    it('should bulk create tags for the current user', async () => {
      const newTagsData: TagCreate[] = [{ name: 'Bulk Tag 1', color: '#b01' }];
      const createdTags: Tag[] = [{ ...newTagsData[0], id: 'b1', user_id: 'test-user-id', created_at: '' }];
      // .insert(...).select() -> select resolves
      mockedSupabaseClient.supabase.select.mockResolvedValueOnce({ data: createdTags, error: null });

      const result = await tagApi.bulkCreate(newTagsData);
      expect(result).toEqual(createdTags);
    });
    // Other bulkCreate tests...
  });

  describe('getTagUsageStats', () => {
    it('should fetch tag usage stats', async () => {
      const mockData = [{ id: 't1', name: 'Tag1', newsletter_tags: [{},{}] }];
      const expected = [{ id: 't1', name: 'Tag1', newsletter_tags: [{},{}], newsletter_count: 2 }];
      // .select().eq() -> last eq resolves
      mockedSupabaseClient.supabase.eq.mockResolvedValueOnce({ data: mockData, error: null });

      const result = await tagApi.getTagUsageStats();
      expect(mockedSupabaseClient.supabase.select).toHaveBeenCalledWith(expect.stringContaining('newsletter_tags!inner(newsletter_id)'));
      expect(result).toEqual(expected);
    });
    // Other getTagUsageStats tests...
  });

  describe('search', () => {
    it('should search tags by name', async () => {
      const mockTags: Tag[] = [{ id: 's1', name: 'SearchMe Tag', color: '', user_id: 'test-user-id', created_at: '' }];
      // .select().eq().ilike().order() -> order resolves
      mockedSupabaseClient.supabase.order.mockResolvedValueOnce({ data: mockTags, error: null });

      const result = await tagApi.search('SearchMe');
      expect(result).toEqual(mockTags);
    });
    // Other search tests...
  });

  describe('getPaginated', () => {
    it('should fetch paginated tags with default options', async () => {
      const mockTags: Tag[] = [{ id: 'p1', name: 'Page Tag 1', color: '', user_id: 'test-user-id', created_at: '' }];
      // .select().eq().order().range() -> range resolves
      mockedSupabaseClient.supabase.range.mockResolvedValueOnce({ data: mockTags, error: null, count: 1 });

      const result = await tagApi.getPaginated();
      expect(result.data).toEqual(mockTags);
      expect(result.count).toBe(1);
    });
    // Other getPaginated tests...
  });
});
