import { OWLDocumentFormats } from "owlapi/formats";
import {
  VISUALIZATION_LAYOUT_ACTIONS,
  VISUALIZATION_VIEWPORT_ACTIONS,
  VISUALIZATION_VIEWPORT_LIMITS,
  VISUALIZATION_SLIDER_LIMITS,
  createVisualizationModesRequest,
  createForceLayoutDistancesRequest,
} from "../controller/renderedGraphRuntimeContracts.js";
import {
  WEB_VOWL_OPERATION_LIMITS,
  normalizeSvgFilename,
} from "../controller/webVowlControllerContracts.js";

// The agent-facing surface of this page. Each tool is a
// bounded operation over the ontology the controller holds, never a generic
// command channel and never a route into the renderer.
//
// Everything here is static data. A host reads these definitions to list the
// tools; nothing in this module reaches the controller, so a definition can be
// inspected without a loaded ontology, a DOM, or a renderer.

// Derived from the parser's own formats so the advertised set can never drift
// from the set the loader actually accepts.
const ONTOLOGY_TEXT_FORMAT_KEYS = Object.freeze(
  Object.values(OWLDocumentFormats).map((documentFormat) => documentFormat.key),
);

const ONTOLOGY_ELEMENT_KINDS = Object.freeze([
  "class",
  "datatype",
  "individual",
  "property",
]);

const VISIBILITY_FILTER_VALUES = Object.freeze(["show", "hide"]);

// A location an agent may name. Long enough for a real IRI, short enough that a
// listing cannot be used to smuggle a payload.
const MAXIMUM_LOCATION_LENGTH = 2048;
// One megabyte of ontology text. The byte length is enforced again at runtime,
// because a schema counts characters and a limit that matters is in bytes.
const MAXIMUM_ONTOLOGY_TEXT_LENGTH = 1048576;
const MAXIMUM_ANONYMOUS_LOCAL_ID_LENGTH = 256;
const MAXIMUM_FOCUS_REFERENCE_COUNT = 25;

// The renderer's configured magnification bounds. A request outside them is
// refused here rather than clamped silently, so an agent learns what it asked
// for was impossible.
const MINIMUM_ZOOM_SCALE = VISUALIZATION_VIEWPORT_LIMITS.minimumZoomScale;
const MAXIMUM_ZOOM_SCALE = VISUALIZATION_VIEWPORT_LIMITS.maximumZoomScale;
const MAXIMUM_TRANSLATION_PX =
  VISUALIZATION_VIEWPORT_LIMITS.maximumAbsoluteTranslationPx;

function closedObjectSchema({ properties = {}, required = [], description }) {
  return Object.freeze({
    type: "object",
    ...(description === undefined ? {} : { description }),
    properties: Object.freeze(properties),
    required: Object.freeze(required),
    additionalProperties: false,
  });
}

// Each branch names one source concept and refuses the fields belonging to
// another, so an agent cannot combine a location with supplied text and leave
// the reader guessing which one was used.
const ONTOLOGY_SOURCE_BRANCH_SCHEMAS = Object.freeze([
  closedObjectSchema({
    description: "An ontology document to fetch and parse.",
    properties: {
      kind: Object.freeze({ const: "ontology-document-iri" }),
      documentIri: Object.freeze({
        type: "string",
        description: "HTTP(S) IRI of the ontology document to load.",
        maxLength: MAXIMUM_LOCATION_LENGTH,
        minLength: 1,
      }),
    },
    required: ["kind", "documentIri"],
  }),
  closedObjectSchema({
    description: "An already converted VOWL JSON document to fetch.",
    properties: {
      kind: Object.freeze({ const: "vowl-json-url" }),
      url: Object.freeze({
        type: "string",
        description: "HTTP(S) URL of the VOWL JSON document to load.",
        maxLength: MAXIMUM_LOCATION_LENGTH,
        minLength: 1,
      }),
    },
    required: ["kind", "url"],
  }),
  closedObjectSchema({
    description: "Ontology text supplied directly, with its syntax named.",
    properties: {
      kind: Object.freeze({ const: "ontology-text" }),
      text: Object.freeze({
        type: "string",
        description: "The ontology document text to parse.",
        maxLength: MAXIMUM_ONTOLOGY_TEXT_LENGTH,
        minLength: 1,
      }),
      format: Object.freeze({
        type: "string",
        description: "Syntax of the supplied text.",
        enum: ONTOLOGY_TEXT_FORMAT_KEYS,
      }),
    },
    required: ["kind", "text", "format"],
  }),
]);

// An element is addressed by its IRI, or by an anonymous reference that is
// valid only within the load generation that produced it. Neither depends on
// SVG markup or an array position.
const ONTOLOGY_ELEMENT_REFERENCE_SCHEMA = Object.freeze({
  oneOf: Object.freeze([
    closedObjectSchema({
      description: "An element addressed by its IRI.",
      properties: {
        kind: Object.freeze({
          type: "string",
          description: "Which kind of element this reference names.",
          enum: ONTOLOGY_ELEMENT_KINDS,
        }),
        iri: Object.freeze({
          type: "string",
          description: "IRI of the element.",
          maxLength: MAXIMUM_LOCATION_LENGTH,
          minLength: 1,
        }),
      },
      required: ["kind", "iri"],
    }),
    closedObjectSchema({
      description:
        "An anonymous element, valid only for the load generation given.",
      properties: {
        kind: Object.freeze({
          type: "string",
          description: "Which kind of element this reference names.",
          enum: ONTOLOGY_ELEMENT_KINDS,
        }),
        loadGeneration: Object.freeze({
          type: "integer",
          description: "The load this anonymous identifier belongs to.",
          minimum: 1,
        }),
        localId: Object.freeze({
          type: "string",
          description: "Identifier of the anonymous element within that load.",
          maxLength: MAXIMUM_ANONYMOUS_LOCAL_ID_LENGTH,
          minLength: 1,
        }),
      },
      required: ["kind", "loadGeneration", "localId"],
    }),
  ]),
});

