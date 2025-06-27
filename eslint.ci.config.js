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
      "html/**/*",
      "**/__tests__/**/*",
      "**/__mocks__/**/*",
      "**/*.test.{js,jsx,ts,tsx}",
      "**/*.spec.{js,jsx,ts,tsx}",
      "**/*.smoke.{js,jsx,ts,tsx}",
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
      "src/common/services/__tests__/**/*",
      "src/common/services/__mocks__/*",
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
      "react-refresh/only-export-components": "off",
      // TypeScript rules - more lenient for CI
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      // Relax rules for CI
      "react-hooks/exhaustive-deps": "off",
    },
  },
); 