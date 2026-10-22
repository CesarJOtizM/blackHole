import { FileStorage } from "#application/ports/file-storage.js";

export class InMemoryFileStorage extends FileStorage {
  private readonly objects = new Map<
    string,
    { body: Uint8Array; contentType: string }
  >();

  override async put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    this.objects.set(key, { body, contentType });
  }

  override async signedReadUrl(key: string, expiresAt: Date): Promise<URL> {
    if (!this.objects.has(key)) {
      throw new Error(`Unknown object: ${key}`);
    }

    const url = new URL("http://files.local/read");
    url.searchParams.set("key", key);
    url.searchParams.set("expires", expiresAt.toISOString());
    return url;
  }
}
