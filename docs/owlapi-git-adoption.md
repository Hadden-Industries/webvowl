# OwlAPI dependency selection

The root [package.json](../package.json) field `dependencies.owlapi` is the only editable source selector for the application and `packages/vowl`.
It accepts either `npm:PACKAGE_NAME@EXACT_VERSION` or `git+https://github.com/Hadden-Industries/owlapi.git#FULL_40_CHARACTER_COMMIT`.
The root native npm override `owlapi: "$owlapi"` makes the private workspace's `owlapi: "*"` dependency resolve to that same selection.
The local import name remains `owlapi` for either source.
The generated lockfile records resolution and archive integrity; do not edit those records by hand.
This reuses the registry alias integration that preceded commit `4ef3e7c5`, rather than introducing a new package resolver.
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
| A single consumer update can leave another consumer on the registry package.                    | Select the source once in the root manifest, reference it with a native npm override, and require one installed OwlAPI package.                                   |

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

The [consumer test](../src/owlapiConsumerBoundary.architecture.test.js) reads the selected source from the root manifest and verifies its generated lock and installed metadata.
It then fetches that source with npm's bundled package fetcher, as installation does, without lifecycle scripts.
A registry version's archive must match the generated lock's SHA-512 integrity.
A Git commit is packed with npm's own file selection; npm compares no integrity for Git dependencies ([npm/rfcs#525](https://github.com/npm/rfcs/pull/525)), so the commit itself is the source's identity.
The fetcher reads npm's cache first and uses the network only for what the cache lacks.
It then compares every installed package file against that source by relative path and SHA-256, without another hard-coded package version, commit, archive digest or file count.
Nested `node_modules` dependencies are excluded from this package payload and retain their own lockfile identities.
Symlinks and unexpected non-file payload entries are rejected.
Run `npm ci` before these tests, which also leaves a registry archive in npm's cache.
The reference payload comes from the selected source, never from the installed files being tested.

The current source's compatibility and timing evidence belongs to this adoption.
Upstream timing results and renderer-only timing results do not establish end-to-end browser loading performance for this build.
