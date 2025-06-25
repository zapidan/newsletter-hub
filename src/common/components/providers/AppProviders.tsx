import React from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { SupabaseProvider, AuthProvider } from "@common/contexts";
import { ToastProvider } from "@common/contexts/ToastContext";
import { FilterProvider } from "@common/contexts/FilterContext";
import { ToastContainer } from "@common/components/ui/ToastContainer";

export interface AppProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
  enableDevtools?: boolean;
  toastPosition?:
    | "top-right"
    | "top-left"
    | "top-center"
    | "bottom-right"
    | "bottom-left"
    | "bottom-center";
  maxToasts?: number;
}

// Create a default query client if none is provided
const createDefaultQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors except 408, 429
          if (error?.status >= 400 && error?.status < 500) {
            return error?.status === 408 || error?.status === 429
              ? failureCount < 2
              : false;
          }
          // Retry on network errors and 5xx errors
          return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        retry: (failureCount, error: any) => {
          // Don't retry mutations on 4xx errors
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });

export const AppProviders: React.FC<AppProvidersProps> = ({
  children,
  queryClient,
  enableDevtools = process.env.NODE_ENV === "development",
  toastPosition = "top-right",
  maxToasts = 5,
}) => {
  const client = queryClient || createDefaultQueryClient();

  return (
    <BrowserRouter>
      <QueryClientProvider client={client}>
        <SupabaseProvider>
          <AuthProvider>
            <ToastProvider defaultDuration={5000} maxToasts={maxToasts}>
              <FilterProvider>
                {children}
                <ToastContainer
                  position={toastPosition}
                  maxToasts={maxToasts}
                />
              </FilterProvider>
            </ToastProvider>
          </AuthProvider>
        </SupabaseProvider>
        {enableDevtools && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </BrowserRouter>
  );
};

export default AppProviders;
