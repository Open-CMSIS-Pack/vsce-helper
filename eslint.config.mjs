import js from "@eslint/js";
import tseslint from "typescript-eslint";
//import eslintPluginSecurity from "eslint-plugin-security";

export default [
    {
        ignores: [
            "dist",
            "*.config.{ts,js,mjs}",
            "*.setup.{ts,js}",
            "node_modules",
        ]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts', '**/*.js'],
        plugins: {
            "@typescript-eslint": tseslint.plugin,
            //security: eslintPluginSecurity,
        },
        languageOptions: {
            ecmaVersion: 9,
            sourceType: "module",
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: 9,
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        rules: {
            // TypeScript-specific
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    "argsIgnorePattern": "^_"
                }
            ],

            // Security rules
            //...eslintPluginSecurity.configs.recommended.rules,

            // Code style rules
            "block-spacing": ["error", "always"],
            "brace-style": ["error", "1tbs", { allowSingleLine: true }],
            "eol-last": ["error"],
            "indent": ["error", 4, { SwitchCase: 1 }],
            "linebreak-style": ["error", "unix"],
            "no-trailing-spaces": ["error"],
            "object-curly-spacing": ["error", "always"],
            "quotes": ["error", "single"],
            "semi": ["error", "always"],
        },
    }
];
