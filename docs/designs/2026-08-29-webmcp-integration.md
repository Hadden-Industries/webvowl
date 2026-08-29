# WebMCP Integration Design

- **Date:** 2026-08-29
- **Status:** Proposed for implementation planning
- **Branch:** `feature/webmcp-integration`
- **Scope:** Agent-assisted ontology exploration, visualization, diagnostics, and SVG export in the live WebVOWL page

## Decision summary

WebVOWL will expose a small set of WebMCP tools as an optional browser capability. The tools will delegate to an agent-neutral, promise-based `WebVowlController` module that owns loading, inspection, view changes, layout settlement, and export. The normal WebVOWL interface will use the same controller and will remain complete and usable when WebMCP is absent.

Application operations will depend on one `RenderedGraphRuntime` interface rather than the concrete graph object, D3 selections, force nodes, or menu-aware graph options. `D3RenderedGraphAdapter` will be the sole production adapter at that seam, and a deterministic in-memory adapter will exercise the same interface in controller tests. D3 force, selection, transition, zoom, drag, and rendering behavior will remain inside the production adapter; UI modules, controller modules, WebMCP modules, ontology inspection, and SVG serialization will not depend on D3.

`WebVowlController` is an ownership cutover, not a compatibility shim over the current callbacks, menu handlers, or remote-loading functions. When a capability moves behind the controller, every production caller moves with it and the replaced orchestration is deleted in the same change. The design permits a thin WebMCP protocol adapter and ordinary dependency injection; it does not permit forwarding aliases, old/new runtime switching, duplicate loading or export paths, or legacy transport fallbacks.

Every new module, interface, adapter, operation, request, result, field, event, error, and identifier will use one semantically correct and precise domain name. The implementation will distinguish ontology documents, parsed VOWL models, rendered graphs, visualization views, and SVG artifacts rather than hiding those differences behind generic or legacy vocabulary.

The first release will optimize for interactive, human-visible work in an open WebVOWL page. It will not add ontology editing, a reasoning engine, unattended batch rendering, a remote MCP server, or a server-side artifact store. Those are separate product decisions that can build on `WebVowlController` later.

## Context

WebVOWL already lets users load ontologies, explore a force-directed graph, change presentation options, and export SVG. These capabilities are currently driven mainly by UI callbacks and click handlers. A browser agent can attempt to operate those controls through the DOM, but doing so is brittle: the graph is visually dense, application state is not fully represented by control text, and a successful click does not prove that parsing, imports, rendering, or force relaxation have finished.

WebMCP lets the live page advertise structured tools with JSON-schema inputs and structured results. It is therefore a good fit for work where the user and agent should share the same visible ontology graph. WebMCP is not a replacement for a backend or remote MCP server: its tools are page-scoped, require a supporting browser agent, and do not standardize transferring a generated file into a chat attachment.

The architectural pattern also has a direct client-side precedent: OpenAI's Runme case study exposes an existing browser application's capabilities through WebMCP without first adding an application server. WebVOWL can obtain the same leverage while keeping its ontology-specific behavior in an agent-neutral controller.

## Platform snapshot and runtime assumptions

This design records the platform state as of 2026-08-29 so that temporary ecosystem constraints are not mistaken for permanent WebVOWL architecture:

- WebMCP is a Draft Community Group Report, not a finalized W3C Recommendation. The current browser interface exposes tools; it does not give the page MCP Resources or Prompts and does not require the browser agent to communicate over the remote MCP transport.
- Chrome currently offers WebMCP experimentally through an origin trial and local browser support. Edge has also published an experimental origin trial. Tool schemas and browser behavior may change.
- OpenAI Site tools currently discover tools on the live top-level page in the ChatGPT desktop browser. Registration is imperative; current Site tools do not discover declarative tools or tools registered inside iframes. Availability remains client, model, account, and rollout dependent.
- A browser agent must visit and keep the WebVOWL page open to discover and use its tools. Tools are page-scoped and disappear when the page navigates or closes.
- WebMCP is origin-isolated and subject to the browser's tools Permissions Policy. WebVOWL will not attempt to expose a cross-origin iframe implicitly.

These facts make feature detection, top-level imperative registration, and full no-WebMCP behavior release requirements. They also mean that remote or unattended work remains a separate design rather than a fallback hidden inside this feature.

### Repository D3 baseline gate

The checked-in repository does not currently state one unambiguous D3 runtime contract. The package resolution identifies D3 7.9.0 and the Vite build injects D3, while visualization source still contains D3 v3-shaped calls such as `d3.layout.force`, `d3.behavior`, `d3.svg.line`, and `d3.event`. The implementation must not select a version from documentation or inference.

Before changing graph behavior, a blocking real-browser baseline will record the D3 version actually present at runtime and exercise ontology load, initial paint, dragging, zooming, filtering, force pause/resume, and SVG export. A failing or internally inconsistent baseline blocks feature implementation until its cause is understood. If the smallest repair changes a package, lockfile, bundler setting, test setting, or any other configuration, that exact change requires separate user approval; this design does not authorize it. Once the decoupling is complete, the verified D3 version becomes an implementation detail local to `D3RenderedGraphAdapter`.

## User jobs and product value

The feature is intended to reduce mechanical visualization work while leaving ontology interpretation and judgment with the user.

| User job                                | Representative request                                                                                                            | First-release support                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Produce a shareable ontology figure     | “Load this ontology, use English labels, hide datatype nodes, focus on Person and Organization, relax the graph, and export SVG.” | Load, apply a view, settle, export, and report warnings                                                                                              |
| Orient to an unfamiliar ontology        | “What is in this ontology, which namespaces and imports does it use, and where should I start?”                                   | Structural summary, bounded labels and counts, and visible focus; no claim of semantic importance                                                    |
| Find concepts and relationships         | “Find Organization, show its subclasses, and explain how it connects to Person.”                                                  | Bounded label/IRI search, stable element references, and one-hop structural facts; `set_visualization_view` applies any requested graph highlighting |
| Build a task-specific view              | “Show only concepts relevant to publications and authors.”                                                                        | Search, focus, language selection, supported filters, and zoom-to-fit through reversible page state                                                  |
| Diagnose an incomplete or failed graph  | “Why are concepts missing, and did an import fail?”                                                                               | Fetch, parse, import, and rendering diagnostics with bounded warnings                                                                                |
| Prepare teaching or onboarding material | “Simplify this view for someone new to the domain.”                                                                               | Guided filtering, focus, explanations, and SVG export; this complements rather than replaces accessible UI work                                      |
| Record how an illustration was produced | “Give me the SVG and the source, filters, dimensions, and layout outcome used to make it.”                                        | Artifact metadata and a compact view recipe; exact coordinate reproducibility is deferred                                                            |

WebMCP does not turn visual proximity into OWL semantics. A high-degree displayed class may be described as high-degree, not as “important,” and a visual path is not a reasoner proof or SPARQL answer. The tool descriptions and agent-facing results must preserve that distinction.

The following valuable jobs require new capabilities beyond the first WebMCP integration:

- Ontology linting or quality review requires explicit analysis rules.
- Ontology version comparison requires a diff model and comparison presentation.
- Unattended batch or CI rendering requires a headless renderer, server interface, or remote MCP implementation.
- Ontology editing and write-back require preview, validation, reversibility, and explicit confirmation appropriate to semantic mutations.

