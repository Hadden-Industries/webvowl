# Conformance fixture storage

The storage consolidation preserves all cases and expected results from commit `4cac26e920cbf5cfc080bd89f2e99ed64019825d`.
It replaces 7,227 individual field-contract and mapping-counterexample fixture files with 64 readable JSON bundles.
It changes storage and its provenance metadata, without generating expected answers or changing the Canonical VOWL runtime.

## Reading evidence

Manifest `path` values are logical corpus member identifiers.
Use `readCorpusArtifact(path)` from [storage.mjs](storage.mjs) to retrieve their bytes.
The reader selects the physical layout explicitly: the seven fixture filenames in the two consolidated families use bundles; other corpus members remain ordinary files.
A missing bundled member fails even if an obsolete loose copy exists.
No files are extracted during tests.

Each bundle records the member identifier, original SHA-256, byte length, encoding and exact content.
UTF-8 text is retained without parsing or reserializing the fixture itself.
Base64 represents bytes that cannot round-trip through UTF-8.
Duplicate JSON members, whitespace, byte-order marks and final-newline distinctions therefore remain observable.
Every read returns fresh bytes so callers cannot change cached expectations.
The 32 stable buckets per family limit individual file size and avoid reorganizing existing members when another case is added.

[The storage inventory](storage-inventory.json) maps every relocated member to its bundle and records the original checkpoint inventory identity.
Original per-member hashes remain authoritative in the independent manifests.
Producer and provenance metadata hashes were updated only where storage-reader changes required it.
The original commit preserves the preceding metadata; the old source-cleanup proof additionally retains its exact pre-storage field-accounting artifact.
Independent mapping, normalization, expected errors, canonical bytes and coverage obligations remain unchanged.

## Verification

From the repository root:

```text
node packages/vowl/scripts/verify-corpus-storage.mjs
node packages/vowl/scripts/verify-corpus-storage.mjs --against-git
npm run test:vowl
```

The first command verifies every container and member, complete inventory membership and the absence of loose duplicates.
The Git comparison additionally reads every original artifact directly from the checkpoint's Git objects.
It checks unchanged bytes and allows only the declared metadata checksum updates, provenance additions, historical artifact relocation and reviewed reader/documentation changes.
The Git comparison requires that checkpoint to be available locally; ordinary corpus tests require no Git history.

Existing independent derivation commands continue to compare their recorded results through the corpus reader.
Their `--write-new` option cannot overwrite a bundled expectation or recreate its loose copy.
New expectations in these frozen families need an explicit bundle/inventory update and independent review.
The separate migration corpus retains its existing shared-seed representation.
This increment does not reconstruct the consolidated inputs from mutations or remove any logical cases.
