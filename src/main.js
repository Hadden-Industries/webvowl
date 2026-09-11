/**
 * Composition entry point.
 *
 * Constructs the application once, keeps it in module scope, and releases
 * its load generations and SVG artifacts when the page goes away. No
 * renderer global is published; embedding hosts use the exported
 * application entry and its controller accessor.
 */
import { createWebVowlApplication } from "./app/js/entry.js";

if (!("popover" in HTMLElement.prototype)) {
  await import("@oddbird/popover-polyfill");
}

const application = createWebVowlApplication();

window.addEventListener("load", () => {
  application.initialize();
});

window.addEventListener("pagehide", () => {
  application.dispose();
});

export { application };
