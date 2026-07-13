module.exports = {
  // Enforces this file as the definitive configuration base.
  // Suppresses parent directory scanning and clears the deprecation warning.
  root: true,

  env: {
    browser: true,
    node: true,
    // Replicates "jasmine": true from legacy JSHint settings
    jasmine: true 
  },

  parserOptions: {
    // Restricts syntax strictly to ES5 to prevent modern tokens from passing 
    // code compilation unnoticed and crashing your legacy target asset engines.
    ecmaVersion: 5
  },

  globals: {
    // Replicates "d3": false and "webvowl": false global tracking constraints
    d3: "readonly",
    webvowl: "writable"
  },

  extends: "eslint:recommended",

  // Explicitly mirrors the previous .jshintignore exclusion registry
  ignorePatterns: [
    "src/webvowl/js/entry.js",
    "src/app/js/entry.js",
    "src/app/js/browserWarning.js"
  ],

  rules: {
    // Base pipeline optimization and syntax overrides
    "no-unused-vars": ["warn", { "vars": "all", "args": "none" }],
    "no-console": "off", // Replicates "devel": true validation behavior
    "semi": ["error", "always"],
    "no-undef": "error", // Replicates "undef": true
    "no-prototype-builtins": "off",
    "no-empty": "warn",
    "no-control-regex": "off",
    "no-redeclare": "warn",

    // Exact structural replications of legacy JSHint quality assertions:
    "eqeqeq": ["error", "always"],                           // Replicates "eqeqeq": true
    "no-bitwise": "error",                                    // Replicates "bitwise": true
    "guard-for-in": "error",                                  // Replicates "forin": true
    "no-caller": "error",                                     // Replicates "noarg": true
    "no-new": "error",                                        // Replicates "nonew": true
    "no-use-before-define": ["error", { "functions": false }] // Replicates "latedef": "nofunc"
  },

  overrides: [
    {
      // Targeted parsing and environment relaxation for owl2vowl.js and turtleParser.js, which act as isolated scripts 
      // utilizing modern 'const' declarations, Maps, Sets, and Promises inside an otherwise static ES5 domain tree.
      files: ["src/app/js/owl2vowl.js", "src/app/js/turtleParser.js"],
      env: {
        es6: true
      },
      parserOptions: {
        ecmaVersion: 6
      }
    }
  ]
};
