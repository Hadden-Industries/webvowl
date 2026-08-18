# Phase 8 production-cutover lesson record

## Migration identity

- Migration: Phase 8 - production WebVOWL cutover.
- Baseline revision: `27dba50` (the repository-owner Phase 7 checkpoint),
  corrected by `9733cc9`.
- Completion revision: none. Phase 8 is open; see "Outstanding gate".
- Implementation date: 18 August 2026, revised 19 August 2026.
- Next migration: Phase 9 - private N3.js adapter foundation and strict Turtle.

This record is written during the phase rather than at its close, so that the
findings are recorded while the evidence is fresh. It is not a closure record
and must not be read as one.

## Implemented scope

The application now ingests ontologies exclusively through `owlapi-js`. There is
no runtime legacy fallback.

- `src/owl2vowl/js/index.js` is rewritten in place. Its `owl2vowl` and
  `loadWithImports` entry points construct an `OWLOntology` through the manager
  and convert it with `VOWLBuilder`. It imports no legacy parser, converter,
  exporter or import loader.
- The Phase 7 development seam is gone: `owlapiAdapter.js`,
  `owlapiDevelopmentRoute.js`, `owlapiDevelopmentIntegration.js`, their tests,
  and the `import.meta.env.DEV` block in `src/main.js` were all removed.
- `src/owl2vowl/test/legacyPipeline.js` composes the retained legacy modules for
  characterization use only.
- `src/productionGraph.architecture.test.js` is the reachability gate.
- No legacy file was moved, renamed or deleted. `ontologyConverter.js`,
  `jsonExporter.js`, `rdfParser.js`, `importLoader.js`, `rdfXmlSerializer.js`
  and the legacy syntax parsers remain at their existing paths, unreachable from
  production, awaiting the Phase 17 deletion.

## Acceptance evidence

| Gate                     | Result                                                                                                              | Primary evidence                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Production entry         | Four advertised syntaxes, malformed input, compatible warnings, resource failure and import closure all behave       | `src/owl2vowl/js/index.test.js`                      |
| Unsupported format       | Turtle fails with `UNPARSABLE_ONTOLOGY`, directly and when discovered inside an import closure                       | `src/owl2vowl/js/index.test.js`                      |
| Static reachability      | The production graph, followed through both `import` and `require`, reaches no retained legacy module                | `src/productionGraph.architecture.test.js`           |
| Bundle reachability      | The production bundle contains no legacy exporter marker and does contain the structural builder                     | `npm run build`; inspection of `deploy/js/*.js`      |
| Real-corpus loading      | All 44 advertised corpus documents load through the production entry; the 11 Turtle documents fail explicitly        | `src/owl2vowl/test/productionCorpus.test.js`         |
| Legacy characterization  | The 44-fixture Java OWL2VOWL suite still exercises the legacy pipeline, unchanged                                    | `src/owl2vowl/test/differential.test.js`             |
| Legacy parity            | The structural path still matches the retained converter on its shared subset, including the `inferred` marker       | `src/owl2vowl/test/vowlBuilder.differential.test.js` |
| Consumer contract        | The existing WebVOWL graph parser consumes the production entry's result directly                                    | `src/owl2vowl/test/vowlBuilder.webvowl.test.js`      |
| Repository verification  | 100 suites and 1,289 tests passed; lint and format green                                                             | complete Jest run; `npm run lint`; `npm run format:check` |
| Performance              | Every production and pre-existing signal within the unchanged 20% threshold                                          | `docs/owlapi-js/performance/baseline.md`             |

One gate named by section 17.15 is **not** met. Production differential
acceptance requires the corpus differential to run the production path, and the
44-fixture suite runs the retained legacy pipeline. See "Outstanding gate".

## Findings and dispositions

| ID       | Applicability                             | Primary disposition      | Finding                                                                                                                                                          |
| -------- | ----------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `M8-001` | `TESTING`, `CROSS_CUTTING`                | `TEST_OR_FITNESS_UPDATE` | Rewriting an entry point in place silently retargets every test that imported it; the oracle must be given its own entry before the cutover, not after.           |
| `M8-002` | `TESTING`, `CROSS_CUTTING`                | `TEST_OR_FITNESS_UPDATE` | A reachability gate must follow every module system the application actually uses, and must ignore commented-out imports.                                         |
| `M8-003` | `TESTING`, `CROSS_CUTTING`                | `NO_CHANGE`              | A full suite passing through a total pipeline replacement is evidence of missing coverage, not of a safe change.                                                  |
| `M8-004` | `PERFORMANCE`, `TESTING`, `CROSS_CUTTING` | `PLAYBOOK_UPDATE`        | A start-of-run idleness guard cannot observe interference that begins mid-run; cross-signal corroboration, not the guard, is the control that holds.              |
| `M8-005` | `PERFORMANCE`, `TESTING`                  | `PLAYBOOK_UPDATE`        | The Phase 7 cross-signal identity was a coincidence of two different fixtures; the check is an order-of-magnitude corroboration and must not be stated as equal.  |
| `M8-006` | `TESTING`, `CROSS_CUTTING`                | `TEST_OR_FITNESS_UPDATE` | The cutover shipped with 21 of 29 real ontologies broken and every gate green, because no gate loaded a real document; six independent defects hid behind that.   |

