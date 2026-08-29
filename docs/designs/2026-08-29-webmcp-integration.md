# WebMCP Integration Design

- **Date:** 2026-08-29
- **Status:** Proposed for implementation planning
- **Branch:** `feature/webmcp-integration`
- **Scope:** Agent-assisted ontology exploration, visualization, diagnostics, and SVG export in the live WebVOWL page

## Decision summary

WebVOWL will expose a small set of WebMCP tools as an optional browser capability. The tools will delegate to a promise-based automation module that owns loading, inspection, view changes, layout settlement, and export. The normal WebVOWL interface will remain complete and usable when WebMCP is absent.

The first release will optimize for interactive, human-visible work in an open WebVOWL page. It will not add ontology editing, a reasoning engine, unattended batch rendering, a remote MCP server, or a server-side artifact store. Those are separate product decisions that can build on the automation module later.

## Context

WebVOWL already lets users load ontologies, explore a force-directed graph, change presentation options, and export SVG. These capabilities are currently driven mainly by UI callbacks and click handlers. A browser agent can attempt to operate those controls through the DOM, but doing so is brittle: the graph is visually dense, application state is not fully represented by control text, and a successful click does not prove that parsing, imports, rendering, or force relaxation have finished.

WebMCP lets the live page advertise structured tools with JSON-schema inputs and structured results. It is therefore a good fit for work where the user and agent should share the same visible ontology graph. WebMCP is not a replacement for a backend or remote MCP server: its tools are page-scoped, require a supporting browser agent, and do not standardize transferring a generated file into a chat attachment.

## Goals

1. Let a browser agent reliably load an ontology from an explicitly supplied source.
2. Let the agent summarize and search the loaded ontology without scraping the rendered SVG.
3. Let the agent create a task-specific view using the same behavior available to human users.
4. Let the agent wait for a genuinely stable layout and produce a valid SVG artifact.
5. Keep every agent-driven state change visible and inspectable in the ordinary WebVOWL interface.
6. Keep ontology content in the browser unless the user explicitly chooses a future server-backed workflow.
7. Give the existing UI, tests, and WebMCP adapter one small, durable interface over asynchronous application behavior.
8. Preserve current behavior in browsers and embeddings that do not support WebMCP.

## Non-goals

- Replacing the WebVOWL interface with a chat interface.
- Exposing every UI control as an individual tool.
- Adding OWL reasoning, SPARQL execution, ontology quality rules, or ontology comparison as part of the first release.
- Allowing an agent to edit or save an ontology.
- Providing unattended rendering while no WebVOWL page is open.
- Guaranteeing that every WebMCP client can attach the generated SVG to its conversation.
- Sending full ontology documents, graph models, or SVG source through tool results.
- Refactoring unrelated graph, parser, or menu behavior.
- Requiring a new server, dependency, build system, or deployment mode.

## Design principles

### Progressive enhancement

WebMCP registration will be feature-detected. If the browser does not expose `document.modelContext`, WebVOWL will behave as it does today. WebMCP-specific code must not be imported into the ontology parser or graph implementation.

### One deep automation module

The automation module will hide asynchronous sequencing, application state, cancellation, layout settlement, export preparation, and normalized errors behind a small interface. Callers should not need to understand loading callbacks, D3 force lifecycle details, menu state, or SVG serialization internals.

The normal UI and the WebMCP adapter will cross the same seam. Tests will exercise the same interface rather than reaching through it to private implementation details.

### Visible, reversible collaboration

Agent operations will update the live page. View changes must use existing WebVOWL options and graph behavior so the user can inspect, refine, or undo them with the normal interface. The first release will restrict state changes to loading and reversible presentation changes.

### Bounded structured exchange

Tool inputs will be narrow and validated at runtime. Tool results will contain identifiers, counts, normalized state, warnings, and artifact metadata rather than unbounded ontology text or serialized SVG.

