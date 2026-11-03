import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "api-cloud",
          root: "./apps/api-cloud",
          include: ["test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "local-node",
          root: "./apps/local-node",
          include: ["test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "platform",
          include: ["contexts/platform/**/*.test.ts"],
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },
      {
        test: {
          name: "orders",
          include: ["contexts/orders/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "attendance",
          include: ["contexts/attendance/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "cash-register",
          include: ["contexts/cash-register/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "invoicing",
          include: ["contexts/invoicing/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "printing",
          include: ["shared/printing/**/*.test.ts"],
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
