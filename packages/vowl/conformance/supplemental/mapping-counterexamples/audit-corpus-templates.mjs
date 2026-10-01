// SPDX-License-Identifier: AGPL-3.0-only
import { auditedCorpus } from "./audited-corpus.mjs";
const { vectors } = await auditedCorpus();
console.log(
  JSON.stringify({
    fixtures: vectors.length,
    completeTemplateMatches: vectors.length,
    quads: vectors.reduce((sum, vector) => sum + vector.audit.quads, 0),
  }),
);
