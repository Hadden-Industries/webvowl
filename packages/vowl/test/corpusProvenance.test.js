import { auditTemplates } from "../conformance/supplemental/mapping-counterexamples/auditor-v2/template-audit.mjs";
import {
  cameraOverlay,
  editingManifest,
  fieldAccounting,
  frozenPins,
  lexicalPositionNegatives,
  mappingPairs,
  negatives,
  positives,
  prefixNegatives,
  readJson,
  readPinned,
  unboundedLimitNegatives,
  unboundedLimitsOverlay,
} from "./independentCorpus.js";

test("the complete frozen corpus and active overlay inventory retain their recorded identities", () => {
  for (const pin of frozenPins) {
    readPinned(pin);
  }
  expect(positives).toHaveLength(859);
  expect(negatives).toHaveLength(3387);
  expect(mappingPairs).toHaveLength(321);
  expect(fieldAccounting.entries).toHaveLength(343);
  expect(
    fieldAccounting.entries.filter(({ selected }) => selected.exactOneField),
  ).toHaveLength(219);
  expect(
    fieldAccounting.entries.filter(({ selected }) => !selected.exactOneField),
  ).toHaveLength(124);
  expect(cameraOverlay.vectors).toHaveLength(5);
  expect(prefixNegatives).toHaveLength(2);
  expect(lexicalPositionNegatives).toHaveLength(101);
  expect(unboundedLimitsOverlay.vectors).toHaveLength(60);
  expect(unboundedLimitNegatives).toHaveLength(51);
  expect(editingManifest.vectors).toHaveLength(6);
});

// Private auditor controls are deliberately not public Canonical VOWL errors.
const controls = readJson(
  "supplemental/mapping-counterexamples/auditor-v2/controls-manifest.json",
).vectors;
test.each(controls)(
  "v2 independent proof checker rejects its frozen control: $id",
  (control) => {
    let failure;
    try {
      auditTemplates(
        readJson(control.source),
        control.profile,
        readJson(control.files.ids),
        readPinned(control.files.nquads).toString("utf8"),
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject(control.expectedCheckerError);
  },
);
