# Pre-registry `owlapi` / WebVOWL repository decoupling design

> **Status:** Draft for written review  
> **Decision date:** 31 August 2026  
> **Repositories:** `Hadden-Industries/owlapi` and `Hadden-Industries/webvowl`  
> **Decision owner:** Maksym Shostak

## 1. Context

The accepted Phase 19 design correctly made
`https://github.com/Hadden-Industries/owlapi` the sole maintained source of the
standalone package. It also coupled two later events too tightly:

1. making maintained WebVOWL consume the standalone package boundary; and
2. obtaining authority to publish the unscoped npm coordinate `owlapi`, then
   verifying that public registry artefact.

npm currently rejects both first publication and historical-owner mutation of
`owlapi` because its similarity protection compares the name with `nwsapi`.
The project has submitted a manual-review request to npm Support. That external
service dependency may remain unresolved for an unknown period.

The existing implementation plan treats the registry block as a blocker for
the maintained WebVOWL cutover. Consequently, WebVOWL still imports the frozen
`src/owlapi-js/` migration tree even though the canonical package repository,
public export boundary, retained alpha candidate and package-consumer
qualification already exist. This unnecessarily makes unrelated WebVOWL work
appear coupled to npm namespace administration.

## 2. Decision summary

Decouple repository development immediately while preserving the exact public
package boundary:

- `Hadden-Industries/owlapi` remains the sole maintained package source.
- Maintained WebVOWL initially declares `owlapi` as a production dependency
  fetched from the canonical GitHub repository at one full immutable commit
  SHA.
- WebVOWL imports only `owlapi` and its approved public subpaths. The transport
  never changes the import specifiers.
- The frozen WebVOWL `src/owlapi-js/` tree and package-only dependencies are
  removed during this pre-registry cutover.
- npm namespace control, public alpha publication, registry provenance and
  immutable public-release verification remain externally blocked release
  work. They no longer block ordinary WebVOWL development.
- After public alpha verification, WebVOWL replaces only the dependency
  transport and lockfile evidence: exact Git commit becomes exact npm registry
  version. The source imports and application architecture do not change again.

This is an intentional, time-bounded pre-registry transport state. It is not a
claim that `owlapi@0.1.0-alpha.0` has been published to npm.

## 3. Goals

The design must:

1. let a clean WebVOWL clone install, test and build without a sibling
   `owlapi` checkout;
2. let the `owlapi` and WebVOWL repositories be developed through independent
   projects, branches and pull requests;
3. exercise `owlapi`'s real package manifest, package name, `exports` map and
   public entry points in every maintained WebVOWL build;
4. preserve one authoritative package source and eliminate the frozen
   `src/owlapi-js/` copy from maintained WebVOWL;
5. make dependency resolution reproducible through a full commit SHA and a
   committed lockfile;
6. retain the stronger public-registry, integrity, provenance and immutable
   release requirements for Phase 19 completion;
7. make the later npm cutover a transport-only change; and
8. fail closed rather than falling back to a local source tree when GitHub,
   npm or the package boundary is unavailable.

## 4. Non-goals

This design does not:

- rename or scope the package;
- publish a placeholder package;
- create a second package registry or public package identity;
- make Git consumption a supported distribution channel for external users;
- authorize production deployment of a prerelease-backed WebVOWL artefact;
- change the accepted `0.1.0-alpha.0` capability surface;
- introduce a workspace, monorepo, submodule, subtree or source mirror;
- retain a committed local-development escape hatch; or
- treat the Git installation as npm registry provenance.

## 5. Selected package transport

### 5.1 Committed dependency

The initial maintained WebVOWL dependency is:

```json
{
  "dependencies": {
    "owlapi": "git+https://github.com/Hadden-Industries/owlapi.git#caabb1197ffdab91c1e10d596d177b5142aea5c1"
  }
}
```

`caabb1197ffdab91c1e10d596d177b5142aea5c1` is the accepted
`v0.1.0-alpha.0` package-source commit. Subsequent commits through the current
accepted `owlapi` main tip change release orchestration and documentation, not
the package files selected by the manifest. The full commit, rather than a
branch, abbreviated SHA, SemVer selector or tag spelling, is the normative npm
package specifier.

npm defines a Git URL that resolves to a package directory as a supported
package format and permits a commit SHA as the `commit-ish`. Its lockfile format
records the resolved full Git commit. See:

