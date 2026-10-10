import { isIri } from "@hyperjump/uri";

const POSITIONABLE = new Set(["class-node", "datatype-node", "label"]);

function sceneError(code) {
  const error = new Error(code.replaceAll("_", " ").toLowerCase());
  error.code = code;
  return error;
}

function finitePoint(point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw sceneError("SCENE_POSITION_INVALID");
  }
  return { x: point.x, y: point.y };
}

/** Close visibility over admitted incidence, without generating any topology. */
export function closeVowlVisibility(occurrences, hidden) {
  const ids = new Set(occurrences.map(({ id }) => id));
  const result = new Set(hidden);
  if ([...result].some((id) => !ids.has(id))) {
    throw sceneError("SCENE_OCCURRENCE_MISSING");
  }
  for (const occurrence of occurrences) {
    const endpoints = occurrence.ends ?? [occurrence.from, occurrence.to];
    if (endpoints.some((id) => id !== undefined && result.has(id))) {
      result.add(occurrence.id);
    }
  }
  for (const occurrence of occurrences) {
    if (occurrence.kind === "label" && result.has(occurrence.edge)) {
      result.add(occurrence.id);
    }
  }
  return [...result];
}

function initializePlacements(occurrences, retained, center, supplied) {
  const byId = new Map(occurrences.map((record) => [record.id, record]));
  // Deterministic phyllotaxis gives fresh nodes a finite, distributed seed.
  // Explicit scene positions bypass the force engine's missing-position seed;
  // coincident seeds instead create an enormous initial repulsive impulse.
  // Index the whole node inventory once, including retained nodes, so additions
  // do not restart the sequence at positions already assigned to predecessors.
  const seeds = new Map();
  const angle = Math.PI * (3 - Math.sqrt(5));
  for (const occurrence of occurrences) {
    if (["class-node", "datatype-node"].includes(occurrence.kind)) {
      const index = seeds.size;
      const radius = 10 * Math.sqrt(0.5 + index);
      seeds.set(occurrence.id, {
        x: center.x + radius * Math.cos(index * angle),
        y: center.y + radius * Math.sin(index * angle),
      });
    }
  }
  const operatorTargets = new Map();
  for (const edge of occurrences) {
    if (edge.kind === "operator-edge") {
      if (!operatorTargets.has(edge.from)) {
        operatorTargets.set(edge.from, []);
      }
      operatorTargets.get(edge.from).push(edge.to);
    }
  }
  const positions = new Map(
    retained.map((placement) => [
      placement.occurrence,
      structuredClone(placement),
    ]),
  );
  const visiting = new Set();
  function place(id) {
    if (positions.has(id)) {
      return positions.get(id).position;
    }
    if (visiting.has(id)) {
      throw sceneError("SCENE_POSITION_CYCLE");
    }
    const occurrence = byId.get(id);
    if (!occurrence || !POSITIONABLE.has(occurrence.kind)) {
      throw sceneError("SCENE_OCCURRENCE_MISSING");
    }
    visiting.add(id);
    let position = supplied.get(id);
    if (!position) {
      let neighbors = [];
      if (occurrence.kind === "label") {
        const edge = byId.get(occurrence.edge);
        neighbors = edge.ends ?? [edge.from, edge.to];
      } else if (occurrence.kind === "class-node") {
        neighbors = operatorTargets.get(id) ?? [];
      }
      const points = neighbors.map(place);
      position =
        points.length === 0
          ? (seeds.get(id) ?? center)
          : {
              x: points.reduce(
                (sum, point) => sum + point.x / points.length,
                0,
              ),
              y: points.reduce(
                (sum, point) => sum + point.y / points.length,
                0,
              ),
            };
    }
    const placement = {
      occurrence: id,
      position: finitePoint(position),
      pinned: false,
    };
    positions.set(id, placement);
    visiting.delete(id);
    return placement.position;
  }
  for (const occurrence of occurrences) {
    if (POSITIONABLE.has(occurrence.kind)) {
      place(occurrence.id);
    }
  }
  return [...positions.values()];
}

function validatePlacements(occurrences, state) {
  const required = new Set(
    occurrences
      .filter(({ kind }) => POSITIONABLE.has(kind))
      .map(({ id }) => id),
  );
  for (const placement of state.placements) {
    if (
      !required.delete(placement.occurrence) ||
      typeof placement.pinned !== "boolean"
    ) {
      throw sceneError("SCENE_PLACEMENT_INVALID");
    }
    finitePoint(placement.position);
  }
  if (required.size) {
    throw sceneError("SCENE_PLACEMENT_MISSING");
  }
}

