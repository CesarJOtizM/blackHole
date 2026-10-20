/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "internal-imports-use-package-aliases",
      severity: "error",
      from: {
        path: "^(contexts|apps|shared|tools)/",
        pathNot: "^tools/cruiser/fixtures/",
      },
      to: {
        dependencyTypes: ["local"],
        dependencyTypesNot: ["aliased-subpath-import"],
      },
    },
    {
      name: "domain-does-not-import-infrastructure",
      severity: "error",
      from: { path: "(^|/)contexts/[^/]+/domain/" },
      to: {
        path: "@nestjs/|drizzle-orm|fastify|node:https?|(^|/)https?$|contexts/[^/]+/adapters/|(^|/)apps/",
      },
    },
    {
      name: "application-does-not-import-adapters-or-drizzle",
      severity: "error",
      from: {
        path: "(?:^|/)contexts/[^/]+/application/",
        pathNot: "\\.test\\.ts$",
      },
      to: {
        path: "drizzle-orm|(?:^|/)contexts/[^/]+/adapters/|(?:^|/)apps/",
      },
    },
    {
      name: "application-tests-import-only-memory-adapters",
      severity: "error",
      from: { path: "(?:^|/)contexts/[^/]+/application/.*\\.test\\.ts$" },
      to: {
        path: "drizzle-orm|(?:^|/)apps/|(?:^|/)contexts/[^/]+/adapters/(?!memory/)",
      },
    },
    {
      name: "context-does-not-import-foreign-interior",
      severity: "error",
      from: { path: "(?:^|/)contexts/([^/]+)/" },
      to: {
        path: "(?:^|/)contexts/",
        pathNot: [
          "(?:^|/)contexts/$1/",
          "(?:^|/)contexts/[^/]+/application/entry-port\\.ts$",
        ],
      },
    },
    {
      name: "app-does-not-import-foreign-dialect",
      severity: "error",
      from: { path: "(?:^|/)apps/api-cloud/" },
      to: { path: "(?:^|/)adapters/sqlite/" },
    },
    {
      name: "app-does-not-import-foreign-dialect",
      severity: "error",
      from: { path: "(?:^|/)apps/local-node/" },
      to: { path: "(?:^|/)adapters/postgres/" },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    parser: "swc",
    doNotFollow: {
      path: "node_modules",
    },
    exclude: {
      path: "(^|/)dist/",
    },
    webpackConfig: {
      fileName: "tools/cruiser/resolution.cjs",
    },
  },
};
