import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The shared minute window is the provider-rate gate. This probe calls that
// gate and the Factus simulator. It does not change cloud scale-out, desired
// counts, or the load balancer.

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const limit = 80;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const loader = `
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const typescriptSpecifier = (specifier) =>
  specifier.endsWith(".js") ? specifier.slice(0, -3) + ".ts" : null;

export async function resolve(specifier, context, nextResolve) {
  const typescript = typescriptSpecifier(specifier);
  if (typescript) {
    try {
      return await nextResolve(typescript, context);
    } catch {
      // The specifier is a real JavaScript module.
    }
  }

  const resolved = await nextResolve(specifier, context);
  if (!resolved.url.startsWith("file:") || !resolved.url.endsWith(".js")) {
    return resolved;
  }

  const typescriptFile = fileURLToPath(resolved.url).slice(0, -3) + ".ts";
  if (!existsSync(typescriptFile)) {
    return resolved;
  }

  return { url: pathToFileURL(typescriptFile).href, shortCircuit: true };
}

const simulatorSource = (file) =>
  readFileSync(file, "utf8")
    .replace(/import type [\\s\\S]*?;\\r?\\n/g, "")
    .replace(/export type [\\s\\S]*?(?=export class)/g, "")
    .replace(
      /constructor\\(\\s*private\\s+readonly\\s+(\\w+)\\s*:\\s*[^=)]+?(=\\s*[^)]*)?\\)\\s*\\{\\s*\\}/,
      (_match, name, init = "") =>
        "constructor(" + name + (init || "") + ") { this." + name + " = " + name + "; }",
    )
    .replace(/\\bprivate\\s+/g, "")
    .replace(/:\\s*Promise<[^>]+>/g, "")
    .replace(/\\s+as\\s+const\\b/g, "");

export async function load(url, context, nextLoad) {
  if (url.startsWith("file:") && url.endsWith("factus-simulator.ts")) {
    return {
      format: "module",
      source: simulatorSource(fileURLToPath(url)),
      shortCircuit: true,
    };
  }

  return nextLoad(url, context);
}
`;

await register(`data:text/javascript,${encodeURIComponent(loader)}`);

const fileUrl = (relative) =>
  pathToFileURL(path.join(root, ...relative.split("/"))).href;

const { InMemoryProviderRateGate } = await import(
  fileUrl("contexts/platform/adapters/memory/in-memory-provider-rate-gate.ts")
);
const {
  providerRequestsPerMinute,
  providerRetryAfterSeconds,
  providerWindowMilliseconds,
} = await import(
  fileUrl("contexts/platform/application/ports/provider-rate-gate.ts")
);
const { FactusSimulator } = await import(
  fileUrl("apps/api-cloud/src/composition/factus-simulator.ts")
);

if (
  providerRequestsPerMinute !== limit ||
  providerWindowMilliseconds !== 60_000
) {
  fail(
    `provider window is ${providerRequestsPerMinute} per ${providerWindowMilliseconds}ms`,
  );
}

const gate = new InMemoryProviderRateGate();
const simulator = new FactusSimulator();
const taxId = "900123456";
const otherTaxId = "800987654";
const at = new Date("2026-10-22T15:00:10.000Z");

const issueWithinLimit = async (id, when) => {
  const decision = await gate.acquire(id, when);
  if (!decision.allowed) {
    fail(`factus rejected ${id} inside the ${limit} request limit`);
  }

  const result = await simulator.issue();
  if (result.status !== 200) {
    fail(`factus returned ${result.status} inside the limit`);
  }
};

for (let count = 0; count < limit; count += 1) {
  await issueWithinLimit(taxId, at);
}

const blocked = await gate.acquire(taxId, at);
if (blocked.allowed) {
  fail("factus allowed request 81 for the same tax id in the same minute");
}

if (blocked.retryAfterSeconds !== providerRetryAfterSeconds(at)) {
  fail("factus rejection did not use the provider retry window");
}

await issueWithinLimit(otherTaxId, at);
await issueWithinLimit(
  taxId,
  new Date(at.getTime() + providerWindowMilliseconds),
);

console.log("factus stays at 80 requests per tax id per minute");
