# Rendering performance follow-up implementation

This implements the selected direct repairs and legacy motion restoration from [the accepted follow-up plan](plans/2026-10-09-rendering-performance-follow-up-plan.md).
The plan was committed first as `9a90ade5fd6099a74ebded8328b9db0ffd1e2ba4`.
The already-approved OwlAPI Git adoption was committed separately as `4ef3e7c5932be0f3188b85764c640a05699731a4`, following the owner's explicit instruction to publish it before the rendering implementation.
No other repository was changed.

## Selected changes

Tick and end events now read scalar force status directly.
They retain generation, alpha, pause and natural-end facts without enumerating coordinates.
Explicit layout snapshots still return the complete current positions.
The controller publishes a new immutable state only when the derived layout status changes; native runtime events retain their cadence.
During an export wait, non-ending events no longer trigger a redundant full snapshot beside the animation-frame observer.
Terminal events still check the current generation's authoritative snapshot.
Stable-frame thresholds, timeout dispositions, cancellation and capture ownership are unchanged.

Renderer setup groups unordered endpoint pairs with object-identity Maps, shares ordered layer and loop arrays, builds node incidence once and appends force link parts without repeatedly copying the accumulated array.
Property-ID deduplication, inverse grouping, true self-loop metadata, independent canonical labels and encounter order retain their previous meaning.
Indexes are local to the preparation call and cannot retain a retired drawing.

The internal solver restores legacy link relaxation, one-pass gravity, Barnes–Hut charge, position Verlet integration, initialization, cooling and reheating.
It replaces the modern center/x/y combination without changing application-wide D3, drag, zoom, canonical topology or saved placement contracts.
Style settings are applied before startup because the legacy algorithm caches charge and link parameters when it starts.
Hidden-load progress uses the legacy alpha scale.

## Source reuse and behavioral proof

