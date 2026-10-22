import { expect, it } from "vitest";

import { AwsSecrets } from "#adapters/secrets-aws/aws-secrets.js";

it("given an aws client, when a secret is read, then the client value is returned", async () => {
  const seen: string[] = [];
  const secrets = new AwsSecrets({
    async getSecretValue(name) {
      seen.push(name);
      return "token-value";
    },
  });

  expect(await secrets.read("factus-token")).toBe("token-value");
  expect(seen).toEqual(["factus-token"]);
});
