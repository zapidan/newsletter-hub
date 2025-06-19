import { test as base } from '@playwright/test';
import { createMockSupabaseClient } from './test-utils/mock-supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

export const test = base.extend<{
  supabase: SupabaseClient;
}>({
  // Create a new Supabase client for each test
  supabase: async ({}, use) => {
    const supabase = createMockSupabaseClient();
    await use(supabase);
  },

  // Setup the page with our mocks
  page: async ({ page }, use) => {
    // Add the mock Supabase client to the page context
    await page.addInitScript(() => {
      // This runs in the browser context
      window.__MOCK_SUPABASE__ = window.__MOCK_SUPABASE__ || {};
    });

    // Add our browser setup script
    await page.addInitScript(() => {
      // Intercept fetch requests to Supabase
      const originalFetch = window.fetch;
      
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = input.toString();
        
        // Only intercept Supabase auth requests
        if (url.includes('supabase.co/auth/v1')) {
          const path = new URL(url).pathname;
          const body = init?.body ? JSON.parse(init.body.toString()) : {};
          
          // Handle login
          if (path.endsWith('/token') && init?.method === 'POST') {
            const { email, password } = body;
            const mockSupabase = (window as any).__MOCK_SUPABASE__;
            
            if (!mockSupabase) {
              return new Response(JSON.stringify({
                error: { message: 'Mock Supabase not initialized' }
              }), { status: 500 });
            }
            
            try {
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
            } catch (err) {
              return new Response(JSON.stringify({
                error: { message: err.message }
              }), { status: 500 });
            }
          }
          
          // Handle user info requests
          if (path.endsWith('/user') && init?.method === 'GET') {
            const mockSupabase = (window as any).__MOCK_SUPABASE__;
            
            if (!mockSupabase) {
              return new Response(JSON.stringify({
                error: { message: 'Mock Supabase not initialized' }
              }), { status: 500 });
            }
            
            try {
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
            } catch (err) {
              return new Response(JSON.stringify({
                error: { message: err.message }
              }), { status: 500 });
            }
          }
        }
        
        // For all other requests, use the original fetch
        return originalFetch(input, init);
      };
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
