# Performance qualification follow-up

This follow-up qualifies the implementation merged by PR71 at `099e1cbacf182c58acd987608795d07f80a73f1e`, against protected baseline `7ade35531b379b4fc9ffe71e1e44c32afc90acd7`.
HISEW execution `1f8737ce-7c82-4b24-873b-141f3d5f7f46` retains the accepted requirement snapshot, R2 route and final verification obligation.
The work changes verification tooling and evidence documentation; it does not migrate additional production constructors.

## Heap-retainer qualification

The previous WeakRef-only observation is supplemented by actual Chrome 155.0.8059.40 / V8 15.5.35.20 main-target heap snapshots, using a dedicated task profile and native Windows Job containment.
The fixture intentionally holds seven named live owners at a checkpoint, then removes that instrumentation root and finishes ten load/search/reveal/export/clear/edit/reload/dispose cycles.
The live snapshot contains every positive control and its strong root path.
Stable V8 object IDs identify session 195533, controller 199943, runtime 195523, graph 188723, worker-client 195987, scene 195995 and search-preparation 204185.
All seven IDs are absent from the retirement snapshot, so none has a surviving strong retainer path.
None of 90 weakly observed retired owners remains live after that snapshot.
The native process exited 0 with `producersQuiescent:true`; both snapshots and the substantive analysis are retained.

This closes the missing main-target retainer-path observation for the exercised lifecycle, not a claim that every supported ontology or native allocation is leak-free.
The worker client creates and terminates a worker for each operation; no dedicated worker target was present at either idle capture.
Worker-isolate and native allocation sizes are not inferred from main-target heap totals.
The positive-control graph contains five occurrence elements with 376 own function properties, totaling 12,032 shallow function bytes; after retirement no such elements remain.
These counts show allocation opportunities but are not projected retained-memory savings for a migrated family.
Two PlainLink-named objects remain in both snapshots, with four own function properties in total.
This is consistent with the module-owned ArrowLink/BoxArrowLink prototype objects, whose own methods are `constructor` and `draw`; that identification is an inference from the census and source.
The live graph's ArrowLink cohort is absent after retirement.

