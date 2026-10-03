import { canonicalize, decode, encode, profiles } from "vowl";
import { createCanonicalVowlWorkerClient } from "../../../../src/app/js/controller/canonicalVowlWorkerClient.js";
import { createCanonicalVowlDocumentSession } from "../../../../src/app/js/controller/canonicalVowlDocumentSession.js";
import {
  applyCanonicalEditorCommand,
  prepareCanonicalDeletion,
} from "../../../../src/app/js/controller/canonicalVowlEditorCommands.js";
import { requestCanonicalDeletionConfirmation } from "../../../../src/app/js/ui/canonicalEditConfirmation.js";
import {
  selectCanonicalLocalSource,
  requestCanonicalRemoteFormat,
} from "../../../../src/app/js/ui/canonicalInputSelection.js";
import { createCanonicalVowlSourceAcquisition } from "../../../../src/app/js/controller/canonicalVowlSourceAcquisition.js";
import { OWLDocumentFormats } from "owlapi/formats";
import { requestCanonicalCreation } from "../../../../src/app/js/ui/canonicalCreationDialog.js";
import { createVisualizationArtifactService } from "../../../../src/app/js/controller/visualizationArtifactService.js";
import { createCanonicalVowlRenderProjection } from "../../../../src/app/js/controller/canonicalVowlRenderProjection.js";
import { createRenderedGraphInternals } from "../../../../src/webvowl/js/runtime/renderedGraphInternals.js";
import { createD3RenderedGraphAdapter } from "../../../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js";
import { createCanonicalWebVowlController } from "../../../../src/app/js/controller/canonicalWebVowlController.js";
import { requestCanonicalSceneReconciliation } from "../../../../src/app/js/ui/canonicalMergePresentation.js";
import { createGraphLayoutSettler } from "../../../../src/app/js/controller/graphLayoutSettler.js";
import { createSvgSerializer } from "../../../../src/app/js/controller/svgSerializer.js";
import { ResourceBudget } from "../../src/resourceBudget.js";
import { snapshotBytes } from "../../src/snapshot.js";
import { documentContext } from "../../src/owl/loading.js";
import { prepareCompatibleView } from "../../src/owl/compatibleLoading.js";
import * as display from "../../../../src/app/js/controller/vowlDisplayProjector.js";

