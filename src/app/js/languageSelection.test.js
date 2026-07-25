function getBrowserLanguages(nav) {
  const browserLangs = [];
  if (Array.isArray(nav.languages)) {
    for (let i = 0; i < nav.languages.length; i++) {
      const l = nav.languages[i];
      if (l && typeof l === "string" && browserLangs.indexOf(l) === -1) {
        browserLangs.push(l);
      }
    }
  }
  if (nav.language && typeof nav.language === "string" && browserLangs.indexOf(nav.language) === -1) {
    browserLangs.push(nav.language);
  }
  if (nav.userLanguage && typeof nav.userLanguage === "string" && browserLangs.indexOf(nav.userLanguage) === -1) {
    browserLangs.push(nav.userLanguage);
  }
  return browserLangs;
}

function findBestMatchingLanguage(languages, mockNav) {
  if (!languages || languages.length === 0) {
    return null;
  }

  const browserLangs = getBrowserLanguages(mockNav || (typeof navigator !== "undefined" ? navigator : {}));

  // 1. Try exact matches with browser languages (case-insensitive)
  for (let i = 0; i < browserLangs.length; i++) {
    const bLang = browserLangs[i].toLowerCase();
    for (let j = 0; j < languages.length; j++) {
      if (typeof languages[j] === "string" && languages[j].toLowerCase() === bLang) {
        return languages[j];
      }
    }
  }

  // 2. Try primary language tag matches (e.g., "de-DE" matches "de", or "de" matches "de-DE")
  for (let k = 0; k < browserLangs.length; k++) {
    if (typeof browserLangs[k] !== "string") {continue;}
    const primaryBLang = browserLangs[k].split("-")[0].toLowerCase();
    for (let m = 0; m < languages.length; m++) {
      if (typeof languages[m] !== "string") {continue;}
      const langLower = languages[m].toLowerCase();
      const primaryLang = langLower.split("-")[0];
      if (langLower === primaryBLang || primaryLang === primaryBLang) {
        return languages[m];
      }
    }
  }

  // 3. Fallback: English ("en" or "en-*")
  for (let n = 0; n < languages.length; n++) {
    if (typeof languages[n] === "string") {
      const lLower = languages[n].toLowerCase();
      if (lLower === "en" || lLower.split("-")[0] === "en") {
        return languages[n];
      }
    }
  }

  // 4. Fallback: LANG_UNDEFINED ("undefined")
  if (languages.indexOf("undefined") >= 0) {
    return "undefined";
  }

  // 5. Fallback: LANG_IRIBASED ("id")
  if (languages.indexOf("id") >= 0) {
    return "id";
  }

  // 6. Fallback: First language in list
  return languages[0];
}

describe("navigator.language ontology language resolution", () => {
  test("exact match between navigator.language and ontology languages", () => {
    const nav = { language: "de-DE", languages: ["de-DE", "en-US"] };
    const ontologyLanguages = ["en", "de-DE", "fr"];
    expect(findBestMatchingLanguage(ontologyLanguages, nav)).toBe("de-DE");
  });

  test("primary language tag match when browser is regional (de-DE) and ontology has base (de)", () => {
    const nav = { language: "de-DE", languages: ["de-DE", "en-US"] };
    const ontologyLanguages = ["en", "de", "fr"];
    expect(findBestMatchingLanguage(ontologyLanguages, nav)).toBe("de");
  });

  test("primary language tag match when browser is base (de) and ontology has regional (de-DE)", () => {
    const nav = { language: "de", languages: ["de"] };
    const ontologyLanguages = ["en", "de-DE", "fr"];
    expect(findBestMatchingLanguage(ontologyLanguages, nav)).toBe("de-DE");
  });

  test("fallback to English when browser language is not available in ontology", () => {
    const nav = { language: "es-ES", languages: ["es-ES"] };
    const ontologyLanguages = ["de", "en", "fr"];
    expect(findBestMatchingLanguage(ontologyLanguages, nav)).toBe("en");
  });

  test("fallback to undefined when English is not present", () => {
    const nav = { language: "ja", languages: ["ja"] };
    const ontologyLanguages = ["de", "undefined", "id"];
    expect(findBestMatchingLanguage(ontologyLanguages, nav)).toBe("undefined");
  });

  test("fallback to first available language when no matched or standard fallbacks exist", () => {
    const nav = { language: "zh-CN", languages: ["zh-CN"] };
    const ontologyLanguages = ["pt", "it"];
    expect(findBestMatchingLanguage(ontologyLanguages, nav)).toBe("pt");
  });

  test("returns null for empty language list", () => {
    const nav = { language: "en" };
    expect(findBestMatchingLanguage([], nav)).toBeNull();
  });
});
