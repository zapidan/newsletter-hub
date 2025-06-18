import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "mobile-app/**/*",
      "src/common/api/**/*",
      "src/common/config/**/*",
      "src/common/hooks/__tests__/**/*",
      "src/common/hooks/infiniteScroll/__tests__/**/*",
      "src/common/components/**/*",
      "src/common/contexts/**/*",
      "src/common/hooks/useEmailAlias.ts",
      "src/common/hooks/useErrorHandling.ts",
      "src/common/hooks/useInboxFilters.ts",
      "src/common/hooks/useLoadingStates.ts",
      "src/common/hooks/useNewsletterDetail.ts",
      "src/common/hooks/useNewsletterSources.ts",
      "src/common/hooks/useNewsletters.ts",
      "src/common/hooks/usePerformanceOptimizations.ts",
      "src/common/hooks/useReadingQueue.ts",
      "src/common/hooks/useTags.ts",
      "src/common/hooks/useUnreadCount.ts",
      "src/common/hooks/useUrlParams.ts",
      "src/common/hooks/infiniteScroll/useInfiniteNewsletters.ts",
      "src/common/utils/**/*",
      "src/common/types/**/*",
      "src/web/components/**/*",
      "src/web/pages/**/*",
      "src/web/services/**/*",
      "src/web/hooks/**/*",
      "src/web/lib/**/*",
      "src/components/debug/**/*",
      "supabase/**/*",
      "tests/**/*",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
);
