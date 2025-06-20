import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";


export default tseslint.config(
  {
    ignores: [
      ".gitignore",
      "dist",
      "mobile-app/**/*",
      "coverage/*",
      // "src/common/api/**/*",
      // "src/common/config/**/*",
      "src/common/api/__mocks__/*",
      "src/common/hooks/__mocks__/*",
      "src/common/hooks/__tests__/**/*",
      "src/common/hooks/infiniteScroll/__tests__/**/*",
      "src/common/hooks/infiniteScroll/__mocks__/*",
      "src/common/components/__mocks__/*",
      "src/common/components/__tests__/**/*",
      "src/common/contexts/__mocks__/*",
      "src/common/contexts/__tests__/**/*",
      "src/web/services/__tests__/**/*",
      "src/web/hooks/__tests__/**/*",
      "src/web/lib/__tests__/**/*",
      "src/web/components/__tests__/**/*",
      "src/web/pages/__tests__/**/*",
      "src/web/services/__mocks__/*",
      "src/web/hooks/__mocks__/*",
      "src/web/lib/__mocks__/*",
      "src/web/components/__mocks__/*",
      "src/web/pages/__mocks__/*",
      "src/web/services/__tests__/**/*",
      "src/web/hooks/__tests__/**/*",
      "src/web/lib/__tests__/**/*",
      "src/web/components/__tests__/**/*",
      "src/web/pages/__tests__/**/*",
      "src/web/services/__mocks__/*",
      "src/web/hooks/__mocks__/*",
      "src/web/lib/__mocks__/*",
      "src/web/components/__mocks__/*",
      "src/web/pages/__mocks__/*",
      "playwright/**/*",
      "playwright.config.ts",
      "playwright-report/**/*",
      "test-results/**/*",
      // "src/common/components/**/*",
      // "src/common/contexts/**/*",
      // "src/common/hooks/useEmailAlias.ts",
      // "src/common/hooks/useErrorHandling.ts",
      // "src/common/hooks/useInboxFilters.ts",
      // "src/common/hooks/useLoadingStates.ts",
      // "src/common/hooks/useNewsletterDetail.ts",
      // "src/common/hooks/useNewsletterSources.ts",
      // "src/common/hooks/useNewsletters.ts",
      // "src/common/hooks/usePerformanceOptimizations.ts",
      // "src/common/hooks/useReadingQueue.ts",
      // "src/common/hooks/useTags.ts",
      // "src/common/hooks/useUnreadCount.ts",
      // "src/common/hooks/useUrlParams.ts",
      // "src/common/hooks/infiniteScroll/useInfiniteNewsletters.ts",
      // "src/common/utils/**/*",
      // "src/common/types/**/*",
      // "src/web/components/**/*",
      // "src/web/pages/**/*",
      // "src/web/services/**/*",
      // "src/web/hooks/**/*",
      // "src/web/lib/**/*",
      "src/components/debug/**/*",
      "scripts/**/*",
      "src/common/utils/database/cleanupUtils.ts",
      "src/common/utils/database/seedUtils.ts",
      "supabase/**/*",
      "tests/**/*",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // React rules
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/display-name": "off",
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // TypeScript rules
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    },
  },
);
