/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";

// Convert file URL to directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode
  const env = loadEnv(mode, process.cwd(), '');

  // Check if we're in test environment
  const isTest = mode === 'test';
  const isDev = mode === 'development';
  const isProd = mode === 'production';

  // Base alias configuration
  const baseAliases = [
    { find: "@", replacement: path.resolve(__dirname, "./src") },
    { find: "@common", replacement: path.resolve(__dirname, "./src/common") },
    { find: "@web", replacement: path.resolve(__dirname, "./src/web") },
    { find: "@mobile", replacement: path.resolve(__dirname, "./src/mobile") },
    { find: "@test-utils", replacement: path.resolve(__dirname, "./tests/test-utils") },
  ];

  // Add test-specific aliases
  const testAliases = isTest ? [
    // Point all Supabase client imports to our mock implementation
    {
      find: /@supabase\/supabase-js$/,
      replacement: path.resolve(__dirname, 'tests/test-utils/mock-supabase-client.ts')
    },
    // Alias the application's supabase client to our mock
    {
      find: /@\/common\/services\/supabaseClient$/,
      replacement: path.resolve(__dirname, 'tests/test-utils/mock-supabase-client.ts')
    },
    // Ensure any other supabase client imports use our mock
    {
      find: /supabase-js/,
      replacement: path.resolve(__dirname, 'tests/test-utils/mock-supabase-client.ts')
    }
  ] : [];

  return {
    plugins: [
      react(),
      // Visualize bundle size in development
      isDev && visualizer({
        open: true,
        filename: './dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),

    resolve: {
      alias: [...baseAliases, ...testAliases],
    },

    // Test configuration
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        enabled: true,
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        reportsDirectory: './coverage',
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/coverage/**',
          '**/*.d.ts',
          '**/*.test.{js,ts,jsx,tsx}',
          '**/test-utils/**',
          '**/__mocks__/**',
          '**/__tests__/**',
          '**/vite.config.*',
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },

    // Server configuration
    server: {
      port: 5174, // Use a different port for test to avoid conflicts
      strictPort: true,
      open: !isTest, // Don't open browser in test mode
    },

    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: isDev,
      minify: isProd ? 'esbuild' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            vendor: ['@tanstack/react-query', 'date-fns'],
          },
        },
      },
    },

    // Environment variables
    define: {
      'process.env': {
        ...Object.entries(env).reduce((acc, [key, val]) => {
          // Only include VITE_ prefixed env vars
          if (key.startsWith('VITE_')) {
            acc[key] = JSON.stringify(val);
          }
          return acc;
        }, {} as Record<string, string>),
        // Ensure test environment knows it's in test mode
        VITE_IS_TEST: JSON.stringify(isTest),
      },
    },
  };
});
