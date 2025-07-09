import { AuthContext } from '@common/contexts/AuthContext';
import * as useEmailAliasModule from '@common/hooks/useEmailAlias';
import type { User } from '@supabase/supabase-js';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { vi } from 'vitest';
import Sidebar from '../Sidebar';

// Mock the hooks
vi.mock('@common/hooks/useEmailAlias', () => ({
  useEmailAlias: vi.fn(() => ({
    emailAlias: 'test-alias@example.com',
    loading: false,
  })),
}));

vi.mock('@common/hooks/useUnreadCount', () => ({
  useUnreadCount: vi.fn(() => ({
    unreadCount: 5,
    isLoading: false,
  })),
}));

// Mock the logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    error: vi.fn(),
  }),
}));

// Mock the icons
vi.mock('lucide-react', () => ({
  Inbox: () => <div data-testid="inbox-icon">Inbox</div>,
  Search: () => <div data-testid="search-icon">Search</div>,
  TrendingUp: () => <div data-testid="trending-up-icon">Discover</div>,
  Settings: () => <div data-testid="settings-icon">Settings</div>,
  Menu: () => <div data-testid="menu-icon">Menu</div>,
  X: () => <div data-testid="close-icon">Close</div>,
  Mail: () => <div data-testid="mail-icon">Mail</div>,
  Copy: () => <div data-testid="copy-icon">Copy</div>,
  Check: () => <div data-testid="check-icon">Check</div>,
  Tag: () => <div data-testid="tag-icon">Tags</div>,
  Newspaper: () => <div data-testid="newspaper-icon">Sources</div>,
  Bookmark: () => <div data-testid="bookmark-icon">Reading Queue</div>,
  CalendarDays: () => <div data-testid="calendar-days-icon">Calendar</div>,
  UserCircle: () => <div data-testid="user-circle-icon">User</div>,
}));

// Mock framer-motion for testing
vi.mock('framer-motion', () => {
  return {
    motion: {
      aside: ({ children, className, ...props }) => (
        <aside className={className} data-testid="motion-aside" {...props}>{children}</aside>
      ),
      div: ({ children, className, ...props }) => (
        <div className={className} {...props}>{children}</div>
      ),
      span: ({ children, className, ...props }) => (
        <span className={className} {...props}>{children}</span>
      ),
    },
    AnimatePresence: ({ children }) => <>{children}</>,
  };
});

// Mock window object
const mockWindowLocation = (pathname: string) => {
  const location: Location = {
    ...window.location,
    pathname,
    href: `http://localhost${pathname}`,
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  };

  Object.defineProperty(window, 'location', {
    writable: true,
    value: location,
  });

  return location;
};

