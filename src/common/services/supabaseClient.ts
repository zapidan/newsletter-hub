// This file is kept for backward compatibility
// The enhanced Supabase client is now located in ../api/supabaseClient.ts

export {
  supabase,
  handleSupabaseError,
  getCurrentUser,
  getCurrentSession,
  requireAuth,
  checkConnection,
  withPerformanceLogging,
  SupabaseError,
} from "../api/supabaseClient";

// Legacy default export for backward compatibility
export { supabase as default } from "../api/supabaseClient";
