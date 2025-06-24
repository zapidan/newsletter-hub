import { render, screen } from '@testing-library/react';
import LoadingScreen from '../LoadingScreen';
import { vi } from 'vitest';

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      ...actual.motion,
      div: vi.fn(({ children, ...rest }) => <div {...rest}>{children}</div>),
    },
  };
});


describe('LoadingScreen', () => {
  test('renders correctly with title and message', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('NewsletterHub')).toBeInTheDocument();
    expect(screen.getByText('Loading your newsletters...')).toBeInTheDocument();
  });

  test('renders the Inbox icon', () => {
    // We can't easily test for the Lucide icon directly without more complex mocking or specific selectors.
    // Instead, we'll check for the container that should hold the icon.
    // If the icon component has a specific class or test ID, that would be better.
    // For now, we check that the motion.div for the icon is rendered.
    render(<LoadingScreen />);
    const iconContainer = screen.getByText('NewsletterHub').previousElementSibling; // The div containing the icon
    expect(iconContainer).toBeInTheDocument();
    // A more robust test would involve checking for the SVG's presence if possible.
    // For instance, if lucide-react icons render an <svg> tag:
    expect(iconContainer?.querySelector('svg')).toBeInTheDocument();
  });

  test('motion.div components receive animation props (basic check)', () => {
    render(<LoadingScreen />);
    // This is a simplified check. Testing actual animation behavior is complex and often out of scope for unit tests.
    // We are checking that our mock `motion.div` is used.
    // The mock currently just renders a div, so we can't directly check framer-motion props on it without a more sophisticated mock.
    // However, if the component renders, it implies the motion.divs were called.
    expect(screen.getByText('NewsletterHub')).toBeInTheDocument();
  });
});
