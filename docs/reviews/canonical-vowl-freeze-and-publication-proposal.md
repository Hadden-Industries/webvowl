# Canonical VOWL freeze and publication decision

## Current disposition: iterative candidate

The owner's subsequent 4 October direction is implemented by the [candidate iteration amendment](../plans/2026-10-04-canonical-vowl-candidate-iteration-amendment.md).
The acceptance recorded below now serves as a reviewed candidate checkpoint, not a permanent stable-contract commitment.
Justified corrections, including canonical-byte changes, remain possible with identified candidate revisions and affected validation.
Immutable hosting and publication are deferred stable-release work and do not block continued implementation or qualification.
The exact snapshot and acceptance receipt below remain historical evidence.
The owner subsequently authorized Personas distribution, production cutover and final retirement; the [cutover report](canonical-vowl-production-cutover-and-retirement.md) records their completed implementation and live verification.
References below to those decisions being unapproved describe this proposal's earlier state and are superseded by that authorization.

Prepared on 4 October 2026 against source commit `2bba8c5511e9d0b8fc665d542ce06481d3001208` plus the exact uncommitted bytes in the manifest below.
The owner accepted the exact profile freeze on 4 October 2026 with the answer “Accept the exact profile freeze”.
That acceptance covers FREEZE-001, FREEZE-002 and the compatible-view rule registry for the six identifiers below, bound to manifest SHA-256 `43cd3c7c6f7d412552ed9cddc8f04866a89eb74eeb95e4544e3665238931224e`.
The separate hosting-integration request is deferred under the later amendment; this acceptance does not authorize publication or production cutover.
The accepted plan explicitly reserves FREEZE-001, FREEZE-002, publication, production cutover and retirement decisions.
Repository instructions separately reserve exact configuration changes.

## Exact candidate

Evidence root: `C:/Users/maksy/.hi/w/e/operator-reports/canonical-vowl-01a0f1b9/compatible-gap-20261004-01/`.

| Artifact                               | Identity                                                                                     |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `freeze-candidate-final/manifest.json` | SHA-256 `43cd3c7c6f7d412552ed9cddc8f04866a89eb74eeb95e4544e3665238931224e`                   |
| Ordered 1,826-entry inventory          | SHA-256 `bf083f52676fd2da632f56d889293ccd7a8779deefa5a357081e20f6d7cfb0b7`                   |
| `freeze-candidate-final.zip`           | 14,028,145 bytes; SHA-256 `46598284f57e1900f3cdb1d81f215d143c1324b08c4538dd20c5686956aabba4` |
| Included experimental package tarball  | SHA-256 `b267a5fc6e3e8e436725aa779d0f5e5242e781f07e50f474be4a4f5344156176`                   |

The archive includes the complete canonical authorities, package source/schemas/corpus/tests/notices and the exact packed artifact.
It excludes application example assets, unrelated workspace changes and external scratch installations.
Every entry and the manifest were extracted and hash-verified; `freeze-candidate-final-receipt.json` retains the result.
Its manifest deliberately records a pending owner decision.
Acceptance must bind that digest in a separate receipt rather than rewriting the candidate manifest to fabricate approval.
The owner's subsequent acceptance is retained as `owner-freeze-acceptance.json` in the evidence root, with the exact answer and question/session reference.
The manifest and archive were rehashed against the accepted identities and remain unchanged.
The archive is not yet uploaded anywhere.

## Accepted freeze scope

The base is `https://haddenindustries.com/ontology/profiles/vowl/`.

| Decision                                         | Exact suffixes                                             | Authority                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| FREEZE-001                                       | `canonical/structural-content/v1`, `canonical/artifact/v1` | Original design/core/projection contracts and accepted protocol/camera/resource amendments.             |
| Compatible extension acceptance under FREEZE-001 | `canonical/compatible-artifact/v1`                         | Compatible-view amendment sections 15–16 and the corrected self-contained compatible-artifact contract. |
| FREEZE-002                                       | `owl-mapping/strict/v1`, `owl-mapping/compatibility/v1`    | A9 and qualified public owlapi adapter/policy revisions.                                                |
| Production compatible-view rules                 | `compatible-view/v1`                                       | Accepted compatible interpretation/qualification policy and its eight portable rule fragments.          |

