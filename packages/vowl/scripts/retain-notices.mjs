import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile, writeFile } from "node:fs/promises";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const packages = new Map();

async function collect(name, parent) {
  const require = createRequire(join(parent, "package.json"));
  let entry;
  try {
    entry = require.resolve(`${name}/package.json`);
  } catch {
    entry = require.resolve(name);
  }
  let directory = dirname(entry);
  let manifest;
  for (;;) {
    try {
      const candidate = JSON.parse(
        await readFile(join(directory, "package.json"), "utf8"),
      );
      if (candidate.name === name) {
        manifest = candidate;
        break;
      }
    } catch {
      /* Resolve package roots whose exports intentionally hide their manifest. */
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not resolve the package root for ${name}`);
    }
    directory = parent;
  }
  if (packages.has(directory)) {
    return;
  }
  packages.set(directory, { directory, manifest });
  for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) {
    await collect(dependency, directory);
  }
}

const manifest = JSON.parse(
  await readFile(join(packageRoot, "package.json"), "utf8"),
);
for (const name of Object.keys(manifest.dependencies).sort()) {
  await collect(name, packageRoot);
}
let notices =
  "# Third-party notices\n\nThe package's authored code is AGPL-3.0-only. The following resolved runtime dependency closure retains its original grants and notices. Distinct installed versions are listed separately. Dependencies are installed separately; these notices do not relicense them.\n";
notices += `\nowlapi is selected by the immutable dependency specifier \`${manifest.dependencies.owlapi}\`.\n`;
const ordered = [...packages.values()].sort((left, right) => {
  const a = `${left.manifest.name}@${left.manifest.version}`;
  const b = `${right.manifest.name}@${right.manifest.version}`;
  return a < b ? -1 : a > b ? 1 : 0;
});
for (const { directory, manifest: dependency } of ordered) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^(licen[cs]e|copying|notice)([.-]|$)/i.test(entry.name),
    )
    .map((entry) => entry.name);
  if (
    entries.some((entry) => entry.isDirectory() && entry.name === "LICENSES")
  ) {
    for (const entry of await readdir(join(directory, "LICENSES"), {
      withFileTypes: true,
    })) {
      if (entry.isFile()) {
        files.push(`LICENSES/${entry.name}`);
      }
    }
  }
  if (!files.some((file) => /^(licen[cs]e|copying)([./-]|$)/i.test(file))) {
    if (
      dependency.name !== "@rubensworks/saxes" ||
      dependency.version !== "6.0.1"
    ) {
      throw new Error(
        `Missing retained license for ${dependency.name}@${dependency.version}`,
      );
    }
    // This exact npm tarball omits LICENSE. Retain the owning release's pinned
    // upstream evidence instead of substituting a generic ISC template.
    const license = await readFile(
      join(packageRoot, "LICENSES/saxes-6.0.1.txt"),
    );
    if (
      createHash("sha256").update(license).digest("hex") !==
      "0fac2374380621b22e6b50451057721a9c52935b02d16d106a9f04897f061d0e"
    ) {
      throw new Error("The pinned saxes license evidence changed.");
    }
    notices += `\n## ${dependency.name}@${dependency.version}\n\nThe installed tarball omits its license file. This text is retained from [the immutable v6.0.1 source](https://raw.githubusercontent.com/rubensworks/saxes/0f36739ccb43a87c50408e1e713382cda09e0b05/LICENSE), SHA-256 \`0fac2374380621b22e6b50451057721a9c52935b02d16d106a9f04897f061d0e\`.\n\n\`\`\`text\n${license.toString("utf8").trimEnd()}\n\`\`\`\n`;
    continue;
  }
  notices += `\n## ${dependency.name}@${dependency.version}\n`;
  for (const file of files.sort()) {
    const text = await readFile(join(directory, file), "utf8");
    notices += `\n${file}\n\n\`\`\`text\n${text.trimEnd()}\n\`\`\`\n`;
  }
}
await writeFile(new URL("../THIRD-PARTY-NOTICES.md", import.meta.url), notices);
await writeFile(
  new URL("../LICENSE", import.meta.url),
  await readFile(new URL("../../../LICENSE", import.meta.url)),
);
console.log(
  `Retained license and notice files for ${packages.size} installed dependency packages.`,
);
