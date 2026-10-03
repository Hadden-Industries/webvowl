import { fail } from "./errors.js";

const predicate = {
  termType: "NamedNode",
  value:
    "https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#color",
};
const datatype = {
  termType: "NamedNode",
  value: "http://www.w3.org/2001/XMLSchema#hexBinary",
};
const encoder = new TextEncoder();
const hexBytes = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, "0"),
);

// Account for the exact UTF-8 JSON spelling before allocating escaped strings
// or encoded buffers. Inputs here are only arrays and internally selected strings.
function boundedJson(value, budget) {
  function measure(item) {
    if (Array.isArray(item)) {
      budget.charge(
        "totalStringBytes",
        2 + Math.max(0, item.length - 1),
        undefined,
        "RDF_RESOURCE_LIMIT",
      );
      item.forEach(measure);
      return;
    }
    budget.charge("totalStringBytes", 2, undefined, "RDF_RESOURCE_LIMIT");
    const available =
      budget.limits.totalStringBytes - (budget.counts.totalStringBytes ?? 0);
    let measuredBytes = 0;
    for (let index = 0; index < item.length; index++) {
      if (index % 1024 === 0) {
        budget.check();
      }
      const code = item.codePointAt(index);
      const bytes =
        code < 32
          ? [8, 9, 10, 12, 13].includes(code)
            ? 2
            : 6
          : code === 34 || code === 92
            ? 2
            : code >= 0xd800 && code <= 0xdfff
              ? 6
              : code < 128
                ? 1
                : code < 2048
                  ? 2
                  : code < 65536
                    ? 3
                    : 4;
      measuredBytes += bytes;
      if (measuredBytes > available) {
        budget.charge(
          "totalStringBytes",
          measuredBytes,
          undefined,
          "RDF_RESOURCE_LIMIT",
        );
      }
      if (code > 65535) {
        index++;
      }
    }
    budget.charge(
      "totalStringBytes",
      measuredBytes,
      undefined,
      "RDF_RESOURCE_LIMIT",
    );
  }
  measure(value);
  return JSON.stringify(value);
}

async function digest(value, budget) {
  budget.check();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  budget.check();
  return [...new Uint8Array(hash)].map((byte) => hexBytes[byte]).join("");
}

/**
 * Candidate compatible-profile mapping refinement. Never used by canonical v1.
 * Each round refines the previous partition with labelled incident edges. Stop
 * at the first round that does not split a color class. Blank labels never enter
 * signatures; symmetric vertices remain symmetric and still require RDFC.
 */
