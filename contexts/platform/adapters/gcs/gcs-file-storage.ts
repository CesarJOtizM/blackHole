import { FileStorage } from "#application/ports/file-storage.js";

export interface GcsObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface GcsSignedUrlInput {
  key: string;
  expiresAt: Date;
}

export interface GcsStorageClient {
  save(input: GcsObjectInput): Promise<void>;
  getSignedUrl(input: GcsSignedUrlInput): Promise<string>;
}

export class GcsFileStorage extends FileStorage {
  constructor(private readonly client: GcsStorageClient) {
    super();
  }

  override async put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    await this.client.save({ key, body, contentType });
  }

  override async signedReadUrl(key: string, expiresAt: Date): Promise<URL> {
    return new URL(await this.client.getSignedUrl({ key, expiresAt }));
  }
}
