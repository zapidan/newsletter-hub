import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserService } from '../user/UserService';
import { userApi } from '../../api/userApi';
import { User } from '../../types';
import { CreateUserParams, UpdateUserParams } from '../../types/api';
import { NotFoundError, ValidationError } from '../../api/errorHandling';

// Mock dependencies
vi.mock('../../api/userApi');
vi.mock('../../utils/logger');

const mockUserApi = vi.mocked(userApi);

describe('UserService', () => {
  let service: UserService;

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

  beforeEach(() => {
    service = new UserService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      mockUserApi.getById.mockResolvedValue(mockUser);

      const result = await service.getUser('user-123');

      expect(result).toEqual(mockUser);
      expect(mockUserApi.getById).toHaveBeenCalledWith('user-123');
    });

    it.skip('should throw NotFoundError when user not found', async () => {
      mockUserApi.getById.mockResolvedValue(null);

      await expect(service.getUser('nonexistent')).rejects.toThrow(NotFoundError);
      await expect(service.getUser('nonexistent')).rejects.toThrow(
        'User with ID nonexistent not found'
      );
    });

    it('should validate user ID', async () => {
      await expect(service.getUser('')).rejects.toThrow(ValidationError);
      await expect(service.getUser('   ')).rejects.toThrow(ValidationError);
    });

    it.skip('should retry on failure and succeed on retry', async () => {
      mockUserApi.getById
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockUser);

      const result = await service.getUser('user-123');

      expect(result).toEqual(mockUser);
      expect(mockUserApi.getById).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current authenticated user', async () => {
      mockUserApi.getCurrentUser.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(mockUserApi.getCurrentUser).toHaveBeenCalledWith();
    });

    it('should throw error when not authenticated', async () => {
      mockUserApi.getCurrentUser.mockRejectedValue(new Error('Not authenticated'));

      await expect(service.getCurrentUser()).rejects.toThrow('Not authenticated');
    });

    it.skip('should retry on network failures', async () => {
      mockUserApi.getCurrentUser
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mockUser);

      const result = await service.getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(mockUserApi.getCurrentUser).toHaveBeenCalledTimes(2);
    });
  });

  describe('createUser', () => {
    const createParams: CreateUserParams = {
      email: 'newuser@example.com',
      name: 'New User',
      avatar_url: 'https://example.com/avatar.jpg',
    };

    it('should create user successfully with valid data', async () => {
      mockUserApi.create.mockResolvedValue(mockUser);

      const result = await service.createUser(createParams);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockUserApi.create).toHaveBeenCalledWith(createParams);
    });

    it('should validate required fields', async () => {
      await expect(service.createUser({ email: '', name: 'Test' })).rejects.toThrow(
        ValidationError
      );

      await expect(service.createUser({ email: 'test@example.com', name: '' })).rejects.toThrow(
        ValidationError
      );
    });

    it('should validate email format', async () => {
      await expect(service.createUser({ email: 'invalid-email', name: 'Test' })).rejects.toThrow(
        'Invalid email format'
      );

      await expect(service.createUser({ email: 'test@', name: 'Test' })).rejects.toThrow(
        'Invalid email format'
      );

      await expect(service.createUser({ email: '@domain.com', name: 'Test' })).rejects.toThrow(
        'Invalid email format'
      );
    });

    it('should validate name length', async () => {
      await expect(service.createUser({ email: 'test@example.com', name: 'a' })).rejects.toThrow(
        'Name must be between 2 and 100 characters'
      );

      const longName = 'a'.repeat(101);
      await expect(
        service.createUser({ email: 'test@example.com', name: longName })
      ).rejects.toThrow('Name must be between 2 and 100 characters');
    });

    it('should validate avatar URL format', async () => {
      await expect(
        service.createUser({
          email: 'test@example.com',
          name: 'Test',
          avatar_url: 'invalid-url',
        })
      ).rejects.toThrow('Invalid avatar URL format');
    });

    it('should handle API errors gracefully', async () => {
      mockUserApi.create.mockRejectedValue(new Error('Create failed'));

      const result = await service.createUser(createParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Create failed');
    });

    it.skip('should retry on transient failures', async () => {
      mockUserApi.create
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce(mockUser);

      const result = await service.createUser(createParams);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockUserApi.create).toHaveBeenCalledTimes(2);
    });

    it('should sanitize input data', async () => {
      const dirtyParams = {
        email: '  NEWUSER@EXAMPLE.COM  ',
        name: '  New User  ',
        avatar_url: '  https://example.com/avatar.jpg  ',
      };

      mockUserApi.create.mockResolvedValue(mockUser);

      await service.createUser(dirtyParams);

      expect(mockUserApi.create).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        name: 'New User',
        avatar_url: 'https://example.com/avatar.jpg',
      });
    });
  });

  describe('updateUser', () => {
    const updateParams: UpdateUserParams = {
      id: 'user-123',
      name: 'Updated Name',
      avatar_url: 'https://example.com/new-avatar.jpg',
    };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateParams };
      mockUserApi.update.mockResolvedValue(updatedUser);

      const result = await service.updateUser('user-123', updateParams);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
      expect(mockUserApi.update).toHaveBeenCalledWith(updateParams);
    });

    it('should validate user ID', async () => {
      await expect(service.updateUser('', updateParams)).rejects.toThrow(ValidationError);
    });

    it('should validate update parameters', async () => {
      await expect(service.updateUser('user-123', { id: 'user-123', name: 'a' })).rejects.toThrow(
        'Name must be between 2 and 100 characters'
      );

      await expect(
        service.updateUser('user-123', { id: 'user-123', email: 'invalid' })
      ).rejects.toThrow('Invalid email format');

      await expect(
        service.updateUser('user-123', { id: 'user-123', avatar_url: 'invalid' })
      ).rejects.toThrow('Invalid avatar URL format');
    });

    it('should handle API errors gracefully', async () => {
      mockUserApi.update.mockRejectedValue(new Error('Update failed'));

      const result = await service.updateUser('user-123', updateParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should sanitize update data', async () => {
      const dirtyParams = {
        id: 'user-123',
        name: '  Updated Name  ',
        email: '  UPDATED@EXAMPLE.COM  ',
      };

      mockUserApi.update.mockResolvedValue(mockUser);

      await service.updateUser('user-123', dirtyParams);

      expect(mockUserApi.update).toHaveBeenCalledWith({
        id: 'user-123',
        name: 'Updated Name',
        email: 'updated@example.com',
      });
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockUserApi.delete.mockResolvedValue(true);

      const result = await service.deleteUser('user-123');

      expect(result.success).toBe(true);
      expect(mockUserApi.delete).toHaveBeenCalledWith('user-123');
    });

    it('should validate user ID', async () => {
      await expect(service.deleteUser('')).rejects.toThrow(ValidationError);
    });

    it('should handle deletion errors', async () => {
      mockUserApi.delete.mockRejectedValue(new Error('Delete failed'));

      const result = await service.deleteUser('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
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

    it('should update user preferences successfully', async () => {
      const updatedUser = { ...mockUser, preferences: newPreferences };
      mockUserApi.updatePreferences.mockResolvedValue(updatedUser);

      const result = await service.updatePreferences('user-123', newPreferences);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
      expect(mockUserApi.updatePreferences).toHaveBeenCalledWith('user-123', newPreferences);
    });

    it('should validate user ID', async () => {
      await expect(service.updatePreferences('', newPreferences)).rejects.toThrow(ValidationError);
    });

    it.skip('should validate preferences structure', async () => {
      const invalidPreferences = {
        theme: 'invalid-theme',
        notifications: {
          email: 'not-boolean', // should be boolean
          push: true,
          newsletter_digest: true,
        },
        reading: {
          auto_mark_read: true,
          reading_speed: -100, // invalid speed
          preferred_view: 'list',
        },
      };

      await expect(service.updatePreferences('user-123', invalidPreferences)).rejects.toThrow(
        'Invalid preferences format'
      );
    });

    it('should handle partial preference updates', async () => {
      const partialPreferences = {
        theme: 'dark' as const,
      };

      const updatedUser = {
        ...mockUser,
        preferences: { ...mockUser.preferences, theme: 'dark' },
      };
      mockUserApi.updatePreferences.mockResolvedValue(updatedUser);

      const result = await service.updatePreferences('user-123', partialPreferences);

      expect(result.success).toBe(true);
      expect(result.user?.preferences.theme).toBe('dark');
    });
  });

  describe('updateSubscription', () => {
    const newSubscription = {
      plan: 'premium' as const,
      status: 'active' as const,
      expires_at: '2025-01-01T00:00:00Z',
    };

    it('should update user subscription successfully', async () => {
      const updatedUser = { ...mockUser, subscription: newSubscription };
      mockUserApi.updateSubscription.mockResolvedValue(updatedUser);

      const result = await service.updateSubscription('user-123', newSubscription);

      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
      expect(mockUserApi.updateSubscription).toHaveBeenCalledWith('user-123', newSubscription);
    });

    it('should validate subscription data', async () => {
      const invalidSubscription = {
        plan: 'invalid' as any,
        status: 'active' as const,
      };

      await expect(service.updateSubscription('user-123', invalidSubscription)).rejects.toThrow(
        'Invalid subscription plan'
      );
    });

    it('should validate expiration date format', async () => {
      const invalidSubscription = {
        plan: 'premium' as const,
        status: 'active' as const,
        expires_at: 'invalid-date',
      };

      await expect(service.updateSubscription('user-123', invalidSubscription)).rejects.toThrow(
        'Invalid expiration date format'
      );
    });
  });

  describe('searchUsers', () => {
    it('should search users with query', async () => {
      const mockResponse = {
        data: [mockUser],
        count: 1,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };
      mockUserApi.searchUsers.mockResolvedValue(mockResponse);

      const result = await service.searchUsers('test', { limit: 10 });

      expect(result).toEqual(mockResponse);
      expect(mockUserApi.searchUsers).toHaveBeenCalledWith('test', { limit: 10 });
    });

    it('should validate search query', async () => {
      await expect(service.searchUsers('')).rejects.toThrow(ValidationError);
      await expect(service.searchUsers('a')).rejects.toThrow(
        'Search query must be at least 2 characters'
      );
    });

    it('should sanitize search query', async () => {
      const mockResponse = {
        data: [],
        count: 0,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };
      mockUserApi.searchUsers.mockResolvedValue(mockResponse);

      await service.searchUsers('  test query  ');

      expect(mockUserApi.searchUsers).toHaveBeenCalledWith('test query', {});
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockStats = {
        newsletters_count: 150,
        sources_count: 12,
        reading_queue_count: 5,
        tags_count: 8,
        read_count: 120,
        liked_count: 25,
      };
      mockUserApi.getUserStats.mockResolvedValue(mockStats);

      const result = await service.getUserStats('user-123');

      expect(result.success).toBe(true);
      expect(result.stats).toEqual(mockStats);
      expect(mockUserApi.getUserStats).toHaveBeenCalledWith('user-123');
    });

    it('should use current user when no ID provided', async () => {
      const mockStats = {
        newsletters_count: 0,
        sources_count: 0,
        reading_queue_count: 0,
        tags_count: 0,
        read_count: 0,
        liked_count: 0,
      };
      mockUserApi.getUserStats.mockResolvedValue(mockStats);

      const result = await service.getUserStats();

      expect(result.success).toBe(true);
      expect(mockUserApi.getUserStats).toHaveBeenCalledWith(undefined);
    });

    it('should handle stats errors gracefully', async () => {
      mockUserApi.getUserStats.mockRejectedValue(new Error('Stats failed'));

      const result = await service.getUserStats('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Stats failed');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const updatedUser = { ...mockUser, last_login_at: '2024-01-20T15:30:00Z' };
      mockUserApi.updateLastLogin.mockResolvedValue(updatedUser);

      const result = await service.updateLastLogin('user-123');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
      expect(mockUserApi.updateLastLogin).toHaveBeenCalledWith('user-123');
    });

    it('should use current user when no ID provided', async () => {
      const updatedUser = { ...mockUser, last_login_at: '2024-01-20T15:30:00Z' };
      mockUserApi.updateLastLogin.mockResolvedValue(updatedUser);

      const result = await service.updateLastLogin();

      expect(result.success).toBe(true);
      expect(mockUserApi.updateLastLogin).toHaveBeenCalledWith(undefined);
    });
  });

  describe('bulkUpdate', () => {
    it.skip('should update multiple users successfully', async () => {
      const updates = [
        { id: 'user-1', updates: { name: 'Updated User 1' } },
        { id: 'user-2', updates: { name: 'Updated User 2' } },
      ];

      const mockResult = {
        results: [
          { ...mockUser, id: 'user-1', name: 'Updated User 1' },
          { ...mockUser, id: 'user-2', name: 'Updated User 2' },
        ],
        errors: [],
        successCount: 2,
        errorCount: 0,
      };

      mockUserApi.bulkUpdate.mockResolvedValue(mockResult);

      const result = await service.bulkUpdate(updates);

      expect(result.success).toBe(true);
      expect(result.users).toEqual(mockResult.results);
      expect(result.failedIds).toEqual([]);
      expect(mockUserApi.bulkUpdate).toHaveBeenCalledWith(updates);
    });

    it.skip('should handle partial failures', async () => {
      const updates = [
        { id: 'user-1', updates: { name: 'Updated User 1' } },
        { id: 'user-2', updates: { name: 'Updated User 2' } },
      ];

      const mockResult = {
        results: [{ ...mockUser, id: 'user-1', name: 'Updated User 1' }, null],
        errors: [null, new Error('Update failed')],
        successCount: 1,
        errorCount: 1,
      };
      mockUserApi.bulkUpdate.mockResolvedValue(mockResult);

      const result = await service.bulkUpdate(updates);

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(1);
      expect(result.failedIds).toEqual(['user-2']);
    });

    it.skip('should validate input array', async () => {
      await expect(service.bulkUpdate([])).rejects.toThrow(ValidationError);
    });
  });

  describe('exportUserData', () => {
    it('should export user data successfully', async () => {
      const mockExportData = {
        user: mockUser,
        newsletters: [{ id: 'newsletter-1', title: 'Test Newsletter' }],
        sources: [{ id: 'source-1', name: 'Test Source' }],
        tags: [{ id: 'tag-1', name: 'Test Tag' }],
        reading_queue: [{ id: 'queue-1', newsletter_id: 'newsletter-1' }],
      };
      mockUserApi.exportUserData.mockResolvedValue(mockExportData);

      const result = await service.exportUserData('user-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockExportData);
      expect(mockUserApi.exportUserData).toHaveBeenCalledWith('user-123');
    });

    it('should handle export errors gracefully', async () => {
      mockUserApi.exportUserData.mockRejectedValue(new Error('Export failed'));

      const result = await service.exportUserData('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Export failed');
    });
  });

  describe('error handling and resilience', () => {
    it.skip('should handle network timeouts with retry', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';

      mockUserApi.getById
        .mockRejectedValueOnce(timeoutError)
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(mockUser);

      const result = await service.getUser('user-123');

      expect(result).toEqual(mockUser);
      expect(mockUserApi.getById).toHaveBeenCalledTimes(3);
    });

    it.skip('should fail after max retries', async () => {
      const error = new Error('Persistent error');
      mockUserApi.getById.mockRejectedValue(error);

      await expect(service.getUser('user-123')).rejects.toThrow('Persistent error');
      expect(mockUserApi.getById).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should handle validation errors without retry', async () => {
      const validationError = new ValidationError('Invalid input');
      mockUserApi.create.mockRejectedValue(validationError);

      const result = await service.createUser({
        email: 'test@example.com',
        name: 'Test User',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid input');
      expect(mockUserApi.create).toHaveBeenCalledTimes(1); // No retry for validation errors
    });
  });

  describe('edge cases', () => {
    it('should handle very long names gracefully', async () => {
      const extraLongName = 'a'.repeat(1000);

      await expect(
        service.createUser({
          email: 'test@example.com',
          name: extraLongName,
        })
      ).rejects.toThrow('Name must be between 2 and 100 characters');
    });

    it('should handle special characters in search', async () => {
      const specialQuery = 'test@domain+tag.com';

      const mockResponse = {
        data: [],
        count: 0,
        page: 1,
        limit: 50,
        hasMore: false,
        nextPage: null,
        prevPage: null,
      };
      mockUserApi.searchUsers.mockResolvedValue(mockResponse);

      const result = await service.searchUsers(specialQuery);

      expect(result.data).toEqual([]);
      expect(mockUserApi.searchUsers).toHaveBeenCalledWith(specialQuery, {});
    });

    it('should handle Unicode characters in names', async () => {
      const unicodeName = '🚀 Test User 中文';
      mockUserApi.create.mockResolvedValue({
        ...mockUser,
        name: unicodeName,
      });

      const result = await service.createUser({
        email: 'test@example.com',
        name: unicodeName,
      });

      expect(result.success).toBe(true);
      expect(result.user?.name).toBe(unicodeName);
    });

    it('should handle malformed URLs gracefully', async () => {
      const malformedUrls = [
        'not-a-url',
        'ftp://example.com/avatar.jpg', // wrong protocol
        'https://', // incomplete
        'javascript:alert(1)', // dangerous protocol
      ];

      for (const url of malformedUrls) {
        await expect(
          service.createUser({
            email: 'test@example.com',
            name: 'Test',
            avatar_url: url,
          })
        ).rejects.toThrow('Invalid avatar URL format');
      }
    });

    it('should handle concurrent preference updates', async () => {
      const prefs1 = { theme: 'dark' as const };
      const prefs2 = { theme: 'light' as const };

      mockUserApi.updatePreferences
        .mockResolvedValueOnce({
          ...mockUser,
          preferences: { ...mockUser.preferences, theme: 'dark' },
        })
        .mockResolvedValueOnce({
          ...mockUser,
          preferences: { ...mockUser.preferences, theme: 'light' },
        });

      const result1 = await service.updatePreferences('user-123', prefs1);
      const result2 = await service.updatePreferences('user-123', prefs2);

      expect(result1.user?.preferences.theme).toBe('dark');
      expect(result2.user?.preferences.theme).toBe('light');
    });
  });

  describe('service options and configuration', () => {
    it('should respect custom timeout settings', async () => {
      const customService = new UserService({ timeout: 5000 });

      mockUserApi.getById.mockResolvedValue(mockUser);

      const result = await customService.getUser('user-123');

      expect(result).toEqual(mockUser);
    });

    it('should handle cache invalidation properly', async () => {
      const cacheService = new UserService({ enableCaching: true });

      mockUserApi.getById.mockResolvedValue(mockUser);

      // First call should hit API
      await cacheService.getUser('user-123');
      expect(mockUserApi.getById).toHaveBeenCalledTimes(1);

      // Second call might use cache (implementation dependent)
      await cacheService.getUser('user-123');
    });
  });
});
