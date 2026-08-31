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

## Additional information

To export the VOWL visualization to an SVG image, all css styles have to be included into the SVG code.
This means that if you change the CSS code in the `vowl.css` file, you also have to update the code that
inlines the styles - otherwise the exported SVG will not look the same as the displayed graph.

The tool which creates the code that inlines the styles can be found in the util directory. Please
follow the instructions in its [README](util/VowlCssToD3RuleConverter/README.md) file.

## License

Copyright © 2014-2026 Vincent Link, Steffen Lohmann, Eduard Marbach, Stefan Negru, Vitalis Wiens, Maksym Shostak

This project is licensed under the GNU Affero General Public License version 3 only (`AGPL-3.0-only`). See [LICENSE](LICENSE) for the full license text.
