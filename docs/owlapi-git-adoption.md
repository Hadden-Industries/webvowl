# OwlAPI Git adoption

The application and `packages/vowl` both depend on `git+https://github.com/Hadden-Industries/owlapi.git#ccace6afe201c6e2cc6a49e53b2d50bd6617916f`.
The installed package retains its public name `@hadden-industries/owlapi`, local dependency name `owlapi`, and version `0.1.0-rc.1`.
The source commit identifies this adoption; the unchanged version does not identify its bytes.
This source contains the upstream profile scheduling repair and the Java-compatible RDF/XML refinements.
It does not represent a new npm publication.
Existing WebVOWL loading and profile deadlines remain explicit consumer policy.

## Lessons applied from Universal Ontology

This transition follows [Universal Ontology's adoption commit](https://github.com/Hadden-Industries/universal-ontology/commit/f3cef5220f54a9f75eb52dced50a4538862a74fe), its [development guidance](https://github.com/Hadden-Industries/universal-ontology/blob/f3cef5220f54a9f75eb52dced50a4538862a74fe/docs/development.md), and its [package boundary checks](https://github.com/Hadden-Industries/universal-ontology/blob/f3cef5220f54a9f75eb52dced50a4538862a74fe/tests/import-closure/owlapi-package-boundary.test.js).

| Observed trap or obligation                                                                     | WebVOWL treatment                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incremental installation can retain old registry bytes when the package version stays the same. | Regenerate the lockfile with native npm, then perform a clean installation before qualification and bundling.                                                     |
| npm skips Git tarball integrity verification.                                                   | Check the exact lock source and integrity, then check every installed package file against an independently packed producer commit.                               |
| npm 12 admission can reject Git acquisition.                                                    | Retain the existing root `.npmrc` with `allow-git=root`; lifecycle scripts remain disabled during installation.                                                   |
| Source changes can invalidate executable identity policies and CI selectors.                    | Update the maintained consumer boundary test; existing setup and CI already use clean installation, and existing manifest/lock changes select application checks. |
| Registry qualification can be mistaken for qualification of newer Git bytes.                    | Preserve historical records and qualify this source separately; registry RC integrity is not evidence for this adoption.                                          |
| A single consumer update can leave another consumer on the registry package.                    | Use the identical full SHA in both manifests and require one deduplicated installed OwlAPI package.                                                               |

## Installing and checking

Use the repository's selected Node.js and npm versions.
After an approved source change, regenerate the root lockfile without refreshing unrelated dependencies:

```sh
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --ignore-scripts --no-audit --no-fund
npm test -- --runInBand --runTestsByPath src/owlapiConsumerBoundary.architecture.test.js
```

Review the lockfile diff before clean installation.
The source transition requires no Vite alias, sibling repository link, vendored OwlAPI source, lifecycle-script permission or CI configuration change.
Run the full relevant tests and checked production build before deployment; focused package checks alone do not establish browser compatibility or performance.
Ordinary browser loading and the real large-ontology path need browser verification.

The payload expectation in [the boundary test](../src/owlapiConsumerBoundary.architecture.test.js) comes from `git archive` of the exact producer commit followed by `npm pack --ignore-scripts` in an isolated extraction.
The packed archive SHA-256 is `a2a3575864489ac8a3a9000f2e70992877b2c90076894570663ec52f5d4fb346`.
Its 114 package files produce the sorted `[relative path, SHA-256]` inventory digest `848a8ea563216ea4acc91d733ec22930b5efb5358951743d09b9fd5b0d653be5` using SHA-256 over `JSON.stringify(inventory)`.
Nested `node_modules` dependencies are excluded from this package payload and retain their own lockfile identities.
Symlinks and unexpected non-file payload entries are rejected.
Updating the source later requires deriving a fresh expectation from the independently selected producer commit, rather than blessing whatever happens to be installed.

The current source's compatibility and timing evidence belongs to this adoption.
Upstream timing results and renderer-only timing results do not establish end-to-end browser loading performance for this build.
