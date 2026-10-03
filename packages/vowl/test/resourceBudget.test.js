import { readFileSync } from "node:fs";
import { canonicalize, decode, edit, encode, profiles, VowlError } from "vowl";

const fixture = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../conformance/vectors/${name}/source.json`, import.meta.url),
    ),
  );
const empty = () => fixture("empty-structural");
const options = (limits) => ({ profile: profiles.structuralContent, limits });

test.each([false, true])(
  "option value errors follow UTF-16 field order: reversed=%s",
  async (reverse) => {
    const ordered = (value) =>
      Object.fromEntries(
        reverse ? Object.entries(value).reverse() : Object.entries(value),
      );
    const forged = Object.create(AbortSignal.prototype);
    for (const [profile, limits, pointer] of [
      ["unknown", { depth: 0 }, "/limits/depth"],
      ["unknown", { depth: 1 }, "/profile"],
      [
        profiles.structuralContent,
        { inputBytes: 0, depth: 0 },
        "/limits/depth",
      ],
      [profiles.structuralContent, { depth: 1 }, "/signal"],
    ]) {
      await expect(
        canonicalize(
          empty(),
          ordered({ profile, limits: ordered(limits), signal: forged }),
        ),
      ).rejects.toMatchObject({ code: "OPTION_INVALID", pointer });
    }
  },
);

test("all A8 upper override bounds are inclusive and preserve independently pinned bytes", async () => {
  // These are A8's published bounds, independent of the implementation's policy table.
  // The companion conformance vectors reject each upper bound plus one.
  const limits = {
    inputBytes: 268435456,
    primaryRecords: 1000000,
    embeddedValues: 4000000,
    depth: 512,
    stringBytes: 16777216,
    totalStringBytes: 134217728,
    rdfQuads: 8000000,
    rdfDeepIterations: 1000000,
    deadlineMs: 300000,
  };
  const expected = new Uint8Array(
    readFileSync(
      new URL(
        "../conformance/vectors/empty-structural/canonical.json",
        import.meta.url,
      ),
    ),
  );
  expect(encode(await canonicalize(empty(), options(limits)))).toEqual(
    expected,
  );
  expect(encode(await decode(expected, { limits }))).toEqual(expected);
});

test("zero deep-work allowance admits an independent fixture requiring no deep comparisons", async () => {
  const expected = new Uint8Array(
    readFileSync(
      new URL(
        "../conformance/vectors/empty-structural/canonical.json",
        import.meta.url,
      ),
    ),
  );
  expect(
    encode(await canonicalize(empty(), options({ rdfDeepIterations: 0 }))),
  ).toEqual(expected);
});

test.each([
  ["embeddedValues", 10, "MODEL_RESOURCE_LIMIT"],
  ["depth", 4, "MODEL_RESOURCE_LIMIT"],
  ["stringBytes", 11, "MODEL_RESOURCE_LIMIT"],
  ["totalStringBytes", 81, "MODEL_RESOURCE_LIMIT"],
  ["rdfQuads", 20, "RDF_RESOURCE_LIMIT"],
])(
  "empty source has an exact %s boundary of %i",
  async (limit, boundary, code) => {
    await expect(
      canonicalize(empty(), options({ [limit]: boundary - 1 })),
    ).rejects.toMatchObject({
      code,
      details: { limit, maximum: boundary - 1 },
    });
    const bounded = await canonicalize(empty(), options({ [limit]: boundary }));
    expect(encode(bounded)).toEqual(
      encode(await canonicalize(empty(), options({}))),
    );
  },
);

test("primary records and decoder bytes reject exactly below the fixture boundary", async () => {
  const source = fixture("named-class-structural");
  await expect(
    canonicalize(source, options({ primaryRecords: 2 })),
  ).rejects.toMatchObject({ code: "MODEL_RESOURCE_LIMIT" });
  const document = await canonicalize(source, options({ primaryRecords: 3 }));
  const bytes = encode(document);
  await expect(
    decode(bytes, { limits: { inputBytes: bytes.length - 1 } }),
  ).rejects.toMatchObject({ code: "INPUT_RESOURCE_LIMIT" });
  expect(
    encode(await decode(bytes, { limits: { inputBytes: bytes.length } })),
  ).toEqual(bytes);
});

test("a symmetric graph requiring deep work fails with a zero budget", async () => {
  const source = fixture("symmetric-anonymous-classes");
  await expect(
    canonicalize(source, options({ rdfDeepIterations: 0 })),
  ).rejects.toMatchObject({ code: "RDFC_RESOURCE_LIMIT" });
  const bytes = encode(await canonicalize(source, options({})));
  expect(
    encode(await canonicalize(source, options({ rdfDeepIterations: 1000000 }))),
  ).toEqual(bytes);
});

test("cancellation after snapshot interrupts actual asynchronous RDFC work", async () => {
  const controller = new AbortController();
  const pending = canonicalize(fixture("symmetric-anonymous-artifact"), {
    profile: profiles.artifact,
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
});

test.each(["canonicalize", "decode", "edit"])(
  "%s rejects forged signal receivers through the stable option boundary",
  async (operation) => {
    const document = await canonicalize(empty(), options({}));
    const signal = Object.create(AbortSignal.prototype);
    const invoke = () => {
      if (operation === "decode") {
        return decode(encode(document), { signal });
      }
      if (operation === "edit") {
        return edit(document, [], { signal });
      }
      return canonicalize(empty(), { ...options({}), signal });
    };
    await expect(invoke()).rejects.toBeInstanceOf(VowlError);
    await expect(invoke()).rejects.toMatchObject({
      code: "OPTION_INVALID",
      pointer: "/signal",
    });
  },
);

test.each([false, true])(
  "signal accessors and listener overrides are not executed (aborted=%s)",
  async (aborted) => {
    const controller = new AbortController();
    let invocations = 0;
    for (const name of ["aborted", "addEventListener", "removeEventListener"]) {
      Object.defineProperty(controller.signal, name, {
        get() {
          invocations += 1;
          throw new Error(`Caller accessor executed: ${name}`);
        },
      });
    }
    if (aborted) {
      controller.abort();
    }
    const pending = canonicalize(empty(), {
      ...options({}),
      signal: controller.signal,
    });
    if (aborted) {
      await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
    } else {
      expect(encode(await pending)).toEqual(
        encode(await canonicalize(empty(), options({}))),
      );
    }
    expect(invocations).toBe(0);
  },
);

test("overridden listener methods cannot suppress in-flight cancellation", async () => {
  const controller = new AbortController();
  let invocations = 0;
  for (const name of ["addEventListener", "removeEventListener"]) {
    Object.defineProperty(controller.signal, name, {
      value() {
        invocations += 1;
      },
    });
  }
  const pending = canonicalize(fixture("symmetric-anonymous-artifact"), {
    profile: profiles.artifact,
    signal: controller.signal,
  });
  controller.abort();
  await expect(pending).rejects.toMatchObject({ code: "ABORTED" });
  expect(invocations).toBe(0);
});

test("one monotonic deadline includes synchronous snapshot work", async () => {
  const source = empty();
  source.structural.ontology.imports = Array.from(
    { length: 30000 },
    (_value, i) => `urn:deadline:${i}`,
  );
  await expect(
    canonicalize(source, options({ deadlineMs: 1 })),
  ).rejects.toMatchObject({ code: "DEADLINE_EXCEEDED" });
});

test("lexical depth and decoded escaped-string bytes are bounded before schema validation", async () => {
  const bytes = (text) => new TextEncoder().encode(text);
  await expect(
    decode(bytes("[[[[[]]]]]"), { limits: { depth: 4 } }),
  ).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { limit: "depth" },
  });
  await expect(
    decode(bytes('{"a":"\\u20ac\\u20ac"}'), { limits: { stringBytes: 5 } }),
  ).rejects.toMatchObject({
    code: "MODEL_RESOURCE_LIMIT",
    details: { limit: "stringBytes" },
  });
});
