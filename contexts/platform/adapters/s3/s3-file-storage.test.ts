import { expect, it } from "vitest";

import { S3FileStorage } from "#adapters/s3/s3-file-storage.js";

it("given an s3 client, when an object is stored, then the signed url comes from that client", async () => {
  const seen: { key: string; bytes: number; contentType: string }[] = [];
  const storage = new S3FileStorage({
    async putObject(input) {
      seen.push({
        key: input.key,
        bytes: input.body.byteLength,
        contentType: input.contentType,
      });
    },
    async getSignedUrl(input) {
      return `https://files.example/${input.key}?expires=${input.expiresAt.toISOString()}`;
    },
  });
  const expiresAt = new Date("2030-01-01T00:00:00.000Z");

  await storage.put("ticket.txt", new Uint8Array([1, 2, 3]), "text/plain");
  const url = await storage.signedReadUrl("ticket.txt", expiresAt);

  expect(seen).toEqual([
    { key: "ticket.txt", bytes: 3, contentType: "text/plain" },
  ]);
  expect(url.hostname).toBe("files.example");
  expect(url.pathname).toBe("/ticket.txt");
});
