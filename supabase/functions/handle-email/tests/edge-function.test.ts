import { load } from "https://deno.land/std@0.203.0/dotenv/mod.ts";
await load({ envPath: ".env.test", export: true });

import handler from '../index.ts';

Deno.test('should handle CORS preflight request', async () => {
  const req = new Request('http://localhost', { method: 'OPTIONS' });
  const res = await handler(req);
  const text = await res.text();
  if (text !== 'ok' || res.status !== 200) throw new Error('CORS preflight failed');
});

Deno.test('should return 405 for unsupported method', async () => {
  const req = new Request('http://localhost', { method: 'GET' });
  const res = await handler(req);
  if (res.status !== 405) throw new Error('Expected 405 for GET');
});

Deno.test('should process valid POST (JSON)', async () => {
  const payload = {
    to: 'newsletters@gmail.com',
    from: 'sender@example.com',
    subject: 'Test Email',
    'body-plain': 'This is a test email body',
    'body-html': '<p>This is a test email body</p>',
    'message-headers': 'From: sender@example.com\nTo: test@example.com\nSubject: Test Email'
  };
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const mockSupabase = {
    from: (table: string) => ({
      select: () => ({
        ilike: () => ({
          ilike: () => Promise.resolve({ data: [{ id: 'id1', from: 'sender@example.com', name: 'Correct Name', is_archived: false }], error: null }),
        }),
        eq: () => ({
          single: () => Promise.resolve({ data: { id: 'user-1' }, error: null })
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'source-1', is_archived: false }, error: null })
        })
      })
    }),
    rpc: () => Promise.resolve({ data: true, error: null })
  };
  const res = await handler(req, mockSupabase);
  if (res.status !== 200) {
    console.log('Handler response:', await res.text());
    throw new Error('Expected 200 for valid POST');
  }
  const json = await res.json();
  if (!json.success) throw new Error('Expected success in response');
});

Deno.test('should return 400 for invalid POST (malformed JSON)', async () => {
  const req = new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid json}'
  });
  const res = await handler(req);
  if (res.status !== 400) throw new Error('Expected 400 for malformed JSON');
});

Deno.test('should process valid POST (form data)', async () => {
  const form = new FormData();
  form.set('to', 'newsletters@gmail.com');
  form.set('from', 'sender@example.com');
  form.set('subject', 'Test Email');
  form.set('body-plain', 'This is a test email body');
  form.set('body-html', '<p>This is a test email body</p>');
  form.set('message-headers', 'From: sender@example.com\nTo: test@example.com\nSubject: Test Email');
  const req = new Request('http://localhost', {
    method: 'POST',
    body: form
  });
  const mockSupabase = {
    from: (table: string) => ({
      select: () => ({
        ilike: () => ({
          ilike: () => Promise.resolve({ data: [{ id: 'id1', from: 'sender@example.com', name: 'Correct Name', is_archived: false }], error: null }),
        }),
        eq: () => ({
          single: () => Promise.resolve({ data: { id: 'user-1' }, error: null })
        })
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'source-1', is_archived: false }, error: null })
        })
      })
    }),
    rpc: () => Promise.resolve({ data: true, error: null })
  };
  const res = await handler(req, mockSupabase);
  if (res.status !== 200) {
    console.log('Handler response:', await res.text());
    throw new Error('Expected 200 for valid form POST');
  }
  const json = await res.json();
  if (!json.success) throw new Error('Expected success in response');
});

// All tests below referenced the removed processIncomingEmail. They have been deleted
// to reflect the new single-file implementation. Additional end-to-end coverage should
// be exercised through handler-based requests.