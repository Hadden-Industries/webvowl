const compat = require("eslint-plugin-compat");

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  // Global ignores registry
  {
    ignores: [
      "src/webvowl/js/entry.js",
      "src/app/js/entry.js",
      "src/app/js/browserWarning.js"
    ]
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // Base compat recommended rules
  compat.configs["flat/recommended"],

  {
    settings: {
      // Also analyse ECMAScript built-ins such as
      // Array.prototype.at and Object.hasOwn.
      // This remains marked experimental by the plugin.
      lintAllEsApis: true,

      // Declare APIs supplied by your own polyfills.
      polyfills: [
        "popover",
        // "Promise",
        // "ResizeObserver"
      ]
    }
  },

  // Main source configuration - modern strict standards
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        d3: "readonly",
        webvowl: "writable",
        Map: "readonly",
        Set: "readonly",
        fetch: "readonly"
      }
    },
    rules: {
      // Modern JS standards
      "no-var": "error",
      "prefer-const": "error",
      curly: ["error", "all"],

      // Strict quality assertions
      "no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "none",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      semi: ["error", "always"],
      "no-undef": "error",
      "no-prototype-builtins": "error",
      "no-empty": ["error", { allowEmptyCatch: false }],
      "no-control-regex": "error",
      "no-redeclare": "error",

      // Quality & safety
      eqeqeq: ["error", "always"],
      "no-bitwise": "error",
      "guard-for-in": "error",
      "no-caller": "error",
      "no-new": "error",
      "no-use-before-define": ["error", { functions: false }]
    }
  }
];
