import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useNewsletterSourceGroups } from '../useNewsletterSourceGroups';
import { newsletterSourceGroupService } from '@common/services';

// Mock the newsletterSourceGroupService
vi.mock('@common/services', () => ({
  newsletterSourceGroupService: {
    getGroups: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    getGroup: vi.fn(),
    addSourcesToGroup: vi.fn(),
    removeSourcesFromGroup: vi.fn(),
  },
}));

// Mock the useCache hook
vi.mock('@common/hooks/useCache', () => ({
  useCache: () => ({
    batchInvalidate: vi.fn(),
  }),
}));

describe('useNewsletterSourceGroups', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;
  
  // Sample data
  const mockGroup = {
    id: 'group-1',
    name: 'Test Group',
    user_id: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    sources: [
      {
        id: 'source-1',
        name: 'Test Source',
        from: 'test@example.com',
        user_id: 'user-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
    
    // Clear all mocks before each test
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up query client after each test
    queryClient.clear();
  });

  it('should fetch groups successfully', async () => {
    // Mock the service response
    const mockGroups = [mockGroup];
    vi.mocked(newsletterSourceGroupService.getGroups).mockResolvedValue(mockGroups);
    
    // Render the hook
    const { result, rerender } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Initial state should be loading
    expect(result.current.groups).toEqual([]);
    expect(result.current.isLoading).toBe(true);
    
    // Wait for the query to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      rerender();
    });
    
    // Verify the data was loaded
    expect(result.current.groups).toEqual(mockGroups);
    expect(result.current.isLoading).toBe(false);
    expect(newsletterSourceGroupService.getGroups).toHaveBeenCalledTimes(1);
  });

  it('should handle error when fetching groups', async () => {
    // Mock an error response
    const errorMessage = 'Failed to fetch groups';
    vi.mocked(newsletterSourceGroupService.getGroups).mockRejectedValue(new Error(errorMessage));
    
    // Render the hook
    const { result, rerender } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Wait for the query to resolve
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      rerender();
    });
    
    // Verify error state
    expect(result.current.error).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('should create a new group', async () => {
    const newGroup = { ...mockGroup, id: 'new-group' };
    vi.mocked(newsletterSourceGroupService.createGroup).mockResolvedValue({
      success: true,
      group: newGroup,
    });
    
    const { result } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Call createGroup mutation
    let response;
    await act(async () => {
      response = await result.current.createGroup.mutateAsync({
        name: 'New Group',
        sourceIds: ['source-1'],
      });
    });
    
    // Verify the service was called with correct parameters
    expect(newsletterSourceGroupService.createGroup).toHaveBeenCalledWith({
      name: 'New Group',
      sourceIds: ['source-1'],
    });
    
    // Verify the response
    expect(response).toEqual(newGroup);
    
    // Wait for the mutation state to update
    await waitFor(() => {
      expect(result.current.createGroup.isSuccess).toBe(true);
    });
  });

  it('should update a group', async () => {
    const updatedGroup = { ...mockGroup, name: 'Updated Group' };
    vi.mocked(newsletterSourceGroupService.updateGroup).mockResolvedValue({
      success: true,
      group: updatedGroup,
    });
    
    const { result } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Call updateGroup mutation
    let response;
    await act(async () => {
      response = await result.current.updateGroup.mutateAsync({
        id: 'group-1',
        name: 'Updated Group',
      });
    });
    
    // Verify the service was called with correct parameters
    expect(newsletterSourceGroupService.updateGroup).toHaveBeenCalledWith('group-1', {
      name: 'Updated Group',
    });
    
    // Verify the response
    expect(response).toEqual(updatedGroup);
    
    // Wait for the mutation state to update
    await waitFor(() => {
      expect(result.current.updateGroup.isSuccess).toBe(true);
    });
  });

  it('should delete a group', async () => {
    vi.mocked(newsletterSourceGroupService.deleteGroup).mockResolvedValue({ 
      success: true,
      group: mockGroup 
    });
    
    const { result } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Call deleteGroup mutation
    let response;
    await act(async () => {
      response = await result.current.deleteGroup.mutateAsync('group-1');
    });
    
    // Verify the service was called with correct parameters
    expect(newsletterSourceGroupService.deleteGroup).toHaveBeenCalledWith('group-1');
    
    // Verify the response
    expect(response).toBe(true);
    
    // Wait for the mutation state to update
    await waitFor(() => {
      expect(result.current.deleteGroup.isSuccess).toBe(true);
    });
  });


  it('should get a single group', async () => {
    vi.mocked(newsletterSourceGroupService.getGroup).mockResolvedValue(mockGroup);
    
    const { result } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Call getGroup mutation
    let response;
    await act(async () => {
      response = await result.current.getGroup.mutateAsync('group-1');
    });
    
    // Verify the service was called with correct parameters
    expect(newsletterSourceGroupService.getGroup).toHaveBeenCalledWith('group-1');
    
    // Verify the response
    expect(response).toEqual(mockGroup);
    
    // Wait for the mutation state to update
    await waitFor(() => {
      expect(result.current.getGroup.isSuccess).toBe(true);
    });
  });

  it('should add sources to a group', async () => {
    const newSource = {
      id: 'source-2',
      name: 'New Source',
      from: 'new@example.com',
      user_id: 'user-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };
    const updatedGroup = { 
      ...mockGroup, 
      sources: [...mockGroup.sources, newSource] 
    };
    
    vi.mocked(newsletterSourceGroupService.addSourcesToGroup).mockResolvedValue({
      success: true,
      group: updatedGroup,
    });
    
    const { result } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Call addSourcesToGroup mutation
    let response;
    await act(async () => {
      response = await result.current.addSourcesToGroup.mutateAsync({
        groupId: 'group-1',
        sourceIds: ['source-2']
      });
    });
    
    // Verify the service was called with correct parameters
    expect(newsletterSourceGroupService.addSourcesToGroup).toHaveBeenCalledWith(
      'group-1',
      ['source-2']
    );
    
    // Verify the response
    expect(response).toEqual(updatedGroup);
    
    // Wait for the mutation state to update
    await waitFor(() => {
      expect(result.current.addSourcesToGroup.isSuccess).toBe(true);
    });
  });

  it('should remove sources from a group', async () => {
    const sourceIdsToRemove = ['source-1'];
    vi.mocked(newsletterSourceGroupService.removeSourcesFromGroup).mockResolvedValue({
      success: true,
      group: { ...mockGroup, sources: [] },
    });
    
    const { result } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Call removeSourcesFromGroup mutation
    let response;
    await act(async () => {
      response = await result.current.removeSourcesFromGroup.mutateAsync({
        groupId: 'group-1',
        sourceIds: sourceIdsToRemove
      });
    });
    
    // Verify the service was called with correct parameters
    expect(newsletterSourceGroupService.removeSourcesFromGroup).toHaveBeenCalledWith(
      'group-1',
      sourceIdsToRemove
    );
    
    // Verify the response
    expect(response).toEqual(sourceIdsToRemove);
    
    // Wait for the mutation state to update
    await waitFor(() => {
      expect(result.current.removeSourcesFromGroup.isSuccess).toBe(true);
    });
  });
  
  it('should handle errors when adding sources to a group', async () => {
    const errorMessage = 'Failed to add sources to group';
    vi.mocked(newsletterSourceGroupService.addSourcesToGroup).mockRejectedValue(new Error(errorMessage));
    
    const { result } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Call addSourcesToGroup mutation
    let error: unknown = null;
    await act(async () => {
      try {
        await result.current.addSourcesToGroup.mutateAsync({
          groupId: 'group-1',
          sourceIds: ['source-2']
        });
      } catch (e) {
        error = e;
      }
    });
    
    // Verify the error was thrown
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.message).toBe(errorMessage);
    } else {
      fail('Expected error to be an instance of Error');
    }
  });
  
  it('should handle errors when removing sources from a group', async () => {
    const errorMessage = 'Failed to remove sources from group';
    vi.mocked(newsletterSourceGroupService.removeSourcesFromGroup).mockRejectedValue(new Error(errorMessage));
    
    const { result } = renderHook(() => useNewsletterSourceGroups(), { wrapper });
    
    // Call removeSourcesFromGroup mutation
    let error: unknown = null;
    await act(async () => {
      try {
        await result.current.removeSourcesFromGroup.mutateAsync({
          groupId: 'group-1',
          sourceIds: ['source-1']
        });
      } catch (e) {
        error = e;
      }
    });
    
    // Verify the error was thrown
    expect(error).toBeInstanceOf(Error);
    if (error instanceof Error) {
      expect(error.message).toBe(errorMessage);
    } else {
      fail('Expected error to be an instance of Error');
    }
  });
});
