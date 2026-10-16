import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

import {
  dependsOn as adaptersDependsOn,
  layer as adaptersLayer,
} from "../../contexts/platform/adapters/index.js";
import {
  dependsOn as applicationDependsOn,
  layer as applicationLayer,
} from "../../contexts/platform/application/index.js";
import * as domain from "../../contexts/platform/domain/index.js";
import { layer as domainLayer } from "../../contexts/platform/domain/index.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

const forbiddenPackages = ["zod", "drizzle-orm", "nestjs-zod"] as const;

const sourceTrees = ["apps", "contexts", "shared", "tools"] as const;

const absent = [
  "shared/sync",
  "shared/printing",
  "shared/ui",
  "apps/venue",
  "apps/deliveries",
  "apps/web-admin",
  "apps/customer-portal",
  "infra",
] as const;

const skippedDirectories = new Set([
  "node_modules",
  "dist",
  ".git",
  ".turbo",
  "coverage",
]);

type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

it("given node_modules and a build artifact, when git ignores are listed, then both are ignored", () => {
  const gitignorePath = path.join(root, ".gitignore");

  const ignored = readFileSync(gitignorePath, "utf8");

  expect(ignored).toContain(".atl/");
  expect(ignored).toContain("node_modules/");
  expect(ignored).toContain("dist/");
  expect(ignored).toContain(".turbo/");
  expect(ignored).toContain("coverage/");
});

it("given Zod declared in the catalog, when imports are reviewed, then no module imports Zod and Drizzle and nestjs-zod are absent", () => {
  const catalog = readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  const sources = sourceTrees.flatMap((tree) =>
    listFiles(path.join(root, tree), isSource),
  );
  const manifests = listFiles(
    root,
    (filePath) => path.basename(filePath) === "package.json",
  );

  const zodVersion = catalog.match(/^\s*zod:\s*(\S+)\s*$/m)?.[1];
  const imports = sources.filter((filePath) =>
    importsForbidden(readFileSync(filePath, "utf8")),
  );
  const dependencies = manifests.filter((filePath) =>
    declaresForbiddenDependency(JSON.parse(readFileSync(filePath, "utf8"))),
  );

  expect(zodVersion).toBe("4.6.7");
  expect(imports).toEqual([]);
  expect(dependencies).toEqual([]);
});

it("given this change tree, when sync, PWAs, other contexts, or a use case are sought, then none exist", () => {
  const contexts = path.join(root, "contexts");
  const platform = path.join(contexts, "platform");
  const directories = readdirSync(contexts, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const domainSource = readFileSync(
    path.join(platform, "domain", "index.ts"),
    "utf8",
  );
  const tests = listFiles(root, (filePath) => filePath.endsWith(".test.ts"));
  const platformSources = listFiles(platform, isSource);

  const useCaseFolders = listDirectories(platform).filter(namesUseCase);
  const useCaseTests = tests.filter((filePath) =>
    namesUseCase(path.basename(filePath)),
  );
  const declarations = platformSources.filter((filePath) =>
    /\b(?:class|function)\b/.test(readFileSync(filePath, "utf8")),
  );

  expect(directories).toEqual(["platform"]);
  for (const relativePath of absent) {
    expect(existsSync(path.join(root, relativePath)), relativePath).toBe(false);
  }
  expect(domainSource).toBe('export const layer = "domain" as const;\n');
  expect(useCaseFolders).toEqual([]);
  expect(useCaseTests).toEqual([]);
  expect(declarations).toEqual([]);
});

it("given the platform package, when its layers are listed, then domain, application, and adapters exist", () => {
  const layers = {
    domain: domainLayer,
    application: applicationLayer,
    adapters: adaptersLayer,
  };

  const listed = [layers.domain, layers.application, layers.adapters];

  expect(listed).toEqual(["domain", "application", "adapters"]);
  expect(applicationDependsOn).toBe("domain");
  expect(adaptersDependsOn).toBe("application");
});

it("given domain, when the module is analyzed, then it declares no business type and no use case", () => {
  const module = domain;

  const keys = Object.keys(module);

  expect(keys).toEqual(["layer"]);
});

it("given the contracts package, when its published contents are inspected, then the package exists and publishes no schemas", () => {
  const manifest = JSON.parse(
    readFileSync(
      path.join(root, "shared", "contracts", "package.json"),
      "utf8",
    ),
  ) as { name?: string };
  const published = readFileSync(
    path.join(root, "shared", "contracts", "index.ts"),
    "utf8",
  );

  const name = manifest.name;
  const contents = published.trim();

  expect(name).toBe("@blackhole/contracts");
  expect(contents).toBe("export {};");
});

it("given the contracts code, when Zod imports, schemas, and domain types are sought, then none exist", () => {
  const code = readFileSync(
    path.join(root, "shared", "contracts", "index.ts"),
    "utf8",
  );

  const importsZod = importsForbidden(code);
  const exportsTypeOrInterface = /\bexport\s+(?:type|interface)\b/.test(code);

  expect(importsZod).toBe(false);
  expect(exportsTypeOrInterface).toBe(false);
});

function listFiles(
  directory: string,
  predicate: (filePath: string) => boolean,
): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const found: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (skippedDirectories.has(entry.name) || entry.isSymbolicLink()) {
      continue;
    }

    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...listFiles(filePath, predicate));
      continue;
    }

    if (predicate(filePath)) {
      found.push(filePath);
    }
  }

  return found;
}

function listDirectories(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const names: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (skippedDirectories.has(entry.name) || entry.isSymbolicLink()) {
      continue;
    }

    if (!entry.isDirectory()) {
      continue;
    }

    names.push(entry.name);
    names.push(...listDirectories(path.join(directory, entry.name)));
  }

  return names;
}

function isSource(filePath: string): boolean {
  return /\.(?:[cm]?tsx?|[cm]?jsx?)$/.test(filePath);
}

function namesUseCase(name: string): boolean {
  return /use-cases?|usecase/i.test(name);
}

function importsForbidden(code: string): boolean {
  return forbiddenPackages.some((packageName) => {
    const quoted = new RegExp(
      `(?:\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\brequire\\s*\\(\\s*|\\bimport\\s+)["']${packageName}(?:\\/[^"']*)?["']`,
    );

    return quoted.test(code);
  });
}

function declaresForbiddenDependency(manifest: Manifest): boolean {
  const groups = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];

  return groups.some((group) =>
    forbiddenPackages.some((packageName) => group?.[packageName] !== undefined),
  );
}
