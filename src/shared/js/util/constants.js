const createConstants = (function () {
  const constants = {};

  constants.LANG_IRIBASED = "IRI-based";
  constants.LANG_UNDEFINED = "undefined";
  // Vite supplies the package version; direct Node consumers have no Vite environment.
  constants.WEBVOWL_VERSION = import.meta.env?.WEBVOWL_VERSION ?? "development";

  return function () {
    /* Use a function here to keep a consistent style like webvowl.path.to.module()
     * despite having just a single object. */
    return constants;
  };
})();

export { createConstants };
