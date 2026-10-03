# Canonical VOWL production cutover and retirement

## Owner direction and scope

On 4 October 2026 the owner authorized Personas distribution, production cutover and final retirement, directing implementation to proceed.
This follows the candidate iteration amendment: application deployment does not promise a permanently frozen canonical profile or require immutable profile publication.
The owner separately approved deletion of `src/owl2vowl/package.json` after extraction of the shared resolver and retirement of the obsolete converter.
Other configuration changes still require their exact approval.

Personas authorization covers the existing qualified artifact and its identified Stanford Dublin Core import, whose source SHA-256 is `940b3992b2255d901e20839e930351b71bb10eef2f1d6550d54cefca28a67194`.
This records the owner's distribution disposition; it is not new evidence of a third-party licence grant.
The shipped notices retain the source attribution, modification statement and known grant limitations.
All six canonical example routes remain supported; historical assets and named migration evidence remain preserved.

## Implementation and observation

The production composition now selects the already qualified canonical application, preserving the existing load/pagehide lifecycle and popover fallback.
The isolated canonical build remains available for qualification.
The About menu identifies experimental exports and links the shipped example notices; the application licence link no longer incorrectly labels the AGPL application as MIT.
The implementation task serves as cutover operator and immediate smoke-test observer.
The known controlled endpoint is `https://haddenindustries.com/webvowl/`, published through the existing S3/CloudFront uploader.
No claim is made that unknown external copies have been inventoried.

Before live replacement, preserve the complete current `webvowl/` deployment and its object inventory for rollback, qualify the exact successor build, then verify deployed bytes and browser behavior.
The first read-only AWS inventory attempt returned an expired session requiring `aws login`; no remote mutation occurred.
The owner restored authentication, and the complete 38-object deployment was downloaded before live changes.
The backup inventory retains object metadata and local SHA-256 values and checks remote ETags against the initial inventory.
Deployment completed through the unchanged repository uploader after qualification.

Retirement preserves shared acquisition, rendering, editor and export responsibilities while removing 36 obsolete converter/controller/serializer files and implementation-only tests, including the unused renderer-owned Turtle writer.
Named historical ingress, independent corpus, original examples and Java comparison fixtures remain evidence.
The exact deletion inventory and original hashes are retained in `retirement-source-inventory.json` under the existing compatible-gap evidence directory.
The resolver and its tests now live at the application acquisition boundary; editor drawing records and renderer references have separate shared modules and focused contract tests.
The historical comparison catalog remains test-owned; loading UI tests no longer import unused converter scaffolding.
Sidebar tests now exercise canonical sessions and commands rather than the retired semantic editor.

## Qualification findings and disposition

The migrated sidebar tests exposed the old datatype dropdown request shape reaching the canonical editor unhandled.
It now invokes the existing canonical datatype operation and carries the selected rendered occurrence through the adapter/controller boundary, so changing one contextual range preserves another property's shared datatype.
Ambiguous requests without occurrence context reject rather than changing multiple ranges.
Failed or cancelled replacement loads preserve the retained occurrence context, covered by a real controller/session regression.
Canonical IRI handling accepts absolute schemes; the old unknown-prefix rejection assertion was replaced by malformed-IRI rejection, without restricting valid absolute IRIs.

The source suite passed 9,317 tests before the final obsolete Turtle removal; the final verification receipts determine the delivered count.
The production browser matrix passed all six examples and canonical export in Chromium, Firefox and WebKit, at 1,280-by-900 and 390-by-844 viewports.
Narrow testing found icon-only toolbar buttons lost their accessible names when CSS hid their text; explicit labels now match the visible labels, following the [W3C button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/).
The matrix verifies rendering, export and notice retrieval, not exhaustive assistive-technology behavior.

One consolidated Codex source review found retained occurrence loss on failed replacement and an obsolete Turtle writer still bundled.
Both were corrected; one narrow follow-up found no remaining actionable issues in those fixes and the toolbar labels.
That review did not independently rerun tests or browser qualification.
Existing package and protocol evidence remains tied to its original exact candidate; no canonical package rule or expected bytes changed for cutover.

## Completed production observation

Candidate `2026-10-04-cutover-01` is live at `https://haddenindustries.com/webvowl/`.
The final source check passed **9,315 tests across 145 suites**; formatting, lint and production build passed separately.
The lower count than the earlier programme total reflects retirement of obsolete converter/controller/serializer implementation tests, with shared and canonical regression coverage retained.
The unchanged package/specification check rehashed all 1,825 applicable files against the reviewed candidate manifest.

The uploader transferred 17 files, retained 25 unchanged files and deleted six obsolete JavaScript objects, leaving 42 objects in the WebVOWL prefix.
CloudFront distribution `E5R9EPFOCX1JR` completed invalidation `I5HMKWXWTWBCGMNSZZ6917W3NM`.
Public HTTP readback matched all 42 deployed file hashes plus the directory entry URL against the qualified build.
The live Chromium, Firefox and WebKit matrices each passed all six examples at desktop and narrow widths, notice retrieval, and export → reopen → export with identical canonical bytes.

Evidence is retained under `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/compatible-gap-20261004-01/`:

- `cutover-source-inventory.json` and `cutover-build-inventory.json` bind the working-tree source and deployed bytes.
- `cutover-affected-delivery.log` and `cutover-full-final.log` retain source and build verification; subsequent documentation-only verification is recorded separately.
- `cutover-deployment.log`, `post-cutover-s3-objects.json` and `cutover-live-readback.json` retain upload, invalidation, remote inventory and HTTP equality evidence.
- `production-browser.json` and `production-live-browser.json` retain local and live browser outcomes.
- `pre-cutover-deployment/`, `pre-cutover-s3-objects.json` and `pre-cutover-backup-verified.json` preserve the previous 38-object build, metadata and hashes for rollback.

Rollback uses that retained previous build with the same S3 prefix and CloudFront route; the backup was verified, but no live rollback was performed.
The current deployment was built from the inventoried uncommitted working tree; this operation created no commit and pushed no branch.
The owner-retained branches/worktree and unrelated `skills-lock.json` modification remain untouched.
Stable profile/package publication remains deferred under the candidate iteration amendment; this completed application cutover does not claim an immutable release.
