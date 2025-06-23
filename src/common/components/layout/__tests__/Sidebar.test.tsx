import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthContext } from '@common/contexts/AuthContext';
import type { User } from '@supabase/supabase-js';
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
  Menu: () => <button data-testid="menu-icon">Menu</button>,
  X: () => <div data-testid="close-icon">Close</div>,
  Mail: () => <div data-testid="mail-icon">Mail</div>,
  Copy: () => <div data-testid="copy-icon">Copy</div>,
  Check: () => <div data-testid="check-icon">Check</div>,
  Tag: () => <div data-testid="tag-icon">Tags</div>,
  Newspaper: () => <div data-testid="newspaper-icon">Sources</div>,
  Bookmark: () => <div data-testid="bookmark-icon">Reading Queue</div>,
  CalendarDays: () => <div data-testid="calendar-days-icon">Calendar</div>,
}));

// Mock framer-motion for testing
vi.mock('framer-motion', () => ({
  motion: {
    aside: ({ 
      children, 
      className, 
      initial: _initial, 
      animate: _animate, 
      transition: _transition 
    }: { 
      children: React.ReactNode; 
      className?: string;
      initial?: unknown;
      animate?: unknown;
      transition?: unknown;
    }) => (
      <aside className={className} data-testid="motion-aside">
        {children}
      </aside>
    ),
    div: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  },
}));

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
  
  // @ts-expect-error - We're intentionally modifying the global location for testing
  delete window.location;
  // @ts-expect-error - We're intentionally modifying the global location for testing
  window.location = location;
  
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
      { text: 'Newsletter Sources', href: '/newsletters' },
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

  it('toggles the mobile menu when menu button is clicked', () => {
    renderSidebar();
    
    // Menu button should be visible
    const menuButton = screen.getByTestId('menu-icon');
    fireEvent.click(menuButton);
    
    // The menu should now be open
    const closeButton = screen.getByTestId('close-icon');
    expect(closeButton).toBeInTheDocument();
  });

  it('copies email alias to clipboard when copy button is clicked', async () => {
    renderSidebar();
    
    // Find the copy button
    const copyButton = screen.getByTestId('copy-icon').closest('button');
    
    // Initial state check
    expect(copyButton).toHaveAttribute('title', 'Copy to clipboard');
    
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
      expect(copyButton).toHaveAttribute('title', 'Copy to clipboard');
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
});
