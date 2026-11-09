// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openRepositoryJsonSession } from "./runRepositoryJsonQuality.mjs";

/** Require one observation per inventory-declared JSON path and a completed
 * repository check. Other physical and generated sources remain in the check.
 */
export async function verifyBundledJsonCoverage(
  events,
  expectedPaths,
  reportFinding = () => {},
) {
  const observed = new Map([...expectedPaths].map((path) => [path, false]));
  let terminal;
  for await (const event of events) {
    if (event.type === "finding") {
      reportFinding(event);
    } else if (event.type === "execution-terminal") {
      terminal = event;
    } else if (event.type === "source" && observed.has(event.path)) {
      if (observed.get(event.path)) {
        throw new Error("Duplicate bundled JSON member: " + event.path);
      }
      observed.set(event.path, true);
    }
  }
  if (!terminal) {
    throw new Error("JSON Quality repository check did not complete.");
  }
  if (terminal.contractSatisfied !== true) {
    throw new Error("JSON Quality repository contract failed.");
  }
  for (const [path, seen] of observed) {
    if (!seen) throw new Error("Missing bundled JSON member: " + path);
  }
  return observed.size;
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const corpus = new URL("../packages/vowl/conformance/", import.meta.url);
  const inventory = JSON.parse(
    readFileSync(new URL("storage-inventory.json", corpus), "utf8"),
  );
  const expectedPaths = inventory.artifacts
    .filter(({ path }) => path.endsWith(".json"))
    .map(({ path }) => "packages/vowl/conformance/" + path);
  const session = await openRepositoryJsonSession({ requireGenerated: true });
  let checked;
  try {
    checked = await verifyBundledJsonCoverage(
      session.check(),
      expectedPaths,
      ({ path, line, column, ruleId, messageId }) => {
        console.error("%j:%s:%s %s/%s", path, line, column, ruleId, messageId);
      },
    );
  } finally {
    await session.close();
  }
  console.log(
    "JSON Quality repository contract satisfied, including generated outputs and %d bundled JSON members.",
    checked,
  );
}