## Flagship end-to-end workflow

The primary acceptance scenario is:

> Open WebVOWL, load a supplied ontology document IRI, use English labels, hide datatype nodes, focus on Person and Organization, let the layout settle, export SVG, and report import warnings.

The browser agent composes the request internally:

1. Call `load_ontology` and wait for the active generation to render.
2. Use the bounded load result or call `get_ontology_summary` for structural context and warnings.
3. Call `set_visualization_view` once with the desired language, filters, focus, and viewport state.
4. Call `export_visualization`; that tool waits for settlement and creates the artifact.
5. Use the visible download when the client can retrieve files, while reporting artifact metadata in every client.

The user issues one natural-language request. WebVOWL will not expose a polling-oriented `wait_for_layout` tool, and the first release will not expose a monolithic `create_visualization` tool that hides all intermediate visible state. The five tools remain composable for other jobs while `export_visualization` owns the wait necessary for a correct export.

## Goals

1. Let a browser agent reliably load an ontology from an explicitly supplied source.
2. Let the agent summarize and search the loaded ontology without scraping the rendered SVG.
3. Let the agent create a task-specific view using the same behavior available to human users.
4. Let the agent wait for a genuinely stable layout and produce a valid SVG artifact.
5. Keep every agent-driven state change visible and inspectable in the ordinary WebVOWL interface.
6. Keep ontology content in the browser unless the user explicitly chooses a future server-backed workflow.
7. Give the existing UI, tests, WebMCP adapter, and future non-agent callers one small, durable, agent-neutral interface over asynchronous application behavior.
8. Preserve current behavior in browsers and embeddings that do not support WebMCP.
9. Replace legacy orchestration at each controller seam without compatibility shims, forwarding aliases, or parallel production paths.
10. Give every new program object and public field a semantically correct, semantically precise, domain-aligned name that follows one modern naming convention.
11. Make `RenderedGraphRuntime` the only application-facing interface to rendered-graph behavior, with generation-safe replacement, immutable semantic snapshots, structured graph events, and no UI references inside the graph implementation.
12. Keep D3 entirely behind `D3RenderedGraphAdapter`; ordinary UI controls use browser DOM interfaces and controller-domain operations rather than global D3 or concrete graph methods.

## Non-goals

- Replacing the WebVOWL interface with a chat interface.
- Exposing every UI control as an individual tool.
- Adding OWL reasoning, SPARQL execution, ontology quality rules, or ontology comparison as part of the first release.
- Allowing an agent to edit or save an ontology.
- Providing unattended rendering while no WebVOWL page is open.
- Guaranteeing that every WebMCP client can attach the generated SVG to its conversation.
- Sending full ontology documents, graph models, or SVG source through tool results.
- Refactoring unrelated parser, ontology-editing, or presentation behavior. The targeted UI–D3 decoupling, graph-options split, and controller cutovers required to establish `RenderedGraphRuntime` are in scope.
- Replacing D3 as WebVOWL's visualization implementation. This design isolates D3 so a future migration is local; it does not select or implement a replacement renderer.
- Requiring a new server, dependency, build system, or deployment mode.
- Retaining callback aliases, wrapper APIs, duplicate loaders/exporters, or protocol-dependent legacy routes after their controller-owned replacements exist.
- Preserving a vague, misleading, or obsolete name merely to reduce the size of a cutover.

## Design principles

### Progressive enhancement

WebMCP registration will be feature-detected. If the browser does not expose `document.modelContext`, WebVOWL will behave as it does today. WebMCP-specific code must not be imported into the ontology parser or graph implementation.

### One deep, agent-neutral controller module

`WebVowlController` will hide asynchronous sequencing, application state, cancellation, layout settlement, export preparation, and normalized errors behind a small interface. Callers should not need to understand loading callbacks, D3 force lifecycle details, menu state, or SVG serialization internals.

“Agent-neutral” is an interface constraint: the controller will not import WebMCP code, use tool names, accept WebMCP request objects, return protocol envelopes, or assume that its caller is an agent. It will accept WebVOWL domain requests and return WebVOWL domain results. The normal UI and the WebMCP adapter will cross the same seam, and tests will exercise the same interface rather than reaching through it to private implementation details.

### One deep rendered-graph module

`RenderedGraphRuntime` will be the single application-facing interface to rendered-graph behavior. It will hide D3 force lifecycle, selections, transitions, zoom, drag, live SVG ownership, graph-element mutation, and paint timing behind generation-aware operations, immutable semantic snapshots, and structured events. This makes the interface deep: callers express WebVOWL domain intent without coordinating renderer mechanisms themselves.

`D3RenderedGraphAdapter` will be the sole production implementation. It is an adapter at an application seam, not a wrapper around a second public graph route: the current graph construction route and UI-aware options registry will be reshaped into this module and the replaced entry points will be deleted in the same cutover. Controller tests will use `InMemoryRenderedGraphAdapter`, a deterministic test implementation of the same interface; it will not be selectable in production.

The graph module will receive `RenderedGraphConfiguration`, containing only renderer-owned settings such as force parameters, viewport dimensions, and animation settings. It will not receive menu modules, sidebars, loading indicators, search fields, export controls, or other UI objects. UI presentation will consume immutable controller state and browser-native events. Graph-originated progress, warnings, selection, viewport, and layout changes will cross the seam as `RenderedGraphEvent` values rather than calls into UI modules.

### Semantically precise domain vocabulary

Naming is part of the architecture contract, not a cleanup preference. “Every new object” includes modules, interfaces, adapters, factories, functions, methods, parameters, request and result objects, schema properties, state fields, events, errors, constants, DOM identifiers, tool names, and artifact metadata. Each name must identify the represented concept and, where relevant, its role, lifecycle, state, or unit without requiring the reader to inspect its implementation.

The controlled vocabulary is:

