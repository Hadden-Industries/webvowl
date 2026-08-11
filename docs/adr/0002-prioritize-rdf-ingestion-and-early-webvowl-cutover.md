# ADR 0002: Prioritize RDF ingestion and early WebVOWL cutover

| Metadata       | Value                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                                                    |
| **Date**       | 2026-08-11                                                                                                  |
| **Decider**    | Repository owner                                                                                            |
| **Supersedes** | The future-phase order and prerequisites previously recorded in `docs/owlapi-js/implementation-plan.md` §17 |

## Context

Phases 0 through 4 of the `owlapi-js` extraction established governance, the
structural core, and direct Functional Syntax, Manchester Syntax, and OWL/XML
parsers. The original remaining order scheduled DL Syntax and KRSS before the
shared RDF ingestion path, scheduled the N3.js-backed RDF formats before
RDF/XML, and delayed WebVOWL's structural-ontology cutover until after every v1
ingestion format and the OWL-to-RDF translator.

That order maximized continuity between structural text parsers, but it delayed
the formats most frequently encountered by WebVOWL users and kept the
production application dependent on the legacy RDF/XML interchange pipeline
longer than necessary. RDF/XML is the primary practical workload, followed by
Turtle. Both require a canonical RDF/JS representation and one shared,
standards-based RDF-to-OWL reconstruction module before they can enter the new
pipeline.

The production cutover does not require every legacy format replacement or the
OWL-to-RDF translator. It requires a complete structural ingestion path for the
formats then advertised by the application, an OWL-native `VOWLBuilder`,
differential acceptance, explicit rejection of unsupported formats, and proof
that the production import graph cannot reach the legacy implementation.

N3.js is the selected implementation dependency for four separate standard RDF
syntaxes. Those syntaxes are sibling parser modes rather than implementation
prerequisites for one another. N3.js also implements the broader Notation3
language, but that capability is outside the approved v1 scope.

## Decision

1. After the completed Phase 4 checkpoint, Phase 5 implements the canonical
   RDF ingestion contract and a baseline-complete shared `RdfToOwlTranslator`
   before any new RDF syntax adapter is activated.
2. Phase 6 implements RDF/XML as the first production RDF adapter and hardens
   the shared translator against that real path. RDF/XML-specific code may
   parse syntax and normalize RDF/JS quads; it must not contain private OWL
   reconstruction rules.
3. Phase 7 integrates `OWLOntology` consumption and `VOWLBuilder` into the
   development application and end-to-end test surface without changing the
   production default for that checkpoint.
4. Phase 8 performs the production cutover. The existing WebVOWL entry point is
   rewired to `owlapi-js -> OWLOntology -> VOWLBuilder`, with no runtime legacy
   fallback. A static reachability gate must prove that the production graph
   cannot import legacy parser, RDF/XML-interchange, converter, or exporter
   modules through the old path.
5. Phase 8 does not move, rename, or delete legacy files. They remain at their
   current paths for characterization tests and implementation reference until
   the later deletion phase. They are not production-reachable after cutover.
6. The post-cutover application advertises only formats implemented by the new
   path. Unsupported legacy-only formats fail explicitly, including when
   encountered in an import closure.
7. Phase 9 introduces one private, format-locked N3.js adapter implementation
   and exposes strict Turtle only. It must select Turtle explicitly because the
   N3.js default parser mode is a permissive superset. Parser-specific terms,
   streams, configuration, and errors remain behind the existing RDF syntax
   seam.
8. N3.js is conditionally loaded after Turtle parser selection. Large inputs
   use a bounded streaming/chunking strategy with abort, timeout, backpressure,
   quad-count, and cooperative browser-yield checks. Chunk policy and any
   direct dependency need must be justified by browser and Node measurements;
   production code must not import an undeclared transitive dependency.
9. N3-language formulae, implication/rules, quantification, built-ins, and
   other Notation3-only semantics must be rejected by the strict Turtle path.
   `parser.n3-language` remains `DEFERRED` with no implementation phase.
10. After Turtle, work returns to DL Syntax and the KRSS family. The remaining
    N3.js-backed standard formats then proceed as N-Triples, N-Quads, and TriG.
    This order proves the strict line-oriented graph case, then the
    line-oriented dataset case, then the combination of Turtle-style syntax
    with named-graph dataset semantics.
11. JSON-LD completes v1 ingestion. The shared OWL-to-RDF translator follows.
    Physical legacy deletion occurs only after all planned replacement and
    reference work is complete. Standalone package/release work remains last.
12. Every phase remains sequential, completes its applicable acceptance and
    learning gate, and pauses for a Git checkpoint before the next phase starts.

The resulting future-phase order is:

