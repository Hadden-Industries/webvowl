import { beforeAll, describe, expect, jest, test } from "@jest/globals";
import loadEsmModuleForTest from "../../test/loadEsmModuleForTest.js";

let createControllerStatePresenter;

beforeAll(async () => {
  ({ createControllerStatePresenter } = await loadEsmModuleForTest(
    new URL("./controllerStatePresenter.js", import.meta.url),
    import.meta.url,
  ));
});

const PERSON_REFERENCE = Object.freeze({
  kind: "class",
  iri: "https://example.test/Person",
});

function createControllerState(overrides = {}) {
  return Object.freeze({
    status: "ready",
    loadGeneration: 1,
    source: null,
    warnings: [],
    view: null,
    viewport: null,
    layout: { status: "settled" },
    selection: [],
    renderProgress: null,
    editorMode: null,
    error: null,
    ...overrides,
  });
}

function createPresentationSpies() {
  return {
    renderLoadState: jest.fn(),
    renderGraphLayoutPaused: jest.fn(),
    renderSelectedOntologyElements: jest.fn(),
    renderSelectedOntologyElementDetails: jest.fn(),
    renderOntologySummary: jest.fn(),
    renderViewport: jest.fn(),
    describeOntologyElements: jest.fn(() => ({
      elementDescriptions: [{ kind: "class", displayLabel: "Person" }],
    })),
    readOntologySummary: jest.fn(() => ({ classCount: 1 })),
  };
}

// The first state a presenter sees is entirely new to it, so the tests below
// establish that state before asserting what a later change presents.
function mountPresenter(initialStateOverrides = {}) {
  const presentationSpies = createPresentationSpies();
  const presenter = createControllerStatePresenter(presentationSpies);
  presenter.present(createControllerState(initialStateOverrides), []);
  for (const presentationSpy of Object.values(presentationSpies)) {
    presentationSpy.mockClear();
  }
  return { presentationSpies, presenter };
}

describe("controller state presentation", () => {
  test("presents every slice for the first state it receives", () => {
    const presentationSpies = createPresentationSpies();
    const presenter = createControllerStatePresenter(presentationSpies);

    presenter.present(createControllerState(), []);

    expect(presentationSpies.renderLoadState).toHaveBeenCalledTimes(1);
    expect(presentationSpies.renderGraphLayoutPaused).toHaveBeenCalledWith(
      false,
    );
    expect(
      presentationSpies.renderSelectedOntologyElements,
    ).toHaveBeenCalledTimes(1);
    expect(presentationSpies.renderOntologySummary).toHaveBeenCalledTimes(1);
  });

  test("leaves every other panel alone when only the viewport changed", () => {
    const { presentationSpies, presenter } = mountPresenter({
      selection: [PERSON_REFERENCE],
    });

    // A held zoom button reports a viewport fact on every animation frame. A
    // reader's highlighted text and scroll position in the details panel must
    // survive that.
    for (const zoomScale of [1.1, 1.2, 1.3]) {
      presenter.present(
        createControllerState({
          selection: [PERSON_REFERENCE],
          viewport: { zoomScale, translationXPx: 0, translationYPx: 0 },
        }),
        ["viewport"],
      );
    }

    expect(presentationSpies.renderViewport).toHaveBeenCalledTimes(3);
    expect(presentationSpies.describeOntologyElements).not.toHaveBeenCalled();
    expect(
      presentationSpies.renderSelectedOntologyElementDetails,
    ).not.toHaveBeenCalled();
    expect(
      presentationSpies.renderSelectedOntologyElements,
    ).not.toHaveBeenCalled();
    expect(presentationSpies.renderLoadState).not.toHaveBeenCalled();
    expect(presentationSpies.renderGraphLayoutPaused).not.toHaveBeenCalled();
  });

  test("presents the selection the producer reports as changed", () => {
    const { presentationSpies, presenter } = mountPresenter();

    presenter.present(
      createControllerState({ selection: [PERSON_REFERENCE] }),
      ["selection"],
    );

    expect(
      presentationSpies.renderSelectedOntologyElementDetails,
    ).toHaveBeenCalledTimes(1);
    expect(presentationSpies.describeOntologyElements).toHaveBeenCalledWith({
      ontologyElementReferences: [PERSON_REFERENCE],
    });
  });

  test("compares nothing itself and trusts the reported change set", () => {
    const { presentationSpies, presenter } = mountPresenter({
      selection: [PERSON_REFERENCE],
    });

    // The producer narrows its written fields to those that actually differ, so
    // a state carrying an unchanged selection never reports it as changed.
    presenter.present(
      createControllerState({ selection: [PERSON_REFERENCE] }),
      ["layout"],
    );

    expect(
      presentationSpies.renderSelectedOntologyElementDetails,
    ).not.toHaveBeenCalled();
    expect(presentationSpies.renderGraphLayoutPaused).toHaveBeenCalledTimes(1);
  });

  test("presents the pause state when the layout field changes", () => {
    const { presentationSpies, presenter } = mountPresenter();

    presenter.present(createControllerState({ layout: { status: "paused" } }), [
      "layout",
    ]);

    expect(presentationSpies.renderGraphLayoutPaused).toHaveBeenCalledTimes(1);
    expect(presentationSpies.renderGraphLayoutPaused).toHaveBeenLastCalledWith(
      true,
    );
  });

  test("summarises once per loaded ontology rather than once per publication", () => {
    const { presentationSpies, presenter } = mountPresenter({
      status: "relaxing",
    });

    presenter.present(createControllerState({ status: "ready" }), ["status"]);
    presenter.present(createControllerState({ status: "ready" }), ["layout"]);

    expect(presentationSpies.renderOntologySummary).toHaveBeenCalledTimes(1);

    presenter.present(
      createControllerState({ status: "ready", loadGeneration: 2 }),
      ["status", "loadGeneration"],
    );

    expect(presentationSpies.renderOntologySummary).toHaveBeenCalledTimes(2);
  });

  test("presents the load state for any of the fields it draws", () => {
    const { presentationSpies, presenter } = mountPresenter({
      status: "loading",
    });

    presenter.present(
      createControllerState({
        status: "loading",
        renderProgress: {
          completedRenderedElementCount: 40,
          totalRenderedElementCount: 100,
        },
      }),
      ["renderProgress"],
    );

    expect(presentationSpies.renderLoadState).toHaveBeenCalledTimes(1);

    // A viewport fact is not part of the load state.
    presenter.present(
      createControllerState({
        status: "loading",
        viewport: { zoomScale: 3, translationXPx: 1, translationYPx: 2 },
      }),
      ["viewport"],
    );

    expect(presentationSpies.renderLoadState).toHaveBeenCalledTimes(1);
  });

  test("never describes a selection before an ontology exists", () => {
    const presentationSpies = createPresentationSpies();
    const presenter = createControllerStatePresenter(presentationSpies);

    presenter.present(
      createControllerState({
        status: "idle",
        loadGeneration: 0,
        selection: [PERSON_REFERENCE],
      }),
      [],
    );

    expect(presentationSpies.describeOntologyElements).not.toHaveBeenCalled();
    expect(
      presentationSpies.renderSelectedOntologyElementDetails,
    ).toHaveBeenCalledWith([]);
  });

  test("presents no magnification before the renderer has reported one", () => {
    const { presentationSpies, presenter } = mountPresenter();

    presenter.present(createControllerState({ viewport: null }), ["viewport"]);

    expect(presentationSpies.renderViewport).not.toHaveBeenCalled();
  });
});
