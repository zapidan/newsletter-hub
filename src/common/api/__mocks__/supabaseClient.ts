import { createMockSupabaseClient } from '../../../../tests/e2e/test-utils/mock-supabase';
import { handleSupabaseError } from '../supabaseClient';

// Use the mock Supabase client from our test utilities
const supabase = createMockSupabaseClient();

// Re-export the mock client with the same interface as the real one
export {
  supabase,
  handleSupabaseError,
  getCurrentUser,
  getCurrentSession,
  requireAuth,
  checkConnection,
  withPerformanceLogging,
  SupabaseError,
} from '../supabaseClient';

// Default export for backward compatibility
export default supabase;
