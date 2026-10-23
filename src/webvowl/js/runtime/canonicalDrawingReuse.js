/** Compare admitted data, never a hash or an IRI used as occurrence identity. */
function equalData(left, right, omitted = new Set()) {
  if (Object.is(left, right)) {
    return true;
  }
  if (
    !left ||
    !right ||
    typeof left !== "object" ||
    typeof right !== "object"
  ) {
    return false;
  }
  if (Array.isArray(left) !== Array.isArray(right)) {
    return false;
  }
  const keys = Object.keys(left).filter((key) => !omitted.has(key));
  const otherKeys = Object.keys(right).filter((key) => !omitted.has(key));
  return (
    keys.length === otherKeys.length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && equalData(left[key], right[key]),
    )
  );
}

const placementFields = new Set(["position", "pinned", "hidden"]);
const nodeFields = new Set([...placementFields, "additionalOperands"]);
const visibilityFields = new Set(["hidden"]);
const drawingFields = new Set(["nodes", "edges", "labels", "camera"]);

function sameRows(previous, next, omitted) {
  if (previous.length !== next.length) {
    return false;
  }
  const keys = new Set();
  return previous.every((row, index) => {
    if (keys.has(row.occurrence)) {
      return false;
    }
    keys.add(row.occurrence);
    return equalData(row, next[index], omitted);
  });
}

// DOM reuse retains measured text. Revalidate its presentation environment on
// each synchronous installation, including CSSOM edits and loaded font faces.
// An unreadable stylesheet or loading font conservatively selects rebuilding.
// This stores only the current environment; there is no font/metric cache.
export function readDrawingPresentation(documentObject) {
  try {
    const sheets = Array.from(documentObject.styleSheets ?? [], (sheet) => [
      sheet.disabled,
      sheet.media?.mediaText,
      Array.from(sheet.cssRules, (rule) => rule.cssText),
    ]);
    const fonts = documentObject.fonts;
    if (fonts?.status === "loading") {
      return undefined;
    }
    const faces = Array.from(fonts ?? [], (face) => [
      face.family,
      face.style,
      face.weight,
      face.stretch,
      face.status,
      face.unicodeRange,
      face.featureSettings,
      face.variationSettings,
    ]);
    const ancestors = [documentObject.documentElement, documentObject.body].map(
      (element) => [
        element?.getAttribute("class"),
        element?.getAttribute("style"),
      ],
    );
    const view = documentObject.defaultView;
    return {
      signature: JSON.stringify([
        sheets,
        faces,
        ancestors,
        view?.innerWidth,
        view?.innerHeight,
        view?.devicePixelRatio,
      ]),
      faces: Array.from(fonts ?? []),
    };
  } catch {
    return undefined;
  }
}

/** The owner keeps exactly one accepted drawing and one presentation snapshot. */
export function canReuseCanonicalDrawing(
  previous,
  next,
  presentation,
  nextPresentation,
) {
  return Boolean(
    previous &&
    presentation !== undefined &&
    nextPresentation !== undefined &&
    presentation.signature === nextPresentation.signature &&
    presentation.faces.length === nextPresentation.faces.length &&
    presentation.faces.every(
      (face, index) => face === nextPresentation.faces[index],
    ) &&
    equalData(previous, next, drawingFields) &&
    sameRows(previous.nodes, next.nodes, nodeFields) &&
    sameRows(previous.edges, next.edges, visibilityFields) &&
    sameRows(previous.labels, next.labels, placementFields),
  );
}
