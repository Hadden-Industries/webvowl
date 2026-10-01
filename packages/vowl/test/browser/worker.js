import { canonicalize, decode, encode, edit, profiles } from "vowl";
import { fromOwl } from "vowl/owl";
import { migrate } from "vowl/migrate";

self.addEventListener("message", async ({ data: suite }) => {
  const vectors = suite.core;
  const startedAt = performance.now();
  const results = [];
  for (const vector of vectors) {
    try {
      const document = await canonicalize(vector.source, {
        profile: vector.profile,
      });
      const text = new TextDecoder().decode(encode(document));
      if (text !== vector.expected) {
        throw new Error("independent-byte-mismatch");
      }
      const verified = await decode(encode(document));
      if (new TextDecoder().decode(encode(verified)) !== text) {
        throw new Error("decoder-byte-mismatch");
      }
      results.push({ name: vector.name, status: "passed" });
    } catch (error) {
      results.push({
        name: vector.name,
        status: "failed",
        code: error.code ?? error.message,
      });
    }
  }
  for (const [family, operation] of [
    ["owl", fromOwl],
    ["migration", migrate],
  ]) {
    for (const vector of suite[family]) {
      const calls = [];
      try {
        const options = { ...vector.options };
        if (vector.imports?.length) {
          options.resolveImport = async (importIri, context) => {
            calls.push({
              importIri,
              importingDocumentIri: context.importingDocumentIri,
            });
            const response = vector.imports.find(
              (entry) => entry.importIri === importIri,
            );
            if (!response || !(context.signal instanceof AbortSignal)) {
              throw new Error("resolver-context-mismatch");
            }
            return {
              bytes: new TextEncoder().encode(response.text),
              documentIri: response.documentIri,
              mediaType: response.mediaType,
            };
          };
        }
        let result, failure;
        try {
          result = await operation(
            new TextEncoder().encode(vector.text),
            options,
          );
        } catch (error) {
          failure = error;
        }
        if (vector.outcome === "error") {
          if (failure?.code !== vector.errorCode) {
            throw new Error(
              `expected-${vector.errorCode}-received-${failure?.code}`,
            );
          }
        } else {
          if (failure) {
            throw failure;
          }
          if (
            new TextDecoder().decode(encode(result.document)) !==
            vector.expected
          ) {
            throw new Error("independent-byte-mismatch");
          }
          if (!Object.isFrozen(result) || !Object.isFrozen(result.document)) {
            throw new Error("mutable-result");
          }
        }
        if (family === "owl") {
          const key = (values) =>
            JSON.stringify(
              [
                ...new Set(
                  values.map(({ importIri, importingDocumentIri }) =>
                    JSON.stringify([importIri, importingDocumentIri]),
                  ),
                ),
              ].sort(),
            );
          if (key(calls) !== key(vector.resolverContexts)) {
            throw new Error("resolver-calls-mismatch");
          }
        }
        results.push({ name: `${family}/${vector.name}`, status: "passed" });
      } catch (error) {
        results.push({
          name: `${family}/${vector.name}`,
          status: "failed",
          code: error.code ?? error.message,
        });
      }
    }
  }
  try {
    const blank = vectors.find((vector) => vector.name === "empty-structural");
    const document = await canonicalize(blank.source, {
      profile: profiles.structuralContent,
    });
    const result = await edit(document, [
      {
        kind: "insert",
        collection: "subjects",
        record: { id: "s", iri: "urn:browser" },
      },
      {
        kind: "insert",
        collection: "roles",
        record: { id: "r", kind: "class", subject: "s" },
      },
    ]);
    if (result.document.structural.occurrences.length !== 1) {
      throw new Error("edit-projection-mismatch");
    }
    results.push({ name: "atomic-edit", status: "passed" });
    for (const end of ["domain", "range"]) {
      const generic = (
        await edit(document, [
          {
            kind: "insert",
            collection: "subjects",
            record: { id: "thing", iri: "http://www.w3.org/2002/07/owl#Thing" },
          },
          {
            kind: "insert",
            collection: "roles",
            record: { id: "generic", kind: "rdf-class", subject: "thing" },
          },
        ])
      ).document;
      const changed = await edit(generic, [
        {
          kind: "insert",
          collection: "subjects",
          record: { id: "p", iri: "urn:p" },
        },
        {
          kind: "insert",
          collection: "roles",
          record: { id: "property", kind: "object-property", subject: "p" },
        },
        {
          kind: "insert",
          collection: "constructs",
          record: {
            id: "endpoint",
            kind: `object-${end}`,
            property: "property",
            target: generic.structural.roles[0].id,
          },
        },
      ]);
      const bytes = encode(changed.document);
      if (
        new TextDecoder().decode(encode(await decode(bytes))) !==
        new TextDecoder().decode(bytes)
      ) {
        throw new Error(`edited-${end}-byte-mismatch`);
      }
      results.push({ name: `edited-explicit-${end}`, status: "passed" });
    }
  } catch (error) {
    results.push({
      name: "atomic-edit",
      status: "failed",
      code: error.code ?? error.message,
    });
  }
  try {
    const controller = new AbortController();
    const vector = vectors.find(
      (entry) => entry.name === "per-property-datatype",
    );
    const pending = canonicalize(vector.source, {
      profile: vector.profile,
      signal: controller.signal,
    });
    controller.abort();
    try {
      await pending;
      throw new Error("cancellation-accepted-input");
    } catch (error) {
      if (error.code !== "ABORTED") {
        throw error;
      }
    }
    results.push({ name: "in-flight-cancellation", status: "passed" });
  } catch (error) {
    results.push({
      name: "in-flight-cancellation",
      status: "failed",
      code: error.code ?? error.message,
    });
  }
  for (const family of ["owl", "migration"]) {
    try {
      const controller = new AbortController();
      let pending;
      if (family === "owl") {
        pending = fromOwl(
          new TextEncoder().encode("Ontology(Import(<urn:pending>))"),
          {
            documentIri: "urn:browser:root",
            mediaType: "text/owl-functional",
            signal: controller.signal,
            resolveImport: (_iri, { signal }) => {
              if (!(signal instanceof AbortSignal)) {
                throw new Error("missing-resolver-signal");
              }
              queueMicrotask(() => controller.abort());
              return new Promise(() => {});
            },
          },
        );
      } else {
        const vector = suite.migration.find(
          (entry) => entry.name === "named-class-structural",
        );
        pending = migrate(new TextEncoder().encode(vector.text), {
          ...vector.options,
          signal: controller.signal,
        });
        controller.abort();
      }
      try {
        await pending;
        throw new Error("abort-accepted");
      } catch (error) {
        if (error.code !== "ABORTED") {
          throw error;
        }
      }
      results.push({ name: `${family}/cancellation`, status: "passed" });
    } catch (error) {
      results.push({
        name: `${family}/cancellation`,
        status: "failed",
        code: error.code ?? error.message,
      });
    }
  }
  self.postMessage({
    status: results.every((result) => result.status === "passed")
      ? "passed"
      : "failed",
    elapsedMs: performance.now() - startedAt,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    denominators: {
      core: suite.core.length,
      owl: suite.owl.length,
      migration: suite.migration.length,
    },
    total: results.length,
    passed: results.filter((result) => result.status === "passed").length,
    failures: results.filter((result) => result.status !== "passed"),
  });
});