The initial shared limits are a 2,048-character URL, 1 MiB of inline ontology text, 25 search matches, 10 warnings, and 256 characters for each ontology-derived display string. Tool results will target at most 1,500 serialized characters and will set `truncated: true` when bounded collections or strings are omitted. Browser evaluation may lower these limits, but raising them requires review of responsiveness and agent-context impact.

## Alternatives considered

### Register tools directly over existing callbacks

This is the smallest initial patch, but it would expose callback timing, menu state, and private export behavior to every tool. The same orchestration would then be duplicated in tests and future callers. This approach is rejected because it creates a shallow adapter and makes WebMCP-specific behavior responsible for application correctness.

### Introduce the automation module, then add a thin WebMCP adapter

This is the selected approach. It creates one deep module whose interface is shared by the normal UI, WebMCP, and tests. It requires more deliberate work around existing callbacks, but concentrates cancellation, state, diagnostics, and settlement behavior in one place.

### Build a remote MCP server or headless renderer first

This would better support batch jobs and guaranteed downloadable resources, but it would add infrastructure, duplicate browser behavior, and lose the defining benefit of a user and agent collaborating on the same visible graph. It remains a possible later module once interactive demand and artifact-delivery requirements are measured.

## Architecture

```text
Human user ───────────────────────────────┐
                                         │ sees and controls
Browser agent                            ▼
    │ structured tool calls      Existing WebVOWL interface
    ▼                                    │
WebMCP adapter ──────────────────────────┤
    │ delegates                         │
    ▼                                    ▼
WebVOWL automation module ───────► loader / parser / graph / exporter
    │
    └── structured state, results, diagnostics, and artifact handles
```

### WebVOWL automation module

The module will provide the following conceptual interface. Exact JavaScript types and file placement will be fixed in the implementation plan after repository-level test and module conventions are mapped.

```js
loadOntology(request, { signal }) -> Promise<LoadResult>
getOntologySummary(request?) -> OntologySummary
findOntologyElements(request) -> ElementSearchResult
setVisualizationView(request) -> Promise<ViewResult>
exportVisualization(request, { signal }) -> Promise<ExportResult>
getState() -> AutomationState
```

The interface includes all caller-visible invariants and error modes:

- `loadOntology` resolves only for the active load generation after parsing and initial graph rendering are complete.
- Starting a new load supersedes the previous generation. Late callbacks from an older generation cannot change state or resolve as the current result.
- Operations that can wait or perform network work accept an `AbortSignal`.
- Summary and search read the canonical loaded graph data rather than scraping labels from SVG elements.
- `setVisualizationView` resolves after the requested view has been normalized, applied, and reflected by the graph.
- `exportVisualization` owns layout settlement; callers do not poll a separate waiting tool.
- Every result reports what actually happened, including bounded warnings and normalized settings.

The module will use explicit states:

```text
idle → loading → parsing → rendering → relaxing → ready
          │          │          │           │
          └──────────┴──────────┴───────────┴──► error
```

Cancellation returns the module to the most recent valid state. It is not reported as an unexpected application failure.

### WebMCP adapter

The WebMCP adapter will be deliberately thin. It will:

1. Feature-detect the imperative WebMCP interface.
2. Register the supported tools from the top-level document.
3. Validate and normalize each request before calling the automation module.
4. Map structured module errors to concise tool results.
5. Register and unregister tools through one lifecycle-owned `AbortController`.
6. Avoid capturing stale graph or options instances during application reloads.

The first release will not use the declarative WebMCP form interface because the application behavior is asynchronous and stateful, and current ChatGPT Site tools support imperative, top-level registration rather than iframe-discovered declarative tools.

Embedded WebVOWL instances remain usable through their normal interface. A host that wants WebMCP support for an embedded instance must register top-level proxy tools and delegate to that instance's automation module; iframe discovery will not be assumed.

## Initial tool interface

The tool set will begin with five non-overlapping tools.

