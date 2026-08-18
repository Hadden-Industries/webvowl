# Phase 7 development-integration lesson record

## Migration identity

- Migration: Phase 7 - early development-app integration.
- Baseline revision: `7590c17` (the repository-owner Phase 6 checkpoint).
- Completion revision: the Phase 7 checkpoint commit containing this record;
  the repository owner requested an uncommitted review pause before assigning
  its commit ID.
- Implementation dates: 13 August 2026 (builder, adapter, development route,
  differential, architecture, and browser evidence) and 18 August 2026
  (differential-harness corrections, provenance, capability, conformance,
  performance, and learning-gate closure).
- Next migration: Phase 8 - production WebVOWL cutover.

Findings recorded on 13 August were reconstructed from the recorded
implementation session rather than authored during it. The session transcript
is development evidence, not a repository artifact; every claim below is
restated against a committed test, fixture, or measurement that can be
re-executed without it.

## Implemented scope

Phase 7 adds the `OWLOntology` to VOWL-JSON seam and makes it invocable in the
development app without changing the production default.

- `src/owl2vowl/js/vowlBuilder.js` traverses structural OWL objects and emits
  VOWL-JSON-compatible WebVOWL structures. It has no concrete-syntax knowledge.
- `src/owl2vowl/js/owlapiAdapter.js` is the development-only invocation seam
  over the public manager API. It returns the new result directly and never
  adapts structural OWL back into the legacy representation.
- `src/owl2vowl/js/importResolver.js` supplies WebVOWL catalog and HTTP import
  policy against the core loader interfaces.
- `src/app/js/owlapiDevelopmentRoute.js` and
  `src/app/js/owlapiDevelopmentIntegration.js` publish results through the
  existing application loading module and expose an observable
  `data-owlapi-development` marker.
- `OWLOntologyManager.loadOntologyGraphFromOntologyDocument` returns the frozen
  root ontology, imports closure, and per-document contexts so a consumer can
  reach parser diagnostics without re-walking the closure.
- `src/owl2vowl/test/vowlSemanticSnapshot.js` provides VOWL canonicalization,
  atomic-difference calculation, and the governed-difference gate.

## Acceptance evidence

| Gate                        | Result                                                                                                                    | Primary evidence                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Structural builder          | Entity kinds, annotations, relations, restrictions, cardinalities, individuals, datatypes, metadata and imports covered   | `src/owl2vowl/js/vowlBuilder.test.js`                                |
| Architecture                | The builder's complete local import graph reaches no parser, RDF, or legacy converter module; every axiom kind is disposed | `src/owl2vowl/js/vowlBuilder.architecture.test.js`                   |
| Cross-syntax differential   | Functional, Manchester, OWL/XML and RDF/XML forms of one ontology produce one VOWL semantic graph                         | `src/owl2vowl/test/vowlBuilder.differential.test.js`                 |
| Java oracle differential    | Exact match against the pinned OWL2VOWL 0.3.7 output with zero governed exceptions after declared dialect normalization   | `src/owl2vowl/test/vowlBuilder.differential.test.js`                 |
| Legacy parity               | The retained converter and the new builder agree on their shared subset, including the `inferred` restriction marker      | `src/owl2vowl/test/vowlBuilder.differential.test.js`                 |
| Consumer contract           | The existing WebVOWL graph parser consumes the builder result directly                                                    | `src/owl2vowl/test/vowlBuilder.webvowl.test.js`                      |
| Development route           | Malformed RDF/XML, import closure, compatible OWL Full warnings and resource failures all behave before any state publish | `src/owl2vowl/js/owlapiAdapter.test.js`                              |
| Manager graph result        | Frozen root, closure and contexts; diagnostics reachable per document                                                     | `src/owlapi-js/manager/owlOntologyManager.integration.test.js`       |
| Provenance and governance   | Every new module has a disposition; every recorded reuse boundary resolves on the current branch                          | `src/owlapi-js/governance.test.js`                                   |
| Repository verification     | 10/37 Phase 7 focused suites and 94/1,218 repository suites/tests passed; lint, format and production build green         | complete Jest run; `npm run lint`; `npm run build`                   |
| Production isolation        | The production bundle contains no development route, adapter or builder marker                                            | `npm run build` followed by inspection of `deploy/js/*.js`           |
| Performance                 | Three new VOWL signals accepted; both paired RDF/XML signals within the unchanged 20% threshold                           | `docs/owlapi-js/performance/baseline.md`                             |