/** Real browser clone/transfer and worker-entry regression, using one existing fixture. */
export async function qualifyLiveRecovery() {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 60000);
  const client = createCanonicalVowlWorkerClient();
  const checks = [];
  const context = { loadGeneration: 1, baseRevision: 0, signal: abort.signal };
  function check(condition, name) {
    if (!condition) {
      throw new Error(name);
    }
    checks.push(name);
  }
  try {
    const displayResponse = await fetch(
      new URL("../../conformance/display-vectors.json", import.meta.url),
      { signal: abort.signal },
    );
    if (!displayResponse.ok) {
      throw new Error("display-fixtures-unavailable");
    }
    const operations = {
      "select-label": display.selectVowlLabel,
      "classify-external": display.isVowlExternal,
      "radius-factor": display.vowlRadiusFactor,
      "membership-factor": ({ targets, memberships }) => {
        const count = display.directMembershipCount(targets, memberships);
        return {
          count,
          factor: display.vowlRadiusFactor({
            generic: false,
            nodeScaling: "direct-membership",
            directDistinctIndividualCount: count,
          }),
        };
      },
      "principal-and-aliases": (input) => {
        const { principal, aliases } = display.selectVowlPrincipal(input);
        return {
          principalIri: principal.iri,
          aliasIris: aliases.map(({ iri }) => iri),
        };
      },
      "cardinality-text": display.cardinalityText,
      "camera-project": display.projectCanvasPoint,
      "camera-center": display.cameraCenter,
      "compact-notation": display.compactVowlNotation,
    };
    const spelling = (value) =>
      JSON.stringify(value, (_, item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(
              Object.keys(item)
                .sort()
                .map((key) => [key, item[key]]),
            )
          : item,
      );
    for (const { id, operation, input, expected } of (
      await displayResponse.json()
    ).vectors) {
      check(
        spelling(operations[operation](input)) === spelling(expected),
        `independent-display:${id}`,
      );
    }
    const response = await fetch(
      new URL(
        "../../conformance/vectors/named-class-artifact/source.json",
        import.meta.url,
      ),
      { signal: abort.signal },
    );
    if (!response.ok) {
      throw new Error("fixture-unavailable");
    }
    const source = await response.json();
    source.visualization.hidden = [source.structural.occurrences[0].id];
    const original = encode(
      await canonicalize(source, {
        profile: profiles.artifact,
        signal: abort.signal,
      }),
    );
    const opened = await client.run(
      { operation: "open-canonical-model", bytes: original },
      context,
    );
    const captured = await client.run(
      {
        operation: "capture-model",
        checkpoint: opened.checkpoint,
        visualization: opened.visualization,
        profile: profiles.artifact,
      },
      context,
    );
    check(
      original.length === captured.bytes.length &&
        original.every((byte, index) => byte === captured.bytes[index]),
      "artifact-and-hidden-scene-roundtrip",
    );
    const role = opened.inspection.records.roles[0];
    const edited = await client.run(
      {
        operation: "edit-model",
        checkpoint: opened.checkpoint,
        changes: [
          { kind: "remove", id: role.id },
          { kind: "remove", id: role.subject },
        ],
        limits: { rdfQuads: 1, rdfDeepIterations: 0 },
      },
      context,
    );
    check(
      edited.inspection.revision === 1 &&
        edited.inspection.occurrences.length === 0,
      "separate-worker-edit-without-rdfc",
    );
    const recovered = await client.run(
      {
        operation: "recover-model",
        checkpoint: edited.checkpoint,
        limits: { rdfQuads: 1, rdfDeepIterations: 0 },
      },
      { ...context, baseRevision: 1 },
    );
    check(
      recovered.inspection.revision === 1,
      "native-checkpoint-clone-and-recovery",
    );
    let stale = false;
    try {
      await client.run(
        { operation: "recover-model", checkpoint: opened.checkpoint },
        { ...context, baseRevision: 1 },
      );
    } catch (error) {
      stale = error.code === "MODEL_REVISION_MISMATCH";
    }
    check(stale, "worker-entry-rejects-stale-revision");
    check(
      opened.checkpoint.revision === 0 &&
        opened.inspection.occurrences.length === 1 &&
        original.byteLength > 0,
      "accepted-state-and-bytes-survive",
    );
    const budget = new ResourceBudget(
      { signal: abort.signal },
      performance.now(),
    );
    try {
      const input = new TextEncoder().encode(
        "Ontology(<urn:root> Import(<urn:other>) Declaration(Class(<urn:C>)))",
      );
      const imported = new TextEncoder().encode(
        "Ontology(Declaration(Class(<urn:D>)))",
      );
      const prepared = await prepareCompatibleView(
        snapshotBytes(input, budget),
        documentContext("urn:source", "text/owl-functional", budget),
        {
          resolveImport: async () => ({
            bytes: imported,
            documentIri: "urn:imported-document",
            mediaType: "text/owl-functional",
          }),
        },
        budget,
      );
      const evidence = structuredClone(prepared.retained.evidence);
      check(
        evidence.documents.length === 2 &&
          evidence.imports[0].targetDocument === "document:1" &&
          evidence.coverage.basis === "unavailable",
        "native-source-evidence-clone",
      );
      const disposable = prepared.retained.readBytes("document:1");
      const transferred = structuredClone(disposable, {
        transfer: [disposable.buffer],
      });
      const surviving = prepared.retained.readBytes("document:1");
      check(
        disposable.byteLength === 0 &&
          transferred.length === imported.length &&
          surviving.length === imported.length &&
          surviving.every((byte, index) => byte === imported[index]),
        "source-byte-transfer-retains-owned-original",
      );
    } finally {
      budget.dispose();
    }
    const session = createCanonicalVowlDocumentSession({
      workerClient: client,
    });
    try {
      const loaded = await session.load(
        { operation: "open-canonical-model", bytes: original },
        { signal: abort.signal },
      );
      const target = session.target(loaded.inspection.records.subjects[0].id);
      const occurrence = session
        .scene()
        .reference(loaded.inspection.occurrences[0].id);
      session
        .scene()
        .arrange([
          { reference: occurrence, position: { x: 47, y: 91 }, pinned: true },
        ]);
      const changed = await session.edit(
        [
          {
            kind: "insert",
            collection: "subjects",
            record: { id: "inserted-subject", iri: "urn:Added" },
          },
          {
            kind: "insert",
            collection: "roles",
            record: {
              id: "inserted-role",
              subject: "inserted-subject",
              kind: "class",
            },
          },
        ],
        { signal: abort.signal, limits: { rdfQuads: 1, rdfDeepIterations: 0 } },
      );
      check(
        changed.documentRevision === 1 &&
          session.resolveTarget(target) ===
            loaded.inspection.records.subjects[0].id &&
          changed.visualization.placements.length === 2,
        "session-worker-edit-preserves-targets-and-complete-scene",
      );
      let failedCapture = false;
      try {
        await session.capture({
          limits: { rdfQuads: 1 },
          signal: abort.signal,
        });
      } catch (error) {
        failedCapture = error.code === "RDF_RESOURCE_LIMIT";
      }
      const saved = await session.capture({ signal: abort.signal });
      const reloaded = await session.load(
        { operation: "open-canonical-model", bytes: saved },
        { signal: abort.signal },
      );
      check(
        failedCapture &&
          reloaded.inspection.records.subjects.some(
            ({ iri }) => iri === "urn:Added",
          ) &&
          reloaded.visualization.hidden.length === 1 &&
          reloaded.visualization.placements.some(
            ({ position, pinned }) =>
              pinned && position.x === 47 && position.y === 91,
          ),
        "session-save-reload-after-failed-capture",
      );
      let expired = false;
      try {
        session.resolveTarget(target);
      } catch (error) {
        expired = error.code === "DOCUMENT_TARGET_EXPIRED";
      }
      check(expired, "session-reload-retires-old-runtime-targets");
    } finally {
      session.dispose();
    }
    const owlClient = createCanonicalVowlWorkerClient();
    const owlSession = createCanonicalVowlDocumentSession({
      workerClient: owlClient,
    });
    try {
      let imports = 0;
      const rootBytes = new TextEncoder().encode(
        "Ontology(<urn:root> Import(<urn:import>) Declaration(Class(<urn:A>)))",
      );
      const loaded = await owlSession.load(
        {
          operation: "open-owl-model",
          bytes: rootBytes,
          documentIri: "urn:root",
          mediaType: "text/owl-functional",
          limits: { rdfDeepIterations: 0 },
        },
        {
          signal: abort.signal,
          resolveImport: async () => {
            imports++;
            return {
              bytes: new TextEncoder().encode(
                "Ontology(<urn:import> Declaration(Class(<urn:B>)))",
              ),
              documentIri: "urn:import",
              mediaType: "text/owl-functional",
            };
          },
        },
      );
      check(
        loaded.inspection.documents.length === 2 &&
          loaded.inspection.imports[0].state === "acquired",
        "owl-session-retains-import-closure",
      );
      await owlSession.edit(
        [
          {
            kind: "insert",
            collection: "subjects",
            record: { id: "owl:new:s", iri: "urn:AddedToOwl" },
          },
          {
            kind: "insert",
            collection: "roles",
            record: { id: "owl:new:r", subject: "owl:new:s", kind: "class" },
          },
        ],
        { signal: abort.signal, limits: { rdfQuads: 1, rdfDeepIterations: 0 } },
      );
      const current = owlSession.snapshot();
      const recovered = await owlClient.run(
        { operation: "recover-model", checkpoint: current.checkpoint },
        { ...context, baseRevision: 1 },
      );
      check(
        imports === 1 &&
          recovered.inspection.records.subjects.some(
            ({ iri }) => iri === "urn:AddedToOwl",
          ) &&
          recovered.checkpoint.source.sources[0].bytes.every(
            (byte, index) => byte === rootBytes[index],
          ),
        "owl-session-edited-checkpoint-recovers-source-bytes",
      );
      let semanticBlob;
      const semanticArtifacts = createVisualizationArtifactService({
        svgSerializer: { serializeRenderedSvgSnapshot() {} },
        webCrypto: crypto,
        BlobConstructor: Blob,
        objectUrlApi: {
          createObjectURL(blob) {
            semanticBlob = blob;
            return URL.createObjectURL(blob);
          },
          revokeObjectURL: (url) => URL.revokeObjectURL(url),
        },
        visualizationArtifactPublicationPort: { publishPageLocalArtifact() {} },
      });
      try {
        const exportedSource = await owlSession.exportOriginalSourceArtifact({
          documentId: current.inspection.documents[0].id,
          artifactService: semanticArtifacts,
          filename: "original.ofn",
          source: { kind: "ontology-text" },
          signal: abort.signal,
        });
        const sourceBytes = new Uint8Array(await semanticBlob.arrayBuffer());
        check(
          exportedSource.scope.kind === "original-input" &&
            sourceBytes.length === rootBytes.length &&
            sourceBytes.every((byte, index) => byte === rootBytes[index]),
          "worker-original-download-preserves-source-after-edit",
        );
        const exportedTurtle = await owlSession.exportTurtleArtifact({
          artifactService: semanticArtifacts,
          filename: "edited",
          source: { kind: "ontology-text" },
          signal: abort.signal,
        });
        const turtle = await semanticBlob.text();
        check(
          exportedTurtle.scope.revision === 1 &&
            exportedTurtle.filename === "edited.ttl" &&
            turtle.includes("<urn:AddedToOwl>") &&
            turtle.includes("<urn:B>"),
          "worker-turtle-download-includes-edited-import-closure",
        );
      } finally {
        semanticArtifacts.dispose();
      }
      const saved = await owlSession.capture({ signal: abort.signal });
      const reloaded = await owlSession.load(
        { operation: "open-canonical-model", bytes: saved },
        { signal: abort.signal },
      );
      check(
        reloaded.inspection.qualifications.length > 0 &&
          reloaded.inspection.documents.every(
            ({ bytesAvailable }) => !bytesAvailable,
          ) &&
          reloaded.inspection.records.subjects.some(
            ({ iri }) => iri === "urn:AddedToOwl",
          ),
        "owl-session-compatible-save-reload-retains-qualifications",
      );
      const again = await owlSession.capture({ signal: abort.signal });
      check(
        again.length === saved.length &&
          again.every((byte, index) => byte === saved[index]),
        "owl-session-compatible-artifact-byte-roundtrip",
      );
      const inverse = await owlSession.load(
        {
          operation: "open-owl-model",
          bytes: new TextEncoder().encode(
            "Ontology(<urn:inverse> Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) Declaration(ObjectProperty(<urn:p>)) Declaration(ObjectProperty(<urn:q>)) ObjectPropertyDomain(<urn:p> <urn:A>) ObjectPropertyRange(<urn:p> <urn:B>) ObjectPropertyDomain(<urn:q> <urn:B>) ObjectPropertyRange(<urn:q> <urn:A>) InverseObjectProperties(<urn:p> <urn:q>))",
          ),
          documentIri: "urn:inverse",
          mediaType: "text/owl-functional",
        },
        { signal: abort.signal },
      );
      const inverseLabels = inverse.inspection.occurrences.filter(
        ({ kind }) => kind === "label",
      );
      check(
        inverseLabels.length === 2,
        "native-drawing-has-two-inverse-labels",
      );
      owlSession.scene().arrange(
        inverseLabels.map(({ id }, index) => ({
          reference: owlSession.scene().reference(id),
          position: { x: index * 30, y: index ? 70 : -30 },
          pinned: true,
        })),
      );
      const accepted = owlSession.snapshot();
      const drawing = createCanonicalVowlRenderProjection(
        accepted.inspection,
        accepted.visualization,
      );
      const container = document.createElement("div");
      container.style.width = "800px";
      container.style.height = "600px";
      document.body.append(container);
      const graph = createRenderedGraphInternals(container, {
        widthPx: 800,
        heightPx: 600,
      });
      const { renderedGraphRuntime: runtime } = createD3RenderedGraphAdapter({
        graphContainerElement: container,
        renderedGraphConfiguration: undefined,
        createRenderer: () => graph,
        observeNextPaint: () =>
          new Promise((resolve) => requestAnimationFrame(resolve)),
      });
      try {
        await runtime.replaceCanonicalDrawing(
          {
            loadGeneration: accepted.loadGeneration,
            documentRevision: accepted.documentRevision,
            drawing,
            layout: "pause",
          },
          { signal: abort.signal },
        );
        const rendered = graph.getUnfilteredData();
        check(
          graph.paused() &&
            container.querySelector("svg") &&
            rendered.nodes.length === 2 &&
            rendered.properties.length === 2,
          "native-canonical-svg-restores-paused",
        );
        check(
          rendered.properties.every((property) => {
            const placement = accepted.visualization.placements.find(
              ({ occurrence }) => occurrence === property.id(),
            );
            return (
              placement &&
              property.x === placement.position.x &&
              property.y === placement.position.y
            );
          }),
          "native-canonical-svg-preserves-inverse-placements",
        );
        graph.setViewportTransform(0.75, [90, -30]);
        const state = runtime.readCanonicalDrawingState();
        owlSession.synchronizeDrawing(state);
        const capturedDrawing = await decode(await owlSession.capture());
        check(
          JSON.stringify(capturedDrawing.visualization.camera) ===
            JSON.stringify(state.camera) &&
            state.placements.every(({ position, pinned }) =>
              capturedDrawing.visualization.placements.some(
                (saved) =>
                  saved.position.x === position.x &&
                  saved.position.y === position.y &&
                  saved.pinned === pinned,
              ),
            ),
          "native-drawing-state-survives-session-capture",
        );
        const mountedSvg = container.querySelector("svg");
        const subject = owlSession
          .snapshot()
          .inspection.records.subjects.find(({ iri }) => iri === "urn:p");
        const changes = [
          {
            kind: "replace",
            id: subject.id,
            record: { id: subject.id, iri: "urn:renamedProperty" },
          },
        ];
        const priorDocument = owlSession.snapshot();
        const priorDrawing = runtime.readCanonicalDrawingState();
        const setViewportTransform = graph.setViewportTransform;
        let failOnce = true;
        graph.setViewportTransform = (...args) => {
          if (failOnce) {
            failOnce = false;
            throw new Error("qualification drawing failure");
          }
          return setViewportTransform(...args);
        };
        let rejectedDrawing = false;
        try {
          await owlSession.edit(changes, { renderedGraphRuntime: runtime });
        } catch (error) {
          rejectedDrawing = error.message === "qualification drawing failure";
        } finally {
          graph.setViewportTransform = setViewportTransform;
        }
        check(
          rejectedDrawing &&
            JSON.stringify(owlSession.snapshot()) ===
              JSON.stringify(priorDocument) &&
            JSON.stringify(runtime.readCanonicalDrawingState()) ===
              JSON.stringify(priorDrawing),
          "native-revision-failure-restores-document-and-drawing",
        );
        const selectedProperty = owlSession
          .snapshot()
          .inspection.records.roles.find(
            (record) => record.subject === subject.id,
          );
        const editedDrawing = await applyCanonicalEditorCommand(
          owlSession,
          {
            kind: "iri",
            documentRevision: priorDocument.documentRevision,
            target: owlSession.target(selectedProperty.id),
            iri: "urn:renamedProperty",
          },
          { renderedGraphRuntime: runtime, signal: abort.signal },
        );
        check(
          container.querySelector("svg") === mountedSvg &&
            graph.paused() &&
            graph
              .getUnfilteredData()
              .properties.some(
                (property) => property.iri() === "urn:renamedProperty",
              ),
          "native-canonical-revision-keeps-mounted-svg",
        );
        const revisedState = graph.readCanonicalDrawingState();
        check(
          revisedState.placements.every((placement) =>
            editedDrawing.visualization.placements.some(
              (expected) =>
                expected.occurrence === placement.occurrence &&
                expected.position.x === placement.position.x &&
                expected.position.y === placement.position.y &&
                expected.pinned === placement.pinned,
            ),
          ),
          "native-canonical-revision-keeps-reconciled-placements",
        );
        const visible = runtime.readVisibleRenderedGraphSnapshot();
        check(
          visible.visibleRelationshipReferences.some(
            (reference) =>
              reference.iri === "urn:renamedProperty" &&
              reference.roleKind === "object-property",
          ),
          "native-selection-uses-exact-semantic-role",
        );
        const arrangement = runtime.readRenderedArrangement();
        check(
          arrangement.occurrences.every(
            ({ reference, recordTargets }) =>
              typeof owlSession.scene().resolve(reference) === "string" &&
              recordTargets.every(
                (target) =>
                  typeof owlSession.resolveTarget(target) === "string",
              ),
          ),
          "native-arrangement-uses-session-owned-targets",
        );
        owlSession.synchronizeDrawing(runtime.readCanonicalDrawingState());
        const beforeView = owlSession.snapshot();
        const hiddenNode = beforeView.inspection.occurrences.find(
          ({ kind }) => kind === "class-node",
        );
        const hiddenReference = owlSession.scene().reference(hiddenNode.id);
        const hiddenView = owlSession.updateView(
          {
            hidden: [hiddenReference],
            labelSelection: { mode: "iri" },
            display: { compactNotation: true },
          },
          { renderedGraphRuntime: runtime },
        );
        check(
          hiddenView.documentRevision === beforeView.documentRevision &&
            hiddenView.visualization.placements.length ===
              beforeView.visualization.placements.length &&
            !graph
              .getUnfilteredData()
              .nodes.some((node) => node.id() === hiddenNode.id) &&
            graph.paused(),
          "native-view-update-retains-hidden-placements-and-semantic-revision",
        );
        const restoredView = owlSession.updateView(
          { hidden: [] },
          { renderedGraphRuntime: runtime },
        );
        check(
          graph
            .getUnfilteredData()
            .nodes.some((node) => node.id() === hiddenNode.id) &&
            restoredView.visualization.placements.every((placement) => {
              const previous = beforeView.visualization.placements.find(
                (entry) => entry.occurrence === placement.occurrence,
              );
              return (
                previous.position.x === placement.position.x &&
                previous.position.y === placement.position.y
              );
            }),
          "native-view-unhide-restores-complete-retained-arrangement",
        );
        owlSession.setPrefix(
          { name: "qualified", iri: "urn:" },
          { renderedGraphRuntime: runtime },
        );
        const beforePrefixFailure = JSON.stringify(owlSession.snapshot());
        let invalidPrefix = false;
        try {
          owlSession.setPrefix(
            { name: "invalid", iri: "relative/path" },
            { renderedGraphRuntime: runtime },
          );
        } catch {
          invalidPrefix = true;
        }
        check(
          invalidPrefix &&
            JSON.stringify(owlSession.snapshot()) === beforePrefixFailure &&
            owlSession.resolveEditorIri("qualified:renamedProperty") ===
              "urn:renamedProperty",
          "native-prefix-edit-keeps-semantic-identity-and-rejects-invalid-iri",
        );
        let exportedBlob;
        const artifactService = createVisualizationArtifactService({
          svgSerializer: {
            serializeRenderedSvgSnapshot() {
              throw new Error("Canonical save must not serialize SVG.");
            },
          },
          webCrypto: crypto,
          BlobConstructor: Blob,
          objectUrlApi: {
            createObjectURL(blob) {
              exportedBlob = blob;
              return URL.createObjectURL(blob);
            },
            revokeObjectURL: (url) => URL.revokeObjectURL(url),
          },
          visualizationArtifactPublicationPort: {
            publishPageLocalArtifact() {},
          },
        });
        let reloadBytes;
        try {
          const renderedDrawingSnapshot = runtime.createRenderedDrawingSnapshot(
            { loadGeneration: owlSession.snapshot().loadGeneration },
          );
          const latex = await artifactService.createVisualizationArtifact(
            {
              format: "latex",
              filename: "Qualification",
              source: { kind: "ontology-document-iri", identity: "urn:root" },
              renderedDrawingSnapshot,
            },
            { signal: abort.signal },
          );
          check(
            renderedDrawingSnapshot.compactNotation &&
              latex.filename === "Qualification.tex" &&
              (await exportedBlob.text()).includes("\\begin{tikzpicture}"),
            "native-canonical-tikz-export-observes-portable-display-state",
          );
          const metadata = await owlSession.exportCanonicalArtifact({
            artifactService,
            renderedGraphRuntime: runtime,
            filename: "Qualification",
            source: { kind: "ontology-document-iri", identity: "urn:root" },
            signal: abort.signal,
          });
          reloadBytes = new Uint8Array(await exportedBlob.arrayBuffer());
          check(
            metadata.filename === "Qualification.vowl.json" &&
              metadata.mediaType === "application/json" &&
              metadata.byteLength === reloadBytes.length &&
              metadata.sha256Hex.length === 64,
            "native-canonical-save-uses-byte-artifact-service",
          );
        } finally {
          artifactService.dispose();
        }
        const beforeReload = owlSession.snapshot();
        const nativeLoad = graph.load;
        let failLoadOnce = true;
        graph.load = (...args) => {
          nativeLoad(...args);
          if (failLoadOnce) {
            failLoadOnce = false;
            throw new Error("qualification load failure");
          }
        };
        let rejectedLoad = false;
        try {
          await owlSession.load(
            { operation: "open-canonical-model", bytes: reloadBytes },
            { renderedGraphRuntime: runtime },
          );
        } catch (error) {
          rejectedLoad = error.message === "qualification load failure";
        } finally {
          graph.load = nativeLoad;
        }
        check(
          rejectedLoad &&
            JSON.stringify(owlSession.snapshot()) ===
              JSON.stringify(beforeReload) &&
            runtime.readCanonicalDrawingState().loadGeneration ===
              beforeReload.loadGeneration &&
            graph.paused(),
          "native-load-failure-restores-accepted-document",
        );
        const reloadedDrawing = await owlSession.load(
          { operation: "open-canonical-model", bytes: reloadBytes },
          { renderedGraphRuntime: runtime },
        );
        check(
          runtime.readCanonicalDrawingState().loadGeneration ===
            reloadedDrawing.loadGeneration &&
            reloadedDrawing.loadGeneration > beforeReload.loadGeneration &&
            graph
              .getUnfilteredData()
              .properties.some(
                (property) => property.iri() === "urn:renamedProperty",
              ),
          "native-load-accepts-only-after-presentation",
        );
        let controllerBlob;
        const controllerArtifacts = createVisualizationArtifactService({
          svgSerializer: createSvgSerializer({
            XMLSerializerConstructor: XMLSerializer,
            documentObject: document,
            webVowlVersion: "qualification",
          }),
          webCrypto: crypto,
          BlobConstructor: Blob,
          objectUrlApi: {
            createObjectURL(blob) {
              controllerBlob = blob;
              return URL.createObjectURL(blob);
            },
            revokeObjectURL: (url) => URL.revokeObjectURL(url),
          },
          visualizationArtifactPublicationPort: {
            publishPageLocalArtifact() {},
          },
        });
        let selectedImportFetches = 0;
        const controller = createCanonicalWebVowlController({
          reconcileScene: requestCanonicalSceneReconciliation,
          sourceAcquisition: createCanonicalVowlSourceAcquisition({
            requestFormat: requestCanonicalRemoteFormat,
            resolver: {
              getDocumentIRI(importIri) {
                if (importIri !== "urn:chosen-import") {
                  throw new Error("Unexpected fixture import");
                }
                return { value: "https://example.test/chosen.owl" };
              },
              async loadBytes() {
                selectedImportFetches++;
                return {
                  bytes: new TextEncoder().encode(
                    "Ontology(<urn:chosen-import> Declaration(Class(<urn:ChosenImportClass>)))",
                  ),
                  documentIri: "https://example.test/chosen.owl",
                  fileName: "chosen.owl",
                  contentType: "application/octet-stream",
                };
              },
            },
          }),
          requestOntologyCreation: requestCanonicalCreation,
          requestOntologyDeletionConfirmation:
            requestCanonicalDeletionConfirmation,
          renderedGraphRuntime: runtime,
          documentSession: owlSession,
          visualizationArtifactService: controllerArtifacts,
          graphLayoutSettler: createGraphLayoutSettler({
            requestAnimationFrame: (callback) =>
              requestAnimationFrame(callback),
            cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
            nowMs: () => performance.now(),
          }),
          waitForDocumentFonts: () => document.fonts.ready,
          waitForBrowserPaint: () =>
            new Promise((resolve) => requestAnimationFrame(resolve)),
        });
        try {
          await controller.loadOntology(
            {
              source: {
                kind: "vowl-json-text",
                text: new TextDecoder().decode(reloadBytes),
                displayName: "Qualification.vowl.json",
              },
            },
            { signal: abort.signal },
          );
          check(
            controller.getState().status === "ready" &&
              controller.getState().view.language === "IRI-based",
            "candidate-controller-load-reads-accepted-scene-language",
          );
          const beforeControls = owlSession.snapshot();
          await controller.setVisualizationView(
            { filters: { objectProperties: "hide" }, language: "undefined" },
            { signal: abort.signal },
          );
          check(
            owlSession.snapshot().visualization.hidden.length > 0 &&
              controller.getState().view.language === "undefined" &&
              controller.getState().view.filters.objectProperties === "hide",
            "candidate-controller-controls-update-complete-scene",
          );
          await controller.setVisualizationView(
            { filters: { objectProperties: "show" } },
            { signal: abort.signal },
          );
          await controller.setVisualizationModes(
            { compactNotation: false, nodeScaling: true },
            { signal: abort.signal },
          );
          check(
            owlSession.snapshot().documentRevision ===
              beforeControls.documentRevision &&
              owlSession.snapshot().visualization.hidden.length === 0 &&
              controller.getState().view.modes.nodeScaling &&
              !controller.getState().view.modes.compactNotation,
            "candidate-controller-view-controls-preserve-semantic-revision",
          );
          const confirmationAbort = new AbortController();
          const deletionInspection = owlSession.snapshot().inspection;
          const proposal = prepareCanonicalDeletion(deletionInspection, {
            target: deletionInspection.records.roles.find(
              ({ kind }) => kind === "class",
            ).id,
          });
          const confirming = requestCanonicalDeletionConfirmation(
            { ...proposal, inspection: deletionInspection },
            { signal: confirmationAbort.signal },
          );
          const confirmationDialog = document.querySelector("dialog[open]");
          check(
            confirmationDialog !== null &&
              document.activeElement.textContent === "Cancel" &&
              confirmationDialog.querySelectorAll("ol > li").length ===
                proposal.removedRecords.length,
            "canonical-deletion-dialog-lists-exact-losses-and-focuses-cancel",
          );
          confirmationAbort.abort();
          check(
            (await confirming) === false && !confirmationDialog.isConnected,
            "canonical-deletion-dialog-cancels-on-document-retirement",
          );
          const previewConfirmation = document.createElement("button");
          previewConfirmation.textContent =
            "Preview semantic deletion confirmation";
          previewConfirmation.addEventListener("click", async () => {
            const accepted = await requestCanonicalDeletionConfirmation({
              ...proposal,
              inspection: deletionInspection,
            });
            previewConfirmation.dataset.confirmed = String(accepted);
          });
          document.body.append(previewConfirmation);
          for (const format of ["svg", "latex", "turtle", "vowl-json"]) {
            const artifact = await controller.exportVisualization(
              { format, filename: "Controller" },
              { signal: abort.signal },
            );
            check(
              artifact.byteLength > 0 &&
                controllerBlob.size === artifact.byteLength,
              `candidate-controller-${format}-export`,
            );
          }
          const controllerSource =
            "Ontology(<urn:controller> Declaration(Class(<urn:ControllerClass>)))\r\n";
          const selecting = selectCanonicalLocalSource({
            file: new File([controllerSource], "original.ofn"),
            signal: abort.signal,
          });
          const inputDialog = document.querySelector(
            ".canonical-input-dialog[open]",
          );
          const syntax = inputDialog.querySelector("select");
          check(
            document.activeElement === syntax &&
              syntax.querySelectorAll("optgroup option").length ===
                Object.values(OWLDocumentFormats).length,
            "local-input-explicit-format-selector-uses-owner-metadata",
          );
          syntax.value = "owl:functional";
          syntax.dispatchEvent(new Event("change"));
          const base = inputDialog.querySelector("input");
          base.value = "relative.ofn";
          inputDialog.querySelector("form").requestSubmit();
          check(
            inputDialog.open && !base.checkValidity(),
            "local-input-rejects-relative-document-identity",
          );
          base.value = "urn:controller-input";
          base.dispatchEvent(new Event("input"));
          inputDialog.querySelector("form").requestSubmit();
          const localSource = await selecting;
          check(
            !inputDialog.isConnected && localSource.kind === "ontology-bytes",
            "local-input-accepts-explicit-byte-source",
          );
          await controller.loadOntology(
            {
              source: localSource,
            },
            {
              signal: abort.signal,
              initialVisualization: {
                view: {
                  language: "IRI-based",
                  layout: "resume",
                  zoomScale: 2,
                  translation: { xPx: 20, yPx: 30 },
                },
                modes: { compactNotation: true, dynamicLabelWidth: false },
                forceDistances: { classDistancePx: 180 },
              },
            },
          );
          check(
            controller.getState().zoomScale === 2 &&
              controller.getState().translation.xPx === 20 &&
              controller.getState().translation.yPx === 30 &&
              controller.getState().view.language === "IRI-based" &&
              controller.getState().view.modes.compactNotation &&
              !controller.getState().view.modes.dynamicLabelWidth &&
              controller.getState().view.forceDistances.classDistancePx ===
                180 &&
              !graph.paused(),
            "candidate-load-applies-initial-view-before-acceptance",
          );
          controller.setGraphLayoutPaused({ isPaused: true });
          controller.setOntologyEditorOptions({
            isEditorMode: true,
            defaultDatatype: "owl:real",
          });
          graph.createDataTypeProperty(graph.getUnfilteredData().nodes[0]);
          const creationDialog = document.querySelector("dialog[open]");
          check(
            creationDialog?.querySelector("h2").textContent ===
              "Create property",
            "native-creation-requests-semantic-input-before-mutation",
          );
          const fields = creationDialog.querySelectorAll("input");
          fields[0].value = "urn:createdDataProperty";
          fields[1].value = "Created data property";
          creationDialog.querySelector("form").requestSubmit();
          while (
            controller.getState().documentRevision === 0 &&
            !controller.getState().error
          ) {
            abort.signal.throwIfAborted();
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          const afterCreation = owlSession.snapshot();
          if (controller.getState().error) {
            throw new Error(JSON.stringify(controller.getState().error));
          }
          check(
            controller.getState().documentRevision === 1 &&
              afterCreation.inspection.records.subjects.some(
                ({ iri }) => iri === "http://www.w3.org/2002/07/owl#real",
              ) &&
              afterCreation.inspection.records.subjects.some(
                ({ iri }) => iri === "urn:createdDataProperty",
              ),
            "native-datatype-creation-commits-one-revision-with-exact-datatype",
          );
          await controller.exportOriginalSource(
            { documentId: owlSession.snapshot().inspection.documents[0].id },
            { signal: abort.signal },
          );
          check(
            (await controllerBlob.text()) === controllerSource,
            "candidate-controller-original-source-export",
          );
          let selectionFailure;
          const choosingImport = controller
            .loadOntology(
              {
                source: {
                  kind: "ontology-text",
                  format: "functional",
                  documentIri: "urn:selection-root",
                  text: "Ontology(<urn:selection-root> Import(<urn:chosen-import>) Declaration(Class(<urn:SelectionRootClass>)))",
                },
              },
              { signal: abort.signal },
            )
            .catch((error) => {
              selectionFailure = error;
            });
          let syntaxDialog;
          while (!(syntaxDialog = document.querySelector("dialog[open]"))) {
            if (selectionFailure) {
              throw selectionFailure;
            }
            abort.signal.throwIfAborted();
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          const importSyntax = syntaxDialog.querySelector("select");
          importSyntax.value = "owl:functional";
          importSyntax.dispatchEvent(new Event("change"));
          check(
            syntaxDialog.querySelector("input").readOnly &&
              syntaxDialog.querySelector("input").value ===
                "https://example.test/chosen.owl",
            "ambiguous-import-selector-preserves-acquisition-identity",
          );
          syntaxDialog.querySelector("form").requestSubmit();
          await choosingImport;
          if (selectionFailure) {
            throw selectionFailure;
          }
          check(
            selectedImportFetches === 1 &&
              controller.getState().status === "ready" &&
              owlSession
                .snapshot()
                .inspection.records.subjects.some(
                  ({ iri }) => iri === "urn:ChosenImportClass",
                ),
            "ambiguous-import-choice-restarts-admission-without-refetch",
          );
          await controller.loadOntology(
            {
              source: {
                kind: "ontology-text",
                format: "functional",
                documentIri: "urn:merge-root",
                text: "Ontology(<urn:merge-root> Declaration(Class(<urn:MergeLeft>)) Declaration(Class(<urn:MergeRight>)))",
              },
            },
            { signal: abort.signal },
          );
          const mergeBase = owlSession.snapshot();
          const leftSubject = mergeBase.inspection.records.subjects.find(
            ({ iri }) => iri === "urn:MergeLeft",
          );
          const leftRole = mergeBase.inspection.records.roles.find(
            ({ subject }) => subject === leftSubject.id,
          );
          const leftOccurrence = mergeBase.inspection.occurrences.find(
            ({ targets }) => targets?.includes(leftRole.id),
          );
          owlSession.scene().arrange([
            {
              reference: owlSession.scene().reference(leftOccurrence.id),
              position: { x: 750, y: 450 },
              pinned: true,
            },
          ]);
          const retainedMergeBase = owlSession.snapshot();
          for (const accept of [false, true]) {
            let mergeFailure;
            const merging = owlSession
              .edit(
                [
                  {
                    kind: "replace",
                    id: leftSubject.id,
                    record: { ...leftSubject, iri: "urn:MergeRight" },
                  },
                ],
                {
                  signal: abort.signal,
                  reconcile: requestCanonicalSceneReconciliation,
                  renderedGraphRuntime: runtime,
                },
              )
              .catch((error) => {
                mergeFailure = error;
              });
            let mergeDialog;
            while (!(mergeDialog = document.querySelector("dialog[open]"))) {
              if (mergeFailure) {
                throw mergeFailure;
              }
              abort.signal.throwIfAborted();
              await new Promise((resolve) => requestAnimationFrame(resolve));
            }
            check(
              mergeDialog.textContent.includes("urn:MergeLeft") &&
                mergeDialog.textContent.includes("urn:MergeRight"),
              `merge-dialog-describes-predecessors-${accept ? "apply" : "cancel"}`,
            );
            if (accept) {
              const chosen = [...mergeDialog.querySelectorAll("label")].find(
                (label) => label.textContent.includes("urn:MergeLeft"),
              );
              chosen.querySelector("input").click();
              mergeDialog.querySelector("form").requestSubmit();
            } else {
              mergeDialog.querySelector('button[type="button"]').click();
            }
            await merging;
            if (accept) {
              if (mergeFailure) {
                throw mergeFailure;
              }
              const merged = owlSession.snapshot();
              check(
                merged.documentRevision ===
                  retainedMergeBase.documentRevision + 1 &&
                  merged.visualization.placements.length === 1 &&
                  merged.visualization.placements[0].position.x === 750 &&
                  merged.visualization.placements[0].pinned,
                "merge-choice-commits-selected-arrangement-once",
              );
            } else {
              check(
                mergeFailure?.code === "DOCUMENT_EDIT_CANCELLED" &&
                  JSON.stringify(owlSession.snapshot()) ===
                    JSON.stringify(retainedMergeBase),
                "merge-cancel-preserves-document-and-scene",
              );
            }
          }
          const legacyManifest = await (
            await fetch(
              new URL(
                "../../conformance/supplemental/migration/manifest.json",
                import.meta.url,
              ),
              { signal: abort.signal },
            )
          ).json();
          const legacyVector = legacyManifest.vectors.find(
            ({ id }) => id === "named-class-artifact",
          );
          const legacyInput = structuredClone(
            legacyManifest.seeds[legacyVector.input.seed],
          );
          for (const patch of legacyVector.input.patches) {
            // This pinned witness uses only add patches; do not implement a second corpus loader.
            if (patch.op !== "add") {
              throw new Error("Unexpected legacy witness patch");
            }
            const keys = patch.path
              .slice(1)
              .split("/")
              .map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"));
            const parent = keys
              .slice(0, -1)
              .reduce((value, key) => value[key], legacyInput);
            parent[keys.at(-1)] = structuredClone(patch.value);
          }
          function ordered(value) {
            if (Array.isArray(value)) {
              return value.map(ordered);
            }
            return value && typeof value === "object"
              ? Object.fromEntries(
                  Object.keys(value)
                    .sort()
                    .map((key) => [key, ordered(value[key])]),
                )
              : value;
          }
          const legacyBytes = new TextEncoder().encode(
            JSON.stringify(ordered(legacyInput), null, 2),
          );
          const legacyHash = [
            ...new Uint8Array(
              await crypto.subtle.digest("SHA-256", legacyBytes),
            ),
          ]
            .map((value) => value.toString(16).padStart(2, "0"))
            .join("");
          check(
            legacyHash === legacyVector.input.sha256,
            "legacy-browser-witness-matches-independent-pin",
          );
          await controller.loadOntology(
            {
              source: {
                kind: "vowl-json-bytes",
                bytes: legacyBytes,
                dialect: legacyVector.dialect,
                profile: legacyVector.profile,
                resolutions: legacyVector.resolutions,
              },
            },
            { signal: abort.signal },
          );
          const migrated = owlSession.snapshot();
          check(
            migrated.visualization.camera.center.x === 154 &&
              migrated.visualization.camera.center.y === 124 &&
              migrated.visualization.placements[0].pinned &&
              controller.getState().layout.status === "paused",
            "legacy-controller-migration-restores-paused-camera-and-pin",
          );
          await controller.editOntologyRecord(
            {
              loadGeneration: controller.getState().loadGeneration,
              documentRevision: controller.getState().documentRevision,
              recordTarget: owlSession.target(
                migrated.inspection.records.roles[0].id,
              ),
              changes: { iri: "urn:LegacyBrowserEdited" },
            },
            { signal: abort.signal },
          );
          await controller.exportVisualization(
            { format: "vowl-json", filename: "Migrated" },
            { signal: abort.signal },
          );
          const legacyExport = new Uint8Array(
            await controllerBlob.arrayBuffer(),
          );
          const legacyDecoded = await decode(legacyExport);
          check(
            legacyDecoded.structural.subjects.some(
              ({ iri }) => iri === "urn:LegacyBrowserEdited",
            ),
            "legacy-controller-edit-export-decodes-current-semantics",
          );
          await controller.loadOntology(
            { source: { kind: "vowl-json-bytes", bytes: legacyExport } },
            { signal: abort.signal },
          );
          check(
            owlSession
              .snapshot()
              .inspection.records.subjects.some(
                ({ iri }) => iri === "urn:LegacyBrowserEdited",
              ) &&
              owlSession.snapshot().visualization.placements[0].pinned &&
              controller.getState().layout.status === "paused",
            "legacy-controller-canonical-reopen-preserves-edited-model-and-pin",
          );
          await controller.loadOntology(
            {
              source: {
                kind: "ontology-text",
                format: "functional",
                documentIri: "urn:gesture-root",
                text: 'Ontology(<urn:gesture-root> Declaration(Class(<urn:A>)) Declaration(Class(<urn:B>)) Declaration(Class(<urn:C>)) Declaration(ObjectProperty(<urn:p>)) ObjectPropertyDomain(Annotation(<urn:note> "keep endpoint annotation") <urn:p> <urn:A>) ObjectPropertyRange(<urn:p> <urn:B>))',
              },
            },
            { signal: abort.signal },
          );
          controller.setGraphLayoutPaused({ isPaused: true });
          controller.setOntologyEditorOptions({ isEditorMode: true });
          const endpointProperty = graph
            .getUnfilteredData()
            .properties.find((property) => property.iri() === "urn:p");
          const endpointNode = graph
            .getUnfilteredData()
            .nodes.find((node) => node.iri() === "urn:C");
          graph.requestPropertyEndpointEdit(
            endpointProperty,
            "domain",
            endpointNode,
            { xPx: 250, yPx: 150 },
          );
          while (
            controller.getState().documentRevision === 0 &&
            !controller.getState().error
          ) {
            abort.signal.throwIfAborted();
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          if (controller.getState().error) {
            throw new Error(JSON.stringify(controller.getState().error));
          }
          const endpointEdited = owlSession.snapshot();
          const endpointSubject =
            endpointEdited.inspection.records.subjects.find(
              ({ iri }) => iri === "urn:C",
            );
          const endpointRole = endpointEdited.inspection.records.roles.find(
            ({ subject }) => subject === endpointSubject.id,
          );
          const domainFact = endpointEdited.inspection.records.constructs.find(
            ({ kind }) => kind === "object-domain",
          );
          check(
            domainFact?.target === endpointRole.id &&
              endpointEdited.inspection.records.constructs.some((record) =>
                JSON.stringify(record).includes("keep endpoint annotation"),
              ),
            "native-annotated-endpoint-edit-preserves-retained-annotation",
          );
          graph.removePropertyViaEditor(
            graph
              .getUnfilteredData()
              .properties.find((property) => property.iri() === "urn:p"),
          );
          let deletionDialog;
          while (!(deletionDialog = document.querySelector("dialog[open]"))) {
            if (controller.getState().error) {
              throw new Error(JSON.stringify(controller.getState().error));
            }
            abort.signal.throwIfAborted();
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          check(
            deletionDialog.textContent.includes("keep endpoint annotation") &&
              owlSession.snapshot().documentRevision ===
                endpointEdited.documentRevision,
            "native-deletion-previews-exact-annotation-loss-before-mutation",
          );
          [...deletionDialog.querySelectorAll("button")]
            .find((button) => button.textContent !== "Cancel")
            .click();
          while (
            controller.getState().documentRevision ===
              endpointEdited.documentRevision &&
            !controller.getState().error
          ) {
            abort.signal.throwIfAborted();
            await new Promise((resolve) => requestAnimationFrame(resolve));
          }
          if (controller.getState().error) {
            throw new Error(JSON.stringify(controller.getState().error));
          }
          check(
            !graph
              .getUnfilteredData()
              .properties.some((property) => property.iri() === "urn:p") &&
              controller.getState().documentRevision ===
                endpointEdited.documentRevision + 1,
            "native-confirmed-deletion-commits-once",
          );
        } finally {
          controller.dispose();
        }
      } finally {
        runtime.dispose();
        container.remove();
      }
    } finally {
      owlSession.dispose();
    }
    return { status: "passed", checks, userAgent: navigator.userAgent };
  } catch (error) {
    return { status: "failed", checks, code: error.code ?? error.message };
  } finally {
    clearTimeout(timer);
    client.dispose();
  }
}

const result = await qualifyLiveRecovery();
document.getElementById("result").textContent = JSON.stringify(result);