The exact reference is the untouched [D3 3.5.17 distribution](https://raw.githubusercontent.com/d3/d3/v3.5.17/d3.js), retained only as a test fixture.
Its SHA-256 is `0c0b24005903a9d71beb93837fc1fc618b81780f14601c729030227c16b3ef51`.
The bounded production adaptations are in [legacyForceSimulation.js](../src/webvowl/js/runtime/legacyForceSimulation.js) and [legacyForceQuadtree.js](../src/webvowl/js/runtime/legacyForceQuadtree.js).
They derive from the [force source](https://raw.githubusercontent.com/d3/d3/v3.5.17/src/layout/force.js) and [quadtree source](https://raw.githubusercontent.com/d3/d3/v3.5.17/src/geom/quadtree.js).

Modern D3 force composition remains maintained and suitable for modern motion, but combines velocity integration and different spring, centering, charge approximation and annealing behavior.
Removing its center force or merging its x/y loops cannot reproduce the required legacy equations.
Application-wide dependency downgrading would also change current interaction APIs.
The selected reuse therefore confines the old algorithm to the current private runtime seam and uses modern D3 timer/dispatch for scheduling and listeners.
Unused legacy drag/zoom, spatial search and quadtree configuration APIs are omitted.

Two adapters are deliberate: canonical `fx`/`fy` targets become the previous-position targets used by the legacy integrator, and `stop()` cancels scheduling without reporting a natural end.
Natural cooling sets alpha to zero and emits end; resume reheats to `0.1`.
The end threshold is the legacy `0.005`.
There is no global random-number override in production.
Tests give each implementation an independent equal seeded stream, including coincident-point jitter and missing-coordinate initialization.

The small fixtures compare every step exactly, without geometric normalization or a numerical tolerance.
They cover fresh load, coincident points, real labels, settled resume, changed distances, dragging and release.
A separate hand-worked single-node gravity/Verlet case rejects unconditional centroid translation.
A representative 668-node/775-label fixture compares untouched legacy state against real current renderer elements through 300 ticks and pin/release checkpoints.
Existing modern numeric-forwarding coverage remains as an independent label-accessor contract test.

The BSD 3-Clause copyright, conditions and disclaimer are retained in both adapted source modules and beside the untouched fixture.
The same notice is distributed as `data/legacy-force-BSD-3-Clause.txt` through the existing static-asset copy path.
No package, lockfile, bundler or CI change was needed for the renderer restoration.
The earlier, separately approved OwlAPI manifest/lock transition is recorded in [its adoption document](owlapi-git-adoption.md).

## Disposition of all planned slices

| Slice | Disposition and evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 000   | Retained the accepted baseline, immutable legacy oracle and fixture identity; kept browser observations separate from timing acceptance.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 001   | Implemented. Real renderer tick/end callbacks make no full-snapshot request; explicit coordinates remain complete.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 002   | Implemented. Repeated alpha events with unchanged derived status preserve controller state identity and do not notify subscribers; real status transitions do.                                                                                                                                                                                                                                                                                                                                                                                                  |
| 003   | Implemented the faithful bounded legacy solver. Exact reference and hand-worked checks establish force behavior; production preview checks establish current interaction and export compatibility.                                                                                                                                                                                                                                                                                                                                                              |
| 004   | Implemented pair/loop indexing, incidence and ordered flattening. Hand-enumerated metadata tests cover reversed pairs, self-loops, semantic equality versus object identity, inverse and repeated-ID handling, mixed link kinds and refresh isolation. A 1,000-distinct-pair check observes 2,000 metadata endpoint reads. Real MUTO incidence/force-input tests independently check ordered endpoints and labels. The old-label fallback index is deferred: canonical finite placements already bypass it, and first-match equality would need separate proof. |
| 005   | Implemented the non-ending event guard. Twenty ordinary tick events cause no event-path coordinate reads; authoritative native end still resolves immediately. Further buffer/Map reuse is deferred without evidence that its benefit exceeds ownership complexity.                                                                                                                                                                                                                                                                                             |
| 006   | Deferred. Geometry strings, rounding, degeneracy handling and positionability are preserved. No qualified post-fix timing isolates geometry preparation as the remaining material cost.                                                                                                                                                                                                                                                                                                                                                                         |
| 007   | Deferred. Exact write caching needs measured hit rates and a complete invalidation proof. The resumed large graph moved on every observed frame; this does not establish useful active-layout cache savings.                                                                                                                                                                                                                                                                                                                                                    |
| 008   | Not selected. The selected D3 timer runs one force step per callback and existing drawing callbacks retain physical label feedback. No redundant multi-draw-per-frame scenario was established to justify a second scheduler.                                                                                                                                                                                                                                                                                                                                   |
| 009   | Deferred. Exact current label/legacy correspondence passes, but no qualified whole-runtime measurement establishes that numeric records plus synchronization outperform current ownership.                                                                                                                                                                                                                                                                                                                                                                      |
| 010   | Deferred. Shared label accessors remain; no new allocation/retainer evidence selects another constructor family.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 011   | Deferred at its advance gate. No qualified post-repair evidence establishes persistent force-induced input blocking sufficient to justify a worker protocol.                                                                                                                                                                                                                                                                                                                                                                                                    |
| 012   | Deferred at its advance gate. No isolated offscreen drawing-cost result or accepted complete visibility/export design selects culling.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 013   | Deferred at its advance gate. No remaining SVG bottleneck or accepted backend design establishes a Canvas/WebGL migration.                                                                                                                                                                                                                                                                                                                                                                                                                                      |

These dispositions follow the plan's conditional gates; the deferred designs are not claimed as implemented or as performance wins.

## Browser qualification and timing limits

An ordinary production build and isolated Chrome preview loaded GoodRelations in the active state and the owner's exact 2,298,206-byte `20260912-full` input.
The input SHA-256 was verified in the browser as `85214ddc93194fccf5c0fc4bbbc8f34ab54e54f4abb352f0543411fd56b1c3f6`.
The upload tool could not access the Windows paths, so the qualification supplied those same bytes to the native file input through a temporary same-origin asset.
Auto-detection and the original document IRI were used; acquisition timing is consequently not a native file-chooser measurement.
The temporary asset and task-owned staging copy are removed before publication.

Selecting all 664 available graph nodes produced 775 labels; the extra editor helper groups are excluded from that node count.
No SVG path/transform contained `NaN` or `Infinity`.
Pause held all actual nodes motionless over the observation, and resume changed positions in every observed frame while coordinates remained finite.
Paused native node and property-label drags updated their own current and previous coordinates and retained the paused state.
Class distance could be changed and returned to its default, and fit-to-graph updated the camera.
Canonical JSON export retained its structural/visualization sections and compatible-artifact profile.
SVG export parsed successfully with 664 node groups, 775 label groups and no nonfinite geometry.
These observations establish functionality; they do not establish perceptual equivalence between differently projected hosted ontologies or a statistical speed margin.

The five-second CPU guard rejected a sample at 19.8% busy against the existing 10% limit while the preview was processing the input.
The owner previously instructed continuation with timing limits reported.
No quiet-machine A/A calibration, counterbalanced end-to-end A/B result, percentage speedup or statistical equivalence is claimed.
The former label-only benchmark remains a historical modern-force comparison, not a qualification of this changed solver.

Focused checks passed for the scalar event, reducer, settlement, solver, metadata, canonical mount/revision/drag and development-server/build-cleanup paths.
The first consolidated suite passed 9,495 tests and exposed three integration failures caused by new-file lint errors; those errors were corrected and both affected integration suites then passed.
The final committed candidate's consolidated suite, checked build, review disposition, hosted CI and delivery observations belong to the HISEW execution evidence and final handoff; this document does not assert a future gate result.

No deployment is part of this implementation request.
There is no schema migration or persisted-data backfill.
Recovery is a compatible source reversal or a bounded forward correction; no unverified deployed rollback artifact is promised.
