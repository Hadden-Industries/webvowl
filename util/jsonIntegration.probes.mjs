// SPDX-License-Identifier: AGPL-3.0-only
// Consumer contracts retain independent corpus and installed-source identities.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openRepositoryJsonSession } from "./runRepositoryJsonQuality.mjs";
import {
  openJsonSourceSession,
  jsonContract,
  formatJsonSource,
  verifyJsonQualityInstallation,
  validateJsonQualityEvent,
} from "../tooling/json/public-api.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const policy = JSON.parse(
  readFileSync(new URL("../.json-quality.json", import.meta.url)),
);

test("the complete repository adapter checks every independently pinned JSON member", async () => {
  const inventory = JSON.parse(
    readFileSync(
      new URL(
        "../packages/vowl/conformance/storage-inventory.json",
        import.meta.url,
      ),
    ),
  );
  const expected = new Set(
    inventory.artifacts
      .filter((entry) => entry.path.endsWith(".json"))
      .map((entry) => "packages/vowl/conformance/" + entry.path),
  );
  assert.equal(expected.size, 5851);
  const known =
    "packages/vowl/conformance/supplemental/field-contract/semantic/scalar-domain-annotationvalue-language-lexical/source.json";
  const seen = new Set(); // Finite corpus test oracle, never production retention.
  const session = await openRepositoryJsonSession({ retainValues: false });
  let terminal, knownSource;
  try {
    for await (const event of session.events()) {
      assert.equal(validateJsonQualityEvent(event), true);
      if (event.type === "source" && expected.has(event.path)) {
        assert.equal(seen.has(event.path), false, event.path);
        seen.add(event.path);
        if (event.path === known) {
          assert.equal(
            event.sha256,
            "da6d2b553eceef5d585ad217e55767151c9a3951ebc132a797a4e13ccc33e361",
          );
          assert.equal(event.byteLength, "1259");
          knownSource = event.source;
        }
      }
      if (event.type === "execution-terminal") terminal = event;
    }
    assert.deepEqual(seen, expected);
    for (const field of [
      "inventoryComplete",
      "linkedExpectationsComplete",
      "sourceObservationsComplete",
      "diagnosticsComplete",
      "contractSatisfied",
    ])
      assert.equal(terminal[field], true, field);
    assert.equal(terminal.domainComplete, false);
    assert.ok(
      (await session.readSource(knownSource)).bytes.includes(
        Buffer.from("\uFDD0"),
      ),
    );
  } finally {
    await session.close();
  }
});

test("the native source selector, lock, generated bootstrap and installed payload agree", async () => {
  const result = await verifyJsonQualityInstallation({
    toolingRoot: fileURLToPath(new URL("../tooling/json/", import.meta.url)),
    bootstrapPath: fileURLToPath(
      new URL("./installRepositoryQualityTools.mjs", import.meta.url),
    ),
  });
  assert.ok(result.files > 0);
});

test("the finite pure writer preserves numeric spelling and never writes repository bytes", async () => {
  const path = new URL("../package.json", import.meta.url);
  const original = readFileSync(path);
  assert.equal(
    await formatJsonSource('{"value":1.00e+2}'),
    '{\n  "value": 1.00e+2\n}\n',
  );
  assert.deepEqual(readFileSync(path), original);
});

test("repository scripts expose complete JSON and independently required storage checks", () => {
  const { scripts } = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url)),
  );
  assert.equal(
    scripts["check:json"],
    "node util/runRepositoryJsonQuality.mjs check",
  );
  assert.equal(scripts["format:json:check"], scripts["check:json"]);
  assert.match(scripts["check:corpus-storage"], /verify-corpus-storage\.mjs$/u);
  assert.equal(scripts["check:json:producers"], undefined);
});

test("all physical vectors stay checked with producer-owned canonical presentation", () => {
  for (const name of ["source.json", "ids.json", "canonical.json"]) {
    const contract = jsonContract(
      `packages/vowl/conformance/vectors/named-class-structural/${name}`,
      policy,
      { tracked: true },
    );
    assert.equal(contract.exclude, false);
    assert.equal(contract.normalization, "NFC");
    assert.equal(contract.allowFormatWrites, false);
    assert.equal(contract.expected, undefined);
    assert.equal(contract.preserveNfcValues, undefined);
    assert.equal(
      contract.formatContract,
      name === "canonical.json"
        ? "producer-json-compact-body"
        : "prettier-json",
    );
  }
  assert.equal(jsonContract(".mcp.json", policy).exclude, false);
});

async function findings(bytes, path) {
  const { exclude, exceptions, ...contract } = jsonContract(path, policy, {
    tracked: true,
  });
  assert.equal(exclude, false);
  const session = await openJsonSourceSession();
  const found = [];
  try {
    for await (const event of session.check(
      {
        async *open() {
          yield bytes;
        },
      },
      {
        ...contract,
        format: path.endsWith(".jsonl") ? "jsonl" : "json",
        owner: exceptions.map((entry) => entry.owner).join("; "),
        reason: exceptions.map((entry) => entry.reason).join("; "),
      },
    )) {
      assert.equal(validateJsonQualityEvent(event), true);
      if (event.type === "finding") found.push(event);
    }
    return found;
  } finally {
    await session.close();
  }
}

test("approved narrow NFC identities match original bytes and reject changed identities", async () => {
  for (const path of [
    "packages/vowl/conformance/supplemental/negative/vectors/language-non-ascii-subtag/source.json",
    "packages/vowl/conformance/supplemental/compatible-artifact-v2/vectors.jsonl",
  ]) {
    const bytes = readFileSync(new URL("../" + path, import.meta.url));
    const contract = jsonContract(path, policy, { tracked: true });
    assert.equal(contract.normalization, "NFC");
    assert.equal(
      contract.preserveNfcValues.length,
      path.endsWith(".jsonl") ? 5 : 1,
    );
    assert.deepEqual(await findings(bytes, path), []);
    const changed = Buffer.from(
      bytes
        .toString("utf8")
        .replace(
          path.endsWith(".jsonl") ? "literal-unicode-spelling-b" : "en-K",
          "changed-approved-identity",
        ),
    );
    assert.equal(changed.equals(bytes), false);
    assert.ok(
      (await findings(changed, path)).some((event) =>
        ["preservationMismatch", "nfc-record-identity-mismatch"].includes(
          event.messageId,
        ),
      ),
    );
  }
});

test("the real adapter forwards machine reporting and resource limits to the installed CLI", () => {
  const result = spawnSync(
    process.execPath,
    [
      "util/runRepositoryJsonQuality.mjs",
      "check",
      "--json",
      "--max-files",
      "1",
    ],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 30000,
      maxBuffer: 1048576,
    },
  );
  assert.equal(result.status, 2, result.stderr);
  const events = result.stdout
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
  for (const event of events)
    assert.equal(validateJsonQualityEvent(event), true);
  assert.equal(events.at(-1).type, "failure");
  assert.equal(
    events.some((event) => event.type === "execution-terminal"),
    false,
  );
  assert.equal(result.stderr, "");
});
