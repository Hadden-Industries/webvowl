export const VOWL_BENCHMARK_GENERATOR_VERSION =
  "webvowl-vowl-benchmark-corpus-v1";

const MAX_CLASS_COUNT = 5_000_000;

const requireCount = (value) => {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CLASS_COUNT) {
    throw new RangeError(
      `count must be an integer from 0 through ${MAX_CLASS_COUNT}`,
    );
  }
  return value;
};

const repeated = (count, createLine) => {
  const lines = new Array(requireCount(count));
  for (let index = 0; index < lines.length; index += 1) {
    lines[index] = createLine(index);
  }
  return lines.join("\n");
};

const generators = Object.freeze({
  functional({ count }) {
    const declarations = repeated(
      count,
      (index) => `Declaration(Class(:C${index}))`,
    );
    return `Prefix(:=<urn:webvowl:benchmark:>)\nOntology(<urn:webvowl:benchmark:functional>\n${declarations}\n)`;
  },

  rdfxml({ count }) {
    const declarations = repeated(
      count,
      (index) => `<owl:Class rdf:about="urn:webvowl:benchmark:C${index}"/>`,
    );
    return `<?xml version="1.0" encoding="UTF-8"?>\n<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:owl="http://www.w3.org/2002/07/owl#">\n${declarations}\n</rdf:RDF>`;
  },
});

export const generateVowlBenchmarkFixture = (kind, parameters = {}) => {
  const generator = generators[kind];
  if (!generator) {
    throw new RangeError(`Unknown VOWL benchmark fixture kind: ${kind}`);
  }
  return generator(parameters);
};
