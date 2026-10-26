import { createCanonicalWebVowlController } from "../js/controller/canonicalWebVowlController.js";
import { createCanonicalVowlDocumentSession } from "../js/controller/canonicalVowlDocumentSession.js";
import { runCanonicalVowlOperation } from "../js/controller/canonicalVowlWorkerOperations.js";
import { createCanonicalVowlSourceAcquisition } from "../js/controller/canonicalVowlSourceAcquisition.js";
import {
  createCanonicalRenderedGraphRuntimeDouble,
  deferred,
} from "./canonicalRenderedGraphRuntimeDouble.js";

export async function canonicalControllerHarness({
  resolver,
  nodeCountAdjustmentClock,
  requestOntologyCreation,
  wrapRuntime = (runtime) => runtime,
} = {}) {
  const double = createCanonicalRenderedGraphRuntimeDouble({
    svgSnapshot: {
      svgText: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      widthPx: 800,
      heightPx: 600,
    },
  });
  const gates = new Map();
  const session = createCanonicalVowlDocumentSession({
    workerClient: {
      async run(request, context) {
        const gate = gates.get(request.operation);
        if (gate) {
          gates.delete(request.operation);
          gate.started.resolve();
          await gate.promise;
        }
        // Exercise the actual package operation with the same plain DTO boundary
        // as the existing in-process worker tests, without claiming scheduling proof.
        const received = JSON.parse(
          JSON.stringify({ ...request, bytes: undefined }),
        );
        if (request.bytes) {
          received.bytes = new Uint8Array(request.bytes);
        }
        if (request.checkpoint?.source) {
          received.checkpoint.source.sources =
            request.checkpoint.source.sources.map(({ document, bytes }) => ({
              document,
              bytes: new Uint8Array(bytes),
            }));
        }
        const result = await runCanonicalVowlOperation(
          received,
          undefined,
          context,
        );
        return {
          ...result,
          loadGeneration: context.loadGeneration,
          baseRevision: context.baseRevision,
        };
      },
      dispose() {},
    },
  });
  const artifacts = [];
  let fontGate;
  const controller = createCanonicalWebVowlController({
    nodeCountAdjustmentClock,
    requestOntologyCreation,
    renderedGraphRuntime: wrapRuntime(double.runtime),
    documentSession: session,
    sourceAcquisition: createCanonicalVowlSourceAcquisition({ resolver }),
    applicationUrl: "https://example.test/webvowl/",
    visualizationArtifactService: {
      async createVisualizationArtifact(value, { signal } = {}) {
        signal?.throwIfAborted();
        artifacts.push(value);
        return value;
      },
      async createCanonicalVowlArtifact(value, { signal } = {}) {
        signal?.throwIfAborted();
        artifacts.push(value);
        return value;
      },
      dispose() {},
    },
    graphLayoutSettler: {
      async waitForSettledGraphLayout() {
        return { status: "settled", reason: "test-fixture" };
      },
    },
    waitForDocumentFonts: () => fontGate?.promise ?? Promise.resolve(),
    waitForBrowserPaint: async () => {},
  });
  const load = (iri = "urn:lifecycle") =>
    controller.loadOntology({
      source: {
        kind: "ontology-text",
        documentIri: iri,
        format: "functional",
        text: `Ontology(<${iri}> Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) SubClassOf(<urn:A> <urn:B>))`,
      },
    });
  await load();
  return {
    controller,
    session,
    double,
    artifacts,
    load,
    deferFonts() {
      fontGate = deferred();
      return fontGate;
    },
    deferWorker(operation) {
      const gate = { ...deferred(), started: deferred() };
      gates.set(operation, gate);
      return gate;
    },
    reference: () =>
      session
        .inspectOntology()
        .classRecords.find(
          ({ ontologyElementReference }) =>
            ontologyElementReference.iri === "urn:A",
        ).ontologyElementReference,
    edit(options) {
      const record = session
        .snapshot()
        .inspection.records.roles.find(({ kind }) => kind === "class");
      return controller.editOntologyRecord(
        {
          ...session.identity(),
          recordTarget: session.target(record.id),
          changes: { iri: "urn:Renamed" },
        },
        options,
      );
    },
  };
}
