import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const clouds = ["aws", "gcp", "azure"];
const moduleNames = [
  "network",
  "postgres",
  "service",
  "storage",
  "secrets",
  "registry",
];
const environmentOutputs = [
  "api_hostname",
  "backup_bucket",
  "postgres_endpoint",
  "registry_url",
  "secrets_prefix",
  "static_bucket",
  "storage_bucket",
];

export const declarationNames = (source, kind) =>
  [...source.matchAll(new RegExp(`^\\s*${kind}\\s+"([^"]+)"\\s*\\{`, "gm"))]
    .map((match) => match[1])
    .sort();

export const missingNames = (byCloud, kind) => {
  const union = [...new Set(Object.values(byCloud).flat())].sort();
  const missing = [];

  for (const cloud of Object.keys(byCloud).sort()) {
    for (const name of union) {
      if (!byCloud[cloud].includes(name)) {
        missing.push(`${cloud} missing ${kind} ${name}`);
      }
    }
  }

  return missing;
};

const readTerraform = (directory) =>
  readdirSync(directory)
    .filter((name) => name.endsWith(".tf"))
    .sort()
    .map((name) => readFileSync(path.join(directory, name), "utf8"))
    .join("\n");

const isDirectory = (directory) => {
  try {
    return statSync(directory).isDirectory();
  } catch {
    return false;
  }
};

const problems = [];

for (const moduleName of moduleNames) {
  const outputs = {};
  const variables = {};

  for (const cloud of clouds) {
    const directory = path.join(root, "infra", "modules", cloud, moduleName);

    if (!isDirectory(directory)) {
      problems.push(`missing module ${cloud}/${moduleName}`);
      continue;
    }

    const source = readTerraform(directory);
    outputs[cloud] = declarationNames(source, "output");
    variables[cloud] = declarationNames(source, "variable");
  }

  for (const line of missingNames(outputs, "output")) {
    problems.push(`${moduleName}: ${line}`);
  }

  for (const line of missingNames(variables, "variable")) {
    problems.push(`${moduleName}: ${line}`);
  }
}

const environmentRoot = path.join(root, "infra", "environments");

for (const entry of readdirSync(environmentRoot)) {
  if (entry === "local") {
    continue;
  }

  const directory = path.join(environmentRoot, entry);

  if (!isDirectory(directory)) {
    continue;
  }

  const outputs = declarationNames(readTerraform(directory), "output");

  for (const name of environmentOutputs) {
    if (!outputs.includes(name)) {
      problems.push(`${entry} missing output ${name}`);
    }
  }
}

if (process.argv.includes("--self-check")) {
  const detected = missingNames(
    { aws: ["api_hostname"], gcp: [], azure: ["api_hostname"] },
    "output",
  );

  if (
    !detected.some((line) => line.includes("gcp missing output api_hostname"))
  ) {
    console.error("self-check did not reject a missing output");
    process.exit(1);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("module outputs match");