const VISIBILITY_FILTERS_SCHEMA = closedObjectSchema({
  description: "Which element groups the graph shows.",
  properties: {
    datatypes: Object.freeze({
      description: "Show or hide datatype nodes.",
      enum: VISIBILITY_FILTER_VALUES,
    }),
    objectProperties: Object.freeze({
      description: "Show or hide object properties.",
      enum: VISIBILITY_FILTER_VALUES,
    }),
    subclasses: Object.freeze({
      description: "Show or hide subclass relations.",
      enum: VISIBILITY_FILTER_VALUES,
    }),
    disjointness: Object.freeze({
      description: "Show or hide disjointness relations.",
      enum: VISIBILITY_FILTER_VALUES,
    }),
    setOperators: Object.freeze({
      description: "Show or hide set operator nodes.",
      enum: VISIBILITY_FILTER_VALUES,
    }),
    minDegree: Object.freeze({
      type: "integer",
      description: "Hide elements with fewer connections than this.",
      minimum: 0,
      maximum: 100,
    }),
  },
});

export const WEB_MCP_TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: "load_ontology",
    description:
      "Load an ontology into the visible WebVOWL graph from an HTTP(S) ontology document IRI, VOWL JSON URL, or supplied ontology text.",
    annotations: Object.freeze({
      readOnlyHint: false,
      untrustedContentHint: true,
    }),
    inputSchema: closedObjectSchema({
      properties: {
        source: Object.freeze({
          description: "Where the ontology comes from.",
          oneOf: ONTOLOGY_SOURCE_BRANCH_SCHEMAS,
        }),
      },
      required: ["source"],
    }),
  }),
  Object.freeze({
    name: "get_ontology_summary",
    description:
      "Summarize the loaded ontology, imports, namespaces, languages, diagnostics, and active visible view without reading SVG markup.",
    annotations: Object.freeze({
      readOnlyHint: true,
      untrustedContentHint: true,
    }),
    inputSchema: closedObjectSchema({}),
  }),
  Object.freeze({
    name: "find_ontology_elements",
    description:
      "Find bounded ontology elements by label or IRI and return stable references plus optional one-hop structural facts.",
    annotations: Object.freeze({
      readOnlyHint: true,
      untrustedContentHint: true,
    }),
    inputSchema: closedObjectSchema({
      properties: {
        query: Object.freeze({
          type: "string",
          description: "Label or IRI text to search for.",
          minLength: 1,
          maxLength: 256,
        }),
        kinds: Object.freeze({
          type: "array",
          description: "Restrict results to these element kinds.",
          items: Object.freeze({
            type: "string",
            enum: ONTOLOGY_ELEMENT_KINDS,
          }),
          uniqueItems: true,
          maxItems: ONTOLOGY_ELEMENT_KINDS.length,
        }),
        limit: Object.freeze({
          type: "integer",
          description: "Greatest number of matches to return.",
          minimum: 1,
          maximum: 25,
          default: 10,
        }),
        includeNeighborhood: Object.freeze({
          type: "boolean",
          description: "Include one-hop structural facts for each match.",
          default: true,
        }),
      },
      required: ["query"],
    }),
  }),
  Object.freeze({
    name: "set_visualization_view",
    description:
      "Apply supported language, filters, focus, layout, and viewport changes to the visible WebVOWL graph.",
    annotations: Object.freeze({
      readOnlyHint: false,
      untrustedContentHint: true,
    }),
    inputSchema: closedObjectSchema({
      properties: {
        language: Object.freeze({
          type: "string",
          description: "Preferred label language tag.",
          minLength: 1,
          maxLength: 35,
        }),
        filters: VISIBILITY_FILTERS_SCHEMA,
        focus: Object.freeze({
          type: "array",
          description: "Entities to highlight; use viewport to move the view.",
          items: ONTOLOGY_ELEMENT_REFERENCE_SCHEMA,
          maxItems: MAXIMUM_FOCUS_REFERENCE_COUNT,
        }),
        layout: Object.freeze({
          type: "string",
          description:
            "Pause to retain the arrangement or resume automatic motion. Omit to leave the running/paused state unchanged.",
          enum: VISUALIZATION_LAYOUT_ACTIONS,
        }),
        viewport: Object.freeze({
          type: "string",
          description:
            "Zoom and center the visible graph, or locate the next focus. Omit to leave zoom and pan unchanged.",
          enum: VISUALIZATION_VIEWPORT_ACTIONS,
        }),
        zoomScale: Object.freeze({
          type: "number",
          description: "Magnification to apply, within the supported range.",
          minimum: MINIMUM_ZOOM_SCALE,
          maximum: MAXIMUM_ZOOM_SCALE,
        }),
        translation: closedObjectSchema({
          description:
            "Absolute pan offset in viewport pixels. Changes neither magnification nor node arrangement. Applied before a viewport framing action.",
          properties: {
            xPx: Object.freeze({
              type: "number",
              minimum: -MAXIMUM_TRANSLATION_PX,
              maximum: MAXIMUM_TRANSLATION_PX,
            }),
            yPx: Object.freeze({
              type: "number",
              minimum: -MAXIMUM_TRANSLATION_PX,
              maximum: MAXIMUM_TRANSLATION_PX,
            }),
          },
          required: ["xPx", "yPx"],
        }),
      },
    }),
  }),
  Object.freeze({
    name: "export_visualization",
    description:
      "Wait for the visible graph to settle and create a browser-local downloadable SVG with provenance metadata.",
    annotations: Object.freeze({
      readOnlyHint: false,
      untrustedContentHint: true,
    }),
    inputSchema: closedObjectSchema({
      properties: {
        filename: Object.freeze({
          type: "string",
          description: "Name for the exported file, normalized to one .svg.",
          minLength: 1,
          maxLength: 128,
        }),
        settleTimeoutMs: Object.freeze({
          type: "integer",
          description: "How long to wait for the layout to settle.",
          minimum: 1000,
          maximum: 30000,
          default: 12000,
        }),
        onTimeout: Object.freeze({
          type: "string",
          description: "Fail if the layout has not settled, or export anyway.",
          enum: Object.freeze(["fail", "best-effort"]),
          default: "fail",
        }),
      },
    }),
  }),
  Object.freeze({
    name: "get_visualization_state",
    description:
      "Read the current visualization choices, actual layout status, zoom, pan, selection, and load state.",
    annotations: Object.freeze({
      readOnlyHint: true,
      untrustedContentHint: true,
    }),
    inputSchema: closedObjectSchema({}),
  }),
  Object.freeze({
    name: "set_visualization_modes",
    description:
      "Set the same display modes and maximum label width offered in the Modes and Options menus.",
    annotations: Object.freeze({
      readOnlyHint: false,
      untrustedContentHint: true,
    }),
    inputSchema: Object.freeze({
      ...closedObjectSchema({
        properties: {
          colorExternals: Object.freeze({ type: "boolean" }),
          compactNotation: Object.freeze({ type: "boolean" }),
          nodeScaling: Object.freeze({ type: "boolean" }),
          dynamicLabelWidth: Object.freeze({ type: "boolean" }),
          pickAndPin: Object.freeze({ type: "boolean" }),
          maxLabelWidthPx: Object.freeze({
            type: "integer",
            minimum: VISUALIZATION_SLIDER_LIMITS.minimumLabelWidthPx,
            maximum: VISUALIZATION_SLIDER_LIMITS.maximumPx,
            multipleOf: VISUALIZATION_SLIDER_LIMITS.stepPx,
          }),
          colorExternalsMode: Object.freeze({
            type: "string",
            enum: Object.freeze(["same", "gradient"]),
          }),
        },
      }),
      minProperties: 1,
    }),
  }),
  Object.freeze({
    name: "set_layout_distances",
    description:
      "Set class and datatype layout distances in pixels, as with the human distance sliders.",
    annotations: Object.freeze({
      readOnlyHint: false,
      untrustedContentHint: true,
    }),
    inputSchema: Object.freeze({
      ...closedObjectSchema({
        properties: Object.fromEntries(
          ["classDistancePx", "datatypeDistancePx"].map((name) => [
            name,
            Object.freeze({
              type: "integer",
              minimum: VISUALIZATION_SLIDER_LIMITS.minimumForceDistancePx,
              maximum: VISUALIZATION_SLIDER_LIMITS.maximumPx,
              multipleOf: VISUALIZATION_SLIDER_LIMITS.stepPx,
            }),
          ]),
        ),
      }),
      minProperties: 1,
    }),
  }),
]);