| Term                                | Precise meaning                                                                                                               | Must not be conflated with                                               |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Ontology document                   | Serialized OWL-family source text or bytes together with document provenance and syntax                                       | Parsed VOWL model or rendered graph                                      |
| Ontology document IRI               | HTTP(S) document location used to retrieve an ontology document                                                               | The ontology IRI asserted inside OWL semantics                           |
| VOWL JSON document                  | Serialized JSON representation accepted or produced at an external/file boundary                                              | An already parsed JavaScript object                                      |
| VOWL model                          | Validated in-memory object parsed from a VOWL JSON document or produced by OWL-to-VOWL conversion                             | Source text, graph runtime objects, or SVG markup                        |
| Rendered graph                      | WebVOWL graph runtime state derived from a VOWL model                                                                         | The ontology's asserted semantics or the current view settings           |
| Rendered graph runtime              | Application-facing interface for generation-scoped rendering, view application, snapshots, pause state, and graph events      | The concrete D3 graph object, a UI registry, or a controller             |
| D3 rendered graph adapter           | Sole production implementation of `RenderedGraphRuntime`, owning D3 and the live SVG                                          | An application service, protocol adapter, or compatibility wrapper       |
| Rendered graph event                | Immutable, discriminated notification of a graph-originated progress, warning, selection, viewport, or layout-state change    | A DOM event, D3 event, UI callback, or mutable graph object              |
| Ontology inspection snapshot        | Immutable plain-data semantic projection used for summaries and search                                                        | Mutable VOWL element instances, force nodes, selections, or SVG elements |
| Visible rendered graph snapshot     | Immutable plain-data projection of visible stable element references, relationships, and counts                               | D3 selections, internal filter arrays, or the full semantic model        |
| Graph layout snapshot               | Immutable coordinate and force-metric records for one load generation and observation instant                                 | A force simulation, live node array, timer, or settled-state promise     |
| Visualization view                  | Reversible language, filter, focus, layout, and viewport choices applied to the rendered graph                                | The graph data itself                                                    |
| Visualization view controls adapter | Native-DOM UI adapter that maps human input to controller requests and controller state to controls                           | A graph behavior implementation or direct D3 caller                      |
| Rendered SVG snapshot               | Detached, fully styled SVG DOM clone captured while the graph is frozen                                                       | The live SVG, serialized bytes, object URL, or final artifact            |
| SVG artifact                        | Serialized SVG bytes plus verified metadata and a page-owned download lifecycle                                               | A durable remote file or conversation attachment                         |
| SVG artifact publication port       | Application output interface through which the artifact service supplies one page-local downloadable artifact to presentation | A controller result, object-URL owner, remote upload, or WebMCP result   |
| SVG artifact download adapter       | Native-DOM implementation of the publication port that updates the visible manual download                                    | The artifact service, serializer, or object-URL lifecycle owner          |
| Artifact handle                     | Opaque page-local correlation identifier for an SVG artifact                                                                  | An object URL, filesystem path, or durable URL                           |
| Controller-domain request/result    | Agent-neutral WebVOWL operation contract                                                                                      | WebMCP tool schema or protocol envelope                                  |
| WebMCP tool request/result          | External protocol representation owned by the WebMCP adapter                                                                  | Controller state or internal VOWL/graph objects                          |

One concept will have one canonical term, and one term will not be overloaded for different concepts. Unqualified names such as `data`, `info`, `item`, `object`, `thing`, `helper`, `util`, `manager`, `handler`, `process`, `value`, or `result` are unacceptable when a domain noun and role can state the meaning. A conventional role word such as `Controller`, `Adapter`, or `Result` is permitted only when its owning concept and interface make that role specific; `WebVowlController`, for example, denotes the application-level orchestration module, not a UI event handler.

Operations use domain verbs that describe their observable effect. Boolean state fields use a positive predicate such as `isFocusable`, `isRetryable`, or `hasEnded`; imperative request flags may use a positive verb such as `includeNeighborhood`. Quantities encode their unit or measure when it is not inherent in the type, such as `settleTimeoutMs`, `maxInlineOntologyBytes`, `maxToolNameCharacters`, `byteLength`, `widthPx`, and `heightPx`. Lifecycle-sensitive names identify the lifetime they belong to, such as `loadGeneration`, `pageLocalArtifactId`, or `objectUrl`.

Official prose uses `WebVOWL`, `WebMCP`, `OWL`, `VOWL`, `IRI`, and `SVG`. JavaScript identifiers treat initialisms as words consistently: `WebVowlController`, `webMcpAdapter`, `createSvgArtifactService`, and `documentIri`. External WebMCP tool names retain their required snake_case spelling. WebMCP vocabulary stays in the adapter; controller and application names stay in the WebVOWL domain.

The names fixed by this design and plan must be reviewed before implementation, not copied mechanically. If a planned name proves semantically inaccurate, the implementation must correct the defining contract and every in-repository caller in the same change. It must not retain the rejected name as an alias or shim.

### No compatibility shims or parallel orchestration

The controller must own the capabilities it exposes. It must not be a façade that forwards to legacy loading callbacks, invokes old menu operations, or selects between old and new implementations according to caller, browser, or WebMCP availability.

For each migrated capability, one vertical cutover will:

1. Extract the real domain behavior behind a controller dependency or focused application service.
2. Move every ordinary UI caller and the WebMCP adapter to the controller-owned operation.
3. Delete the replaced callback, forwarding method, duplicate request path, and obsolete serialization or transport code in that same change.
4. Add architecture and absence tests that fail if the retired route or a forwarding alias returns.

The following are explicitly prohibited:

- a `WebVowlController` method whose implementation merely calls `loadOntologyFromText`, `parseOntologyContent`, `from_JSON_URL`, `from_IRI_URL`, `loadFromOWL2VOWL`, or the private SVG click handler;
- a `setController` bridge, deprecated alias, compatibility wrapper, or old-signature adapter retained to avoid migrating an in-repository caller;
- both `d3.xhr` and `WebVowlImportResolver` production routes for the same remote source kind;
- both base64/data-URI and Blob/object-URL production routes for SVG export;
- retaining `webvowl.graph`, a menu-aware `options` registry, or another concrete-graph entry point beside `RenderedGraphRuntime`;
- allowing a UI, controller, WebMCP, inspection, settlement, or SVG-serialization module to import D3, read global `d3`, accept a D3 value, or reach through `RenderedGraphRuntime` to renderer internals;
- switching to a legacy implementation when WebMCP is absent or when a required controller dependency fails; and
- leaving dead legacy orchestration in place for a later cleanup phase.

The thin `webMcpAdapter` is not a compatibility shim: it is the sole protocol boundary from the external WebMCP contract to the agent-neutral controller. Feature detection is also not a shim: it determines whether tools are registered, while the ordinary UI continues to call the same controller in either case. Test doubles injected through explicit constructor dependencies are permitted because they do not create an alternative production path.

If a baseline browser lacks a required browser primitive such as `Blob`, object URLs, Web Crypto, or `AbortController`, the operation will fail explicitly through the normal bounded error and visible UI presentation. The implementation will not revive a retired data URI, XHR, callback, or other legacy route as a runtime fallback.

### Visible, reversible collaboration

Agent operations will update the live page. Human controls and agent requests for language, filters, focus, relaxation, and fit will both call `WebVowlController.setVisualizationView`; the controller will normalize each partial request, apply it once through `RenderedGraphRuntime`, and publish one immutable visualization-view state. The existing human pause/resume control will call the separate agent-neutral `WebVowlController.setGraphLayoutPaused` operation, which is not exposed as an initial WebMCP tool. `VisualizationViewControlsAdapter` will reflect controller state in native DOM controls without dispatching synthetic input events. The user can therefore inspect, refine, or undo the same reversible presentation state without creating a UI-to-graph side channel. The first release will restrict state changes to loading and reversible presentation changes.

### Bounded structured exchange

Tool inputs will be narrow and validated at runtime. Tool results will contain identifiers, counts, normalized state, warnings, and artifact metadata rather than unbounded ontology text or serialized SVG.

The initial shared limits are a 2,048-character URL, 1 MiB of inline ontology text, 25 search matches, 10 warnings, and 256 characters for each ontology-derived display string. Tool names will stay within 30 characters, tool descriptions within 500 characters, and parameter descriptions within 150 characters. Tool results will target at most 1,500 serialized characters and will set `isTruncated: true` when bounded collections or strings are omitted. Browser evaluation may lower these limits, but raising them requires review of responsiveness and agent-context impact.

## Alternatives considered

### Register tools directly over existing callbacks

