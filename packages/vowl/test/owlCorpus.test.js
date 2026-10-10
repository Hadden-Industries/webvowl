import { encode } from "vowl";
import { fromOwl } from "vowl/owl";
import { assertAdapterRun } from "../conformance/supplemental/owl-mapping/assert-adapter.mjs";
import {
  loadCorpus,
  readPinned,
} from "../conformance/supplemental/owl-mapping/source-v2/catalog-npm-layout.mjs";

const scope = JSON.parse(
  await readPinned({
    path: "supplemental/owl-mapping/source-v2/provenance-portable.json",
    sha256: "3c97f23cc4e00ac2608f7e8d432747c21b357e899bb4e7b56631a6f7b043b1ee",
  }),
);
const corpus = await loadCorpus();

test("the independently frozen OWL corpus retains all recorded identities", async () => {
  for (const reference of scope.artifacts) {
    await readPinned(reference);
  }
  expect(corpus.vectors).toHaveLength(28);
  expect(corpus.runs).toHaveLength(68);
});

test.each(corpus.runs)(
  "independent OWL source mapping: $id",
  async ({ vector, run }) => {
    await assertAdapterRun({ fromOwl, encode }, vector, run);
  },
);
