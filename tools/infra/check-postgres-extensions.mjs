import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const allowed = ["pg_trgm", "pgcrypto"];
const clouds = ["aws", "gcp", "azure"];

export const extensionList = (source) => {
  const match = source.match(/postgres_extensions\s*=\s*\[([\s\S]*?)\]/);

  if (!match) {
    return null;
  }

  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]).sort();
};

export const sameAllowlist = (names) =>
  names !== null &&
  names.length === allowed.length &&
  names.every((name, index) => name === allowed[index]);

export const createExtensionNames = (source) =>
  [
    ...source.matchAll(
      /\bcreate\s+extension\s+(?:if\s+not\s+exists\s+)?(?:"([^"]+)"|([a-z0-9_]+))/gi,
    ),
  ].map((match) => match[1] ?? match[2]);

const problems = [];

for (const cloud of clouds) {
  const directory = path.join(root, "infra", "modules", cloud, "postgres");
  const source = readdirSync(directory)
    .filter((name) => name.endsWith(".tf"))
    .map((name) => readFileSync(path.join(directory, name), "utf8"))
    .join("\n");
  const names = extensionList(source);

  if (!sameAllowlist(names)) {
    problems.push(
      `${cloud} postgres extensions must be pgcrypto and pg_trgm only`,
    );
  }
}

const walk = (directory) => {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name === ".git" ||
      entry.name === ".turbo" ||
      entry.name === "coverage" ||
      entry.name === ".codegraph"
    ) {
      continue;
    }

    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(filePath));
      continue;
    }

    if (filePath.endsWith(".sql") || filePath.endsWith(".tf")) {
      files.push(filePath);
    }
  }

  return files;
};

for (const filePath of walk(root)) {
  const source = readFileSync(filePath, "utf8");

  for (const name of createExtensionNames(source)) {
    if (!allowed.includes(name)) {
      problems.push(`${path.relative(root, filePath)} uses extension ${name}`);
    }
  }
}

if (process.argv.includes("--self-check")) {
  if (sameAllowlist(["pgcrypto", "pg_trgm", "postgis"])) {
    console.error("self-check accepted an extra extension");
    process.exit(1);
  }

  if (!sameAllowlist(["pg_trgm", "pgcrypto"].sort())) {
    console.error("self-check rejected the allowlist");
    process.exit(1);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log("postgres extensions are pgcrypto and pg_trgm");
