const compat = require("eslint-plugin-compat");

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
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
  },

  // Keep presentation in stylesheets. Runtime data may cross the boundary only
  // through literal CSS custom properties; exportMenu's detached clone is the
  // documented exception for standalone SVG serialization.
  {
    files: ["src/**/*.js"],
    ignores: ["**/*.test.js", "src/app/js/menu/exportMenu.js", "src/app/js/menu/svgExportStyles.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='d3'][property.name='event']",
          message: "D3 v7 passes the event to the listener; do not use the removed d3.event global."
        },
        {
          selector: "MemberExpression[property.name='keyCode']",
          message: "Use semantic KeyboardEvent.key values instead of deprecated numeric keyCode values."
        },
        {
          selector: "CallExpression[callee.property.name='style']",
          message: "Use a class, native state attribute, or CSS custom property instead of D3 .style()."
        },
        {
          selector: "CallExpression[callee.property.name='attr'][arguments.0.value='style']",
          message: "Do not generate inline style attributes."
        },
        {
          selector: "AssignmentExpression[left.object.property.name='style']",
          message: "Do not assign presentation properties through element.style."
        },
        {
          selector: "CallExpression[callee.property.name=/^(setProperty|removeProperty)$/][arguments.0.type!='Literal']",
          message: "CSS custom-property names must be literal so the style boundary remains auditable."
        },
        {
          selector: "CallExpression[callee.property.name=/^(setProperty|removeProperty)$/][arguments.0.value=/^(?!--)/]",
          message: "Only CSS custom properties may be changed through element.style."
        },
        {
          selector: "Literal[value=/style\\s*=/i]",
          message: "Do not generate markup containing inline style attributes."
        }
      ]
    }
  },
  {
    files: ["src/app/js/menu/exportMenu.js", "src/app/js/menu/svgExportStyles.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='style']",
          message: "Do not mutate live presentation through D3 .style()."
        },
        {
          selector: "CallExpression[callee.property.name='attr'][arguments.0.value='style']",
          message: "Do not generate style attributes through D3."
        },
        {
          selector: "AssignmentExpression[left.object.property.name='style']",
          message: "Do not assign presentation properties through element.style."
        }
      ]
    }
  }
];
