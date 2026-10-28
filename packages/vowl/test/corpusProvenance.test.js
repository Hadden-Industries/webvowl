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

test("cached bundled reads retain independent frozen digest and length checks", () => {
  const pin = frozenPins.find(
    ({ path, base }) =>
      base !== "repository" &&
      path.startsWith("supplemental/field-contract/") &&
      path.endsWith("/source.json"),
  );
  expect(pin).toBeDefined();
  const first = readPinned(pin);
  expect(first.length).toBeGreaterThan(0);
  first[0] = (first[0] + 1) % 256;
  const second = readPinned(pin);
  expect(second).not.toEqual(first);
  expect(() => readPinned({ ...pin, sha256: "0".repeat(64) })).toThrow(
    "Frozen artifact changed",
  );
  expect(() => readPinned({ ...pin, byteLength: second.length + 1 })).toThrow();
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
