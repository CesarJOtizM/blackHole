import { expect, it } from "vitest";

import { GcsFileStorage } from "#adapters/gcs/gcs-file-storage.js";

it("given a gcs client, when an object is stored, then the signed url comes from that client", async () => {
  const seen: { key: string; bytes: number; contentType: string }[] = [];
  const storage = new GcsFileStorage({
    async save(input) {
      seen.push({
        key: input.key,
        bytes: input.body.byteLength,
        contentType: input.contentType,
      });
    },
    async getSignedUrl(input) {
      return `https://storage.example/${input.key}?expires=${input.expiresAt.toISOString()}`;
    },
  });
  const expiresAt = new Date("2030-01-01T00:00:00.000Z");

  await storage.put("ticket.txt", new Uint8Array([1, 2, 3]), "text/plain");
  const url = await storage.signedReadUrl("ticket.txt", expiresAt);

  expect(seen).toEqual([
    { key: "ticket.txt", bytes: 3, contentType: "text/plain" },
  ]);
  expect(url.hostname).toBe("storage.example");
  expect(url.pathname).toBe("/ticket.txt");
});
