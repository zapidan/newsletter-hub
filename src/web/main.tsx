import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';  // This imports from /src/web/index.css
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SupabaseProvider } from '@common/contexts/SupabaseContext';
import { AuthProvider } from '@common/contexts/AuthContext';

// Create a client with optimized caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (garbage collection time)
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Ensure the root element exists
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// Create a root
const root = ReactDOM.createRoot(rootElement);

// Initial render
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SupabaseProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </SupabaseProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
