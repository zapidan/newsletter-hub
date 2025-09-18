import { assert } from "https://deno.land/std@0.203.0/assert/mod.ts";
import { load } from "https://deno.land/std@0.203.0/dotenv/mod.ts";
await load({ envPath: ".env.test", export: true });
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

import handler, { processIncomingEmail } from '../../../supabase/functions/handle-email/index.ts';

// Helper function to create a mock Supabase client
function createMockSupabase(overrides: any = {}) {
  return {
    auth: {
      getUser: () => Promise.resolve({
        data: {
          user: {
            id: 'user-1',
            email: 'test@example.com'
          }
        },
        error: null
      })
    },
    from: (table: string) => {
      // Handle users table queries
      if (table === 'users') {
        return {
          select: () => ({
            eq: (column: string, value: string) => ({
              single: () => {
                // Match by explicit id (used in some paths)
                if (column === 'id' && value === 'user-1') {
                  return Promise.resolve({
                    data: {
                      id: 'user-1',
                      email: 'test@example.com',
                      email_alias: 'test@example.com'
                    },
                    error: null
                  });
                }
                // Match by explicit email
                if (column === 'email' && value === 'test@example.com') {
                  return Promise.resolve({
                    data: {
                      id: 'user-1',
                      email: 'test@example.com',
                      email_alias: 'test@example.com'
                    },
                    error: null
                  });
                }
                // General case: resolve any email_alias to user-1 for tests
                if (column === 'email_alias') {
                  return Promise.resolve({
                    data: {
                      id: 'user-1',
                      email: value,
                      email_alias: value
                    },
                    error: null
                  });
                }
                return Promise.resolve({ data: null, error: null });
              }
            })
          })
        };
      }

      // Handle newsletter_sources table queries
      if (table === 'newsletter_sources') {
        return {
          // select('*').eq('name', ...).eq('user_id', ...) resolves to an array
          select: () => {
            const filters: Record<string, any> = {};
            const thenable: any = {
              eq: (column: string, value: any) => {
                filters[column] = value;
                return thenable;
              },
              then: (resolve: any, reject: any) => {
                try {
                  let result: any[] = [];
                  // Archived source scenario
                  if (
                    (filters['name'] === 'archived@example.com' || filters['name'] === 'Archived Source') &&
                    filters['user_id'] === 'user-1'
                  ) {
                    result = [{
                      id: 'archived-1',
                      from: 'archived@example.com',
                      name: filters['name'] || 'Archived Source',
                      is_archived: true,
                      user_id: 'user-1'
                    }];
                  }
                  resolve({ data: result, error: null });
                } catch (e) {
                  reject?.(e);
                }
              }
            };
            return thenable;
          },
          insert: (data: any) => ({
            select: () => ({
              single: () => {
                const row = Array.isArray(data) ? (data[0] ?? {}) : data;
                const ensuredUserId = row.user_id || 'user-1';
                return Promise.resolve({
                  data: {
                    id: 'source-1',
                    ...row,
                    is_archived: false,
                    user_id: ensuredUserId
                  },
                  error: null
                });
              }
            })
          })
        };
      }

      // Handle skipped_newsletters table
      if (table === 'skipped_newsletters') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({
                data: { id: 'skip-1' },
                error: null
              })
            })
          })
        };
      }

      // Default handler for other tables
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: null })
          })
        })
      };
    },
    rpc: (fn: string, params: any) => {
      if (fn === 'can_receive_newsletter') {
        return Promise.resolve({ data: { can_receive: true, reason: null }, error: null });
      }
      if (fn === 'can_add_source') {
        return Promise.resolve({ data: true, error: null });
      }
      if (fn === 'increment_source_count') {
        return Promise.resolve({ data: null, error: null });
      }
      if (fn === 'handle_incoming_email_transaction') {
        return Promise.resolve({ data: { id: 'newsletter-1' }, error: null });
      }
      return overrides.rpc ? overrides.rpc(fn, params) : Promise.resolve({ data: true, error: null });
    }
  };
}

function setupTimerMocks() {
  let timeouts: Array<{ id: number; handler: () => void; time: number }> = [];
  let nextId = 1;

  globalThis.setTimeout = (handler: () => void, time = 0) => {
    const id = nextId++;
    timeouts.push({ id, handler, time });
    return id as unknown as ReturnType<typeof setTimeout>;
  };

  globalThis.clearTimeout = (id: number) => {
    timeouts = timeouts.filter(t => t.id !== id);
  };

  return {
    runAllTimers: () => {
      const currentTimeouts = [...timeouts];
      timeouts = [];
      currentTimeouts.forEach(({ handler }) => handler());
    },
    restore: () => {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    }
  };
}

