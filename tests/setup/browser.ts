import { createMockSupabaseClient } from '../e2e/test-utils/mock-supabase';

// Mock the Supabase client before any tests run
const mockSupabase = createMockSupabaseClient();

// Store the original fetch
const originalFetch = window.fetch;

// Mock the fetch API to handle Supabase auth requests
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input.toString();
  
  // Intercept Supabase auth requests
  if (url.includes('supabase.co/auth/v1')) {
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(init.body.toString()) : {};
    
    // Handle token request (login)
    if (path.endsWith('/token') && init?.method === 'POST') {
      const { email, password } = body;
      const { data, error } = await mockSupabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        return new Response(JSON.stringify({ error }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // Handle user info request
    if (path.endsWith('/user') && init?.method === 'GET') {
      const { data, error } = await mockSupabase.auth.getUser();
      
      if (error) {
        return new Response(JSON.stringify({ error }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  
  // For all other requests, use the original fetch
  return originalFetch(input, init);
};

// Expose the mock Supabase client for use in tests
(window as any).__MOCK_SUPABASE__ = mockSupabase;