## Findings and dispositions

| ID       | Applicability                                | Primary disposition      | Finding                                                                                                                                                            |
| -------- | -------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `M7-001` | `TESTING`, `CROSS_CUTTING`                   | `NO_CHANGE`              | Starting the builder from a deliberately throwing stub forced every VOWL mapping rule to enter the codebase as a named failing test.                                |
| `M7-002` | `TESTING`, `CROSS_CUTTING`                   | `TEST_OR_FITNESS_UPDATE` | A rich pinned oracle fixture is a stronger gate than a minimal one; it converted two real builder defects into failing tests instead of expected-difference entries. |
| `M7-003` | `TESTING`, `CROSS_CUTTING`                   | `TEST_OR_FITNESS_UPDATE` | Exhaustive construct disposition must be a fitness test; a reviewed promise that every axiom kind is handled decays silently.                                       |
| `M7-004` | `TESTING`, `CROSS_CUTTING`                   | `TEST_OR_FITNESS_UPDATE` | A development-only seam is only development-only if both builds are produced and the production bundle is inspected for its markers.                                |
| `M7-005` | `TESTING`, `CROSS_CUTTING`                   | `TEST_OR_FITNESS_UPDATE` | One canonicalizer shared between a foreign-oracle comparison and a same-format comparison silently weakens the same-format gate.                                    |
| `M7-006` | `TESTING`                                    | `TEST_OR_FITNESS_UPDATE` | A governed-difference gate whose caller asserts zero differences cannot accept the exceptions its own manifest exists to express.                                   |
| `M7-007` | `PROVENANCE`, `TESTING`, `CROSS_CUTTING`     | `TEST_OR_FITNESS_UPDATE` | Commit-bounded provenance selectors are invalidated by branch rewriting, and a format-only check on a revision string cannot detect it.                             |
| `M7-008` | `PERFORMANCE`, `TESTING`, `CROSS_CUTTING`    | `PLAYBOOK_UPDATE`        | A benchmark run concurrently with other work reported a false 85.75% regression; a tight run-to-run spread is not evidence that a measurement is uncontaminated.    |
| `M7-009` | `TESTING`, `PROVENANCE`, `CROSS_CUTTING`     | `PLAYBOOK_UPDATE`        | The Java oracle writes a different VOWL attribute dialect from WebVOWL; dialect differences must be declared, not deleted inside a comparison helper.               |

### `M7-001` through `M7-004` - the builder was gated, not asserted

The first builder commit paired `vowlBuilder.test.js` with a `VOWLBuilder`
whose `build()` threw, so the opening failure came from the missing feature
rather than from a typo. Subsequent mapping rules repeated the cycle; the
recorded failures at `classExpressionRecord` and `addRestriction` are ordinary
red steps, not defects that escaped review.

The pinned Java fixture was materialized from the approved OWL2VOWL 0.3.7 JAR
against the existing rich Phase 5 ontology rather than a minimal one. That
choice paid immediately: it exposed unused built-in datatype nodes and a
duplicate declaration edge for a property represented by a restriction. Both
became failing tests and then fixes, rather than expected-difference rules. A
minimal fixture would have matched on the first attempt and hidden both.

`vowlBuilder.architecture.test.js` enforces two properties that reviews cannot
hold over time: the builder's transitive local import graph reaches no
`owlapi-js/parser/`, `owlapi-js/rdf/`, or retained legacy converter module, and
every canonical axiom kind appears explicitly in the dispatch table. Kinds VOWL
does not visualize are mapped to an explicit ignore with a stated reason, so
silence is never the same as omission.

