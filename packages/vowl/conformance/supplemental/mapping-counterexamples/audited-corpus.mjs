// SPDX-License-Identifier: AGPL-3.0-only
import { candidates } from "../field-contract/bindings.mjs";
import { readPinned } from "../field-contract/support.mjs";
import { auditTemplates } from "./template-audit.mjs";
export const pairManifests = [
  "core",
  "value-state",
  "derived",
  "branch",
  "distinction",
  "binding-correction",
].map((name) => `supplemental/mapping-counterexamples/${name}-manifest.json`);
export async function auditedCorpus() {
  const { vectors, header } = await candidates([
    "supplemental/field-contract/additional-positive-manifest.json",
    "supplemental/field-contract/state-identity-manifest.json",
    ...pairManifests,
  ]);
  for (const vector of vectors) {
    const ids = JSON.parse(await readPinned(vector.files["ids.json"]));
    const nquads = (await readPinned(vector.files["canonical.nq"])).toString(
      "utf8",
    );
    try {
      vector.audit = auditTemplates(vector.source, vector.profile, ids, nquads);
    } catch (error) {
      error.message = `${vector.id}: ${error.message}`;
      throw error;
    }
  }
  return { vectors, header };
}
