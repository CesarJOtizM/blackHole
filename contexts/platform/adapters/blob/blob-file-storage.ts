import { FileStorage } from "#application/ports/file-storage.js";

export interface BlobObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface BlobSignedUrlInput {
  key: string;
  expiresAt: Date;
}

export interface BlobStorageClient {
  uploadBlockBlob(input: BlobObjectInput): Promise<void>;
  generateSasUrl(input: BlobSignedUrlInput): Promise<string>;
}

export class BlobFileStorage extends FileStorage {
  constructor(private readonly client: BlobStorageClient) {
    super();
  }

  override async put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    await this.client.uploadBlockBlob({ key, body, contentType });
  }

  override async signedReadUrl(key: string, expiresAt: Date): Promise<URL> {
    return new URL(await this.client.generateSasUrl({ key, expiresAt }));
  }
}
