import { beforeAll, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let WEB_VOWL_OPERATION_LIMITS;
let WebVowlOperationError;
let assertCurrentOntologyElementReference;
let createOntologyElementReference;
let createWebVowlControllerState;
let freezeWebVowlControllerState;
let normalizeSvgFilename;
let toPublicWebVowlError;
let truncateOntologyDerivedText;
let truncateResultCollection;

beforeAll(async () => {
  const moduleUrl = new URL("./webVowlControllerContracts.js", import.meta.url);
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected Task 2 contract dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  const webVowlControllerContracts = sourceModule.namespace;
  ({
    WEB_VOWL_OPERATION_LIMITS,
    WebVowlOperationError,
    assertCurrentOntologyElementReference,
    createOntologyElementReference,
    createWebVowlControllerState,
    freezeWebVowlControllerState,
    normalizeSvgFilename,
    toPublicWebVowlError,
    truncateOntologyDerivedText,
    truncateResultCollection,
  } = webVowlControllerContracts);
});

const APPROVED_WEB_VOWL_OPERATION_ERROR_CODES = Object.freeze([
  "NO_ONTOLOGY",
  "SOURCE_REJECTED",
  "LOAD_ABORTED",
  "FETCH_FAILED",
  "PARSE_FAILED",
  "IMPORT_FAILED",
  "VIEW_REJECTED",
  "ELEMENT_NOT_FOUND",
  "LAYOUT_TIMEOUT",
  "EXPORT_FAILED",
]);

const ONTOLOGY_ELEMENT_KINDS = Object.freeze([
  "class",
  "datatype",
  "individual",
  "property",
]);

function captureThrownError(operation) {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to throw.");
}

describe("WebVOWL operation limits", () => {
  test("publishes the exact shared controller-domain limits", () => {
    expect(WEB_VOWL_OPERATION_LIMITS).toEqual({
      maxRemoteSourceLocationCharacters: 2048,
      maxInlineOntologyBytes: 1024 * 1024,
      maxFocusReferences: 25,
      maxWarnings: 10,
      maxOntologyDerivedTextCharacters: 256,
    });
    expect(Object.isFrozen(WEB_VOWL_OPERATION_LIMITS)).toBe(true);
  });

  test("names inline ontology capacity in UTF-8 bytes rather than string length", () => {
    const multibyteOntologyText = "€".repeat(
      Math.floor(WEB_VOWL_OPERATION_LIMITS.maxInlineOntologyBytes / 3) + 1,
    );

    expect(multibyteOntologyText.length).toBeLessThan(
      WEB_VOWL_OPERATION_LIMITS.maxInlineOntologyBytes,
    );
    expect(
      new TextEncoder().encode(multibyteOntologyText).byteLength,
    ).toBeGreaterThan(WEB_VOWL_OPERATION_LIMITS.maxInlineOntologyBytes);
  });
});

describe("WebVowlOperationError", () => {
  test.each(APPROVED_WEB_VOWL_OPERATION_ERROR_CODES)(
    "accepts the approved %s code",
    (code) => {
      const operationError = new WebVowlOperationError({
        code,
        message: `Expected ${code} failure`,
      });

      expect(Object.prototype.toString.call(operationError)).toBe(
        "[object Error]",
      );
      expect(operationError).toBeInstanceOf(WebVowlOperationError);
      expect(operationError.name).toBe("WebVowlOperationError");
      expect(operationError.code).toBe(code);
      expect(operationError.isRetryable).toBe(false);
      expect(operationError.details).toEqual({});
    },
  );

  test("rejects error codes outside the closed domain union", () => {
    expect(
      captureThrownError(
        () =>
          new WebVowlOperationError({
            code: "UNKNOWN_FAILURE",
            message: "Unknown failure",
          }),
      ),
    ).toEqual(expect.objectContaining({ name: "RangeError" }));
  });

  test("retains a diagnostic cause without making it enumerable or public", () => {
    const diagnosticCause = new TypeError(
      "credential-bearing transport detail",
    );
    const operationError = new WebVowlOperationError({
      cause: diagnosticCause,
      code: "FETCH_FAILED",
      details: { sourceKind: "ontology-document-iri" },
      isRetryable: true,
      message: "The source document could not be fetched by this browser.",
    });

    expect(operationError.cause).toBe(diagnosticCause);
    expect(Object.getOwnPropertyDescriptor(operationError, "cause")).toEqual(
      expect.objectContaining({
        enumerable: false,
        value: diagnosticCause,
      }),
    );
    expect(Object.keys(operationError)).not.toContain("cause");

    const publicError = toPublicWebVowlError(operationError);
    expect(publicError).toEqual({
      code: "FETCH_FAILED",
      message: "The source document could not be fetched by this browser.",
      isRetryable: true,
      details: { sourceKind: "ontology-document-iri" },
    });
    expect(JSON.stringify(publicError)).not.toContain("credential-bearing");
    expect(Object.isFrozen(publicError)).toBe(true);
    expect(Object.isFrozen(publicError.details)).toBe(true);
  });

  test("bounds public messages and ontology-derived detail strings", () => {
    const overlongText = "x".repeat(
      WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters + 20,
    );
    const operationError = new WebVowlOperationError({
      code: "ELEMENT_NOT_FOUND",
      details: { ontologyLabel: overlongText },
      message: overlongText,
    });

    expect(toPublicWebVowlError(operationError)).toEqual({
      code: "ELEMENT_NOT_FOUND",
      message: "x".repeat(
        WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters,
      ),
      isRetryable: false,
      details: {
        ontologyLabel: "x".repeat(
          WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters,
        ),
      },
    });
  });

  test("rejects unsafe structured detail values", () => {
    expect(
      captureThrownError(
        () =>
          new WebVowlOperationError({
            code: "PARSE_FAILED",
            details: { parserDocument: { rawText: "not public" } },
            message: "The ontology document could not be parsed.",
          }),
      ),
    ).toEqual(expect.objectContaining({ name: "TypeError" }));
  });

  test("accepts a semantic public-detail field name at the 64-character boundary", () => {
    const boundaryFieldName = `a${"b".repeat(63)}`;
    const operationError = new WebVowlOperationError({
      code: "PARSE_FAILED",
      details: { [boundaryFieldName]: true },
      message: "The ontology document could not be parsed.",
    });

    expect(toPublicWebVowlError(operationError).details).toEqual({
      [boundaryFieldName]: true,
    });
  });

  test.each([
    [`a${"b".repeat(64)}`, "RangeError"],
    ["unsafe\nfield", "TypeError"],
    ["__proto__", "TypeError"],
  ])(
    "rejects unsafe or unbounded public-detail field name %p",
    (fieldName, expectedErrorName) => {
      const thrownError = captureThrownError(
        () =>
          new WebVowlOperationError({
            code: "PARSE_FAILED",
            details: { [fieldName]: true },
            message: "The ontology document could not be parsed.",
          }),
      );

      expect(thrownError).toEqual(
        expect.objectContaining({ name: expectedErrorName }),
      );
    },
  );

  test("projects only expected WebVOWL operation errors", () => {
    expect(
      captureThrownError(() =>
        toPublicWebVowlError(new Error("raw internal error")),
      ),
    ).toEqual(expect.objectContaining({ name: "TypeError" }));
  });

  test("rejects a prototype-forged operation error that bypassed constructor validation", () => {
    const prototypeForgedOperationError = Object.assign(
      Object.create(WebVowlOperationError.prototype),
      {
        code: "FETCH_FAILED",
        details: { transportCredentials: { accessToken: "not public" } },
        isRetryable: true,
        message: "x".repeat(
          WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters + 1,
        ),
      },
    );

    expect(
      captureThrownError(() =>
        toPublicWebVowlError(prototypeForgedOperationError),
      ),
    ).toEqual(expect.objectContaining({ name: "TypeError" }));
  });
});

describe("bounded ontology-derived values", () => {
  test("preserves text at the JavaScript string-length boundary", () => {
    const boundaryText = "a".repeat(
      WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters,
    );

    const boundedText = truncateOntologyDerivedText(boundaryText);

    expect(boundedText).toEqual({
      ontologyDerivedText: boundaryText,
      isTruncated: false,
    });
    expect(Object.isFrozen(boundedText)).toBe(true);
  });

  test("truncates overlong text without splitting a surrogate pair", () => {
    const overlongText = `${"a".repeat(
      WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters - 1,
    )}😀suffix`;

    const boundedText = truncateOntologyDerivedText(overlongText);

    expect(boundedText).toEqual({
      ontologyDerivedText: "a".repeat(
        WEB_VOWL_OPERATION_LIMITS.maxOntologyDerivedTextCharacters - 1,
      ),
      isTruncated: true,
    });
  });

  test("retains the deterministic leading search-result window", () => {
    const searchResultEntries = Array.from(
      { length: WEB_VOWL_OPERATION_LIMITS.maxFocusReferences + 2 },
      (_, index) => `match-${index}`,
    );

    const boundedResults = truncateResultCollection(
      searchResultEntries,
      WEB_VOWL_OPERATION_LIMITS.maxFocusReferences,
    );

    expect(boundedResults).toEqual({
      retainedEntries: searchResultEntries.slice(
        0,
        WEB_VOWL_OPERATION_LIMITS.maxFocusReferences,
      ),
      isTruncated: true,
    });
    expect(Object.isFrozen(boundedResults)).toBe(true);
    expect(Object.isFrozen(boundedResults.retainedEntries)).toBe(true);
  });

  test("copies the retained window without invoking caller-owned array methods", () => {
    const resultEntries = ["first", "second"];
    Object.defineProperty(resultEntries, "slice", {
      value() {
        throw new Error("caller-owned slice must not run");
      },
    });

    const boundedResults = truncateResultCollection(resultEntries, 1);

    expect(boundedResults).toEqual({
      retainedEntries: ["first"],
      isTruncated: true,
    });
    expect(Object.isFrozen(resultEntries)).toBe(false);
    expect(Object.isFrozen(boundedResults.retainedEntries)).toBe(true);
  });

  test("reports an untruncated warning collection at its boundary", () => {
    const warningEntries = Array.from(
      { length: WEB_VOWL_OPERATION_LIMITS.maxWarnings },
      (_, index) => `warning-${index}`,
    );

    expect(
      truncateResultCollection(
        warningEntries,
        WEB_VOWL_OPERATION_LIMITS.maxWarnings,
      ),
    ).toEqual({
      retainedEntries: warningEntries,
      isTruncated: false,
    });
  });
});

describe("SVG filename normalization", () => {
  test.each([
    [undefined, "webvowl-visualization.svg"],
    ["report", "report.svg"],
    ["../exports/person-organization.svg", "person-organization.svg"],
    ["C:\\exports\\person-organization.SVG.svg", "person-organization.svg"],
    ["unsafe<report>?.svg", "unsafe-report--.svg"],
    ["\u0000report\u001f\u007f.svg", "-report--.svg"],
    ["report.svg.", "report.svg"],
    ["report.svg. ", "report.svg"],
    ["report.svg.svg.", "report.svg"],
    ["   ", "webvowl-visualization.svg"],
  ])("normalizes %p to %s", (filename, expectedFilename) => {
    expect(normalizeSvgFilename(filename)).toBe(expectedFilename);
  });

  test.each([
    ["CON", "-CON.svg"],
    ["prn.svg", "-prn.svg"],
    ["AUX.report", "-AUX.report.svg"],
    ["nul", "-nul.svg"],
    ["COM1", "-COM1.svg"],
    ["com².log", "-com².log.svg"],
    ["LPT9", "-LPT9.svg"],
    ["lpt³.backup", "-lpt³.backup.svg"],
    [`CON${" ".repeat(121)}X`, "-CON.svg"],
  ])(
    "prefixes the Windows-reserved device basename %p",
    (filename, expectedFilename) => {
      expect(normalizeSvgFilename(filename)).toBe(expectedFilename);
    },
  );

  test("caps the complete filename at 128 JavaScript characters", () => {
    const normalizedFilename = normalizeSvgFilename("a".repeat(200));

    expect(normalizedFilename).toHaveLength(128);
    expect(normalizedFilename).toBe(`${"a".repeat(124)}.svg`);
  });

  test("does not manufacture a duplicate SVG suffix while truncating", () => {
    expect(normalizeSvgFilename(`${"a".repeat(120)}.svgx`)).toBe(
      `${"a".repeat(120)}.svg`,
    );
  });
});

describe("ontology-element references", () => {
  test.each(ONTOLOGY_ELEMENT_KINDS)(
    "creates a stable %s reference from an ontology IRI",
    (kind) => {
      const reference = createOntologyElementReference({
        iri: `https://example.org/${kind}`,
        kind,
        loadGeneration: 7,
        localId: `${kind}-17`,
      });

      expect(reference).toEqual({
        kind,
        iri: `https://example.org/${kind}`,
      });
      expect(Object.isFrozen(reference)).toBe(true);
    },
  );

  test.each(ONTOLOGY_ELEMENT_KINDS)(
    "creates a load-scoped anonymous %s reference",
    (kind) => {
      const reference = createOntologyElementReference({
        kind,
        loadGeneration: 7,
        localId: `${kind}-17`,
      });

      expect(reference).toEqual({
        kind,
        loadGeneration: 7,
        localId: `${kind}-17`,
      });
      expect(Object.isFrozen(reference)).toBe(true);
    },
  );

  test("accepts stable references independently of the current load generation", () => {
    const reference = { kind: "class", iri: "https://example.org/Person" };

    expect(assertCurrentOntologyElementReference(reference, 18)).toEqual(
      reference,
    );
  });

  test("accepts an anonymous reference only for its exact load generation", () => {
    const reference = {
      kind: "class",
      loadGeneration: 18,
      localId: "AnonymousClass17",
    };

    const assertedReference = assertCurrentOntologyElementReference(
      reference,
      18,
    );

    expect(assertedReference).toEqual(reference);
    expect(Object.isFrozen(assertedReference)).toBe(true);
  });

  test("rejects a stale anonymous reference with the stable domain error", () => {
    const reference = {
      kind: "class",
      loadGeneration: 17,
      localId: "AnonymousClass17",
    };

    expect(() => assertCurrentOntologyElementReference(reference, 18)).toThrow(
      expect.objectContaining({
        code: "ELEMENT_NOT_FOUND",
        isRetryable: false,
      }),
    );
  });

  test("maps a throwing reference getter to the stable domain error", () => {
    const getterFailure = new Error("untrusted reference getter failure");
    const reference = {};
    Object.defineProperty(reference, "kind", {
      enumerable: true,
      get() {
        throw getterFailure;
      },
    });

    const thrownError = captureThrownError(() =>
      assertCurrentOntologyElementReference(reference, 18),
    );

    expect(thrownError).toEqual(
      expect.objectContaining({
        code: "ELEMENT_NOT_FOUND",
        isRetryable: false,
      }),
    );
    expect(thrownError.cause).toBe(getterFailure);
  });

  test("does not trust a caller-thrown WebVOWL operation error from a reference getter", () => {
    const injectedOperationError = new WebVowlOperationError({
      code: "FETCH_FAILED",
      message: "Caller-controlled operation error",
    });
    const reference = {};
    Object.defineProperty(reference, "kind", {
      enumerable: true,
      get() {
        throw injectedOperationError;
      },
    });

    const thrownError = captureThrownError(() =>
      assertCurrentOntologyElementReference(reference, 18),
    );

    expect(thrownError).toEqual(
      expect.objectContaining({
        code: "ELEMENT_NOT_FOUND",
        isRetryable: false,
      }),
    );
    expect(thrownError).not.toBe(injectedOperationError);
    expect(thrownError.cause).toBe(injectedOperationError);
  });
});

const WEB_VOWL_CONTROLLER_STATE_FIELD_NAMES = Object.freeze([
  "status",
  "loadGeneration",
  "source",
  "warnings",
  "view",
  "viewport",
  "layout",
  "selection",
  "renderProgress",
  "editorMode",
  "error",
]);

const IDLE_CONTROLLER_STATE_FIELDS = Object.freeze({
  status: "idle",
  loadGeneration: 0,
  source: null,
  warnings: [],
  view: null,
  viewport: null,
  layout: { status: "unavailable" },
  selection: [],
  renderProgress: null,
  editorMode: null,
  error: null,
});

describe("controller-state snapshots", () => {
  test("deeply copies and freezes controller-owned plain state", () => {
    const mutableControllerState = {
      status: "ready",
      loadGeneration: 4,
      source: {
        kind: "ontology-document-iri",
        identity: "https://example.org/model.owl",
      },
      warnings: [{ code: "IMPORT_FAILED", message: "Optional import failed" }],
      view: {
        filters: { datatypes: "hide" },
        focus: [{ kind: "class", iri: "https://example.org/Person" }],
      },
      layout: { status: "settled" },
      error: null,
    };

    const stateSnapshot = freezeWebVowlControllerState(mutableControllerState);

    expect(stateSnapshot).toEqual(mutableControllerState);
    expect(stateSnapshot).not.toBe(mutableControllerState);
    expect(stateSnapshot.source).not.toBe(mutableControllerState.source);
    expect(stateSnapshot.warnings).not.toBe(mutableControllerState.warnings);
    expect(stateSnapshot.warnings[0]).not.toBe(
      mutableControllerState.warnings[0],
    );
    expect(Object.isFrozen(stateSnapshot)).toBe(true);
    expect(Object.isFrozen(stateSnapshot.source)).toBe(true);
    expect(Object.isFrozen(stateSnapshot.warnings)).toBe(true);
    expect(Object.isFrozen(stateSnapshot.warnings[0])).toBe(true);
    expect(Object.isFrozen(stateSnapshot.view.filters)).toBe(true);
    expect(Object.isFrozen(stateSnapshot.view.focus[0])).toBe(true);

    mutableControllerState.source.identity = "https://example.org/changed.owl";
    mutableControllerState.warnings[0].message = "changed";

    expect(stateSnapshot.source.identity).toBe("https://example.org/model.owl");
    expect(stateSnapshot.warnings[0].message).toBe("Optional import failed");
    expect(() => {
      stateSnapshot.layout.status = "relaxing";
    }).toThrow(TypeError);
  });

  test("rejects a field name outside the controller-state contract", () => {
    expect(
      captureThrownError(() =>
        createWebVowlControllerState({
          ...IDLE_CONTROLLER_STATE_FIELDS,
          renderedElementCount: 12,
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        name: "TypeError",
        message: expect.stringContaining("controller state"),
      }),
    );
  });

  test("accepts exactly the declared controller-state field names", () => {
    const stateSnapshot = createWebVowlControllerState(
      IDLE_CONTROLLER_STATE_FIELDS,
    );

    expect(Object.keys(stateSnapshot).sort()).toEqual(
      [...WEB_VOWL_CONTROLLER_STATE_FIELD_NAMES].sort(),
    );
    expect(Object.isFrozen(stateSnapshot)).toBe(true);
  });

  test("rejects a controller state that omits a declared field name", () => {
    const { selection, ...withoutSelection } = IDLE_CONTROLLER_STATE_FIELDS;

    expect(selection).toEqual([]);
    expect(
      captureThrownError(() => createWebVowlControllerState(withoutSelection)),
    ).toEqual(
      expect.objectContaining({
        name: "TypeError",
        message: expect.stringContaining("controller state"),
      }),
    );
  });

  test("rejects mutable values outside the plain controller-state contract", () => {
    expect(
      captureThrownError(() =>
        freezeWebVowlControllerState({
          status: "ready",
          layout: new Map(),
        }),
      ),
    ).toEqual(expect.objectContaining({ name: "TypeError" }));
  });

  test("clones arrays without invoking a caller-controlled map method", () => {
    const mutableEntry = { status: "ready" };
    const mutableValues = [mutableEntry];
    const callerControlledMap = () => mutableValues;
    Object.defineProperty(mutableValues, "map", {
      configurable: true,
      value: callerControlledMap,
    });

    const stateSnapshot = freezeWebVowlControllerState({
      values: mutableValues,
    });

    expect(stateSnapshot.values).not.toBe(mutableValues);
    expect(stateSnapshot.values[0]).not.toBe(mutableEntry);
    expect(stateSnapshot.values[0]).toEqual(mutableEntry);
    expect(Object.isFrozen(stateSnapshot.values)).toBe(true);
    expect(Object.isFrozen(stateSnapshot.values[0])).toBe(true);
    expect(Object.isFrozen(mutableValues)).toBe(false);
    expect(Object.isFrozen(mutableEntry)).toBe(false);
  });
});
