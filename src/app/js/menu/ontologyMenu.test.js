import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import ontologyMenuFactory from "./ontologyMenu.js";

class MockSelection {
  constructor( node = {} ) {
    this.element = node;
    this.handlers = {};
    this.classes = new Set();
    this.attributes = {};

    this.element.addEventListener = (type, handler) => {
      this.handlers[type] = handler;
    };
    
    this.element.removeEventListener = (type, handler) => {
      if (this.handlers[type] === handler) {
        delete this.handlers[type];
      }
    };

    this.element.dispatchEvent = (event) => {
      const handler = this.handlers[event.type];
      if (handler) {
        handler.call(this.element, event);
      }
      return !event.defaultPrevented;
    };

    this.element.classList = {
      add: (cls) => this.classes.add(cls),
      remove: (cls) => this.classes.delete(cls),
      contains: (cls) => this.classes.has(cls),
      toggle: (cls, force) => {
        const shouldAdd = force !== undefined ? force : !this.classes.has(cls);
        if (shouldAdd) {
          this.classes.add(cls);
        } else {
          this.classes.delete(cls);
        }
        return shouldAdd;
      },
    };

    this.element.setAttribute = (name, value) => {
      this.attributes[name] = value;
    };

    this.element.getAttribute = (name) => {
      return this.attributes[name] || null;
    };

    this.element.removeAttribute = (name) => {
      delete this.attributes[name];
    };
  }

  on( type, handler ) {
    if ( arguments.length === 1 ) {return this.handlers[type];}
    this.handlers[type] = handler;
    return this;
  }

  datum( value ) {
    this.element.__data__ = value;
    return this;
  }

  property( name, value ) {
    if ( arguments.length === 1 ) {return this.element[name];}
    this.element[name] = value;
    return this;
  }

  classed( name, value ) {
    if ( arguments.length === 1 ) {return this.classes.has(name);}
    if ( value ) {this.classes.add(name);}
    else {this.classes.delete(name);}
    return this;
  }

  attr( name, value ) {
    if ( arguments.length === 1 ) {return this.attributes[name] ?? null;}
    this.attributes[name] = value;
    return this;
  }

  text( value ) {
    if ( arguments.length === 0 ) {return this.element.textContent;}
    this.element.textContent = value;
    return this;
  }

  node() {
    return this.element;
  }
}

describe("ontology URL normalization", () => {
  const normalize = ontologyMenuFactory.normalizeOntologyUrl;

  test("adds HTTPS when the protocol is omitted", () => {
    expect(normalize("example.org/ontology.owl")).toMatchObject({
      valid: true,
      normalizedUrl: "https://example.org/ontology.owl",
      wasNormalized: true
    });
  });

  test("upgrades HTTP to HTTPS", () => {
    expect(normalize("HTTP://example.org/ontology.owl")).toMatchObject({
      valid: true,
      normalizedUrl: "https://example.org/ontology.owl",
      wasNormalized: true
    });
  });

  test("accepts a host and port without mistaking the host for a scheme", () => {
    expect(normalize("localhost:5173/ontology.owl")).toMatchObject({
      valid: true,
      normalizedUrl: "https://localhost:5173/ontology.owl"
    });
  });

  test("uses the parsed pathname to identify JSON URLs", () => {
    expect(normalize("example.org/ontology.json?download=1#latest")).toMatchObject({
      valid: true,
      normalizedUrl: "https://example.org/ontology.json?download=1#latest",
      isJson: true
    });
  });

  test("preserves encoded URL components", () => {
    expect(normalize("https://example.org/my%20ontology.owl")).toMatchObject({
      valid: true,
      normalizedUrl: "https://example.org/my%20ontology.owl"
    });
  });

  test.each([
    "",
    "not a URL",
    "ftp://example.org/ontology.owl",
    "urn:example:ontology",
    "https://not%20a%20host/ontology.owl",
    "https://user:secret@example.org/ontology.owl"
  ])("rejects an unusable ontology URL: %s", ( value ) => {
    expect(normalize(value).valid).toBe(false);
  });
});

