# Phase 8 production-cutover lesson record

## Migration identity

- Migration: Phase 8 - production WebVOWL cutover.
- Baseline revision: `27dba50` (the repository-owner Phase 7 checkpoint),
  corrected by `9733cc9`.
- Completion revision: `817e9ca`, the repository-owner-approved Phase 8
  checkpoint.
- Implementation date: 18 August 2026, revised 19 and 20 August 2026.
- Next migration: Phase 9 - private N3.js adapter foundation and strict Turtle.

This record was written during the phase rather than at its close, so that the
findings were recorded while the evidence was fresh. The blocking gate it
described has since been met, and the section that described it has been
rewritten to say how. It became a closure record only when `817e9ca` gave the
phase a revision to close on.

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
| Bundle reachability      | The production bundle contains no legacy exporter or KRSS marker and does contain the structural builder             | `npm run build`; inspection of `deploy/js/index.js`  |
| Real-corpus loading      | All 44 advertised corpus documents load through the production entry; the 11 Turtle documents fail explicitly        | `src/owl2vowl/test/productionCorpus.test.js`         |
| Legacy characterization  | The 44-fixture Java OWL2VOWL suite still exercises the legacy pipeline, unchanged                                    | `src/owl2vowl/test/differential.test.js`             |
| Legacy parity            | The structural path still matches the retained converter on its shared subset, including the `inferred` marker       | `src/owl2vowl/test/vowlBuilder.differential.test.js` |
| Consumer contract        | The existing WebVOWL graph parser consumes the production entry's result directly                                    | `src/owl2vowl/test/vowlBuilder.webvowl.test.js`      |
| Production differential  | The 33 non-Turtle corpus documents compared against the pinned oracle through the production entry; every remaining difference justified per dimension | `src/owl2vowl/test/productionDifferential.test.js`; `docs/owlapi-js/compatibility/production-corpus-differences.json` |
| Repository verification  | 116 suites and 1,439 tests passed; lint, format and build green                                                      | complete Jest run; `npm run lint`; `npm run format:check`; `npm run build` |
| Performance              | Every production and pre-existing signal within the unchanged 20% threshold                                          | `docs/owlapi-js/performance/baseline.md`             |

Every gate named by section 17.15 is now met, including the production
differential that this record originally reported as outstanding. See "The gate
that was outstanding".

## Findings and dispositions

| ID       | Applicability                             | Primary disposition      | Finding                                                                                                                                                          |
| -------- | ----------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `M8-001` | `TESTING`, `CROSS_CUTTING`                | `TEST_OR_FITNESS_UPDATE` | Rewriting an entry point in place silently retargets every test that imported it; the oracle must be given its own entry before the cutover, not after.           |
| `M8-002` | `TESTING`, `CROSS_CUTTING`                | `TEST_OR_FITNESS_UPDATE` | A reachability gate must follow every module system the application actually uses, and must ignore commented-out imports.                                         |
| `M8-003` | `TESTING`, `CROSS_CUTTING`                | `NO_CHANGE`              | A full suite passing through a total pipeline replacement is evidence of missing coverage, not of a safe change.                                                  |
| `M8-004` | `PERFORMANCE`, `TESTING`, `CROSS_CUTTING` | `PLAYBOOK_UPDATE`        | A start-of-run idleness guard cannot observe interference that begins mid-run; cross-signal corroboration, not the guard, is the control that holds.              |
| `M8-005` | `PERFORMANCE`, `TESTING`                  | `PLAYBOOK_UPDATE`        | The Phase 7 cross-signal identity was a coincidence of two different fixtures; the check is an order-of-magnitude corroboration and must not be stated as equal.  |
| `M8-006` | `TESTING`, `CROSS_CUTTING`                | `TEST_OR_FITNESS_UPDATE` | The cutover shipped with 21 of 29 real ontologies broken and every gate green, because no gate loaded a real document; six independent defects hid behind that.   |
| `M8-007` | `TESTING`, `CROSS_CUTTING`                | `TEST_OR_FITNESS_UPDATE` | A differential measures only what its dimensions encode; keying on IRI hid a specification that draws one IRI many times, and no dimension saw nine discarded axioms. |
| `M8-008` | `CROSS_CUTTING`                           | `PROPOSED_NORMATIVE_CHANGE` | Assigning an output format to a reference implementation adopts its shape, not its meaning; twice the distinction had to be recovered after it was blurred.    |
| `M8-009` | `TESTING`, `CROSS_CUTTING`                | `PLAYBOOK_UPDATE`        | A shell pipeline discards the exit code and truncates the diagnostic, so a failing lint run was reported as clean; this is why `AGENTS.md` forbids pipelines.     |
| `M8-010` | `TESTING`, `CROSS_CUTTING`                | `TEST_OR_FITNESS_UPDATE` | A differential compares two renderings of one document; when they disagree about a single character, suspect the two inputs before suspecting the two engines.    |

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