Production isolation was verified by producing both builds and inspecting the
emitted bundle for development markers, not by reasoning about
`import.meta.env.DEV`.

### `M7-005` and `M7-006` - a shared canonicalizer weakened the gate it served

`canonicalVowlSnapshot` was used for three comparisons: against the Java
oracle, across the four implemented syntaxes, and against the retained legacy
converter. Its attribute normalization removed eight terms from both sides
before comparison, which is defensible for the foreign oracle and wrong for the
same-format comparisons.

Seven of those terms are redundant with the compared node `type`, so removing
them lost nothing. The eighth, `inferred`, has no other carrier. WebVOWL marks
links it derived rather than found asserted; the pinned oracle never writes the
marker at all. Suppressing it on both sides meant the legacy-parity gate could
not see it, and deleting `inferred` from the builder left that gate green.

The correction splits the canonicalizer by comparison target. Same-format
comparisons see attributes unfiltered; only the Java comparison applies a named
`JAVA_OWL2VOWL_DIALECT`, whose contents are pinned by test so it cannot be
widened quietly. The hole was confirmed closed by removing `inferred` from the
builder and observing that the new restriction-parity test failed while the
Java differential and the original parity test stayed green.

The gate had a second defect that the correction would have tripped
immediately. `verifyGovernedDifferences` returned every difference it had
just certified as governed, while its only caller asserted that the returned
array was empty. The assertion held only because there were no governed
exceptions. The caller now compares against `governedDifferenceCount`, derived
from the scoped rules' exact cardinalities, matching the pattern the Manchester
and OWL/XML differentials already use.

### `M7-007` - provenance anchors did not survive a rebase

`provenance.json` pins commit-bounded reuse for the legacy converter, RDF,
and Turtle modules with `AT_REVISION` and `AFTER_REVISION` selectors. Both
recorded commits had been orphaned by a branch rewrite: still reachable as
objects, but ancestors of no branch, so neither selector could be evaluated.
The existing check asserted only that each revision matched a 40-character
hexadecimal pattern, which a stale identifier satisfies perfectly.

Each boundary was re-anchored to the rewritten commit carrying the same change,
and equivalence was proved by comparing the Git blob hash of the governed path
at both commits rather than by matching commit subjects. Both pairs were
byte-identical. `governance.test.js` now asserts that every recorded
reuse-boundary revision is an ancestor of `HEAD`, so a future rewrite fails the
suite. Because this repository's pipelines include a shallow Travis clone and a
Docker context that excludes `.git`, the check degrades only when it can prove
history is unavailable, and the proof itself is asserted.

### `M7-008` - a false regression caused by measuring under load

The first paired remeasurement reported `generated-rdfxml-large.end-to-end` at
3,425.74 ms against an accepted 1,844.23 ms baseline, 85.75% above a 20%
threshold. It was recorded as an open regression, deferred to Phase 8 by owner
decision, and committed in that form.

It was not a regression. The benchmark had been launched in the background
while the same session ran repeated full-text scans over a 44 MB file. Repeated
on an idle machine, the same command on the same revision, runtime, machine and
lockfile produced 1,809.97 ms, which is 1.86% **below** the accepted baseline.
The VOWL signals measured in that same window were inflated identically:
`owlapi-to-vowl` fell from 3,539.46 ms to 1,947.63 ms once remeasured cleanly.

Three reasoning errors turned contaminated data into a recorded finding. A
run-to-run spread of 3,389 ms to 3,493 ms was read as evidence of a stable,
trustworthy signal, when it only showed that the interference was sustained
across all five runs. The syntax seam moved less than the end-to-end signal, so
the loss was localized after the RDF/JS boundary, when in fact the longer
operation simply had more wall-clock exposure to the same contention. A
falling peak heap alongside rising wall time was read as a structural change,
when it was ordinary allocation-timing variance under memory pressure.