// A tool input arrives as ordinary JavaScript. The schema above tells an agent
// what is accepted; it enforces nothing, so every value is checked again here
// before any controller method runs.

export class WebMcpToolInputError extends Error {
  constructor(message) {
    super(message);
    Object.defineProperty(this, "name", {
      configurable: true,
      value: "WebMcpToolInputError",
    });
    this.toolErrorCode = "INVALID_TOOL_INPUT";
    Object.freeze(this);
  }
}

function refuse(message) {
  throw new WebMcpToolInputError(message);
}

// Own enumerable string keys only: an inherited field is not something the
// caller sent, and treating it as one would let a prototype supply an input.
function ownFieldNames(candidateInput, subject) {
  if (
    candidateInput === null ||
    typeof candidateInput !== "object" ||
    Array.isArray(candidateInput)
  ) {
    refuse(`The ${subject} must be an object.`);
  }
  return Object.keys(candidateInput);
}

function assertOnlyAllowedFieldNames(
  candidateInput,
  allowedFieldNames,
  subject,
) {
  const unsupportedFieldNames = ownFieldNames(candidateInput, subject).filter(
    (fieldName) => !allowedFieldNames.includes(fieldName),
  );
  if (unsupportedFieldNames.length > 0) {
    refuse(
      `The ${subject} does not support ${unsupportedFieldNames.join(", ")}.`,
    );
  }
}

