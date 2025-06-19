import { createMockSupabaseClient } from './mock-supabase';

console.log('🔧 Using MOCK Supabase client for testing');

// Re-export the mock Supabase client for use in tests
export * from './mock-supabase';

// Create and export a default instance of the mock Supabase client
const mockClient = createMockSupabaseClient();

// Add logging to auth methods
const originalAuth = { ...mockClient.auth };

mockClient.auth = {
  ...originalAuth,
  signInWithPassword: async (credentials) => {
    console.log('🔑 Mock signInWithPassword called with:', credentials.email);
    return originalAuth.signInWithPassword(credentials);
  },
  signUp: async (credentials) => {
    console.log('📝 Mock signUp called for:', credentials.email);
    return originalAuth.signUp(credentials);
  },
  signOut: async () => {
    console.log('👋 Mock signOut called');
    return originalAuth.signOut();
  },
  getSession: async () => {
    const session = await originalAuth.getSession();
    console.log('🔍 Mock getSession called, session exists:', !!session.data.session);
    return session;
  },
  onAuthStateChange: (callback) => {
    console.log('🔄 Mock onAuthStateChange registered');
    return originalAuth.onAuthStateChange(callback);
  },
};

export default mockClient;
