import { beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SourceTextModule } from "node:vm";

let createSvgSerializer;

const SVG_NAMESPACE_IRI = "http://www.w3.org/2000/svg";
const SERIALIZER_MODULE_URL = new URL("./svgSerializer.js", import.meta.url);
const RENDERED_GRAPH_CONTRACTS_MODULE_URL = new URL(
  "./renderedGraphRuntimeContracts.js",
  import.meta.url,
);
const WEB_VOWL_CONTRACTS_MODULE_URL = new URL(
  "./webVowlControllerContracts.js",
  import.meta.url,
);

async function createDependencyFreeModule(moduleUrl) {
  const sourceModule = new SourceTextModule(
    readFileSync(fileURLToPath(moduleUrl), "utf8"),
    { identifier: moduleUrl.href },
  );
  await sourceModule.link((specifier) => {
    throw new Error(`Unexpected SVG contract dependency: ${specifier}`);
  });
  await sourceModule.evaluate();
  return sourceModule;
}

beforeAll(async () => {
  const webVowlContractsModule = await createDependencyFreeModule(
    WEB_VOWL_CONTRACTS_MODULE_URL,
  );
  const renderedGraphContractsModule = new SourceTextModule(
    readFileSync(fileURLToPath(RENDERED_GRAPH_CONTRACTS_MODULE_URL), "utf8"),
    { identifier: RENDERED_GRAPH_CONTRACTS_MODULE_URL.href },
  );
  await renderedGraphContractsModule.link((specifier) => {
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlContractsModule;
    }
    throw new Error(`Unexpected rendered-SVG dependency: ${specifier}`);
  });
  await renderedGraphContractsModule.evaluate();

  const serializerModule = new SourceTextModule(
    readFileSync(fileURLToPath(SERIALIZER_MODULE_URL), "utf8"),
    { identifier: SERIALIZER_MODULE_URL.href },
  );
  await serializerModule.link((specifier) => {
    if (specifier === "./renderedGraphRuntimeContracts.js") {
      return renderedGraphContractsModule;
    }
    if (specifier === "./webVowlControllerContracts.js") {
      return webVowlContractsModule;
    }
    throw new Error(`Unexpected SVG serializer dependency: ${specifier}`);
  });
  await serializerModule.evaluate();
  ({ createSvgSerializer } = serializerModule.namespace);
});

