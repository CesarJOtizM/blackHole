import { expect, it } from "vitest";
import type { Secrets } from "#application/ports/secrets.js";

export function secretsContract(
  createSecrets: (stored: Record<string, string>) => Secrets | Promise<Secrets>,
): void {
  it("given a stored name, when it is read, then the secret string is returned", async () => {
    const secrets = await createSecrets({ "factus-token": "token-value" });

    expect(await secrets.read("factus-token")).toBe("token-value");
  });
}
