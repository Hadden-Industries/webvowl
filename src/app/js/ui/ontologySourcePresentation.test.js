import { describe, expect, test } from "@jest/globals";
import {
  formatSourceDate,
  presentOntologySources,
  sourceCheckDescription,
  sourceWebUrl,
} from "./ontologySourcePresentation.js";

const skos = {
  requestedDocumentIri: "http://www.w3.org/2004/02/skos/core",
  role: "import",
  artifactIri: "https://haddenindustries.com/ontology/cache/artifacts/sha256/a",
  acquiredAt: "2026-10-31T01:26:23.720Z",
  checkedAt: "2026-11-02T10:05:44.344Z",
  checkOutcome: "not-checked",
};
function state(sources = [skos], cache = {}) {
  return {
    status: "ready",
    loadGeneration: 1,
    documentRevision: 0,
    source: {
      kind: "ontology-document-iri",
      identity: "https://example.test/iso/latest",
      cache: {
        sources,
        status: "archived",
        loadGeneration: 1,
        documentRevision: 0,
        ...cache,
      },
    },
  };
}

test("a direct root with a saved import names that import and its storage operator", () => {
  const view = presentOntologySources(state(), [
    skos.requestedDocumentIri,
    "urn:other-import",
  ]);
  expect(view.message).toBe("Includes a saved copy of SKOS.");
  expect(view.checkLabel).toBe("Check SKOS for updates");
  expect(view.storage).toContain("Hadden Industries ontology service");
  expect(
    view.sources.map(({ role, saved, requestedDocumentIri }) => ({
      role,
      saved,
      requestedDocumentIri,
    })),
  ).toEqual([
    {
      role: "ontology",
      saved: false,
      requestedDocumentIri: "https://example.test/iso/latest",
    },
    {
      role: "import",
      saved: true,
      requestedDocumentIri: skos.requestedDocumentIri,
    },
    { role: "import", saved: false, requestedDocumentIri: "urn:other-import" },
  ]);
});

test("root provenance is identified by role even when imports precede it", () => {
  const root = {
    ...skos,
    role: "ontology",
    requestedDocumentIri: "https://example.test/iso/latest",
    acquiredAt: "2026-11-01T00:00:00Z",
  };
  const view = presentOntologySources(state([skos, root]));
  expect(view.sources[0]).toMatchObject({
    role: "ontology",
    saved: true,
    acquiredAt: root.acquiredAt,
  });
  expect(view.sources).toHaveLength(2);
  expect(view.message).toBe("Ontology and 1 import loaded from saved copies.");
  expect(view.storage).toContain("Hadden Industries ontology service");
  expect(view.checkLabel).toBe("Check saved sources for updates");
});

test("reused results never claim that a new check found no changes", () => {
  const source = { ...skos, checkOutcome: "reused" };
  const view = presentOntologySources(state([source], { status: "checked" }));
  expect(view.message).toBe("Using the last recorded check for SKOS.");
  expect(sourceCheckDescription(source)).toContain(
    "no new publisher check was made",
  );
  expect(sourceCheckDescription({ ...source, checkedAt: undefined })).toContain(
    "not recorded",
  );
});

test("partial failures preserve individual outcomes and identify their scope", () => {
  const sources = [
    { ...skos, checkOutcome: "checked" },
    { ...skos, requestedDocumentIri: "urn:recent", checkOutcome: "reused" },
    { ...skos, requestedDocumentIri: "urn:failed", checkOutcome: "failed" },
  ];
  const view = presentOntologySources(
    state(sources, { status: "check-failed" }),
  );
  expect(view.message).toBe(
    "Checked 1 of 3 saved sources; reused 1 recent result. 1 document could not be checked.",
  );
  expect(view.attention).toBe(true);
});

test("available updates describe the loaded graph separately from the newer copy", () => {
  const source = { ...skos, hasUpdate: true, checkOutcome: "checked" };
  expect(
    presentOntologySources(
      state([source], { status: "update-available", hasUpdate: true }),
    ).message,
  ).toContain("The loaded graph has not changed");
  expect(sourceCheckDescription(source)).toContain(
    "graph still uses the loaded copy",
  );
});

test("update selection failure is attributed to its document while other check results remain intact", () => {
  const root = {
    ...skos,
    requestedDocumentIri: "https://example.test/iso/latest",
    role: "ontology",
    checkOutcome: "checked",
    hasUpdate: true,
  };
  const view = presentOntologySources(
    state([root, { ...skos, checkOutcome: "checked", hasUpdate: true }], {
      status: "update-failed",
      code: "CACHE_OFFER_SUPERSEDED",
      hasUpdate: false,
      updateFailure: {
        requestedDocumentIri: skos.requestedDocumentIri,
        code: "CACHE_OFFER_SUPERSEDED",
      },
    }),
  );
  expect(view.sources[0].updateFailure).toBeUndefined();
  expect(sourceCheckDescription(view.sources[0])).toContain(
    "newer copy is available",
  );
  expect(sourceCheckDescription(view.sources[1])).toContain(
    "available update changed",
  );
  expect(view.hasUpdate).toBe(false);
  expect(view.attention).toBe(true);
});

test.each([
  "ontology-text",
  "ontology-bytes",
  "vowl-json-text",
  "vowl-json-bytes",
])("local %s provenance never claims a URL load", (kind) => {
  const local = state();
  local.source = { kind, displayName: "example.json" };
  const view = presentOntologySources(local);
  expect(view.visible).toBe(false);
  expect(view.sources[0].description).toContain("local");
  expect(view.sources[0].description).not.toContain("selected URL");
  expect(view.sources[0].description).not.toContain("selected JSON URL");
});

test.each(["documentRevision", "loadGeneration"])(
  "%s changes invalidate actions without mislabelling an earlier load as an edit",
  (field) => {
    const changed = state([skos], { hasUpdate: true });
    changed[field]++;
    const view = presentOntologySources(changed);
    expect(view.expired).toBe(true);
    expect(view.message).toContain(
      field === "documentRevision" ? "graph has edits" : "earlier load",
    );
  },
);

describe("readable and safe provenance", () => {
  test("dates use the requested locale and timezone and omit milliseconds", () => {
    const date = formatSourceDate(skos.checkedAt, {
      locale: "en-GB",
      timeZone: "Europe/Bucharest",
    });
    expect(date).toMatch(/2 Nov 2026/);
    expect(date).toContain("12:05");
    expect(date).not.toContain(".344");
    expect(
      formatSourceDate(skos.checkedAt, { locale: "en-US", timeZone: "UTC" }),
    ).toMatch(/10:05.*UTC/);
    expect(formatSourceDate("invalid")).toBe("Not recorded");
    expect(formatSourceDate(undefined)).toBe("Not recorded");
  });
  test("document identifiers are only made into links for HTTP or HTTPS", () => {
    expect(sourceWebUrl("javascript:alert(1)")).toBeUndefined();
    expect(sourceWebUrl("data:text/html,<script>")).toBeUndefined();
    expect(sourceWebUrl("urn:ontology:example")).toBeUndefined();
    expect(sourceWebUrl(skos.requestedDocumentIri)).toBe(
      skos.requestedDocumentIri,
    );
  });
  test("a service without known ownership is named by its own origin", () => {
    expect(
      presentOntologySources(
        state([{ ...skos, artifactIri: "https://other.example/copy" }]),
      ).storage,
    ).toBe("Stored by https://other.example.");
  });
});
