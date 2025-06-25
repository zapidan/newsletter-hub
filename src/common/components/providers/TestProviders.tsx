import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SupabaseProvider, AuthProvider } from "@common/contexts";
import { ToastProvider } from "@common/contexts/ToastContext";
import { FilterProvider } from "@common/contexts/FilterContext";

// Test wrapper for unit tests
export const TestProviders: React.FC<{
  children: React.ReactNode;
  initialFilters?: any;
  mockToasts?: boolean;
}> = ({ children, mockToasts = false }) => {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={testQueryClient}>
      <SupabaseProvider>
        <AuthProvider>
          <ToastProvider defaultDuration={mockToasts ? 0 : 5000}>
            <FilterProvider>{children}</FilterProvider>
          </ToastProvider>
        </AuthProvider>
      </SupabaseProvider>
    </QueryClientProvider>
  );
};
