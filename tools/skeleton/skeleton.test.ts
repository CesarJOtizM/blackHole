import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dependsOn as adaptersDependsOn,
  layer as adaptersLayer,
} from "@blackhole/platform/adapters";
import {
  dependsOn as applicationDependsOn,
  layer as applicationLayer,
} from "@blackhole/platform/application";
import * as domain from "@blackhole/platform/domain";
import { layer as domainLayer } from "@blackhole/platform/domain";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

const nestjsZodPackage = "nestjs-zod";

const zodAllowedDirectories = ["shared/contracts", "apps/api-cloud"] as const;

const sourceTrees = ["apps", "contexts", "shared", "tools"] as const;

const absent = [
  "shared/sync",
  "shared/printing",
  "shared/ui",
  "apps/venue",
  "apps/deliveries",
  "apps/web-admin",
  "apps/admin-web",
  "apps/venue-app",
  "apps/customer-portal",
  "contexts/platform/adapters/sqlite",
] as const;

const deferredCopyNames = ["sqlite", "cursor", "outbox", "pairing"] as const;

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

it("given Zod declared in the catalog, when imports are reviewed, then Zod stays in the cloud write slice and nestjs-zod is absent", () => {
  const catalog = readFileSync(path.join(root, "pnpm-workspace.yaml"), "utf8");
  const sources = sourceTrees.flatMap((tree) =>
    listFiles(path.join(root, tree), isSource),
  );
  const manifests = listFiles(
    root,
    (filePath) => path.basename(filePath) === "package.json",
  );

  const zodVersion = catalog.match(/^\s*zod:\s*(\S+)\s*$/m)?.[1];
  const zodImports = sources.filter((filePath) => {
    const code = readFileSync(filePath, "utf8");

    return importsPackage(code, "zod") && !allowsZod(filePath);
  });
  const nestjsZodImports = sources.filter((filePath) =>
    importsPackage(readFileSync(filePath, "utf8"), nestjsZodPackage),
  );
  const zodDependencies = manifests.filter((filePath) => {
    const manifest = JSON.parse(readFileSync(filePath, "utf8")) as Manifest;

    return declaresPackage(manifest, "zod") && !allowsZod(filePath);
  });
  const nestjsZodDependencies = manifests.filter((filePath) =>
    declaresPackage(
      JSON.parse(readFileSync(filePath, "utf8")) as Manifest,
      nestjsZodPackage,
    ),
  );

  expect(zodVersion).toBe("4.6.7");
  expect(zodImports).toEqual([]);
  expect(nestjsZodImports).toEqual([]);
  expect(zodDependencies).toEqual([]);
  expect(nestjsZodDependencies).toEqual([]);
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
  expect(domainSource).toContain('export const layer = "domain" as const;');
  expect(useCaseFolders).toEqual([]);
  expect(useCaseTests).toEqual([]);
  expect(
    declarations.map((filePath) => path.relative(platform, filePath)).sort(),
  ).toEqual(
    [
      path.join("adapters", "blob", "blob-file-storage.ts"),
      path.join("adapters", "crypto", "node-public-key-verifier.ts"),
      path.join("adapters", "crypto", "sha256-audit-digest.ts"),
      path.join("adapters", "crypto", "slow-salted-hasher.ts"),
      path.join("adapters", "disk", "disk-file-storage.ts"),
      path.join("adapters", "gcs", "gcs-file-storage.ts"),
      path.join("adapters", "memory", "authorization-doubles.ts"),
      path.join("adapters", "memory", "fast-identity-doubles.ts"),
      path.join("adapters", "memory", "fast-signature-verifier.ts"),
      path.join("adapters", "memory", "in-memory-audit-repository.ts"),
      path.join("adapters", "memory", "in-memory-authorization-repository.ts"),
      path.join("adapters", "memory", "in-memory-file-storage.ts"),
      path.join("adapters", "memory", "in-memory-identity-repository.ts"),
      path.join("adapters", "memory", "in-memory-runtime-metrics.ts"),
      path.join("adapters", "memory", "in-memory-secrets.ts"),
      path.join("adapters", "memory", "in-memory-organization-repository.ts"),
      path.join("adapters", "memory", "in-memory-pending-issuance.ts"),
      path.join("adapters", "memory", "in-memory-provider-rate-gate.ts"),
      path.join(
        "adapters",
        "memory",
        "in-memory-venue-operation-repository.ts",
      ),
      path.join("adapters", "postgres", "drizzle-audit-repository.ts"),
      path.join("adapters", "postgres", "drizzle-authorization-repository.ts"),
      path.join("adapters", "postgres", "drizzle-identity-repository.ts"),
      path.join("adapters", "postgres", "drizzle-organization-repository.ts"),
      path.join("adapters", "postgres", "drizzle-pending-issuance.ts"),
      path.join(
        "adapters",
        "postgres",
        "drizzle-provider-rate-gate.contract.test.ts",
      ),
      path.join("adapters", "postgres", "drizzle-provider-rate-gate.ts"),
      path.join(
        "adapters",
        "postgres",
        "drizzle-venue-operation-repository.ts",
      ),
      path.join("adapters", "s3", "s3-file-storage.ts"),
      path.join("adapters", "secrets-aws", "aws-secrets.ts"),
      path.join("adapters", "secrets-azure", "azure-secrets.ts"),
      path.join("adapters", "secrets-file", "file-secrets.ts"),
      path.join("adapters", "secrets-gcp", "gcp-secrets.ts"),
      path.join("adapters", "metrics-aws", "aws-runtime-metrics.ts"),
      path.join("adapters", "metrics-azure", "azure-runtime-metrics.ts"),
      path.join("adapters", "metrics-gcp", "gcp-runtime-metrics.ts"),
      path.join("adapters", "metrics-log", "log-runtime-metrics.ts"),
      path.join("application", "accept-cloud-write", "accept-cloud-write.ts"),
      path.join("application", "evaluate-permission", "evaluate-permission.ts"),
      path.join(
        "application",
        "operate-authorization",
        "operate-authorization.ts",
      ),
      path.join("application", "operate-devices", "operate-devices.ts"),
      path.join("application", "operate-identity", "operate-identity.ts"),
      path.join("application", "ports", "audit-digest.ts"),
      path.join("application", "ports", "audit-repository.contract.ts"),
      path.join("application", "ports", "audit-repository.ts"),
      path.join("application", "ports", "authorization-clock.ts"),
      path.join("application", "ports", "authorization-repository.ts"),
      path.join("application", "ports", "authorization-repository.contract.ts"),
      path.join("application", "ports", "clock.ts"),
      path.join("application", "ports", "file-storage.contract.ts"),
      path.join("application", "ports", "file-storage.ts"),
      path.join("application", "ports", "identity-reader.ts"),
      path.join("application", "ports", "identity-repository.ts"),
      path.join("application", "ports", "identity-repository.contract.ts"),
      path.join("application", "ports", "organization-repository.ts"),
      path.join("application", "ports", "organization-repository.contract.ts"),
      path.join("application", "ports", "password-hasher.ts"),
      path.join("application", "ports", "pending-issuance.contract.ts"),
      path.join("application", "ports", "pending-issuance.ts"),
      path.join("application", "ports", "pin-hasher.ts"),
      path.join("application", "ports", "pin-verifier.ts"),
      path.join("application", "ports", "provider-rate-gate.contract.ts"),
      path.join("application", "ports", "provider-rate-gate.ts"),
      path.join("application", "ports", "runtime-metrics.contract.ts"),
      path.join("application", "ports", "runtime-metrics.ts"),
      path.join("application", "ports", "second-factor.ts"),
      path.join("application", "ports", "secrets.contract.ts"),
      path.join("application", "ports", "secrets.ts"),
      path.join("application", "ports", "session-reader.ts"),
      path.join("application", "ports", "signature-verifier.ts"),
      path.join("application", "ports", "venue-operation-repository.ts"),
      path.join(
        "application",
        "ports",
        "venue-operation-repository.contract.ts",
      ),
      path.join("application", "read-audit", "read-audit.ts"),
      path.join(
        "application",
        "record-audit-event",
        "record-audit-event.test.ts",
      ),
      path.join("application", "record-audit-event", "record-audit-event.ts"),
      path.join("application", "update-structure", "update-structure.ts"),
      path.join(
        "application",
        "verify-device-chain",
        "verify-device-chain.test.ts",
      ),
      path.join("application", "verify-device-chain", "verify-device-chain.ts"),
      path.join("domain", "audit.ts"),
      path.join("domain", "authorization.ts"),
      path.join("domain", "device.ts"),
      path.join("domain", "identity.ts"),
      path.join("domain", "organization.ts"),
      path.join("domain", "user.ts"),
      path.join("domain", "venue-operation.ts"),
    ].sort(),
  );
});

