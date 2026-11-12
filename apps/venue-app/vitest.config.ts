import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    name: "venue-app",
    root,
    environment: "jsdom",
    include: ["test/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"],
  },
});
