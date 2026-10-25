# Performance completion and UI handoff

## Delivery boundary

Architecture was accepted and published at `16e67c902e3438543f3ab520a40b45b2d9e2910a`.
The performance S2–S7/SF checkpoint is `528d8b821eb143b88fd761b4b4fa69647c983eab`.
The final performance commit containing this record adds the approved S8 count batching and renderer reuse, and the bounded-search repair found during final security review.
The destination remains `origin/feat/architecture-performance-ui`.
Publication does not establish a merge, deployment or hosted qualification.

The [performance plan](2026-10-21-performance-implementation-plan.md) and its accepted amendments govern the delivered scope.
Earlier evidence documents describe their own development checkpoints; this record supplies the final consolidated disposition.
The selected implementation, consolidated source verification and substantive final reviews are complete.
The native delivery readback binds the resulting signed commit to the published branch after this record is committed.

## Delivered capabilities and retained limits

| Slice | Disposition                                                         | What the UI stage inherits                                                                                                                  |
| ----- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| S0    | Diagnostic programme complete; foreground acceptance owner-deferred | Manifest-bound production harness, workload identities and retained baseline/control evidence                                               |
| S1    | Not selected on the recorded attribution evidence                   | Existing search-cue behavior; no new search index or promised first-query improvement                                                       |
| S2    | Implemented                                                         | Internal session-owned frozen inspection reads; independent owned copies from public inspection                                             |
| SF    | Implemented under the later maintainability approval                | One session-owned semantic read model for describe/focus/search/neighborhood/reveal preparation, preserving public limits and semantics     |
| S3    | Implemented                                                         | Lazy public document fields and released sequencing results; callers retain independent owned data                                          |
| S4    | Implemented                                                         | Drawing DTO no longer includes unused inspection data; canonical renderer contract remains authoritative                                    |
| S5    | Implemented                                                         | Native worker serialization preserves the isolation boundary without duplicate pre-send copies                                              |
| S6    | Implemented                                                         | Batched native text measurement; no persistent font/metric cache; documented native SVG rounding controls                                   |
| S7    | Implemented in its approved narrow scope                            | Fully validated checkpoint state proceeds to publication without redundant second validation; worker lifecycle and accounting remain intact |
| S8    | Implemented under PERF-DEC-012 option A                             | Batched count intent and bounded reuse in running, settled and manually paused layout; full reconstruction remains the fallback             |

Count range/step changes apply after one second without further input, or when Filters closes.
Exact count entry and presets remain immediate.
The controller publishes pending intent separately from the accepted count and holds layout temporarily without replacing the user's explicit Pause/Resume choice.
Document replacement, semantic revision, direct requests, visibility and disposal retain their currentness and cancellation rules.
Human export/share actions flush pending count intent before publishing; the synchronous share getter continues to read accepted state.

Reuse preserves unaffected primitives, DOM and measured text only within one accepted semantic revision and compatible presentation.
CSS/font changes, semantic or presentation changes and unsupported primitive changes use full rebuilding.
Installation failures reconstruct the previous accepted drawing; double failure retains runtime retirement.
The force algorithm, persisted formats and public semantic rules remain unchanged.

The S8 production diagnostics show work avoidance, active-layout behavior, export correctness and bounded retirement on FOAF and the connected 2,000-node workload.
The independent native geometry comparison is scoped to FOAF.
See [renderer reuse evidence](2026-10-23-performance-renderer-reuse-evidence.md) for counts, controls and limitations.
No foreground percentile, B3/B4/B5 numerical budget, universal device speedup or deployed improvement is claimed.
The owner's CPU exception and foreground timing deferral remain separate from correctness proof.

## Consolidated verification

The first final `npm run check` passed 9,928 tests in 172 suites before broad external/security review.
The security repair then passed its 60 focused tests and a second consolidated `npm run check`: **9,930 tests in 172 suites**, plus repository lint and formatting, 28 Python tests with two skips, three Markdown integration tests, seven JSON integration tests, the production build and generated-JSON check.
The second JavaScript suite took 310.073 seconds and its production build took 740 ms.
It used the repository's pinned Node 24.21.0 with npm 12.2.1.
The retained full log is `performance-full-check-2.log` in operator group `10aef354c03947d7a7550864eb5dd0a2`, SHA-256 `67b4f6787e966029eb46d30f00bd0a05424916af407a20bb2a1405d13418ceb3`; its separate exit record is zero.