it("given local-node, when its sources are listed, then the structure rejection is allowed and deferred copies stay absent", () => {
  const nodeRoot = path.join(root, "apps", "local-node", "src");
  const sources = listFiles(nodeRoot, isSource).map((filePath) =>
    path.relative(nodeRoot, filePath),
  );
  const sourcePaths = sourceTrees.flatMap((tree) =>
    listFiles(path.join(root, tree), () => true),
  );
  const deferredCopies = sourcePaths.filter((filePath) =>
    namesDeferredCopy(path.relative(root, filePath)),
  );

  expect(sources.sort()).toEqual(
    [
      path.join("composition", "application-module.ts"),
      path.join("composition", "create-application.ts"),
      path.join("http", "authorization.controller.ts"),
      path.join("http", "operate-devices.controller.ts"),
      path.join("http", "operate-identity.controller.ts"),
      path.join("http", "update-structure.controller.ts"),
    ].sort(),
  );
  expect(existsSync(path.join(root, "shared/sync"))).toBe(false);
  expect(existsSync(path.join(root, "apps/admin-web"))).toBe(false);
  expect(deferredCopies).toEqual([]);
});

it("given compose, when its services are listed, then only postgres, api, and worker exist", () => {
  const compose = readFileSync(path.join(root, "docker-compose.yml"), "utf8");
  const services = compose.split(/^services:\r?\n/m)[1] ?? "";
  const names = [...services.matchAll(/^ {2}([a-z0-9-]+):\r?$/gm)].map(
    (match) => match[1],
  );

  expect(names).toEqual(["postgres", "api", "worker"]);
  expect(compose).not.toMatch(/local-node|sqlite/i);
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

it("given domain, when the module is analyzed, then it exports the layer, the venue operation, and the organization", () => {
  const module = domain;

  const keys = Object.keys(module).sort();

  expect(keys).toEqual([
    "Authorization",
    "AuthorizerRejected",
    "DeviceChain",
    "DeviceRevoked",
    "DuplicateAuthorizationId",
    "DuplicateIdentityId",
    "DuplicateNit",
    "DuplicateOrganizationId",
    "FACTUS_RESPONSE_STATUS",
    "INVOICE_LABELS",
    "Identity",
    "InvalidIdentityId",
    "InvalidOrganizationId",
    "InvoicingTaxpayerAlreadyAssigned",
    "LastOwnerRemains",
    "LimitRaised",
    "METRIC_NAME",
    "MissingActor",
    "Organization",
    "PasswordRejected",
    "PinAttemptsLocked",
    "PinRejected",
    "PointAlreadyOpen",
    "PredefinedRoleRevision",
    "PrivilegeEscalation",
    "RELEASE_DIGEST",
    "ReasonRequired",
    "RegistrationCodeExpired",
    "RegistrationCodeLocked",
    "RegistrationCodeRejected",
    "RegistrationCodeReused",
    "RequestExpired",
    "SERVICE_INSTANCES",
    "ScopeRejected",
    "SecondFactorRejected",
    "SecondFactorRequired",
    "SelfAuthorizationDenied",
    "StaleGeneration",
    "StationRefused",
    "StockNotHeld",
    "UnknownAuthorizationReference",
    "UnknownIdentityReference",
    "UnknownOrganizationReference",
    "UserDeactivated",
    "VenueOperation",
    "evaluate",
    "layer",
    "metricNames",
    "reviewMetric",
    "scrubTelemetry",
  ]);
});

it("given the contracts package, when its published contents are inspected, then it publishes the cloud write schemas", () => {
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
  expect(contents).toContain("acceptCloudWriteCommand");
  expect(contents).toContain("acceptedCloudWrite");
  expect(contents).not.toBe("export {};");
});

it("given the contracts code, when Zod imports and domain types are sought, then the cloud write schema imports Zod and not the platform", () => {
  const sources = listFiles(path.join(root, "shared", "contracts"), isSource);
  const code = sources
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");

  const importsZod = importsPackage(code, "zod");
  const importsNestjsZod = importsPackage(code, nestjsZodPackage);
  const importsPlatform = /@blackhole\/platform/.test(code);

  expect(importsZod).toBe(true);
  expect(importsNestjsZod).toBe(false);
  expect(importsPlatform).toBe(false);
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

function namesDeferredCopy(relativePath: string): boolean {
  return relativePath.split(path.sep).some((segment) => {
    const stem = segment.replace(/\.[^.]+$/, "").toLowerCase();

    return deferredCopyNames.some(
      (name) => segment.toLowerCase() === name || stem === name,
    );
  });
}

function importsPackage(code: string, packageName: string): boolean {
  const quoted = new RegExp(
    `(?:\\bfrom\\s*|\\bimport\\s*\\(\\s*|\\brequire\\s*\\(\\s*|\\bimport\\s+)["']${packageName}(?:\\/[^"']*)?["']`,
  );

  return quoted.test(code);
}

function declaresPackage(manifest: Manifest, packageName: string): boolean {
  const groups = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];

  return groups.some((group) => group?.[packageName] !== undefined);
}

function allowsZod(filePath: string): boolean {
  return zodAllowedDirectories.some((directory) =>
    isInside(filePath, path.join(root, directory)),
  );
}

function isInside(filePath: string, directory: string): boolean {
  const relative = path.relative(directory, filePath);

  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}