### `M8-007` - a differential measures only what its dimensions encode

The production differential compares ten named dimensions. Twice during the
campaign it reported agreement on something it was structurally unable to
measure.

The comparator collected `properties[iri]` as a single entry. VOWL 2's Table 3
splitting rules draw `rdfs:Literal`, `rdfs:Datatype`, `owl:Thing` and
`rdfs:Resource` once per element they attach to, so one IRI legitimately becomes
many nodes - 651 generic node instances across ten documents where we emitted
44. Against a one-entry-per-IRI comparator, one arbitrary pair was compared and
the rest were invisible. The fix was to collect every edge for an IRI, compare
pairwise against unused matches, and collect `propertyTypes[iri]` as a sorted
set rather than a scalar.

The second instance had no fix available in the comparator at all.
`imarinetlo:name` states ten `rdfs:domain` axioms; the builder kept one and
discarded nine, while still creating a class node for each, leaving four nodes
with no edge touching them. Not one dimension moved. `classes` compares distinct
IRIs as a set, and the orphans are IRIs the document names anyway; `props`
compares an edge's two endpoints, and the edge had both. A rendering defect
affecting ten axioms and four nodes produced zero signal. It was found by
reading the document.

The residual limit is worth stating plainly, because the register's
authority depends on it: a green differential means the ten dimensions agree,
not that the renderings agree.

### `M8-008` - a format authority is not a semantic authority

ADR 0004 assigns the shape of VOWL-JSON to the reference implementation, because
the VOWL specification defines a visual notation and not a serialisation. That
assignment was twice read as something broader - licence to adopt what the
reference implementation's output *means* - and had to be recovered both times.

The first was axiom annotations. OWL2VOWL takes the extra annotations on an
`owl:Axiom` reification and promotes them onto the annotated entity. This was
reproduced, justified by ADR 0004 assigning VOWL-JSON to the implementation. The
repository owner rejected it: promoting them to the entity asserts of the entity
something the document asserts of one of its annotations, which is misleading
rather than merely different. ADR 0007 records the replacement, which nests them
under the annotation they belong to.

The second ran the other way. VOWL 2 defines no edge for `owl:allValuesFrom` or
`owl:someValuesFrom`, and the oracle draws one. The first recommendation was to
keep them, reasoning that the specification's own authors had extended it in
their implementation. That was withdrawn when the OntoViBe benchmark figure
showed WebVOWL 0.4.0 - described in the paper as a complete implementation of
VOWL 2 - drawing none of them. ADR 0006 records the narrower rule that survived:
follow the specification where it speaks and the oracle where it is silent, and
record the departure rather than inheriting it.

The distinction is short enough to state once. A format authority answers what a
field looks like. It never answers whether a claim is true of the thing the field
is attached to.

### `M8-009` - a pipeline converts a failure into a silent pass