This is the smallest initial patch, but it would expose callback timing, menu state, and private export behavior to every tool. The same orchestration would then be duplicated in tests and future callers. This approach is rejected because it creates a shallow adapter and makes WebMCP-specific behavior responsible for application correctness.

### Introduce the agent-neutral controller, then add a thin WebMCP adapter

This is the selected approach. It creates one deep `WebVowlController` module whose interface is shared by the normal UI, WebMCP, tests, and future non-agent integrations. It requires more deliberate work around existing callbacks, but concentrates cancellation, state, diagnostics, and settlement behavior in one place without coupling application behavior to an agent protocol.

### Build a remote MCP server or headless renderer first

This would better support batch jobs and guaranteed downloadable resources, but it would add infrastructure, duplicate browser behavior, and lose the defining benefit of a user and agent collaborating on the same visible graph. It remains a possible later module once interactive demand and artifact-delivery requirements are measured.

## Existing WebVOWL seams and gaps

The design builds on current behavior rather than proposing a parallel application path.

| Existing seam                                                                     | What is reusable                                                                                                                                          | Gap the implementation plan must address                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/js/app.js`                                                               | The current composition root and rendering body inside `loadOntologyFromText` reveal how parsed data reaches the graph                                    | Loading is callback-oriented and the composition root exposes the concrete graph/options cycle; it must compose `WebVowlController`, UI adapters, and `D3RenderedGraphAdapter` while `getGraph`, `getOptions`, and `loadOntologyFromText` are removed rather than wrapped                                                                            |
| `src/app/js/loadingModule.js` and `src/app/js/menu/ontologyMenu.js`               | Existing user workflows cover VOWL JSON URLs, ontology document IRIs, direct text, file selection, drops, cached data, presets, and conversion responses  | Remote paths use `d3.xhr` and results converge through forwarding callbacks; all callers must move to one bounded controller source contract before those legacy entry points are deleted                                                                                                                                                            |
| `src/owl2vowl/js/index.js`                                                        | `loadWithImports(text, options)` already provides an asynchronous parser/import foundation and structured diagnostics                                     | Root-load and UI orchestration must expose its completion, warnings, and cancellation consistently                                                                                                                                                                                                                                                   |
| `src/owl2vowl/js/importResolver.js` and `src/owlapi-js/io/loaderConfiguration.js` | Imports already restrict schemes to HTTP(S), omit credentials, apply redirect policy, cap a remote document at 32 MiB, and default to a 30-second timeout | The canonical controller path must reuse these controls and add a bounded import count or depth if none exists                                                                                                                                                                                                                                       |
| `src/webvowl/js/graph.js` and `src/webvowl/js/options.js`                         | Canonical unfiltered data, graph loading, filtering, focus, zoom, and D3 force behavior already exist                                                     | The graph holds UI references, the options registry mixes renderer configuration with application/UI state, snapshots expose mutable internals, and `finishedLoadingSequence` is only a progress milestone. Their renderer behavior must move into `D3RenderedGraphAdapter` plus `RenderedGraphConfiguration`; the old entry points are then deleted |
| `src/app/js` UI modules                                                           | Existing menus and sidebars express the complete human workflow                                                                                           | Most production UI modules use global D3 for DOM selection/events and several call concrete graph/options/filter methods. They must use browser-native DOM/EventTarget interfaces and controller operations, leaving no UI-to-D3 or UI-to-graph dependency                                                                                           |
| `package.json`, lockfile, Vite configuration, and D3-shaped source calls          | They identify the candidate dependency, build injection, and concrete calls that the current application expects                                          | They disagree about the apparent D3 era. A real-browser baseline must establish the exact supported runtime before implementation; an exact configuration repair, if needed, requires separate approval                                                                                                                                              |
| `src/app/js/menu/exportMenu.js`                                                   | Existing SVG export identifies non-exportable elements, VOWL styles, metadata, dimensions, and serialization requirements                                 | It mutates and restores the live SVG and depends on graph/D3 state. The runtime must instead create a detached `RenderedSvgSnapshot`; a D3-free serializer and artifact service consume it, and the private base64/data-URI route is deleted                                                                                                         |

The implementation will extract reusable behavior rather than have `WebVowlController` invoke controls or duplicate menu code. Existing file upload remains a human UI capability; once a file is loaded, the controller can summarize, search, restyle, and export the active ontology even though WebMCP does not accept a local filesystem path.

## Architecture

The following diagram is the required dependency structure after the cutover. Solid arrows are allowed application dependencies or control flow; dotted arrows mean “implements the interface.” There is deliberately no edge from a UI module, controller module, WebMCP module, inspection module, settlement module, or serialization module to D3 or the live SVG, and no edge from the rendered-graph implementation back to a UI module.

```mermaid
flowchart LR
    subgraph Callers[Callers]
        Human[Human user]
        Agent[Browser agent]
    end

    subgraph UiAdapters[UI adapters — native DOM only]
        UiInput[UI input adapters]
        UiPresentation[UI presentation adapters]
        SvgDownload[SvgArtifactDownloadAdapter]
    end

    subgraph Application[Agent-neutral application modules]
        WebMcp[WebMCP adapter]
        Controller[WebVowlController]
        ControllerState[Immutable controller state]
        SourceLoader[OntologySourceLoader]
        Inspector[OntologyInspector]
        LayoutSettler[GraphLayoutSettler]
        ArtifactService[SvgArtifactService]
        ArtifactPublication[SvgArtifactPublicationPort]
        SvgSerializer[SvgSerializer]
    end

    subgraph RuntimeSeam[Rendered-graph seam]
        Runtime[RenderedGraphRuntime interface]
        InMemoryAdapter[InMemoryRenderedGraphAdapter — tests only]
    end

    subgraph Visualization[Visualization implementation]
        D3Adapter[D3RenderedGraphAdapter]
        GraphConfiguration[RenderedGraphConfiguration]
        D3[D3]
        LiveSvg[Live SVG]
    end

    Human --> UiInput
    Agent --> WebMcp
    UiInput --> Controller
    WebMcp --> Controller
    Controller --> SourceLoader
    Controller --> Inspector
    Controller --> LayoutSettler
    Controller --> ArtifactService
    ArtifactService --> SvgSerializer
    ArtifactService --> ArtifactPublication
    Controller -->|commands, snapshots, event subscription| Runtime
    Controller --> ControllerState
    ControllerState --> UiPresentation
    D3Adapter -.->|implements| Runtime
    InMemoryAdapter -.->|implements| Runtime
    SvgDownload -.->|implements| ArtifactPublication
    D3Adapter --> GraphConfiguration
    D3Adapter --> D3
    D3Adapter --> LiveSvg
