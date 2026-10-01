// SPDX-License-Identifier: AGPL-3.0-only
import process from "node:process";
import { loadCorpus } from "./catalog-portable.mjs";
import { json, localPin, pin, readPinned } from "../support.mjs";
const predecessor = {
  path: "supplemental/owl-mapping/source-v2/provenance.json",
  sha256: "ba6a1ee75e2d7011b61336910514ad2878297048b3d0bc82a0eefbc5f4916af7",
};
const prior = JSON.parse(await readPinned(predecessor));
const corpus = await loadCorpus();
const artifacts = [
  predecessor,
  ...prior.artifacts,
  ...(await Promise.all(
    ["source-v2/catalog-portable.mjs", "source-v2/verify-portable.mjs"].map(
      localPin,
    ),
  )),
];
for (const reference of artifacts) await readPinned(reference);
const receipt = await pin(
  "source-v2/provenance-portable.json",
  json({
    format: "independent-canonical-vowl-owl-source-revision-portable-loader-v2",
    predecessor,
    reason:
      "The initial source-v2 loader used native structuredClone for an intermediate JSON record copy. Jest's VM context can receive a host-realm clone, causing prototype-sensitive deepStrictEqual to fail on identical JSON data before any adapter call. This version uses JSON parse/stringify for that data-only copy and retains every value, reference, before/after byte reconstruction and historical pin check. The original loader, receipt and every expectation remain unchanged.",
    counts: { ...prior.counts, totalPublicRuns: corpus.runs.length },
    artifacts,
  }),
);
console.log(
  JSON.stringify(
    {
      scope: receipt,
      artifacts: artifacts.length,
      writes: process.argv.includes("--write-new") ? "new-only" : "none",
    },
    null,
    2,
  ),
);
