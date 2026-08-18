# ADR 0003: Require a quiescent benchmark environment and corroborated threshold breaches

| Metadata       | Value                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Status**     | Accepted                                                                                           |
| **Date**       | 2026-08-18                                                                                         |
| **Decider**    | Repository owner                                                                                   |
| **Amends**     | `docs/owlapi-js/implementation-plan.md` §20.6 (normative performance budgets and benchmark environment) |

## Context

During Phase 7 closure a paired remeasurement reported
`generated-rdfxml-large.end-to-end` at 3,425.74 ms against an accepted
1,844.23 ms baseline: 85.75% above a 20% threshold. The finding was recorded in
`baseline.md`, classified `LOCAL_PHASE_FOLLOW_UP` as `M7-008`, assigned to
Phase 8, and committed.

No regression existed. The benchmark had been launched in the background while
the same session ran repeated full-text scans over a 44 MB file. Repeated on an
idle machine, at the same revision, runtime, machine and lockfile, the signal
measured 1,809.97 ms, which is 1.86% *below* the accepted baseline. Every VOWL
signal captured in the same window was inflated by a similar factor.

The measurement complied with §20.6 as written. That section requires a defined
benchmark environment recording "relevant OS/runtime versions, architecture,
memory settings where material, dependency lockfile, fixture revisions, warm-up
method, measured-run count and aggregation statistic." Every one of those
dimensions is a static property of the environment. None describes the state of
the machine at the moment of measurement, so a fully governed record can be
produced on a heavily loaded machine.

Two further weaknesses turned a bad measurement into a recorded finding.

The section's existing mitigation actively produced false confidence. It
requires "repeated measurements and a predefined aggregation/noise policy",
which defends against random, short-lived noise. Sustained contention inflates
every run by a similar factor, so repetition yields a tight spread that reads as
a high-quality signal. Five runs spanning 3,389 ms to 3,493 ms were treated as
evidence that the number was trustworthy.

The section also states that "re-running a failing benchmark until one
favourable sample passes is forbidden". The intent is plainly to prohibit
selecting a lucky sample. As written, it does not distinguish that from
discarding a measurement demonstrated to be invalid, so a team correcting a
contaminated result appears to be violating the plan.

## Decision

1. The benchmark environment record **MUST** include the concurrent-load state
   of the machine. Release-gated measurements **MUST** be taken with no other
   benchmark, test run, build, or bulk file-scanning work in progress.
2. Repeated measurement and aggregation **MUST NOT** be treated as protection
   against sustained interference. A tight run-to-run spread is evidence of
   sustained conditions, not of clean conditions.
3. A threshold breach **MUST** be corroborated independently before it is
   recorded as a finding, a regression, or a gate failure. At least one of the
   following is required: an isolated repeat of a single run, a scaling check
   across input sizes, or an arithmetic consistency check against related
   signals.
4. The prohibition on re-running a failing benchmark forbids selecting a
   favourable sample. It does **NOT** forbid discarding a measurement
   demonstrated to be invalid, provided the demonstration is evidenced and the
   discarded measurement and its cause are recorded.

## Rationale

Documentation alone did not prevent this failure, and would not have. The
principle that benchmarks need a quiet machine was already understood; what
defeated it was the background-execution affordance, which removes the waiting
period during which interference would have been noticed. A rule that is only
written down is enforced by the attention of whoever is least likely to have it
at that moment.

The plan already prefers executable protection where a lesson can be expressed
deterministically (§17.3). Processor-time sampling is deterministic and cheap,
so this decision is accompanied by a pre-flight guard rather than by prose
alone.

Point 4 is included because the corrective action taken in Phase 7 would
otherwise read as a violation of the section it was correcting. A rule that
cannot distinguish a retraction from a cover-up discourages retractions.

## Consequences

- `util/benchmarkEnvironment.mjs` samples processor time before every
  release-gated benchmark and aborts when the machine exceeds a 10% busy
  fraction over a 500 ms window. All six benchmark utilities call it.
- The guard is covered by `util/benchmarkEnvironment.test.js` and was verified
  to abort under real generated load, not only against injected samples.
- Benchmark runs can no longer be backgrounded alongside other work; they must
  be run in the foreground on an otherwise idle machine.
- A future contaminated measurement fails loudly at the start of the run
  instead of silently producing a plausible number.
- The threshold and sampling window are development-tooling defaults, not
  normative resource budgets, and may be tuned without a budget change.

## Verification obligations

- `util/benchmarkEnvironment.test.js` **MUST** cover the busy-fraction
  calculation and both the accepting and rejecting paths of the guard.
- Every release-gated benchmark utility **MUST** invoke the guard before taking
  any measurement.
- A recorded threshold breach **MUST** cite the corroborating check that
  established it as genuine.

## Implementation map

| Change                                          | Location                                                        |
| ----------------------------------------------- | --------------------------------------------------------------- |
| Normative amendment                             | `docs/owlapi-js/implementation-plan.md` §20.6                   |
| Executable guard                                | `util/benchmarkEnvironment.mjs`                                 |
| Guard tests                                     | `util/benchmarkEnvironment.test.js`                             |
| Guard invocation                                | the six `util/benchmark-*.mjs` utilities                        |
| Institutionalized method                        | `docs/owlapi-js/migration/parser-migration-playbook.md`         |
| Originating evidence                            | `docs/owlapi-js/migration/lessons/006-development-integration.md` finding `M7-008` |
