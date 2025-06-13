import { createClient, SupabaseClient, AuthError } from "@supabase/supabase-js";

// Configuration constants
const SUPABASE_CONFIG = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce" as const,
  },
  global: {
    headers: {
      "X-Client-Info": "newsletter-hub-web",
    },
  },
  db: {
    schema: "public",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
} as const;

// Environment variables validation
const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missingVars.push("VITE_SUPABASE_ANON_KEY");

  console.error(
    `Missing required Supabase environment variables: ${missingVars.join(", ")}. ` +
      "Please check your .env file and ensure all required variables are set.",
  );

  if (import.meta.env.MODE === "development") {
    console.warn(
      "Running in development mode with missing Supabase configuration",
    );
  }
}

// Create the Supabase client
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  SUPABASE_CONFIG,
);

// Enhanced error handling utilities
export class SupabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
    public hint?: string,
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

// Error handler utility
export const handleSupabaseError = (error: unknown): never => {
  if (!error) {
    throw new SupabaseError("Unknown error occurred");
  }

  // Handle different types of errors
  if (error.code) {
    switch (error.code) {
      case "PGRST116":
        throw new SupabaseError(
          "No data found",
          error.code,
          error.details,
          "The requested resource does not exist or you do not have permission to access it",
        );
      case "23505":
        throw new SupabaseError(
          "Duplicate entry",
          error.code,
          error.details,
          "A record with this information already exists",
        );
      case "23503":
        throw new SupabaseError(
          "Foreign key constraint violation",
          error.code,
          error.details,
          "Referenced record does not exist",
        );
      case "42501":
        throw new SupabaseError(
          "Insufficient privileges",
          error.code,
          error.details,
          "You do not have permission to perform this action",
        );
      default:
        throw new SupabaseError(
          error.message || "Database error occurred",
          error.code,
          error.details,
          error.hint,
        );
    }
  }

  // Handle auth errors
  if (error instanceof AuthError) {
    throw new SupabaseError(
      error.message,
      "AUTH_ERROR",
      error,
      "Authentication required or invalid credentials",
    );
  }

  // Handle network errors
  if (error.name === "NetworkError" || error.message?.includes("fetch")) {
    throw new SupabaseError(
      "Network error occurred",
      "NETWORK_ERROR",
      error,
      "Please check your internet connection and try again",
    );
  }

  // Generic error handling
  throw new SupabaseError(
    error.message || "An unexpected error occurred",
    "UNKNOWN_ERROR",
    error,
  );
};

// Auth state management utilities
export const getCurrentUser = async () => {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) handleSupabaseError(error);
    return user;
  } catch (error) {
    handleSupabaseError(error);
  }
};

export const getCurrentSession = async () => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) handleSupabaseError(error);
    return session;
  } catch (error) {
    handleSupabaseError(error);
  }
};

// Utility to ensure user is authenticated
export const requireAuth = async () => {
  const user = await getCurrentUser();
  if (!user) {
    throw new SupabaseError(
      "User not authenticated",
      "AUTH_REQUIRED",
      null,
      "Please sign in to continue",
    );
  }
  return user;
};

// Connection health check
export const checkConnection = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from("users").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
};

// Performance monitoring
export const withPerformanceLogging = async <T>(
  operation: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;

    if (import.meta.env.MODE === "development") {
      console.log(
        `[Supabase] ${operation} completed in ${duration.toFixed(2)}ms`,
      );
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;

    if (import.meta.env.MODE === "development") {
      console.error(
        `[Supabase] ${operation} failed after ${duration.toFixed(2)}ms:`,
        error,
      );
    }

    throw error;
  }
};

// Export the client as default for backward compatibility
export default supabase;
