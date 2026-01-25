import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import BackButton from '../BackButton';

// Mock the logger
vi.mock('@common/utils/logger/useLogger', () => ({
  useLogger: () => ({
    debug: vi.fn(),
  }),
}));

describe('BackButton', () => {
  const renderWithRouter = (component: React.ReactElement, initialEntries = ['/']) => {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        {component}
      </MemoryRouter>
    );
  };

  it('renders with default "Back to Inbox" text', () => {
    renderWithRouter(<BackButton />);

    expect(screen.getByText('Back to Inbox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    renderWithRouter(<BackButton text="Custom Back Text" />);

    expect(screen.getByText('Custom Back Text')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    renderWithRouter(<BackButton className="custom-class" />);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('renders custom children when provided', () => {
    renderWithRouter(
      <BackButton>
        <span data-testid="custom-icon">Icon</span>
      </BackButton>
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });
});