export async function refineDataset(dataset, budget) {
  const incidents = new Map();
  const groundKeys = new WeakMap();
  const groundDigests = new Map();
  let pendingGround = [];
  let groundScratchBytes = 0;
  async function flushGround() {
    await Promise.all(pendingGround);
    pendingGround = [];
    groundScratchBytes = 0;
  }
  for (const quad of dataset) {
    budget.check();
    if (
      quad.graph.termType !== "DefaultGraph" ||
      quad.predicate.termType !== "NamedNode" ||
      quad.predicate.value.startsWith(
        "https://haddenindustries.com/ontology/vowl/compatible-mapping/v1#",
      )
    ) {
      fail("DEPENDENCY_FAILURE", undefined, { stage: "compatible-mapping" });
    }
    for (const term of [quad.subject, quad.predicate, quad.object]) {
      if (term.termType === "BlankNode" || groundKeys.has(term)) {
        continue;
      }
      const key =
        term.termType === "NamedNode"
          ? ["iri", term.value]
          : term.termType === "Literal"
            ? ["literal", term.value, term.datatype.value, term.language]
            : undefined;
      if (!key) {
        fail("DEPENDENCY_FAILURE", undefined, { stage: "compatible-mapping" });
      }
      const spelling = boundedJson(key, budget);
      if (!groundDigests.has(spelling)) {
        const requiredScratchBytes = 1024 + spelling.length * 6;
        if (
          pendingGround.length &&
          (pendingGround.length === 32 ||
            groundScratchBytes + requiredScratchBytes >
              budget.limits.totalStringBytes)
        ) {
          await flushGround();
        }
        const prepared = ["term", ""];
        groundDigests.set(spelling, prepared);
        groundScratchBytes += requiredScratchBytes;
        const result = digest(spelling, budget).then((hash) => {
          prepared[1] = hash;
        });
        result.catch(() => {});
        pendingGround.push(result);
        // Keep an individually admitted large key on the original serial path;
        // batching must not introduce a stricter single-key admission rule.
        if (requiredScratchBytes > budget.limits.totalStringBytes) {
          await flushGround();
        }
      }
      groundKeys.set(term, groundDigests.get(spelling));
    }
    const blanks = new Set(
      [quad.subject, quad.object]
        .filter((term) => term.termType === "BlankNode")
        .map((term) => term.value),
    );
    for (const blank of blanks) {
      if (!incidents.has(blank)) {
        incidents.set(blank, []);
      }
      incidents.get(blank).push(quad);
      budget.charge("embeddedValues", 1, undefined, "RDF_RESOURCE_LIMIT");
    }
  }
  await flushGround();
  const groundSpellings = new WeakMap(
    [...groundDigests.values()].map((key) => [key, JSON.stringify(key)]),
  );
  let colors = new Map([...incidents.keys()].map((id) => [id, ""]));
  let classes = colors.size ? 1 : 0;
  let rounds = 0;
  function termKey(term, self) {
    if (term.termType === "BlankNode") {
      // Colors are internally generated lowercase hex (or the initial empty
      // string), so this spelling is exactly JSON.stringify of the term key.
      return term.value === self
        ? '["self"]'
        : `["blank","${colors.get(term.value)}"]`;
    }
    return groundSpellings.get(groundKeys.get(term));
  }
  while (colors.size) {
    const next = new Map();
    let pending = [];
    let pendingColors = new Map();
    let scratchBytes = 0;
    async function flush() {
      const results = await Promise.all(pending);
      for (const [id, color] of results) {
        next.set(id, color);
      }
      pending = [];
      pendingColors = new Map();
      scratchBytes = 0;
    }
    for (const [id, quads] of incidents) {
      budget.check();
      // A quad key contains three fixed-size digest/self/color keys: at most
      // 241 ASCII characters. 2048 bytes per incident conservatively covers
      // UTF-16 entry strings, escaped signature and UTF-8 digest input together.
      const requiredScratchBytes = 1024 + quads.length * 2048;
      budget.bound(
        "totalStringBytes",
        requiredScratchBytes,
        undefined,
        "RDF_RESOURCE_LIMIT",
      );
      // Independent hashes read only the preceding round. Bound their combined
      // scratch space and concurrency rather than suspending once per vertex.
      if (
        pending.length &&
        (pending.length === 32 ||
          scratchBytes + requiredScratchBytes > budget.limits.totalStringBytes)
      ) {
        await flush();
      }
      const entries = quads
        .map((quad) => {
          budget.charge("embeddedValues", 1, undefined, "RDF_RESOURCE_LIMIT");
          return `[${termKey(quad.subject, id)},${termKey(quad.predicate, id)},${termKey(quad.object, id)}]`;
        })
        .sort();
      const signature = JSON.stringify([colors.get(id), entries]);
      scratchBytes += requiredScratchBytes;
      if (!pendingColors.has(signature)) {
        pendingColors.set(signature, digest(signature, budget));
      }
      const result = pendingColors.get(signature).then((color) => [id, color]);
      // A later synchronous budget failure can abandon this batch. Observe each
      // rejection immediately; the original promise still rejects in flush().
      result.catch(() => {});
      pending.push(result);
    }
    await flush();
    rounds++;
    const nextClasses = new Set(next.values()).size;
    colors = next;
    if (nextClasses <= classes) {
      classes = nextClasses;
      break;
    }
    classes = nextClasses;
  }
  const refined = dataset.slice();
  for (const [id, value] of colors) {
    budget.charge("rdfQuads", 1, undefined, "RDF_RESOURCE_LIMIT");
    refined.push({
      subject: { termType: "BlankNode", value: id },
      predicate,
      object: { termType: "Literal", value, language: "", datatype },
      graph: { termType: "DefaultGraph", value: "" },
    });
  }
  return { dataset: refined, rounds, classes };
}
