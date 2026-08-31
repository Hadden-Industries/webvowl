const constants = require("./constants")();

/**
 * Encapsulates methods which return a label in a specific language for a preferred language.
 */
module.exports = (function () {
  const languageTools = {};

  languageTools.textInLanguage = function (textObject, preferredLanguage) {
    if (typeof textObject === "undefined") {
      return undefined;
    }

    if (typeof textObject === "string") {
      return textObject;
    }

    if (
      preferredLanguage &&
      Object.prototype.hasOwnProperty.call(textObject, preferredLanguage)
    ) {
      return textObject[preferredLanguage];
    }

    let textForLanguage = searchLanguage(textObject, "en");
    if (textForLanguage) {
      return textForLanguage;
    }
    textForLanguage = searchLanguage(textObject, constants.LANG_UNDEFINED);
    if (textForLanguage) {
      return textForLanguage;
    }

    return textObject[constants.LANG_IRIBASED];
  };

  function searchLanguage(textObject, preferredLanguage) {
    for (const language in textObject) {
      if (
        language === preferredLanguage &&
        Object.prototype.hasOwnProperty.call(textObject, language)
      ) {
        return textObject[language];
      }
    }
  }

  return function () {
    /* Use a function here to keep a consistent style like webvowl.path.to.module()
     * despite having just a single languageTools object. */
    return languageTools;
  };
})();
