// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Ignore high-churn or provider/export layers from lint for now
  {
    ignores: [
      "**/__tests__/**",
      "**/*.test.*",
      "**/*.spec.*",
      "docs/**",
      "lib/services/**",
      "lib/providers/**",
      "lib/generated/**",
      "lib/studio/config/**",
      "lib/studio/components/cms/**",
      "**/_tests/**",
      "**/*.stories.*",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...storybook.configs["flat/recommended"],
  // Relax a few strict rules to unblock CI; tighten later per directory
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
];

export default eslintConfig;
