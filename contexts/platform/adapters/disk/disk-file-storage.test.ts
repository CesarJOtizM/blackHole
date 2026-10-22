import { expect, it } from "vitest";

import { DiskFileStorage } from "#adapters/disk/disk-file-storage.js";

it("given a disk client, when an object is stored, then the signed url comes from that client", async () => {
  const seen: { key: string; bytes: number; contentType: string }[] = [];
  const storage = new DiskFileStorage({
    async put(key, body, contentType) {
      seen.push({ key, bytes: body.byteLength, contentType });
    },
    async signedReadUrl(key, expiresAt) {
      return new URL(
        `http://disk.local/${key}?expires=${expiresAt.toISOString()}`,
      );
    },
  });
  const expiresAt = new Date("2030-01-01T00:00:00.000Z");

  await storage.put("ticket.txt", new Uint8Array([1, 2, 3]), "text/plain");
  const url = await storage.signedReadUrl("ticket.txt", expiresAt);

  expect(seen).toEqual([
    { key: "ticket.txt", bytes: 3, contentType: "text/plain" },
  ]);
  expect(url.hostname).toBe("disk.local");
  expect(url.pathname).toBe("/ticket.txt");
});
