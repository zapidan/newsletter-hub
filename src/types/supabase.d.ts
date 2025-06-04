/// <reference types="@supabase/supabase-js" />

declare module '../utils/supabaseClient' {
  import { SupabaseClient } from '@supabase/supabase-js';
  
  export const supabase: SupabaseClient;
}
