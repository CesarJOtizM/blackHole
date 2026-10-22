import { readFile } from "node:fs/promises";

import { Secrets } from "#application/ports/secrets.js";

export interface FileSecretsClient {
  read(name: string): Promise<string>;
}

export class FileSecrets extends Secrets {
  constructor(private readonly client: FileSecretsClient) {
    super();
  }

  override async read(name: string): Promise<string> {
    return this.client.read(name);
  }
}

export const nodeFileSecretsClient = (filePath: string): FileSecretsClient => ({
  async read(name) {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));

    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Secrets file must be an object");
    }

    const value = (parsed as Record<string, unknown>)[name];

    if (typeof value !== "string") {
      throw new Error(`Unknown secret: ${name}`);
    }

    return value;
  },
});
