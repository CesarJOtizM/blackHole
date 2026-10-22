import { FileStorage } from "#application/ports/file-storage.js";

export interface S3ObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface S3SignedUrlInput {
  key: string;
  expiresAt: Date;
}

export interface S3StorageClient {
  putObject(input: S3ObjectInput): Promise<void>;
  getSignedUrl(input: S3SignedUrlInput): Promise<string>;
}

export class S3FileStorage extends FileStorage {
  constructor(private readonly client: S3StorageClient) {
    super();
  }

  override async put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    await this.client.putObject({ key, body, contentType });
  }

  override async signedReadUrl(key: string, expiresAt: Date): Promise<URL> {
    return new URL(await this.client.getSignedUrl({ key, expiresAt }));
  }
}
