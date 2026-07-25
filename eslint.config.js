const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  // Global ignores registry (mirrors legacy ignorePatterns / .jshintignore)
  {
    ignores: [
      "src/webvowl/js/entry.js",
      "src/app/js/entry.js",
      "src/app/js/browserWarning.js"
    ]
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // Main source configuration
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jasmine,
        ...globals.jest,
        d3: "readonly",
        webvowl: "writable",
        Map: "readonly",
        Set: "readonly",
        fetch: "readonly"
      }
    },
    rules: {
      // Base pipeline optimization and syntax overrides
      "no-unused-vars": ["warn", { vars: "all", args: "none", caughtErrorsIgnorePattern: "^_" }],
      "no-console": "off", // Replicates "devel": true validation behavior
      semi: ["error", "always"],
      "no-undef": "error", // Replicates "undef": true
      "no-prototype-builtins": "off",
      "no-empty": "warn",
      "no-control-regex": "off",
      "no-redeclare": "warn",

      // Exact structural replications of legacy JSHint quality assertions:
      eqeqeq: ["error", "always"],                           // Replicates "eqeqeq": true
      "no-bitwise": "error",                                    // Replicates "bitwise": true
      "guard-for-in": "error",                                  // Replicates "forin": true
      "no-caller": "error",                                     // Replicates "noarg": true
      "no-new": "error",                                        // Replicates "nonew": true
      "no-use-before-define": ["error", { functions: false }] // Replicates "latedef": "nofunc"
    }
  },

  // Overrides for modern ES6 modules under src/owl2vowl/
  {
    files: ["src/owl2vowl/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    }
  },

  // Overrides for unit test files (supports ES6+ arrow functions and Jest globals)
  {
    files: ["**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    }
  }
];
