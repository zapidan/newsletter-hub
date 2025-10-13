import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NewsletterIframe from '../NewsletterIframe';

describe('NewsletterIframe', () => {
  it('renders an iframe with the provided HTML content', async () => {
    const htmlContent = '<h1>Test Newsletter</h1><p>This is a test.</p>';
    render(<NewsletterIframe htmlContent={htmlContent} />);

    // Wait for the iframe to load and content to be set
    await waitFor(() => {
      const iframe = screen.getByTitle('Newsletter Content') as HTMLIFrameElement;
      expect(iframe).toBeInTheDocument();
      const iframeDocument = iframe.contentDocument;
      expect(iframeDocument?.body.innerHTML).toContain('<h1>Test Newsletter</h1>');
    });
  });
});