describe("ontology menu actions", () => {
  let selections;
  let emptyButton;
  let iriInput;
  let iriButton;
  let iriHint;
  let iriForm;
  let ontologyMenu;
  let createNewOntology;
  let hideAllMenus;

  beforeEach(() => {
    selections = new Map();
    const selectionFor = ( key ) => {
      if ( !selections.has(key) ) {selections.set(key, new MockSelection());}
      return selections.get(key);
    };

    global.location = { hash: "#file=foaf.rdf.json" };
    global.window = {
      addEventListener: jest.fn(),
    };
    global.document = {
      getElementById: ( id ) => selectionFor("#" + id).element
    };
    global.d3 = {
      select: selectionFor,
      selectAll: selectionFor
    };

    createNewOntology = jest.fn();
    hideAllMenus = jest.fn();
    const loadingModule = {
      createNewOntology,
      setOntologyMenu: jest.fn(),
      parseUrlAndLoadOntology: jest.fn()
    };
    const graph = {
      options: () => ({
        loadingModule: () => loadingModule,
        navigationMenu: () => ({ hideAllMenus })
      }),
      updateEditorModeDependentControls: jest.fn(),
      showReloadButtonAfterLayoutOptimization: jest.fn()
    };

    ontologyMenu = ontologyMenuFactory(graph);
    ontologyMenu.setup(jest.fn());
    emptyButton = selectionFor("#empty");
    iriInput = selectionFor("#iri-converter-input");
    iriButton = selectionFor("#iri-converter-button");
    iriHint = selectionFor("#iri-converter-hint");
    iriForm = selectionFor("#iri-converter-form");
  });

  test("enables the visualize button only for a URL that can be normalized", () => {
    expect(iriButton.element.disabled).toBe(true);

    iriInput.element.value = "not a URL";
    iriInput.handlers.input();
    expect(iriButton.element.disabled).toBe(true);

    iriInput.element.value = "example.org/ontology.owl";
    iriInput.handlers.input();
    expect(iriButton.element.disabled).toBe(false);
  });

  test("normalizes a protocol-less URL when its value is committed", () => {
    iriInput.element.value = "example.org/ontology.owl";

    iriInput.handlers.change();

    expect(iriInput.element.value).toBe("https://example.org/ontology.owl");
    expect(iriInput.attributes["aria-invalid"]).toBeNull();
    expect(iriHint.element.textContent).toBe("Enter an ontology URL");
  });

  test("normalizes before native validation when Enter is pressed", () => {
    const event = { key: "Enter", preventDefault: jest.fn() };
    iriInput.element.value = "example.org/ontology.owl";

    iriInput.handlers.keydown(event);

    expect(iriInput.element.value).toBe("https://example.org/ontology.owl");
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("normalizes before native validation when the button is activated", () => {
    const event = { preventDefault: jest.fn() };
    iriInput.element.value = "example.org/ontology.owl";

    iriButton.handlers.click(event);

    expect(iriInput.element.value).toBe("https://example.org/ontology.owl");
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test("shows an accessible error and blocks an invalid submission", () => {
    const event = { preventDefault: jest.fn() };
    iriInput.element.value = "not a URL";

    expect(iriForm.handlers.submit(event)).toBe(false);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(iriInput.attributes["aria-invalid"]).toBe("true");
    expect(iriHint.classes.has("converter-input-hint--error")).toBe(true);
    expect(iriHint.element.textContent).toBe("Enter a valid HTTP or HTTPS URL");
    expect(global.location.hash).toBe("#file=foaf.rdf.json");
  });

  test("routes a normalized URL safely through the location hash", () => {
    const event = { preventDefault: jest.fn() };
    iriInput.element.value = "http://example.org/ontology.json?download=1#latest";

    iriForm.handlers.submit(event);

    expect(global.location.hash).toBe(
      "url=" + encodeURIComponent("https://example.org/ontology.json?download=1#latest")
    );
    expect(iriInput.element.value).toBe("");
    expect(iriButton.element.disabled).toBe(true);
  });

  test("revalidates URLs submitted through the programmatic menu API", () => {
    ontologyMenu.setIriText("not a URL");
    expect(global.location.hash).toBe("#file=foaf.rdf.json");

    ontologyMenu.setIriText("example.org/ontology.owl");
    expect(global.location.hash).toBe(
      "iri=" + encodeURIComponent("https://example.org/ontology.owl")
    );
  });

  test("delegates an enabled create button to the explicit application command", () => {
    emptyButton.element.disabled = false;

    emptyButton.handlers.click();

    expect(createNewOntology).toHaveBeenCalledTimes(1);
    expect(hideAllMenus).toHaveBeenCalledTimes(1);
    expect(global.location.hash).toBe("#file=foaf.rdf.json");
  });

  test("keeps the native disabled state authoritative", () => {
    emptyButton.element.disabled = true;

    emptyButton.handlers.click();

    expect(createNewOntology).not.toHaveBeenCalled();
    expect(hideAllMenus).not.toHaveBeenCalled();
  });

  test("manages native disabled property and title on the reloadCachedOntology button", () => {
    const reloadButton = selections.get("#reloadCachedOntology") || new MockSelection();
    selections.set("#reloadCachedOntology", reloadButton);

    ontologyMenu.setCachedOntology("testOnto", { data: 1 });

    global.location.hash = "#iri=https://example.org/test.owl";
    ontologyMenu.cachedOntology("testOnto");
    expect(reloadButton.element.disabled).toBe(false);
    expect(reloadButton.element.title).toContain("overwrite cached ontology");

    global.location.hash = "#file=test.json";
    ontologyMenu.cachedOntology("testOnto");
    expect(reloadButton.element.disabled).toBe(true);
    expect(reloadButton.element.title).toContain("reloading original version not possible");
  });
});
