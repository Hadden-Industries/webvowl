import { walkTyped, validateFields } from "../src/typedValues.js";
import { ResourceBudget } from "../src/resourceBudget.js";

const shape = { fields: { z: "IRI", "a/b": { items: "Role" } } };
const source = () => ({
  z: "urn:last",
  "a/b": [{ subject: "S", kind: "class", id: "R" }],
});

test("field validation reads frozen normalized values without skipping scalar checks or mutable normalization", () => {
  const budget = new ResourceBudget({}, performance.now());
  try {
    const value = { kind: "language", lexical: "label", language: "en-US" };
    validateFields(value, "Literal", budget);
    expect(value.language).toBe("en-us");
    Object.freeze(value);
    expect(() => validateFields(value, "Literal", budget)).not.toThrow();
    expect(() =>
      validateFields(
        Object.freeze({ ...value, language: "en--us" }),
        "Literal",
        budget,
      ),
    ).toThrow(expect.objectContaining({ code: "LANGUAGE_TAG_INVALID" }));
    expect(() =>
      validateFields(
        Object.freeze({ kind: "iri", iri: "relative" }),
        "AnnotationValue",
        budget,
      ),
    ).toThrow(expect.objectContaining({ code: "IRI_INVALID" }));
  } finally {
    budget.dispose();
  }
});

test("typed traversal retains A7 order, escaped locations and exact parent references", () => {
  const value = source();
  const visits = [];
  walkTyped(value, shape, (item, descriptor, pointer, parent, key) => {
    visits.push({ item, descriptor, pointer, parent, key });
  });
  expect(visits.map(({ pointer }) => pointer)).toEqual([
    "",
    "/a~1b",
    "/a~1b/0",
    "/a~1b/0/id",
    "/a~1b/0/kind",
    "/a~1b/0/subject",
    "/z",
  ]);
  expect(visits.map(({ item }) => item)).toEqual([
    value,
    value["a/b"],
    value["a/b"][0],
    "R",
    "class",
    "S",
    "urn:last",
  ]);
  expect(visits[2].parent).toBe(value["a/b"]);
  expect(visits[2].key).toBe(0);
  expect(visits[3].parent).toBe(value["a/b"][0]);
  expect(visits[3].key).toBe("id");
});

test("typed rewriting changes handles and references without changing literal IRIs or discriminants", () => {
  const value = source();
  walkTyped(value, shape, (item, descriptor, _pointer, parent, key) => {
    if (descriptor?.reference || descriptor?.id) {
      parent[key] = `next:${item}`;
    }
  });
  expect(value).toEqual({
    z: "urn:last",
    "a/b": [{ subject: "next:S", kind: "class", id: "next:R" }],
  });
});

test("invalid nested discriminants retain their exact escaped error locations", () => {
  const expressionShape = { fields: { "a/b": { items: "Expression" } } };
  const value = { "a/b": [{ id: "X", kind: "unknown" }] };
  expect(() => walkTyped(value, expressionShape, () => {})).toThrow(
    expect.objectContaining({
      code: "DOCUMENT_TYPE",
      pointer: "/a~1b/0/kind",
    }),
  );
});

test("typed traversal propagates cancellation at the caller's observation point", () => {
  const controller = new AbortController();
  const budget = new ResourceBudget(
    { signal: controller.signal },
    performance.now(),
  );
  let visits = 0;
  try {
    expect(() =>
      walkTyped(source(), shape, () => {
        visits++;
        if (visits === 3) {
          controller.abort();
        }
        budget.check();
      }),
    ).toThrow(expect.objectContaining({ code: "ABORTED" }));
    expect(visits).toBe(3);
  } finally {
    budget.dispose();
  }
});