```

This is a complete decoupling, not merely a reduction in coupling. Production input/state UI code depends on native DOM interfaces and `WebVowlController`; the native download adapter implements the narrow `SvgArtifactPublicationPort`; application code depends on `RenderedGraphRuntime`; only the implementation-private visualization subtree rooted at `D3RenderedGraphAdapter` depends on D3 or owns the live SVG. The deterministic in-memory adapter exists only in tests and is never a runtime switch or fallback.

Removing `webvowl.graph`, `webvowl.options`, and public renderer modules that bypass this seam is an intentional breaking interface cutover for an embedding host that reached into renderer internals. In-repository callers migrate atomically; supported application-level embeddings use `app.getWebVowlController()` and semantic controller operations. No deprecated alias or compatibility façade will preserve the concrete renderer interface. If the published package version or other release configuration must change to communicate that break, that exact configuration change requires separate approval.

### Agent-neutral `WebVowlController`

`WebVowlController` is the durable application seam. It will be constructed from explicit WebVOWL dependencies and will provide the following conceptual interface. The accompanying implementation plan fixes the initial file placement, exact runtime seam, tests, and cutover order.

```js
loadOntology(request, { signal }) -> Promise<OntologyLoadResult>
getOntologySummary(request?) -> OntologySummary
findOntologyElements(request) -> OntologyElementSearchResult
setVisualizationView(request, { signal }?) -> Promise<VisualizationViewResult>
setGraphLayoutPaused(request) -> GraphLayoutPauseResult
exportVisualization(request, { signal }) -> Promise<SvgExportResult>
getState() -> WebVowlControllerState
```

The interface includes all caller-visible invariants and error modes:

- `loadOntology` resolves only for the active load generation after parsing and initial graph rendering are complete.
- Starting a new load supersedes the previous generation. Late callbacks from an older generation cannot change state or resolve as the current result.
- Operations that can wait or perform network work accept an `AbortSignal`.
- Summary and search consume an immutable `OntologyInspectionSnapshot` from `RenderedGraphRuntime` rather than scraping SVG labels or traversing mutable renderer objects.
- `setVisualizationView` resolves after the requested view has been normalized, applied, and reflected by the graph.
- `exportVisualization` owns layout settlement; callers do not poll a separate waiting tool.
- Every result reports what actually happened, including bounded warnings and normalized settings.

The controller will use explicit states:

```text
idle → loading → parsing → rendering → relaxing → ready
          │          │          │           │
          └──────────┴──────────┴───────────┴──► error