describe('Sidebar', () => {
  const mockUser = {
    id: 'test-user-1',
    email: 'test@example.com',
    name: 'Test User',
    user_metadata: { name: 'Test User' },
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    role: 'authenticated',
    updated_at: new Date().toISOString(),
  } as unknown as User; // Cast to User type to satisfy TypeScript

  const mockAuthContext = {
    user: mockUser,
    session: {
      user: mockUser,
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    },
    loading: false,
    error: null,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    checkPasswordStrength: vi.fn().mockReturnValue([]),
  };

  beforeEach(() => {
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderSidebar = (pathname = '/inbox') => {
    mockWindowLocation(pathname);

    return render(
      <Router>
        <AuthContext.Provider value={mockAuthContext}>
          <Sidebar />
        </AuthContext.Provider>
      </Router>
    );
  };

  it('renders the sidebar with all navigation items', () => {
    renderSidebar();

    // Check if all navigation items are present by their href
    const navItems = [
      { text: 'Inbox', href: '/inbox' },
      { text: 'Discover', href: '/trending' },
      { text: 'Reading Queue', href: '/queue' },
      { text: 'Tags', href: '/tags' },
      { text: 'Newsletter Groups', href: '/newsletters' },
      { text: 'Settings', href: '/settings' },
    ];

    navItems.forEach(({ text, href }) => {
      const elements = screen.getAllByText(text);
      // Find the element that is a nav link with the correct href
      const navLink = elements.find(
        (element) => element.closest('a')?.getAttribute('href') === href
      );
      expect(navLink).toBeInTheDocument();
    });
  });

  it('shows the unread count badge when there are unread items', () => {
    renderSidebar();

    // Find the Inbox nav link by its href
    const inboxLinks = screen.getAllByText('Inbox');
    const inboxNavLink = inboxLinks.find(
      (element) => element.closest('a')?.getAttribute('href') === '/inbox'
    )?.closest('a');

    expect(inboxNavLink).toBeInTheDocument();

    // The badge with the unread count should be present within the Inbox link
    const badge = within(inboxNavLink!).getByText('5');
    expect(badge).toBeInTheDocument();
  });

  it('copies email alias to clipboard when copy button is clicked', async () => {
    renderSidebar();

    // Find the copy button
    const copyButton = screen.getByTestId('copy-icon').closest('button');

    // Initial state check
    expect(copyButton).toHaveAttribute('title', 'Copy email');

    // Click the copy button
    fireEvent.click(copyButton!);

    // Verify clipboard was called with the email alias
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-alias@example.com');

    // Wait for the copied state to be set
    await waitFor(() => {
      // The button's title should change to 'Copied!'
      expect(copyButton).toHaveAttribute('title', 'Copied!');

      // The check icon should be visible
      const checkIcon = within(copyButton!).getByTestId('check-icon');
      expect(checkIcon).toBeInTheDocument();
    });

    // Wait for the copied state to reset
    await waitFor(() => {
      expect(copyButton).toHaveAttribute('title', 'Copy email');
    }, { timeout: 3000, interval: 100 });
  });

  it('displays the user email in the footer', () => {
    renderSidebar();

    // The email is displayed in the footer section
    const emailElement = screen.getByText('test@example.com');
    expect(emailElement).toBeInTheDocument();
    expect(emailElement).toHaveClass('font-medium', 'text-slate-700', 'truncate', 'text-sm');
  });

  // Note: Sign out functionality is not implemented in the Sidebar component
  // It should be tested in the component where it's actually implemented

  it('highlights the active route', () => {
    renderSidebar('/inbox');

    // Find the Inbox nav link by its href
    const inboxLinks = screen.getAllByText('Inbox');
    const inboxNavLink = inboxLinks.find(
      (element) => element.closest('a')?.getAttribute('href') === '/inbox'
    )?.closest('a');

    expect(inboxNavLink).toHaveClass('active');
  });

  it('refreshes the inbox when clicking on the inbox link while already on the inbox page', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    renderSidebar('/inbox');

    // Find and click the Inbox link by finding the nav link with href="/inbox"
    const inboxLinks = screen.getAllByText('Inbox');
    const inboxNavLink = inboxLinks.find(
      (element) =>
        element.closest('a')?.getAttribute('href') === '/inbox'
    )?.closest('a');

    expect(inboxNavLink).toBeInTheDocument();
    fireEvent.click(inboxNavLink!);

    // Verify the refresh events were dispatched
    expect(dispatchEventSpy).toHaveBeenCalledWith(expect.any(Event));

    // Clean up
    dispatchEventSpy.mockRestore();
  });

  it('has correct accessibility attributes', () => {
    renderSidebar();
    // Sidebar aside should have aria-label and role complementary
    const aside = screen.getByRole('complementary', { name: /main navigation/i });
    expect(aside).toBeInTheDocument();
    // Unread badge should have aria-live and aria-atomic
    const badge = screen.queryByText('5');
    if (badge) {
      expect(badge).toHaveAttribute('aria-live', 'polite');
      expect(badge).toHaveAttribute('aria-atomic', 'true');
    }
  });

  it('shows loading state for email alias', () => {
    useEmailAliasModule.useEmailAlias.mockReturnValueOnce({ emailAlias: null, loading: true });
    renderSidebar();
    expect(screen.getByText(/loading email/i)).toBeInTheDocument();
  });

  it('handles empty email alias gracefully', () => {
    useEmailAliasModule.useEmailAlias.mockReturnValueOnce({ emailAlias: null, loading: false });
    renderSidebar();
    expect(screen.queryByTestId('mail-icon')).not.toBeInTheDocument();
  });

  it('disables copy button when copied is true', async () => {
    renderSidebar();
    const copyButton = screen.getByTestId('copy-icon').closest('button');
    fireEvent.click(copyButton!);
    await waitFor(() => {
      expect(copyButton).toBeDisabled();
    });
  });

  it('shows alert and logs error if clipboard write fails', async () => {
    (navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('fail'));
    window.alert = vi.fn();
    renderSidebar();
    const copyButton = screen.getByTestId('copy-icon').closest('button');
    fireEvent.click(copyButton!);
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to copy email to clipboard');
    });
  });

  it.each([
    ['/inbox', 'Inbox'],
    ['/queue', 'Reading Queue'],
    ['/daily', 'Daily Summary'],
    ['/search', 'Search'],
    ['/trending', 'Trending Topics'],
    ['/tags', 'Tags'],
    ['/newsletters', 'Newsletter Groups'],
    ['/profile', 'Profile'],
    ['/settings', 'Settings'],
  ])('highlights the correct nav link for %s', (route, label) => {
    renderSidebar(route);
    const link = screen.getAllByText(label).find(e => e.closest('a'))?.closest('a');
    expect(link).toHaveClass('active');
  });

  it('renders nothing or fallback if no user in context', () => {
    mockWindowLocation('/inbox');
    render(
      <Router>
        <AuthContext.Provider value={{ ...mockAuthContext, user: null }}>
          <Sidebar />
        </AuthContext.Provider>
      </Router>
    );
    // Should not crash, may render nothing or fallback
    expect(screen.queryByText('Newsletter Hub')).not.toBeNull();
  });
});
