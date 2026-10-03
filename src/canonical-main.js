import { createCanonicalWebVowlApplication } from "./app/js/canonicalApplication.js";

if (!("popover" in HTMLElement.prototype)) {
  await import("@oddbird/popover-polyfill");
}

const application = createCanonicalWebVowlApplication();
window.addEventListener("load", () => application.initialize());
window.addEventListener("pagehide", () => application.dispose());

export { application };
