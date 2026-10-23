import assert from "node:assert/strict";

/** Independent complete-description and navigation oracle in a real DOM. */
export async function qualifyPresentationFixtures(page, baseUrl) {
  // A same-origin text response gives the fixture an origin without starting
  // the application or requiring version-specific network interception.
  await page.goto(
    new URL("app/js/ui/entityPresentationModel.js", baseUrl).href,
  );
  await page.setContent(`<!doctype html><html lang="en"><title>Presentation fixture</title><body>
    <h1>Independent presentation fixture</h1><button id="ontology-overview-open">Overview</button>
    <section id="entity-preview"><div id="entity-preview-body"></div><button id="entity-preview-details">Details</button><button id="entity-preview-close">Close</button></section>
    <div><div id="entity-full-details"></div></div><p id="entity-details-status" role="status"></p><p id="visualizationActionStatus" hidden></p>
    </body></html>`);
  const result = await page.evaluate(async () => {
    const { createEntityDetailsPresenter } =
      await import("/app/js/ui/entityDetailsPresenter.js");
    const { createSelectionPresentationScheduler } =
      await import("/app/js/ui/selectionPresentationScheduler.js");
    const { ONTOLOGY_ROLE_KINDS } =
      await import("/app/js/controller/webVowlControllerContracts.js");
    const doc = globalThis.document;
    const selected = Object.entries(ONTOLOGY_ROLE_KINDS).flatMap(
      ([kind, roles]) =>
        roles.map((roleKind) => ({
          kind,
          roleKind,
          iri: "urn:fixture:selected",
        })),
    );
    const related = {
      kind: "class",
      roleKind: "class",
      iri: "urn:fixture:hidden",
    };
    const longComment =
      "Complete comment " +
      "long content ".repeat(60) +
      "<img src=x onerror=alert(1)>";
    function description(reference) {
      const relation = [
        {
          ontologyElementReference: related,
          displayLabel: "Hidden relation",
          iri: related.iri,
        },
      ];
      return {
        ontologyElementReference: reference,
        kind: reference.kind,
        iri: reference.iri ?? null,
        displayLabel:
          reference.iri === related.iri
            ? "Hidden relation"
            : "Selected subject",
        elementTypeName: reference.roleKind,
        commentText: longComment,
        descriptionText: "Complete definition",
        annotationRecords: [
          {
            propertyIri: "urn:annotation",
            localName: "annotation",
            languageTag: "fr",
            text: "étiquette entière",
            valueKind: "literal",
          },
        ],
        characteristicNames: ["functional"],
        unclassifiedAttributeNames: ["opaque attribute"],
        ...(reference.kind === "class"
          ? {
              superclassElements: relation,
              equivalentClassElements: [],
              disjointClassElements: [],
              individualElements: [],
            }
          : {}),
        ...(reference.kind === "individual" ? { classElements: relation } : {}),
        ...(reference.kind === "property"
          ? {
              cardinalityRecord: { exact: 0, minimum: 0, maximum: 10 },
              domainElements: relation,
              rangeElements: relation,
              superpropertyElements: [],
              inversePropertyElements: [],
              equivalentPropertyElements: [],
              subpropertyElements: [],
            }
          : {}),
      };
    }
    let state = {
      status: "ready",
      loadGeneration: 1,
      documentRevision: 0,
      view: { language: "en" },
      selection: selected,
    };
    let opened = false;
    let onOpen;
    let onClose;
    let reads = 0;
    let writes = 0;
    let facts = 0;
    const frames = new Map();
    let next = 0;
    const controller = {
      getState: () => state,
      describeOntologyElements(request) {
        reads++;
        return {
          elementDescriptions: request.ontologyElementReferences
            .filter(
              (reference) =>
                reference.iri !== related.iri || reference.roleKind === "class",
            )
            .map(description),
        };
      },
      selectVisualizationElement(request) {
        if (request.reference !== null)
          throw new Error("Navigation wrote occurrence selection");
        writes++;
        state = { ...state, selection: [] };
      },
    };
    const surface = {
      openDetails() {
        opened = true;
        onOpen();
      },
      closeDetails() {
        opened = false;
        onClose();
      },
      isOpen: () => opened,
      onOpen(listener) {
        onOpen = listener;
      },
      onClose(listener) {
        onClose = listener;
      },
    };
    let scheduler;
    const presenter = createEntityDetailsPresenter({
      controller,
      surface,
      openFacts: () => facts++,
      onPresentationChanged() {},
      scheduleRefresh: () => scheduler.schedule(state),
    });
    scheduler = createSelectionPresentationScheduler({
      describe: (request) => presenter.describe(request),
      render: (rows) => presenter.render(rows),
      requestFrame: (callback) => {
        frames.set(++next, callback);
        return next;
      },
      cancelFrame: (id) => frames.delete(id),
    });
    function flush() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback());
    }
    const require = (condition, message) => {
      if (!condition) throw new Error(message);
    };
    scheduler.schedule(state);
    flush();
    doc.getElementById("entity-preview-details").click();
    const details = doc.getElementById("entity-full-details");
    require(details.querySelectorAll("section > h3").length ===
      8, "Every semantic role must remain available");
    require(details.textContent.includes(
      longComment,
    ), "Full details truncated the comment");
    require(!details.querySelector(
      "img",
    ), "Untrusted content was interpreted as HTML");
    require(details.querySelectorAll('[lang="fr"]').length ===
      8, "Annotation languages were lost");
    const names = [...details.querySelectorAll("dt")].map(
      (element) => element.textContent,
    );
    for (const field of [
      "Type",
      "Comment",
      "Description",
      "Annotations",
      "Characteristics",
      "Other attributes",
      "Cardinality",
      "Exact",
      "Minimum",
      "Maximum",
      "Superclasses",
      "Equivalent classes",
      "Disjoint classes",
      "Individuals",
      "Types",
      "Domain",
      "Range",
      "Superproperties",
      "Inverse properties",
      "Equivalent properties",
      "Subproperties",
    ]) {
      require(names.includes(field), `Missing complete field ${field}`);
    }
    const zero = [...details.querySelectorAll("dt")].find(
      (element) => element.textContent === "Exact",
    );
    require(zero.nextElementSibling.textContent ===
      "0", "Zero cardinality became empty");
    details.querySelector("dd button").click();
    flush();
    require(reads === 2 &&
      writes === 0 &&
      state.selection ===
        selected, "Relation navigation exceeded one read or changed graph authority");
    require(details.textContent.includes("Related entity details") &&
      details.textContent.includes(
        "Hidden relation",
      ), "Hidden related subject was not readable");
    require(doc.activeElement.tagName ===
      "H3", "Relation heading did not receive focus");
    state = { ...state, view: { language: "fr" } };
    scheduler.schedule(state);
    flush();
    require(details.textContent.includes(
      "Related entity details",
    ), "Language update lost valid relation navigation");
    state = { ...state, documentRevision: 1 };
    scheduler.schedule(state);
    flush();
    require(!details.textContent.includes(
      "Related entity details",
    ), "Revision retained an obsolete related page");
    [...details.querySelectorAll("button")]
      .find((button) => button.textContent === "Ontology facts")
      .click();
    require(facts === 1, "Retained ontology facts are unreachable");
    surface.closeDetails();
    require(!doc.getElementById("entity-preview")
      .hidden, "Closing Details hid the selected preview");
    const roleControl = doc.querySelector("#entity-preview-body button");
    roleControl.focus();
    const focusedRole = roleControl.dataset.roleKey;
    state = { ...state, view: { language: "en" } };
    scheduler.schedule(state);
    flush();
    require(doc.activeElement.dataset.roleKey ===
      focusedRole, "Language refresh lost preview role focus");
    state = {
      ...state,
      loadGeneration: 2,
      documentRevision: 0,
      selection: [
        {
          kind: "class",
          roleKind: "class",
          loadGeneration: 2,
          localId: "blank",
        },
      ],
    };
    scheduler.schedule(state);
    flush();
    doc.getElementById("entity-preview-details").click();
    require(details.textContent.includes(
      "Anonymous — no IRI",
    ), "Anonymous selection lost its scoped description");
    doc.getElementById("entity-preview-close").click();
    require(writes === 1 &&
      !state.selection
        .length, "Preview close did not clear through the controller");
    scheduler.schedule(state);
    flush();
    require(doc.getElementById("entity-preview").hidden &&
      !opened, "Cleared selection retained a surface");
    presenter.dispose();
    scheduler.dispose();
    return {
      roles: selected.length,
      completeFieldNames: [...new Set(names)],
      hiddenRelatedEntity: true,
      annotationLanguage: "fr",
      zeroCardinality: true,
      untrustedText: "inert",
      semanticReads: reads,
      graphWrites: writes,
      lifetime: "generation, revision, language, close, dispose",
    };
  });
  assert.equal(result.roles, 8);
  return result;
}
