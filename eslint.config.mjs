import eslint from "@eslint/js";
import pluginQuery from "@tanstack/eslint-plugin-query";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: [
            "src-tauri/target/**/*",
            "dist/**/*",
            "postcss.config.js",
            "vite.config.ts",
            "tailwind.config.js",
            ".github/**/*.yml",
            ".github/**/*.yaml",
            "drizzle.config.ts",
            "vitest.config.ts",
        ],
    },
    eslint.configs.recommended,
    reactRefresh.configs.vite,
    ...tseslint.configs.recommendedTypeChecked,
    ...pluginQuery.configs["flat/recommended"],
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: globals.browser,
        },
        plugins: {
            react: pluginReact,
            "react-hooks": pluginReactHooks,
            "simple-import-sort": simpleImportSort,
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            "react/react-in-jsx-scope": "off",
            "no-unused-vars": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "all",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
            "simple-import-sort/imports": "warn",
            "simple-import-sort/exports": "warn",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": [
                "warn",
                {
                    checksVoidReturn: {
                        attributes: false,
                    },
                    checksConditionals: true,
                    checksSpreads: true,
                },
            ],
        },
    },
);
