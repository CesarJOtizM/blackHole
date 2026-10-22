import { expect, it } from "vitest";
import type { FileStorage } from "#application/ports/file-storage.js";

const body = new Uint8Array([104, 105]);
const expiresAt = new Date("2030-01-01T00:00:00.000Z");

export function fileStorageContract(
  createStorage: () => FileStorage | Promise<FileStorage>,
): void {
  it("given an object, when a signed read url is requested, then it identifies that object and its expiry", async () => {
    const storage = await createStorage();

    await storage.put("invoice-one.txt", body, "text/plain");
    const url = await storage.signedReadUrl("invoice-one.txt", expiresAt);

    expect(url).toBeInstanceOf(URL);
    expect(url.href).toContain("invoice-one.txt");
    expect(url.href).toContain("2030-01-01");
  });
}