function assertRequiredFieldNames(candidateInput, requiredFieldNames, subject) {
  const presentFieldNames = ownFieldNames(candidateInput, subject);
  const missingFieldNames = requiredFieldNames.filter(
    (fieldName) => !presentFieldNames.includes(fieldName),
  );
  if (missingFieldNames.length > 0) {
    refuse(`The ${subject} requires ${missingFieldNames.join(", ")}.`);
  }
}

function assertBoundedString(candidateValue, fieldName, maximumCharacters) {
  if (typeof candidateValue !== "string") {
    refuse(`${fieldName} must be a string.`);
  }
  if (candidateValue.length === 0) {
    refuse(`${fieldName} must not be empty.`);
  }
  if (candidateValue.length > maximumCharacters) {
    refuse(`${fieldName} must be at most ${maximumCharacters} characters.`);
  }
  return candidateValue;
}

function assertWholeNumberInRange(candidateValue, fieldName, minimum, maximum) {
  if (!Number.isInteger(candidateValue)) {
    refuse(`${fieldName} must be a whole number.`);
  }
  if (candidateValue < minimum || candidateValue > maximum) {
    refuse(`${fieldName} must be between ${minimum} and ${maximum}.`);
  }
  return candidateValue;
}

function assertFiniteNumberInRange(
  candidateValue,
  fieldName,
  minimum,
  maximum,
) {
  if (typeof candidateValue !== "number" || !Number.isFinite(candidateValue)) {
    refuse(`${fieldName} must be a finite number.`);
  }
  if (candidateValue < minimum || candidateValue > maximum) {
    refuse(`${fieldName} must be between ${minimum} and ${maximum}.`);
  }
  return candidateValue;
}

function assertEnumMember(candidateValue, fieldName, allowedValues) {
  if (!allowedValues.includes(candidateValue)) {
    refuse(`${fieldName} must be one of ${allowedValues.join(", ")}.`);
  }
  return candidateValue;
}

// A location is fetched by this page, so only the two schemes a browser may
// safely retrieve are accepted, and never one carrying a credential.
function assertRetrievableLocation(candidateValue, fieldName) {
  assertBoundedString(candidateValue, fieldName, MAXIMUM_LOCATION_LENGTH);

  let parsedLocation;
  try {
    parsedLocation = new URL(candidateValue);
  } catch {
    refuse(`${fieldName} must be an absolute HTTP or HTTPS URL.`);
  }
  if (
    parsedLocation.protocol !== "http:" &&
    parsedLocation.protocol !== "https:"
  ) {
    refuse(`${fieldName} must use the http or https scheme.`);
  }
  if (parsedLocation.username !== "" || parsedLocation.password !== "") {
    refuse(`${fieldName} must not carry credentials.`);
  }
  return candidateValue;
}

const ONTOLOGY_TEXT_ENCODER = new TextEncoder();

function assertBoundedOntologyText(candidateValue) {
  assertBoundedString(candidateValue, "text", MAXIMUM_ONTOLOGY_TEXT_LENGTH);
  const encodedByteLength = ONTOLOGY_TEXT_ENCODER.encode(candidateValue).length;
  if (encodedByteLength > WEB_VOWL_OPERATION_LIMITS.maxInlineOntologyBytes) {
    refuse(
      `text must encode to at most ${WEB_VOWL_OPERATION_LIMITS.maxInlineOntologyBytes} bytes.`,
    );
  }
  return candidateValue;
}

const ONTOLOGY_SOURCE_FIELD_NAMES_BY_KIND = Object.freeze({
  "ontology-document-iri": Object.freeze(["kind", "documentIri"]),
  "vowl-json-url": Object.freeze(["kind", "url"]),
  "ontology-text": Object.freeze(["kind", "text", "format"]),
});

export function normalizeLoadOntologyToolInput(toolInput) {
  assertRequiredFieldNames(toolInput, ["source"], "load_ontology input");
  assertOnlyAllowedFieldNames(toolInput, ["source"], "load_ontology input");

  const requestedSource = toolInput.source;
  ownFieldNames(requestedSource, "ontology source");
  const sourceFieldNames =
    ONTOLOGY_SOURCE_FIELD_NAMES_BY_KIND[requestedSource.kind];
  if (sourceFieldNames === undefined) {
    refuse(
      `The ontology source kind must be one of ${Object.keys(
        ONTOLOGY_SOURCE_FIELD_NAMES_BY_KIND,
      ).join(", ")}.`,
    );
  }
  assertRequiredFieldNames(
    requestedSource,
    sourceFieldNames,
    "ontology source",
  );
  assertOnlyAllowedFieldNames(
    requestedSource,
    sourceFieldNames,
    "ontology source",
  );

  if (requestedSource.kind === "ontology-document-iri") {
    return Object.freeze({
      source: Object.freeze({
        kind: "ontology-document-iri",
        documentIri: assertRetrievableLocation(
          requestedSource.documentIri,
          "documentIri",
        ),
      }),
    });
  }
  if (requestedSource.kind === "vowl-json-url") {
    return Object.freeze({
      source: Object.freeze({
        kind: "vowl-json-url",
        url: assertRetrievableLocation(requestedSource.url, "url"),
      }),
    });
  }
  return Object.freeze({
    source: Object.freeze({
      kind: "ontology-text",
      text: assertBoundedOntologyText(requestedSource.text),
      format: assertEnumMember(
        requestedSource.format,
        "format",
        ONTOLOGY_TEXT_FORMAT_KEYS,
      ),
    }),
  });
}

