import { expect, it } from "vitest";

import { GcpSecrets } from "#adapters/secrets-gcp/gcp-secrets.js";

it("given a gcp client, when a secret is read, then the client value is returned", async () => {
  const seen: string[] = [];
  const secrets = new GcpSecrets({
    async accessSecretVersion(name) {
      seen.push(name);
      return "token-value";
    },
  });

  expect(await secrets.read("factus-token")).toBe("token-value");
  expect(seen).toEqual(["factus-token"]);
});
