import { Secrets } from "#application/ports/secrets.js";

export interface GcpSecretsClient {
  accessSecretVersion(name: string): Promise<string>;
}

export class GcpSecrets extends Secrets {
  constructor(private readonly client: GcpSecretsClient) {
    super();
  }

  override async read(name: string): Promise<string> {
    return this.client.accessSecretVersion(name);
  }
}
