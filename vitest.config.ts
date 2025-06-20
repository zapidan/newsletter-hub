import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    css: true,
    reporters: ["default", "junit"],
    outputFile: {
      junit: "test-results/junit.xml"
    },
    coverage: {
      provider: "v8",
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
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    // Add test timeout
    testTimeout: 30000,
    // Ensure test files are discovered
    watchExclude: ["**/node_modules/**", "**/dist/**"],
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