export function normalizeOntologySummaryToolInput(toolInput = {}) {
  assertOnlyAllowedFieldNames(toolInput, [], "get_ontology_summary input");
  return Object.freeze({});
}

const FIND_ONTOLOGY_ELEMENTS_FIELD_NAMES = Object.freeze([
  "query",
  "kinds",
  "limit",
  "includeNeighborhood",
]);

export function normalizeFindOntologyElementsToolInput(toolInput) {
  assertRequiredFieldNames(
    toolInput,
    ["query"],
    "find_ontology_elements input",
  );
  assertOnlyAllowedFieldNames(
    toolInput,
    FIND_ONTOLOGY_ELEMENTS_FIELD_NAMES,
    "find_ontology_elements input",
  );

  const searchRequest = {
    query: assertBoundedString(toolInput.query, "query", 256),
    limit:
      toolInput.limit === undefined
        ? 10
        : assertWholeNumberInRange(toolInput.limit, "limit", 1, 25),
    includeNeighborhood:
      toolInput.includeNeighborhood === undefined
        ? true
        : assertBooleanPredicate(
            toolInput.includeNeighborhood,
            "includeNeighborhood",
          ),
  };

  if (toolInput.kinds !== undefined) {
    if (!Array.isArray(toolInput.kinds)) {
      refuse("kinds must be an array.");
    }
    for (const requestedKind of toolInput.kinds) {
      assertEnumMember(requestedKind, "kinds", ONTOLOGY_ELEMENT_KINDS);
    }
    if (new Set(toolInput.kinds).size !== toolInput.kinds.length) {
      refuse("kinds must name each element kind at most once.");
    }
    searchRequest.kinds = Object.freeze([...toolInput.kinds]);
  }

  return Object.freeze(searchRequest);
}

function assertBooleanPredicate(candidateValue, fieldName) {
  if (typeof candidateValue !== "boolean") {
    refuse(`${fieldName} must be true or false.`);
  }
  return candidateValue;
}

const VISIBILITY_FILTER_FIELD_NAMES = Object.freeze([
  "datatypes",
  "objectProperties",
  "subclasses",
  "disjointness",
  "setOperators",
  "minDegree",
]);

function normalizeVisibilityFilters(requestedFilters) {
  assertOnlyAllowedFieldNames(
    requestedFilters,
    VISIBILITY_FILTER_FIELD_NAMES,
    "visibility filters",
  );

  const normalizedFilters = {};
  for (const filterName of VISIBILITY_FILTER_FIELD_NAMES) {
    if (requestedFilters[filterName] === undefined) {
      continue;
    }
    normalizedFilters[filterName] =
      filterName === "minDegree"
        ? assertWholeNumberInRange(
            requestedFilters.minDegree,
            "minDegree",
            0,
            100,
          )
        : assertEnumMember(
            requestedFilters[filterName],
            filterName,
            VISIBILITY_FILTER_VALUES,
          );
  }
  return Object.freeze(normalizedFilters);
}

const IRI_REFERENCE_FIELD_NAMES = Object.freeze(["kind", "iri"]);
const ANONYMOUS_REFERENCE_FIELD_NAMES = Object.freeze([
  "kind",
  "loadGeneration",
  "localId",
]);

function normalizeOntologyElementReference(requestedReference) {
  const referenceFieldNames = ownFieldNames(
    requestedReference,
    "ontology element reference",
  );
  assertEnumMember(requestedReference.kind, "kind", ONTOLOGY_ELEMENT_KINDS);

  const branchFieldNames = referenceFieldNames.includes("iri")
    ? IRI_REFERENCE_FIELD_NAMES
    : ANONYMOUS_REFERENCE_FIELD_NAMES;
  assertRequiredFieldNames(
    requestedReference,
    branchFieldNames,
    "ontology element reference",
  );
  assertOnlyAllowedFieldNames(
    requestedReference,
    branchFieldNames,
    "ontology element reference",
  );

  if (branchFieldNames === IRI_REFERENCE_FIELD_NAMES) {
    return Object.freeze({
      kind: requestedReference.kind,
      iri: assertBoundedString(
        requestedReference.iri,
        "iri",
        MAXIMUM_LOCATION_LENGTH,
      ),
    });
  }
  return Object.freeze({
    kind: requestedReference.kind,
    loadGeneration: assertWholeNumberInRange(
      requestedReference.loadGeneration,
      "loadGeneration",
      1,
      Number.MAX_SAFE_INTEGER,
    ),
    localId: assertBoundedString(
      requestedReference.localId,
      "localId",
      MAXIMUM_ANONYMOUS_LOCAL_ID_LENGTH,
    ),
  });
}

const SET_VISUALIZATION_VIEW_FIELD_NAMES = Object.freeze([
  "language",
  "filters",
  "focus",
  "layout",
  "viewport",
  "zoomScale",
  "translation",
]);

