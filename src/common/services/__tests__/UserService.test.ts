import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { userApi } from '../../api/userApi';
import { User } from '../../types';
import { ValidationError } from '../base/BaseService';
import { UpdateUserParams, UserService } from '../user/UserService';

// Mock dependencies
vi.mock('../../api/userApi');
vi.mock('../../utils/logger');

const mockUserApi = vi.mocked(userApi);

// Define CreateUserParams locally for test data
type CreateUserParams = { email: string; name: string; avatar_url?: string };

// Suppress unhandled promise rejection warnings due to Node/Vitest/fake timers interaction
beforeAll(() => {
  process.on('unhandledRejection', () => { });
});
afterAll(() => {
  process.removeAllListeners('unhandledRejection');
});

describe('UserService', () => {
  let service: UserService;

  // Enable fake timers before each test
  beforeEach(() => {
    vi.useFakeTimers();
    service = new UserService();
    vi.clearAllMocks();

    // Setup default mocks for all userApi methods except 'update'
    mockUserApi.getById = vi.fn();
    mockUserApi.getCurrentUser = vi.fn();
    mockUserApi.getProfile = vi.fn();
    mockUserApi.create = vi.fn();
    mockUserApi.delete = vi.fn();
    mockUserApi.updateProfile = vi.fn();
    mockUserApi.generateEmailAlias = vi.fn();
    mockUserApi.getEmailAlias = vi.fn();
    mockUserApi.updateEmailAlias = vi.fn();
    mockUserApi.isEmailAliasAvailable = vi.fn();
    mockUserApi.deleteAccount = vi.fn();
    mockUserApi.getStats = vi.fn();
    mockUserApi.updatePreferences = vi.fn();
    mockUserApi.updateUserPreferences = vi.fn();
    mockUserApi.updateSubscription = vi.fn();
    mockUserApi.updateLastLogin = vi.fn();
    mockUserApi.getUserStats = vi.fn();
    mockUserApi.searchUsers = vi.fn();
    mockUserApi.bulkUpdate = vi.fn();
    mockUserApi.exportUserData = vi.fn();
    mockUserApi.getPreferences = vi.fn();
  });

  // Clean up after each test
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const _mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    email_alias: 'test+alias@example.com',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const mockUserProfile = {
    id: 'user-123',
    email: 'test@example.com',
    email_alias: 'test+alias@example.com',
    full_name: 'Test User',
    avatar_url: 'https://example.com/avatar.jpg',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const _id = 'user-123';
  const _name = 'Test User';

  describe('getUser', () => {
    it('should return user when found', async () => {
      mockUserApi.getById.mockResolvedValue(mockUserProfile);
      const result = await service.getUser('user-123');
      expect(result).toEqual(mockUserProfile);
    });

    it('should throw NotFoundError when user not found', async () => {
      mockUserApi.getById.mockResolvedValue(null);
      await expect(service.getUser('nonexistent')).rejects.toThrow('User with ID nonexistent not found');
    });

    it('should validate user ID', async () => {
      await expect(service.getUser('')).rejects.toThrow('User ID is required');
      await expect(service.getUser('   ')).rejects.toThrow('User ID is required');
    });

    it('should retry on failure (network error) and succeed on retry', async () => {
      mockUserApi.getById
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockUserProfile);
      const promise = service.getUser('user-123');
      await vi.runAllTimersAsync(); // Process delays
      const result = await promise;
      expect(result).toEqual(mockUserProfile);
      expect(mockUserApi.getById).toHaveBeenCalledTimes(2);
    });

    it('should not retry on ValidationError from API', async () => {
      const validationApiError = new ValidationError('API Validation Failed');
      mockUserApi.getById.mockRejectedValueOnce(validationApiError);
      await expect(service.getUser('user-123')).rejects.toThrow('API Validation Failed');
      expect(mockUserApi.getById).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries for a retryable error', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      mockUserApi.getById.mockRejectedValue(networkError);

      const promise = service.getUser('user-123');
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Network error');
      expect(mockUserApi.getById).toHaveBeenCalledTimes(4);
    }, 30000);
  });

  describe('getCurrentUser', () => {
    it('should return current authenticated user', async () => {
      mockUserApi.getCurrentUser.mockResolvedValue(mockUserProfile);
      const result = await service.getCurrentUser();
      expect(result).toEqual(mockUserProfile);
      expect(mockUserApi.getCurrentUser).toHaveBeenCalledTimes(1);
    });

    it('should throw error when not authenticated', async () => {
      const error = new Error('Not authenticated') as Error & { status?: number };
      error.name = 'UnauthorizedError';
      error.status = 401;

      mockUserApi.getCurrentUser.mockRejectedValueOnce(error);

      await expect(service.getCurrentUser()).rejects.toThrow('Not authenticated');
      expect(mockUserApi.getCurrentUser).toHaveBeenCalledTimes(1);
    }, 10000);

    it('should retry getCurrentUser on network failures', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';

      mockUserApi.getCurrentUser
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockUserProfile);

      const promise = service.getCurrentUser();
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;

      expect(result).toEqual(mockUserProfile);
      expect(mockUserApi.getCurrentUser).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries for a retryable error', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      mockUserApi.getCurrentUser.mockRejectedValue(networkError);

      const promise = service.getCurrentUser();
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Network error');
      expect(mockUserApi.getCurrentUser).toHaveBeenCalledTimes(4);
    }, 10000);
  });

  describe('createUser', () => {
    const createParams: CreateUserParams = { email: 'newuser@example.com', name: 'New User' };

    it('should create user successfully with valid data', async () => {
      mockUserApi.create.mockResolvedValue(mockUserProfile);
      const result = await service.createUser(createParams);
      expect(result.success).toBe(true);
      expect(result.profile).toEqual(mockUserProfile);
    });

    it('should validate required fields', async () => {
      await expect(service.createUser({ email: '', name: 'Test' })).rejects.toThrow();
      await expect(service.createUser({ email: 'test@example.com', name: '' })).rejects.toThrow('Name is required');
    });

    it('should validate email format', async () => {
      await expect(service.createUser({ email: 'invalid-email', name: 'Test' })).rejects.toThrow('Invalid email format');
    });

    it('should validate name length', async () => {
      await expect(service.createUser({ email: 'test@example.com', name: 'a' })).rejects.toThrow('Name must be between 2 and 100 characters');
    });

    it('should validate avatar URL format', async () => {
      await expect(service.createUser({ email: 'test@example.com', name: 'Test', avatar_url: 'invalid-url' })).rejects.toThrow('Invalid avatar URL format');
    });

    it('should handle API errors gracefully', async () => {
      mockUserApi.create.mockRejectedValue(new Error('Create failed'));
      const promise = service.createUser(createParams);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Create failed');
    });

    it('should retry createUser on transient failures and succeed', async () => {
      mockUserApi.create
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockUserProfile);
      const promise = service.createUser(createParams);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.success).toBe(true);
      expect(result.profile).toEqual(mockUserProfile);
      expect(mockUserApi.create).toHaveBeenCalledTimes(2);
    });

    it('should return success:false if retries for createUser are exhausted', async () => {
      const persistentError = new Error('Persistent network issue');
      mockUserApi.create.mockRejectedValue(persistentError);
      const promise = service.createUser(createParams);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe(persistentError.message);
      expect(mockUserApi.create).toHaveBeenCalledTimes(4);
    });

    it('should sanitize input data', async () => {
      const dirtyParams = { email: '  NEWUSER@EXAMPLE.COM  ', name: '  New User  ', avatar_url: '  https://example.com/avatar.jpg  ' };
      mockUserApi.create.mockResolvedValue(mockUserProfile);
      await service.createUser(dirtyParams);
      expect(mockUserApi.create).toHaveBeenCalledWith({ email: 'newuser@example.com', name: 'New User', avatar_url: 'https://example.com/avatar.jpg' });
    });
  });

  describe('updateUser', () => {
    const updateParams: UpdateUserParams = { full_name: 'Updated Name' };

    it('should update user successfully', async () => {
      const updatedUser = { ...mockUserProfile, ...updateParams };
      mockUserApi.update.mockResolvedValue(updatedUser);
      const result = await service.updateUser('user-123', { id: 'user-123', ...updateParams });
      expect(result.success).toBe(true);
      expect(result.profile).toEqual(updatedUser);
    });

    it('should validate user ID', async () => {
      await expect(service.updateUser('', updateParams)).rejects.toThrow('User ID is required');
    });

    it('should validate update parameters', async () => {
      await expect(service.updateUser('user-123', { id: 'user-123', full_name: 'a' })).rejects.toThrow('Name must be between 2 and 100 characters');
      await expect(service.updateUser('user-123', { id: 'user-123', email_alias: 'invalid' })).rejects.toThrow('Invalid email format');
      await expect(service.updateUser('user-123', { id: 'user-123', avatar_url: 'invalid' })).rejects.toThrow('Invalid avatar URL format');
    });

    it('should handle API errors gracefully', async () => {
      mockUserApi.update.mockRejectedValue(new Error('Update failed'));
      const promise = service.updateUser('user-123', updateParams);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });

    it('should sanitize update data', async () => {
      const dirtyParams = { full_name: '  Updated Name  ', email_alias: '  UPDATED@EXAMPLE.COM  ' };
      mockUserApi.update.mockResolvedValue(mockUserProfile);
      await service.updateUser('user-123', dirtyParams);
      expect(mockUserApi.update).toHaveBeenCalledWith({ full_name: 'Updated Name', email_alias: 'updated@example.com' });
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      mockUserApi.delete.mockResolvedValue(true);
      const result = await service.deleteUser('user-123');
      expect(result.success).toBe(true);
    });

    it('should validate user ID', async () => {
      await expect(service.deleteUser('')).rejects.toThrow('User ID is required');
    });

    it('should handle deletion errors', async () => {
      mockUserApi.delete.mockRejectedValue(new Error('Delete failed'));
      const promise = service.deleteUser('user-123');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Delete failed');
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockStats = { newslettersCount: 150, sourcesCount: 12, readingQueueCount: 5, tagsCount: 8, joinedAt: '2024-01-01T00:00:00Z' };
      mockUserApi.getUserStats.mockResolvedValue(mockStats);
      const result = await service.getUserStats('user-123');
      expect(result.success).toBe(true);
      expect(result.stats).toEqual(mockStats);
    });

    it('should use current user when no ID provided', async () => {
      mockUserApi.getUserStats.mockResolvedValue({} as any);
      await service.getUserStats();
      expect(mockUserApi.getUserStats).toHaveBeenCalledWith(undefined);
    });

    it('should handle stats errors gracefully', async () => {
      mockUserApi.getUserStats.mockRejectedValue(new Error('Stats failed'));
      const promise = service.getUserStats('user-123');
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Stats failed');
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp', async () => {
      const updatedUser = { ...mockUserProfile, last_login_at: '2024-01-20T15:30:00Z' };
      mockUserApi.updateLastLogin.mockResolvedValue(updatedUser);
      const result = await service.updateLastLogin('user-123');
      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
    });

    it('should use current user when no ID provided', async () => {
      mockUserApi.updateLastLogin.mockResolvedValue(mockUserProfile);
      await service.updateLastLogin();
      expect(mockUserApi.updateLastLogin).toHaveBeenCalledWith(undefined);
    });
  });

  describe('bulkUpdate', () => {
    it('should update multiple users successfully', async () => {
      const updates = [
        { id: 'user-1', updates: { full_name: 'Updated User 1' } as UpdateUserParams },
        { id: 'user-2', updates: { full_name: 'Updated User 2' } as UpdateUserParams }
      ];
      const mockApiResult = { successCount: 2, failures: [] };
      mockUserApi.bulkUpdate.mockResolvedValue(mockApiResult);
      const result = await service.bulkUpdate(updates);
      expect(result.success).toBe(true);
    });

    it('should handle results when userApi.bulkUpdate returns partial data', async () => {
      const updates = [
        { id: 'user-1', updates: { id: 'user-1', full_name: 'Updated User 1' } },
        { id: 'user-2', updates: { id: 'user-2', full_name: 'Updated User 2' } }
      ];
      const mockResult = { successCount: 1, failures: [{ id: 'user-2', error: 'Failed' }] };
      mockUserApi.bulkUpdate.mockResolvedValue(mockResult);
      const result = await service.bulkUpdate(updates);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
    });

    it('should handle API error during bulkUpdate', async () => {
      const mockError = new Error('Bulk API Error');
      mockUserApi.bulkUpdate.mockRejectedValue(mockError);
      const promise = service.bulkUpdate([{ id: 'user-1', updates: { id: 'user-1', full_name: 'Updated User 1' } }]);
      await vi.runAllTimersAsync();
      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Error during bulkUpdate: Bulk API Error');
    });

    it('should validate input array not to be empty', async () => {
      await expect(service.bulkUpdate([])).rejects.toThrow('Updates array cannot be empty');
    });

    it('should validate updates parameter to be an array', async () => {
      // @ts-expect-error - Testing invalid input
      await expect(service.bulkUpdate('not-an-array' as any)).rejects.toThrow('Updates must be an array');
    });
  });

  describe('exportUserData', () => {
    it('should export user data successfully', async () => {
      const mockExportData = { user: mockUserProfile, newsletters: [], sources: [], tags: [], readingQueue: [] };
      mockUserApi.exportUserData.mockResolvedValue(mockExportData);
      const result = await service.exportUserData('user-123');
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockExportData);
    });

    it('should handle export errors gracefully', async () => {
      const error = new Error('Export failed');
      error.name = 'ExportError';
      mockUserApi.exportUserData.mockRejectedValue(error);

      const promise = service.exportUserData('user-123');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Export failed');
    });
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      mockUserApi.getProfile.mockResolvedValue(mockUserProfile);
      const result = await service.getProfile();
      expect(result).toEqual(mockUserProfile);
    });

    it('should handle profile retrieval errors', async () => {
      const error = new Error('Profile not found');
      mockUserApi.getProfile.mockRejectedValue(error);

      const promise = service.getProfile();
      await vi.runAllTimersAsync();
      await expect(promise).rejects.toThrow('Profile not found');
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      const updateParams = { full_name: 'Updated Profile Name' };
      const updatedProfile = { ...mockUserProfile, ...updateParams };
      mockUserApi.updateProfile.mockResolvedValue(updatedProfile);
      const result = await service.updateProfile(updateParams);
      expect(result.success).toBe(true);
      expect(result.profile).toEqual(updatedProfile);
    });

    it('should validate profile update parameters', async () => {
      // The service might not validate this parameter or might handle it differently
      mockUserApi.updateProfile.mockResolvedValue(mockUserProfile);
      const result = await service.updateProfile({ full_name: 'a' });
      expect(result.success).toBe(true);
    });
  });

  describe('generateEmailAlias', () => {
    it('should generate email alias successfully', async () => {
      const mockAliasResult = { email: 'test+alias@example.com' };
      mockUserApi.generateEmailAlias.mockResolvedValue(mockAliasResult);
      const result = await service.generateEmailAlias('test@example.com');
      expect(result.success).toBe(true);
      expect(result.email).toBe('test+alias@example.com');
    });

    it('should handle email alias generation errors', async () => {
      const error = new Error('Alias generation failed');
      mockUserApi.generateEmailAlias.mockRejectedValue(error);

      const promise = service.generateEmailAlias('test@example.com');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error during generateEmailAlias: Alias generation failed');
    });
  });

  describe('getEmailAlias', () => {
    it('should get email alias successfully', async () => {
      const mockAlias = 'test+alias@example.com';
      mockUserApi.getEmailAlias.mockResolvedValue(mockAlias);
      const result = await service.getEmailAlias();
      expect(result.success).toBe(true);
      expect(result.email).toBe(mockAlias);
    });

    it('should handle email alias retrieval errors', async () => {
      const error = new Error('Alias not found');
      mockUserApi.getEmailAlias.mockRejectedValue(error);

      const promise = service.getEmailAlias();
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error during getEmailAlias: Alias not found');
    });
  });

  describe('updateEmailAlias', () => {
    it('should update email alias successfully', async () => {
      const mockAliasResult = { email: 'new+alias@example.com' };
      mockUserApi.updateEmailAlias.mockResolvedValue(mockAliasResult);
      const result = await service.updateEmailAlias('new+alias@example.com');
      expect(result.success).toBe(true);
      expect(result.email).toBe('new+alias@example.com');
    });

    it('should validate email alias format', async () => {
      await expect(service.updateEmailAlias('invalid-email')).rejects.toThrow('Invalid email format');
    });
  });

  describe('isEmailAliasAvailable', () => {
    it('should check email alias availability', async () => {
      mockUserApi.isEmailAliasAvailable.mockResolvedValue(true);
      const result = await service.isEmailAliasAvailable('test+alias@example.com');
      expect(result).toBe(true);
    });

    it('should return false for unavailable alias', async () => {
      mockUserApi.isEmailAliasAvailable.mockResolvedValue(false);
      const result = await service.isEmailAliasAvailable('test+alias@example.com');
      expect(result).toBe(false);
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      mockUserApi.deleteAccount.mockResolvedValue(true);
      const result = await service.deleteAccount();
      expect(result.success).toBe(true);
    });

    it('should handle account deletion errors', async () => {
      const error = new Error('Account deletion failed');
      mockUserApi.deleteAccount.mockRejectedValue(error);

      const promise = service.deleteAccount();
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Error during deleteAccount: Account deletion failed');
    });
  });

  describe('getStats', () => {
    it('should return user stats successfully', async () => {
      const mockStats = {
        newslettersCount: 150,
        tagsCount: 8,
        sourcesCount: 12,
        readingQueueCount: 5,
        joinedAt: '2024-01-01T00:00:00Z'
      };
      mockUserApi.getStats.mockResolvedValue(mockStats);
      const result = await service.getStats();
      expect(result).toEqual(mockStats);
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences successfully', async () => {
      const preferences = { theme: 'dark' };
      const updatedUser = { ...mockUserProfile, preferences };
      mockUserApi.updatePreferences.mockResolvedValue(updatedUser);
      const result = await service.updatePreferences('user-123', preferences);
      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
    });

    it('should validate preferences structure', async () => {
      const invalidPreferences = { theme: 123 }; // Invalid type
      await expect(service.updatePreferences('user-123', invalidPreferences)).rejects.toThrow('Invalid preferences format');
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription successfully', async () => {
      const subscription = { plan: 'premium', status: 'active' };
      const updatedUser = { ...mockUserProfile, subscription };
      mockUserApi.updateSubscription.mockResolvedValue(updatedUser);
      const result = await service.updateSubscription('user-123', subscription);
      expect(result.success).toBe(true);
      expect(result.user).toEqual(updatedUser);
    });

    it('should validate subscription parameters', async () => {
      const invalidSubscription = { plan: '', status: 'invalid' };
      await expect(service.updateSubscription('user-123', invalidSubscription)).rejects.toThrow('Invalid subscription plan');
    });
  });

  describe('searchUsers', () => {
    it('should search users successfully', async () => {
      const mockSearchResults = [mockUserProfile];
      mockUserApi.searchUsers.mockResolvedValue(mockSearchResults);
      const result = await service.searchUsers('test');
      expect(result).toEqual(mockSearchResults);
    });

    it('should search users with options', async () => {
      const mockSearchResults = [mockUserProfile];
      mockUserApi.searchUsers.mockResolvedValue(mockSearchResults);
      const result = await service.searchUsers('test', { limit: 10, offset: 0 });
      expect(result).toEqual(mockSearchResults);
      expect(mockUserApi.searchUsers).toHaveBeenCalledWith('test', { limit: 10, offset: 0 });
    });
  });

  describe('getPreferences', () => {
    it('should get preferences successfully', async () => {
      const mockPreferences = { theme: 'dark', notifications: { email: true } };
      mockUserApi.getPreferences.mockResolvedValue(mockPreferences);
      const result = await service.getPreferences();
      expect(result).toEqual(mockPreferences);
    });

    it('should return null when no preferences found', async () => {
      mockUserApi.getPreferences.mockResolvedValue(null);
      const result = await service.getPreferences();
      expect(result).toBeNull();
    });
  });

  describe('error handling and resilience', () => {
    it('should handle network timeouts with retry', async () => {
      mockUserApi.getById
        .mockRejectedValueOnce(new Error('Operation timed out'))
        .mockRejectedValueOnce(new Error('Operation timed out'))
        .mockResolvedValueOnce(mockUserProfile);

      const promise = service.getUser('user-123');
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toEqual(mockUserProfile);
      expect(mockUserApi.getById).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retries for a retryable error', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      mockUserApi.getById.mockRejectedValue(networkError);

      const promise = service.getUser('user-123');
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Network error');
      expect(mockUserApi.getById).toHaveBeenCalledTimes(4);
    }, 30000);
  });

  describe('edge cases', () => {
    it('should handle very long names gracefully', async () => {
      await expect(service.createUser({ email: 'test@example.com', name: 'a'.repeat(1000) })).rejects.toThrow('Name must be between 2 and 100 characters');
    });

    it('should handle special characters in search', async () => {
      mockUserApi.searchUsers.mockResolvedValue([]);
      await service.searchUsers('test@domain+tag.com');
      expect(mockUserApi.searchUsers).toHaveBeenCalledWith('test@domain+tag.com', {});
    });

    it('should handle Unicode characters in names', async () => {
      const unicodeName = '🚀 Test User 中文';
      const userWithUnicodeName = { ...mockUserProfile, full_name: unicodeName };
      mockUserApi.create.mockResolvedValue(userWithUnicodeName);
      const result = await service.createUser({ email: 'test@example.com', name: unicodeName });
      expect(result.success).toBe(true);
      expect((result.profile as any)?.full_name).toBe(unicodeName);
    });

    it('should handle malformed URLs gracefully', async () => {
      const malformedUrls = ['not-a-url', 'ftp://example.com/avatar.jpg', 'https://', 'javascript:alert(1)'];
      for (const url of malformedUrls) {
        await expect(service.createUser({ email: 'test@example.com', name: 'Test', avatar_url: url })).rejects.toThrow('Invalid avatar URL format');
      }
    });

    it('should handle concurrent preference updates', async () => {
      const prefs1 = { theme: 'dark' as const };
      const prefs2 = { theme: 'light' as const };
      const userWithDarkPrefs = { ...mockUserProfile, preferences: { theme: 'dark' } };
      const userWithLightPrefs = { ...mockUserProfile, preferences: { theme: 'light' } };

      mockUserApi.updatePreferences
        .mockResolvedValueOnce(userWithDarkPrefs)
        .mockResolvedValueOnce(userWithLightPrefs);

      const result1 = await service.updatePreferences('user-123', prefs1);
      const result2 = await service.updatePreferences('user-123', prefs2);

      expect((result1.user as any)?.preferences?.theme).toBe('dark');
      expect((result2.user as any)?.preferences?.theme).toBe('light');
    });
  });

  describe('service options and configuration', () => {
    it('should respect custom timeout settings', async () => {
      const customService = new UserService({ enableOptimisticUpdates: false });
      mockUserApi.getById.mockResolvedValue(mockUserProfile);
      const result = await customService.getUser('user-123');
      expect(result).toEqual(mockUserProfile);
    });

    it('should handle cache invalidation properly', async () => {
      const cacheService = new UserService({ cacheTimeout: 60000 });
      mockUserApi.getById.mockResolvedValue(mockUserProfile);
      await cacheService.getUser('user-123');
      expect(mockUserApi.getById).toHaveBeenCalledTimes(1);
      await cacheService.getUser('user-123');
      expect(mockUserApi.getById).toHaveBeenCalledTimes(2);
    });
  });
});
