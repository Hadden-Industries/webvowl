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
        neighbors = occurrences
          .filter((edge) => edge.kind === "operator-edge" && edge.from === id)
          .map((edge) => edge.to);
      }
      const points = neighbors.map(place);
      position =
        points.length === 0
          ? center
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
  let nextToken = 0;
  let registry = new Map(current.map(({ id }) => [id, ++nextToken]));
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
    const found = [...registry].find(
      ([, token]) => `runtime-${token}` === ref.occurrenceId,
    );
    if (!found) {
      throw sceneError("SCENE_REFERENCE_EXPIRED");
    }
    return found[0];
  }
  return Object.freeze({
    reference,
    resolve,
    snapshot() {
      validatePlacements(current, state);
      return structuredClone(state);
    },
    arrange(changes, { camera } = {}) {
      const candidate = structuredClone(state);
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
        const placement = candidate.placements.find(
          (entry) => entry.occurrence === id,
        );
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
      state = {
        ...state,
        hidden: closeVowlVisibility(current, hiddenReferences.map(resolve)),
      };
      revision++;
    },
    /** Stage against the latest scene after worker completion. No live mutation. */
    prepareEdit(
      result,
      {
        center: editCenter = state.camera.center,
        suppliedPositions: editPositions = new Map(),
      } = {},
    ) {
      const base = current;
      const baseRevision = revision;
      const occurrences = structuredClone(result.occurrences);
      const nextOccurrences = new Map(
        occurrences.map((record) => [record.id, record]),
      );
      const groups = new Map();
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
          placement: state.placements.find(
            (entry) => entry.occurrence === pair.previous,
          ),
          hidden: state.hidden.includes(pair.previous),
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
          hidden: closeVowlVisibility(occurrences, hidden),
        };
        validatePlacements(occurrences, candidate);
        return { candidate, nextRegistry, allocated };
      }
      return Object.freeze({
        conflicts: structuredClone(conflicts),
        preview(choices = new Map()) {
          return structuredClone(prepare(choices).candidate);
        },
        commit(choices = new Map()) {
          const prepared = prepare(choices);
          current = occurrences;
          state = prepared.candidate;
          registry = prepared.nextRegistry;
          nextToken = prepared.allocated;
          revision++;
          committed = true;
        },
      });
    },
  });
}