`npm run lint | tail -1` was used to keep output short. It printed only npm's
trailing notice. ESLint's `'ANONYMOUS_CLASS_EXPRESSIONS' was used before it was
defined` was on a line above it, and a pipeline's exit status is its last
command's, so a failing lint run exited zero. More than one "lint clean" claim in
this phase was wrong for exactly that reason, and none of them looked wrong at
the time.

`AGENTS.md` already forbids pipelines, chaining and command substitution. The
rule had been read as a constraint about the host environment's shell. It is
also a correctness constraint: any construct that discards a command's exit
status or truncates its output can turn a red gate green without anyone lying.
Run the command whole, and read the whole output.

### `M8-010` - when two renderings disagree by one character, suspect the inputs

`skos:notation`'s `scopeNote` differed between the oracle and the production path
by a single trailing full stop. The natural reading is a rendering difference,
and the corpus register briefly carried an entry saying so.

The signal that it was not came from the oracle contradicting itself. The
reference output for `ontology_v3.3.rdf`, which reaches that annotation only
through `owl:imports` of SKOS, carried the full stop; the reference output for
`skos.rdf`, rendered from a local file, did not. One engine at one version
cannot render one sentence two ways, so the two runs had been given different
documents. OWL2VOWL resolves `owl:imports` over the network - the fixture
generator passes no catalog and no IRI mapper, so OWLAPI takes its default route
- and had therefore fetched canonical SKOS for the import while being handed a
stale local copy for the direct conversion.

The repository owner replaced the corpus copy with the canonical document from
`http://www.w3.org/2004/02/skos/core.rdf`. The `skos.rdf` reference output was
then regenerated against the same pinned 0.3.7 jar, which is legitimate because
the pin is on the oracle's version rather than on its output bytes: a reference
output means what that version produces for that document, so when the document
changes the output must follow or it describes a file the corpus no longer
contains. Both register entries were deleted, and the difference is now absent
rather than justified.

`ontology_v3.3.rdf` was deliberately **not** regenerated. It resolves imports
over the network, so regenerating would make a pinned acceptance artifact depend
on what `geovocab.org` serves on the day. A scratch regeneration confirmed zero
structural difference from the committed fixture, so nothing was owed. The
asymmetry is principled: `skos.rdf` declares no imports, so its conversion is a
pure function of a local file and a pinned jar.

The general lesson is that a reference output is a function of two things, an
input and a version, and only one of them was being pinned attentively.

## The gate that was outstanding

Section 17.15 requires production differential acceptance before the Phase 8
checkpoint, and section 18.8 defines the corpus differential as Java reference
output compared against WebVOWL output "through new architecture". The
44-fixture suite in `src/owl2vowl/test/differential.test.js` runs the retained
legacy pipeline, so it measures the engine that was replaced; it satisfied
section 18.8 only while the legacy pipeline was the architecture. That suite is
retained unchanged as the historical baseline.

`src/owl2vowl/test/productionDifferential.test.js` is the gate section 18.8
actually asks for. It runs `loadWithImports`, which is what
`src/app/js/loadingModule.js` calls for every document a user opens, over the 33
non-Turtle corpus documents, and compares each against the pinned OWL2VOWL 0.3.7
reference output on ten dimensions. Turtle is excluded rather than registered as
a difference: those 11 documents do not differ from the oracle, they are not yet
supported at all, and conflating the two would let a missing syntax masquerade
as an accepted divergence.

Every remaining difference is justified **per dimension** in
`docs/owlapi-js/compatibility/production-corpus-differences.json`. Per dimension
is the load-bearing part: a document commonly differs for several unrelated
reasons, and one entry covering all of them would let an unanalysed difference
pass as governed because a different difference in the same document had been
explained. A justification for a dimension that no longer differs is stale and
fails the suite, which is how the two SKOS entries described in `M8-010` were
caught and removed rather than left behind as a false record.

