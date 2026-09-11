# VOWL specification: local CodeQL correction

Assessed against main `d82477752a2ec2eff383096ef78afef638d3e94f` on 2026-09-11.

## Decision

Fix [alert 1](https://github.com/Hadden-Industries/webvowl/security/code-scanning/1)
and [alert 2](https://github.com/Hadden-Industries/webvowl/security/code-scanning/2)
at the current tip. Both correctly identify redundant escapes under
`js/useless-regexp-character-escape`; neither demonstrates a security defect in
these expressions. Remove the two redundant backslashes and update the script's
checksum. Git history retains the original recovered bytes.

The alerts concern lines 10 and 17 of
`docs/owlapi-js/conformance/upstream/vowl-2/data/specBrowserWarning.js`.
JavaScript discards the backslash before the dot in these string literals. Within
the resulting regex character class, the dot is already literal. Removing either
backslash therefore produces exactly the same regex. Calling these style findings
false positives would obscure that distinction.

## Provenance and application boundary

The `vowl-2` entry in [suites.json](../owlapi-js/conformance/suites.json) pins a
third-party recovery from `neon12345/WebVOWL` revision
`61abca1ad6aeb5108be7f06e9590c702d4013e7a`. It does not claim byte identity with
the original 2014 specification server. The recorded and locally verified SHA-256
of the original script is
`f5375d9370af0a14cfa093fb919db7a35ced29f3b8ec2a08e784909518214f66`.
The locally corrected script has SHA-256
`103cb52d5b04ab0d19b8886e87d114eba75e9fe3449ebd367a032a1732f26f09`.
This is an explicitly documented local modification of that recovery, not a new
upstream revision. The pinned revision identifies its upstream base; the updated
`SHA256SUMS` identifies the current local bytes. The original remains available
at the assessed main commit above.

Both archived HTML files load the script to display a fixed Internet Explorer
unsupported-browser notice. The current Vite configuration builds from `src`,
disables `publicDir`, and has explicit static-copy targets that omit this archived
specification. ZIP creation and upload consume `deploy`. No reference to this
script or the `vowl-2` package was found in current `src`, `tests`, or `util`.
This establishes the current source/build-path boundary; it is not an inspection
of a live deployment or every possible consumer of the source archive.

## Verification

A Node.js VM characterization executed the original script and an in-memory copy
with only the two redundant backslashes removed. Both constructed regex `source`
values were identical. Seven independently expected cases passed: MSIE 8 and 10,
Trident/IE 11, Firefox, Chrome, and malformed MSIE/Trident version prefixes.
The expected detected versions and unsupported-browser notice activation passed;
serialized DOM effects were identical between the two forms. The test doubles
exercise script behavior, not rendering in actual historical browsers.

The correction changes only these two escape characters and the corresponding
checksum entry, plus this provenance note. No dependency or CodeQL configuration
changes are involved. This uses the R1 preservation/characterization route under
the accepted task: retain detection and notice behavior, correct scanner findings,
and identify the local provenance delta. CodeQL on the merged revision is the
closure oracle; the VM characterization is behavior-preservation evidence.
This correction does not certify the rest of the recovered specification as secure.
