import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("../..", import.meta.url));

const apps = ["api-cloud", "local-node"] as const;

it("given a route that changes data, when it declares no permission, then the suite fails", () => {
  const missing: string[] = [];

  for (const app of apps) {
    const directory = path.join(root, "apps", app, "src", "http");

    for (const file of readdirSync(directory)) {
      if (!file.endsWith(".controller.ts")) {
        continue;
      }

      const code = readFileSync(path.join(directory, file), "utf8");
      const mutations = [
        ...code.matchAll(/@(Post|Put|Patch|Delete)\(\s*"([^"]+)"\s*\)/g),
      ];
      const declared = new Map(
        [
          ...code.matchAll(/"(POST|PUT|PATCH|DELETE) ([^"]+)":\s*"([^"]+)"/g),
        ].map((match) => [`${match[1]} ${match[2]}`, match[3] ?? ""]),
      );

      for (const match of mutations) {
        const key = `${(match[1] ?? "").toUpperCase()} ${match[2] ?? ""}`;
        const permission = declared.get(key);

        if (!permission) {
          missing.push(`${app}/${file} ${key}`);
        }
      }
    }
  }

  expect(missing).toEqual([]);
});