// Test data
const baseEmailData = {
  to: 'user-1@example.dev',  // Using user-1 as the local part
  from: 'sender@example.com',
  subject: 'Test Email',
  'body-plain': 'Test email body',
  'body-html': '<p>Test email body</p>',
  'message-headers': `From: sender@example.com\nTo: user-1@example.dev\nSubject: Test Email\nX-User-Id: user-1`
};

// Tests
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
  const timerMocks = setupTimerMocks();
  try {
    const req = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'  // Add auth header
      },
      body: JSON.stringify(baseEmailData)
    });

    const res = await handler(req, createMockSupabase());
    timerMocks.runAllTimers();

    if (res.status !== 200) {
      const text = await res.text();
      console.log('Handler response:', text);
      throw new Error(`Expected 200, got ${res.status}: ${text}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error('Expected success in response');
    }
  } finally {
    timerMocks.restore();
  }
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
  const timerMocks = setupTimerMocks();
  try {
    const form = new FormData();
    Object.entries(baseEmailData).forEach(([key, value]) => {
      form.set(key, String(value));
    });

    const req = new Request('http://localhost', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test-token'  // Add auth header
      },
      body: form
    });

    const res = await handler(req, createMockSupabase());
    timerMocks.runAllTimers();

    if (res.status !== 200) {
      const text = await res.text();
      console.log('Handler response:', text);
      throw new Error(`Expected 200, got ${res.status}: ${text}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error('Expected success in response');
    }
  } finally {
    timerMocks.restore();
  }
});

Deno.test('should skip processing for archived source', async () => {
  const result = await processIncomingEmail({
    ...baseEmailData,
    from: 'archived@example.com'
  }, createMockSupabase());

  assert(result.skipped, 'Expected email to be skipped');
  assert(
    result.skipReason === 'source_archived',
    `Expected skipReason to be 'source_archived', got ${result.skipReason}`
  );
});

Deno.test('should handle duplicate emails gracefully', async () => {
  const timerMocks = setupTimerMocks();
  try {
    const base = createMockSupabase();
    const mockSupabase = {
      ...base,
      rpc: (fn: string, params: any) => {
        if (fn === 'can_receive_newsletter') {
          return Promise.resolve({ data: { can_receive: true, reason: null }, error: null });
        }
        if (fn === 'handle_incoming_email_transaction') {
          // Return error object (Supabase shape), not a rejected promise
          return Promise.resolve({
            data: null,
            error: { message: 'duplicate key value violates unique constraint', code: '23505' }
          });
        }
        return Promise.resolve({ data: null, error: null });
      }
    };

    const result = await processIncomingEmail({
      ...baseEmailData,
      from: 'duplicate@example.com'
    }, mockSupabase);

    timerMocks.runAllTimers();

    if (result.skipped) {
      assert(
        result.skipReason === 'duplicate' || result.skipReason === 'limit_reached',
        `Expected skipReason to be 'duplicate' or 'limit_reached', got ${result.skipReason}`
      );
    } else {
      assert(
        result.error && (result.error.includes('duplicate') || result.error.includes('23505')),
        `Expected duplicate error, got: ${result.error}`
      );
    }
  } finally {
    timerMocks.restore();
  }
});

Deno.test('should handle malformed email addresses', async () => {
  const testCases = [
    { email: 'invalid-email', description: 'missing @ symbol' },
    { email: 'user@', description: 'missing domain' },
    { email: '@example.com', description: 'missing local part' }
  ];

  for (const { email, description } of testCases) {
    const result = await processIncomingEmail({
      ...baseEmailData,
      to: email
    }, createMockSupabase());

    if (result.skipped) {
      assert(
        result.skipReason === 'unknown_recipient' ||
        result.skipReason === 'limit_reached',
        `Expected skipReason to be 'unknown_recipient' or 'limit_reached', got ${result.skipReason}`
      );
    } else {
      assert(
        result.error &&
        (result.error.includes('Invalid recipient') ||
          result.error.includes('validation failed')),
        `Expected validation error for ${description}, got: ${result.error}`
      );
    }
  }
});