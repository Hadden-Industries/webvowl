# Canonical VOWL SLICE-005 checkpoint

## Scope and stop boundary

The owner requested a pause after SLICE-005 completes on 3 October 2026.
This checkpoint concerns the separate local candidate application on `feat/canonical-vowl`, based on commit `d77183ffa4c4dc52048df39b6c40f8b1562c0257`.
Production still uses its existing entry point.
No freeze, production cutover, publication, legacy retirement, commit or push is performed by this checkpoint.
The integration changes and preliminary SLICE-006 qualification files remain in the working tree.
The unrelated `skills-lock.json` deletions remain untouched.

## SLICE-005 acceptance map

| Requirement                       | Implementation and evidence                                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Explicit byte ingress             | OWL uses public parser capabilities and explicit format selection; canonical bytes are decoded; historical input requires the named migration dialect. The real browser harness exercises OWL and named legacy load, edit, capture, decode and restoration.                                |
| Worker ownership                  | Single-job workers own package admission, semantic changes and encoding. Import requests retain generation/revision context and budgets; cancellation and stale responses cannot commit a candidate.                                                                                       |
| Document and inspection ownership | Live package models own retained meaning and source evidence. Controller identity, semantic inspection, editable targets, runtime occurrence references and portable addresses remain distinct. Facts expose retained records beyond the drawing.                                          |
| Occurrence drawing and display    | The renderer receives the occurrence projection and shared display projector. All 46 independent display vectors are included in the final browser harness across English/German locale variants. Pins, hidden placements, camera and paused restoration are covered alongside ID changes. |
| Editing                           | Package-owned edits preserve unaffected constructs and annotations. The integration scenarios cover creation, deletion, annotated endpoints, prefix/label changes, explicit losses and selected merge placements. No controller normalization stage was added.                             |
| Exports and consumers             | Canonical JSON uses `.vowl.json`; original bytes and current retained Turtle use the approved package operations. SVG and LaTeX use the captured drawing. Human and WebMCP arrangement consumers share the runtime contract; experimental semantic editing remains outside WebMCP.         |

The detailed implementation, regression history and explicit bounded-review waiver remain in [the integration report](canonical-vowl-application-integration.md).
The waiver is not a claim of complete independent coverage.

## Input, asset and consumer disposition

| Surface                                             | Candidate disposition                                                                                                                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWL file, paste and remote source                   | Explicit syntax/base selection where needed; caller-owned import acquisition, closure retention and format-choice continuation.                                                                          |
| Canonical file or URL                               | Package byte admission; portable presentation restored.                                                                                                                                                  |
| Historical JSON                                     | Explicit named migration contract only; no shape-based dialect inference.                                                                                                                                |
| FOAF, GoodRelations, MUTO, OntoViBe, Personas, SIOC | Regenerated from the qualified pinned source closures with fresh layouts. All six named routes load. Exact content differences and hashes are in the regeneration report; historical files are retained. |
| Historical developer benchmark                      | Outside the supported named dialect; already excluded from production output. No new support claim.                                                                                                      |
| New ontology                                        | Candidate creates a new structural OWL source; it does not reuse the historical JSON template.                                                                                                           |
| Source share link                                   | A source link is not an edited-document snapshot. Edited content must be exported as canonical JSON.                                                                                                     |
| Original-source download                            | Exact retained bytes when available; explicit unavailability for artifacts that do not embed source bytes.                                                                                               |
| Turtle, SVG, LaTeX, JSON and WebMCP                 | Covered by the package, controller/runtime and real browser integration checks described above; no publication or external-client certification is inferred.                                             |

Asset regeneration is the local migration disposition required by SLICE-005.
Distribution remains gated on the recorded notices, SIOC notice scope and the unresolved Stanford `protege-dc.owl` import provenance.
Do not infer a licence from DCMI's notice or publish the asset set without resolving those obligations.

## Final verification and retained evidence

