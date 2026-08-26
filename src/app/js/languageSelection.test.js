const { describe, test, expect } = require("@jest/globals");

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
  if (
    nav.language &&
    typeof nav.language === "string" &&
    browserLangs.indexOf(nav.language) === -1
  ) {
    browserLangs.push(nav.language);
  }
  if (
    nav.userLanguage &&
    typeof nav.userLanguage === "string" &&
    browserLangs.indexOf(nav.userLanguage) === -1
  ) {
    browserLangs.push(nav.userLanguage);
  }
  return browserLangs;
}

function findBestMatchingLanguage(languages, mockNav) {
  if (!languages || languages.length === 0) {
    return null;
  }

  const browserLangs = getBrowserLanguages(
    mockNav || (typeof navigator !== "undefined" ? navigator : {}),
  );

  // 1. Try exact matches with browser languages (case-insensitive)
  for (let i = 0; i < browserLangs.length; i++) {
    const bLang = browserLangs[i].toLowerCase();
    for (let j = 0; j < languages.length; j++) {
      if (
        typeof languages[j] === "string" &&
        languages[j].toLowerCase() === bLang
      ) {
        return languages[j];
      }
    }
  }

  // 2. Try primary language tag matches (e.g., "de-DE" matches "de", or "de" matches "de-DE")
  for (let k = 0; k < browserLangs.length; k++) {
    if (typeof browserLangs[k] !== "string") {
      continue;
    }
    const primaryBLang = browserLangs[k].split("-")[0].toLowerCase();
    for (let m = 0; m < languages.length; m++) {
      if (typeof languages[m] !== "string") {
        continue;
      }
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

function isLanguageMatch(entryLang, preferredLang) {
  if (!entryLang || !preferredLang) {
    return false;
  }
  const e = String(entryLang).toLowerCase().trim();
  const p = String(preferredLang).toLowerCase().trim();
  if (e === p) {
    return true;
  }
  const eBase = e.split("-")[0];
  const pBase = p.split("-")[0];
  return eBase.length > 0 && eBase === pBase;
}

function filterAnnotationItems(items, preferredLanguage) {
  if (!items || items.length === 0) {
    return [];
  }

  const universalEntries = [];
  const languageEntries = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const lang = item.language;
    if (item.type === "iri" || !lang || lang === "undefined" || lang === "id") {
      universalEntries.push(item);
    } else {
      languageEntries.push(item);
    }
  }

  if (languageEntries.length === 0) {
    return universalEntries;
  }

  if (preferredLanguage) {
    const preferredMatches = languageEntries.filter(function (item) {
      return isLanguageMatch(item.language, preferredLanguage);
    });
    if (preferredMatches.length > 0) {
      return universalEntries.concat(preferredMatches);
    }
  }

  const englishMatches = languageEntries.filter(function (item) {
    return isLanguageMatch(item.language, "en");
  });
  if (englishMatches.length > 0) {
    return universalEntries.concat(englishMatches);
  }

  return universalEntries.concat(languageEntries);
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

describe("selection details annotation attribute language filtering", () => {
  const sampleEditorialNotes = [
    {
      identifier: "editorialNote",
      language: "en",
      value:
        "Feature at risk - added in 2017 revision, and not yet widely used.",
      type: "label",
    },
    {
      identifier: "editorialNote",
      language: "es",
      value:
        "Característica en riesgo - añadida en la revisión de 2017, y no utilizada todavía de forma amplia.",
      type: "label",
    },
  ];

  test("filters annotation items keeping only matching language 'en'", () => {
    const filtered = filterAnnotationItems(sampleEditorialNotes, "en");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].language).toBe("en");
    expect(filtered[0].value).toContain("Feature at risk");
  });

  test("filters annotation items keeping only matching language 'es'", () => {
    const filtered = filterAnnotationItems(sampleEditorialNotes, "es");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].language).toBe("es");
    expect(filtered[0].value).toContain("Característica en riesgo");
  });

  test("matches derivative language tags (e.g. 'en-GB' matches 'en')", () => {
    const filtered = filterAnnotationItems(sampleEditorialNotes, "en-GB");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].language).toBe("en");
  });

  test("retains universal/IRI/undefined annotations alongside language-specific annotations", () => {
    const mixedAnnotations = [
      {
        identifier: "isDefinedBy",
        language: "undefined",
        value: "http://example.org/ont",
        type: "iri",
      },
      ...sampleEditorialNotes,
    ];
    const filtered = filterAnnotationItems(mixedAnnotations, "en");
    expect(filtered).toHaveLength(2);
    expect(filtered[0].identifier).toBe("isDefinedBy");
    expect(filtered[1].language).toBe("en");
  });

  test("falls back to English when selected language is not present in annotation", () => {
    const filtered = filterAnnotationItems(sampleEditorialNotes, "fr");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].language).toBe("en");
  });
});