The corrective checks were cheap and would have prevented the finding
altogether. A single isolated end-to-end load took 1,724 ms, immediately
contradicting the 3,426 ms figure. Wall time scaled linearly across 12,500,
25,000 and 50,000 axioms, which ruled out the algorithmic regression the heap
observation had suggested. The three accepted signals are also mutually
consistent: `owlapi-to-vowl` minus `end-to-end` is approximately 138 ms, which
matches the independently measured `builder-only` signal.

The playbook now requires benchmark runs to be serialized against all other
work, and requires an independent arithmetic or scaling cross-check before any
threshold breach is recorded as a finding. No baseline was re-anchored at any
point, so section 20.6 was never engaged.

### `M7-009` - the oracle speaks a different dialect

The pinned OWL2VOWL 0.3.7 output writes `someValues` and `allValues` where
WebVOWL writes `someValuesFrom` and `allValuesFrom`, and never writes
`inferred`. The retained legacy converter and exporter emit the WebVOWL
spelling, so the new builder matching WebVOWL is correct and the oracle is the
foreign dialect, not the reference for this field. Phase 7's mandate is
VOWL-JSON-compatible WebVOWL structures.

The playbook now states that a behavioural oracle in a different dialect
requires an explicitly named and pinned normalization applied only to that
comparison, and that a normalization must never be applied to a comparison
between two implementations of the same format.

## Dependency and security impact

Phase 7 adds no dependency and changes no lockfile entry; the recorded
`package-lock.json` SHA-256 is unchanged from the accepted Phase 6 document.
The development import resolver restricts import loading to HTTP and HTTPS,
omits credentials, honours the loader's redirect and byte limits, and converts
its own timeout into the canonical resource error. It is reachable only from
the development route and is absent from the production bundle.

## Impact on Phase 8

Phase 8 rewires the existing production entry path in place onto
`owlapi-js` to `OWLOntology` to `VOWLBuilder`, and removes the temporary
development routing so two production implementations cannot coexist. The
builder, resolver and manager graph API are ready for that cutover; the adapter
and development route are the pieces intended to disappear.

Phase 8 must additionally:

1. prove by static architecture test and bundle inspection that the production
   graph cannot reach the legacy parsers, `ontologyConverter.js` or
   `jsonExporter.js`;
2. keep the legacy files unmoved for characterization; and
3. fail explicitly with canonical unsupported-format diagnostics for any
   legacy-only syntax, including one discovered in an import closure.

Phase 8 inherits no performance debt. The production path it adopts measures
1.86% below its accepted baseline, and VOWL construction adds approximately
138 ms over 50,000 classes.

## Unresolved questions

None. `M7-008` was originally recorded as an open performance regression
deferred to Phase 8; remeasurement on an idle machine showed the regression did
not exist, and the finding was rewritten as the measurement-hygiene lesson
above. Its disposition changed from `LOCAL_PHASE_FOLLOW_UP` to
`PLAYBOOK_UPDATE`, and the playbook was updated before gate closure.

No conformance, differential, architecture, provenance, security, resource,
performance or browser blocker remains.

## Mechanically reviewable completion summary

- Migration: Phase 7 early development-app integration.
- Lesson record: `docs/owlapi-js/migration/lessons/006-development-integration.md`.
- Finding IDs: `M7-001` through `M7-009`; every finding has exactly one primary
  disposition.
- Playbook changed: yes; the oracle-dialect, comparison-target and
  benchmark-isolation rules are institutionalized and the next-migration
  section advances to Phase 8.
- Executable protections added: VOWL canonicalizer unit tests including the
  `inferred` preservation and dialect-pinning cases, a restriction-parity test
  against the retained converter, a manifest-derived governed-difference count,
  a reuse-boundary revision resolvability gate, a conformance runner and
  harness existence check, and provenance records for the three new modules.
- Normative-change proposals: none.
- Resource-budget or regression-threshold changes: none; every paired signal is
  within the unchanged 20% threshold and no baseline was re-anchored.
- Unresolved blockers: none.
- Next migration: Phase 8, blocked until the repository owner creates the
  requested Phase 7 checkpoint commit and explicitly says to proceed.