All corresponding file identities are bound by the inventory.
The live checkpoint identifier `live/retained/v1` remains a session-recovery format, not a new stable interchange promise.
Freeze acceptance does not silently remove the existing limits, broaden OWL entailment claims, add dialects or certify acquired-source authenticity.

## Reconciled freeze evidence

| D27.1 obligation                   | Current evidence                                                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete mapping and distinctions  | A6 and compatible contract; 343 inherited retained-field positions; 108 new compatible difference pairs, including four explicitly coupled cases; all 68 added grammar slots accounted without claiming 68 isolated proofs. |
| Category-local IDs                 | Historical interleaving/symmetry cases plus independent fifteen-document numeric-versus-lexical issuance, all ten primary categories and permutation agreement.                                                             |
| Duplicate-safe exact decoding      | 3,235 inherited rejection/boundary cases plus 69 independent compatible cases, including direct byte-decoder schedule overlaps; exact successful decode/encode comparisons.                                                 |
| Closed grammar and semantic checks | Three generated canonical schemas; existing structural/projection qualification; all compatible detail/term/graph variants, optional fields, references, duplicate sets/payloads and source-node ownership.                 |
| Independent byte pipeline          | Original independent core pipeline, three Antigravity compatible seeds, and 229 separately authored Codex compatible positives; complete datasets and bytes agree with production.                                          |
| Projection and display             | Accepted projection matrix/display vectors and SLICE-005/006 execution; the new data-enumeration/datatype-definition witnesses retain details-only behavior.                                                                |

The consolidated Codex contract review and narrow follow-up closed the producer-normalization, validation-order wording and table-rendering findings.
The language correction is a separate independently authored producer overlay; historical expected bytes remain unchanged.
One negative fixture error is preserved with its independently justified correction and replacement witness.
No runtime source or profile byte rule was changed to force agreement.

Operational/resource, Unicode parser and cancellation evidence is inherited from its accepted source and browser scopes, with the existing SLICE-006 independent-review waiver unchanged.
The new oracle does not claim to independently rederive operational measurements or supply a general-purpose validator.
Optional error pointers, exhaustive arbitrary-graph proofs and unknown downstream deployments are not silently added acceptance claims.

The final standalone artifact passes the complete packaged core corpus, all 232 compatible positive cases, 69 added negatives, all public imports, OWL/Turtle and named-migration probes in Bucharest, UTC and Los Angeles process timezones.
The selected `LANG` environment does not prove an effective locale change; recorded receipts retain the actual Node/Intl values.
No consumer manifest/lockfile or package setting was changed.
Repository verification and its exact receipts are recorded in the [release-readiness report](canonical-vowl-release-readiness.md).

## Concrete publication route

The deferred stable-release option is ontology-owned immutable profile hosting, using the exact archive above and the existing experimental tarball identity.
This avoids guessing an npm name/version or changing public imports merely to publish the specification bundle.
Registry publication can be a later separately selected distribution channel; the tarball remains explicitly `vowl@0.0.0-experimental`, not a stable package-version claim.

The ontology repository already copies ordinary files under `src/profiles/vowl/` into the corresponding `dist/profiles/vowl/` paths.
Its existing uploader publishes `dist` beneath S3 prefix `ontology` with deletion enabled.
A separate ad-hoc publisher would risk having its immutable files deleted by that sync.
No Vite, package, lockfile, ontology-module registry or WebVOWL uploader change is needed for the recommended assembly route.

The exact proposed cross-repository scope is:

