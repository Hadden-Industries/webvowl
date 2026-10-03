# Canonical VOWL embedded-work default amendment

Status: owner approved on 3 October 2026, subject to implementation qualification.

This amendment supersedes only the `embeddedValues` default in A8 of the [core contract](2026-09-24-canonical-vowl-core-contract.md), the corresponding [implementation-plan table](../plans/2026-09-24-canonical-vowl-implementation-plan.md), and section 15's statement that defaults are unchanged in the [compatible mapping draft](2026-10-02-canonical-vowl-compatible-view-amendment-draft.md).
The original documents retain their evidence-pinned bytes.
The default becomes 1,500,000; the absolute maximum remains 4,000,000.
All other defaults, upper bounds, resource accounting, error codes, deadline and cancellation requirements remain unchanged.
An explicit caller-supplied lower limit remains effective.
The amendment changes admission capacity, not canonical output bytes or mapping identity.

The owner's accepted laboratory target is load-and-capture of the connected and disconnected 2,000-class fixtures in each tested browser within ten seconds overall, with heartbeat gaps below 100 ms and sampled private browser memory below 2 GiB on the qualification host.
These targets do not guarantee equivalent cost for all ontologies of a given class count.
The [qualification report](../reviews/canonical-vowl-slice006-qualification.md) records the fixtures, environment, measurement limits and results.

The connected fixture needs 1,198,948 embedded-work units for capture under the existing mapping rules.
Index construction and every visited incident quad remain charged; no work is hidden or exempted to fit the new allowance.
The finite 1,500,000 default leaves approximately 25 percent headroom over that measured requirement without increasing the existing 4,000,000 maximum.
This does not establish a general memory ceiling: browser process memory must still be measured separately.

The change also increases default embedded-data and parser allowances for other operations that derive their limits from this policy.
Qualification must therefore cover hostile/deep inputs, explicit lower limits, unchanged upper-bound rejection, cancellation, deadlines, canonical-byte conformance and the affected browser workloads.
No publication, profile freeze or production cutover is authorized by this amendment.