export function normalizeSetVisualizationViewToolInput(toolInput = {}) {
  assertOnlyAllowedFieldNames(
    toolInput,
    SET_VISUALIZATION_VIEW_FIELD_NAMES,
    "set_visualization_view input",
  );

  const visualizationViewRequest = {};
  if (toolInput.language !== undefined) {
    visualizationViewRequest.language = assertBoundedString(
      toolInput.language,
      "language",
      35,
    );
  }
  if (toolInput.filters !== undefined) {
    visualizationViewRequest.filters = normalizeVisibilityFilters(
      toolInput.filters,
    );
  }
  if (toolInput.focus !== undefined) {
    if (!Array.isArray(toolInput.focus)) {
      refuse("focus must be an array of ontology element references.");
    }
    if (toolInput.focus.length > MAXIMUM_FOCUS_REFERENCE_COUNT) {
      refuse(
        `focus must name at most ${MAXIMUM_FOCUS_REFERENCE_COUNT} elements.`,
      );
    }
    visualizationViewRequest.focus = Object.freeze(
      toolInput.focus.map(normalizeOntologyElementReference),
    );
  }
  if (toolInput.layout !== undefined) {
    visualizationViewRequest.layout = assertEnumMember(
      toolInput.layout,
      "layout",
      VISUALIZATION_LAYOUT_ACTIONS,
    );
  }
  if (toolInput.viewport !== undefined) {
    visualizationViewRequest.viewport = assertEnumMember(
      toolInput.viewport,
      "viewport",
      VISUALIZATION_VIEWPORT_ACTIONS,
    );
  }
  if (toolInput.zoomScale !== undefined) {
    visualizationViewRequest.zoomScale = assertFiniteNumberInRange(
      toolInput.zoomScale,
      "zoomScale",
      MINIMUM_ZOOM_SCALE,
      MAXIMUM_ZOOM_SCALE,
    );
  }
  if (toolInput.translation !== undefined) {
    assertOnlyAllowedFieldNames(
      toolInput.translation,
      ["xPx", "yPx"],
      "viewport translation",
    );
    assertRequiredFieldNames(
      toolInput.translation,
      ["xPx", "yPx"],
      "viewport translation",
    );
    visualizationViewRequest.translation = Object.freeze({
      xPx: assertFiniteNumberInRange(
        toolInput.translation.xPx,
        "translation.xPx",
        -MAXIMUM_TRANSLATION_PX,
        MAXIMUM_TRANSLATION_PX,
      ),
      yPx: assertFiniteNumberInRange(
        toolInput.translation.yPx,
        "translation.yPx",
        -MAXIMUM_TRANSLATION_PX,
        MAXIMUM_TRANSLATION_PX,
      ),
    });
  }

  return Object.freeze(visualizationViewRequest);
}

const EXPORT_VISUALIZATION_FIELD_NAMES = Object.freeze([
  "filename",
  "settleTimeoutMs",
  "onTimeout",
]);

export function normalizeExportVisualizationToolInput(toolInput = {}) {
  assertOnlyAllowedFieldNames(
    toolInput,
    EXPORT_VISUALIZATION_FIELD_NAMES,
    "export_visualization input",
  );

  const exportRequest = {
    settleTimeoutMs:
      toolInput.settleTimeoutMs === undefined
        ? 12000
        : assertWholeNumberInRange(
            toolInput.settleTimeoutMs,
            "settleTimeoutMs",
            1000,
            30000,
          ),
    onTimeout:
      toolInput.onTimeout === undefined
        ? "fail"
        : assertEnumMember(toolInput.onTimeout, "onTimeout", [
            "fail",
            "best-effort",
          ]),
  };

  if (toolInput.filename !== undefined) {
    // A filename becomes a saved file, so it is reduced to a safe basename by
    // the controller-domain rule rather than trusted as given.
    exportRequest.filename = normalizeSvgFilename(
      assertBoundedString(toolInput.filename, "filename", 128),
    );
  }

  return Object.freeze(exportRequest);
}

// A tool result crosses into a caller's context, where every character costs
// the reader attention. The ceiling is a protocol concern: the controller has
// already bounded each field, and this bounds the whole envelope.
export const WEB_MCP_TOOL_RESULT_CHARACTER_CEILING = 1500;

const WEB_MCP_TOOL_NAMES = Object.freeze(
  WEB_MCP_TOOL_DEFINITIONS.map((toolDefinition) => toolDefinition.name),
);

// Names that only ever hold something internal: a parsed model, a live graph,
// a browser-local artifact handle, or serialized markup. None of them belongs
// in a tool result, whatever produced it.
const INTERNAL_FIELD_NAMES_NEVER_PROJECTED = Object.freeze([
  "cause",
  "detachedSvgRoot",
  "graphObject",
  "liveSvgRoot",
  "model",
  "objectUrl",
  "pageLocalArtifactId",
  "stack",
  "svgText",
  "vowlModel",
]);

// Collections are trimmed from the end in this order, so a caller that sees a
// truncated result loses the least valuable facts first and two identical
// results always truncate identically.
const TRIMMABLE_COLLECTION_FIELD_NAMES = Object.freeze([
  "namespaces",
  "imports",
  "warnings",
  "matches",
  "selection",
]);

const MAXIMUM_PROJECTED_TEXT_CHARACTERS = 120;