```text
Phase 5   RDF/JS ingestion + shared RDF-to-OWL reconstruction
Phase 6   RDF/XML adapter + first-real-adapter hardening
Phase 7   early development-app integration
Phase 8   production WebVOWL cutover; legacy retained in place but disconnected
Phase 9   private N3.js adapter foundation + strict Turtle
Phase 10  DL Syntax
Phase 11  KRSS family
Phase 12  N-Triples
Phase 13  N-Quads
Phase 14  TriG
Phase 15  JSON-LD
Phase 16  shared OWL-to-RDF translator
Phase 17  physical legacy deletion
Phase 18  standalone package/release
```

## Rationale

The revised order delivers the primary WebVOWL workload and removes the
production dependency on the legacy pipeline at the earliest point supported
by a complete semantic path. It does not weaken the architecture to achieve
that result: RDF syntax adapters still stop at canonical RDF/JS, and exactly
one shared translator owns OWL reconstruction.

Turtle becomes the second real RDF adapter, after RDF/XML. That makes the RDF
syntax seam concrete rather than hypothetical and supplies cross-adapter
structural-equivalence evidence. Keeping the N3.js family implementation
private avoids a new public interface while still localizing the four strict
format modes behind one dependency-specific implementation.

Splitting the RDF conformance manifest by syntax allows each phase to classify
and pass its complete upstream scope without being blocked by, or accidentally
claiming completion for, a later syntax.

## Consequences

### Positive

- WebVOWL can use the new OWL model for RDF/XML considerably earlier.
- Production stops importing the legacy path before all secondary formats are
  migrated.
- Turtle follows immediately after cutover without a Turtle-specific semantic
  fork.
- Format-specific parsing, shared RDF reconstruction, and VOWL conversion have
  independently testable interfaces.
- N3.js bundle and main-thread costs are paid only by RDF formats that use it.
- Legacy code stays available for finite reference work without remaining a
  production fallback.

### Negative and mitigations

- The cutover temporarily contracts the set of formats advertised by the
  application. Unsupported formats must produce explicit diagnostics; they
  must never fall through to legacy code.
- Phase 5 is substantial because RDF-to-OWL reconstruction must be complete
  enough for production before RDF/XML begins. Its mapping inventory,
  constructed-dataset tests, Java differential fixtures, resource limits, and
  learning gate are mandatory rather than deferred into syntax adapters.
- Early integration and production cutover are separate checkpoints. Any
  temporary development-only invocation added in Phase 7 must be removed or
  made non-production-reachable in Phase 8.
- Splitting the N3.js family across phases adds several small gates. The shared
  private implementation established with Turtle prevents duplicated adapter
  logic while each public format retains independent identity and conformance.

## Superseded alternatives

| Alternative                                           | Reason not selected                                                                                       |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Continue with DL and KRSS immediately after OWL/XML   | Delays primary RDF/XML and the production cutover.                                                        |
| Implement RDF/XML before shared RDF/JS and RDF-to-OWL | Would force syntax-local OWL reconstruction or recreate an interchange bridge.                            |
| Migrate all N3.js formats before RDF/XML              | Delays the primary user workload and is not required by the dependency.                                   |
| Implement all N3.js formats in the Turtle phase       | Delays user-visible Turtle completion and couples independent format claims to one gate.                  |
| Implement N-Triples before prioritized Turtle         | Grammatically tidy but unnecessary when N3.js owns both strict modes; it conflicts with product priority. |
| Keep a production legacy fallback after cutover       | Preserves the old architecture and makes unsupported-format behavior ambiguous.                           |
| Move legacy files to a quarantine directory           | Creates temporary rewiring for files that will later be deleted and risks obscuring historical imports.   |
| Delete legacy files at cutover                        | Removes useful characterization/reference material before the remaining migrations are complete.          |

## Verification obligations

- Machine-readable capability phases match the sequence above.
- Each RDF syntax owns an independently identifiable conformance scope.
- `parser.n3-language` remains deferred and phase-less.
- RDF/XML and Turtle adapter tests stop at canonical RDF/JS before shared
  reconstruction tests begin.
- Paired RDF/XML/Turtle documents produce structurally equivalent ontologies
  and VOWL output, subject only to approved exact differences.
- The Phase 8 production graph has zero reachability to the legacy path.
- Unsupported formats and imports fail explicitly after cutover.
- Initial bundle, lazy N3.js chunk, first-use latency, wall time, heap, abort,
  and browser responsiveness measurements pass the approved gates.

## Implementation map

| Path                                                       | Role                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `docs/owlapi-js/implementation-plan.md`                    | Current normative architecture, phase contracts, and acceptance gates |
| `docs/owlapi-js/compatibility/capabilities.json`           | Required capability-to-phase assignments                              |
| `docs/owlapi-js/conformance/classification-manifests.json` | Independent upstream conformance ownership                            |
| `docs/owlapi-js/dependency-governance.json`                | Pinned dependency phase, evidence, and browser-cost records           |
| `docs/owlapi-js/migration/migration-status.md`             | Current checkpoint and next-phase state                               |
| `docs/owlapi-js/migration/parser-migration-playbook.md`    | Current Phase 5 execution handoff                                     |