The existing informational bundle-size warning remains visible.
No configuration or dependency change suppresses it.
GitHub run identifiers printed by fixtures are test data, not hosted CI evidence.
Final evidence/status prose receives exact-scope formatting and lint; it does not cause an unchanged product suite to run again for bookkeeping.

## Review findings and repair

The broad AGY review used Gemini Flash 3.8 High with a native 60-minute timeout after the first full check.
Its independent signed snapshot is `e7c34f3f3a2e98e102b3d8b1c150f0e6c38b94c0`; all 127 admitted source/evidence inputs have observed successful reads.
The original report, stream and failed qualification/admission attempts remain retained.
Its incorrect source paths, unsupported tooling claims and malformed negative probes are not promoted into verified facts.
Native review qualification was not established; the substantive review is retained under the owner's explicit HISEW bookkeeping exception.

| Finding                               | Disposition                                                                                                                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGY recovery-cache claim              | Refuted by the coordinator trace and narrow external follow-up: recovery materializes fresh elements, replaces the installed owner and clears its dirty set during redraw. Existing fault injection covers preparation and enter/update/exit/finish. No renderer change required. |
| AGY SVG rounding observation          | Already explained by the independent native precision and raster controls in the S6 evidence; no new renderer change required.                                                                                                                                                    |
| AGY foreground deferral               | Retained as the owner's explicit numerical-acceptance deferral, not a source defect or passed budget.                                                                                                                                                                             |
| Security bounded-search amplification | Fixed: apply the 25-reference public limit while iterating neighborhood facts, before cloning. Preserve the complete lazy internal answer and independent returned data.                                                                                                          |

The sealed Codex Security scan `f8435af2-b497-464e-b9b1-704fe5f32da2` covers all 69 changed paths in the broad frozen candidate.
It reports one low-severity resource-work amplification finding, with no other reportable candidate.
A valid 128-member equivalence group previously caused 127 references to be copied per selected match before a 25-entry response bound.
A separate 1,000-entry iterator regression observed all 1,000 visits where 26, including truncation lookahead, sufficed.
Both tests failed before the fix and pass after it.
This is bounded-work evidence, not a reproduced browser crash or maximum-size denial-of-service measurement.
The immutable scan preserves the original finding; the working-tree repair and subsequent verification are separate evidence.
Security token usage is unavailable from the native scan result.

The repair snapshot `8331e9ed657de6d58ce589098523197c8f53b62c` changes only the inspector and its two affected test files relative to the broad snapshot.
The narrow AGY follow-up receives those changes, complete related semantic sources, recovery excerpts/tests and the passed full-check log.
It completed with 20 successful input reads, accepted the repair and confirmed the recovery finding was a false positive; no actionable source finding remains.
Its process exited zero with complete capture and confirmed producer quiescence.
The unmodified report and audit are `agy-followup-report.json` and `agy-followup-audit-summary.json` in the final review group.
Remaining report overstatements are explicitly corrected there: returned nested references are independent owned copies, not universally deeply frozen; some line citations use presentation-part offsets; no practical maximum-size denial of service or additional collection run was measured.
The original mapped source and measured tests govern those facts.
The follow-up makes no native qualification claim and does not repeat denial probes.
No broad review or foreground benchmark is repeated for this search-only repair.

## Evidence, workflow and resumption

Raw performance evidence remains in its recorded operator groups, including `1aa50dbf88f44b05a24d9989246e6ada` for S7/SF and earlier retained controls, `59b30a65391942319612b9a002cac313` for S8, and `10aef354c03947d7a7550864eb5dd0a2` for final review/repair/full-check records.
Failed receipts and diagnostic attempts remain unchanged.
These are task evidence; neither a Git commit nor a workflow closure converts them into native HISEW verification receipts.
Resource retention and workflow closure have their own final native readbacks; this document makes no deletion or clean-inventory claim.

The owner requires **GPT-6.1 Sol with High reasoning** for the UI stage and explicitly requests a pause if this chat cannot switch itself.
The available chat tools do not expose a control to change the calling chat's own model.
Finish performance publication and its handoff records, then stop before UI acceptance work or implementation.
After the owner selects that model/effort and resumes, revisit [UI decisions DEC-001–021](2026-10-21-ui-design-implementation-plan.md) against these delivered contracts.
UI remains unapproved; this handoff closes no UI decision and starts no UI slice.
