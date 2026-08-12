/**
 * Unified application entry point for Vite.
 *
 * Replaces the two separate webpack entry points (src/webvowl/js/entry.js and
 * src/app/js/entry.js) with a single module entry that imports both libraries,
 * assigns them to the expected window globals, and initializes the application.
 *
 * CSS imports are pulled in transitively through the entry modules:
 *   - webvowl/js/entry.js imports ../css/vowl.css
 *   - app/js/entry.js imports ../css/toolstyle.css
 */

// Conditionally import Popover API polyfill for non-Baseline browsers
if (!("popover" in HTMLElement.prototype)) {
  await import("@oddbird/popover-polyfill");
}

// Import both library entry points (CJS, transformed by vite-plugin-commonjs)
const webvowl = require("./webvowl/js/entry");
const app = require("./app/js/entry");

// Assign to window globals to replicate webpack library.type: "assign" behaviour.
// webpack output did:
//   webvowl = <exports>            (from entry "webvowl")
//   webvowl.app = <exports>        (from entry "webvowl.app" with dotted name)
// The HTML initialization script expects webvowl.app() to be callable.
// Global reference for debugging or legacy reasons removed as part of UI decoupling
webvowl.app = app;

// Initialize the application on page load.
// Replaces the inline <script>window.onload = webvowl.app().initialize;</script> from index.html.
window.onload = function () {
  webvowl.app().initialize();
};