The first native attempt timed out before reaching its live checkpoint and remains retained as a failure.
The second attempt foregrounded the page and completed after dependency preparation, with all lifecycle checks passing.
The connector's snapshot path restriction was not changed; the isolated native browser wrote directly to the allocated evidence store.
Snapshot comparison and retainer interpretation follow [Chrome's heap-snapshot guidance](https://developer.chrome.com/docs/devtools/memory-problems/heap-snapshots).

## Latency qualification

Every admitted run passed the unchanged 10% CPU-busy preflight over 500 ms, after a 30-second settling period.
Rejected preflights and two incomplete browser fixture attempts are retained; their timings are excluded.
The fixture attempts failed on missing renderer/artifact-service dependencies and were corrected before the complete comparison.
The maintained harness now supports an explicit bounded wait for an idle window and an optional settling period, preserving the original guard and default behavior.

The isolated Node 24.21.0 run alternates baseline/candidate order over nine paired samples after warmup and checks complete answer equality.
The largest measured scene has 10,000 occurrences; the synthetic inspector fixture has 100,000 records.

| Isolated boundary              | Baseline median | Candidate median | Candidate p95 |
| ------------------------------ | --------------: | ---------------: | ------------: |
| Arrange, 10k occurrences       |     2,398.92 ms |         10.38 ms |      13.44 ms |
| Reconcile, 10k occurrences     |       195.18 ms |         48.11 ms |      53.63 ms |
| Search, 100k inspector records |       279.53 ms |          9.82 ms |      11.11 ms |

The targeted median improvements exceed QA-002's 25% target.
The synthetic warmed-search p95 meets QA-005's 100 ms target; candidate preparation is reported separately at 74.63 ms.
This record fixture does not claim canonical admission of a 100k-record ontology.

Four browser cohorts run in baseline/candidate/candidate/baseline order, each with one warmup and five measured fresh controllers per fixture.
They use identical FOAF/benchmark bytes, dependency lock, harness, browser and 800 by 600 graph viewport.
The baseline source is a detached archive of the protected commit with shared read-only installed dependencies.
All complete ordered search answers, including totals, truncation flags, references and focusability, agree across all four cohorts; visible node counts agree too.
Each pooled row below has ten load/first-query samples per version and 300 warmed query calls per version.
Quantiles use nearest rank, preserving all samples and the per-cohort breakdown in the evidence.

| Browser boundary              | FOAF baseline | FOAF candidate | Benchmark baseline | Benchmark candidate |
| ----------------------------- | ------------: | -------------: | -----------------: | ------------------: |
| Load-to-frame-pair median     |      589.3 ms |       577.3 ms |         2,382.4 ms |          2,278.8 ms |
| Load-to-frame-pair p95        |    1,105.3 ms |       690.5 ms |         3,760.0 ms |          2,652.4 ms |
| First controller query median |        2.7 ms |         0.2 ms |             4.6 ms |              0.4 ms |
| Warmed controller query p95   |        4.8 ms |         0.2 ms |             6.9 ms |              0.4 ms |

The measured load boundary starts at `controller.loadOntology` and ends after completion followed by two animation frames; it is a drawing/paint scheduling proxy, not a browser Paint Timing entry.
Both small-corpus medians improve and satisfy QA-002's maximum regression of the larger of 10% or 25 ms.
No threshold breach requires a corroborating rerun.
The retained environment, paired results and existing targets supply GATE-002's requested qualification evidence for this implementation.
Development-server measurements do not establish production navigation, Core Web Vitals or an absolute first-paint SLA.

## Constructor expansion decision

The PlainLink pilot's equal-live-object allocation result is corroborated in the new admitted Node run.
At 100,000 live links, retained heap delta falls from 172,011,208 to 110,355,176 bytes (35.8%), and the nine pilot function identities fall from 900,000 to 9.
This exceeds QA-007's proposed 20% pilot reduction; it remains an isolated equal-live-object result, not browser whole-graph savings.
It does not demonstrate receiver compatibility or retained-heap benefit for every node/property/label family.
In particular, `Label` directly aliases `property.frozen`, `property.locked` and `property.pinned`.
Those functions currently capture their owning property; changing them mechanically to methods whose private state is keyed by the calling label would break this contract.
BaseElement/BaseNode/BaseProperty also combine mutable instance state, fluent accessors, overrides and callback identities; Label already shares substantial behavior on its prototype.

The assessment is to retain the pilot and decline broader constructor expansion in this programme.
A future coherent family requires its own measured equal-live graph comparison and receiver/callback proof, including the label/property alias contract, before selection.
GATE-004's expansion condition is therefore not exercised; no wider migration or owner approval of that trade-off is inferred.
Independent review of the frozen candidate and its evidence is retained with HISEW's final handoff rather than asserted in advance here.

## Reproduction and retained evidence

Use `util/benchmark-canonical-performance.mjs` with `--expose-gc`, the protected baseline and an allocated output filename.
`--settle-ms=30000 --wait-for-idle-ms=3600000` waits without weakening the CPU guard; every rejected preflight is printed and retained in an admitted result.
`util/qualify-canonical-browser.mjs` accepts an installed Chrome executable, dedicated task profile and allocated evidence directory.
Its default mode runs the heap lifecycle checkpoint; `--latency` runs the guarded FOAF/benchmark cohort in the selected source checkout.
`util/analyze-canonical-heap.mjs` compares the live and retired snapshots, retaining strong paths for all positive controls and any survivor.

Raw evidence, including failures, is retained under `C:/Users/maksy/.hi/w/e/operator/c72016ed20e14414a99653b05d9e5943/`.
`paired-attempt-05.json` contains the admitted Node samples, source hashes and separate preparation/allocation results.
`latency-attempt-04-{1-baseline,2-candidate,3-candidate,4-baseline}/browser-qualification.json` contains every browser sample and complete answer; `latency-summary.json` binds and compares those receipts.
`browser-attempt-02/` contains the two heap snapshots and their lifecycle/retainer analysis.
Native process receipts and HISEW verification records keep their own provenance; supplemental measurement reports are not relabelled as engine-verified tests.
