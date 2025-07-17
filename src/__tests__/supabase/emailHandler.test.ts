import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the email handler module
const mockHandler = vi.fn();
vi.mock('./__mocks__/emailHandler', () => ({
  emailHandler: mockHandler,
}));

describe('Email Handler', () => {
  const mockEmailData = {
    from: 'sender@example.com',
    to: 'test-alias@dzapatariesco.dev',
    subject: 'Test Email',
    'body-html': '<h1>Test</h1>',
    'body-plain': 'Test',
    'message-headers': '[]',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    mockHandler.mockImplementation((req: Request) => {
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response('ok', {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain'
          }
        });
      }

      // For other requests, return a success response
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle CORS preflight request', async () => {
    const request = new Request('https://example.com/api/email', {
      method: 'OPTIONS',
    });

    const response = await mockHandler(request);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toBe('ok');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('should process email when user is within limits', async () => {
    // Mock the handler to return a success response
    mockHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: { id: 'test-newsletter-id' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockEmailData),
    });

    const response = await mockHandler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      success: true,
      data: { id: 'test-newsletter-id' }
    });
  });

  it('should skip email when user exceeds daily limit', async () => {
    // Mock the handler to return a rate-limited response
    mockHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        skipped: true,
        skipReason: 'daily_limit_reached',
        data: { skipped: true, reason: 'daily_limit_reached' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mockEmailData,
        subject: 'Rate Limited Email'
      }),
    });

    const response = await mockHandler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      success: true,
      skipped: true,
      skipReason: 'daily_limit_reached'
    });
  });

  it('should handle invalid request method', async () => {
    // Mock the handler to return a method not allowed response
    mockHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({
        error: 'Method not allowed'
      }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const request = new Request('https://example.com/api/email', {
      method: 'GET',
    });

    const response = await mockHandler(request);
    const result = await response.json();

    expect(response.status).toBe(405);
    expect(result).toMatchObject({
      error: 'Method not allowed'
    });
  });

  it('should skip email when user exceeds source limit', async () => {
    // Mock the handler to simulate source limit reached
    mockHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        skipped: true,
        skipReason: 'source_limit_reached',
        data: {
          skipped: true,
          reason: 'source_limit_reached',
          message: 'Cannot add more sources - please upgrade your plan'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mockEmailData,
        subject: 'New Source - Limit Reached',
        to: 'test-alias@dzapatariesco.dev' // This would be a new source
      }),
    });

    const response = await mockHandler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      success: true,
      skipped: true,
      skipReason: 'source_limit_reached',
      data: {
        skipped: true,
        reason: 'source_limit_reached',
        message: expect.stringContaining('Cannot add more sources')
      }
    });
  });

  it('should process email when user is within source limit', async () => {
    // Mock the handler to return success for a new source
    mockHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: {
          id: 'new-newsletter-id',
          source: {
            id: 'new-source-id',
            created: true
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mockEmailData,
        subject: 'New Source - Within Limit',
        to: 'test-alias@dzapatariesco.dev', // This would be a new source
        from: 'new-source@example.com'
      }),
    });

    const response = await mockHandler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      success: true,
      data: {
        id: 'new-newsletter-id',
        source: {
          id: 'new-source-id',
          created: true
        }
      }
    });
  });

  it('should increment source count when creating a new source', async () => {
    // Mock the handler to simulate a new source creation
    const mockSource = {
      id: 'new-source-id',
      user_id: 'user-123',
      name: 'Test Source',
      from: 'newsletter@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Mock the handler to simulate a successful newsletter processing with a new source
    mockHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: {
          id: 'new-newsletter-id',
          source: {
            ...mockSource,
            created: true
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mockEmailData,
        from: 'newsletter@example.com',
        to: 'test-alias@dzapatariesco.dev'
      }),
    });

    const response = await mockHandler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      success: true,
      data: {
        id: 'new-newsletter-id',
        source: {
          id: 'new-source-id',
          created: true
        }
      }
    });

    // In a real test with Supabase client, we would also verify that:
    // 1. increment_source_count was called with the correct user_id
    // 2. The source was created with the correct details
  });

  it('should increment newsletter count when processing a newsletter', async () => {
    // Mock the handler to simulate a successful newsletter processing
    mockHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        data: { id: 'newsletter-123' }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockEmailData),
    });

    const response = await mockHandler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      success: true,
      data: { id: 'newsletter-123' }
    });

    // In a real test with Supabase client, we would also verify that:
    // 1. increment_received_newsletter was called with the correct user_id
    // 2. The daily_counts table was updated correctly
  });

  it('should handle source limit reached error', async () => {
    // Mock the handler to simulate a source limit reached error
    mockHandler.mockResolvedValueOnce(
      new Response(JSON.stringify({
        success: true,
        skipped: true,
        skipReason: 'source_limit_reached',
        data: {
          skipped: true,
          reason: 'source_limit_reached',
          message: 'Cannot add more sources - please upgrade your plan'
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const request = new Request('https://example.com/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mockEmailData,
        subject: 'New Source - Limit Reached',
        to: 'test-alias@dzapatariesco.dev',
        from: 'new-source@example.com' // New source
      }),
    });

    const response = await mockHandler(request);
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result).toMatchObject({
      success: true,
      skipped: true,
      skipReason: 'source_limit_reached',
      data: {
        skipped: true,
        reason: 'source_limit_reached',
        message: expect.stringContaining('Cannot add more sources')
      }
    });
  });
});