### `M8-001` - the oracle needs its own door before the door is replaced

`src/owl2vowl/js/index.js` had five consumers, not the two production ones.
Three were tests: the 44-fixture Java characterization suite, the legacy-parity
comparisons, and the entry's own unit tests. Rewriting the module in place would
have retargeted all three at the new implementation.

The characterization suite would probably have failed loudly, since the new
output does not match a governed inventory of expected differences built against
the old one. The legacy-parity comparisons would not: they would have compared
the new path against itself and passed forever. That is the same silent
tautology recorded one phase earlier as `M7-005`, and it would have been
reintroduced by an ordinary in-place rewrite.

The legacy composition was therefore extracted verbatim into
`src/owl2vowl/test/legacyPipeline.js` and the consumers repointed **before** the
entry was touched. The 44-fixture suite staying green across that move, with an
unchanged diagnostic set, is what proves the extraction faithful. The same
principle applied to the development adapter: its acceptance tests were migrated
onto the production entry before the adapter was deleted, so no gate lapsed
between the two states.

### `M8-002` - a reachability gate must speak both module systems

The application layer is CommonJS and the ingestion layer is native ESM. A gate
that followed only `import` would have traversed almost nothing from
`src/main.js` and passed vacuously, which is the failure mode such a gate exists
to prevent.

Scanning for `require` immediately surfaced a second problem: `graph.js`
contains a commented-out `require` for a module that does not exist, so a naive
scanner fails to resolve it. Comments must be excluded, but only whole-line
comments: the codebase is full of namespace IRIs inside string literals, and
stripping every `//` corrupts them.

The gate was then verified the only way a gate can be: by breaking production on
purpose. Adding a `jsonExporter` import to `index.js` made it fail, and removing
it made it pass.

### `M8-003` - a green suite across a total replacement is a coverage report

The entire production ingestion pipeline was replaced and the full suite stayed
green on the first run. That was not reassurance. Inspection showed
`loadingModule.test.js` never references the ingestion entry and
`directInputModule.js` has no test at all, so nothing covered the seam that had
just been rewritten.

The application modules are DOM-bound at module scope and the runner is
configured for Node, so covering them directly needs a test-environment change
that is out of scope here. The gap is recorded rather than papered over: the
production entry itself is now covered in depth, and the consumer contract is
covered end to end through the real WebVOWL graph parser, but the two
application call sites remain uncovered.

### `M8-004` and `M8-005` - the guard is a filter, corroboration is the control

The first Phase 8 benchmark reported the production signal 89% above its
accepted baseline. The ADR 0003 pre-flight guard had sampled the machine at
process start, found it idle, and allowed the run. The guard is a start-of-run
check; it cannot see interference that begins afterwards.

The finding was never recorded, because the corroboration required by section
20.6 rejected it first. The cross-signal arithmetic was impossible, an isolated
repeat produced 1,928.00 ms with a 6% spread instead of 25%, and a standalone
probe of the production entry agreed. This is the second time in two phases that
corroboration, not the environment check, caught a false regression.

That corroboration also exposed an error in the Phase 7 record. It stated that
`owlapi-to-vowl` minus `end-to-end` matches the independently measured
`builder-only` signal, and in Phase 7 the numbers agreed to about a millisecond.
The agreement was accidental: `builder-only` builds the Functional Syntax
fixture's ontology while `owlapi-to-vowl` builds the RDF/XML fixture's, and the
two have different axiom mixes. In Phase 8 the same subtraction gives 47.52 ms
against an independently measured 143.05 ms. The check is a useful
order-of-magnitude corroboration and must be described as one.

### `M8-006` - the gate that did not exist is what made a broken cutover look complete

`M8-003` observes that a green suite across a total pipeline replacement reports
missing coverage. `M8-006` is the proof, and it is more serious than the
observation suggested.

The cutover was declared complete on a green suite. It was not complete: only 8
of 29 real RDF/XML-family ontologies loaded through the production entry. The
repository owner found it by loading `doap.rdf` in the development UI, which is
the one test no automated gate performed. Every existing suite ran focused
fixtures; none loaded a real document end to end.

`src/owl2vowl/test/productionCorpus.test.js` is the missing gate. It asserts one
test per corpus document with no aggregate threshold, so a single regression
cannot be absorbed by an overall pass rate. Its acceptance set is the pinned
oracle's own: every document OWL2VOWL 0.3.7 converted successfully must load.

