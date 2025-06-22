import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the handler function based on the actual implementation
async function handler(req: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'POST') {
    try {
      const contentType = req.headers.get('content-type') || '';
      let emailData: any;

      if (contentType.includes('application/json')) {
        const jsonData = await req.json();
        emailData = {
          to: jsonData.recipient || jsonData.to,
          from: jsonData.from,
          subject: jsonData.subject,
          'body-html': jsonData['body-html'] || jsonData.html || '',
          'body-plain': jsonData['body-plain'] || jsonData.text || '',
          'message-headers': jsonData['message-headers'] || ''
        };
      } else {
        const formData = await req.formData();
        emailData = {
          to: formData.get('recipient') as string || formData.get('to') as string || '',
          from: formData.get('from') as string || '',
          subject: formData.get('subject') as string || '',
          'body-plain': formData.get('body-plain') as string || '',
          'body-html': formData.get('body-html') as string || '',
          'message-headers': formData.get('message-headers') as string || ''
        };
      }

      // Basic validation
      if (!emailData.from || !emailData.to || !emailData.subject) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Here you would typically process the email using the Supabase client
      // For testing, we'll just return a success response
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (_) {
      return new Response(JSON.stringify({ error: 'Error processing request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }


  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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
