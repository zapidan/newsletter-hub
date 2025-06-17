import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// Convert file URL to directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    visualizer({
      open: true, // Automatically opens the report in the browser
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: true,
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/*.d.ts",
        "dist/",
        "build/",
        "coverage/",
        "**/*.config.{js,ts}",
        "**/index.{js,ts}",
      ],
    },
    include: ["src/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: [
      "node_modules",
      "dist",
      ".idea",
      ".git",
      ".cache",
      "src/**/*.e2e.{js,ts,jsx,tsx}",
      "src/**/e2e/**/*",
    ],
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@common", replacement: path.resolve(__dirname, "./src/common") },
      { find: "@web", replacement: path.resolve(__dirname, "./src/web") },
      { find: "@mobile", replacement: path.resolve(__dirname, "./src/mobile") },
    ],
  },
  optimizeDeps: {
    exclude: ["lucide-react"],
    include: [
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@dnd-kit/modifiers",
    ],
    esbuildOptions: {
      treeShaking: true,
    },
  },
  define: {
    "process.env": {},
  },
  server: {
    port: 5174,
    strictPort: true,
    open: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    chunkSizeWarningLimit: 1000, // Increase chunk size warning limit (in kbs)
    rollupOptions: {
      output: {
        manualChunks: {
          // Group large dependencies into separate chunks
          react: ["react", "react-dom", "react-router-dom"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-slot",
          ],
          dnd: [
            "@dnd-kit/core",
            "@dnd-kit/sortable",
            "@dnd-kit/utilities",
            "@dnd-kit/modifiers",
          ],
          // Add other large dependencies here
        },
      },
    },
  },
  esbuild: {
    logOverride: { "this-is-undefined-in-esm": "silent" },
  },
});
