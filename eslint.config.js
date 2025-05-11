import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
        plugins: { js },
        extends: ["js/recommended"],
        rules: {
            "max-lines-per-function": [
                "warn",
                {
                    max: 70,
                    skipBlankLines: true,
                    skipComments: true,
                },
            ],
        },
    },

    {
        // This replaces the previous "overrides" section
        files: ["**/lib/**/*.{js,ts}"],
        rules: {
            "max-lines-per-function": "off",
        },
    },
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
        languageOptions: { globals: globals.browser },
    },
    tseslint.configs.recommended,
]);
