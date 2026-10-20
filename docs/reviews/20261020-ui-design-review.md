# WebVOWL UI design review: ontology chooser and graph-first details

Run: `20261019T2257Z-169de90b`, written 2026-10-20 (local) / 2026-10-19 22:57Z – 2026-10-20 ≈04:35Z, paused ≈23:25–04:30Z (see §0.3).
Mode: planning and review only. Nothing in this document is authorised for implementation.
Status: review record. Its recommendations are proposals awaiting the owner decisions in section 11; none has been accepted or implemented.
Citations: source citations are relative links, and line numbers refer to HEAD `62961414`; later commits may move them.
When the citations were converted to links, eight ranges were tightened to the exact start and end of the cited construct.
Location: written outside the repository as the task required, in `C:\Users\maksy\Documents\Claude-planning-reviews\2026-10-20\task-07\20261019T2257Z-169de90b\`, as a report and a separate wireframes-and-storyboard file.
On 2026-10-20 the owner moved them into the repository, then had them consolidated into this single file: the wireframes, storyboard and state diagrams are section 16, and references between the two files now point within this document.
The findings themselves are unchanged.
Parallel reviews from the same date: [architecture](20261020-architecture-assessment.md) and [performance](20261020-performance-review.md).
This review was written without reading them and is not reconciled with them.

## 0. Scope, state and evidence

### 0.1 Repository state recorded at start

| Repository         | Path                                                                                                   | HEAD                                                                  | Working tree                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| webvowl            | `C:\Users\maksy\GitHub\webvowl` (`origin` Hadden-Industries/webvowl, `upstream` VisualDataWeb/WebVOWL) | `62961414530e141f8f79ec369afee2d68b9036a6` on `main` (merge of PR 81) | `M AGENTS.md` only — user-owned edit to the commit-authorisation section; untouched |
| universal-ontology | `C:\Users\maksy\GitHub\universal-ontology`                                                             | `561b7aeda6d7f82aa3adc76fb412e4d88d615642`                            | `M AGENTS.md` only; untouched                                                       |

Binding instructions followed: `webvowl/AGENTS.md` (configuration safety, working-tree safety, no commits), the owner's global agreements, and standing memories (no subagents, serial work, TDD for any later implementation, renderer is a projection, UI→controller calls transfer facts).
No source, configuration, data, build, test, server, worktree, commit or publication action was taken.
During the review the only writes were the two output files outside the repository; the owner moved them in afterwards, and the consolidation touched only this review's own files.

### 0.2 Evidence labels used throughout

| Label       | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **\[SRC]**  | Read from the webvowl working tree at `62961414`. File:line references are to that tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **\[UO]**   | Read from the universal-ontology working tree at `561b7aed`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **\[NET]**  | HTTP HEAD or ranged GET from this machine, 2026-10-19 ≈23:00Z. Availability is a point-in-time fact, not a guarantee.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **\[LIVE]** | Observed in the **deployed** app `https://haddenindustries.com/webvowl/` (reports version 2.0.0) in the desktop app's built-in Chromium browser with 375×812 viewport emulation, ≈23:08Z, through non-editing interactions only. The deployed build is not proven identical to HEAD; no local server was running (port 8000 closed), and none was started. **These observations were made before the owner instructed that the work continue with static code analysis only. No live inspection was performed after that instruction, and no design decision rests on a \[LIVE] item alone: each one used is paired with its \[SRC] basis, and the single live-only observation (D-13's node size during taps) is marked non-load-bearing.** |
| **\[SPEC]** | Primary source fetched during this run (W3C, MDN).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **\[SEC]**  | Secondary source (vendor blog, caniuse aggregation). Lower confidence; re-verify before relying on it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **\[HIST]** | The two ChatGPT discussions. **Not accessed** (authenticated pages). The owner requirements reproduced in the task were used; earlier assistant code, pixel values and API claims were treated as unverified proposals.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **\[INF]**  | Inference from source reading, not executed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **\[PROP]** | Proposal in this design. Unverified until implemented and tested.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

### 0.3 Run log

| Time (UTC)        | Event                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-10-19 22:57  | Start; repository state recorded                                                                                                                                                                                                                                   |
| ≈23:00–23:10      | Source audit, \[NET] checks, primary-source research, pre-instruction \[LIVE] look at the deployment                                                                                                                                                               |
| ≈23:10–23:25      | Report drafted                                                                                                                                                                                                                                                     |
| —                 | Paused awaiting the owner                                                                                                                                                                                                                                          |
| 2026-10-20 04:30  | Resumed on the owner's instruction: continue with **static code analysis only, no live browser inspections**. None were run after this point; the browser pane was already closed. Remaining work (relabelling, wireframes, second pass) used only source reading. |
| 2026-10-20 ≈05:50 | After the owner moved both files into `docs/reviews/`, consolidated them into this single document at the owner's request; citations converted to relative links, with no change to findings                                                                       |

Active working time stayed within the 70-minute budget; the wall-clock span exceeds it only because of the pause.

### 0.4 Parallel-thread boundaries

Performance analysis and architecture are owned by other threads.
This design states the seams and constraints it needs (§12) and does not make a broad refactor a prerequisite: every slice in §9 can land against today's controller and renderer seams, with the two genuinely new seams (preview anchor geometry, renderer decoration) isolated in their own slices.

## 1. Executive summary

**Chooser.** Replace the six preset links and the separate "Custom Ontology" form with one **Ontology URL** field (a genuine `type="url"` input) plus an inline, grouped suggestions list: **Hadden Industries** (Metadata, Reference Data, Core, Extended — exact owner URLs; document retrieval of all four verified on 2026-10-19, end-to-end visualisation not exercised) first and visually prominent, then **Others** (the six packaged examples).
Choosing a suggestion only _commits_ it: the field receives the real fetchable URL and a separate summary line shows the name and badges.
Loading happens only on **Visualize** or Enter with no active suggestion.
Three findings shape the specification:

1. **ARIA in HTML (W3C Recommendation, 11 August 2026) forbids `role="combobox"` on an `input type="url"` without a `list` attribute.** The conforming way to keep a genuine URL input is an implicit-textbox field with `aria-autocomplete="list"`, `aria-controls` and `aria-activedescendant`, plus a separate labelled toggle button that carries `aria-expanded`. Switching to `type="text" role="combobox"` would contradict the owner's requirement A5, so it is presented as an alternative, not chosen (decision D-03).
2. **Packaged examples cannot simply be pushed through today's manual-URL path.** That path silently upgrades `http:` to `https:` (breaking `http://localhost:8000/canonical-examples/foaf.json` in development) and switches presets from their current semantics (resumed layout and automatic node count) to explicit-route semantics. The single loading path is therefore defined one level up: one submission function produces one location route; an unedited packaged suggestion keeps its existing preset route (`#foaf`), so bookmarks and behaviour are preserved (decision D-01).
3. **`setIriText` dispatches synthetic `input` and `submit` events** and is used by the search box's "typed a URL" path. Reusing it for suggestions would load on selection (violating A4). The design replaces it with a direct submission call shared by the chooser and search.

**Details.** Recommend the **graph-first hybrid**: the canvas is never shared with a permanent panel by default; selection opens a **contextual preview card** that grows out of the selected node (shape-styled morph, HTML content in the existing application overlay layer, never in force-layout geometry); a labelled **Details** button opens **complete information** in semantic HTML — a modal sheet on compact screens, the retained docked inspector on wide screens (also kept for editor mode); ontology metadata moves to an on-demand **Overview** reached from a title chip.
The smaller fallback is an **adaptive on-demand inspector** (sheet on compact, closed by default, a one-line selection "peek" bar), with no morph and no new renderer seam.

**The problem, from static analysis \[SRC].** At ≤1024 px the panel starts hidden, but opening it at 375 px gives the panel its fixed 280 px token and leaves the canvas `calc(100% − 280px)` = **95 px** wide; with the panel closed, selecting a node renders details only into the hidden panel, so nothing is visible; the toggle's content is the glyph ">"/"<" with no `aria-label` or `aria-expanded`; no `prefers-reduced-motion` rule exists in either stylesheet. A pre-instruction look at the deployed 2.0.0 build matched each of these \[LIVE].

**Motion.** The project's `browserslist` is `baseline widely available` [SRC [`package.json:106-108`](../../package.json#L106-L108)].
Same-document View Transitions became Baseline only in October 2025 (newly available) \[SPEC MDN], element-scoped transitions are Chrome 147+ only \[SEC], and CSS anchor positioning became Baseline in January 2026 \[SEC].
None is inside the supported target, so the mandatory path uses Web Animations / CSS transitions on `transform`/`opacity`, and View Transitions are at most a later enhancement (D-14).

## 2. Current-state audit

### 2.1 Chooser, routing and loading

