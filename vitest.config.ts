import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: true,
    reporters: process.env.CI ? ["junit", "default"] : ["default", "junit"],
    outputFile: {
      junit: "test-results/junit.xml"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportsDirectory: "./html",

      // More realistic coverage thresholds for current state
      thresholds: {
        global: {
          statements: 40,
          branches: 50,
          functions: 40,
          lines: 40,
        },
        // Per-file thresholds for critical files
        "./src/common/api/": {
          statements: 60,
          branches: 60,
          functions: 60,
          lines: 60,
        },
        "./src/common/services/": {
          statements: 70,
          branches: 65,
          functions: 70,
          lines: 70,
        },
      },

      exclude: [
        "node_modules/",
        "src/__tests__/",
        "**/*.d.ts",
        "dist/",
        "build/",
        "coverage/",
        "html/",
        "**/*.config.{js,ts}",
        "**/index.{js,ts}",
        "src/**/*.test.{js,ts,jsx,tsx}",
        "src/**/*.spec.{js,ts,jsx,tsx}",
        "src/**/__mocks__/**",
        "src/**/mocks/**",
        "src/**/fixtures/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "mobile-app/**",
        "scripts/**",
        "tests/**",
      ],

      // Include all files even if not imported
      all: true,

      // Clean coverage directory before running
      clean: true,
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
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    // Add test timeout
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@common": resolve(__dirname, "./src/common"),
      "@web": resolve(__dirname, "./src/web"),
      "@mobile": resolve(__dirname, "./src/mobile"),
    },
  },
});
