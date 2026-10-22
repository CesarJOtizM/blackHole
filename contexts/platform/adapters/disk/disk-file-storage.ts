import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { FileStorage } from "#application/ports/file-storage.js";

export interface DiskStorageClient {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  signedReadUrl(key: string, expiresAt: Date): Promise<URL>;
}

export class DiskFileStorage extends FileStorage {
  constructor(private readonly client: DiskStorageClient) {
    super();
  }

  override async put(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<void> {
    await this.client.put(key, body, contentType);
  }

  override async signedReadUrl(key: string, expiresAt: Date): Promise<URL> {
    return this.client.signedReadUrl(key, expiresAt);
  }
}

export const nodeDiskStorageClient = (root: string): DiskStorageClient => {
  const directory = path.resolve(root);
  const targetFor = (key: string): string => {
    const target = path.resolve(directory, key);

    if (target !== directory && !target.startsWith(`${directory}${path.sep}`)) {
      throw new Error(`Object key escapes storage root: ${key}`);
    }

    return target;
  };

  return {
    async put(key, body) {
      const target = targetFor(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
    },
    async signedReadUrl(key, expiresAt) {
      const url = pathToFileURL(targetFor(key));
      url.searchParams.set("expires", expiresAt.toISOString());
      return url;
    },
  };
};
