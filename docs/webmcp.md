# WebMCP integration

[Back to README](../README.md)

On a browser that offers the experimental WebMCP host API, a WebVOWL page registers fourteen tools an agent can call.
They share the human interface's non-editing actions: load, summarize, search, inspect details, select and arrange drawn elements, change the view, tune display modes and distances, reset, share the view settings, and export SVG, saved VOWL JSON, Turtle or LaTeX.

This is experimental and entirely optional.
A browser without the API is an ordinary WebVOWL page with nothing missing and nothing logged, because an absent API is not a fault.
Only a top-level page registers anything: a WebVOWL page inside an iframe does not read the API at all, and never inspects or proxies the document that embeds it.

**What an agent can change, and what it cannot.**
Every change a tool makes is one the reader can see in the visualization and undo through the ordinary controls: a language, the visibility filters, which elements are focused, whether automatic layout motion is paused or resumed, and the viewport.
`layout: "pause"` retains the arrangement by stopping motion; `"resume"` restarts it.
Omitting `layout` leaves the current choice alone.
`viewport: "zoom-and-center"` performs the same zoom and pan as the human **Zoom and center graph** button.
It does not rearrange nodes.
The earlier `preserve` and `fit` names have no compatibility aliases.

Selection and focus are separate: selecting an element displays its details; focus highlights the requested entities until changed or cleared.
Arrangement addresses generation-scoped drawn occurrences, including position and pinning.
Experimental ontology editing remains human-only.
Turtle export uses the existing generator; this integration does not certify or rewrite its RDF content.

**What it accepts as a source.**
An ontology document IRI over HTTP(S), a VOWL JSON URL over HTTP(S), ontology text supplied directly with its syntax named, or supplied VOWL JSON text.
A location using any other scheme, or carrying credentials, is refused.
Human users can still choose or drop a local file; WebMCP has no filesystem-path access.

**Privacy and artifacts.**
Ontology content is fetched and parsed by the page in your browser; nothing is uploaded anywhere by this application.
An export is a browser-local artifact reachable through an object URL that the page retires when it is superseded or the page goes away.
Retrieving the file is a manual download, and whether a particular agent client can attach that download to its conversation is that client's behaviour, not something this page can promise.
Only the latest export remains available.
Export tool results contain bounded metadata, never exported document content or object URLs.
SVG results include dimensions, layout outcome, source identity and SHA-256.

**One implementation, no fallback.**
The tools and the human interface call the same `WebVowlController`.
There is no legacy callback route, no compatibility adapter, and no second transport for loading or exporting; an architecture test fails the build if one appears.

For an application-level embedding, `app.getWebVowlController()` returns the controller.
The concrete renderer and options entry points were removed deliberately and have no aliases.

The modules added or materially changed by this work are native ESM with named exports and explicit relative `.js` specifiers.
The root package declares `"type": "module"`; the application and build/test infrastructure use native ESM.
The production CommonJS renderer allowlist is now empty.

See the [design record](designs/2026-09-03-ontology-model-ownership.md) and the [completed qualification](evaluations/2026-09-10-webmcp-completion.md).

## Additional information

### Complete semantic search

`find_ontology_elements` returns unique semantic identities, including elements hidden by visualization filters.
Different kinds sharing an IRI remain distinct; anonymous identities include their load generation.
Labels and relations from repeated occurrences participate in search.

Call with `query`, optional `kinds`, `limit` (1–25, default 10), and `includeNeighborhood` (default true).
If `hasMore` is true, repeat the same inputs with the returned `continuation` string.
The token advances past exactly the matches returned, even when the 1,500-character budget fits fewer than `limit`.
`totalMatchCount` is the exact number of unique matches for that search.
`continuation: null` and `hasMore: false` mark completion.

Tokens bind the inputs, ontology load, document revision and label language.
Edits, replacement loads, language changes, incompatible inputs, page reloads or token expiry require a fresh search.
The page retains only eight continuation records; creating later continuation records evicts the oldest.
No ontology snapshot is retained by the pager.

`optionalFactsTruncated` identifies shortened display text or omitted neighborhood facts.
`isTruncated` also preserves upstream incompleteness and signals remaining matches; it is not the terminal-page indicator.
Exact reference IRIs are never shortened.
A single identity that cannot fit causes an actionable failure, not an empty success or a skipped result.
Search changes neither ontology facts nor selection, layout or viewport.

SVG export captures computed styles into a detached clone through the rendered graph adapter.
CSS changes should be checked against an independently opened export; exporting does not rewrite the live SVG or require regenerated D3 rules.

## Summary sections

`get_ontology_summary({})` returns the full summary when it fits.
Otherwise it preserves the exact ontology IRI and element counts, marks `sectionsOmitted: true`, and lists `availableSections`.
An oversized required core fails explicitly; identity IRIs are never shortened.

Request a section with `{ "section": "ontologyHeader" }`, then repeat that section with the returned `continuation` until it is null.
Concatenate the `jsonFragment` strings in offset order and parse the completed JSON once.
Sections include the header, source, visible graph counts, namespaces, imports, languages, selected language, filters and warnings.
This retrieves complete summary text and collections within the same 1,500-character response ceiling.
`isTruncated` on section pages reports upstream incompleteness, not whether another page exists; use `continuation` for traversal completion.

Continuations belong to one section and bind its content digest, load generation, document revision and language.
Changes, page reload or eviction from the eight-record continuation store require restarting the section.
The store retains only small metadata records, not full ontology snapshots.

## Detail continuation

`get_ontology_element_details` still accepts an initial `{ "reference": ... }` request.
Large descriptions return JSON fragments and `nextOffset`, plus a `continuation` token.
For each following page, supply that token, the exact `nextOffset`, the same reference, and the returned `loadGeneration` and `language`.
Concatenate fragments before parsing; `nextOffset` and `continuation` are both null on the last page.
Small descriptions return `elementDescription` directly.

Each response identifies `documentRevision`.
Tokens bind the element identity, generation, revision, language and next offset.
An edit, ontology replacement, language change, page reload or eviction after eight newer continuation records requires restarting from offset zero without a token.
The tool rejects stale pages and changes during a read; it retains only bounded metadata rather than full descriptions.
