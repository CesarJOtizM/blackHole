export abstract class FileStorage {
  abstract put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void>;

  abstract signedReadUrl(key: string, expiresAt: Date): Promise<URL>;
}
