import { expect, it } from "vitest";

import { FileSecrets } from "#adapters/secrets-file/file-secrets.js";

it("given a file client, when a secret is read, then the client value is returned", async () => {
  const seen: string[] = [];
  const secrets = new FileSecrets({
    async read(name) {
      seen.push(name);
      return "token-value";
    },
  });

  expect(await secrets.read("factus-token")).toBe("token-value");
  expect(seen).toEqual(["factus-token"]);
});
