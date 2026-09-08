# WebVOWL GitHub governance

R0/R1 may use the accepted task/PR brief. Ordinary R2/R3 need a previously accepted
baseline. The single PR template owns seven metadata fields; issue forms are optional
intake for changes and bugs, not a requirement to duplicate an accepted task.

## Trusted policy and bootstrap

SDLC PR linkage uses pull_request_target with read-only contents/issues/PR access.
It checks out only the event's trusted base SHA, reads candidate baseline blobs
through the GitHub API, and never checks out or executes candidate code. Tests cover
schema/risk/state, immutable baseline versions, renamed paths and head/base freshness.
Reference presence does not establish research quality or human acceptance.

The initial base lacks these controls. The bootstrap cannot prove its own trusted
policy pass. Qualify linkage on a subsequent real PR before making it required;
never run head policy with privileged credentials or fabricate a bootstrap pass.
Re-read live accepted intent before merge: issue edits and prior checks are not atomic.

## Checks and permissions

The stable SDLC controls and WebVOWL application gates fail on scope errors or
failed selected jobs. Native Git selects their relevant inputs before dependency
installation. Controls run on Linux and Windows; the application uses its native
npm test/build owner on Linux. CodeQL covers Actions, JavaScript/TypeScript and
Python using advanced configuration, separately from native Codex Security.
Same-repository PRs, including Dependabot, are analyzed; fork PR analysis is currently
excluded by the retained source workflow guard. Record that limit when reviewing forks.

Actions are pinned to full commits, checkout credentials are not persisted, and
dependency install lifecycle scripts are disabled. Repository workflow defaults
are read-only and workflows cannot approve PRs; individual jobs request only their
required rights. The issue edit job can invalidate accepted labels; the CodeQL job
can upload security results. No build/deploy job receives publishing credentials.

CODEOWNERS names @MaksymShostak for SDLC ownership. It grants no access or independent
review; GitHub prohibits author self-approval. Main protection and the existing tag
ruleset are preserved. The owner's bootstrap merge approval is recorded in the
adoption plan; it is not a general exception for later work.

The label helper derives its destination explicitly from origin. For this checkout
that is Hadden-Industries/webvowl, never VisualDataWeb/WebVOWL. Label setup is separate
from local setup. Material issue edits invalidate accepted lifecycle labels without
erasing historical evidence. Weekly grouped Dependabot npm/pip/Actions proposals
still need scope, licence, compatibility and verification review; no automatic merge.

The retained legacy .travis.yml is outside the approved configuration changes and
still names Node 22. This adoption qualifies the new GitHub Actions checks. Do not
interpret the legacy file as qualification of that older runtime.

## Application corpus prerequisite

The existing corpus suites resolve ../universal-ontology/dist from the WebVOWL
checkout. CI checks out Universal Ontology at immutable commit
b3984ffbfe9b38cca7bd4570aeb3f5bc0fa6f20e beside WebVOWL and stages its external,
iso, iso-iec and universal source directories into that dist layout. These are the
static bytes copied by the source's native website inventory; no source code is
executed, generated oracle output changed, network fallback added or test skipped.
The referenced repository retains its licence and per-ontology source notices.
Local full corpus verification likewise requires this sibling corpus. A clean
checkout without it must report the missing input rather than a reduced pass.