```

Cancellation returns the controller to the most recent valid state. It is not reported as an unexpected application failure.

Existing UI capabilities will move behind `WebVowlController` as complete vertical cutovers. A cutover may be delivered one capability at a time, but no completed slice may leave a legacy production path or forwarding shim beside the controller path. The controller will not simulate clicks or manipulate menu controls to perform work. UI-specific presentation remains in the UI, while the controller owns application operations and structured outcomes. This direction of dependency is what keeps the seam useful when WebMCP is disabled or replaced.

Every in-scope human control will use that same direction. Language, class/datatype/property filters, minimum-degree filtering, search-result focus, explicit graph focus, layout relaxation, and fit-to-viewport actions enter through `setVisualizationView`; pause/resume enters through `setGraphLayoutPaused`. Search suggestions come from `findOntologyElements`; selecting one applies focus through `setVisualizationView`. UI presentation adapters write controller state to DOM properties without dispatching synthetic events, so reflecting state cannot start another controller operation. Pointer gestures performed directly on the rendered SVG remain renderer-owned interactions and are reported upward as structured events; no menu or sidebar imports D3 to implement them.

### `RenderedGraphRuntime` interface

The controller receives one `renderedGraphRuntime` dependency. It does not receive separate graph-load, filter, focus, zoom, pause, snapshot, paint, or export callbacks. The conceptual interface is:

```js
replaceVowlModel(request, { signal }) -> Promise<RenderedGraphReplacementResult>
applyVisualizationView(request, { signal }) -> Promise<VisualizationViewApplicationResult>
readOntologyInspectionSnapshot() -> OntologyInspectionSnapshot
readVisibleRenderedGraphSnapshot() -> VisibleRenderedGraphSnapshot
readGraphLayoutSnapshot() -> GraphLayoutSnapshot
setGraphLayoutPaused(request) -> GraphLayoutPauseResult
createRenderedSvgSnapshot(request) -> RenderedSvgSnapshot
subscribeToRenderedGraphEvents(listener) -> unsubscribeFromRenderedGraphEvents
dispose() -> void
```

All arguments, results, snapshots, and events crossing this interface are plain immutable WebVOWL domain values. They contain stable element references, scalar metrics, coordinate records, discriminants, and generation identifiers; they never contain D3 selections, force nodes, simulations, transition objects, mutable VOWL element instances, DOM events, the live SVG, or renderer-owned arrays. `RenderedSvgSnapshot` is the sole exception to the plain-data rule because it is an explicitly typed detached DOM clone for browser serialization; it is never the live SVG and is owned by the export operation that requested it.

`replaceVowlModel` receives the controller-assigned `loadGeneration` with the VOWL model. On replacement, the production adapter must stop the previous simulation, detach its event listeners, cancel its timers and transitions where supported, and fence every tick, end, progress, warning, and paint callback by both generation and `AbortSignal`. Aborting or superseding a generation guarantees that it can no longer mutate the live DOM, publish an event, update controller state, or resolve as current. The replacement promise resolves only after the new generation's first graph geometry is present in the live SVG and a browser paint containing that geometry has occurred; the existing progress threshold is not this completion signal.

`RenderedGraphEvent` is a closed discriminated union whose initial kinds are `render-progress-changed`, `render-warning-raised`, `rendered-element-selection-changed`, `viewport-changed`, and `graph-layout-state-changed`. The controller subscribes through the interface, rejects events from a non-current generation, and derives a new immutable controller-state snapshot. The graph adapter never calls a menu, sidebar, loading indicator, or other presentation object.

`D3RenderedGraphAdapter.createRenderedSvgSnapshot` is called only after the controller has frozen the graph and completed the required font and paint waits. It clones the live SVG into a detached tree, removes interaction-only content from the clone, resolves computed visual styles onto the clone, and returns it without mutating or restoring the live SVG. A D3-free `SvgSerializer` inserts metadata with DOM APIs and text content, serializes the detached clone with `XMLSerializer`, and returns bytes to `SvgArtifactService`. The artifact service alone owns `Blob` creation, object-URL lifecycle, hashing, filenames, and artifact handles; it publishes the current page-local download through `SvgArtifactPublicationPort`, whose native-DOM adapter owns only presentation.

### WebMCP adapter

The WebMCP adapter will be deliberately thin. It will:

1. Feature-detect the imperative WebMCP interface.
2. Register the supported tools from the top-level document.
3. Validate and normalize each request before calling `WebVowlController`.
4. Map structured controller errors to concise tool results.
5. Register and unregister tools through one lifecycle-owned `AbortController`.
6. Capture only the stable controller interface; do not capture a rendered-graph adapter, renderer configuration, UI module, or load-generation-specific snapshot.

Once the controller is ready, the adapter will keep the small five-tool surface registered for the page lifetime rather than churn registrations as ontology state changes. State-dependent calls return `NO_ONTOLOGY` until data is ready. Every execute callback resolves only after the corresponding visible page state and structured controller result agree.

The first release will not use the declarative WebMCP form interface because the application behavior is asynchronous and stateful, and current ChatGPT Site tools support imperative, top-level registration rather than iframe-discovered declarative tools.

Embedded WebVOWL instances remain usable through their normal interface. A host that wants WebMCP support for an embedded instance must register top-level proxy tools and delegate to that instance's `WebVowlController`; iframe discovery will not be assumed.

## Initial tool interface

The tool set will begin with five non-overlapping tools.

| Tool                     | Classification             | Responsibility                                                                                                | Bounded result                                                                                 |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `load_ontology`          | Stateful                   | Load an ontology from an HTTP(S) ontology document IRI, a VOWL JSON URL, or explicitly supplied ontology text | Load generation, source provenance, status, counts, import summary, warnings                   |
| `get_ontology_summary`   | Read-only                  | Describe the current ontology and active view                                                                 | Counts, namespaces, imports, languages, selected settings, warnings                            |
| `find_ontology_elements` | Read-only                  | Search canonical element labels and IRIs with type and result limits                                          | Stable element references, labels, IRIs, kinds, bounded neighborhood facts                     |
| `set_visualization_view` | Stateful and reversible    | Apply supported language, filter, focus, layout, and viewport options                                         | Normalized applied view and affected-element counts                                            |
| `export_visualization`   | Stateful artifact creation | Settle the current graph and produce an SVG download                                                          | Page-local artifact identifier, filename, media type, byte length, source provenance, warnings |

The tool descriptions and parameter descriptions will remain concise. A generic command tool and one-tool-per-button design are explicitly rejected because they would make tool selection ambiguous and expose internal UI structure as a public interface.

`get_ontology_summary` and `find_ontology_elements` will declare `readOnlyHint: true`. The three state-changing tools will declare `readOnlyHint: false` because they load or alter the visible page or create an artifact. Every result containing ontology-derived labels, IRIs, annotations, source text, or diagnostics will declare `untrustedContentHint: true`. An annotation is a hint to the client, not a substitute for validation or bounded output.

Search and inspection remain one tool initially: each match can include bounded one-hop facts sufficient for common follow-up questions. A separate `inspect_ontology_element` tool will be added only if evaluation shows that combining those results exceeds the output budget or makes tool selection unreliable.

An element reference will prefer the pair of VOWL element kind and ontology IRI rather than a transient SVG or array index. Anonymous elements receive a load-generation-scoped reference and are not represented as stable across ontology reloads.

### Source handling

`load_ontology` will use a discriminated source request with a concept-specific field in each branch rather than an overloaded `value` property or ambiguous URL/text combinations:

```js
{ kind: "ontology-document-iri", documentIri: "https://example.org/model.owl" }
{ kind: "vowl-json-url", url: "https://example.org/model.json" }
{ kind: "ontology-text", text: "...", format: "turtle" }
```

The ordinary application also needs a first-class controller-domain source for a VOWL model already parsed from a file or cache or produced by a converter. That source is named `vowl-model`, accepts a validated in-memory `model` plus provenance, and is not exposed as a WebMCP input. Calling it `vowl-json` would incorrectly name an in-memory model after its serialization format. It is a genuine application source kind, not an alias for a retired serialized-text callback; JSON parsing occurs exactly once at the source boundary. Preset paths are resolved to absolute URLs and use `vowl-json-url`; file, cache, and converter models use `vowl-model` directly.

Local filesystem paths will not be accepted. A file the user loaded through the existing file picker can still be summarized, searched, restyled, and exported after it becomes the active ontology.

The controller and adapter will validate the discriminated union at runtime, enforce the shared size limits, require HTTP(S) for remote sources, and report browser CORS failures as `FETCH_FAILED` rather than suggesting that the ontology is malformed.

## Layout settlement and SVG export

The existing “finished loading sequence” is a UI progress milestone, not a sufficient export contract. Export requires a separate definition of stability.

`exportVisualization` will:

1. Reject the request if no ontology is ready.
2. Wait for the active generation to finish rendering.
3. Have `GraphLayoutSettler` observe immutable `GraphLayoutSnapshot` values and structured layout events until the adapter reports its native end state or an agreed energy/displacement threshold remains satisfied for consecutive frames. The settler never receives the D3 simulation or its mutable node array.
4. Stop waiting at a configured maximum duration.
5. On timeout, return a structured `LAYOUT_TIMEOUT` error unless the request explicitly permits exporting the best current state.
6. Record the current generation and graph-layout pause state, pause that generation through `RenderedGraphRuntime`, and wait for document fonts plus the final required paint frames.
7. Request a detached, fully styled `RenderedSvgSnapshot` from the runtime. The runtime creates it without mutating the live SVG.
8. Pass that snapshot and compact provenance to the D3-free `SvgSerializer`, then pass the serialized bytes to `SvgArtifactService`.
9. Create an SVG `Blob`, an object URL, and a visible download entry in the page, and return matching compact artifact metadata.
10. In a `finally` path, restore the previous pause state only when the same generation is still current and restoration was not superseded or aborted.

Serialization has a strict ownership rule: `SvgSerializer` accepts `RenderedSvgSnapshot`, metadata, and explicitly injected browser serialization primitives. It accepts no graph, D3, selection, force, menu, or live-SVG dependency. Metadata is constructed with DOM nodes and `textContent`, not interpolated into markup. Only `SvgArtifactService` creates or revokes object URLs. Export tests must prove that success, failure, timeout, cancellation, and supersession leave the live SVG byte-for-byte unchanged except for legitimate concurrent renderer activity from a newer generation.

“Visually settled” and “byte-for-byte reproducible” are different guarantees. The first release guarantees visually settled output. Exact reproducibility requires fixed initial coordinates or a layout seed, fixed viewport dimensions, fixed force settings, and a stable iteration policy. Those options will be introduced only if evaluation demonstrates a user requirement for identical rerenders.

The generated artifact will include or be accompanied by compact provenance: source identity, source hash when available, import status, view settings, WebVOWL version, dimensions, and layout outcome. Tool output will contain metadata and an artifact handle, not the SVG document itself.

A successful bounded result has this shape conceptually:

```json
{
  "status": "ready",
  "pageLocalArtifactId": "export-42",
  "filename": "person-organization.svg",
  "mediaType": "image/svg+xml",
  "byteLength": 184392,
  "sha256Hex": "9d8b2f5fa6e2162e73320a149b31a7e9f9a44c2b7a6a5f91de1d9ff823e7488b",
  "source": {
    "kind": "ontology-document-iri",
    "identity": "https://example.org/ontology.owl"
  },
  "pageLocalViewRecipeId": "view-17",
  "layout": { "status": "settled", "widthPx": 1200, "heightPx": 800 },
  "warnings": [],
  "isTruncated": false
}
```

`pageLocalArtifactId` and `pageLocalViewRecipeId` are page-local opaque handles, not permanent URLs. The view recipe records the active source identity, source hash when available, language, filters, focused stable element references, viewport dimensions, and layout outcome. The recipe is embedded in the SVG's `<metadata>` and exposed in the page's artifact details; the opaque identifier correlates those representations. It records how the current artifact was produced without claiming byte-for-byte reproducibility.

## Artifact delivery

The portable completion condition is that WebVOWL displays a valid downloadable SVG and returns matching metadata. Whether an agent can download that artifact and attach it to a conversation is a client capability outside the WebMCP contract.

The first release therefore uses a privacy-first browser artifact:

- SVG remains local to the page as a `Blob`.
- A visible download action remains available to the user.
- The tool result identifies and verifies the artifact.
- No ontology or SVG is uploaded automatically.

The page owns each object URL. Replacing an artifact or unloading the page revokes obsolete URLs after they are no longer needed. The returned handle therefore has the same lifetime as the live page and must not be represented as durable storage.

In clients able to operate downloads, the agent may activate the visible download and attach or otherwise return the file. That behavior is an integration capability to verify, not a guarantee made by WebMCP or `WebVowlController`. A release can claim “SVG ready for download” once the page artifact and metadata agree; it can claim “SVG returned to the conversation” only for a separately tested client path.

A stable server URL or remote MCP resource is a future, separately approved design if guaranteed cross-client attachment or unattended rendering becomes necessary.

## Trust and security

Ontology documents are untrusted input. Labels, comments, annotations, IRIs, imports, and parser diagnostics may contain text that resembles agent instructions.

Ontology-derived text is data even when it says “ignore previous instructions,” names a tool, or requests another network action. Neither the controller nor adapter will interpret that text as control flow, and the adapter will keep it in explicitly identified structured fields.

The implementation will enforce the following requirements:

- Mark results derived from ontology content as untrusted content where the client supports that annotation.
- Keep descriptions and results bounded by explicit string-length, item-count, and byte limits.
- Validate tool inputs again at execution time rather than relying only on advertised JSON schemas.
- Allow only explicitly supported source schemes and reject local paths, script URLs, and unsupported URL forms.
- Reuse the existing import resolver's omitted credentials, redirect handling, remote byte limits, timeouts, and cancellation behavior.
- Add an import count or depth budget if the canonical load path does not already enforce one.
- Prevent stale load generations from updating the current graph.
- Avoid placing credentials, tokens, or private configuration in tool definitions or results.
- Register tools only from the trusted top-level WebVOWL origin and rely on the browser's origin isolation and tools Permissions Policy rather than attempting cross-origin discovery.
- Treat a future server-side renderer as a new threat model requiring private-network and SSRF controls.

Summary and search tools will be annotated read-only. Loading, view changes, and export will report their state effects accurately. WebMCP does not replace the application's existing authorization or user-consent rules.

## Errors and diagnostics

`WebVowlController` will normalize expected failures into stable codes with a human-readable message and bounded details. Initial codes are:

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

Implementation will follow test-driven development across six layers:

1. **Runtime baseline tests:** a real browser records the exact D3 runtime and proves that the current load, first paint, drag, zoom, filter, force pause/resume, and export behavior works before any renderer refactor begins.
2. **Rendered-graph contract tests:** the deterministic `InMemoryRenderedGraphAdapter` and production `D3RenderedGraphAdapter` satisfy the same generation, abort, first-paint, immutable-snapshot, structured-event, pause-restoration, and disposal contract. Production-adapter browser tests supersede work during rendering, relaxation, and export and prove that stale ticks, end callbacks, progress callbacks, and paint callbacks cannot mutate the current page.
3. **Controller tests:** agent-neutral interface behavior, state transitions, generation supersession, cancellation, view normalization, bounded results, layout timeout, pause restoration, and export metadata use the in-memory adapter without D3 or DOM-graph fakes.
4. **WebMCP adapter contract tests:** exact tool registration, schemas, annotations, request validation, error mapping, asynchronous visible completion, and `AbortSignal`-owned cleanup use a fake `document.modelContext`.
5. **Application integration and architecture tests:** representative ontology text and URLs pass through source loading, rendering, inspection snapshots, controller-owned human and agent view changes, settlement, detached SVG serialization, and artifact creation. Guards prove that replaced callbacks, forwarding aliases, duplicate remote loaders, the base64 SVG route, the old concrete graph entry point, and the UI-aware options registry are absent.
6. **Browser evaluation:** supported Chromium/WebMCP environments, the normal no-WebMCP path, top-level registration, human/agent state agreement, visible state changes, downloads, console errors, and client-specific attachment behavior.

Architecture tests are release gates rather than advisory lint. They must prove all of the following:

- `src/app/js` controller, WebMCP, inspection, settlement, serialization, artifact, menu, sidebar, and loading modules contain no D3 import, injected D3 parameter, global `d3` read, D3 selection, or D3 event use.
- `D3RenderedGraphAdapter` is the only production adapter implementing `RenderedGraphRuntime`, and production composition has no old graph route, adapter switch, forwarding alias, or fallback.
- Renderer modules contain no UI identifiers or references to menus, sidebars, loading indicators, search controls, export controls, or other presentation objects.
- Every in-scope human view handler calls `WebVowlController` and no handler calls a graph, runtime adapter, options registry, filter implementation, or D3 directly.
- `OntologyInspectionSnapshot`, `VisibleRenderedGraphSnapshot`, and `GraphLayoutSnapshot` are deeply immutable plain values and contain no D3, DOM, simulation, mutable VOWL-element, or renderer-owned array references.
- `SvgSerializer` has no graph or D3 dependency, and snapshot serialization never mutates the live SVG.

Every layer also reviews the names it introduces against the controlled vocabulary. Contract tests assert exact externally observable tool, request, result, error, and metadata field names; architecture review checks that WebMCP terms do not leak into controller modules. Semantic precision remains a reviewer judgment and will not be reduced to an unreliable word blacklist.

The evaluation corpus will include small and large ontologies, imports, malformed input, unsupported sources, CORS and network failures, superseded loads, missing labels, large search result sets, layout timeout, and repeated exports.

Browser evaluation will use 15–20 job-oriented prompts rather than testing only isolated tool calls. It will record task completion without manual clicking, correctness of the source and applied view, warning accuracy, time to a usable graph and artifact, successful user retrieval of the SVG, result size, stale-load safety, and whether the agent makes unsupported semantic claims. Client-specific file attachment will be reported separately from page-side export success.

Release acceptance requires:

- Existing non-WebMCP behavior remains functional.
- The ordinary UI and WebMCP use the same controller operations; no compatibility shim or retired production path remains.
- `RenderedGraphRuntime` is the only production application seam to graph behavior; `D3RenderedGraphAdapter` is the only production implementation, and D3 appears only in that adapter and its private visualization modules.
- No rendered-graph module stores or calls UI objects, and no UI or application module imports or reads D3.
- Each registered tool completes representative user jobs without DOM guessing.
- Cancellation and supersession during loading, rendering, relaxation, snapshot creation, or export cannot corrupt the active graph or publish stale state.
- No tool emits unbounded ontology or SVG content.
- Exported SVG opens independently and matches the visible view; serialization operates on a detached snapshot and does not mutate the live SVG.
- Users retain a visible manual download even when the agent cannot attach the file.
- Unsupported browsers receive no WebMCP errors or degraded controls.
- New identifiers and structured objects use the controlled vocabulary consistently, encode units and lifetimes where required, and do not conflate an ontology document, VOWL model, rendered graph, visualization view, or SVG artifact.

## Delivery sequence

1. Establish and record the blocking real-browser D3 baseline; obtain separate approval before any exact configuration repair it reveals.
2. Define bounded controller-domain contracts, `RenderedGraphRuntime`, immutable snapshot/event contracts, linked cancellation, and the deterministic in-memory test implementation.
3. Migrate application UI DOM/event work from global D3 to browser-native interfaces while preserving behavior.
4. Build the canonical source loader, snapshot-based inspector and settler, native view-controls adapter, clone-only serializer/artifact modules, and agent-neutral `WebVowlController` against the in-memory runtime. These modules remain disconnected from production until the cutover.
5. Perform one atomic production cutover: reshape graph/options into `D3RenderedGraphAdapter` plus `RenderedGraphConfiguration`; connect the controller and every ordinary UI caller; remove graph-to-UI calls; route loading, human view actions, and manual export through the controller; and delete concrete graph/options exports, old callbacks, `d3.xhr` source routes, live-SVG mutation, and base64 export.
6. Add the thin imperative WebMCP protocol adapter and its contract tests after controller-owned application paths are canonical.
7. Run browser evaluations and refine schemas, descriptions, limits, and diagnostics.
8. Audit the dependency structure and complete feature vocabulary, correct any violation at its defining contract without aliases, and document availability, privacy, embedding constraints, the no-shims invariant, and the client-specific artifact handoff.

Each step must leave the ordinary application working. Intermediate commits may introduce tested domain modules before their cutover, but they must not connect a second production route or preserve a forwarding shim. A production cutover and deletion of the path it replaces belong to the same commit. Any required build, package, lockfile, test-runner, CI, deployment, or other configuration change requires separate explicit approval before it is made.

## Deferred extensions

The following extensions are intentionally outside the first implementation plan and require their own design decisions:

- ontology quality and linting tools;
- comparison of ontology versions;
- saved deterministic layout recipes;
- ontology editing and write-back;
- server-backed artifact persistence;
- remote MCP or headless batch rendering;
- exposing WebMCP from an embedding host application.

## Assessment traceability

The implementation plan must reference these assessment decisions so product rationale is not lost when work is decomposed into code tasks.

| ID  | Assessment decision                                                                                                                               | Design location                                                                                            | Plan obligation                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | WebMCP is an optional live-page enhancement, not WebVOWL's backend or required runtime                                                            | Context; Platform snapshot; Progressive enhancement                                                        | Include unsupported-browser and lifecycle tests                                                                                                                                                |
| A2  | The durable investment is an agent-neutral `WebVowlController`; WebMCP is a thin adapter                                                          | Decision summary; Design principles; Architecture                                                          | Establish and test the controller before registering tools; prove it owns behavior rather than forwarding to legacy callbacks                                                                  |
| A3  | Ontology-to-relaxed-SVG is the flagship workflow, composed from visible operations                                                                | Flagship workflow; Layout settlement; Artifact delivery                                                    | Include an end-to-end acceptance task from source through download                                                                                                                             |
| A4  | Broader value includes orientation, investigation, task-specific views, diagnostics, teaching, and provenance                                     | User jobs and product value                                                                                | Map supported jobs to summary, search, view, and export tests                                                                                                                                  |
| A5  | The initial interface contains five bounded, non-overlapping tools                                                                                | Initial tool interface                                                                                     | Define exact schemas, annotations, limits, and error mappings; do not add polling or generic command tools                                                                                     |
| A6  | Existing loading, parser/import, graph, and export behavior is reused through a new completion seam                                               | Existing WebVOWL seams and gaps                                                                            | Name exact source files, integration points, atomic cutovers, and deletion of replaced orchestration                                                                                           |
| A7  | UI-ready is not layout-settled; export owns a bounded settlement contract                                                                         | Layout settlement and SVG export                                                                           | Add force-end/stability, timeout, best-current-state, and pause-restoration tests                                                                                                              |
| A8  | Visually settled output is required; exact byte reproducibility is not promised initially                                                         | Layout settlement and SVG export; Deferred extensions                                                      | Keep layout seeds and stored coordinates out of initial tasks                                                                                                                                  |
| A9  | WebMCP returns compact metadata and a page-local artifact handle, not full SVG or a guaranteed chat attachment                                    | Artifact delivery                                                                                          | Test Blob lifecycle, visible download, checksum/metadata agreement, and client handoff separately                                                                                              |
| A10 | Ontology content and diagnostics are untrusted and bounded                                                                                        | Bounded structured exchange; Trust and security                                                            | Test injection-like labels, output truncation, URL policy, CORS, credentials, timeouts, and imports                                                                                            |
| A11 | Current clients require top-level imperative registration and do not make iframe tools portable                                                   | Platform snapshot; WebMCP adapter                                                                          | Test registration/cleanup in the top-level page and document embedding limitations                                                                                                             |
| A12 | Success is measured by complete user jobs, not merely successful tool callbacks                                                                   | Testing and evaluation                                                                                     | Include the 15–20 prompt evaluation matrix and record task, latency, retrieval, and semantic-claim outcomes                                                                                    |
| A13 | Quality analysis, comparison, editing, remote artifacts, and unattended rendering are separate designs                                            | Non-goals; User jobs; Deferred extensions                                                                  | Do not smuggle these capabilities or infrastructure into the initial plan                                                                                                                      |
| A14 | Controller and rendered-graph integration use no compatibility shims, forwarding aliases, duplicate production paths, or legacy runtime fallbacks | Decision summary; No compatibility shims or parallel orchestration; Delivery sequence                      | Make each production cutover atomic, delete replaced paths in the same change, and add absence/architecture tests                                                                              |
| A15 | Every new object and identifier uses semantically correct, semantically precise, modern domain naming                                             | Decision summary; Goals; Semantically precise domain vocabulary; Testing and evaluation                    | Apply the controlled vocabulary globally, test exact public names, review every task's new names, and complete a final semantic-vocabulary audit without aliases                               |
| A16 | UI and application behavior are completely decoupled from D3 through one deep rendered-graph interface                                            | One deep rendered-graph module; Architecture; `RenderedGraphRuntime` interface                             | Make `D3RenderedGraphAdapter` the sole production implementation, migrate UI DOM work to native interfaces, remove graph-to-UI references, and enforce both directions with architecture tests |
| A17 | Generation safety continues through asynchronous rendering, relaxation, paint, and export                                                         | `RenderedGraphRuntime` interface; Layout settlement and SVG export; Testing and evaluation                 | Fence every renderer callback by generation and signal, tear down superseded work, define true first-paint completion, and test supersession at each asynchronous phase                        |
| A18 | Inspection, visibility, layout, and export cross the renderer seam as immutable semantic snapshots                                                | Semantically precise domain vocabulary; `RenderedGraphRuntime` interface; Layout settlement and SVG export | Deep-freeze plain snapshots, prohibit renderer-owned values, create SVG snapshots as detached styled clones, and prove serialization never mutates the live SVG                                |
| A19 | The apparent D3 dependency and source API era must be reconciled by evidence before implementation                                                | Repository D3 baseline gate; Existing WebVOWL seams and gaps; Testing and evaluation                       | Run the blocking real-browser baseline first and stop for exact approval if a configuration or dependency repair is required                                                                   |

## References

- [WebMCP Draft Community Group Report](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP overview](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome imperative WebMCP interface](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome WebMCP best practices](https://developer.chrome.com/docs/ai/webmcp/best-practices)
- [Chrome WebMCP security guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [OpenAI Site tools](https://learn.chatgpt.com/docs/webmcp)
- [OpenAI Runme WebMCP case study](https://developers.openai.com/blog/automating-repetitive-work-at-openai-with-codex)
- [Microsoft Edge WebMCP origin trial](https://developer.microsoft.com/en-us/microsoft-edge/origin-trials/trials/0b76fe60-b266-458e-a285-04e375c0c31a)
- [Visualizing ontologies with VOWL](https://journals.sagepub.com/doi/10.3233/SW-150200)