/**
 * Complete application-owned scene for one load. Wire IDs remain local to the
 * current admitted occurrence inventory. Runtime tokens survive explicit edit pairs.
 */
export function createCanonicalVowlScene(
  occurrences,
  {
    loadGeneration,
    visualization,
    center = { x: 0, y: 0 },
    suppliedPositions = new Map(),
  },
) {
  if (!Number.isSafeInteger(loadGeneration) || loadGeneration < 1) {
    throw sceneError("SCENE_GENERATION_INVALID");
  }
  let current = structuredClone(occurrences);
  let revision = 0;
  let committing = false;
  function checkWritable() {
    if (committing) {
      throw sceneError("SCENE_COMMIT_IN_PROGRESS");
    }
  }
  let nextToken = 0;
  let registry = new Map(current.map(({ id }) => [id, ++nextToken]));
  let occurrencesByToken = new Map(
    [...registry].map(([id, token]) => [`runtime-${token}`, id]),
  );
  let state = structuredClone(
    visualization ?? {
      placements: [],
      camera: { center: finitePoint(center), zoom: 1 },
      hidden: [],
      labelSelection: { mode: "untagged" },
      prefixes: [],
      display: {
        compactNotation: false,
        nodeScaling: "uniform",
        externalColoring: true,
      },
    },
  );
  if (!visualization) {
    state.placements = initializePlacements(
      current,
      [],
      finitePoint(center),
      suppliedPositions,
    );
  }
  validatePlacements(current, state);
  state.hidden = closeVowlVisibility(current, state.hidden);

  function reference(id) {
    if (!registry.has(id)) {
      throw sceneError("SCENE_OCCURRENCE_MISSING");
    }
    return Object.freeze({
      loadGeneration,
      occurrenceId: `runtime-${registry.get(id)}`,
    });
  }
  function resolve(ref) {
    if (ref?.loadGeneration !== loadGeneration) {
      throw sceneError("SCENE_REFERENCE_EXPIRED");
    }
    if (!occurrencesByToken.has(ref.occurrenceId)) {
      throw sceneError("SCENE_REFERENCE_EXPIRED");
    }
    return occurrencesByToken.get(ref.occurrenceId);
  }
  return Object.freeze({
    reference,
    resolve,
    snapshot() {
      validatePlacements(current, state);
      return structuredClone(state);
    },
    arrange(changes, { camera } = {}) {
      checkWritable();
      const candidate = structuredClone(state);
      const placementsByOccurrence = new Map(
        candidate.placements.map((entry) => [entry.occurrence, entry]),
      );
      if (camera !== undefined) {
        if (!Number.isFinite(camera.zoom) || camera.zoom <= 0) {
          throw sceneError("SCENE_CAMERA_INVALID");
        }
        candidate.camera = {
          center: finitePoint(camera.center),
          zoom: camera.zoom,
        };
      }
      const changed = new Set();
      for (const change of changes) {
        const id = resolve(change.reference);
        if (changed.has(id)) {
          throw sceneError("SCENE_PLACEMENT_INVALID");
        }
        changed.add(id);
        const placement = placementsByOccurrence.get(id);
        if (!placement) {
          throw sceneError("SCENE_OCCURRENCE_NOT_POSITIONABLE");
        }
        if (change.position !== undefined) {
          placement.position = finitePoint(change.position);
        }
        if (change.pinned !== undefined) {
          if (typeof change.pinned !== "boolean") {
            throw sceneError("SCENE_PLACEMENT_INVALID");
          }
          placement.pinned = change.pinned;
        }
      }
      state = candidate;
      revision++;
    },
    setVisibility(hiddenReferences) {
      checkWritable();
      state = {
        ...state,
        hidden: closeVowlVisibility(current, hiddenReferences.map(resolve)),
      };
      revision++;
    },
    /** Stage a presentation-only change without retiring semantic/runtime IDs. */
    prepareView(changes) {
      checkWritable();
      if (
        !changes ||
        Object.keys(changes).some(
          (key) =>
            ![
              "hidden",
              "labelSelection",
              "display",
              "prefixes",
              "placements",
              "camera",
            ].includes(key),
        )
      ) {
        throw sceneError("SCENE_VIEW_INVALID");
      }
      const baseRevision = revision;
      const candidate = structuredClone(state);
      if (changes.placements !== undefined) {
        candidate.placements = structuredClone(changes.placements);
        validatePlacements(current, candidate);
      }
      if (changes.camera !== undefined) {
        if (!Number.isFinite(changes.camera.zoom) || changes.camera.zoom <= 0) {
          throw sceneError("SCENE_CAMERA_INVALID");
        }
        candidate.camera = {
          center: finitePoint(changes.camera.center),
          zoom: changes.camera.zoom,
        };
      }
      if (changes.prefixes !== undefined) {
        const seen = new Set();
        if (
          !Array.isArray(changes.prefixes) ||
          changes.prefixes.some((binding) => {
            if (
              !binding ||
              Object.keys(binding).length !== 2 ||
              typeof binding.prefix !== "string" ||
              !/^(?:[A-Za-z][A-Za-z0-9_-]*)?$/.test(binding.prefix) ||
              typeof binding.iri !== "string" ||
              !isIri(binding.iri) ||
              seen.has(binding.prefix)
            ) {
              return true;
            }
            seen.add(binding.prefix);
            return false;
          })
        ) {
          throw sceneError("SCENE_PREFIX_INVALID");
        }
        candidate.prefixes = structuredClone(changes.prefixes);
      }
      if (changes.hidden !== undefined) {
        if (!Array.isArray(changes.hidden)) {
          throw sceneError("SCENE_VIEW_INVALID");
        }
        candidate.hidden = closeVowlVisibility(
          current,
          changes.hidden.map(resolve),
        );
      }
      if (changes.labelSelection !== undefined) {
        const selection = changes.labelSelection;
        const language = selection?.mode === "language";
        if (
          !selection ||
          !["iri", "untagged", "language"].includes(selection.mode) ||
          Object.keys(selection).some(
            (key) => !["mode", ...(language ? ["range"] : [])].includes(key),
          ) ||
          (language &&
            (typeof selection.range !== "string" ||
              !/^(\*|[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*)$/.test(
                selection.range,
              )))
        ) {
          throw sceneError("SCENE_VIEW_INVALID");
        }
        candidate.labelSelection = language
          ? { mode: "language", range: selection.range.toLowerCase() }
          : { mode: selection.mode };
      }
      if (changes.display !== undefined) {
        const display = changes.display;
        if (
          !display ||
          Object.keys(display).some(
            (key) =>
              !["compactNotation", "nodeScaling", "externalColoring"].includes(
                key,
              ),
          ) ||
          ["compactNotation", "externalColoring"].some(
            (key) =>
              Object.hasOwn(display, key) && typeof display[key] !== "boolean",
          ) ||
          (Object.hasOwn(display, "nodeScaling") &&
            !["uniform", "direct-membership"].includes(display.nodeScaling))
        ) {
          throw sceneError("SCENE_VIEW_INVALID");
        }
        candidate.display = {
          ...candidate.display,
          ...structuredClone(display),
        };
      }
      let committed = false;
      function checkCurrent() {
        checkWritable();
        if (committed || revision !== baseRevision) {
          throw sceneError("SCENE_PREVIEW_EXPIRED");
        }
      }
      return Object.freeze({
        preview() {
          checkCurrent();
          return structuredClone(candidate);
        },
        commit({ beforeCommit } = {}) {
          checkCurrent();
          committing = true;
          try {
            beforeCommit?.();
          } finally {
            committing = false;
          }
          state = candidate;
          revision++;
          committed = true;
        },
      });
    },
    /** Stage against the latest scene after worker completion. No live mutation. */
    prepareEdit(
      result,
      {
        center: editCenter = state.camera.center,
        suppliedPositions: editPositions = new Map(),
        hidden: requestedHidden,
      } = {},
    ) {
      checkWritable();
      const base = current;
      const baseRevision = revision;
      const occurrences = structuredClone(result.occurrences);
      const hiddenOverride =
        requestedHidden === undefined
          ? undefined
          : structuredClone(requestedHidden);
      const nextOccurrences = new Map(
        occurrences.map((record) => [record.id, record]),
      );
      const groups = new Map();
      const placementsByOccurrence = new Map(
        state.placements.map((entry) => [entry.occurrence, entry]),
      );
      const hiddenOccurrences = new Set(state.hidden);
      const seen = new Set();
      for (const pair of result.correspondence) {
        if (!registry.has(pair.previous)) {
          continue;
        }
        if (seen.has(pair.previous)) {
          throw sceneError("SCENE_CORRESPONDENCE_INVALID");
        }
        seen.add(pair.previous);
        if (pair.current === null) {
          continue;
        }
        if (!nextOccurrences.has(pair.current)) {
          throw sceneError("SCENE_CORRESPONDENCE_INVALID");
        }
        const group = groups.get(pair.current) ?? [];
        group.push({
          id: pair.previous,
          reference: reference(pair.previous),
          token: registry.get(pair.previous),
          placement: placementsByOccurrence.get(pair.previous),
          hidden: hiddenOccurrences.has(pair.previous),
        });
        groups.set(pair.current, group);
      }
      if (seen.size !== registry.size) {
        throw sceneError("SCENE_CORRESPONDENCE_INVALID");
      }
      const same = (a, b) =>
        a.hidden === b.hidden &&
        a.placement?.pinned === b.placement?.pinned &&
        a.placement?.position.x === b.placement?.position.x &&
        a.placement?.position.y === b.placement?.position.y;
      const conflicts = [...groups]
        .filter(
          ([, entries]) => !entries.every((entry) => same(entry, entries[0])),
        )
        .map(([occurrence, entries]) => ({
          occurrence,
          choices: entries.map(({ reference, placement, hidden }) => ({
            reference,
            placement: placement && structuredClone(placement),
            hidden,
          })),
        }));
      let committed = false;
      function prepare(choices) {
        checkWritable();
        if (committed || current !== base || revision !== baseRevision) {
          throw sceneError("SCENE_PREVIEW_EXPIRED");
        }
        const conflictIds = new Set(
          conflicts.map(({ occurrence }) => occurrence),
        );
        if ([...choices.keys()].some((id) => !conflictIds.has(id))) {
          throw sceneError("SCENE_MERGE_CHOICE_INVALID");
        }
        const placements = [];
        const hidden = [];
        const nextRegistry = new Map();
        let allocated = nextToken;
        for (const occurrence of occurrences) {
          const entries = groups.get(occurrence.id) ?? [];
          let selected = entries[0];
          if (conflictIds.has(occurrence.id)) {
            const choice = choices.get(occurrence.id);
            selected = entries.find(
              (entry) =>
                entry.reference.loadGeneration === choice?.loadGeneration &&
                entry.reference.occurrenceId === choice?.occurrenceId,
            );
            if (!selected) {
              throw sceneError("SCENE_MERGE_CHOICE_REQUIRED");
            }
          }
          nextRegistry.set(
            occurrence.id,
            entries.length
              ? Math.min(...entries.map(({ token }) => token))
              : ++allocated,
          );
          if (selected?.placement && POSITIONABLE.has(occurrence.kind)) {
            placements.push({
              ...structuredClone(selected.placement),
              occurrence: occurrence.id,
            });
          }
          if (selected?.hidden) {
            hidden.push(occurrence.id);
          }
        }
        const candidate = {
          ...state,
          placements: initializePlacements(
            occurrences,
            placements,
            finitePoint(editCenter),
            editPositions,
          ),
          hidden: closeVowlVisibility(occurrences, hiddenOverride ?? hidden),
        };
        validatePlacements(occurrences, candidate);
        const nextOccurrencesByToken = new Map(
          [...nextRegistry].map(([id, token]) => [`runtime-${token}`, id]),
        );
        return { candidate, nextRegistry, nextOccurrencesByToken, allocated };
      }
      return Object.freeze({
        conflicts: structuredClone(conflicts),
        preview(choices = new Map()) {
          return structuredClone(prepare(choices).candidate);
        },
        previewReferences(choices = new Map()) {
          return new Map(
            [...prepare(choices).nextRegistry].map(([id, token]) => [
              id,
              Object.freeze({
                loadGeneration,
                occurrenceId: `runtime-${token}`,
              }),
            ]),
          );
        },
        commit(choices = new Map(), { beforeCommit } = {}) {
          const prepared = prepare(choices);
          // The synchronous presentation boundary may reject without changing
          // this scene. Prevent renderer event handlers from reentering scene
          // mutations between validation and acceptance.
          committing = true;
          try {
            beforeCommit?.();
          } finally {
            committing = false;
          }
          current = occurrences;
          state = prepared.candidate;
          registry = prepared.nextRegistry;
          occurrencesByToken = prepared.nextOccurrencesByToken;
          nextToken = prepared.allocated;
          revision++;
          committed = true;
        },
      });
    },
  });
}