| #    | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Evidence                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-1  | The Ontology menu (`#m_select`, `popover="auto"`, `role="dialog"`) lists six `<a href="#preset">` links (FOAF, GoodRelations, MUTO, OntoViBe, PersonasOnto, SIOC), a dev-only `#benchmark` link stripped from release builds, then a "Custom Ontology:" `type="url"` field with a **Visualize** submit button and live hint, then file select/Upload, Create new ontology (editor-mode gated), Paste ontology document and Ontology facts. On mobile (≤768 px) the popover is a draggable bottom sheet (max 80svh) in which all six links precede the URL field, so the field sits below them. | \[SRC] [`index.html:237-389`](../../src/index.html#L237-L389), [`toolstyle.css:4465-4495`](../../src/app/css/toolstyle.css#L4465-L4495) (matched by \[LIVE])                                                                                         |
| C-2  | `normalizeOntologyUrl` trims; rejects any character ≤ U+0020 or U+007F anywhere (an internal space is rejected rather than encoded); prefixes `https://` when there is no scheme or the text looks like `host:port`; **upgrades `http:` to `https:` silently**; accepts only `https:` with a hostname, no `%` in the hostname, no credentials; sets `isJson` from a `.json` pathname suffix. Note: a bare word such as `core` normalises to `https://core/` and is accepted.                                                                                                                   | \[SRC] [`ontologyMenu.js:5-52`](../../src/app/js/menu/ontologyMenu.js#L5-L52); tests [`ontologyMenu.test.js:149-203`](../../src/app/js/menu/ontologyMenu.test.js#L149-L203)                                                                          |
| C-3  | Submission writes `location.hash = (isJson ? "url=" : "iri=") + encodeURI(normalizedUrl)`, then **clears the field**. The `hashchange` listener calls `loadOntologyFromLocation`. `encodeURI` turns existing `%XX` into `%25XX`; the loader's `decodeURIComponent` restores them (round trip covered by a test).                                                                                                                                                                                                                                                                               | \[SRC] [`ontologyMenu.js:287-315`](../../src/app/js/menu/ontologyMenu.js#L287-L315), [`:119-132`](../../src/app/js/menu/ontologyMenu.js#L119-L132); [`ontologyMenu.test.js:405-416`](../../src/app/js/menu/ontologyMenu.test.js#L405-L416)           |
| C-4  | Enter in the field normalises **before** native constraint validation and implicit submission; the button click does the same. The Visualize button is natively disabled until the value is normalisable.                                                                                                                                                                                                                                                                                                                                                                                      | \[SRC] [`ontologyMenu.js:222-285`](../../src/app/js/menu/ontologyMenu.js#L222-L285); [`ontologyMenu.test.js:328-368`](../../src/app/js/menu/ontologyMenu.test.js#L328-L368)                                                                          |
| C-5  | `setIriText(text)` sets the value and dispatches synthetic `input` and `submit` events. Its only production caller is the search box: Enter with no search results and a parseable `http(s)` URL calls `onOntologyIriEntered(url)`.                                                                                                                                                                                                                                                                                                                                                            | \[SRC] [`ontologyMenu.js:134-140`](../../src/app/js/menu/ontologyMenu.js#L134-L140); [`app.js:160-163`](../../src/app/js/app.js#L160-L163); [`searchMenu.js:351-380`](../../src/app/js/menu/searchMenu.js#L351-L380)                                 |
| C-6  | Route resolution: `file=` → refuse with "select again" guidance; `url=` → `{kind:"vowl-json-url"}`; `iri=` → `{kind:"ontology-document-iri"}`; otherwise `resolvePresetSource(key)` → packaged canonical example; otherwise legacy `data/<key>.json`. Empty hash defaults to `foaf`.                                                                                                                                                                                                                                                                                                           | \[SRC] [`loadingModule.js:359-393`](../../src/app/js/loadingModule.js#L359-L393); [`visualizationShareLink.js:40-50`](../../src/app/js/controller/visualizationShareLink.js#L40-L50)                                                                 |
| C-7  | **Preset routes carry different semantics from explicit routes**: presets add `view.layout = "resume"` and `useAutomaticNodesShown: true`; `url=`/`iri=`/`file=` do not.                                                                                                                                                                                                                                                                                                                                                                                                                       | \[SRC] [`loadingModule.js:395-417`](../../src/app/js/loadingModule.js#L395-L417)                                                                                                                                                                     |
| C-8  | Packaged examples resolve with `new URL("../../canonical-examples/<name>.json", import.meta.url)`; the build emits them at the deploy root with stable names (`assetFileNames` → `[name].[ext]`). Development: `http://localhost:8000/canonical-examples/<name>.json` \[INF]. Production: `https://haddenindustries.com/webvowl/<name>.json` — all six return 200 `application/json` \[NET].                                                                                                                                                                                                   | \[SRC] [`canonicalExamples.js`](../../src/app/js/canonicalExamples.js); [`vite.config.mjs:334-347`](../../vite.config.mjs#L334-L347); \[NET]                                                                                                         |
| C-9  | **Format admission is not decided by extension on the document route.** `ontology-document-iri` acquisition ignores server/filename hints and lets native loading select syntax from the bytes; an ambiguous case asks the person (`requestCanonicalRemoteFormat`). The `.json` suffix only chooses between the VOWL-JSON route and the ontology-document route — so a JSON-LD ontology at a `.json` URL would be sent down the VOWL-JSON route \[INF; verify with a test].                                                                                                                    | \[SRC] [`canonicalVowlSourceAcquisition.js:87-100`](../../src/app/js/controller/canonicalVowlSourceAcquisition.js#L87-L100); [`ontologyMenu.js:49`](../../src/app/js/menu/ontologyMenu.js#L49), [`:309`](../../src/app/js/menu/ontologyMenu.js#L309) |
| C-10 | Remote fetches use `credentials: "omit"`, follow redirects and set no `Accept` header; imports with `http:` are upgraded to `https:` when the base is HTTPS. Byte/import/time limits: 32 MiB aggregate, 256 imports, 30 s.                                                                                                                                                                                                                                                                                                                                                                     | \[SRC] [`importResolver.js:25-32`](../../src/app/js/controller/importResolver.js#L25-L32), [`:199-203`](../../src/app/js/controller/importResolver.js#L199-L203); node_modules/owlapi/model/owlOntologyLoaderConfiguration.js:24-44                  |
| C-11 | Share links serialise only `iri=`/`url=` sources: `#opts=…;#iri=<encodeURI(identity)>`. A preset loaded as `#foaf` is shared as `#url=<absolute packaged URL>`, so the link is bound to the deployment host and reopens with explicit-route semantics (its `nodesShown` option preserves count intent).                                                                                                                                                                                                                                                                                        | \[SRC] [`visualizationShareLink.js:161-232`](../../src/app/js/controller/visualizationShareLink.js#L161-L232)                                                                                                                                        |
| C-12 | Existing search combobox: `type="text" role="combobox" aria-autocomplete="list" aria-haspopup="listbox"`; the popup lives in `#applicationOverlayLayer`. It marks the **keyboard-active** option with `aria-selected="true"` (selection follows focus), so it cannot be copied for a chooser that must distinguish active from committed.                                                                                                                                                                                                                                                      | \[SRC] [`index.html:1135-1146`](../../src/index.html#L1135-L1146), [`:1735-1743`](../../src/index.html#L1735-L1743); [`searchMenu.js:383-412`](../../src/app/js/menu/searchMenu.js#L383-L412)                                                        |
| C-13 | `navigationMenu.js` deliberately opens popovers without an invoker (`showPopover()` with no source) to avoid WebKit bug 286146 (focus-navigation loop with form controls inside invoker-owned popovers). A nested popover for the chooser's list would re-enter that risk.                                                                                                                                                                                                                                                                                                                     | \[SRC] [`navigationMenu.js:22-110`](../../src/app/js/menu/navigationMenu.js#L22-L110)                                                                                                                                                                |
| C-14 | No JS depends on the preset `<a>` elements; `.selected-ontology` CSS is unused. Retiring the links is markup and CSS only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | \[SRC] grep                                                                                                                                                                                                                                          |

### 2.2 Details, selection and the renderer

| #    | Observation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-1  | `#detailsArea` is a fixed right panel, width `--right-sidebar-width` = 280 px (320 px ≥1600, 360 px ≥2100), slide and width transitions of 0.5 s. Opening it sets `#canvasArea` to `calc(100% - width)` at every viewport size.                                                                                                                                                                                                                                                                                                                                                                                                                   | \[SRC] [`toolstyle.css:180-215`](../../src/app/css/toolstyle.css#L180-L215), [`:1005-1035`](../../src/app/css/toolstyle.css#L1005-L1035), [`:1351-1383`](../../src/app/css/toolstyle.css#L1351-L1383)                                                                                                                                                                                                                                                                                                                                                                                                                    |
| D-2  | At setup the panel starts **hidden when `innerWidth ≤ 1024`**, otherwise visible. `sidebar=0/1` in a share link overrides this.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | \[SRC] [`sidebar.js:1203-1206`](../../src/app/js/sidebar.js#L1203-L1206); [`app.js:348-355`](../../src/app/js/app.js#L348-L355)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-3  | At a 375 px viewport: hidden by default (D-2); opened, the panel takes the 280 px token and the canvas becomes `calc(100% − 280px)` = **95 px**. The toggle's only content is the glyph ">"/"<" (swapped by `showSidebar`), with no `aria-label` and no `aria-expanded`.                                                                                                                                                                                                                                                                                                                                                                          | \[SRC] [`toolstyle.css:180`](../../src/app/css/toolstyle.css#L180), [`:1032-1035`](../../src/app/css/toolstyle.css#L1032-L1035); [`index.html:198-202`](../../src/index.html#L198-L202); [`sidebar.js:1103-1119`](../../src/app/js/sidebar.js#L1103-L1119). Matched by \[LIVE] measurement (280/95 px).                                                                                                                                                                                                                                                                                                                  |
| D-4  | Selection details render inside the panel's "Selection Details" accordion, which auto-expands on selection, but **the panel itself is not opened** — on compact screens a tap produces no visible details.                                                                                                                                                                                                                                                                                                                                                                                                                                        | \[SRC] [`sidebar.js:721-746`](../../src/app/js/sidebar.js#L721-L746)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-5  | Only the **first** element description is rendered (`const [elementDescription] = …`), so an element with several semantic roles (punning, merged references from `flatMap`) shows one role.                                                                                                                                                                                                                                                                                                                                                                                                                                                      | \[SRC] [`sidebar.js:724`](../../src/app/js/sidebar.js#L724); [`d3RenderedGraphAdapter.js:597-609`](../../src/webvowl/js/runtime/d3RenderedGraphAdapter.js#L597-L609)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-6  | Accordion headings are `h3` elements given `role="button"` and `tabindex="0"` — heading semantics are lost and no `aria-expanded` is exposed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | \[SRC] [`sidebar.js:132-134`](../../src/app/js/sidebar.js#L132-L134)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-7  | No `prefers-reduced-motion` rule exists in `toolstyle.css` or `vowl.css`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | \[SRC] grep (matched by a pre-instruction \[LIVE] stylesheet scan)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| D-8  | Editor mode swaps `#generalDetails` for `#generalDetailsEdit` in the same panel (ontology title/IRI/version/authors, prefixes, description, selected element IRI/label/type/characteristics). This is a persistent editing workflow.                                                                                                                                                                                                                                                                                                                                                                                                              | \[SRC] [`index.html:1461-1636`](../../src/index.html#L1461-L1636); [`sidebar.js:1215-1229`](../../src/app/js/sidebar.js#L1215-L1229)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-9  | "Ontology facts" is a native modal `<dialog>` (`showModal`, `closedby="any"`, `aria-labelledby`, focus restored on close) paging **retained facts by section** for the whole ontology, including facts with no graph shape. It is not entity-filtered.                                                                                                                                                                                                                                                                                                                                                                                            | \[SRC] [`canonicalFactsDialog.js`](../../src/app/js/ui/canonicalFactsDialog.js)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| D-10 | Controller read operations available to presentation: `getOntologySummary`, `describeOntologyElements` (bounded descriptions with relations, annotations, characteristics, cardinality, individuals), `getOntologyFacts` (retained facts), `getVisualizationArrangement` (occurrences with graph-space `xPx`/`yPx`), `getVisualizationFocus`. Write: `selectVisualizationElement` (by rendered occurrence).                                                                                                                                                                                                                                       | \[SRC] [`canonicalWebVowlController.js:762-1132`](../../src/app/js/controller/canonicalWebVowlController.js#L762-L1132)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-11 | Selection path: node `click` → `executeModules` (300 ms duplicate guard) → `focuser.handle` (re-click on the selected element **deselects**) and `pickAndPin.handle` (pins only after a drag) → `toggleSelection` → `reportRenderedElementSelection` → runtime events `rendered-element-selection-changed` (semantic references) and `document-record-selection-changed` (record target and occurrence) → controller `selection` / `selectedDocumentRecord`. The occurrence is kept privately (`selectedEditorOccurrence`), not published. **No `force.start/resume/alpha` call exists on this path** — selection does not reheat the simulation. | \[SRC] [`renderedGraphInternals.js:747-765`](../../src/webvowl/js/runtime/renderedGraphInternals.js#L747-L765), [`:869-884`](../../src/webvowl/js/runtime/renderedGraphInternals.js#L869-L884), [`:1680-1712`](../../src/webvowl/js/runtime/renderedGraphInternals.js#L1680-L1712); [`focuser.js`](../../src/shared/js/modules/focuser.js); [`pickAndPin.js:19-41`](../../src/shared/js/modules/pickAndPin.js#L19-L41); [`RoundNode.js:84-90`](../../src/webvowl/js/elements/nodes/RoundNode.js#L84-L90); [`canonicalWebVowlController.js:408-414`](../../src/app/js/controller/canonicalWebVowlController.js#L408-L414) |
| D-12 | `selection` and `selectedDocumentRecord` are generation-scoped and reset at each load (closed field set).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | \[SRC] [`webVowlControllerContracts.js:37-49`](../../src/app/js/controller/webVowlControllerContracts.js#L37-L49), [`:562-585`](../../src/app/js/controller/webVowlControllerContracts.js#L562-L585)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| D-13 | The graph is not stationary when a reader first selects: preset loads request `view.layout = "resume"`, the controller reports a `relaxing` status after the drawing is ready, and Resume restarts motion.                                                                                                                                                                                                                                                                                                                                                                                                                                        | \[SRC] [`loadingModule.js:399-406`](../../src/app/js/loadingModule.js#L399-L406), [`:624-631`](../../src/app/js/loadingModule.js#L624-L631); [`docs/webmcp.md`](../../docs/webmcp.md) "`resume` restarts it". (Non-load-bearing \[LIVE] footnote: pre-instruction taps on small class circles at the initial mobile framing missed moving targets.)                                                                                                                                                                                                                                                                      |
| D-14 | `#applicationOverlayLayer` (fixed, inset 0, `pointer-events: none`, z-index 3000) already hosts the search popup and is the natural host for a preview card.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | \[SRC] [`index.html:1735-1743`](../../src/index.html#L1735-L1743); [`toolstyle.css:447-456`](../../src/app/css/toolstyle.css#L447-L456)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D-15 | Viewport meta sets `maximum-scale=1.0, user-scalable=no`. This prevents page pinch-zoom on browsers that honour it and bears on WCAG 1.4.4/1.4.10 evaluation of any new panel (outside this task's scope; see D-15 decision).                                                                                                                                                                                                                                                                                                                                                                                                                     | \[SRC] [`index.html:18-21`](../../src/index.html#L18-L21)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### 2.3 Stale or risky assumptions to avoid from the historical discussion

- "Call `setIriText(option.url)` when a suggestion is chosen" — would load immediately (synthetic submit) and route presets as explicit URLs (C-5, C-7).
- "Put the example JSON URL in the field and reuse the existing submit handler" — the `http→https` upgrade breaks development URLs, `.json` routing is a route choice not format admission, and presets lose resumed layout and automatic node count (C-2, C-7, C-9).
- "Add `role="combobox"` to the URL input" — non-conforming for `type="url"` without `list` \[SPEC ARIA in HTML].
- "Use `<datalist>`" — no grouping, no badges, inconsistent value/label display, and it competes with any custom popup (§8.3).
- "Use the View Transition API for the node-to-panel morph" — outside the supported browser target, document-wide overlay, snapshots of a moving graph, unclear SVG-element capture (§8.2).
- "The mobile sidebar is persistent" — on current code it starts hidden at ≤1024 px; the real problem is that opening it leaves 95 px of graph and that selection without it shows nothing (D-2–D-4).
- Any fixed sidebar percentage (§6.5 states the rule as a measurable minimum, not a percentage).

## 3. Requirements matrix

Decision IDs (D-xx) refer to §11. Acceptance criteria (AC) are written to be testable; "unit" means the existing Jest suite, "browser" means a real-browser check.

| Req | Owner request                                                                                                                                                           | Current behaviour                              | Proposed response                                                                                                          | Acceptance criteria                                                                                                                                                                                                                                                                               | Open decision    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| A1  | One editable combobox with list autocomplete; groups "Hadden Industries" (first, more prominent) and "Others"                                                           | Preset links + separate URL form (C-1)         | One "Ontology URL" field, inline grouped listbox, toggle button, summary line, Visualize (§4)                              | AC-A1-1 the menu contains one URL field and no preset links; AC-A1-2 group order and DOM order are Hadden then Others; AC-A1-3 Hadden prominence uses text and weight, not colour alone (1.4.1); AC-A1-4 typing filters suggestions (`aria-autocomplete="list"`)                                  | D-03             |
| A2  | Hadden entries in the given order, human-readable names, category badges, no stable substitution                                                                        | None                                           | Inventory H1–H4 (§4.2) with published titles, category badge, verbatim alias badge                                         | AC-A2-1 order Metadata, Reference Data, Core, Extended; AC-A2-2 committing H3/H4 puts the exact `…/latest-unstable` string in the field (unit test asserts byte equality); AC-A2-3 no code path rewrites an alias segment                                                                         | D-04, D-05       |
| A3  | Others: FOAF, GoodRelations, MUTO, OntoViBe, PersonasOnto, SIOC; retire popover entries                                                                                 | Six links (+ dev benchmark)                    | Six packaged suggestions; links removed; hash routes retained                                                              | AC-A3-1 links absent; AC-A3-2 `#foaf`… bookmarks load with resumed layout and automatic node count exactly as now (loadingModule regression); AC-A3-3 `#benchmark` route unchanged                                                                                                                | D-06             |
| A4  | Selecting does not load; Visualize (and a keyboard equivalent) loads; distinguish active, committed, edited, validation, submitted; Enter cannot both select and submit | Links load on activation                       | State model §4.4, Enter rules E1–E6                                                                                        | AC-A4-1 no load request after any commit by click, tap or Enter (spy on submission); AC-A4-2 Enter with an active option is `preventDefault`ed before implicit submission; AC-A4-3 a second Enter (no active option) submits; AC-A4-4 each state is visually and programmatically distinct (§4.5) | —                |
| A5  | Genuine `type="url"`; the field holds a fetchable URL; name/status separate; one loading path; URLs from current assets and provenance                                  | `type="url"` exists; presets bypass it         | Field value = suggestion `documentUrl`; summary line separate; single `submitOntologySource` function; routes per §4.3     | AC-A5-1 input `type` remains `url`; AC-A5-2 after commit `input.value` parses as an absolute URL; AC-A5-3 chooser, search URL path and hash navigation all reach `loadOntologyFromLocation`; AC-A5-4 no remote endpoint is invented for Others                                                    | D-01, D-02, D-03 |
| A6  | Editing a committed URL clears/updates the selection; matching across labels/URLs/badges; empty/no-match/error states; upload and create unchanged                      | Field cleared after submit; no suggestions     | Commitment is exact equality (§4.4); matching rules §4.6; states §4.7; upload/create/paste/facts unchanged below the field | AC-A6-1 any edit that makes the value differ from the committed URL removes `aria-selected` and the summary; restoring the exact text re-commits; AC-A6-2 matching test table (§4.6) passes; AC-A6-3 create remains disabled outside editor mode with its hint                                    | D-07, D-08, D-17 |
| B1  | Graph-first on mobile instead of a width-consuming sidebar                                                                                                              | Panel takes 280 of 375 px when open (D-3)      | Hybrid §6: no side-by-side panel below the docking threshold; sheets and preview instead                                   | AC-B1-1 below the docking threshold (initially viewport width ≤1024 px, today's `sidebar.setup` boundary) no layout state leaves the canvas narrower than the viewport; AC-B1-2 at ≥ docking threshold the docked inspector is opt-in                                                             | D-09, D-13       |
| B2  | Ontology metadata on demand from a discoverable overview/menu surface                                                                                                   | Always in the panel                            | Title chip with labelled "Overview" button; overview sheet/panel (§6.3, §7.1)                                              | AC-B2-1 the control has a visible text label and precedes the graph region in tab order; AC-B2-2 overview contains every field the panel shows today                                                                                                                                              | —                |
| B3  | Tap reveals an expanded preview; explicit Details opens complete information; owner's shape rule evaluated                                                              | Name highlight only; details hidden on compact | Preview card + Details (§6, §7); shape rule options S/C/H (§6.4)                                                           | AC-B3-1 tap/click/keyboard selection opens the preview; AC-B3-2 Details is a labelled button; AC-B3-3 all facts from `describeOntologyElements` and a route to retained facts are reachable for every entity kind and shape                                                                       | D-10, D-11, D-12 |
| B4  | Smooth transitions preserving the connection to the entity; verify HW acceleration and View Transitions                                                                 | None for details                               | FLIP morph via Web Animations on `transform`/`opacity`; reduced-motion path; VT optional later (§8)                        | AC-B4-1 interrupting any transition settles in ≤1 frame to the latest state; AC-B4-2 with `prefers-reduced-motion: reduce` no scale/translate animation runs; AC-B4-3 performance acceptance set by the performance thread (PH-1–PH-3)                                                            | D-14             |
| B5  | Assess earlier ideas: foreground preview separate from layout, semantic HTML details, labelled Details, reduced motion, adaptive sidebar fallback                       | —                                              | All adopted, with corrections (§8.4)                                                                                       | —                                                                                                                                                                                                                                                                                                 | —                |
| B6  | Edge cases                                                                                                                                                              | —                                              | §7.4 table                                                                                                                 | Each row is a test case                                                                                                                                                                                                                                                                           | —                |
| B7  | Preserve ownership and interactions                                                                                                                                     | —                                              | §7.3 invariants                                                                                                            | AC-B7-1 opening or closing previews never changes `layout`, arrangement, pins, viewport or exports; AC-B7-2 no UI module reads SVG for facts (architecture test)                                                                                                                                  | AH-1–AH-6        |

## 4. Chooser specification

### 4.1 Structure (descriptive, not markup to copy)

Inside the existing Ontology popover/sheet, top to bottom:

1. Visible label **Ontology URL**.
2. Field row: the `type="url"` input (with `inputmode="url"`, `autocomplete="off"`, `spellcheck="false"`, `autocapitalize="off"`, existing `required`), a **Show suggestions** toggle button (chevron icon plus accessible name; carries `aria-expanded` and `aria-controls`), and a **Clear** button shown only when the field is non-empty.
3. **Selection summary** line (separate from the field): for a committed suggestion, its name, group and badges (for example "Core · Hadden Industries Universal Core Ontology · alias latest-unstable"); for an uncommitted value, "Custom URL"; empty when the field is empty. It is referenced by the input's `aria-describedby`.
4. The **suggestions list** rendered inline in the sheet (not a nested popover, see C-13): `role="listbox"` with two `role="group"` children labelled by visible group headings, each containing `role="option"` rows.
5. **Visualize** (submit) button and the existing polite hint/error line (`#iri-converter-hint`), reused for validation and status.
6. Unchanged: file select/Upload, Create new ontology, Paste ontology document, Ontology facts.

ARIA on the input (decision D-03, recommended option a): implicit `textbox` role (no `role` attribute), `aria-autocomplete="list"`, `aria-controls` pointing at the listbox while it is shown, `aria-activedescendant` set only while an option is active, `aria-describedby` → summary + hint, `aria-invalid` on error.
This is conforming under ARIA in HTML (textbox-applicable attributes on `type="url"` without `list`) and WAI-ARIA 1.2 (`aria-activedescendant` and `aria-autocomplete` apply to `textbox`).
`aria-expanded` is not applicable to `textbox`, which is why the toggle button carries it.

Option row content: name (accessible name), then badges as text, then the URL in a smaller monospace line; badges and URL form the option's accessible description.
Group headings are rendered as non-option text inside each group and referenced by `aria-labelledby`.
Screen-reader announcement of group labels inside a text-field-controlled listbox varies; §9 lists it for AT verification, with the fallback of including the group name in each option's description.

### 4.2 Option inventory and URL provenance

Display names are the published `dcterms:title` values read from the documents themselves; alias badges are verbatim path segments so that nothing implies a stability promise the publisher does not make (`latest` and `latest-unstable` are "mutable document aliases" \[UO docs/webmcp-ontology-entity-definition-lookup.md:56-60]).

| ID  | Group             | Display name                                                     | Category badge | Other badges            | Field URL (exact)                                                                                      | Route on Visualize | Availability                                                                                                                                                                                                                                                                                                |
| --- | ----------------- | ---------------------------------------------------------------- | -------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Hadden Industries | ISO/IEC 11179-3:2023 Ontology                                    | Metadata       | alias `latest`          | `https://haddenindustries.com/ontology/iso-iec/11179/-3/ed-4/latest`                                   | `#iri=` + URL      | **Verified \[NET]**: 200, `application/rdf+xml`, 602,693 B, `Access-Control-Allow-Origin: *`, no redirect; title and `owl:versionIRI …/ed-4/20260912` read from the document; imports `http://www.w3.org/2004/02/skos/core` (upgraded to HTTPS by the resolver). **End-to-end visualisation not verified.** |
| H2  | Hadden Industries | Hadden Industries Universal Reference Data Ontology              | Reference Data | alias `latest`          | `https://haddenindustries.com/ontology/universal/reference-data/latest`                                | `#iri=` + URL      | **Verified \[NET]**: 200, RDF/XML, 1,139,625 B, ACAO `*`; versionIRI `…/reference-data/20260912`; imports the dated ISO release `…/ed-4/20260912`. End-to-end not verified.                                                                                                                                 |
| H3  | Hadden Industries | Hadden Industries Universal Core Ontology                        | Core           | alias `latest-unstable` | `https://haddenindustries.com/ontology/universal/core/latest-unstable`                                 | `#iri=` + URL      | **Verified \[NET]**: 200, RDF/XML, 376,701 B, ACAO `*`; versionIRI `…/core/20260912`; imports `http://www.w3.org/ns/time/gregorian` and `…/reference-data/latest-unstable`. End-to-end not verified.                                                                                                        |
| H4  | Hadden Industries | Hadden Industries Universal Extended Ontology                    | Extended       | alias `latest-unstable` | `https://haddenindustries.com/ontology/universal/extended/latest-unstable`                             | `#iri=` + URL      | **Verified \[NET]**: 200, RDF/XML, 730,914 B, ACAO `*`; versionIRI `…/extended/20260912`; imports `…/core/latest-unstable`. End-to-end not verified.                                                                                                                                                        |
| O1  | Others            | Friend of a Friend (FOAF) vocabulary                             | —              | Packaged example        | packaged `foaf.json` resolved at runtime (production `https://haddenindustries.com/webvowl/foaf.json`) | `#foaf` (D-01)     | Production asset **verified \[NET]** 200 `application/json` 130,997 B; development URL \[INF]. Provenance: `https://xmlns.com/foaf/spec/index.rdf` \[SRC notices].                                                                                                                                          |
| O2  | Others            | GoodRelations Vocabulary for E-Commerce                          | —              | Packaged example        | `…/goodrelations.json`                                                                                 | `#goodrelations`   | Verified \[NET] 288,395 B; source `http://purl.org/goodrelations/v1.owl`                                                                                                                                                                                                                                    |
| O3  | Others            | Modular and Unified Tagging Ontology (MUTO)                      | —              | Packaged example        | `…/muto.json`                                                                                          | `#muto`            | Verified \[NET] 38,843 B; source `https://muto.socialtagging.org/core/v1.rdf`                                                                                                                                                                                                                               |
| O4  | Others            | Ontology Visualization Benchmark (OntoViBe)                      | —              | Packaged example        | `…/ontovibe.json`                                                                                      | `#ontovibe`        | Verified \[NET] 68,927 B; source `http://ontovibe.visualdataweb.org`                                                                                                                                                                                                                                        |
| O5  | Others            | Personas Ontology (PersonasOnto)                                 | —              | Packaged example        | `…/personasonto.json`                                                                                  | `#personasonto`    | Verified \[NET] 142,899 B; source `http://blankdots.com/open/personasonto.owl`                                                                                                                                                                                                                              |
| O6  | Others            | SIOC (Semantically-Interlinked Online Communities) Core Ontology | —              | Packaged example        | `…/sioc.json`                                                                                          | `#sioc`            | Verified \[NET] 135,139 B; source `http://rdfs.org/sioc/ns#`                                                                                                                                                                                                                                                |

Notes on Others:

- The field shows the **packaged artifact URL**, because that is the URL actually fetched; the original source URLs were not substituted because the packaged artifacts are what the application has qualified and the notices record ([`canonical-example-notices.txt`](../../src/app/data/canonical-example-notices.txt)). Using the remote originals would replace reliable bundled examples with remote documents of unknown availability and CORS behaviour.
- The notices state the artifacts are transformed visualisations, "not unchanged original OWL files", and must not be described as stable interchange files. Hence the badge says **Packaged example**, and the option description may say "Packaged copy of <source>" but never claims to be the original document.
- The URL is computed at runtime from the existing resolver (`canonicalExampleSource(key).url`), so no deployment host is hard-coded.
- The dev-only benchmark keeps its `#benchmark` route but gets no chooser entry unless the owner decides otherwise (D-06).

### 4.3 Routing: one submission path, existing route vocabulary

One function — working name `submitOntologySource` (final name under the naming contract) — receives the field text plus the derived commitment and returns one route:

| Field state at submission                                              | Route written                                                 | Loader semantics                                            | Why                                                                                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Committed packaged suggestion (value exactly equals its `documentUrl`) | `#<presetKey>` (for example `#foaf`)                          | Preset: resumed layout, automatic node count (C-7)          | Preserves today's behaviour and existing bookmarks; works on `http://localhost` because no normalisation runs (D-01, D-02) |
| Committed Hadden suggestion                                            | `#iri=` + `encodeURI(url)`                                    | Explicit document route; native syntax detection from bytes | Matches today's manual entry of the same URL; readable bookmark                                                            |
| Uncommitted text                                                       | Existing `normalizeOntologyUrl` then `#url=`/`#iri=` as today | Explicit route                                              | Unchanged behaviour for manual URLs                                                                                        |

All three continue through `hashchange → loadOntologyFromLocation → loadRemoteSource → controller.loadOntology` (C-3, C-6), so manual URLs and suggestions share one loading path.
The search box's "Enter on a URL" path calls the same function instead of `setIriText`, removing synthetic event dispatch (AH-7).

The `.json`-suffix route choice for uncommitted text is retained as today (changing it is out of scope), but recorded as a known limitation: a JSON-LD ontology at a `.json` URL is routed as VOWL JSON (C-9).

### 4.4 State model

Five independent dimensions, each with one owner. "Committed" is **derived**, not stored, which makes edits and restores trivially consistent.

| Dimension            | Values                                                                 | Owner                                    | Rule                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Popup                | `closed` / `open`                                                      | chooser UI                               | Opens on toggle button, Down/Up arrow, Alt+Down, typing when matches exist, pointer focus on an empty field; closes on commit, Escape, Tab, blur, submit, or zero matches with an empty field |
| Active suggestion    | `none` / option id                                                     | chooser UI                               | Moved by arrows and pointer hover; never writes the field; reset on each input event                                                                                                          |
| Committed suggestion | `none` / option id                                                     | derived                                  | `committed = suggestions.find(s => s.documentUrl === field.value.trim())` — exact string equality, before any normalisation                                                                   |
| Validation           | `untouched` / `valid` / `invalid(message)`                             | existing `updateConverterState`          | Errors appear only after a change, Enter or submit attempt (existing `validationWasShown`), then update live                                                                                  |
| Submission           | `idle` / `submitted(route)` / `loading` / `loaded` / `failed(message)` | controller state rendered by the chooser | Derived from the controller load lifecycle; the chooser keeps the last submitted text for recovery (D-07)                                                                                     |

"Edited" is simply `value ≠ committed URL` after a commit existed; the summary switches to "Custom URL" and the previously committed option loses `aria-selected`.
Restoring the exact text (undo, paste) re-commits; no hidden state can disagree with the visible value.

### 4.5 Visual and programmatic distinctions

| State                            | Visual                                                                                                                             | Programmatic                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Active option (keyboard/pointer) | Focus-style outline on the row (≥2 px, ≥3:1)                                                                                       | `aria-activedescendant` on the input                                                        |
| Committed option                 | Check mark and "Selected" text in the row; summary line under the field                                                            | `aria-selected="true"` on that option only; summary in `aria-describedby`                   |
| Edited after commit              | Summary reads "Custom URL"; no check mark                                                                                          | `aria-selected` removed                                                                     |
| Validation error                 | Error text, error icon and border (not colour alone)                                                                               | `aria-invalid="true"`, error in the described-by hint (polite live region exists)           |
| Submitted / loading              | Menu closes (existing `prepareLoadingPresentation`); loading indicator with step and progress                                      | Existing `#loadingErrorMessage` (`role="status"`), progress `output` (`aria-live="polite"`) |
| Failed                           | Existing loading-error presentation; when the menu reopens, the field still holds the submitted text with "Last attempt failed: …" | Hint text; focus placed in the field when the menu is reopened after a failure              |

### 4.6 Matching

- Normalise query and haystack: Unicode NFKC, case fold, collapse whitespace; for URLs also compare with the scheme stripped.
- Match fields per option: display name, short category name, group name, badge texts, `documentUrl`, preset key, and (Others only, secondary) the provenance host/path.
- A suggestion matches when every whitespace-separated query token is a substring of at least one field.
- Order: groups always Hadden then Others; options keep curated order within a group (owner order for Hadden); a group with no matches is hidden.
- **Automatic activation**: when the text is not an absolute URL (no `scheme:`), the first match is activated automatically so that Enter commits it (never submits). When the text is an absolute URL, nothing is auto-activated, so Enter submits exactly what was typed — a typed stable URL such as `…/core/latest` can never be replaced by the `latest-unstable` suggestion.

| Query                                                         | Expected                                                                                                                           |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `core`                                                        | H3 active (and O-group hidden unless a packaged name contains "core")                                                              |
| `reference` / `ref data`                                      | H2                                                                                                                                 |
| `metadata` / `11179`                                          | H1                                                                                                                                 |
| `unstable`                                                    | H3, H4 (badge match)                                                                                                               |
| `foaf` / `xmlns`                                              | O1                                                                                                                                 |
| `https://haddenindustries.com/ontology/universal/core/latest` | H3 and H4 listed (URL substring), **none active**; Enter submits the typed `latest` URL                                            |
| `https://example.org/x.owl`                                   | No matches; list closes; Enter submits                                                                                             |
| `zzz`                                                         | No matches; message "No suggestions match. Enter a full URL starting with https://"; Enter shows that as a validation error (D-08) |

### 4.7 Keyboard, pointer and touch behaviour

Advisory basis: APG combobox pattern (keyboard model; "DOM focus remains on the combobox" while options are active) \[SPEC]. Normative basis: WCAG 2.1.1, 2.1.2, 2.4.3, 2.4.7, 3.2.1, 3.2.2, 4.1.2. Everything else is an application design choice.

**Enter**

| ID  | Condition                                             | Behaviour                                                                                                                                                                                  |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1  | IME composition active (`event.isComposing`)          | Ignore; let the IME commit text                                                                                                                                                            |
| E2  | Popup open and an option active                       | `preventDefault()` (suppresses implicit submission), commit that option, close popup, keep focus in the field, announce "Selected <name>. Press Enter or Visualize to load." — **no load** |
| E3  | Popup open, no active option, text is an absolute URL | Close popup, then normal submission (normalise, validate, route)                                                                                                                           |
| E4  | Popup closed                                          | Normal submission — this is the keyboard equivalent of Visualize                                                                                                                           |
| E5  | Text is a bare word with no matches                   | Validation error (D-08), no load                                                                                                                                                           |
| E6  | Key auto-repeat (`event.repeat`) after E2             | Ignore, so one long press cannot commit and then submit                                                                                                                                    |

**Other keys**: Down — open and activate first (or next) option; Up — open and activate last (or previous); Alt+Down — open without activating; Alt+Up — close; Escape — if the popup is open, close it and stop the event so the containing sheet stays open (verify close-request behaviour per engine, §9); if closed, let it close the Ontology menu as today, never clearing the text; Tab/Shift+Tab — close the popup without committing; Home/End and character keys — ordinary text editing; Backspace/Delete — ordinary editing (may un-commit by rule §4.4).

**Pointer and touch**: `pointerdown` on an option calls `preventDefault()` so the field keeps focus; `click` commits (no load). Focus stays in the field after a commit — moving it to Visualize would be a change of context under 3.2.2 (WCAG defines focus changes as context changes). On touch, the sheet keeps the field, summary and Visualize above the on-screen keyboard using the existing visual-viewport variables, and the list scrolls in the remaining space. Option rows are at least 44 px tall (exceeds 2.5.8's 24 px minimum; matches the toolbar's existing 44 px controls). Opening on pointer focus of an empty field aids discoverability on touch; keyboard focus does not auto-open (announced hint: "10 suggestions; press Down Arrow").

**Browser autocomplete**: change `autocomplete="url"` to `autocomplete="off"` on this field so the browser's history dropdown does not compete with the listbox; any value a browser still inserts arrives as an `input` event and follows the same rules. Verify per engine.

**Native URL-input constraints**: with `type="url"` and `required`, interactive validation would flag scheme-less text such as `example.org/x.owl` as a type mismatch; today the keydown and click handlers normalise before implicit submission so native validation sees the normalised value (C-4). The chooser keeps that ordering — its Enter handler runs first — and when E2 commits a suggestion its `preventDefault()` also stops native validation from firing on half-typed text. The HTML value-sanitisation step for URL inputs strips line breaks and leading/trailing whitespace (per the HTML standard; not re-verified in this run), which is consistent with the exact-equality commitment rule.

**Caret and selection APIs**: `setSelectionRange`/`selectionStart` are available on `type="url"` \[SPEC MDN], but this design does not need them: list autocomplete never writes partial completions into the field (no `aria-autocomplete="both"`), so there is no inline completion to select. After a commit the caret moves to the end (default value-setter behaviour).

### 4.8 Empty, no-match, validation and error states

| State                                                   | Presentation                                                                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Empty, unfocused                                        | Placeholder "Choose a suggestion or paste a URL"; Visualize disabled (D-17 keeps today's native-disabled behaviour)                |
| Empty, popup open                                       | Full grouped list                                                                                                                  |
| No match                                                | List hidden; hint "No suggestions match. Enter a full URL starting with https://"                                                  |
| Invalid URL                                             | Existing error text after change/Enter/submit; focus stays/returns to the field                                                    |
| Network/parse failure                                   | Existing loading error presentation; field keeps the submitted text (3.3.7 Redundant Entry) and shows the last error when reopened |
| Format choice required                                  | Existing `requestCanonicalRemoteFormat` dialog; unchanged                                                                          |
| Load superseded (another load, agent load, hash change) | Chooser renders the controller's current source; never re-submits by itself                                                        |

### 4.9 Bookmark and share-link compatibility (separate from the chooser)

| Route                                                                                               | Today                                          | After the chooser                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `#foaf`, `#goodrelations`, `#muto`, `#ontovibe`, `#personasonto`, `#sioc`, `#benchmark`, empty hash | Preset load                                    | Unchanged (anchors with matching `id`s disappear, which only removes a no-op scroll target)                              |
| `#iri=…`, `#url=…`                                                                                  | Explicit loads                                 | Unchanged; Hadden suggestions write `#iri=`                                                                              |
| `#file=…`, `#new_ontologyN`, `#opts=…;#…`                                                           | As today                                       | Unchanged                                                                                                                |
| Share links from Export                                                                             | `#opts=…;#url=<packaged absolute>` for presets | Unchanged; the deployment-bound preset share link remains a pre-existing limitation (C-11), not introduced or fixed here |

No new hash vocabulary is introduced. Short preset keys for Hadden entries (for example `#core`) would be a new public route contract and are not proposed.

### 4.10 Capabilities kept within current authority

Upload (file input, drag-and-drop), Create new ontology (editor-mode gated), Paste ontology document and Ontology facts keep their controls, gating and handlers. The chooser adds no agent capability: loading by URL is already a WebMCP action; the curated list is presentation (AH-10 asks whether the owner wants agents to list it).

## 5. Details: alternatives

| Criterion              | 1. Adaptive on-demand inspector (minimal)                                                                         | 2. Contextual preview + full details                                                             | 3. Hybrid (recommended)                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Shape                  | Existing panel becomes a sheet/drawer below a docking threshold; closed by default; a one-line selection peek bar | In-graph preview grows from the node; Details opens a full surface; no persistent panel anywhere | 2, plus the docked inspector retained (opt-in) on wide screens and always for editor mode |
| Graph occlusion        | Peek bar only; full sheet covers graph while open                                                                 | Preview card occludes a local area; full details modal on compact                                | As 2 on compact; wide screens can read details beside the live graph                      |
| Perceived connection   | Weak (bar at screen edge)                                                                                         | Strong (morph from node)                                                                         | Strong                                                                                    |
| Discoverability        | Needs a labelled entry point; panel content familiar                                                              | Selection itself reveals content; needs Overview chip for ontology metadata                      | Both                                                                                      |
| Real desktop workflows | Kept (panel)                                                                                                      | Lost: comparing entities while clicking around; editing beside the graph                         | Kept where it matters (wide screens, editor mode)                                         |
| Keyboard/SR            | Simple (panel landmark)                                                                                           | Needs careful focus model                                                                        | Same as 2, plus landmark panel on wide screens                                            |
| New seams              | None                                                                                                              | Anchor geometry; renderer decoration                                                             | Same as 2                                                                                 |
| Cost/risk              | Low (CSS, presenter, small JS)                                                                                    | High                                                                                             | High, but slices land independently                                                       |

**Recommendation: 3 (hybrid).** It fulfils the owner's graph-first direction on every screen, gives tap → richer preview → complete details, and keeps the persistent panel only where a workflow benefits: wide-screen comparison and the existing editor (whose redesign is out of scope by owner instruction recorded in ADR 0012).
**Fallback: 1.** If the anchor-geometry seam or motion budget proves too costly, ship slices B1–B3 and B4 of §9 without B5/B6: the preview becomes a docked peek card (no morph, no anchoring), which still fixes the 95 px problem and the "tap shows nothing" problem.

## 6. Details: recommended design

### 6.1 Surfaces

| Surface           | Compact (no docking)                                                                                                                                                                                                                                                        | Wide (docking permitted)                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Entity preview    | Card docked to the top or bottom edge (whichever does not cover the selected occurrence), content-sized, with a height cap (initial proposal ≈40% of the visual viewport, to be calibrated in usability testing — not a universal value); selected node keeps a strong halo | Floating card adjacent to the selected occurrence, never covering it, flipping/shifting to stay in view      |
| Full details      | Modal dialog sheet (native `<dialog>` + `showModal`)                                                                                                                                                                                                                        | Docked inspector panel (non-modal `complementary` region) if open or pinned; otherwise the same modal dialog |
| Ontology overview | Modal dialog sheet from the Overview chip                                                                                                                                                                                                                                   | Inspector "Ontology" section, or the dialog                                                                  |
| Editor mode       | Existing editing panel presented as a full-height sheet                                                                                                                                                                                                                     | Existing docked editing panel (unchanged content and authority)                                              |

### 6.2 Entry points and labels

- **Title chip** (top-left, replacing nothing functional; the version logo can move into About): current ontology title, truncated with the full title as accessible name, plus a visible **Overview** button.
- **Details** button in the preview, accessible name "Details for <entity name>". No unexplained ellipsis.
- **Close** buttons labelled; Escape closes the topmost surface.
- The existing sidebar toggle gains an accessible name ("Show details panel"/"Hide details panel") and `aria-expanded` wherever it remains.

### 6.3 Information model

All content comes from controller operations — `getOntologySummary`, `describeOntologyElements`, `getOntologyFacts` — never from the SVG or renderer objects (ADR 0010 decision 1).

**Ontology overview**: title; IRI (link); version information; authors; language selector (moved from the panel; it changes `view.language` through the existing control); description; annotations/metadata; statistics (classes, object properties, datatype properties, individuals, nodes, edges — visible-graph counts labelled as such); source provenance (`source.kind`, identity, display name, SHA-256 where present); warnings; links to Ontology facts and to the source for reload.

**Entity preview** (budgeted; each line truncates with the full value in Details):

| Kind                                              | Lines (in order)                                                                                                                                                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any                                               | Display label (selected language); kind/type badge (for example "Class", "External class", "Object property", "Datatype"); compact IRI (prefixed form when a prefix is known, else middle-truncated; full IRI in Details); first sentence of comment/definition |
| Class                                             | Superclasses (up to 2 + "and N more"); individuals count; disjoint count                                                                                                                                                                                        |
| Property                                          | Domain → Range (labels); characteristics; inverse                                                                                                                                                                                                               |
| Datatype / literal                                | Datatype IRI; facets if any                                                                                                                                                                                                                                     |
| Individual                                        | Types                                                                                                                                                                                                                                                           |
| Anonymous construct (set operators, restrictions) | Constructor kind ("Union of", "Intersection of", "Complement of") with operand labels; "Anonymous — no IRI"                                                                                                                                                     |
| Multiple semantic roles                           | Role switcher (segmented control) listing every role from `selection`; never only the first (fixes D-5)                                                                                                                                                         |
| Repeated occurrences                              | "Drawn N times" note; occurrence identity used only for anchoring                                                                                                                                                                                               |
| Not drawn (hidden/details-only)                   | "Not shown in the current view" and Details only                                                                                                                                                                                                                |

**Full details**: every field of every description in `selection` (one section per role, with headings), including all annotations grouped by property with language tags, relations as links that select the related entity (through the controller), characteristics, cardinality records, equivalents, disjoints, individuals, sub/super properties, inverse, and a link to retained facts (Ontology facts) — entity-scoped once AH-6 is resolved, section-level until then. Long IRIs wrap at path separators; nothing is truncated in this surface.

### 6.4 The owner's shape rule versus a content rule

The owner proposed: circular nodes expand to a larger circle with a few attributes, then an explicit control opens full details; rectangular nodes expand once, on the assumption that they carry fewer attributes.

What the shapes actually are [SRC [`src/webvowl/js/elements`](../../src/webvowl/js/elements)]: **round** — `owl:Class`, external, deprecated and equivalent classes, `owl:Thing`, `owl:Nothing`, `rdfs:Class`, `rdfs:Resource`, and the set operators (union, intersection, complement, disjoint union, via `SetOperatorNode` → `RoundNode`); **rectangular nodes** — only `rdfs:Datatype` and `rdfs:Literal` (`DatatypeNode` → `RectangularNode`); **property labels** — also drawn as rectangles (`BaseProperty` label `rect`), although VOWL does not call them nodes. Individuals are not drawn as nodes; they appear in class details.

|                   | S. Shape rule (owner)                                                                                                                                                                                                     | C. Content rule                                   | H. Shape-styled, content-sized, constant Details (recommended)                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Levels            | Circles 2, rectangles 1                                                                                                                                                                                                   | 1 when everything fits the preview budget, else 2 | Always preview + Details; small entities' previews are already complete                                                  |
| Fit to data       | Datatype rectangles do have few facts; **property labels are also drawn as rectangles** (BaseProperty `rect`) and usually carry more facts than classes (domain, range, inverse, sub/super, characteristics, cardinality) | Exact                                             | Exact                                                                                                                    |
| Predictability    | High for sighted users who learn the shapes; invisible to screen-reader users, for whom shape is not exposed                                                                                                              | Lower: the Details control appears and disappears | High and modality-independent                                                                                            |
| Keyboard/SR route | Differs by shape                                                                                                                                                                                                          | Differs by content                                | Identical for every entity                                                                                               |
| Occlusion         | Single-level property previews must show everything in-graph → largest in-graph surfaces exactly where the graph is densest                                                                                               | Bounded                                           | Bounded                                                                                                                  |
| Owner intent kept | Literal                                                                                                                                                                                                                   | Partially                                         | Visual metaphor kept (circles grow as circles, rectangles as rectangles); "one level" holds in effect for small entities |

**Recommendation H**, pending decision D-10, with D-11 asking whether "rectangular nodes" was meant to include property labels.
If the owner keeps S, the safe implementation is: rectangles' single level is a scrollable, complete card with a hard size cap and a Details route still available to keyboard and screen-reader users.

On circles specifically: the largest axis-aligned text block inside a circle of radius r is its inscribed square, area 2r² — about 64% of the disc (πr²) and 50% of its bounding square (4r²). An illustrative estimate, to be measured rather than relied on: a circle about 240 px across has an inscribed square of about 170 px, enough for a name plus three or four short attribute lines, and is already roughly two-thirds of a 375 px phone width. H therefore keeps the circle as the **start** of the morph (border-radius 50% → card radius) and as a decorative ring around the node, while the content sits in a rounded card. A literal circular preview is offered as a wide-screen-only variant (D-12).

### 6.5 Docking rule (no universal percentage)

Docking is permitted only when the canvas left after docking stays at or above a **minimum usable canvas width**, initially calibrated to today's behaviour (docking allowed above 1024 px viewport width, the existing `sidebar.setup` threshold) and to be tuned by usability testing, plus a minimum height for landscape phones.
The inspector's width stays content-driven (today's 280/320/360 px tokens) and must reflow at 200% zoom and with WCAG 1.4.12 text spacing; at 320 CSS px equivalent it is never docked.

### 6.6 Motion

- Open: FLIP — measure the selected occurrence's screen box (from published geometry, AH-1) and the card's final box; animate the card from the node's box to its own with `transform` and `opacity` (initial proposal ≈180–240 ms with a standard easing, for motion review rather than specification); the ring around the node scales out in SVG as a renderer-local decoration (AH-3).
- Preview → Details: on wide screens, the card hands off to the inspector (cross-fade + translate); on compact, the sheet rises from the card's edge.
- Close: reverse from the current animated position (Web Animations `reverse()`), never from the start.
- Reduced motion (`prefers-reduced-motion: reduce`): no scale or translate; ≤100 ms opacity change or instant; existing 0.5 s panel transitions disabled too.
- Animations only touch `transform`/`opacity` of HTML in the overlay layer; browsers may composite these, but no hardware acceleration is assumed — it is a performance-thread verification item (PH-2).

## 7. Interaction, state and ownership rules

### 7.1 Details state model

States: `Closed`, `PreviewOpening`, `PreviewOpen`, `DetailsOpening`, `DetailsOpen`, `Closing`, plus an orthogonal `Overview` surface.

| Event                                                                                                                                                                                                                                                                          | From                         | To                                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| selection published (non-empty, current generation)                                                                                                                                                                                                                            | Closed / Closing             | PreviewOpening                                      | Animate from anchor; if anchor unavailable, open without morph                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| selection changed to another entity                                                                                                                                                                                                                                            | PreviewOpen / PreviewOpening | PreviewOpen (content swap)                          | Cross-fade content; re-anchor; no close/open cycle                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| selection cleared (re-click on the selected node, the card's Close button, or Escape while focus is in the card or on the page body rather than inside another widget — both report "selection cleared" through `selectVisualizationElement` with a null reference — or Reset) | Preview*                     | Closing → Closed                                    | Reverse animation. The preview is visible exactly when the controller's `selection` is non-empty, so no hidden "dismissed" state exists. Today a background tap does **not** clear selection (`focuser.reset()` is called only from `selectOccurrence` and `resetVisualization` [SRC [`renderedGraphInternals.js:755`](../../src/webvowl/js/runtime/renderedGraphInternals.js#L755), [`:2217`](../../src/webvowl/js/runtime/renderedGraphInternals.js#L2217)]); making it do so is decision D-18 |
| Details activated                                                                                                                                                                                                                                                              | PreviewOpen                  | DetailsOpening → DetailsOpen                        | Focus to the details heading                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Back                                                                                                                                                                                                                                                                           | DetailsOpen                  | PreviewOpen                                         | Focus to the Details button                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Close / Escape                                                                                                                                                                                                                                                                 | DetailsOpen                  | Closed (selection kept)                             | Focus restored (§7.5)                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| load starts / generation changes                                                                                                                                                                                                                                               | any                          | Closed immediately (no animation)                   | Generation-scoped references become invalid                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `documentRevision` or language changes                                                                                                                                                                                                                                         | Preview*/Details*            | same state, refreshed content                       | Keep scroll position and focus where the element still exists                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| entity becomes hidden (filter, node count, neighbourhood retired)                                                                                                                                                                                                              | Preview*                     | PreviewOpen in "not shown" mode                     | Details remains available                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| orientation/resize/visual-viewport change                                                                                                                                                                                                                                      | any                          | same                                                | Recompute placement; no animation                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| drag of the selected node starts                                                                                                                                                                                                                                               | PreviewOpen                  | PreviewOpen (card faded to 30% and non-interactive) | Restore on drag end                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| any new event during an animation                                                                                                                                                                                                                                              | *Opening / Closing           | target state of the latest event                    | Animations are cancelled or reversed; nothing queues                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### 7.2 Active layout

The graph is not assumed stationary (D-13): after load it relaxes; resume restarts motion; drags move nodes.
The preview is anchored by **hysteresis**, not per-tick following: the card is placed once; it re-places only when the selected occurrence leaves a keep-clear region or would be covered, with a short ease (instant under reduced motion).
On compact the card is edge-docked, so layout motion only moves the node and its ring.
Anchor geometry must come from published facts (node coordinates + viewport transform), never from `getBoundingClientRect` on SVG elements during ticks (AH-1, PH-1).

### 7.3 Ownership invariants

1. Ontology facts come only from the controller's inspection operations (ADR 0010 §1).
2. Preview open/closed, card placement and animation state are presentation state; they never enter controller state, the VOWL document, arrangement, pins, saved layout or exports.
3. Opening, updating or closing a preview never calls pause/resume or any simulation operation; selection already has no reheat path (D-11) and must keep none.
4. The UI reports facts to the controller (an element was selected) and the runtime decides visible consequences; the preview does not call renderer operations directly (memory rule; ADR 0012).
5. Every preview holds `{loadGeneration, ontologyElementReferences, occurrence reference}` and closes when any of them is stale.
6. The decorative ring is renderer-local, like the selected halo, and excluded from SVG/canonical export.
7. Drag, pan, zoom, pick-and-pin, pause/resume, editing (inline label edit hides the preview while editing), temporary neighbourhoods, cancellation and exports behave exactly as today.

### 7.4 Edge cases

| Case                                                 | Behaviour                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node near a viewport edge                            | Card flips to the opposite side, then shifts; never covers the node box plus margin; on compact chooses top or bottom edge accordingly                                          |
| Node partly or wholly off-screen (pan, zoom)         | Card stays; shows "Off-screen" chip with a "Show in graph" button that asks the controller to centre (existing zoom/center semantics; no automatic camera move)                 |
| Long labels / IRIs                                   | Preview: two-line clamp for labels, middle-truncated IRI with full value in Details and as accessible text; Details: wrap at separators, copy button                            |
| Dense graph                                          | Card placement prefers empty quadrants using occurrence positions; ring drawn above links but below the card                                                                    |
| Rapid selection                                      | Latest wins; describe calls coalesced to one per animation frame; no animation queue                                                                                            |
| Interrupted transition                               | Reverse/cancel from current position (§6.6)                                                                                                                                     |
| Load or edit while open                              | Load: close immediately; edit: refresh in place (§7.1)                                                                                                                          |
| Orientation change / on-screen keyboard              | Re-place without animation using visual-viewport metrics                                                                                                                        |
| Multiple occurrences                                 | Anchor to the tapped occurrence; "Drawn N times"; Details lists counts; focus highlight follows existing focus semantics                                                        |
| Multiple semantic roles                              | Role switcher; all roles in Details                                                                                                                                             |
| Hidden/details-only entity (search result not drawn) | Preview in "not shown" mode, no anchor, Details available; reveal through existing neighbourhood action                                                                         |
| Selected element removed by edit                     | Close preview; announce "Selection removed"                                                                                                                                     |
| Agent (WebMCP) selects an element                    | Same preview as a human selection (ADR 0012 parity): agent selection reaches `graph.selectOccurrence` → `focuser` → controller `selection`, which the presenter already renders |
| Reset (human or agent)                               | Reset clears focus and selection (ADR 0012), so the preview and details close through the ordinary selection-cleared path                                                       |
| Focus restoration                                    | §7.5                                                                                                                                                                            |

### 7.5 Focus model

- Pointer selection: focus is not moved (no context change); the preview is announced by a polite status message ("Person, class. Details available.") (4.1.3).
- Keyboard selection (search result, future graph keyboard navigation): focus moves to the preview's heading only when the reader chose the result with Enter; Escape returns focus to the origin.
- Details (modal on compact): initial focus on the dialog heading (`tabindex="-1"`, APG advice for structured content); Tab cycles within; Escape closes; focus returns to the Details button, or, if the preview has closed meanwhile, to the title chip or the search field (APG: return to the invoker unless it no longer exists).
- Docked inspector (wide): non-modal; focus moves to its heading on open; F6-style landmark navigation not required; Escape returns to the invoker.
- The preview card is never a focus trap and is never `aria-modal`.
- WCAG 2.4.11 applies to keyboard-focusable components. Graph nodes are not keyboard-focusable today (AH-9); the placement rule keeps the selected node uncovered regardless, and the card must never cover the focused control (search field, chooser, toolbar) that originated a selection. Conformance is a verification item, not a property of this design.

## 8. Browser primitives and progressive enhancement

### 8.1 Support matrix against the project's target (`baseline widely available`)

| Primitive                                                                                                          | Status found                                                                                                                                         | Within target?                                                     | Use                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `<dialog>` + `showModal`, `inert`, `:focus-visible`, `prefers-reduced-motion`, Web Animations API, CSS transitions | Long-established; widely-available status **not re-verified in this run**                                                                            | Expected yes — confirm against Baseline data before implementation | Mandatory path                                                                                       |
| Popover API                                                                                                        | Already used by the app; Baseline date **not re-verified in this run** (believed newly available in 2024, so near the widely-available boundary now) | Confirm                                                            | Existing usage only; no nested popovers (C-13)                                                       |
| `dialog closedby`                                                                                                  | Chrome 134, Firefox 141; not Safari \[SEC caniuse/MDN]                                                                                               | No                                                                 | Existing facts dialog's use degrades to Escape-only on Safari; acceptable as enhancement             |
| Same-document View Transitions                                                                                     | Baseline 2025 newly available since October 2025 \[SPEC MDN]                                                                                         | No                                                                 | Optional enhancement only (D-14)                                                                     |
| Element-scoped View Transitions                                                                                    | Chrome 147 stable (April 2026); MDN "limited availability" \[SEC]                                                                                    | No                                                                 | Not used                                                                                             |
| CSS anchor positioning                                                                                             | Baseline newly available January 2026 (Chrome 125, Safari 26, Firefox 147) \[SEC]                                                                    | No                                                                 | Not required; also cannot anchor to SVG-internal nodes \[INF — verify]; JS placement is the baseline |
| `setSelectionRange` on `type="url"`                                                                                | Supported (text, search, url, tel, password) \[SPEC MDN]                                                                                             | Yes                                                                | Not needed (no inline completion)                                                                    |

### 8.2 View Transitions assessment

Relevant facts: transitions animate **snapshots** (the old state is a static image) and the `::view-transition` tree "sits above all other page content"; duplicate `view-transition-name`s make `ready` reject and skip the transition; a hidden document skips the transition \[SPEC MDN Using guide].
Not established in this run (verify against the CSS View Transitions spec before any adoption): behaviour when a second transition starts mid-flight, pointer hit-testing during the overlay, and whether SVG-internal elements can participate.
Consequences for this design: a document-level transition that captures the graph would show a still-moving graph as a static image for its duration, and its overlay may intercept drag/pan input (unverified). Mid-flight reversal is not a documented operation in the material reviewed, whereas a Web Animation on the card can be reversed or cancelled from its current position.
Verdict: not for the node→preview morph. Possibly acceptable later for the **preview → full details** hand-off, whose endpoints are both HTML, as a progressive enhancement with the same Web Animations path as fallback.

### 8.3 Native-control alternatives for the chooser

| Option                                        | Verdict                                                                                                                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<input type="url" list>` + `<datalist>`      | Rejected as primary: no groups or badges, browser-dependent label/value display, competes with a custom popup. It is the only way to get an _implicit_ combobox role on `type="url"`, which is why D-03 option (a) uses the textbox role instead. |
| Customisable `<select>`                       | Rejected: not editable, so it reproduces the current two-control split.                                                                                                                                                                           |
| `type="text" inputmode="url" role="combobox"` | Fully APG-conforming, but abandons the genuine URL input the owner asked to keep; offered as D-03 option (c).                                                                                                                                     |
| `type="url" role="combobox"`                  | Works in practice but non-conforming under ARIA in HTML; D-03 option (b), not recommended.                                                                                                                                                        |

### 8.4 Assessment of the earlier suggestions (B5)

| Earlier idea                                           | Assessment                                                                                                                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foreground preview separate from force-layout geometry | **Adopt.** Matches ADR 0010 (renderer holds only drawing facts) and avoids reheating or persisting size. Correction: anchoring needs a published geometry fact, not DOM measurement (AH-1).                |
| Full details in semantic HTML                          | **Adopt.** Existing precedent: the facts dialog. Also fix heading semantics (D-6).                                                                                                                         |
| Labelled Details control instead of an ellipsis        | **Adopt.** Also label the existing sidebar toggle (D-3).                                                                                                                                                   |
| Reduced-motion behaviour                               | **Adopt**, including the existing panel transitions that currently ignore it (D-7).                                                                                                                        |
| Adaptive sidebar as lower-change alternative           | **Adopt as fallback (option 1)**. Correction: the panel already starts hidden on ≤1024 px; the fix is "never side-by-side below the docking threshold" plus a selection peek, not merely a narrower width. |

## 9. Implementation plan (small slices; none authorised)

Every slice is test-first (owner rule), lands independently, and keeps the application releasable.

| Slice                                             | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Depends on | Key tests                                                                                                                                                    |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A1** Suggestion catalogue                       | Pure module: groups, options, badges, exact URLs; packaged URLs via `canonicalExampleSource`; matching function                                                                                                                                                                                                                                                                                                                                                                    | —          | Exact strings for H1–H4; order; matching table §4.6; no alias rewriting                                                                                      |
| **A2** Submission seam                            | `submitOntologySource` (name TBD) used by chooser and search; commitment by exact equality; preset routing for packaged suggestions; keep failed text                                                                                                                                                                                                                                                                                                                              | A1         | Routes per §4.3 (including `http://localhost` packaged URL); search URL path unchanged; no synthetic events; ontologyMenu/loadingModule regressions          |
| **A3** Combobox UI                                | Field row, toggle, summary, inline grouped listbox, keyboard/pointer rules E1–E6, states §4.5; retire preset links and dead CSS. Note: the `--visual-viewport-*` metrics the sheet needs above an on-screen keyboard are currently maintained inside [`searchMenu.js:120-150`](../../src/app/js/menu/searchMenu.js#L120-L150) and [`:271`](../../src/app/js/menu/searchMenu.js#L271), so they are only fresh when search set them up; the chooser needs them independently (AH-11) | A1, A2     | Keyboard table; Escape layering with the popover; `aria-*` contract; html-validate passes using the existing inline-directive precedent for `role="listbox"` |
| **A4** Current-source reflection (optional, D-07) | Chooser renders the controller's accepted source when not focused or dirty                                                                                                                                                                                                                                                                                                                                                                                                         | A3         | Agent load and hash navigation update the summary without submitting                                                                                         |
| **B1** Overview on demand                         | Title chip + Overview surface reusing summary rendering; language control moves; sidebar toggle labelled                                                                                                                                                                                                                                                                                                                                                                           | —          | Overview contains all current panel fields; focus restore                                                                                                    |
| **B2** Adaptive surfaces                          | Docking rule; compact sheet presentation of the inspector; editor mode sheet on compact; reduced-motion CSS                                                                                                                                                                                                                                                                                                                                                                        | B1         | No layout leaves canvas narrower than viewport below threshold; 1.4.10/1.4.12 checks                                                                         |
| **B3** Selection presentation (no motion)         | Preview card in the overlay layer; edge-docked on compact, simple adjacent placement on wide; role switcher; generation safety                                                                                                                                                                                                                                                                                                                                                     | B2         | Multiple roles; stale generation closes; no layout/pin/viewport change (spies on runtime)                                                                    |
| **B4** Full details                               | Semantic HTML details (dialog/inspector), relation links via controller selection, facts link                                                                                                                                                                                                                                                                                                                                                                                      | B3         | Every description field rendered; heading structure; focus model §7.5                                                                                        |
| **B5** Anchor geometry + motion                   | Published anchor fact (AH-1); FLIP open/close/reverse; hysteresis placement                                                                                                                                                                                                                                                                                                                                                                                                        | B3, AH-1   | Interruption settles to latest state; reduced motion; performance thread budgets                                                                             |
| **B6** Renderer decoration (optional)             | Expansion ring as renderer-local decoration                                                                                                                                                                                                                                                                                                                                                                                                                                        | B5, AH-3   | Export excludes ring; seam conformance tests                                                                                                                 |

Fallback delivery = A1–A3 + B1–B4 with B3 docked-only.

## 10. Verification matrix

### 10.1 Regression suites tied to existing contracts

| Contract                          | Existing tests                                                                                                                                                                                                                                                                                                             | Additions                                                              |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| URL normalisation and routing     | [`src/app/js/menu/ontologyMenu.test.js`](../../src/app/js/menu/ontologyMenu.test.js)                                                                                                                                                                                                                                       | Commitment by equality; packaged preset routing; bare-word rule (D-08) |
| Location routes, preset semantics | [`src/app/js/loadingModule.test.js`](../../src/app/js/loadingModule.test.js)                                                                                                                                                                                                                                               | Unchanged expectations for presets, `iri=`, `url=`, `file=`            |
| Share links                       | [`src/app/js/controller/visualizationShareLink.test.js`](../../src/app/js/controller/visualizationShareLink.test.js)                                                                                                                                                                                                       | None (must stay green unchanged)                                       |
| Search URL path                   | [`src/app/js/menu/searchMenu.test.js`](../../src/app/js/menu/searchMenu.test.js)                                                                                                                                                                                                                                           | Uses the new submission function                                       |
| Popover focus/Escape              | [`src/app/js/menu/navigationMenu.test.js`](../../src/app/js/menu/navigationMenu.test.js)                                                                                                                                                                                                                                   | Escape in open list does not close the sheet                           |
| Summary and selection rendering   | [`src/app/js/sidebar.test.js`](../../src/app/js/sidebar.test.js), [`src/app/js/ui/controllerStatePresenter.test.js`](../../src/app/js/ui/controllerStatePresenter.test.js)                                                                                                                                                 | All roles rendered; preview presenter                                  |
| Generation scoping                | [`webVowlControllerContracts.test.js`](../../src/app/js/controller/webVowlControllerContracts.test.js), [`rendererElementReferences.test.js`](../../src/app/js/controller/rendererElementReferences.test.js), [`canonicalWebVowlController.test.js`](../../src/app/js/controller/canonicalWebVowlController.test.js)       | Preview closes on generation change                                    |
| Renderer seam and decoupling      | [`renderedGraphSeamConformance.test.js`](../../src/webvowl/js/runtime/renderedGraphSeamConformance.test.js), [`src/renderedGraphDecoupling.architecture.test.js`](../../src/renderedGraphDecoupling.architecture.test.js), [`d3RenderedGraphAdapter.test.js`](../../src/webvowl/js/runtime/d3RenderedGraphAdapter.test.js) | No UI→renderer call for preview; decoration contract                   |
| Selection and pinning             | [`src/shared/js/modules/focuser.test.js`](../../src/shared/js/modules/focuser.test.js), [`pickAndPin.test.js`](../../src/shared/js/modules/pickAndPin.test.js)                                                                                                                                                             | Unchanged                                                              |
| Exports                           | [`renderedSvgExportClone.test.js`](../../src/webvowl/js/runtime/renderedSvgExportClone.test.js), [`canonicalVowlDrawingExport.test.js`](../../src/app/js/controller/canonicalVowlDrawingExport.test.js)                                                                                                                    | Export identical with preview open/closed                              |
| Agent parity                      | [`src/app/js/webmcp/webMcpDetailConsistency.test.js`](../../src/app/js/webmcp/webMcpDetailConsistency.test.js) and siblings                                                                                                                                                                                                | Agent selection opens the same preview                                 |
| CSS                               | [`src/app/css/toolstyle.test.js`](../../src/app/css/toolstyle.test.js), [`src/initialPageStyles.test.js`](../../src/initialPageStyles.test.js)                                                                                                                                                                             | Reduced-motion rules; docking threshold                                |
| Real-browser lifecycle            | [`packages/vowl/test/browser/performance-search.html`](../../packages/vowl/test/browser/performance-search.html)                                                                                                                                                                                                           | Performance thread decides                                             |

### 10.2 Accessibility and real-browser verification

Design cannot establish conformance; these checks can.

| Check                                                                                                                         | Method                                                                             | Normative basis                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Keyboard-only chooser and details flows (E1–E6, §7.5)                                                                         | Scripted manual run in Chrome, Firefox, Safari                                     | 2.1.1, 2.1.2, 2.4.3, 2.4.7, 3.2.1, 3.2.2                                                                 |
| Screen readers: NVDA+Firefox, NVDA+Chrome, JAWS+Chrome, VoiceOver macOS Safari, VoiceOver iOS Safari, TalkBack Android Chrome | Announcements of active vs selected option, group labels, summary, status messages | 1.3.1, 4.1.2, 4.1.3                                                                                      |
| Zoom 200% and reflow at 320 CSS px                                                                                            | Browser zoom; narrow window                                                        | 1.4.4, 1.4.10 (graph canvas itself falls under the two-dimensional exception; panels and chooser do not) |
| Text spacing                                                                                                                  | Text-spacing bookmarklet                                                           | 1.4.12                                                                                                   |
| Focus visibility and non-obscured focus                                                                                       | Visual check with preview open                                                     | 2.4.7, 2.4.11                                                                                            |
| Target size                                                                                                                   | Measure option rows, chips, close buttons (≥24 px; design ≥44 px)                  | 2.5.8                                                                                                    |
| Non-drag alternatives                                                                                                         | Sheet drag-to-dismiss has a Close button                                           | 2.5.7                                                                                                    |
| Contrast of badges, focus rings, ring decoration                                                                              | Tooling plus manual                                                                | 1.4.3, 1.4.11                                                                                            |
| Reduced motion; forced colours (Windows contrast themes)                                                                      | OS settings                                                                        | 2.3.3 (AAA, advisory here); forced-colours is a design choice                                            |
| Moving content control                                                                                                        | Pause control remains available while preview open                                 | 2.2.2                                                                                                    |
| Escape layering inside the popover per engine                                                                                 | Manual in Blink, Gecko, WebKit                                                     | Design choice                                                                                            |

## 11. Decisions for the owner

| ID   | Decision                                                                                                                                                                       | Recommendation                                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | Route of an unedited packaged suggestion                                                                                                                                       | Keep the preset route (`#foaf`)                                                                                                                                                                                                                                  |
| D-02 | Exact-match commitment checked before `http→https` normalisation                                                                                                               | Yes (keeps development URLs working)                                                                                                                                                                                                                             |
| D-03 | Field semantics: (a) `type=url` textbox + list + toggle with `aria-expanded`; (b) `type=url role=combobox`; (c) `type=text role=combobox`                                      | (a)                                                                                                                                                                                                                                                              |
| D-04 | Display names: published titles vs curated short names                                                                                                                         | Published titles, category badge as the short name                                                                                                                                                                                                               |
| D-05 | Alias badge wording                                                                                                                                                            | Verbatim `latest` / `latest-unstable`                                                                                                                                                                                                                            |
| D-06 | Benchmark entry in development builds                                                                                                                                          | No entry; route kept                                                                                                                                                                                                                                             |
| D-07 | Field after submission                                                                                                                                                         | Keep submitted text; reflect current source when idle (A4 optional). This reverses an asserted behaviour ([`ontologyMenu.test.js:383-395`](../../src/app/js/menu/ontologyMenu.test.js#L383-L395) expects the field to be cleared), so it needs explicit approval |
| D-08 | Scheme-less bare words such as `core`                                                                                                                                          | Reject with guidance instead of fetching `https://core/`                                                                                                                                                                                                         |
| D-09 | Wide-screen default for the docked inspector                                                                                                                                   | Closed by default, pinnable; open in editor mode                                                                                                                                                                                                                 |
| D-10 | Shape rule S / C / H                                                                                                                                                           | H                                                                                                                                                                                                                                                                |
| D-11 | Do "rectangular nodes" include property labels? Only datatypes and literals are rectangular _nodes_; property labels are drawn as rectangles too and carry the most attributes | Owner to clarify                                                                                                                                                                                                                                                 |
| D-12 | Literal circular preview on wide screens                                                                                                                                       | Not in first delivery                                                                                                                                                                                                                                            |
| D-13 | `sidebar=1` on compact screens                                                                                                                                                 | Do not dock; open nothing automatically                                                                                                                                                                                                                          |
| D-14 | View Transitions                                                                                                                                                               | None in first delivery                                                                                                                                                                                                                                           |
| D-15 | `user-scalable=no` viewport meta                                                                                                                                               | Separate accessibility decision, out of this scope                                                                                                                                                                                                               |
| D-16 | Agent listing of curated suggestions                                                                                                                                           | Not needed (load-by-URL parity exists)                                                                                                                                                                                                                           |
| D-17 | Visualize disabled until valid                                                                                                                                                 | Keep (smallest change)                                                                                                                                                                                                                                           |
| D-18 | Should a background tap or click without drag clear the selection (and so close the preview)? It is new behaviour, and background presses also start pans                      | Yes for a press–release with no movement beyond the existing drag threshold, reported to the controller as "selection cleared"; owner to confirm                                                                                                                 |

## 12. Handoff questions

### 12.1 Architecture thread

- **AH-1** Anchor geometry: may the selected occurrence's screen-space centre, shape kind and extent be published as a frame-coalesced fact on a dedicated subscription (outside the frozen state broadcast), or should presentation derive it from arrangement coordinates plus the published viewport transform? Today positions are pull-only (`getVisualizationArrangement`).
- **AH-2** Should the selected rendered occurrence (now private `selectedEditorOccurrence`) be published, given ADR 0012's opaque, generation-scoped occurrence identity?
- **AH-3** Is a renderer-local "expansion ring" decoration acceptable under ADR 0010 decision 5 (halo-like, not outliving a mount), and where is its export exclusion enforced?
- **AH-4** Is the order of `selection` (from `flatMap` over semantic references) deterministic and independent of document order? The role switcher needs a stable, meaning-based order.
- **AH-5** `describeOntologyElements` keeps the first record per semantic key; confirm canonical snapshots have exactly one record per key so the result never depends on record order.
- **AH-6** Entity-scoped retained facts: should `getOntologyFacts` accept an entity reference so full details can link to that entity's evidence?
- **AH-7** Ownership and name of the shared submission function replacing `setIriText`'s synthetic events.
- **AH-8** Does an `iri=` load start automatic node-count selection? If not, should curated large ontologies (Reference Data 1.1 MB; Extended's import closure) request it, which would change explicit-route semantics?
- **AH-9** Is a keyboard path for selecting drawn occurrences planned? It determines whether the preview needs keyboard-originated anchoring beyond search.
- **AH-10** Does the owner want agents to list the curated sources (ADR 0012 parity reading)?
- **AH-11** Visual-viewport metrics (`--visual-viewport-height`, `--visual-viewport-offset-top`) are written by [`searchMenu.js`](../../src/app/js/menu/searchMenu.js). Should a shared viewport-metrics owner publish them for the chooser sheet, preview placement and details sheets?

### 12.2 Performance thread

- **PH-1** Cost of maintaining anchor geometry during relaxation for 1k/10k occurrences, computed from coordinates (no forced layout).
- **PH-2** Frame cost of animating an overlay card's `transform`/`opacity` over a continuously repainting SVG on low-end Android; verify compositing rather than assume it.
- **PH-3** `describeOntologyElements` latency for large ontologies under rapid selection; is per-frame coalescing sufficient?
- **PH-4** Time to first render and settle for H1–H4 closures (32 MiB / 30 s limits are not the concern; interactivity is).
- **PH-5** Whether the preview should suspend anchor updates while the tab is hidden or the layout is paused (expected yes).

## 13. Configuration changes

**None are required by this design.**
Candidates, each requiring explicit approval before any change:

| ID                                                  | File and setting                                                                                                                                                         | Effect                                                                                                     | Smallest change                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| CFG-1 (optional)                                    | `package.json` devDependencies, `package-lock.json`, a new test configuration and CI workflow — browser E2E/accessibility tooling (for example Playwright with axe-core) | Adds automated real-browser keyboard/ARIA checks to the pipeline; increases CI time and dependency surface | Defer; use manual real-browser runs (§10.2) first                                                                            |
| CFG-2 (not needed)                                  | [`vite.config.mjs`](../../vite.config.mjs) comment and release-strip block referencing the benchmark link                                                                | The release strip simply finds no block once the link is gone                                              | Leave unchanged                                                                                                              |
| CFG-3 (only if preferred over the inline directive) | `html-validate` configuration for `prefer-native-element`                                                                                                                | Would relax the rule repository-wide                                                                       | Prefer the existing inline-directive precedent in [`index.html:1736`](../../src/index.html#L1736) (not a configuration file) |

The `browserslist` target is unchanged; the design conforms to it by treating newer primitives as optional enhancements.

## 14. Skeptical second pass

Performed after drafting; corrections are already folded into the sections above.

**Discoverability.** Risk: removing the persistent panel hides ontology metadata. Mitigation: a visible title chip with a text **Overview** button rather than an icon-only control; selection itself now reveals information on compact screens where today it reveals nothing (D-4). Residual risk: readers who relied on the always-open desktop panel — addressed by pinning (D-9). Correction made: an earlier draft placed Overview only inside the Ontology menu; that mixes "choose an ontology" with "inspect this ontology" and was moved to the title chip.

**Graph occlusion.** Risk: a preview card covers the very node it describes, or the keyboard-focused node (2.4.11). Mitigation: placement never covers the anchor box; compact uses edge docking with top/bottom flip. Residual risk: very dense graphs at small zoom — no placement avoids all nodes; the rule protects the selected node only, and the card is dismissible. The literal circular lens was demoted to an optional wide-screen variant because its area grows with r² and its usable text area is ≈64% of its bounding square.

**Semantic ambiguity.** Risks found: (1) one rendered element can stand for several semantic references, and today only the first is shown — the design requires a role switcher and full listing; (2) "rectangular nodes" is ambiguous because property labels are rectangles — raised as D-11 rather than silently interpreted; (3) "latest" vs "latest-unstable" — badges are verbatim and the matching rules prevent a typed URL being replaced by a suggestion; (4) packaged examples are transformed artifacts — labelled "Packaged example", never as original documents.

**Accidental submission.** Risks found: (1) Enter on an active option — blocked by E2 and E6; (2) a bare word such as `core` normalising to `https://core/` — D-08; (3) auto-activation replacing a typed URL — automatic activation is disabled when the text is an absolute URL; (4) focus moving to Visualize after a tap would be a context change — rejected; (5) the search box's URL path — routed through the same submission function, still requiring Enter.

**Animation cost.** Risk: per-tick anchor following and DOM measurement on a moving SVG. Mitigation: hysteresis placement, coordinates instead of layout reads, animations on `transform`/`opacity` only, reduced-motion path, View Transitions excluded from the mandatory path. Residual: compositing behaviour is unverified (PH-2); no budget is claimed here.

**Preservation of existing capabilities.** Checked against: preset bookmarks and their semantics (D-01), `iri=`/`url=`/`file=`/`new_ontology`/`opts` routes, share links, upload and drag-drop, create (editor gated), paste, facts dialog, reload source, search's URL path, editor panel content and authority, pick-and-pin (pins only on drag), deselect-on-reclick (kept: a second tap on the selected node clears selection and closes the preview), double-tap edit on touch in editor mode (preview hides while inline editing), pause/resume, temporary neighbourhoods, exports, WebMCP selection parity, generation-scoped references. One deliberate behaviour change per decision: field no longer cleared after submit (D-07), bare words rejected (D-08), desktop panel closed by default (D-09), background tap clears selection (D-18), `autocomplete="off"`.

**Second-pass corrections made after the owner's static-only instruction.** (1) Every \[LIVE] statement was re-grounded in source or demoted to a non-load-bearing footnote. (2) A draft claim that a background tap clears selection was wrong — no such handler exists — and is now decision D-18. (3) Shape facts were checked in source: only datatypes and literals are rectangular nodes, while property labels are also rectangles (sharpening D-11). (4) Invented magnitudes (card height cap, motion durations, tab-stop counts) were relabelled as initial proposals or removed. (5) The 2.4.11 statement was narrowed: graph nodes are not keyboard-focusable today. (6) Baseline statuses not re-checked in this run are marked as such. (7) Wireframe entity content is marked illustrative, and a fabricated FOAF role example was replaced by a hypothetical placeholder.

**Claims withdrawn or downgraded during the pass.**

- "The input can be an ARIA combobox" — withdrawn after reading ARIA in HTML; replaced by D-03.
- "The bundled example URL can go through the existing submit handler" — withdrawn (http upgrade, preset semantics).
- "View Transitions are Baseline" — narrowed: same-document is newly available (Oct 2025), outside the project's widely-available target.
- "Anchor positioning can place the card" — downgraded to unverified for SVG anchors and outside the target.
- Availability of H1–H4 is verified for document retrieval only; end-to-end visualisation was not exercised because no local server could be started under the task boundaries.

## 15. Sources

Primary:

- WAI-ARIA APG combobox pattern — <https://www.w3.org/WAI/ARIA/apg/patterns/combobox/> (advisory; no normative status stated on the page).
- WAI-ARIA APG modal dialog pattern — <https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/> (advisory).
- WCAG 2.2, W3C Recommendation 12 December 2024 — <https://www.w3.org/TR/WCAG22/> (normative; status notes a future major version in development, no superseding Recommendation).
- ARIA in HTML, W3C Recommendation 11 August 2026 — <https://www.w3.org/TR/html-aria/> (normative authoring conformance for roles on `input type=url`).
- MDN View Transition API — <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API>, Using guide <https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using>, `Document.startViewTransition` (Baseline 2025, newly available since October 2025) <https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition>.
- MDN `HTMLInputElement.setSelectionRange` — <https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setSelectionRange>.

Secondary (re-verify before relying):

- Chrome 147 element-scoped view transitions — <https://developer.chrome.com/blog/element-scoped-view-transitions>, <https://developer.chrome.com/release-notes/147>, MDN <https://developer.mozilla.org/docs/Web/API/Element/startViewTransition>.
- CSS anchor positioning Baseline (January 2026) — <https://web.dev/blog/web-platform-01-2026>.
- `dialog closedby` support — <https://caniuse.com/mdn-html_elements_dialog_closedby>, MDN <https://developer.mozilla.org/docs/Web/API/HTMLDialogElement/closedBy>.

Repository contracts read: [ADR 0010](../adr/0010-rendered-graph-is-a-projection-not-the-store.md), [ADR 0012](../adr/0012-human-and-agent-visualization-action-parity.md), [`docs/webmcp.md`](../../docs/webmcp.md), [`docs/plans/exact-node-count-selector-implementation-plan.md`](../../docs/plans/exact-node-count-selector-implementation-plan.md), [`docs/designs/Performance-and-Search/implementation-qualification.md`](../../docs/designs/Performance-and-Search/implementation-qualification.md), [`src/app/data/canonical-example-notices.txt`](../../src/app/data/canonical-example-notices.txt); universal-ontology `docs/webmcp-ontology-entity-definition-lookup.md`, `scripts/build/ontologyAliases.js`.

## 16. Wireframes, storyboard and state diagrams

Textual and non-executable.
Proportions are indicative only; no pixel value here is a specification except where sections 0–15 state a measurable rule.
Numbers in circles in the annotations, such as (1), refer to the notes under each frame.

Entity names and facts shown inside frames (for example "Person", its superclasses and disjoints) are **illustrative placeholders**, not values verified against the packaged FOAF artifact. Option names, badges and URLs in §16.1 are the verified inventory from §4.2.

Legend: `[ Button ]` button · `[____]` text field · `( )` badge · `▸`/`▾` toggle · `✓` committed · `»` keyboard-active option · `◯` round node · `▭` rectangular node or property label · `◎` selected node with decorative ring · `░` graph content.

### 16.1 Ontology chooser

#### 16.1.1 Compact sheet, field empty, list closed

```text
┌─────────────────────────────────────┐
│               ───                   │  sheet handle (drag-to-dismiss has
│ Ontology                        [×] │  a Close button: WCAG 2.5.7)
├─────────────────────────────────────┤
│ Ontology URL                    (1) │
│ [Choose a suggestion or paste a U ▾]│ (2)
│ Enter an ontology URL           (3) │
│ [ Visualize ]  (disabled)       (4) │
│ ─────────────────────────────────── │
│ [ Select ontology file ] [ Upload ] │ (5)
│ [ Create new ontology ] (disabled)  │
│   Enable editing in Modes menu …    │
│ [ Paste ontology document ]         │
│ [ Ontology facts ]                  │
└─────────────────────────────────────┘
```

1. Visible label; the input keeps `type="url"`, implicit textbox role (D-03 a).
2. The chevron is the **Show suggestions** button (`aria-expanded`, `aria-controls`), ≥44 px target.
3. Existing polite hint line, reused for validation and status.
4. Visualize keeps today's native-disabled state when the value is not normalisable (D-17).
5. Everything below the rule is unchanged in behaviour and gating.

#### 16.1.2 List open (Show suggestions, Down Arrow, or tap on the empty field)

```text
┌─────────────────────────────────────┐
│ Ontology URL                        │
│ [                                 ▴]│
│ ┌─────────────────────────────────┐ │
│ │ HADDEN INDUSTRIES           (1) │ │
│ │  ISO/IEC 11179-3:2023 Ontology  │ │
│ │  (Metadata) (alias latest)      │ │
│ │  haddenindustries.com/…/latest  │ │
│ │  Hadden Industries Universal    │ │
│ │  Reference Data Ontology        │ │
│ │  (Reference Data) (alias latest)│ │
│ │  Hadden Industries Universal    │ │
│ │  Core Ontology                  │ │
│ │  (Core) (alias latest-unstable) │ │
│ │  Hadden Industries Universal    │ │
│ │  Extended Ontology              │ │
│ │  (Extended)(alias latest-unst…) │ │
│ │ Others                      (2) │ │
│ │  Friend of a Friend (FOAF) …    │ │
│ │  (Packaged example)             │ │
│ │  GoodRelations Vocabulary …     │ │
│ │  …  MUTO · OntoViBe ·           │ │
│ │     PersonasOnto · SIOC         │ │
│ └─────────────────────────────────┘ │
│ 10 suggestions. Use Up and Down…(3) │
│ [ Visualize ]                       │
└─────────────────────────────────────┘
```

1. Hadden group first; prominence by heading size/weight and a group surface, not colour alone (1.4.1). Owner order. URL line shown in a smaller monospace line and included in the option's description.
2. Others group with plain heading. All rows ≥44 px.
3. Hint text announces the count once; the list is rendered **inline inside the sheet** (no nested popover: WebKit focus-loop workaround in `navigationMenu.js`).

#### 16.1.3 Typing "core": first match auto-activated, nothing committed

```text
│ [core                             ▴]│
│ ┌─────────────────────────────────┐ │
│ │ HADDEN INDUSTRIES               │ │
│ │» Hadden Industries Universal    │ │  (1)
│ │  Core Ontology                  │ │
│ │  (Core) (alias latest-unstable) │ │
│ └─────────────────────────────────┘ │
│ 1 suggestion. Enter selects it.     │
```

1. `»` = active (`aria-activedescendant`), outlined, **not** selected. The field still says `core`. Enter now commits (E2) and does not load.

#### 16.1.4 Committed suggestion

```text
│ [https://haddenindustries.com/ont…×]│ (1)
│ ✓ Core · Hadden Industries Universal│ (2)
│   Core Ontology · alias latest-unst…│
│ Selected. Press Enter or Visualize… │ (3)
│ [ Visualize ]                       │ (4)
```

1. The field holds the exact URL `…/universal/core/latest-unstable`; caret at the end; Clear button appears.
2. Summary line separate from the field, referenced by `aria-describedby`; the option carries `aria-selected="true"` when the list reopens.
3. Polite status; focus stays in the field (no context change, 3.2.2).
4. Second Enter (no active option) or Visualize submits → `#iri=https://haddenindustries.com/ontology/universal/core/latest-unstable`.

#### 16.1.5 Edited after commit

```text
│ [https://haddenindustries.com/ont…×]│  value now …/core/latest
│ Custom URL                          │  (1)
```

1. Any difference from the committed URL drops the commitment and `aria-selected`. Restoring the exact text re-commits. A typed absolute URL is never replaced by a suggestion (no auto-activation for absolute URLs).

#### 16.1.6 No match, invalid, and failed load

```text
│ [zzz                              ▾]│
│ ⚠ No suggestions match. Enter a     │  (1)
│   full URL starting with https://   │
```

```text
│ [https://example.org/missing.owl  ▾]│  (2)
│ ⚠ Last attempt failed: The ontology │
│   could not be fetched.             │
│ [ Visualize ]                       │
```

1. Bare word: validation error instead of fetching `https://zzz/` (D-08). Icon plus text plus `aria-invalid`; not colour alone.
2. After a failed load the reader reopens the menu and finds the submitted text intact (3.3.7) with the controller's error message; focus is placed in the field.

#### 16.1.7 Desktop popover variant

Same structure inside the existing anchored popover (wider, two-column option rows: name and badges left, URL right). The list is still inline in the popover content.

### 16.2 Details — compact portrait (≈375 × 812)

#### 16.2.1 Graph only

```text
┌─────────────────────────────────────┐
│ [FOAF vocabulary ▾ Overview]    (1) │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░◯░░░░░░░◯░░░░░░▭░░░░░░░░░░░░░ │
│ ░░░░░░░░◯░░░░░░░░░░░░░░░◯░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  full-width canvas: no panel
│ ░░░░░░▭░░░░░░◯░░░░░░░░░░░░░░░░░░░░ │  shares this size class (2)
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                         [+]         │  zoom controls (existing)
│                         [-]         │
├─────────────────────────────────────┤
│  🔍   ⌖   ≡   ↩   ▽   ⚙   ›         │  bottom bar (existing)
└─────────────────────────────────────┘
```

1. Title chip: current ontology title (truncated, full title as accessible name) and a visible **Overview** text button.
2. Below the docking threshold the inspector never sits beside the canvas (B1).

#### 16.2.2 Preview after tapping a class (node in the upper half)

```text
┌─────────────────────────────────────┐
│ [FOAF vocabulary ▾ Overview]        │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░◎ Person ░░░░◯░░░░░░▭░░░░░░░░░ │ (1)
│ ░░░░░░░░◯░░░░░░░░░░░░░░░◯░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├─────────────────────────────────────┤
│ Person                 [Class]  [×] │ (2)
│ foaf:Person                         │
│ A person.                           │
│ Subclass of: Agent, Spatial Thing   │
│ Drawn 1 time                        │
│ [ Details for Person ]          (3) │
├─────────────────────────────────────┤
│  🔍   ⌖   ≡   ↩   ▽   ⚙   ›         │
└─────────────────────────────────────┘
```

1. Selected node keeps the existing selection styling plus the decorative ring (renderer-local, export-excluded).
2. Card docked to the bottom because the node is in the upper half; content-sized, capped at about 40% of the visual viewport; a polite status announces "Person, class. Details available."; focus is not moved (pointer selection).
3. Labelled Details button; accessible name includes the entity.

#### 16.2.3 Node in the lower half: card flips to the top

```text
┌─────────────────────────────────────┐
│ Person                 [Class]  [×] │ (1)
│ foaf:Person · A person.             │
│ [ Details for Person ]              │
├─────────────────────────────────────┤
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░◎ Person ░░░░░ │
├─────────────────────────────────────┤
│  🔍   ⌖   ≡   ↩   ▽   ⚙   ›         │
└─────────────────────────────────────┘
```

1. The title chip is hidden while a top-docked card is shown and returns on close. The selected node is never covered (2.4.11 for keyboard-originated selection).

#### 16.2.4 Element with several semantic roles — role switcher (hypothetical entity)

```text
├─────────────────────────────────────┤
│ exampleTerm       [Object property] │
│ Roles: [Object property|Annotation] │ (1)
│ DomainLabel → RangeLabel            │
│ [ Details for exampleTerm ]         │
```

1. Every role from `selection` is listed in a stable, meaning-based order (AH-4); the current panel shows only the first.

#### 16.2.5 Full details (modal dialog sheet)

```text
┌─────────────────────────────────────┐
│ [‹ Back]   Person              [×]  │ (1)
├─────────────────────────────────────┤
│ Class · http://xmlns.com/foaf/0.1/  │
│ Person                     [Copy]   │ (2)
│ ## Description                      │
│ A person.                           │
│ ## Relations                        │
│ Subclass of  Agent ▸, Spatial Thing▸│ (3)
│ Disjoint with  Document ▸, Org… ▸   │
│ ## Annotations                      │
│ rdfs:label (en) Person              │
│ skos:… …                            │
│ ## Individuals                      │
│ ## Occurrences                      │
│ Drawn 1 time in the current view    │
│ [ Retained facts for the ontology ] │ (4)
└─────────────────────────────────────┘
```

1. Native `<dialog>` opened with `showModal`; initial focus on the heading (`tabindex="-1"`); Escape closes; Back returns to the preview and to its Details button.
2. Full IRI, wrapped at separators; nothing truncated in this surface.
3. Related entities are buttons that report a selection to the controller; the runtime decides what to show.
4. Opens the existing Ontology facts dialog; becomes entity-scoped only if AH-6 is accepted.

#### 16.2.6 Ontology overview (from the title chip)

```text
┌─────────────────────────────────────┐
│ Ontology overview              [×]  │
├─────────────────────────────────────┤
│ Friend of a Friend (FOAF) vocabulary│
│ http://xmlns.com/foaf/0.1/          │
│ Version: —   Authors: —             │
│ Language [ en ▾ ]                   │
│ ## Description                      │
│ ## Metadata                         │
│ ## Statistics (visible graph)       │
│ ## Source                           │
│ Packaged example · foaf.json        │
│ [ Ontology facts ] [ Reload source ]│
└─────────────────────────────────────┘
```

Headings are real headings with disclosure buttons inside them (`aria-expanded`), replacing today's `h3 role="button"`.

#### 16.2.7 Compact landscape (≈812 × 375)

```text
┌──────────────────────────────────────────────────────────────┐
│ [FOAF ▾ Overview] ░░░░░░░░░░░░░░░░░░░░░░┌──────────────────┐│
│ ░░░░░░░░░░◎ Person ░░░░░░░░░░░░░░░░░░░░░│ Person   [Class]×││ (1)
│ ░░░░░░░░░░░░░░░░░░░░░░◯░░░░░░░░░░░░░░░░░│ foaf:Person      ││
│ ░░░░░░▭░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ A person.        ││
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ [Details]        ││
│                                         └──────────────────┘│
├──────────────────────────────────────────────────────────────┤
│  🔍   ⌖   ≡   ↩   ▽   ⚙   ›                                   │
└──────────────────────────────────────────────────────────────┘
```

1. With little height the card docks to the side opposite the node instead of top/bottom; same content budget, scrolls internally if needed. Orientation change re-places without animation.

### 16.3 Tablet portrait (≈768 × 1024)

Below the current docking threshold (viewport ≤ 1024 px), so no side-by-side inspector.

```text
┌───────────────────────────────────────────────┐
│ [FOAF vocabulary ▾ Overview]                  │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░◎ Person ───┐░░░░░░░◯░░░░░░░▭░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░┌─┴───────────────────────┐░░░ │ (1)
│ ░░░░░░░░◯░░░░░░│ Person   [Class]     [×]│░░░ │
│ ░░░░░░░░░░░░░░░│ foaf:Person · A person. │░░░ │
│ ░░░░░░░░░░░░░░░│ Subclass of: Agent, …   │░░░ │
│ ░░░░░░░░░░░░░░░│ [ Details for Person ]  │░░░ │
│ ░░░░░░░░░░░░░░░└─────────────────────────┘░░░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├───────────────────────────────────────────────┤
│  🔍 Search…   ⌖   ≡   ↩   ▽   ⚙                │
└───────────────────────────────────────────────┘
```

1. Floating card adjacent to the node with a short connector; placed once and re-placed only by hysteresis (node leaves the keep-clear region). Details opens as a large modal sheet (as §16.2.5).

### 16.4 Desktop (≈1440 × 900)

#### 16.4.1 Preview

```text
┌────────────────────────────────────────────────────────────────────────┐
│ [FOAF vocabulary ▾ Overview]                       [Pin details panel] │ (1)
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░◎ Person ─┐░░░░░░░░░░░░◯░░░░░░░░░░░░░░▭░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░┌──┴──────────────────────┐░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░◯░░░░░░░░░░░│ Person   [Class]     [×]│░░░░░░░░░◯░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░│ foaf:Person             │░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░│ A person.               │░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░│ Subclass of: Agent, …   │░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░│ [ Details for Person ]  │░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ░░░░░░░░░░░░░░░░░░└─────────────────────────┘░░░░░░░░░░░░░░░░░░░░░░░░ │
├────────────────────────────────────────────────────────────────────────┤
│  bottom bar                                                            │
└────────────────────────────────────────────────────────────────────────┘
```

1. The docked inspector is closed by default on wide screens (D-09) and pinnable; `sidebar=1` share links open it here.

#### 16.4.2 Details docked (wide screens; also editor mode)

```text
┌──────────────────────────────────────────────────┬─────────────────────┐
│ [FOAF vocabulary ▾ Overview]                     │ Person         [×]  │ (1)
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ Class · foaf:Person │
│ ░░░░░░░░░░░◎ Person ░░░░░░░░░░░░◯░░░░░░░░░░░░░░░ │ ## Description      │
│ ░░░░░░◯░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ## Relations        │
│ ░░░░░░░░░░░░░░░░░░░░░░░▭░░░░░░░░░░░░░░░░░░░░░░░░ │ ## Annotations      │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ ## Individuals      │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │ [Ontology] [Entity] │ (2)
├──────────────────────────────────────────────────┴─────────────────────┤
│  bottom bar                                                            │
└────────────────────────────────────────────────────────────────────────┘
```

1. Non-modal `complementary` region; the graph stays interactive, so selecting another node updates the panel (comparison workflow). Width keeps today's content-driven tokens; docking only when the remaining canvas meets the minimum usable width (§6.5).
2. Panel switches between Ontology overview and Entity details. In editor mode this panel shows the existing editing content, unchanged in authority.

### 16.5 Entity interaction storyboard

| Frame | Reader action             | What the reader sees                                                                                             | State and focus                                                                                                            |
| ----- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1     | Graph relaxing after load | Nodes moving; title chip shows the ontology                                                                      | `Closed`; layout `relaxing`                                                                                                |
| 2     | Taps a class circle       | Selection styling; ring starts to expand around the node                                                         | Controller `selection` published; `PreviewOpening`; no layout call                                                         |
| 3     | (≈200 ms)                 | Card grows out of the node's circle (radius 50% → card radius) to its docked or floating place; content fades in | `PreviewOpen`; status message announced; focus unchanged                                                                   |
| 4     | Graph keeps relaxing      | Node drifts; card stays put (hysteresis); ring follows the node                                                  | Anchor updated from published geometry, not DOM reads                                                                      |
| 5     | Activates **Details**     | Card hands off to the sheet (compact) or docked panel (wide)                                                     | `DetailsOpen`; focus on the details heading                                                                                |
| 6     | Escape (or Close)         | Sheet closes back toward the card position                                                                       | `Closed` details, selection kept; focus to the Details button if the preview still exists, else title chip or search field |
| 7     | Taps the same node again  | Selection clears (existing toggle); card shrinks back into the node                                              | `Closing` → `Closed`                                                                                                       |
| 8     | Reduced motion on         | Frames 2–7 happen with instant or ≤100 ms opacity changes, no scale/translate                                    | Same states                                                                                                                |

#### 16.5.1 Interruption storyboard

| Step | Event                                                 | Outcome                                                                                                                                                                       |
| ---- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a    | Tap node A                                            | `PreviewOpening(A)`                                                                                                                                                           |
| b    | Tap node B within 100 ms                              | Animation re-targets: card content swaps to B, morph continues toward B's placement from the current position; no close/open cycle; describe call coalesced to the next frame |
| c    | Start dragging B                                      | Card fades to 30% and ignores pointer input; drag behaves exactly as today (pick-and-pin pins only after a drag, as today)                                                    |
| d    | Release                                               | Card restores; re-placed if B moved under it                                                                                                                                  |
| e    | Hash changes to another ontology (or agent loads one) | Card and any details close immediately without animation; generation-scoped references dropped; focus to the title chip if it was inside the closed surface                   |
| f    | Edit accepted (editor mode) while details open        | Content refreshes in place; scroll and focus kept where the element still exists                                                                                              |
| g    | Filter hides the selected entity                      | Card switches to "Not shown in the current view"; Details still available                                                                                                     |

### 16.6 State diagrams (non-executable)

#### 16.6.1 Chooser

```text
                 input / paste / autofill
          ┌──────────────────────────────────────────┐
          ▼                                          │
   ┌─────────────┐  Down/Up/toggle/tap  ┌─────────────┴─┐
   │ List closed │ ───────────────────▶ │  List open    │
   │ (value v)   │ ◀─────────────────── │  active: a|∅  │
   └─────┬───────┘  Esc/Tab/blur/commit └──────┬────────┘
         │                                     │ Enter with active a  (E2)
         │ Enter / Visualize (E3, E4)          ▼
         │                              commit: v := a.documentUrl
         ▼                              (no load, focus stays)
   ┌──────────────┐   invalid   ┌──────────────────────┐
   │ Validate     │ ──────────▶ │ Error shown          │
   │ (exact match │             │ aria-invalid, focus  │
   │  first, then │             │ in field             │
   │  normalise)  │             └──────────────────────┘
   └─────┬────────┘
         │ valid
         ▼
   ┌──────────────┐  route  ┌──────────────────────────┐
   │ Submitted    │ ──────▶ │ hashchange → controller  │
   │ (text kept)  │         │ loading → ready | error  │
   └──────────────┘         └──────────────────────────┘

   committed(v) = suggestion whose documentUrl === v (derived, never stored)
```

#### 16.6.2 Details

```text
            selection (current generation)
   ┌────────┐ ─────────────────────────▶ ┌────────────────┐
   │ Closed │                            │ PreviewOpening │
   └───┬────┘ ◀──── load / generation ── └───────┬────────┘
       ▲            change (instant)             │ animation end
       │                                         ▼
       │  selection cleared            ┌────────────────┐  selection → other
       ├────────────────────────────── │  PreviewOpen   │ ◀──────────────┐
       │        (reverse animation)    └──┬─────────┬───┘ content swap ───┘
       │                         Details  │         │ entity hidden →
       │                                  ▼         │ "not shown" mode
       │                         ┌────────────────┐ │
       │   Close/Escape          │  DetailsOpen   │ │
       └──(selection kept, ──────│  (sheet/panel) │◀┘
           preview remains)      └───────┬────────┘
                                         │ Back
                                         ▼
                                    PreviewOpen

   Any event during an *Opening/Closing animation: cancel or reverse from the
   current position to the latest target state; nothing is queued.
```
