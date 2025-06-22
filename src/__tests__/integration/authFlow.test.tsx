import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Session } from '@supabase/supabase-js';
import { AuthProvider } from '../../common/contexts/AuthContext';
import Login from '../../web/pages/Login';

// Mock the userService
vi.mock('../../common/services/user/UserService', () => ({
  userService: {
    generateEmailAlias: vi.fn().mockResolvedValue({
      success: true,
      email: 'testuser@testdomain.com'
    }),
  },
}));

// Mock the userApi
vi.mock('../../common/api/userApi', () => ({
  userApi: {
    updateEmailAlias: vi.fn().mockResolvedValue({ email: 'testuser@testdomain.com' }),
  },
}));

// Mock the Supabase client
const mockSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });

// Define types for auth state change handling
type AuthChangeEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY';

vi.mock('../../common/contexts/SupabaseContext', () => ({
  useSupabase: vi.fn(() => ({
    supabase: {
      auth: {
        signUp: mockSignUp,
        signIn: mockSignIn,
        onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
          // Simulate auth state change with null session initially
          callback('SIGNED_OUT', null);
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
        signOut: mockSignOut,
        getSession: mockGetSession,
      },
    },
    session: null,
    user: null,
  })),
}));

// Create a test-utils file to setup the test environment
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

describe('Sign Up Flow', () => {
  let userService: { generateEmailAlias: jest.Mock };

  beforeEach(async () => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Setup default mock implementations
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: 'test-user-id' },
        session: { access_token: 'test-token' },
      },
      error: null,
    });

    // Import the mocked userService
    userService = (await import('../../common/services/user/UserService')).userService;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should sign up successfully with valid credentials and generate email alias', async () => {
    // Mock a successful signup response
    mockSignUp.mockResolvedValueOnce({
      data: {
        user: { id: 'test-user-id' },
        session: { access_token: 'test-token' },
      },
      error: null,
    });

    render(<Login />, { wrapper: TestWrapper });

    // Switch to sign up mode
    await userEvent.click(screen.getByRole('button', { name: /create a new account/i }));
    
    // Fill out the form
    const email = 'test.user+123@example.com';
    await userEvent.type(screen.getByTestId('email-input'), email);
    await userEvent.type(screen.getByTestId('password-input'), 'Password123!');
    
    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    // Verify the signup was called with the correct parameters
    expect(mockSignUp).toHaveBeenCalledWith({
      email,
      password: 'Password123!',
    });

    // Verify email alias generation was attempted
    expect(userService.generateEmailAlias).toHaveBeenCalledWith(email);
  });

  it('should handle email alias generation failure gracefully', async () => {
    // Mock a successful signup response
    mockSignUp.mockResolvedValueOnce({
      data: {
        user: { id: 'test-user-id' },
        session: { access_token: 'test-token' },
      },
      error: null,
    });

    // Mock a failed email alias generation
    userService.generateEmailAlias.mockResolvedValueOnce({
      success: false,
      error: 'Failed to generate email alias'
    });

    render(<Login />, { wrapper: TestWrapper });

    // Switch to sign up mode
    await userEvent.click(screen.getByRole('button', { name: /create a new account/i }));
    
    // Fill out the form
    const email = 'test@example.com';
    await userEvent.type(screen.getByTestId('email-input'), email);
    await userEvent.type(screen.getByTestId('password-input'), 'Password123!');
    
    // Submit the form
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    // Verify the signup was still successful even if alias generation fails
    expect(mockSignUp).toHaveBeenCalledWith({
      email,
      password: 'Password123!',
    });
    expect(userService.generateEmailAlias).toHaveBeenCalledWith(email);
  });
});
