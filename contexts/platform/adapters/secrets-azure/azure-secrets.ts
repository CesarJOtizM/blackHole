import { Secrets } from "#application/ports/secrets.js";

export interface AzureSecretsClient {
  getSecret(name: string): Promise<string>;
}

export class AzureSecrets extends Secrets {
  constructor(private readonly client: AzureSecretsClient) {
    super();
  }

  override async read(name: string): Promise<string> {
    return this.client.getSecret(name);
  }
}
