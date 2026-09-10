# WebVOWL

> [!CAUTION]
> The URL https://visualdataweb.org/ is no longer owned by VisualDataWeb and is not related to WebVOWL.
> The current public WebVOWL service is <https://service.tib.eu/webvowl/>.

This repository was ported from an internal SVN repository to GitHub after the release of WebVOWL 0.4.0. Due to historical cleanups with `git filter-branch`, the early commit history may show unusual effects.

WebVOWL now performs ontology ingestion and VOWL conversion in JavaScript. Local development and production builds do not require a Java OWL2VOWL service or Docker.

## Requirements

- A current [Node.js long-term support release](https://nodejs.org/en/about/previous-releases)
- The npm version bundled with that Node.js release

## Development setup

Install the exact dependency graph recorded in `package-lock.json`:

```bash
npm ci
```

Start the Vite development server. The command prints the local URL and opens it in the default browser:

```bash
npm run dev
```

Run the complete Jest suite serially:

```bash
npm test -- --runInBand
```

Create the production build in `deploy/`:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Optional WebMCP integration

On a browser that offers the experimental WebMCP host API, a WebVOWL page
registers fourteen tools an agent can call. They share the human interface's
non-editing actions: load, summarize, search, inspect details, select and arrange
drawn elements, change the view, tune display modes and distances, reset, share
the view settings, and export SVG, saved VOWL JSON, Turtle or LaTeX.

This is experimental and entirely optional. A browser without the API is an
ordinary WebVOWL page with nothing missing and nothing logged, because an absent
API is not a fault. Only a top-level page registers anything: a WebVOWL page
inside an iframe does not read the API at all, and never inspects or proxies the
document that embeds it.

**What an agent can change, and what it cannot.** Every change a tool makes is
one the reader can see in the visualization and undo through the ordinary
controls: a language, the visibility filters, which elements are focused,
whether automatic layout motion is paused or resumed, and the viewport.
`layout: "pause"` retains the arrangement by stopping motion; `"resume"`
restarts it. Omitting `layout` leaves the current choice alone.
`viewport: "zoom-and-center"` performs the same zoom and pan as the human
**Zoom and center graph** button. It does not rearrange nodes. The earlier
`preserve` and `fit` names have no compatibility aliases.

Selection and focus are separate: selecting an element displays its details;
focus highlights the requested entities until changed or cleared. Arrangement
addresses generation-scoped drawn occurrences, including position and pinning.
Experimental ontology editing remains human-only. Turtle export uses the
existing generator; this integration does not certify or rewrite its RDF content.

**What it accepts as a source.** An ontology document IRI over HTTP(S), a VOWL
JSON URL over HTTP(S), ontology text supplied directly with its syntax named,
or supplied VOWL JSON text. A location using any other scheme, or carrying
credentials, is refused. Human users can still choose or drop a local file;
WebMCP has no filesystem-path access.

**Privacy and artifacts.** Ontology content is fetched and parsed by the page in
your browser; nothing is uploaded anywhere by this application. An export
is a browser-local artifact reachable through an object URL that the page
retires when it is superseded or the page goes away. Retrieving the file is a
manual download, and whether a particular agent client can attach that download
to its conversation is that client's behaviour, not something this page can
promise. Only the latest export remains available. Tool results contain bounded
metadata, never document content or object URLs. SVG results include dimensions,
layout outcome, source identity and SHA-256.

**One implementation, no fallback.** The tools and the human interface call the
same `WebVowlController`. There is no legacy callback route, no compatibility
adapter, and no second transport for loading or exporting; an architecture test
fails the build if one appears.

For an application-level embedding, `app.getWebVowlController()` returns the
controller. The concrete renderer and options entry points were removed
deliberately and have no aliases.

The modules added or materially changed by this work are native ESM with named
exports and explicit relative `.js` specifiers. The package as a whole is not
ESM: the root package declaration and build/test infrastructure retain their
existing module format. The production CommonJS renderer allowlist is now empty.

See the [design record](docs/designs/2026-09-03-ontology-model-ownership.md) and
the [completed qualification](docs/evaluations/2026-09-10-webmcp-completion.md).

## Additional information

SVG export captures computed styles into a detached clone through the rendered
graph adapter. CSS changes should be checked against an independently opened
export; exporting does not rewrite the live SVG or require regenerated D3 rules.

## License

Copyright © 2014-2026 Vincent Link, Steffen Lohmann, Eduard Marbach, Stefan Negru, Vitalis Wiens, Maksym Shostak

This project is licensed under the GNU Affero General Public License version 3 only (`AGPL-3.0-only`). See [LICENSE](LICENSE) for the full license text.
