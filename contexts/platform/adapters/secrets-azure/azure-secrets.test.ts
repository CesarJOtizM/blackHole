import { expect, it } from "vitest";

import { AzureSecrets } from "#adapters/secrets-azure/azure-secrets.js";

it("given an azure client, when a secret is read, then the client value is returned", async () => {
  const seen: string[] = [];
  const secrets = new AzureSecrets({
    async getSecret(name) {
      seen.push(name);
      return "token-value";
    },
  });

  expect(await secrets.read("factus-token")).toBe("token-value");
  expect(seen).toEqual(["factus-token"]);
});
