import { isIri } from "@hyperjump/uri";
import { at, fail } from "../errors.js";
import { compareBytes, jsonBytes } from "../canonicalJson.js";
import { profiles, migrationDialect as dialect } from "../profiles.js";
import { snapshotSource } from "../snapshot.js";
import { validateOperationOptions } from "../resourceBudget.js";

export { dialect };

/** Validate flat option data before allocating the operation's listeners/timer. */
export function migrationChecks(options, startedAt) {
  return {
    dialect(value) {
      if (value !== dialect) {
        fail("MIGRATION_DIALECT_UNKNOWN", "/dialect");
      }
    },
    profile(value) {
      if (!Object.values(profiles).includes(value)) {
        fail("OPTION_INVALID", "/profile");
      }
    },
    resolutions(value) {
      if (value === undefined) {
        return;
      }
      if (!Array.isArray(value)) {
        fail("MIGRATION_RESOLUTION_INVALID", "/resolutions");
      }
      // Limits have already passed A7's ordered option checks at this point.
      const limits = validateOperationOptions({ limits: options.limits });
      if (value.length > limits.embeddedValues) {
        fail("MODEL_RESOURCE_LIMIT", "/resolutions");
      }
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1) {
        fail("MIGRATION_RESOLUTION_INVALID", "/resolutions");
      }
      const seen = new Set();
      for (let index = 0; index < value.length; index++) {
        if (performance.now() >= startedAt + limits.deadlineMs) {
          fail("DEADLINE_EXCEEDED");
        }
        const pointer = `/resolutions/${index}`;
        const member = Object.getOwnPropertyDescriptor(value, String(index));
        if (!member?.enumerable || !("value" in member)) {
          fail("MIGRATION_RESOLUTION_INVALID", pointer);
        }
        const record = member.value;
        if (
          !record ||
          typeof record !== "object" ||
          Array.isArray(record) ||
          ![null, Object.prototype].includes(Object.getPrototypeOf(record))
        ) {
          fail("MIGRATION_RESOLUTION_INVALID", pointer);
        }
        const data = Object.create(null);
        for (const key of Reflect.ownKeys(record)) {
          const descriptor = Object.getOwnPropertyDescriptor(record, key);
          if (
            typeof key !== "string" ||
            !descriptor.enumerable ||
            !("value" in descriptor)
          ) {
            fail("MIGRATION_RESOLUTION_INVALID", pointer);
          }
          data[key] = descriptor.value;
        }
        const viewport = data.kind === "viewport";
        const required = viewport
          ? ["kind", "sourcePointer", "width", "height"]
          : ["kind", "sourcePointer", "iri"];
        if (
          !["viewport", "ontology-iri", "annotation-predicate"].includes(
            data.kind,
          ) ||
          Object.keys(data).length !== required.length ||
          required.some((key) => !Object.hasOwn(data, key))
        ) {
          fail("MIGRATION_RESOLUTION_INVALID", pointer);
        }
        for (const key of ["sourcePointer", ...(viewport ? [] : ["iri"])]) {
          if (typeof data[key] !== "string") {
            fail("MIGRATION_RESOLUTION_INVALID", at(pointer, key));
          }
          if (data[key].length > limits.stringBytes) {
            fail("MODEL_RESOURCE_LIMIT", at(pointer, key));
          }
        }
        if (!/^(?:\/(?:[^~/]|~[01])*)*$/.test(data.sourcePointer)) {
          fail("MIGRATION_RESOLUTION_INVALID", at(pointer, "sourcePointer"));
        }
        if (viewport) {
          for (const key of ["width", "height"]) {
            if (
              typeof data[key] !== "number" ||
              !Number.isFinite(data[key]) ||
              data[key] <= 0
            ) {
              fail("MIGRATION_RESOLUTION_INVALID", at(pointer, key));
            }
          }
        } else if (!isIri(data.iri)) {
          fail("MIGRATION_RESOLUTION_INVALID", at(pointer, "iri"));
        }
        const key = JSON.stringify([data.kind, data.sourcePointer]);
        if (seen.has(key)) {
          fail("MIGRATION_RESOLUTION_INVALID", pointer);
        }
        seen.add(key);
      }
    },
  };
}

/** Own resolution snapshots, their exact eligibility, and noncanonical diagnostics. */
export function migrationPolicy(options, budget) {
  const resolutions = snapshotSource(
    { resolutions: options.resolutions ?? [] },
    budget,
  ).resolutions;
  const entries = new Map(
    resolutions.map((record, index) => [
      JSON.stringify([record.kind, record.sourcePointer]),
      { record, index },
    ]),
  );
  const eligible = new Set();
  const used = new Set();
  const diagnostics = new Map();
  function diagnostic(code, sourcePointer) {
    budget.check();
    const value = {
      code,
      severity: "warning",
      sourcePointer,
      details:
        code === "MIGRATION_DROPPED_FIELD"
          ? "Discarded legacy presentation or redundant information."
          : "Applied an explicit resolution at the unresolved legacy field.",
    };
    const snapshot = snapshotSource({ diagnostic: value }, budget).diagnostic;
    diagnostics.set(JSON.stringify([code, sourcePointer]), snapshot);
  }
  return {
    drop(pointer) {
      diagnostic("MIGRATION_DROPPED_FIELD", pointer);
    },
    allow(kind, pointer) {
      eligible.add(JSON.stringify([kind, pointer]));
    },
    validate() {
      for (const [key, { index }] of entries) {
        budget.check();
        if (!eligible.has(key)) {
          fail("MIGRATION_RESOLUTION_INVALID", `/resolutions/${index}`);
        }
      }
    },
    resolve(kind, pointer, accepts = () => true) {
      budget.check();
      const key = JSON.stringify([kind, pointer]);
      const entry = entries.get(key);
      if (!entry) {
        fail("MIGRATION_AMBIGUOUS", pointer);
      }
      if (!accepts(entry.record)) {
        fail("MIGRATION_RESOLUTION_INVALID", `/resolutions/${entry.index}`);
      }
      used.add(key);
      diagnostic("MIGRATION_RESOLVED_FIELD", pointer);
      return entry.record;
    },
    finish() {
      for (const [key, { index }] of entries) {
        budget.check();
        if (!used.has(key)) {
          fail("MIGRATION_RESOLUTION_INVALID", `/resolutions/${index}`);
        }
      }
      const rows = [...diagnostics.values()].map((value) => ({
        value,
        bytes: jsonBytes(value),
      }));
      rows.sort((a, b) => {
        budget.check();
        return compareBytes(a.bytes, b.bytes);
      });
      return rows.map(({ value }) => value);
    },
  };
}
