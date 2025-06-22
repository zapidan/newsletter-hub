import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emailHandler as handler } from './__mocks__/emailHandler';

// Mock any dependencies if needed
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
  })),
}));

describe('Email Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle CORS preflight request', async () => {
    const request = new Request('https://example.com/api/email', {
      method: 'OPTIONS',
    });

    const response = await handler(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should handle JSON POST request with valid data', async () => {
    const emailData = {
      from: 'sender@example.com',
      to: 'recipient@dzapatariesco.dev',
      subject: 'Test Email',
      'body-html': '<h1>Test</h1>',
      'body-plain': 'Test',
    };

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    const response = await handler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ success: true });
  });

  it('should handle form data POST request', async () => {
    const formData = new FormData();
    formData.append('from', 'sender@example.com');
    formData.append('to', 'recipient@dzapatariesco.dev');
    formData.append('subject', 'Test Email');
    formData.append('body-plain', 'Test message');
    formData.append('body-html', '<p>Test message</p>');

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      body: formData,
    });

    const response = await handler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({ success: true });
  });

  it('should handle missing required fields', async () => {
    const emailData = {
      from: 'sender@example.com',
      // Missing 'to' and 'subject'
    };

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    const response = await handler(request);
    const result = await response.json();

    expect(response.status).toBe(400);
    expect(result.error).toBe('Missing required fields');
  });

  it('should handle invalid JSON', async () => {
    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    });

    const response = await handler(request);
    expect(response.status).toBe(500);
  });

  it('should handle unsupported HTTP methods', async () => {
    const request = new Request('https://example.com/api/email', {
      method: 'GET',
    });

    const response = await handler(request);
    const result = await response.json();

    expect(response.status).toBe(405);
    expect(result.error).toBe('Method not allowed');
  });
});
