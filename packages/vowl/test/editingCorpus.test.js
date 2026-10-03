import { decode, edit, encode } from "vowl";
import {
  editingManifest as manifest,
  positives,
  readJson,
  readPinned as read,
} from "./independentCorpus.js";
const byPrevious = (pairs) =>
  [...pairs].sort((left, right) =>
    left.previous < right.previous
      ? -1
      : left.previous > right.previous
        ? 1
        : 0,
  );

test.each(manifest.vectors)(
  "independent atomic editing corpus: $id",
  async (vector) => {
    const beforeBytes = new Uint8Array(read(vector.before["canonical.json"]));
    const document = await decode(beforeBytes);
    const changes = JSON.parse(read(vector.changes));
    if (vector.outcome === "error") {
      await expect(edit(document, changes)).rejects.toMatchObject({
        code: vector.expectedError,
      });
    } else {
      const result = await edit(document, changes);
      const expected = JSON.parse(read(vector.expectedCorrespondence));
      expect(encode(result.document)).toEqual(
        new Uint8Array(read(vector.after["canonical.json"])),
      );
      expect(byPrevious(result.correspondence)).toEqual(
        byPrevious(expected.correspondence),
      );
      expect([...result.created].sort()).toEqual([...expected.created].sort());
    }
    expect(encode(document)).toEqual(beforeBytes);
  },
);

// Additional request controls derive from the amendment's fresh-handle rule.
// They do not manufacture new canonical outputs or alter the frozen corpus.
const insertSubject = (id, iri = "urn:editing:additional") => ({
  kind: "insert",
  collection: "subjects",
  record: { id, iri },
});
const insertRole = (id) => ({
  kind: "insert",
  collection: "roles",
  record: { id, kind: "class", subject: "s0" },
});
const freshControls = [
  [
    "insert-remove-reinsert-same-category",
    [
      insertSubject("fresh"),
      { kind: "remove", id: "fresh" },
      insertSubject("fresh", "urn:editing:other"),
    ],
  ],
  [
    "insert-remove-reinsert-different-category",
    [
      insertSubject("fresh"),
      { kind: "remove", id: "fresh" },
      insertRole("fresh"),
    ],
  ],
  [
    "fresh-handle-cannot-span-two-categories",
    [insertSubject("fresh"), insertRole("fresh")],
  ],
  ["existing-role-handle-cannot-name-inserted-subject", [insertSubject("r0")]],
];
test.each(freshControls)(
  "independent fresh-handle request control: %s",
  async (_id, changes) => {
    const beforeBytes = new Uint8Array(
      read(manifest.vectors[0].before["canonical.json"]),
    );
    const document = await decode(beforeBytes);
    await expect(edit(document, changes)).rejects.toMatchObject({
      code: "EDIT_INVALID",
    });
    expect(encode(document)).toEqual(beforeBytes);
  },
);

test("a genuinely fresh insertion followed by its removal preserves the source document", async () => {
  const beforeBytes = new Uint8Array(
    read(manifest.vectors[0].before["canonical.json"]),
  );
  const document = await decode(beforeBytes);
  const result = await edit(document, [
    insertSubject("fresh"),
    { kind: "remove", id: "fresh" },
  ]);
  expect(encode(result.document)).toEqual(beforeBytes);
  expect(result.created).toEqual([]);
  expect(
    result.correspondence.every(
      ({ previous, current }) => previous === current,
    ),
  ).toBe(true);
  expect(encode(document)).toEqual(beforeBytes);
});

test.each(
  positives.filter(({ profile }) => profile.endsWith("/structural-content/v1")),
)(
  "independent structural corpus survives a no-op edit: $id",
  async (vector) => {
    const expected = new Uint8Array(read(vector.files["canonical.json"]));
    const document = await decode(expected);
    const result = await edit(document, []);
    expect(encode(result.document)).toEqual(expected);
    expect(result.created).toEqual([]);
    const primaryCount = readJson(vector.files["ids.json"]).length;
    expect(result.correspondence).toHaveLength(primaryCount);
    expect(
      new Set(result.correspondence.map(({ previous }) => previous)).size,
    ).toBe(primaryCount);
    expect(
      result.correspondence.every(
        ({ previous, current }) => previous === current,
      ),
    ).toBe(true);
  },
);
