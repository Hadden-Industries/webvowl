import { canonicalize, decode, encode, profiles } from "vowl";
import { createCanonicalVowlWorkerClient } from "../../../../src/app/js/controller/canonicalVowlWorkerClient.js";
import { createCanonicalVowlDocumentSession } from "../../../../src/app/js/controller/canonicalVowlDocumentSession.js";
import { createCanonicalVowlRenderProjection } from "../../../../src/app/js/controller/canonicalVowlRenderProjection.js";
import { createRenderedGraphInternals } from "../../../../src/webvowl/js/runtime/renderedGraphInternals.js";
import { ResourceBudget } from "../../src/resourceBudget.js";
import { snapshotBytes } from "../../src/snapshot.js";
import { documentContext } from "../../src/owl/loading.js";
import { prepareCompatibleView } from "../../src/owl/compatibleLoading.js";

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
      try {
        graph.load(1, { canonicalDrawing: drawing });
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
        const state = graph.readCanonicalDrawingState();
        owlSession.synchronizeDrawing({
          loadGeneration: accepted.loadGeneration,
          documentRevision: accepted.documentRevision,
          ...state,
        });
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
      } finally {
        graph.dispose();
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