The evidence directory is `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/live-recovery-20261003-01/`.
The final execution receipt, exact source inventory and pause record are retained there as `slice005-completion*`.
The final receipt, rather than earlier run counts, determines the final check outcomes for this checkpoint.

- `slice005-final-browser-matrix.json`: Chromium 153, Firefox 155 and WebKit 26.6, each at desktop English/UTC and narrow German/Berlin settings, using the 61 integration checks plus 46 independent display vectors.
  The desktop variants also load all six built candidate examples.
  These are browser-engine tests on Windows, not Safari/macOS certification.
- `firefox-matrix-repaired-20261003.json`: the approved isolated Firefox replacement passed the original 61 checks in both variants.
  The shared cache was not modified; the install used a process-only browser path under the repository's ignored cache.
- `accessibility-native-focus-20261003.json`: nine built-candidate checks per engine for keyboard facts access, labelled section selection, full IRI text, modal background exclusion, Escape/focus restoration and narrow horizontal fit.
  This is not a screen-reader audit.
- `resource-qualified-20261003-final.json`: preliminary resource observations retained for SLICE-006; they do not accept a workload envelope or authorize default changes.
- `resource-limit-diagnosis.json`: the 2,000-class connected fixture's capture reaches `embeddedValues` 500,001 against the existing 500,000 default.
  Its OWL load succeeds.
  No limit was increased.

The first resource run failed to load because its dynamic test-worker URL was unsupported by Vite; no workload result is inferred from that timeout.
The harness now uses a static worker URL and records the current stage.
Accepted-artifact quad counts distinguish the base mapping from the compatible mapping's one extra quad per blank node.
Memory measurements sample the entire isolated browser process tree: they are sampled high-water observations, not exact allocation peaks or per-workload attribution.

The initial keyboard test incorrectly rejected native browser-chrome focus traversal.
The corrected test rejects focus reaching background page controls and permits browser-chrome traversal, following the [HTML sequential-focus-navigation model](https://html.spec.whatwg.org/multipage/interaction.html#sequential-focus-navigation).
No custom focus trap was added to change the native dialog behavior.

## Resumption

Resume at SLICE-006 only after the owner's instruction.
Preserve the current working tree and retained evidence; inspect it before changing anything.
Do not rerun the consumed Claude review or reinterpret its waiver as approval for future review iterations.
The remaining programme includes operating-envelope acceptance, complete accessibility/support reconciliation, exact freeze/publication decisions, candidate-to-production qualification, approved cutover and separately authorized legacy retirement.
The existing resource measurements include bounded large-input rejection and do not justify claiming those large captures are supported.
No publication gate is waived by marking the local integration slice complete.

The HISEW setup retry selected the matching loaded dev16 release and readback reported a ready engine and usable launcher.
The prior attempt's retained result reported process exit with code zero, but later inspection had no matching ready selection; that discrepancy was not treated as a product-test failure.
A fresh successful current-session hook event is separate from this launcher/readiness observation.

## Source-delivery follow-up

The owner subsequently authorized committing this checkpoint, integrating it into remote `main` through the normal PR route, and cleaning local task branches/worktrees.
This does not resume SLICE-006 implementation or authorize candidate production cutover.
PR #45 initially exposed CodeQL alert #4 in the B5 lexical namespace splitter.
Its optional-authority/path regular expression backtracked on a malformed long authority followed by a newline-containing fragment; a bounded subprocess regression timed out at two seconds before the repair.
Explicit delimiter scans now preserve lexical scheme/authority/path/query spelling without regex backtracking and retain rejection of the malformed fragment.
The repaired focused suite passes 49 tests, including all 46 independent display vectors, and the original adversarial probe completes promptly.
This demonstrates defensive hardening of the classifier, not proof that the malformed IRI can pass the package's admission boundary.
The source-delivery receipt in the external evidence directory records final verification, PR integration and cleanup; the historical pre-delivery checkpoint above remains intact.
