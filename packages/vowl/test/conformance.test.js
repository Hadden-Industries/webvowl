import { canonicalize, decode, encode } from "vowl";
import {
  negatives,
  positives,
  readJson,
  readPinned,
} from "./independentCorpus.js";

test.each(negatives)(
  "independent rejection or boundary: $id",
  async (vector) => {
    const input = readPinned(vector.input);
    const operation =
      vector.operation === "decode"
        ? decode(new Uint8Array(input), vector.options)
        : canonicalize(JSON.parse(input), {
            profile: vector.profile,
            ...vector.options,
          });
    if (vector.expectedError === null) {
      expect(encode(await operation)).toEqual(
        new Uint8Array(readPinned(vector.expectedCanonical)),
      );
    } else {
      await expect(operation).rejects.toMatchObject({
        code: vector.expectedError,
      });
    }
  },
);

describe("independently authored expanded vectors", () => {
  for (const vector of positives) {
    test(vector.id, async () => {
      const source = readJson(vector.files["source.json"]);
      const expected = new Uint8Array(
        readPinned(vector.files["canonical.json"]),
      );
      const document = await canonicalize(source, { profile: vector.profile });
      expect(encode(document)).toEqual(expected);
      expect(encode(await decode(expected))).toEqual(expected);
      if (vector.files["permuted-source.json"]) {
        const permuted = readJson(vector.files["permuted-source.json"]);
        expect(
          encode(await canonicalize(permuted, { profile: vector.profile })),
        ).toEqual(expected);
      }
    });
  }
});