const ACCEPTED_DOMAIN_ERROR_CODES = Object.freeze([
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

function assertKnownToolName(toolName) {
  if (!WEB_MCP_TOOL_NAMES.includes(toolName)) {
    refuse(`This page offers no tool named ${String(toolName)}.`);
  }
  return toolName;
}

// Plain JSON data only. A function, a class instance, or a DOM node is
// something internal that reached here by accident, so it is dropped rather
// than serialized.
function projectedJsonValue(candidateValue) {
  if (
    candidateValue === null ||
    typeof candidateValue === "boolean" ||
    typeof candidateValue === "string"
  ) {
    return candidateValue;
  }
  if (typeof candidateValue === "number") {
    return Number.isFinite(candidateValue) ? candidateValue : undefined;
  }
  if (Array.isArray(candidateValue)) {
    return candidateValue
      .map(projectedJsonValue)
      .filter((entryValue) => entryValue !== undefined);
  }
  // The string tag rather than the prototype, because a plain object built in
  // another realm is still plain data. An Error, a Map, or a DOM node is not.
  if (Object.prototype.toString.call(candidateValue) !== "[object Object]") {
    return undefined;
  }
  const projectedRecord = {};
  for (const [fieldName, fieldValue] of Object.entries(candidateValue)) {
    if (INTERNAL_FIELD_NAMES_NEVER_PROJECTED.includes(fieldName)) {
      continue;
    }
    const projectedFieldValue = projectedJsonValue(fieldValue);
    if (projectedFieldValue !== undefined) {
      projectedRecord[fieldName] = projectedFieldValue;
    }
  }
  return projectedRecord;
}

function serializedLength(projectedResult) {
  return JSON.stringify(projectedResult).length;
}

function withoutNeighborhoodFacts(toolResult) {
  if (!Array.isArray(toolResult.matches)) {
    return { toolResult, hasChanged: false };
  }
  let hasChanged = false;
  const matches = toolResult.matches.map((matchRecord) => {
    if (matchRecord?.neighborhood === undefined) {
      return matchRecord;
    }
    hasChanged = true;
    const { neighborhood, ...retainedMatchFields } = matchRecord;
    void neighborhood;
    return retainedMatchFields;
  });
  return { toolResult: { ...toolResult, matches }, hasChanged };
}

function withOneTrimmedCollectionEntry(toolResult) {
  for (const collectionFieldName of TRIMMABLE_COLLECTION_FIELD_NAMES) {
    const collection = toolResult[collectionFieldName];
    if (Array.isArray(collection) && collection.length > 0) {
      return {
        toolResult: {
          ...toolResult,
          [collectionFieldName]: collection.slice(0, -1),
        },
        hasChanged: true,
      };
    }
  }
  if (
    Array.isArray(toolResult.view?.focus) &&
    toolResult.view.focus.length > 0
  ) {
    return {
      toolResult: {
        ...toolResult,
        view: { ...toolResult.view, focus: toolResult.view.focus.slice(0, -1) },
      },
      hasChanged: true,
    };
  }
  return { toolResult, hasChanged: false };
}

function withTruncatedText(candidateValue) {
  if (typeof candidateValue === "string") {
    return candidateValue.length > MAXIMUM_PROJECTED_TEXT_CHARACTERS
      ? candidateValue.slice(0, MAXIMUM_PROJECTED_TEXT_CHARACTERS)
      : candidateValue;
  }
  if (Array.isArray(candidateValue)) {
    return candidateValue.map(withTruncatedText);
  }
  if (candidateValue !== null && typeof candidateValue === "object") {
    return Object.fromEntries(
      Object.entries(candidateValue).map(([fieldName, fieldValue]) => [
        fieldName,
        withTruncatedText(fieldValue),
      ]),
    );
  }
  return candidateValue;
}

function minimalToolResultEnvelope(toolName, toolResult) {
  const minimalEnvelope = { operation: toolName, isTruncated: true };
  if (Number.isInteger(toolResult.loadGeneration)) {
    minimalEnvelope.loadGeneration = toolResult.loadGeneration;
  }
  if (typeof toolResult.status === "string") {
    minimalEnvelope.status = toolResult.status.slice(
      0,
      MAXIMUM_PROJECTED_TEXT_CHARACTERS,
    );
  }
  return minimalEnvelope;
}

export function projectWebMcpToolSuccess(toolName, controllerResult) {
  assertKnownToolName(toolName);

  let toolResult = {
    operation: toolName,
    ...projectedJsonValue(controllerResult ?? {}),
    isTruncated: false,
  };
  if (
    serializedLength({ isSuccess: true, toolResult }) <=
    WEB_MCP_TOOL_RESULT_CHARACTER_CEILING
  ) {
    return Object.freeze({
      isSuccess: true,
      toolResult: Object.freeze(toolResult),
    });
  }

  // Optional structural facts are the first thing a caller can do without.
  const withoutFacts = withoutNeighborhoodFacts(toolResult);
  toolResult = { ...withoutFacts.toolResult, isTruncated: true };
  // Reference identities remain exact; omit whole entries and retain totals.
  // Core view/layout values still answer the state-reading action at the ceiling.
  if (Array.isArray(toolResult.selection)) {
    toolResult.selectionCount = toolResult.selection.length;
  }
  if (Array.isArray(toolResult.view?.focus)) {
    toolResult.focusCount = toolResult.view.focus.length;
  }
  while (
    serializedLength({ isSuccess: true, toolResult }) >
    WEB_MCP_TOOL_RESULT_CHARACTER_CEILING
  ) {
    const trimmed = withOneTrimmedCollectionEntry(toolResult);
    if (!trimmed.hasChanged) {
      break;
    }
    toolResult = { ...trimmed.toolResult, isTruncated: true };
  }

  if (
    serializedLength({ isSuccess: true, toolResult }) >
    WEB_MCP_TOOL_RESULT_CHARACTER_CEILING
  ) {
    toolResult = { ...withTruncatedText(toolResult), isTruncated: true };
  }
  if (
    serializedLength({ isSuccess: true, toolResult }) >
    WEB_MCP_TOOL_RESULT_CHARACTER_CEILING
  ) {
    toolResult = minimalToolResultEnvelope(toolName, toolResult);
  }

  return Object.freeze({
    isSuccess: true,
    toolResult: Object.freeze(toolResult),
  });
}

export function projectWebMcpToolFailure(toolName, thrownError) {
  assertKnownToolName(toolName);

  if (thrownError instanceof WebMcpToolInputError) {
    return Object.freeze({
      isSuccess: false,
      error: Object.freeze({
        operation: toolName,
        code: "INVALID_TOOL_INPUT",
        message: thrownError.message.slice(
          0,
          MAXIMUM_PROJECTED_TEXT_CHARACTERS,
        ),
        isRetryable: false,
      }),
    });
  }

  const hasRecognisedDomainShape =
    thrownError !== null &&
    typeof thrownError === "object" &&
    ACCEPTED_DOMAIN_ERROR_CODES.includes(thrownError.code) &&
    typeof thrownError.message === "string" &&
    typeof thrownError.isRetryable === "boolean";

  // An unrecognised failure may carry a path, a host, or a credential in its
  // message, so none of it is passed on.
  return Object.freeze({
    isSuccess: false,
    error: Object.freeze(
      hasRecognisedDomainShape
        ? {
            operation: toolName,
            code: thrownError.code,
            message: thrownError.message.slice(
              0,
              MAXIMUM_PROJECTED_TEXT_CHARACTERS,
            ),
            isRetryable: thrownError.isRetryable,
          }
        : {
            operation: toolName,
            code: "TOOL_FAILED",
            message: "The operation could not be completed.",
            isRetryable: false,
          },
    ),
  });
}

// Each tool's normalizer, and the controller operation that answers it. The
// map is the whole routing table: a tool with no entry cannot be called, and a
// controller operation with no entry is not reachable from an agent.
const WEB_MCP_TOOL_ROUTES = Object.freeze({
  get_visualization_state: Object.freeze({
    normalizeToolInput: (input = {}) => {
      assertOnlyAllowedFieldNames(input, [], "get_visualization_state input");
      return Object.freeze({});
    },
    controllerOperationName: "getState",
  }),
  set_visualization_modes: Object.freeze({
    normalizeToolInput: (input) => {
      try {
        return createVisualizationModesRequest(input);
      } catch (error) {
        refuse(error.message);
      }
    },
    controllerOperationName: "setVisualizationModes",
  }),
  set_layout_distances: Object.freeze({
    normalizeToolInput: (input) => {
      try {
        return createForceLayoutDistancesRequest(input);
      } catch (error) {
        refuse(error.message);
      }
    },
    controllerOperationName: "setForceLayoutDistances",
  }),
  load_ontology: Object.freeze({
    normalizeToolInput: normalizeLoadOntologyToolInput,
    controllerOperationName: "loadOntology",
  }),
  get_ontology_summary: Object.freeze({
    normalizeToolInput: normalizeOntologySummaryToolInput,
    controllerOperationName: "getOntologySummary",
  }),
  find_ontology_elements: Object.freeze({
    normalizeToolInput: normalizeFindOntologyElementsToolInput,
    controllerOperationName: "findOntologyElements",
  }),
  set_visualization_view: Object.freeze({
    normalizeToolInput: normalizeSetVisualizationViewToolInput,
    controllerOperationName: "setVisualizationView",
  }),
  export_visualization: Object.freeze({
    normalizeToolInput: normalizeExportVisualizationToolInput,
    controllerOperationName: "exportVisualization",
  }),
});

// An anonymous identifier means nothing outside the load that produced it. A
// reference naming an earlier load is refused here rather than resolved
// against whatever now happens to carry that identifier.
function assertReferencesBelongToCurrentLoad(
  controllerRequest,
  currentLoadGeneration,
) {
  if (!Array.isArray(controllerRequest.focus)) {
    return;
  }
  for (const focusReference of controllerRequest.focus) {
    if (
      focusReference.loadGeneration !== undefined &&
      focusReference.loadGeneration !== currentLoadGeneration
    ) {
      refuse(
        `The reference to ${focusReference.localId} belongs to an earlier load.`,
      );
    }
  }
}

export function createWebMcpToolDispatch({ webVowlController }) {
  if (
    webVowlController === null ||
    typeof webVowlController !== "object" ||
    typeof webVowlController.getState !== "function"
  ) {
    throw new TypeError(
      "A WebMCP tool dispatch requires a WebVOWL controller.",
    );
  }

  return Object.freeze({
    async callWebMcpTool(toolName, toolInput, { signal } = {}) {
      assertKnownToolName(toolName);
      const { normalizeToolInput, controllerOperationName } =
        WEB_MCP_TOOL_ROUTES[toolName];

      let controllerRequest;
      try {
        controllerRequest = normalizeToolInput(toolInput);
        assertReferencesBelongToCurrentLoad(
          controllerRequest,
          webVowlController.getState().loadGeneration,
        );
      } catch (inputError) {
        return projectWebMcpToolFailure(toolName, inputError);
      }

      try {
        const controllerResult = await webVowlController[
          controllerOperationName
        ](controllerRequest, { signal });
        return projectWebMcpToolSuccess(toolName, controllerResult);
      } catch (operationError) {
        return projectWebMcpToolFailure(toolName, operationError);
      }
    },
  });
}
