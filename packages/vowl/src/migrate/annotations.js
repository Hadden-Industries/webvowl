import { isIri } from "@hyperjump/uri";
import { at, fail } from "../errors.js";
import { namespaces } from "../profiles.js";
import { legacyScalar } from "./grammar.js";

/** Exact pinned builder spelling; this is only used to prove a synthetic label. */
export function legacyLocalName(iri, pointer) {
  try {
    return (
      decodeURIComponent(
        iri.slice(
          Math.max(
            iri.lastIndexOf("#"),
            iri.lastIndexOf("/"),
            iri.lastIndexOf(":"),
          ) + 1,
        ),
      ) || iri
    );
  } catch {
    fail("MIGRATION_AMBIGUOUS", pointer);
  }
}

function exactPredicate(item) {
  return item.predicateNs === "" &&
    isIri(item.identifier) &&
    /[#/:]$/.test(item.identifier)
    ? item.identifier
    : undefined;
}

/** Plan annotation conversion before consuming any resolution, so unused pointers fail first. */
export function annotationReader({ budget, policy, subject, append }) {
  const redundancy = new WeakMap();
  function generic(map, pointer) {
    if (!map || !Object.keys(map).length) {
      if (map) {
        policy.drop(pointer);
      }
      return () => [];
    }
    const pending = [];
    for (const key of Object.keys(map).sort()) {
      map[key].forEach((item, index) => {
        budget.check();
        const path = at(at(pointer, key), index);
        if (
          item.identifier !== key ||
          (item.type === "iri" && Object.hasOwn(item, "language"))
        ) {
          fail("MIGRATION_AMBIGUOUS", path);
        }
        const known = exactPredicate(item);
        if (!known) {
          policy.allow("annotation-predicate", path);
        }
        const children = generic(item.annotations, at(path, "annotations"));
        pending.push(() => {
          const predicate =
            known ??
            policy.resolve("annotation-predicate", path, ({ iri }) => {
              const split = Math.max(
                iri.lastIndexOf("#"),
                iri.lastIndexOf("/"),
                iri.lastIndexOf(":"),
              );
              const namespace = iri.slice(split + 1)
                ? iri.slice(0, split + 1)
                : "";
              return (
                legacyLocalName(iri, path) === item.identifier &&
                (item.predicateNs === undefined ||
                  item.predicateNs === namespace)
              );
            }).iri;
          let value;
          if (item.type === "iri") {
            value =
              item.value.startsWith("_:") && item.value.length > 2
                ? { kind: "subject", subject: subject(item.value, true) }
                : {
                    kind: "iri",
                    iri: legacyScalar(
                      item.value,
                      "IRI",
                      at(path, "value"),
                      budget,
                    ),
                  };
          } else {
            if (!item.language || item.language === "undefined") {
              fail("MIGRATION_AMBIGUOUS", at(path, "language"));
            }
            value = {
              kind: "language",
              lexical: item.value,
              language: legacyScalar(
                item.language,
                "LanguageTag",
                at(path, "language"),
                budget,
              ),
            };
          }
          policy.drop(at(path, "identifier"));
          if (Object.hasOwn(item, "predicateNs")) {
            policy.drop(at(path, "predicateNs"));
          }
          return { predicate, value, annotations: children() };
        });
      });
      if (!map[key].length) {
        policy.drop(at(pointer, key));
      }
    }
    return () =>
      pending.map((build) => {
        budget.check();
        return build();
      });
  }
  function redundant(value, language, map, families) {
    if (!map) {
      return false;
    }
    let indexed = redundancy.get(map);
    if (!indexed) {
      indexed = new Map();
      redundancy.set(map, indexed);
    }
    for (const family of families) {
      let values = indexed.get(family);
      if (!values) {
        values = new Map();
        for (const item of map[family] ?? []) {
          budget.check();
          if (item.type === "label") {
            if (!values.has(item.value)) {
              values.set(item.value, new Set());
            }
            values.get(item.value).add(item.language?.toLowerCase());
          }
        }
        indexed.set(family, values);
      }
      if (
        language === undefined
          ? values.has(value)
          : values.get(value)?.has(language.toLowerCase())
      ) {
        return true;
      }
    }
    return false;
  }
  function localized(value, pointer, { predicate, iri, map, families = [] }) {
    if (value === undefined) {
      return () => [];
    }
    if (
      value === "" ||
      (typeof value === "object" && !Object.keys(value).length)
    ) {
      policy.drop(pointer);
      return () => [];
    }
    const pending = [];
    for (const [language, lexical] of typeof value === "string"
      ? [[undefined, value]]
      : Object.entries(value)) {
      budget.check();
      const path = language === undefined ? pointer : at(pointer, language);
      const builtin =
        predicate === namespaces.rdfs + "label" &&
        language === "undefined" &&
        ((iri === namespaces.owl + "Thing" && lexical === "Thing") ||
          (iri === namespaces.rdfs + "Literal" && lexical === "Literal"));
      if (
        builtin ||
        (predicate === namespaces.rdfs + "label" &&
          language === "IRI-based" &&
          iri &&
          lexical === legacyLocalName(iri, path)) ||
        (!predicate && redundant(lexical, language, map, families))
      ) {
        policy.drop(path);
        continue;
      }
      if (!language || ["undefined", "IRI-based"].includes(language)) {
        fail("MIGRATION_AMBIGUOUS", path);
      }
      const normalized = legacyScalar(language, "LanguageTag", path, budget);
      if (!predicate) {
        policy.allow("annotation-predicate", path);
      }
      pending.push(() => ({
        predicate:
          predicate ?? policy.resolve("annotation-predicate", path).iri,
        value: { kind: "language", lexical, language: normalized },
        annotations: [],
      }));
    }
    return () => pending.map((build) => build());
  }
  function summary(value, pointer, map, families) {
    if (value === undefined) {
      return;
    }
    for (const lexical of Array.isArray(value) ? value : [value]) {
      budget.check();
      if (lexical !== "" && !redundant(lexical, undefined, map, families)) {
        fail("MIGRATION_AMBIGUOUS", pointer);
      }
    }
    policy.drop(pointer);
  }
  return {
    prepare(
      record,
      paths,
      {
        iri,
        target,
        ontology = false,
        labelKey = "label",
        commentKey = "comment",
      },
    ) {
      const location = (key) =>
        paths instanceof Map ? paths.get(key) : at(paths, key);
      const mapKey = ontology ? "other" : "annotations";
      const map = record[mapKey];
      const pending = [
        generic(map, location(mapKey)),
        localized(record[labelKey], location(labelKey), {
          predicate: namespaces.rdfs + "label",
          iri,
        }),
        localized(record[commentKey], location(commentKey), {
          predicate: namespaces.rdfs + "comment",
        }),
        localized(record.description, location("description"), {
          map,
          families: ["description"],
        }),
      ];
      if (ontology) {
        pending.push(
          localized(record.title, location("title"), {
            map,
            families: ["title"],
          }),
        );
        summary(record.author, location("author"), map, ["author", "creator"]);
        summary(record.version, location("version"), map, ["versionInfo"]);
      }
      return () => {
        const annotations = pending.flatMap((build) => {
          budget.check();
          return build();
        });
        if (ontology) {
          return annotations;
        }
        for (const annotation of annotations) {
          const assertion = {
            kind: "annotation-assertion",
            subject: target,
            predicate: annotation.predicate,
            value: annotation.value,
          };
          append("constructs", assertion);
          if (annotation.annotations.length) {
            append("constructs", {
              kind: "assertion-anchor",
              assertion,
              annotations: annotation.annotations,
            });
          }
        }
        return annotations;
      };
    },
  };
}
