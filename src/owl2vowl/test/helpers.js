import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ONTOLOGY_BASE_URL, ONTOLOGY_CATALOG } from "../js/constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const WORKSPACE_PARENT = path.join(__dirname, "..", "..", "..", "..");
export const LOCAL_ONTOLOGY_DIR = path.join(
  WORKSPACE_PARENT,
  "universal-ontology",
);
export const LOCAL_ONTOLOGY_DIST_DIR = path.join(LOCAL_ONTOLOGY_DIR, "dist");

export function getLocalOntologyPath(requestUrl) {
  // Mirror the production resolver's exact catalog lookup. The retired loader
  // also guessed by basename, which could silently substitute a different
  // ontology and make corpus comparisons measure unequal import closures.
  const urlToResolve = ONTOLOGY_CATALOG[requestUrl] ?? requestUrl;

  if (urlToResolve.startsWith(ONTOLOGY_BASE_URL)) {
    const relativeUrlPath = urlToResolve
      .slice(ONTOLOGY_BASE_URL.length)
      .split(/[?#]/, 1)[0];

    return path.join(
      LOCAL_ONTOLOGY_DIST_DIR,
      ...relativeUrlPath.split("/").filter(Boolean),
    );
  }

  const relativeOntologyPath = urlToResolve.replace(
    /^\.\.[\\/]ontology[\\/]/,
    "",
  );

  return path.join(LOCAL_ONTOLOGY_DIR, relativeOntologyPath);
}