The register's standing policy is that the oracle is the default contract,
because upstream WebVOWL v1.1.7 delegated to it and transparency is defined
against what users saw there. The exception is a specification: where the oracle
contradicts one, `owlapi-js` follows the specification and the divergence is
recorded rather than copied. The largest single class of recorded difference is
the oracle substituting `owl:Thing` for a domain or range the document states,
which VOWL 2 permits only where no such axiom exists or where the author named
`owl:Thing` themselves; it accounts for differences in `foaf.rdf`, `org.rdf`,
`sioc.rdf`, `imarinetlo.owl` and `ontology_v3.3.rdf`.

Loading acceptance is not differential acceptance, and this distinction is why
the phase stayed open. The corpus gate proves the production entry accepts every
advertised document; only the differential proves the output resembles what
users saw under WebVOWL v1.1.7.

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

None blocking. The production corpus differential that blocked this record now
exists and is green with every difference governed per dimension.

Three non-blocking items remain open, all recorded rather than resolved.

Ten `owl:Axiom` reifications in the corpus have no home under ADR 0007's rule:
five on `rdfs:subPropertyOf`, two on `rdfs:range`, one on `rdfs:domain` and two
on `dcat:distribution`. ADR 0007 nests an axiom's extra annotations under the
annotation the reification identifies, which requires the reified axiom to be an
annotation assertion. These ten reify structural axioms instead, so there is no
annotation to nest under. They are consumed and recorded; no information is
asserted of the wrong subject, which was the defect ADR 0007 exists to prevent.

Nested annotations are not yet rendered. ADR 0007 makes the VOWL output carry
them, and `src/webvowl/js/sidebar.js` displays only the flat form, so the
information is preserved in the data and invisible in the interface. The
repository owner assigned this to the UI/UX workstream rather than to this
phase.

`M8-007` records that a green differential means its ten dimensions agree, not
that the renderings agree. Widening the dimensions further is possible but was
not attempted here.

`M8-003` records that the two application call sites in `loadingModule.js` and
`directInputModule.js` remain uncovered because the runner has no DOM
environment. Closing it requires a test-environment decision that belongs to the
repository owner rather than to this phase. `M8-006` is the reason this gap is
not merely theoretical: the corpus breakage reached the repository owner through
exactly those uncovered call sites.

## Mechanically reviewable completion summary

- Migration: Phase 8 production WebVOWL cutover.
- Lesson record: `docs/owlapi-js/migration/lessons/007-production-cutover.md`.
- Finding IDs: `M8-001` through `M8-010`; every finding has exactly one primary
  disposition.
- Playbook changed: yes; the entry-rewrite, reachability-gate and
  measurement-corroboration rules are institutionalized, the pipeline
  prohibition in `AGENTS.md` is restated as a correctness rule rather than a
  shell-compatibility one, and the next-migration section advances to Phase 9.
- Executable protections added: a production reachability gate covering both
  module systems, production entry acceptance tests including unsupported-format
  and import-closure rejection, a real-corpus loading gate asserting one test per
  document, a legacy characterization composition that keeps the parity
  comparisons honest, and the production corpus differential with its
  per-dimension register, whose staleness check fails the suite when a
  justification outlives the difference it justified.
- Normative-change proposals: ADR 0005, cross-category property punning
  resolution, accepted and twice amended; ADR 0006, restriction edges as a
  documented departure, accepted; ADR 0007, axiom annotations nest on the
  annotation, accepted.
- Resource-budget or regression-threshold changes: none; every signal is within
  the unchanged 20% threshold and no baseline was re-anchored.
- Corpus or oracle changes: one. `skos.rdf` was replaced with the canonical
  document it advertises and its reference output regenerated against the same
  pinned OWL2VOWL 0.3.7 jar; see `M8-010`. No other reference output was
  regenerated and the oracle version is unchanged.
- Unresolved blockers: none. Three non-blocking items are recorded under
  "Unresolved questions": ten reifications of structural axioms with no home
  under ADR 0007, the unrendered nested annotations assigned to the UI/UX
  workstream, and the dimensional limit of the differential recorded as
  `M8-007`.
- Next migration: Phase 9, to begin when the repository owner explicitly says to
  proceed.