1. In `universal-ontology`, add `src/profiles/vowl/bundles/46598284f57e1900f3cdb1d81f215d143c1324b08c4538dd20c5686956aabba4/bundle.zip` and `manifest.json` with the exact identities above.
2. Add the six extensionless JSON profile-resolution documents at the suffix paths in the freeze table beneath `src/profiles/vowl/`.
   Each binds its exact profile IRI, immutable archive/manifest URLs and hashes, relevant schema/policy entries and the owner's actual freeze receipt.
3. Add `scripts/verify_vowl_profile_bundle.py` to verify archive/manifest identities, descriptor-to-profile bindings, safe paths, absence of conflicting descriptors and exact source-to-dist equality.
4. Amend the deployment configuration in `scripts/upload_to_s3.py:main` to call that verifier before the existing external uploader, alongside the unchanged ontology publication gate.
   Add focused verifier and gate-order/failure tests in the existing Python test discovery scope.

This scope requires explicit authorization for the separate repository and exact deployment-gate change.
It is proposed here; no such files or settings have been changed.
The existing ontology verification/publication route must still pass, and the eventual publication command/readback remains subject to release authority.
Extensionless response content type must be observed; byte retrieval alone must not be described as verified `application/json` metadata.
No speculative AWS helper metadata change is included.

## Application asset rights and deployment

Read-only HTTP checks found that all six currently hosted examples exactly match their historical source assets, not the canonical candidate.
The current public application JavaScript/HTML does not byte-match the local build, so its exact source commit remains unestablished.
The repository's actual controlled deployment is the existing S3/CloudFront route, not GitHub's empty deployments list.

The complete notice draft is retained as `example-distribution-notices-draft.md` in the evidence root, with all six source/artifact digest checks.
FOAF, GoodRelations, MUTO and the OntoViBe root retain their identified CC grants and attribution.
The OntoViBe imported module matches the pinned VisualDataWeb/OWL2VOWL module after line-ending conversion; its repository-wide MIT grant, with no narrower exclusion, supplies the recorded distribution basis and full notice.
SIOC's publisher distinguishes ontology terms/technology from its CC BY 1.0 accompanying documentation; the notice preserves that scope instead of inventing a blanket RDF licence.
These findings supersede earlier conservative withholding of OntoViBe and SIOC.

One asset-specific rights question remains: the Stanford Dublin Core adaptation imported by Personas.
Its exact live publisher bytes and newline-equivalent primary repository source are established, but neither the website repository nor the older redirecting plugin establishes a redistribution grant for that resource.
The next application release needs applicable rights evidence or an explicit owner disposition of that example's distribution scope.
The proposed profile/package bundle contains none of these example assets, so this does not block its separately scoped publication.
No example was removed, replaced or made unavailable by this qualification work.

## Cutover and retirement after publication

Production switching and legacy deletion have not occurred.
Before cutover, qualify the exact successor production artifact against the published profiles, retain its readable recovery path, assign the observer and record the owner's cutover decision.
Reconcile any known additional controlled deployments or consumers; an owner statement of none known is not a guarantee about unknown internet copies.

Retirement must first separate genuinely shared code: the candidate uses the old directory's import resolver, the shared application composition and reference/renderer/editor contracts.
The prepared `deployment-consumer-retirement-proposal.md` lists exact candidate files and preservation requirements.
Only the obsolete converter/controller/serializer paths should then retire, after line-item configuration/deletion approval and affected checks.
The named legacy migration adapter, pinned dialect corpus, historical example bytes and required Java/source evidence must survive.
Preserved branches/worktree and unrelated `skills-lock.json` changes remain outside scope.

## Decisions still required

The owner accepted the exact scope and manifest above, then relaxed its permanent-freeze effect through the candidate iteration amendment.
The ontology-owned hosting integration and deployment gate are deferred options for a future stable-release decision, not blockers to candidate work.
Personas distribution, production cutover and final retirement have since been authorized and are tracked in the cutover report.
Stable profile publication remains deferred.
