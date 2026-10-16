import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const executable = path.join(
  root,
  "node_modules",
  "dependency-cruiser",
  "bin",
  "dependency-cruiser.mjs",
);
const rule = "domain-does-not-import-infrastructure";
const fixture =
  "tools/cruiser/fixtures/contexts/platform/domain/imports-nest.ts";

const result = spawnSync(
  process.execPath,
  [executable, "--output-type", "err", fixture],
  { encoding: "utf8" },
);

const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
const triggered = result.status !== 0 && output.includes(rule);

if (!triggered) {
  console.error(`The fixture did not trigger rule ${rule}.`);
  console.error(output);
  process.exit(1);
}
