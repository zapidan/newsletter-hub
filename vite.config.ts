import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

// Convert file URL to directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@common', replacement: path.resolve(__dirname, './src/common') },
      { find: '@web', replacement: path.resolve(__dirname, './src/web') },
      { find: '@mobile', replacement: path.resolve(__dirname, './src/mobile') }
    ],
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      '@dnd-kit/modifiers'
    ],
    esbuildOptions: {
      // Enable esbuild's tree shaking
      treeShaking: true,
    },
  },
  define: {
    'process.env': {}
  },
  server: {
    port: 5174,
    strictPort: true,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
});
