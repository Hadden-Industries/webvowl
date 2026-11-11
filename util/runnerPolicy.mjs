import { readFileSync } from "node:fs";

const { ubuntuRelease } = JSON.parse(
  readFileSync(
    new URL("../.github/runner-policy.json", import.meta.url),
    "utf8",
  ),
);
if (
  typeof ubuntuRelease !== "string" ||
  !/^\d[02468]\.04$/u.test(ubuntuRelease)
) {
  throw new Error(
    "ubuntuRelease must be an even-year Ubuntu LTS release in YY.04 format.",
  );
}

export const ubuntuRunner = "ubuntu-" + ubuntuRelease;
export const ubuntuImage = "ubuntu" + ubuntuRelease.slice(0, 2);
