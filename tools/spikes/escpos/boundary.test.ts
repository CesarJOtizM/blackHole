import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const SOURCE_TREES = ["contexts", "apps"] as const;

const SKIPPED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  ".git",
  ".turbo",
  "coverage",
]);

it("given contexts and apps, when sources are scanned, then none mention tools/spikes", () => {
  const root = repositoryRoot();
  const sources = SOURCE_TREES.flatMap((tree) =>
    listSourceFiles(path.join(root, tree)),
  );
  const mentions = sources.filter((filePath) =>
    readFileSync(filePath, "utf8").includes("tools/spikes"),
  );

  expect(sources.length).toBeGreaterThan(0);
  expect(mentions).toEqual([]);
});

function repositoryRoot(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  const filesystemRoot = path.parse(directory).root;

  while (directory !== filesystemRoot) {
    if (existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
      return directory;
    }

    directory = path.dirname(directory);
  }

  throw new Error("repository root not found");
}

function listSourceFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIPPED_DIRECTORIES.has(entry.name) || entry.isSymbolicLink()) {
      continue;
    }

    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...listSourceFiles(filePath));
      continue;
    }

    if (isSource(filePath)) {
      found.push(filePath);
    }
  }

  return found;
}

function isSource(filePath: string): boolean {
  return /\.(?:[cm]?tsx?|[cm]?jsx?)$/.test(filePath);
}