function escapeXmlText(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlAttribute(text) {
  return escapeXmlText(text).replaceAll('"', "&quot;");
}

class SvgSerializationFixtureNode {
  constructor({ documentObject, kind, localName, namespaceIri, text = "" }) {
    this.attributes = new Map();
    this.children = [];
    this.documentObject = documentObject;
    this.kind = kind;
    this.localName = localName;
    this.namespaceURI = namespaceIri;
    this.parentNode = null;
    this.serializedText = text;
    this.textContentAssignmentCount = 0;
  }

  appendChild(childNode) {
    childNode.parentNode = this;
    this.children.push(childNode);
    return childNode;
  }

  cloneNode(includeDescendants) {
    const clonedNode = new SvgSerializationFixtureNode({
      documentObject: this.documentObject,
      kind: this.kind,
      localName: this.localName,
      namespaceIri: this.namespaceURI,
      text: this.serializedText,
    });
    clonedNode.attributes = new Map(this.attributes);
    clonedNode.textContentAssignmentCount = this.textContentAssignmentCount;
    if (includeDescendants) {
      for (const childNode of this.children) {
        clonedNode.appendChild(childNode.cloneNode(true));
      }
    }
    return clonedNode;
  }

  getAttribute(attributeName) {
    return this.attributes.get(attributeName) ?? null;
  }

  insertBefore(childNode, referenceNode) {
    const referenceIndex = this.children.indexOf(referenceNode);
    if (referenceIndex === -1) {
      return this.appendChild(childNode);
    }
    childNode.parentNode = this;
    this.children.splice(referenceIndex, 0, childNode);
    return childNode;
  }

  setAttribute(attributeName, attributeValue) {
    this.attributes.set(attributeName, String(attributeValue));
  }

  set innerHTML(_markup) {
    throw new Error("SVG serializer must not assign innerHTML.");
  }

  get textContent() {
    if (this.kind === "comment" || this.kind === "text") {
      return this.serializedText;
    }
    if (this.serializedText !== "") {
      return this.serializedText;
    }
    return this.children.map((childNode) => childNode.textContent).join("");
  }

  set textContent(text) {
    this.textContentAssignmentCount += 1;
    this.children = [];
    this.serializedText = String(text);
  }
}

class SvgSerializationDocumentFixture {
  constructor() {
    this.createdElementRecords = [];
  }

  createComment(commentText) {
    return new SvgSerializationFixtureNode({
      documentObject: this,
      kind: "comment",
      text: commentText,
    });
  }

  createDocumentFragment() {
    return new SvgSerializationFixtureNode({
      documentObject: this,
      kind: "fragment",
    });
  }

  createElementNS(namespaceIri, localName) {
    const element = new SvgSerializationFixtureNode({
      documentObject: this,
      kind: "element",
      localName,
      namespaceIri,
    });
    this.createdElementRecords.push({ element, localName, namespaceIri });
    return element;
  }

  createTextNode(text) {
    return new SvgSerializationFixtureNode({
      documentObject: this,
      kind: "text",
      text,
    });
  }
}

class DeterministicXmlSerializerFixture {
  serializeToString(rootNode) {
    return this.#serializeNode(rootNode);
  }

  #serializeNode(node) {
    if (node.kind === "comment") {
      return `<!--${node.serializedText}-->`;
    }
    if (node.kind === "text") {
      return escapeXmlText(node.serializedText);
    }
    if (node.kind === "fragment") {
      return node.children
        .map((childNode) => this.#serializeNode(childNode))
        .join("");
    }
    const serializedAttributes = [...node.attributes.entries()]
      .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
      .map(
        ([attributeName, attributeValue]) =>
          ` ${attributeName}="${escapeXmlAttribute(attributeValue)}"`,
      )
      .join("");
    const serializedChildren =
      node.serializedText !== ""
        ? escapeXmlText(node.serializedText)
        : node.children
            .map((childNode) => this.#serializeNode(childNode))
            .join("");
    return `<${node.localName}${serializedAttributes}>${serializedChildren}</${node.localName}>`;
  }
}

class FailingXmlSerializerFixture {
  serializeToString() {
    throw new Error("injected XML serialization failure");
  }
}

function createViewRecipe(overrides = {}) {
  return {
    pageLocalViewRecipeId: "svg-view-recipe-7-1",
    source: {
      kind: "ontology-document-iri",
      identity: "https://example.test/ontology.owl",
      sha256Hex: "a".repeat(64),
    },
    loadGeneration: 7,
    appliedVisualizationView: {
      language: "en",
      filters: {
        datatypes: "hide",
        objectProperties: "show",
        subclasses: "show",
        disjointness: "hide",
        setOperators: "show",
        minDegree: 2,
      },
      focus: [{ kind: "class", iri: "https://example.test/ontology#Person" }],
      layout: "preserve",
      viewport: "fit",
      zoomScale: null,
    },
    viewportDimensions: { widthPx: 960, heightPx: 640 },
    layoutOutcome: { status: "settled", reason: "stable-frames" },
    ...overrides,
  };
}

function createRenderedSvgFixture(documentObject) {
  const liveSvgRoot = documentObject.createElementNS(SVG_NAMESPACE_IRI, "svg");
  liveSvgRoot.setAttribute("data-renderer-ownership", "live");
  const styledNode = documentObject.createElementNS(SVG_NAMESPACE_IRI, "g");
  styledNode.setAttribute("class", "vowl-class");
  styledNode.setAttribute("style", "fill:#aaccff;stroke:#336699");
  const unicodeLabel = documentObject.createElementNS(
    SVG_NAMESPACE_IRI,
    "text",
  );
  unicodeLabel.textContent = "Žluťoučký Person & Organisation";
  styledNode.appendChild(unicodeLabel);
  liveSvgRoot.appendChild(styledNode);
  const detachedSvgRoot = liveSvgRoot.cloneNode(true);
  const interactionOnlyNode = documentObject.createElementNS(
    SVG_NAMESPACE_IRI,
    "text",
  );
  interactionOnlyNode.textContent = "hidden-in-export";
  liveSvgRoot.appendChild(interactionOnlyNode);

  return {
    detachedSvgRoot,
    liveSvgRoot,
    renderedSvgSnapshot: Object.freeze({
      loadGeneration: 7,
      detachedSvgRoot,
      widthPx: 960,
      heightPx: 640,
    }),
  };
}

function serializedFixtureBytes(rootNode) {
  return new TextEncoder().encode(
    new DeterministicXmlSerializerFixture().serializeToString(rootNode),
  );
}

describe("detached rendered SVG serialization", () => {
  let documentObject;
  let fixture;
  let liveSvgBytesBeforeSerialization;
  let snapshotSvgBytesBeforeSerialization;

  beforeEach(() => {
    documentObject = new SvgSerializationDocumentFixture();
    fixture = createRenderedSvgFixture(documentObject);
    liveSvgBytesBeforeSerialization = serializedFixtureBytes(
      fixture.liveSvgRoot,
    );
    snapshotSvgBytesBeforeSerialization = serializedFixtureBytes(
      fixture.detachedSvgRoot,
    );
  });

  function expectRendererOwnedSvgTreesUnchanged() {
    expect(serializedFixtureBytes(fixture.liveSvgRoot)).toEqual(
      liveSvgBytesBeforeSerialization,
    );
    expect(serializedFixtureBytes(fixture.detachedSvgRoot)).toEqual(
      snapshotSvgBytesBeforeSerialization,
    );
    expect(fixture.liveSvgRoot.parentNode).toBeNull();
    expect(fixture.detachedSvgRoot.parentNode).toBeNull();
  }

  function createSerializer(
    XMLSerializerConstructor = DeterministicXmlSerializerFixture,
  ) {
    return createSvgSerializer({
      XMLSerializerConstructor,
      documentObject,
      webVowlVersion: "2.0.0",
    });
  }

  test("preserves styled Unicode SVG content and supplies portable root attributes", () => {
    const serializedSvgText = createSerializer().serializeRenderedSvgSnapshot({
      renderedSvgSnapshot: fixture.renderedSvgSnapshot,
      viewRecipe: createViewRecipe(),
    });

    expect(serializedSvgText).toContain(
      "<!--Created with WebVOWL (version 2.0.0), https://github.com/Hadden-Industries/webvowl-->",
    );
    expect(serializedSvgText).toContain('version="1.1"');
    expect(serializedSvgText).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(serializedSvgText).toContain('width="960"');
    expect(serializedSvgText).toContain('height="640"');
    expect(serializedSvgText).toContain('viewBox="0 0 960 640"');
    expect(serializedSvgText).toContain('style="fill:#aaccff;stroke:#336699"');
    expect(serializedSvgText).toContain("Žluťoučký Person &amp; Organisation");
    expect(serializedSvgText).not.toContain("hidden-in-export");
    expectRendererOwnedSvgTreesUnchanged();
  });

  test("embeds the complete view recipe through SVG metadata text content", () => {
    const injectionLikeIdentity =
      "</metadata><script>unexpectedOntologyInstruction()</script>";
    const viewRecipe = createViewRecipe({
      source: {
        kind: "ontology-document-iri",
        identity: injectionLikeIdentity,
        sha256Hex: "b".repeat(64),
      },
    });

    const serializedSvgText = createSerializer().serializeRenderedSvgSnapshot({
      renderedSvgSnapshot: fixture.renderedSvgSnapshot,
      viewRecipe,
    });

    const metadataCreationRecord = documentObject.createdElementRecords.find(
      ({ localName }) => localName === "metadata",
    );
    expect(metadataCreationRecord).toEqual(
      expect.objectContaining({
        localName: "metadata",
        namespaceIri: SVG_NAMESPACE_IRI,
      }),
    );
    expect(metadataCreationRecord.element.textContentAssignmentCount).toBe(1);
    expect(JSON.parse(metadataCreationRecord.element.textContent)).toEqual({
      webVowlVersion: "2.0.0",
      ...viewRecipe,
    });
    expect(serializedSvgText).not.toContain("<script>");
    expect(serializedSvgText).toContain(
      "&lt;/metadata&gt;&lt;script&gt;unexpectedOntologyInstruction()&lt;/script&gt;",
    );
    expectRendererOwnedSvgTreesUnchanged();
  });

  test("omits an unavailable source fingerprint instead of inventing one", () => {
    const sourceWithoutFingerprint = {
      kind: "vowl-model",
      identity: "local-file.owl",
    };
    createSerializer().serializeRenderedSvgSnapshot({
      renderedSvgSnapshot: fixture.renderedSvgSnapshot,
      viewRecipe: createViewRecipe({ source: sourceWithoutFingerprint }),
    });

    const metadataElement = documentObject.createdElementRecords.find(
      ({ localName }) => localName === "metadata",
    ).element;
    expect(JSON.parse(metadataElement.textContent).source).toEqual(
      sourceWithoutFingerprint,
    );
    expectRendererOwnedSvgTreesUnchanged();
  });

  test.each([
    ["a missing view recipe", null],
    ["a stale load generation", createViewRecipe({ loadGeneration: 6 })],
    [
      "mismatched viewport dimensions",
      createViewRecipe({
        viewportDimensions: { widthPx: 961, heightPx: 640 },
      }),
    ],
    [
      "an invalid source fingerprint",
      createViewRecipe({
        source: {
          kind: "ontology-document-iri",
          identity: "https://example.test/ontology.owl",
          sha256Hex: "not-a-sha256",
        },
      }),
    ],
  ])("rejects %s without mutating either SVG tree", (_scenario, viewRecipe) => {
    expect(() =>
      createSerializer().serializeRenderedSvgSnapshot({
        renderedSvgSnapshot: fixture.renderedSvgSnapshot,
        viewRecipe,
      }),
    ).toThrow();
    expectRendererOwnedSvgTreesUnchanged();
  });

  test("leaves both SVG trees unchanged when XML serialization fails", () => {
    expect(() =>
      createSerializer(
        FailingXmlSerializerFixture,
      ).serializeRenderedSvgSnapshot({
        renderedSvgSnapshot: fixture.renderedSvgSnapshot,
        viewRecipe: createViewRecipe(),
      }),
    ).toThrow("injected XML serialization failure");
    expectRendererOwnedSvgTreesUnchanged();
  });

  test("honors cancellation before cloning or serializing the snapshot", () => {
    const cancellationController = new AbortController();
    const cancellationReason = new Error("cancelled SVG serialization");
    cancellationController.abort(cancellationReason);

    expect(() =>
      createSerializer().serializeRenderedSvgSnapshot(
        {
          renderedSvgSnapshot: fixture.renderedSvgSnapshot,
          viewRecipe: createViewRecipe(),
        },
        { signal: cancellationController.signal },
      ),
    ).toThrow(cancellationReason);
    expectRendererOwnedSvgTreesUnchanged();
  });

  test.each([
    ["graph", () => ({ graph: { querySelector: () => null } })],
    ["selection", () => ({ selection: { attr: () => undefined } })],
    ["force", () => ({ force: { alpha: () => 0 } })],
    ["live SVG", () => ({ liveSvgRoot: fixture.liveSvgRoot })],
    ["menu", () => ({ menu: { setup: () => undefined } })],
    ["renderer", () => ({ renderer: { updateStyle: () => undefined } })],
  ])(
    "rejects a %s dependency outside the D3-free serializer interface",
    (_dependencyName, createForbiddenDependency) => {
      expect(() =>
        createSvgSerializer({
          XMLSerializerConstructor: DeterministicXmlSerializerFixture,
          documentObject,
          webVowlVersion: "2.0.0",
          ...createForbiddenDependency(),
        }),
      ).toThrow("invalid dependency field set");
    },
  );

  test("names no D3 identifier anywhere in its source", () => {
    const serializerSource = readFileSync(
      fileURLToPath(SERIALIZER_MODULE_URL),
      "utf8",
    );

    expect(serializerSource).not.toMatch(/(?<![\w$])d3(?![\w$])/);
  });
});
