import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { profiles, decode, encode } from "vowl";
import {
  profileSchema,
  expressionPayloads,
  constructPayloads,
  roleKinds,
} from "../src/modelContract.js";

const read = (path) => readFileSync(new URL(path, import.meta.url));
const matrix = JSON.parse(read("../conformance/projection-matrix.json"));

test.each([
  ["structural-content", profiles.structuralContent],
  ["artifact", profiles.artifact],
])(
  "%s schema is generated from the same closed inventory and validates independent bytes",
  async (name, profile) => {
    const schema = JSON.parse(read(`../schema/${name}.schema.json`));
    expect(schema).toEqual(profileSchema(profile));
    const ajv = new Ajv2020({ strict: true, validateFormats: false });
    const validate = ajv.compile(schema);
    const bytes = new Uint8Array(
      read(
        `../conformance/vectors/named-class-${name === "artifact" ? "artifact" : "structural"}/canonical.json`,
      ),
    );
    const document = await decode(bytes);
    expect(validate(document)).toBe(true);
    const invalid = JSON.parse(new TextDecoder().decode(encode(document)));
    invalid.structural.subjects[0].extra = true;
    expect(validate(invalid)).toBe(false);
  },
);

test("every role, expression and construct token is classified in the independent matrix", () => {
  const rows = matrix.rows ?? matrix.entries;
  for (const token of [
    ...roleKinds,
    ...Object.keys(expressionPayloads),
    ...Object.keys(constructPayloads),
    "assertion-anchor",
  ]) {
    expect(rows.some((row) => row.kind === token)).toBe(true);
  }
});
