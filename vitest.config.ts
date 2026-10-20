import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "api-cloud",
          root: "./apps/api-cloud",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "local-node",
          root: "./apps/local-node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "platform",
          include: ["contexts/platform/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "spikes",
          include: ["tools/spikes/**/*.test.ts"],
        },
      },
      {
        server: {
          fs: {
            allow: ["../.."],
          },
        },
        test: {
          name: "skeleton",
          root: "./tools/skeleton",
          include: ["**/*.test.ts"],
        },
      },
    ],
  },
});