| Tool | Classification | Responsibility | Bounded result |
|---|---|---|---|
| `load_ontology` | Stateful | Load an ontology from an HTTP(S) IRI, a VOWL JSON URL, or explicitly supplied text | Generation, source, status, counts, import summary, warnings |
| `get_ontology_summary` | Read-only | Describe the current ontology and active view | Counts, namespaces, imports, languages, selected settings, warnings |
| `find_ontology_elements` | Read-only | Search canonical element labels and IRIs with type and result limits | Stable element references, labels, IRIs, kinds, bounded neighborhood facts |
| `set_visualization_view` | Stateful and reversible | Apply supported language, filter, focus, layout, and viewport options | Normalized applied view and affected-element counts |
| `export_visualization` | Stateful artifact creation | Settle the current graph and produce an SVG download | Artifact identifier, filename, MIME type, byte length, source provenance, warnings |

The tool descriptions and parameter descriptions will remain concise. A generic command tool and one-tool-per-button design are explicitly rejected because they would make tool selection ambiguous and expose internal UI structure as a public interface.

### Source handling

`load_ontology` will use a discriminated source value rather than ambiguous combinations of URL and text fields:

```js
{ kind: "ontology-iri", value: "https://example.org/model.owl" }
{ kind: "vowl-json-url", value: "https://example.org/model.json" }
{ kind: "ontology-text", value: "...", format: "turtle" }
```

Local filesystem paths will not be accepted. A file the user loaded through the existing file picker can still be summarized, searched, restyled, and exported after it becomes the active ontology.

## Layout settlement and SVG export

The existing “finished loading sequence” is a UI progress milestone, not a sufficient export contract. Export requires a separate definition of stability.

`exportVisualization` will:

1. Reject the request if no ontology is ready.
2. Wait for the active generation to finish rendering.
3. Observe the force simulation until its native end event or an agreed energy/displacement threshold remains satisfied for consecutive frames.
4. Stop waiting at a configured maximum duration.
5. On timeout, return a structured `LAYOUT_TIMEOUT` error unless the request explicitly permits exporting the best current state.
6. Freeze the graph and wait for fonts plus the final required paint frames.
7. Serialize a clone of the SVG with the required styles, namespaces, dimensions, and view box.
8. Create an SVG `Blob`, an object URL, and a visible download entry in the page.
9. Return compact artifact metadata.
10. Restore the previous force pause state when restoration is safe.

“Visually settled” and “byte-for-byte reproducible” are different guarantees. The first release guarantees visually settled output. Exact reproducibility requires fixed initial coordinates or a layout seed, fixed viewport dimensions, fixed force settings, and a stable iteration policy. Those options will be introduced only if evaluation demonstrates a user requirement for identical rerenders.

The generated artifact will include or be accompanied by compact provenance: source identity, source hash when available, import status, view settings, WebVOWL version, dimensions, and layout outcome. Tool output will contain metadata and an artifact handle, not the SVG document itself.

## Artifact delivery

The portable completion condition is that WebVOWL displays a valid downloadable SVG and returns matching metadata. Whether an agent can download that artifact and attach it to a conversation is a client capability outside the WebMCP contract.

The first release therefore uses a privacy-first browser artifact:

- SVG remains local to the page as a `Blob`.
- A visible download action remains available to the user.
- The tool result identifies and verifies the artifact.
- No ontology or SVG is uploaded automatically.

A stable server URL or remote MCP resource is a future, separately approved design if guaranteed cross-client attachment or unattended rendering becomes necessary.

## Trust and security

Ontology documents are untrusted input. Labels, comments, annotations, IRIs, imports, and parser diagnostics may contain text that resembles agent instructions.

The implementation will enforce the following requirements:

