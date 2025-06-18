import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportsDirectory: "./coverage",

      // Coverage thresholds
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },

      // Files to include in coverage
      include: ["src/**/*.{js,ts,jsx,tsx}"],

      // Files to exclude from coverage
      exclude: [
        "src/**/*.{test,spec}.{js,ts,jsx,tsx}",
        "src/**/*.integration.{test,spec}.{js,ts,jsx,tsx}",
        "src/**/*.e2e.{test,spec}.{js,ts,jsx,tsx}",
        "src/__tests__/**",
        "src/**/__tests__/**",
        "src/**/*.d.ts",
        "src/**/index.{js,ts}",
        "src/**/types.{js,ts}",
        "src/**/constants.{js,ts}",
        "src/**/config/**",
        "src/**/mocks/**",
        "src/**/fixtures/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "node_modules/**",
        "dist/**",
        "build/**",
        "**/*.config.{js,ts}",
        "**/coverage/**",
        "**/playwright-report/**",
        "**/test-results/**",
      ],

      // Include all files even if not imported
      all: true,

      // Clean coverage directory before running
      clean: true,
    },
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
