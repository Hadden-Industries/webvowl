import { assertRenderedGraphRuntime } from "../js/controller/renderedGraphRuntimeContracts.js";

function createReplacementRequest(loadGeneration) {
  return {
    displayName: `generation-${loadGeneration}.json`,
    loadGeneration,
    vowlModel: {
      class: [{ id: String(loadGeneration), type: "owl:Class" }],
      header: { iri: `https://example.test/ontology/${loadGeneration}` },
    },
  };
}

async function expectPromiseToRemainPending(promise, expect) {
  let hasSettled = false;
  void promise.then(
    () => {
      hasSettled = true;
    },
    () => {
      hasSettled = true;
    },
  );
  await Promise.resolve();
  expect(hasSettled).toBe(false);
}

async function completeRenderedGraphLoad(adapterHarness, loadGeneration) {
  const replacementPromise =
    adapterHarness.renderedGraphRuntime.replaceVowlModel(
      createReplacementRequest(loadGeneration),
      { signal: new AbortController().signal },
    );
  adapterHarness.renderedGraphTestHarness.completeInitialPaint(loadGeneration);
  await replacementPromise;
}

export async function assertRenderedGraphRuntimeContract({
  createAdapterHarness,
  expect,
}) {
  {
    const adapterHarness = createAdapterHarness();
    const { renderedGraphRuntime, renderedGraphTestHarness } = adapterHarness;
    expect(assertRenderedGraphRuntime(renderedGraphRuntime)).toBe(
      renderedGraphRuntime,
    );

    const replacementPromise = renderedGraphRuntime.replaceVowlModel(
      createReplacementRequest(1),
      { signal: new AbortController().signal },
    );
    await expectPromiseToRemainPending(replacementPromise, expect);
    expect(renderedGraphTestHarness.completeInitialPaint(1)).toBe(true);
    await expect(replacementPromise).resolves.toEqual({ loadGeneration: 1 });

    const visibleRenderedGraphSnapshot =
      renderedGraphRuntime.readVisibleRenderedGraphSnapshot();
    const graphLayoutSnapshot = renderedGraphRuntime.readGraphLayoutSnapshot();
    expect(visibleRenderedGraphSnapshot.loadGeneration).toBe(1);
    expect(graphLayoutSnapshot.loadGeneration).toBe(1);
    expect(Object.isFrozen(visibleRenderedGraphSnapshot)).toBe(true);
    expect(Object.isFrozen(graphLayoutSnapshot)).toBe(true);
    expect(renderedGraphRuntime.readVisibleRenderedGraphSnapshot()).not.toBe(
      visibleRenderedGraphSnapshot,
    );

    const renderedSvgSnapshot = renderedGraphRuntime.createRenderedSvgSnapshot({
      loadGeneration: 1,
    });
    const nextRenderedSvgSnapshot =
      renderedGraphRuntime.createRenderedSvgSnapshot({ loadGeneration: 1 });
    expect(renderedSvgSnapshot.loadGeneration).toBe(1);
    expect(renderedSvgSnapshot.detachedSvgRoot).not.toBe(
      nextRenderedSvgSnapshot.detachedSvgRoot,
    );

    renderedGraphRuntime.dispose();
  }

  {
    const adapterHarness = createAdapterHarness();
    const generationOnePromise =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        createReplacementRequest(1),
        { signal: new AbortController().signal },
      );
    const generationTwoPromise =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        createReplacementRequest(2),
        { signal: new AbortController().signal },
      );

    await expect(generationOnePromise).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(
      adapterHarness.renderedGraphTestHarness.completeInitialPaint(1),
    ).toBe(false);
    await expectPromiseToRemainPending(generationTwoPromise, expect);
    expect(
      adapterHarness.renderedGraphTestHarness.completeInitialPaint(2),
    ).toBe(true);
    await expect(generationTwoPromise).resolves.toEqual({ loadGeneration: 2 });

    adapterHarness.renderedGraphRuntime.dispose();
  }

  {
    const adapterHarness = createAdapterHarness();
    const abortController = new AbortController();
    const callerAbortReason = new DOMException(
      "The caller cancelled rendering.",
      "AbortError",
    );
    const replacementPromise =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        createReplacementRequest(1),
        { signal: abortController.signal },
      );

    abortController.abort(callerAbortReason);

    await expect(replacementPromise).rejects.toBe(callerAbortReason);
    expect(
      adapterHarness.renderedGraphTestHarness.completeInitialPaint(1),
    ).toBe(false);
    adapterHarness.renderedGraphRuntime.dispose();
  }

  {
    const adapterHarness = createAdapterHarness();
    await completeRenderedGraphLoad(adapterHarness, 1);
    const viewAbortController = new AbortController();
    const viewApplicationPromise =
      adapterHarness.renderedGraphRuntime.applyVisualizationView(
        {
          filters: { datatypes: "hide", minDegree: 2 },
          focus: [{ kind: "class", iri: "https://example.test/Person" }],
          language: "en",
          layout: "resume",
          loadGeneration: 1,
          viewport: "zoom-and-center",
        },
        { signal: viewAbortController.signal },
      );
    await expectPromiseToRemainPending(viewApplicationPromise, expect);
    expect(
      adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
        1,
      ),
    ).toBe(true);
    const viewApplicationResult = await viewApplicationPromise;
    expect(viewApplicationResult).toEqual({
      appliedVisualizationView: {
        filters: {
          datatypes: "hide",
          disjointness: "show",
          minDegree: 2,
          objectProperties: "show",
          setOperators: "show",
          subclasses: "show",
        },
        focus: [{ kind: "class", iri: "https://example.test/Person" }],
        language: "en",
      },
      loadGeneration: 1,
      visibleRenderedGraphSnapshot:
        adapterHarness.renderedGraphRuntime.readVisibleRenderedGraphSnapshot(),
    });
    expect(Object.isFrozen(viewApplicationResult)).toBe(true);

    adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
      loadGeneration: 1,
      isPaused: true,
    });
    expect(
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot().isPaused,
    ).toBe(true);
    for (const [viewRequest, expectedPauseState] of [
      [{ layout: "resume" }, false],
      [{ layout: "pause" }, true],
      [{}, true],
    ]) {
      const application =
        adapterHarness.renderedGraphRuntime.applyVisualizationView(
          { loadGeneration: 1, ...viewRequest },
          { signal: new AbortController().signal },
        );
      expect(
        adapterHarness.renderedGraphTestHarness.completeVisualizationViewApplication(
          1,
        ),
      ).toBe(true);
      const result = await application;
      expect(
        adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot().isPaused,
      ).toBe(expectedPauseState);
      expect(Object.keys(result.appliedVisualizationView).sort()).toEqual([
        "filters",
        "focus",
        "language",
      ]);
    }

    adapterHarness.renderedGraphRuntime.dispose();
  }

  {
    const adapterHarness = createAdapterHarness();
    await completeRenderedGraphLoad(adapterHarness, 1);
    const publishedEvents = [];
    const unsubscribeFirst =
      adapterHarness.renderedGraphRuntime.subscribeToRenderedGraphEvents(
        (event) => publishedEvents.push(`first:${event.kind}`),
      );
    adapterHarness.renderedGraphRuntime.subscribeToRenderedGraphEvents(
      (event) => publishedEvents.push(`second:${event.kind}`),
    );
    const viewportEvent = {
      kind: "viewport-changed",
      loadGeneration: 1,
      payload: {
        translationXPx: 12,
        translationYPx: -8,
        zoomScale: 1.25,
      },
    };

    expect(
      adapterHarness.renderedGraphTestHarness.publishRenderedGraphEvent(
        viewportEvent,
      ),
    ).toBe(true);
    unsubscribeFirst();
    unsubscribeFirst();
    expect(
      adapterHarness.renderedGraphTestHarness.publishRenderedGraphEvent(
        viewportEvent,
      ),
    ).toBe(true);
    expect(publishedEvents).toEqual([
      "first:viewport-changed",
      "second:viewport-changed",
      "second:viewport-changed",
    ]);

    const replacementPromise =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        createReplacementRequest(2),
        { signal: new AbortController().signal },
      );
    expect(
      adapterHarness.renderedGraphTestHarness.publishRenderedGraphEvent(
        viewportEvent,
      ),
    ).toBe(false);
    adapterHarness.renderedGraphTestHarness.completeInitialPaint(2);
    await replacementPromise;

    adapterHarness.renderedGraphRuntime.dispose();
  }

  {
    const adapterHarness = createAdapterHarness();
    await completeRenderedGraphLoad(adapterHarness, 1);

    expect(
      adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
        isPaused: true,
        loadGeneration: 1,
      }),
    ).toEqual({
      isPaused: true,
      layoutStatus: "paused",
      loadGeneration: 1,
    });
    expect(
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot().isPaused,
    ).toBe(true);
    expect(
      adapterHarness.renderedGraphRuntime.setGraphLayoutPaused({
        isPaused: false,
        loadGeneration: 1,
      }),
    ).toEqual({
      isPaused: false,
      layoutStatus: "relaxing",
      loadGeneration: 1,
    });

    adapterHarness.renderedGraphRuntime.dispose();
  }

  // Every renderer-tuning operation, on both implementations. These were the
  // last contract methods this shared suite did not exercise, so a divergence
  // between the two runtimes surfaced only in the browser.
  {
    const adapterHarness = createAdapterHarness();
    await completeRenderedGraphLoad(adapterHarness, 1);
    const { renderedGraphRuntime } = adapterHarness;

    expect(
      renderedGraphRuntime.setVisualizationMode({ nodeScaling: true }),
    ).toEqual({ nodeScaling: true });
    expect(
      renderedGraphRuntime.setForceLayoutDistances({ classDistancePx: 240 }),
    ).toEqual({ classDistancePx: 240 });
    expect(
      renderedGraphRuntime.setContinuousZoom({ zoomDirection: "in" }),
    ).toBe("in");
    expect(
      renderedGraphRuntime.setContinuousZoom({ zoomDirection: "none" }),
    ).toBe("none");
    expect(renderedGraphRuntime.resetVisualization()).toBeUndefined();

    // A request naming nothing is refused at the seam rather than reaching a
    // renderer module.
    expect(() => renderedGraphRuntime.setVisualizationMode({})).toThrow();
    expect(() => renderedGraphRuntime.setForceLayoutDistances({})).toThrow();
    expect(() =>
      renderedGraphRuntime.setContinuousZoom({ zoomDirection: "sideways" }),
    ).toThrow();

    renderedGraphRuntime.dispose();

    // A disposed runtime tunes nothing, on either implementation.
    expect(() =>
      renderedGraphRuntime.setVisualizationMode({ nodeScaling: true }),
    ).toThrow("disposed");
    expect(() =>
      renderedGraphRuntime.setForceLayoutDistances({ classDistancePx: 240 }),
    ).toThrow("disposed");
    expect(() =>
      renderedGraphRuntime.setContinuousZoom({ zoomDirection: "in" }),
    ).toThrow("disposed");
    expect(() => renderedGraphRuntime.resetVisualization()).toThrow("disposed");
  }

  {
    const adapterHarness = createAdapterHarness();
    const pendingReplacement =
      adapterHarness.renderedGraphRuntime.replaceVowlModel(
        createReplacementRequest(1),
        { signal: new AbortController().signal },
      );

    adapterHarness.renderedGraphRuntime.dispose();
    adapterHarness.renderedGraphRuntime.dispose();

    await expect(pendingReplacement).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(() =>
      adapterHarness.renderedGraphRuntime.readGraphLayoutSnapshot(),
    ).toThrow("disposed");
    expect(() =>
      adapterHarness.renderedGraphRuntime.subscribeToRenderedGraphEvents(
        () => undefined,
      ),
    ).toThrow("disposed");
  }
}