- Mark results derived from ontology content as untrusted content where the client supports that annotation.
- Keep descriptions and results bounded by explicit string-length, item-count, and byte limits.
- Validate tool inputs again at execution time rather than relying only on advertised JSON schemas.
- Allow only explicitly supported source schemes and reject local paths, script URLs, and unsupported URL forms.
- Reuse the existing import resolver's omitted credentials, redirect handling, remote byte limits, timeouts, and cancellation behavior.
- Add an import count or depth budget if the canonical load path does not already enforce one.
- Prevent stale load generations from updating the current graph.
- Avoid placing credentials, tokens, or private configuration in tool definitions or results.
- Treat a future server-side renderer as a new threat model requiring private-network and SSRF controls.

Summary and search tools will be annotated read-only. Loading, view changes, and export will report their state effects accurately. WebMCP does not replace the application's existing authorization or user-consent rules.

## Errors and diagnostics

The automation module will normalize expected failures into stable codes with a human-readable message and bounded details. Initial codes are:

- `NO_ONTOLOGY`
- `SOURCE_REJECTED`
- `LOAD_ABORTED`
- `FETCH_FAILED`
- `PARSE_FAILED`
- `IMPORT_FAILED`
- `VIEW_REJECTED`
- `ELEMENT_NOT_FOUND`
- `LAYOUT_TIMEOUT`
- `EXPORT_FAILED`

Import failures that do not invalidate the root ontology remain warnings. Tool results will distinguish a completed request with warnings from a failed request. Raw parser documents, stack traces, and response bodies will not be returned to the agent.

## Testing and evaluation

Implementation will follow test-driven development across four layers:

1. **Automation module tests:** state transitions, generation supersession, cancellation, normalization, bounded results, layout timeout, pause restoration, and export metadata.
2. **Adapter contract tests:** exact tool registration, schemas, annotations, request validation, error mapping, and cleanup using a fake `document.modelContext`.
3. **Application integration tests:** representative ontology text and URLs through parser, graph loading, view changes, and SVG generation.
4. **Browser evaluation:** supported Chromium/WebMCP environments, the normal no-WebMCP path, top-level registration, visible state changes, downloads, console errors, and client-specific attachment behavior.

The evaluation corpus will include small and large ontologies, imports, malformed input, unsupported sources, CORS and network failures, superseded loads, missing labels, large search result sets, layout timeout, and repeated exports.

Release acceptance requires:

- Existing non-WebMCP behavior remains functional.
- Each registered tool completes representative user jobs without DOM guessing.
- Cancellation and superseded loads cannot corrupt the active graph.
- No tool emits unbounded ontology or SVG content.
- Exported SVG opens independently and matches the visible view.
- Users retain a visible manual download even when the agent cannot attach the file.
- Unsupported browsers receive no WebMCP errors or degraded controls.

## Delivery sequence

1. Establish the automation module and state model around existing loading behavior.
2. Route summary and bounded search through canonical graph data.
3. Move view application behind the automation interface while preserving existing controls.
4. Extract SVG serialization from the menu click handler and add a testable settlement contract.
5. Add the thin imperative WebMCP adapter and its contract tests.
6. Run browser evaluations and refine schemas, descriptions, limits, and diagnostics.
7. Document availability, privacy, embedding constraints, and the client-specific artifact handoff.

Each step must leave the ordinary application working. Any required build, package, lockfile, test-runner, CI, deployment, or other configuration change requires separate explicit approval before it is made.

## Deferred extensions

The following extensions are intentionally outside the first implementation plan and require their own design decisions:

- ontology quality and linting tools;
- comparison of ontology versions;
- saved deterministic layout recipes;
- ontology editing and write-back;
- server-backed artifact persistence;
- remote MCP or headless batch rendering;
- exposing WebMCP from an embedding host application.

## References

- [WebMCP Draft Community Group Report](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome imperative WebMCP interface](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Chrome WebMCP security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [OpenAI Site tools](https://learn.chatgpt.com/docs/webmcp)
- [Visualizing ontologies with VOWL](https://journals.sagepub.com/doi/10.3233/SW-150200)