- [About packages and modules](https://docs.npmjs.com/about-packages-and-modules/)
- [package.json: Git URLs as dependencies](https://docs.npmjs.com/files/package.json/)
- [package-lock.json](https://docs.npmjs.com/files/package-lock.json/)

The key remains `owlapi`, and the installed manifest also names the package
`owlapi`. Node, Jest and Vite therefore resolve the same public package
specifiers used after registry publication.

### 5.2 Git-install suitability gate

The accepted package manifest currently has no `workspaces` field and none of
npm's Git-build trigger scripts named `build`, `prepare`, `prepack`,
`preinstall`, `install` or `postinstall`. npm therefore has no package-declared
reason to install the repository's development graph and rebuild the package
for each Git installation. This property becomes a required assertion for the
temporary transport, not an informal observation.

Before changing maintained WebVOWL, a disposable qualification must:

1. obtain and digest-verify the retained `0.1.0-alpha.0` candidate tarball;
2. install that tarball into one empty consumer;
3. install the exact Git dependency into another empty consumer with the
   accepted npm version;
4. compare the complete installed `node_modules/owlapi` file path, mode and
   byte manifest after excluding only proven npm-owned installation metadata;
5. verify that both installations report name `owlapi`, version
   `0.1.0-alpha.0` and the exact five-entry `exports` map;
6. run the package-boundary smoke tests against both installations; and
7. stop the cutover on any unexplained difference.

The Git lockfile records source-commit identity, not the registry's tarball SRI
and not an npm provenance attestation. The design explicitly accepts that
narrower provisional evidence because the source commit, signed tag, retained
candidate and installed-tree equivalence are independently bound. Registry SRI
and provenance remain mandatory after publication.

## 6. Package and repository boundaries

### 6.1 `owlapi` repository ownership

The `owlapi` repository exclusively owns:

- production package source and package-owned tests;
- the package manifest, lockfile and export map;
- compatibility, conformance, provenance and release evidence;
- package dependencies and dependency-seam decisions;
- release workflows, candidate construction and npm publication; and
- changes required to the public package behavior.

WebVOWL must never repair or extend package behavior by editing a copied module.
If a consumer defect requires a package correction, that correction is made,
tested, reviewed and committed in `owlapi`; WebVOWL then deliberately advances
its full-SHA dependency after consumer qualification.

### 6.2 WebVOWL repository ownership

WebVOWL exclusively owns:

- its declared dependency specifier and lockfile;
- its imports from the approved `owlapi` public entry points;
- OWL-to-VOWL conversion and application behavior;
- its consumer-boundary architecture test;
- its build, browser integration and deployment-scope notice review; and
- the decision to advance from one accepted `owlapi` coordinate to another.

The maintained WebVOWL tree contains no `src/owlapi-js/` source, package-owned
tests, package-owned utilities or second maintained package documentation after
the cutover.

### 6.3 Public import boundary

WebVOWL may import only:

```text
owlapi
owlapi/apibinding
owlapi/model
owlapi/io
owlapi/formats
```

The already-qualified source-cutover mapping is retained:

```text
../../owlapi-js/manager/index.js  -> owlapi/apibinding
../../owlapi-js/model/index.js    -> owlapi/model
../../owlapi-js/io/index.js       -> owlapi/io
```

Loader configuration is imported from `owlapi/model`; document sources and
I/O errors are imported from `owlapi/io`. Tests that previously imported the
private `createOntologyID` helper use the public data-factory operation instead.

WebVOWL must not use an unexported deep import, a Vite/Jest alias, a sibling
checkout, a workspace, a local tarball in committed configuration, a link, a
submodule or an environment-selected source fallback.

## 7. Two-stage Phase 19D

### 7.1 Phase 19D1: pre-registry maintained-consumer decoupling

Phase 19D1 is an intermediate development checkpoint, not Phase 19 release
completion and not public-alpha evidence. It performs the following:

1. pass the Git-versus-retained-tarball equivalence gate;
2. apply the reviewed public-specifier cutover to current WebVOWL `main`;
3. declare the exact full-SHA Git dependency in WebVOWL production
   `dependencies`;
4. generate and inspect the lockfile, requiring its resolved Git commit to
   equal the declared SHA;
5. remove `src/owlapi-js/` and transferred package-only material;
6. inventory every direct WebVOWL dependency and remove packages owned only by
   `owlapi`;
7. add a maintained architecture test that accepts exactly the one approved
   Git URL and commit, rejects every mutable/local alternative, verifies package
   name/version/exports and rejects source-tree/deep/alias access;
8. run the isolated clean-clone install, dependency ownership, Jest,
   development build, production build and required local browser-consumer
   checks without a sibling checkout or ancestor `node_modules`; and
9. review, commit and push the independent WebVOWL checkpoint.

Once 19D1 is accepted on WebVOWL `main`, unrelated WebVOWL development may
continue normally. Such work does not require an `owlapi` branch, package
change, release rerun or npm Support outcome.

### 7.2 Phase 19D2: public alpha and registry normalization

Phase 19D2 remains `EXTERNAL_BLOCKED` until npm namespace authority exists. It
retains the accepted publication, public-registry, provenance, signed-tag,
immutable-release, custody and evidence gates.

After the exact public alpha has passed those gates, WebVOWL changes only the
transport:

```diff
- "owlapi": "git+https://github.com/Hadden-Industries/owlapi.git#caabb1197ffdab91c1e10d596d177b5142aea5c1"
+ "owlapi": "0.1.0-alpha.0"
```

It regenerates the lockfile and changes the maintained architecture test from
"the one exact provisional Git source" to "the one exact registry version with
registry URL and integrity". It removes the provisional Git allowance rather
than retaining a dual-mode test or fallback. All clean consumer, Jest, build and
browser checks run again against the registry installation.

Phase 19 completes only after 19D2 and every existing release requirement pass.
Phase 20 still begins only after the public alpha, immutable release and exact
registry-backed WebVOWL checkpoint are committed and pushed.

### 7.3 Gate semantics

The machine release-gate registry continues to model both 19D stages under the
existing overall checkpoint `19D` and requirement `P19-WEBVOWL-001`:

- the requirement first demands the accepted full-SHA installed-package
  checkpoint with no maintained source copy; and
- it finally demands replacement by the exact verified registry coordinate.

This preserves the existing closed Phase 19 acceptance topology. The plan and
generated gate-registry digests change, but no new release requirement, waiver,
terminal result or schema checkpoint is introduced. Phase 19 remains blocked
until the final registry state passes even though WebVOWL development is no
longer blocked.

The digest update is part of the same atomic plan amendment. After the final
authoritative catalogue and derived-checklist prose is settled, run the
repository's `generate:release-gates` command rather than hand-editing hashes.
The generated registry must contain the new normalized:

- `requirementDigest` for every changed §17.26.5 requirement, including
  `P19-WEBVOWL-001`;
- `rowDigest` for every changed derived Phase 19 checklist row, including the
  WebVOWL dependency, ownership-cleanup and architecture-test rows; and
- unchanged IDs, ownership, applicability, failure semantics and child-gate
  topology.

Then run the release-gate verifier and its focused tests. They must prove the
catalogue requirement count, checklist row count, coverage, generated registry
and normalized wording are mutually consistent. A stale digest, manual digest
substitution or verifier exception is a failed plan amendment.

Any gate-result record generated before this amendment remains historical
evidence bound to its former `gateRegistrySha256`, `catalogueSha256`,
`checklistCoverageSha256` and per-requirement digest. Do not rewrite such a
record to imply it evaluated the new wording. A later release result must be
generated against the amended registry. Earlier command outputs may be cited
only when their inputs and assertions still satisfy the new gate; the new
WebVOWL transport assertions themselves require new evidence.

## 8. Dependency cleanup

The current likely package-only WebVOWL dependencies are:

```text
@rdfjs/data-model
@rdfjs/dataset
@xmldom/xmldom
jsonld
n3
rdfxml-streaming-parser
```

They are removal candidates, not assumptions. Before editing `package.json`, a
static inventory must cover production source, tests, scripts, HTML, Vite/Jest
configuration, literal dynamic imports, any retained CommonJS loading and
copied-asset paths. A package is removed only when no retained WebVOWL-owned
consumer exists. The clean isolated install then proves npm hoisting did not
hide an undeclared dependency.

WebVOWL separately regenerates or updates its deployment-scope third-party
material and notice review after the production build. The `owlapi` package
inventory is an input, not a substitute for the application's redistribution
analysis.

## 9. Local simultaneous-development workflow

The committed WebVOWL configuration always uses the accepted remote full SHA.
For exploratory work that genuinely changes both repositories, a developer may
use this disposable workflow without committing it:

1. run `npm pack` from the local `owlapi` checkout into a temporary directory;
2. install that tarball into a disposable WebVOWL checkout, or install it with
   `--no-save` and lockfile writes disabled in a working checkout;
3. run the focused consumer checks;
4. restore the authoritative installed tree with `npm ci`; and
5. commit and push the accepted `owlapi` change before proposing a WebVOWL
   package-SHA advance.

No script, environment variable or resolver alias automates a silent local
fallback. A dirty manifest, lockfile or retained temporary tarball fails the
WebVOWL checkpoint.

## 10. Failure behavior

| Failure | Required behavior |
| --- | --- |
| Exact Git commit cannot be fetched | Installation fails. Do not fall back to `src/owlapi-js`, a sibling checkout or a mutable branch. |
| Git and retained-tarball installed trees differ | Stop 19D1, explain the difference and correct the transport or package boundary before maintained cutover. |
| Installed package name, version or exports differ | Fail the architecture test and stop. |
| WebVOWL needs an unexported package function | Correct the consumer to use the public API, or separately review a real public `owlapi` API change. Do not deep-import. |
| A package-only dependency still has a WebVOWL owner | Retain it with the correct dependency classification and recorded consumer. |
| npm Support remains pending | Keep public release work `EXTERNAL_BLOCKED`; continue independent repository development. |
| npm publishes bytes that differ from the retained candidate | Stop publication verification; do not normalize WebVOWL to the registry coordinate. |
| Later `owlapi` correction is required before publication | Produce an accepted package commit/candidate under the existing versioning rules, then intentionally update WebVOWL's full SHA and rerun consumer qualification. |

## 11. Verification matrix

| Evidence | 19D1 Git state | 19D2 registry state |
| --- | --- | --- |
| Package name/version/exports | Required | Required |
| Full source commit in manifest/lock | Required | Not applicable; Git allowance removed |
| Installed tree equals retained candidate | Required | Registry tarball must equal retained candidate |
| Registry URL and SRI | Not available and must not be claimed | Required |
| npm signature/provenance/attestation | Not available and must not be claimed | Required |
| No WebVOWL source copy | Required | Required |
| Only approved public imports | Required | Required |
| No resolver/local/workspace fallback | Required | Required |
| Dependency ownership and isolated install | Required | Required after lockfile substitution |
| Jest and development/production builds | Required | Required |
| Required Chromium/Firefox/WebKit consumer integration | Required | Required |
| WebVOWL deployment-scope notice review | Required | Revalidate if emitted graph changes |

## 12. Documentation and plan ownership

The maintained cross-repository release contract lives in
`Hadden-Industries/owlapi/docs/implementation-plan.md`. It must be amended in
the following places:

- top-level canonical-repository, checkpointing and purpose decisions;
- §2.10.3 canonical repository and consumer boundary;
- §2.69 non-production maintained cutover;
- §17.26.0 checkpoint sequencing;
- §17.26.4 post-publication verification and WebVOWL cutover;
- §17.26.5 `P19-WEBVOWL-001` and checkpoint acceptance;
- §17.27 Phase 20 starting condition;
- §21.2.1 external package boundary; and
- the derived Phase 19 checklist rows for the WebVOWL dependency, cleanup and
  architecture test.

The generated `owlapi/docs/release/gates.json` must then be regenerated so its
requirement and checklist digests match the amended authoritative prose. Its
requirement topology and schema remain unchanged. The amendment is not complete
until both `npm run generate:release-gates` and
`npm run verify:release-gates` succeed and the generated diff contains no
unexplained hash or topology movement.

WebVOWL receives a focused implementation plan for its own 19D1 changes rather
than maintaining a second live copy of all `owlapi` release engineering. The
large historical migration plan under `docs/owlapi-js/` receives a prominent
handoff notice pointing to the canonical `owlapi` plan and the focused WebVOWL
consumer plan; it is not independently edited into a competing release
authority.

## 13. Configuration approval boundary

This design document changes no configuration. Implementation requires separate
exact approval before changing:

1. `Hadden-Industries/owlapi/docs/release/gates.json`: regenerate only the
   `requirementDigest` and `rowDigest` values affected by the approved plan
   prose, with no requirement/schema topology change; validate the resulting
   aggregate registry/catalogue/checklist hashes when a new gate-result record
   is produced;
2. `Hadden-Industries/webvowl/package.json`: add the exact full-SHA `owlapi`
   production dependency and remove only independently proven package-only
   dependencies;
3. `Hadden-Industries/webvowl/package-lock.json`: regenerate it with the
   accepted npm version so the `owlapi` resolution records that exact Git
   commit and removed dependencies disappear; and
4. any WebVOWL build/test configuration only if the implementation proves it is
   strictly necessary. No resolver alias is permitted, and this design expects
   no Vite or Jest configuration change.

The later registry-normalization pull request requires a second exact approval
for the `package.json`, lockfile and maintained architecture-test state change.

## 14. Acceptance state

The repository-development decoupling is accepted when:

- the written design and resulting implementation plans are approved;
- the Git package installation is proven equivalent to the retained candidate;
- WebVOWL `main` installs the exact commit through the declared `owlapi`
  dependency;
- WebVOWL contains no maintained `src/owlapi-js/` tree or privileged import
  route;
- isolated WebVOWL installation, tests, builds and required browsers pass;
- the WebVOWL checkpoint is reviewed, committed and pushed; and
- the canonical `owlapi` plan records npm publication as a remaining external
  release gate rather than a WebVOWL development gate.

At that point, the two projects are operationally independent even though final
Phase 19 release completion remains pending npm namespace resolution.
