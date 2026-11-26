import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // 解构剔除字段（如 { node, ...props }）或以下划线开头的变量允许不使用
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true, argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".cloudflare/**",
    "dist/**",
    "test-results/**",
    "playwright-report/**",
    // 生成的代码与本地 UI 原型不参与检查
    "prisma/generated/**",
    "src/server/db/schema.ts",
    "prototypes/**",
  ]),
]);

export default eslintConfig;