Six independent defects were hiding behind the single symptom. Each is recorded
because the count is the finding: one broken gate concealed six unrelated
causes, and fixing any one of them would have left the corpus broken while
looking like progress.

| Cause                              | Layer         | Resolution                                                                             |
| ---------------------------------- | ------------- | -------------------------------------------------------------------------------------- |
| Anonymous class expressions unbuilt | `VOWLBuilder` | Build anonymous class nodes; collapse unrepresentable set expressions to `owl:Thing`     |
| Production parsed in strict mode    | Entry         | Default the production entry to compatible mode; strict remains available and unchanged |
| Cross-category property punning     | Translator    | Resolve deterministically by `data` > `object` > `annotation`; see ADR 0005              |
| Anonymous documents had no base IRI | Entry         | Resolve against the synthetic base `https://webvowl.invalid/` per RFC 3986 §5.1.4        |
| Multiple ontology headers rejected  | Translator    | Select the header whose IRI is the document's own, else the first; diagnose the choice   |
| OWL/XML language tag with datatype  | Parser        | Permit `xml:lang` with `rdf:PlainLiteral`, which the OWL 2 XML schema does not forbid    |

Two of the six are worth separating from the rest. The strict-mode default and
the missing base IRI were **our own configuration choices**, not defects in
parsing: the engine behaved exactly as asked and the ask was wrong. The other
four were genuine defects, and three of them made us stricter than the
specification rather than more permissive. That direction matters. A parser that
is too permissive fails visibly against a conformance suite; a parser that is too
strict passes every conformance suite it has and rejects real documents in
production. Only a corpus of real documents finds that class of defect.

## Outstanding gate

Section 17.15 requires production differential acceptance before the Phase 8
checkpoint, and section 18.8 defines the corpus differential as Java reference
output compared against WebVOWL output "through new architecture". The
44-fixture suite in `src/owl2vowl/test/differential.test.js` runs the retained
legacy pipeline, so it measures the engine that was replaced; it satisfied
section 18.8 only while the legacy pipeline was the architecture.

Phase 8 therefore does not close on this record. It closes when an equivalent
differential runs the production path against the same pinned oracle, with every
difference individually justified rather than inherited from the legacy
register. Turtle documents are out of that scope until Phase 9, so the first
production differential covers the 33 non-Turtle corpus documents.

Loading acceptance is not differential acceptance. The corpus gate proves the
production entry accepts every advertised document; it does not prove the output
matches what users saw under WebVOWL v1.1.7.

## Impact on Phase 9

Phase 9 implements the private N3.js adapter foundation and strict Turtle. It is
the first syntax added after the cutover, so it is also the first to extend a
live production surface rather than a development one.

Two consequences follow. Adding Turtle changes what the application advertises,
so the unsupported-format assertions in `src/owl2vowl/js/index.test.js` become
supported-format assertions and must be rewritten deliberately rather than
deleted. And the reachability gate now protects production directly: the N3.js
adapter must enter the graph through `owlapi-js`, never by reviving
`turtleParser.js`, which remains on disk for characterization only.

## Unresolved questions

One blocking: the production corpus differential recorded under "Outstanding
gate". Phase 8 cannot close until it exists and is green with governed
differences.

`M8-003` records that the two application call sites in `loadingModule.js` and
`directInputModule.js` remain uncovered because the runner has no DOM
environment. Closing it requires a test-environment decision that belongs to the
repository owner rather than to this phase. `M8-006` is the reason this gap is
not merely theoretical: the corpus breakage reached the repository owner through
exactly those uncovered call sites.

## Mechanically reviewable completion summary

- Migration: Phase 8 production WebVOWL cutover.
- Lesson record: `docs/owlapi-js/migration/lessons/007-production-cutover.md`.
- Finding IDs: `M8-001` through `M8-006`; every finding has exactly one primary
  disposition.
- Playbook changed: yes; the entry-rewrite, reachability-gate and
  measurement-corroboration rules are institutionalized and the next-migration
  section advances to Phase 9.
- Executable protections added: a production reachability gate covering both
  module systems, production entry acceptance tests including unsupported-format
  and import-closure rejection, a real-corpus loading gate asserting one test per
  document, and a legacy characterization composition that keeps the parity
  comparisons honest.
- Normative-change proposals: ADR 0005, cross-category property punning
  resolution, accepted.
- Resource-budget or regression-threshold changes: none; every signal is within
  the unchanged 20% threshold and no baseline was re-anchored.
- Unresolved blockers: one. The production corpus differential required by
  sections 17.15 and 18.8 does not exist; the retained 44-fixture suite measures
  the legacy pipeline. This record does not close Phase 8.
- Next migration: Phase 9, blocked until Phase 8 closes on production
  differential acceptance and the repository owner explicitly says to proceed.
