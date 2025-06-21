import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { userApi } from '../userApi';
import { supabase } from '../supabaseClient';
import { User } from '../../types';
import { CreateUserParams, UpdateUserParams } from '../../types/api';

// Mock dependencies
vi.mock('../supabaseClient');

const mockSupabase = vi.mocked(supabase);

describe('userApi', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    preferences: {
      theme: 'light',
      notifications: {
        email: true,
        push: false,
        newsletter_digest: true,
      },
      reading: {
        auto_mark_read: false,
        reading_speed: 200,
        preferred_view: 'list',
      },
    },
    subscription: {
      plan: 'free',
      status: 'active',
      expires_at: null,
    },
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_login_at: '2024-01-15T10:00:00Z',
  };

  let mockQueryBuilder: any;

  const createMockQueryBuilder = () => {
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      single: vi.fn(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      is: vi.fn().mockReturnThis(),
    };

    // Make all methods return the builder for chaining, except terminal methods
    Object.keys(builder).forEach((key) => {
      if (key !== 'single' && key !== 'maybeSingle') {
        builder[key] = vi.fn().mockReturnValue(builder);
      } else {
        builder[key] = vi.fn();
      }
    });

    return builder;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock query builder for each test
    mockQueryBuilder = createMockQueryBuilder();

    // Mock auth
    mockSupabase.auth = {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    } as any;

    // Mock from method
    mockSupabase.from = vi.fn().mockReturnValue(mockQueryBuilder);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getById', () => {
    it('should fetch user by ID', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockUser,
        error: null,
      });

      const result = await userApi.getById('user-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.select).toHaveBeenCalledWith('*');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'user-123');
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await userApi.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      const mockError = { message: 'Database error', code: 'OTHER_ERROR' };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(userApi.getById('user-123')).rejects.toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('should fetch current authenticated user', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockUser,
        error: null,
      });

      const result = await userApi.getCurrentUser();

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser = vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      });

      await expect(userApi.getCurrentUser()).rejects.toThrow();
    });
  });

  describe('create', () => {
    const createParams: CreateUserParams = {
      email: 'newuser@example.com',
      name: 'New User',
      avatar_url: 'https://example.com/new-avatar.jpg',
    };

    it.skip('should create a new user', async () => {
      // Mock duplicate check
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock insert
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...mockUser, ...createParams },
        error: null,
      });

      const result = await userApi.create(createParams);

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith({
        email: createParams.email,
        name: createParams.name,
        avatar_url: createParams.avatar_url,
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: false,
            newsletter_digest: true,
          },
          reading: {
            auto_mark_read: false,
            reading_speed: 200,
            preferred_view: 'list',
          },
        },
        subscription: {
          plan: 'free',
          status: 'active',
          expires_at: null,
        },
      });
      expect(result.email).toBe(createParams.email);
    });

    it('should validate required fields', async () => {
      await expect(userApi.create({ email: '', name: 'Test' })).rejects.toThrow(
        'Email is required'
      );

      await expect(userApi.create({ email: 'test@example.com', name: '' })).rejects.toThrow(
        'Name is required'
      );
    });

    it('should validate email format', async () => {
      await expect(userApi.create({ email: 'invalid-email', name: 'Test' })).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should prevent duplicate emails', async () => {
      // Mock existing user check
      const duplicateCheckBuilder = createMockQueryBuilder();
      duplicateCheckBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'existing-user' },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce(duplicateCheckBuilder);

      await expect(userApi.create(createParams)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it.skip('should create user with default preferences', async () => {
      const minimalParams = {
        email: 'minimal@example.com',
        name: 'Minimal User',
      };

      // Mock duplicate check
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock insert
      // Mock duplicate check passes
      const duplicateCheckBuilder = createMockQueryBuilder();
      duplicateCheckBuilder.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      // Mock successful insert
      const insertBuilder = createMockQueryBuilder();
      insertBuilder.single.mockResolvedValueOnce({
        data: { ...mockUser, preferences: minimalParams.preferences },
        error: null,
      });

      mockSupabase.from
        .mockReturnValueOnce(duplicateCheckBuilder)
        .mockReturnValueOnce(insertBuilder);

      await userApi.create(minimalParams);

      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: expect.objectContaining({
            theme: 'light',
            notifications: expect.any(Object),
            reading: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('update', () => {
    const updateParams: UpdateUserParams = {
      id: 'user-123',
      name: 'Updated Name',
      avatar_url: 'https://example.com/updated-avatar.jpg',
      preferences: {
        theme: 'dark',
        notifications: {
          email: false,
          push: true,
          newsletter_digest: false,
        },
        reading: {
          auto_mark_read: true,
          reading_speed: 250,
          preferred_view: 'grid',
        },
      },
    };

    it.skip('should update user', async () => {
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...mockUser, ...updateParams },
        error: null,
      });

      const result = await userApi.update(updateParams);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        full_name: updateParams.name,
        avatar_url: updateParams.avatar_url,
        updated_at: expect.any(String),
      });
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', updateParams.id);
      expect(result).toEqual({ ...mockUser, ...updateParams });
    });

    it('should update only provided fields', async () => {
      const partialUpdate = { id: 'user-123', name: 'New Name Only' };

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: { ...mockUser, name: 'New Name Only' },
        error: null,
      });

      await userApi.update(partialUpdate);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        full_name: 'New Name Only',
        updated_at: expect.any(String),
      });
    });

    it('should validate email format on update', async () => {
      await expect(userApi.update({ id: 'user-123', email: 'invalid-email' })).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should check for duplicate emails on update', async () => {
      const updateWithEmail = {
        id: 'user-123',
        email: 'existing@example.com',
      };

      // Mock existing user with different ID found
      // Mock existing user with duplicate email
      const duplicateCheckBuilder = createMockQueryBuilder();
      duplicateCheckBuilder.maybeSingle.mockResolvedValueOnce({
        data: { id: 'different-user' },
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce(duplicateCheckBuilder);

      await expect(userApi.update(updateWithEmail)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should handle update errors', async () => {
      const mockError = { message: 'Update failed' };
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      await expect(userApi.update(updateParams)).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete user', async () => {
      const deleteBuilder = createMockQueryBuilder();
      deleteBuilder.delete.mockReturnValue(deleteBuilder);
      deleteBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      mockSupabase.from.mockReturnValueOnce(deleteBuilder);

      const result = await userApi.delete('user-123');

      expect(deleteBuilder.delete).toHaveBeenCalled();
      expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'user-123');
      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      const mockError = { message: 'Delete failed' };
      const deleteBuilder = createMockQueryBuilder();
      deleteBuilder.delete.mockReturnValue(deleteBuilder);
      deleteBuilder.eq.mockResolvedValueOnce({
        data: null,
        error: mockError,
      });

      mockSupabase.from.mockReturnValueOnce(deleteBuilder);

      await expect(userApi.delete('user-123')).rejects.toThrow();
    });
  });

  describe('updatePreferences', () => {
    const newPreferences = {
      theme: 'dark' as const,
      notifications: {
        email: false,
        push: true,
        newsletter_digest: false,
      },
      reading: {
        auto_mark_read: true,
        reading_speed: 300,
        preferred_view: 'grid' as const,
      },
    };

    it('should update user preferences', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...mockUser, preferences: newPreferences },
        error: null,
      });

      const result = await userApi.updatePreferences('user-123', newPreferences);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        preferences: newPreferences,
        updated_at: expect.any(String),
      });
      expect(result.preferences).toEqual(newPreferences);
    });

    it('should merge preferences with existing ones', async () => {
      const partialPreferences = {
        theme: 'dark' as const,
      };

      // Mock current user fetch
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: mockUser,
        error: null,
      });

      // Mock update
      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          ...mockUser,
          preferences: { ...mockUser.preferences, theme: 'dark' },
        },
        error: null,
      });

      const result = await userApi.updatePreferences('user-123', partialPreferences);

      expect(result.preferences.theme).toBe('dark');
      expect(result.preferences.notifications).toEqual(mockUser.preferences.notifications);
    });
  });

  describe('updateSubscription', () => {
    const newSubscription = {
      plan: 'premium' as const,
      status: 'active' as const,
      expires_at: '2025-01-01T00:00:00Z',
    };

    it('should update user subscription', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...mockUser, subscription: newSubscription },
        error: null,
      });

      const result = await userApi.updateSubscription('user-123', newSubscription);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        subscription: newSubscription,
        updated_at: expect.any(String),
      });
      expect(result.subscription).toEqual(newSubscription);
    });

    it('should validate subscription plan', async () => {
      const invalidSubscription = {
        plan: 'invalid' as any,
        status: 'active' as const,
      };

      await expect(userApi.updateSubscription('user-123', invalidSubscription)).rejects.toThrow(
        'Invalid subscription plan'
      );
    });

    it('should validate subscription status', async () => {
      const invalidSubscription = {
        plan: 'premium' as const,
        status: 'invalid' as any,
      };

      await expect(userApi.updateSubscription('user-123', invalidSubscription)).rejects.toThrow(
        'Invalid subscription status'
      );
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const loginTime = '2024-01-20T15:30:00Z';

      mockQueryBuilder.single.mockResolvedValue({
        data: { ...mockUser, last_login_at: loginTime },
        error: null,
      });

      const result = await userApi.updateLastLogin('user-123');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        last_login_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(result.last_login_at).toBeTruthy();
    });

    it('should use current authenticated user if no ID provided', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: { ...mockUser, last_login_at: expect.any(String) },
        error: null,
      });

      await userApi.updateLastLogin();

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', mockUser.id);
    });
  });

  describe('getUserStats', () => {
    it.skip('should return user statistics', async () => {
      const mockStats = {
        newsletters_count: 150,
        sources_count: 12,
        reading_queue_count: 5,
        tags_count: 8,
        read_count: 120,
        liked_count: 25,
      };

      // Mock multiple queries for stats
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: [{ count: 150 }], error: null }) // newsletters
        .mockResolvedValueOnce({ data: [{ count: 12 }], error: null }) // sources
        .mockResolvedValueOnce({ data: [{ count: 5 }], error: null }) // reading queue
        .mockResolvedValueOnce({ data: [{ count: 8 }], error: null }) // tags
        .mockResolvedValueOnce({ data: [{ count: 120 }], error: null }) // read
        .mockResolvedValueOnce({ data: [{ count: 25 }], error: null }); // liked

      const result = await userApi.getUserStats('user-123');

      expect(result).toEqual(mockStats);
    });

    it.skip('should handle empty stats gracefully', async () => {
      // Mock all queries returning 0
      mockQueryBuilder.single.mockResolvedValue({ data: [{ count: 0 }], error: null });

      const result = await userApi.getUserStats('user-123');

      expect(result).toEqual({
        newsletters_count: 0,
        sources_count: 0,
        reading_queue_count: 0,
        tags_count: 0,
        read_count: 0,
        liked_count: 0,
      });
    });

    it('should use current user if no ID provided', async () => {
      mockQueryBuilder.single.mockResolvedValue({ data: [{ count: 0 }], error: null });

      await userApi.getUserStats();

      // Verify that user ID from auth is used
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it.skip('should search users by name or email', async () => {
      const searchResults = [
        { ...mockUser, name: 'John Test' },
        { ...mockUser, id: 'user-456', email: 'test@domain.com' },
      ];

      mockQueryBuilder.single.mockResolvedValue({
        data: searchResults,
        error: null,
        count: 2,
      });

      const result = await userApi.searchUsers('test');

      expect(mockQueryBuilder.or).toHaveBeenCalledWith('name.ilike.%test%, email.ilike.%test%');
      expect(result.data).toEqual(searchResults);
      expect(result.count).toBe(2);
    });

    it('should apply limit and pagination', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: [mockUser],
        error: null,
        count: 1,
      });

      await userApi.searchUsers('test', { limit: 5, offset: 10 });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(5);
      expect(mockQueryBuilder.range).toHaveBeenCalledWith(10, 14);
    });

    it('should validate search query length', async () => {
      await expect(
        userApi.searchUsers('a') // too short
      ).rejects.toThrow('Search query must be at least 2 characters');
    });
  });

  describe('bulkUpdate', () => {
    it.skip('should update multiple users successfully', async () => {
      const updates = [
        { id: 'user-1', updates: { name: 'Updated User 1' } },
        { id: 'user-2', updates: { name: 'Updated User 2' } },
      ];

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { ...mockUser, id: 'user-1', name: 'Updated User 1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { ...mockUser, id: 'user-2', name: 'Updated User 2' },
          error: null,
        });

      const result = await userApi.bulkUpdate(updates);

      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
      expect(result.results[0]?.name).toBe('Updated User 1');
      expect(result.results[1]?.name).toBe('Updated User 2');
    });

    it.skip('should handle partial failures', async () => {
      const updates = [
        { id: 'user-1', updates: { name: 'Updated User 1' } },
        { id: 'user-2', updates: { name: 'Updated User 2' } },
      ];

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { ...mockUser, id: 'user-1', name: 'Updated User 1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Update failed' },
        });

      const result = await userApi.bulkUpdate(updates);

      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
      expect(result.results[0]).toBeTruthy();
      expect(result.results[1]).toBeNull();
      expect(result.errors[1]?.message).toBe('Update failed');
    });

    it.skip('should validate bulk update input', async () => {
      await expect(userApi.bulkUpdate([])).rejects.toThrow('Updates array cannot be empty');
    });
  });

  describe('exportUserData', () => {
    it.skip('should export user data', async () => {
      const exportData = {
        user: mockUser,
        newsletters: [{ id: 'newsletter-1', title: 'Test Newsletter' }],
        sources: [{ id: 'source-1', name: 'Test Source' }],
        tags: [{ id: 'tag-1', name: 'Test Tag' }],
        reading_queue: [{ id: 'queue-1', newsletter_id: 'newsletter-1' }],
      };

      // Mock multiple data fetches
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: mockUser, error: null }) // user
        .mockResolvedValueOnce({ data: exportData.newsletters, error: null }) // newsletters
        .mockResolvedValueOnce({ data: exportData.sources, error: null }) // sources
        .mockResolvedValueOnce({ data: exportData.tags, error: null }) // tags
        .mockResolvedValueOnce({ data: exportData.reading_queue, error: null }); // reading queue

      const result = await userApi.exportUserData('user-123');

      expect(result).toEqual(exportData);
    });

    it('should handle export errors gracefully', async () => {
      mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Export failed' },
      });

      await expect(userApi.exportUserData('user-123')).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle very long names', async () => {
      const longName = 'x'.repeat(500);

      await expect(userApi.create({ email: 'test@example.com', name: longName })).rejects.toThrow();
    });

    it.skip('should handle special characters in search', async () => {
      const specialQuery = 'test@domain+tag.com';

      mockQueryBuilder.single.mockResolvedValue({
        data: [],
        error: null,
        count: 0,
      });

      const result = await userApi.searchUsers(specialQuery);

      expect(result.data).toEqual([]);
    });

    it('should handle concurrent preference updates', async () => {
      const prefs1 = { theme: 'dark' as const };
      const prefs2 = { theme: 'light' as const };

      // Mock successful updates
      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: mockUser, error: null })
        .mockResolvedValueOnce({
          data: { ...mockUser, preferences: { ...mockUser.preferences, theme: 'dark' } },
          error: null,
        });

      const result1 = await userApi.updatePreferences('user-123', prefs1);
      expect(result1.preferences.theme).toBe('dark');

      mockQueryBuilder.single
        .mockResolvedValueOnce({ data: mockUser, error: null })
        .mockResolvedValueOnce({
          data: { ...mockUser, preferences: { ...mockUser.preferences, theme: 'light' } },
          error: null,
        });

      const result2 = await userApi.updatePreferences('user-123', prefs2);
      expect(result2.preferences.theme).toBe('light');
    });
  });
});
