import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

const cypressGlobals = {
  Cypress: "readonly",
  cy: "readonly",
  describe: "readonly",
  it: "readonly",
  before: "readonly",
  beforeEach: "readonly",
  after: "readonly",
  afterEach: "readonly",
  expect: "readonly",
};

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "cypress/results/**",
      "cypress/screenshots/**",
      "cypress/videos/**",
      "Portal-antigo/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["cypress/**/*.ts"],
    languageOptions: {
      globals: cypressGlobals,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
  {
    files: ["cypress.config.ts"],
    languageOptions: {
      globals: {
        __filename: "readonly",
        process: "readonly",
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["scripts/**/*.mjs", "eslint.config.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
);
