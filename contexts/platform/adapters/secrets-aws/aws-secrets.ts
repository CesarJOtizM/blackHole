import { Secrets } from "#application/ports/secrets.js";

export interface AwsSecretsClient {
  getSecretValue(name: string): Promise<string>;
}

export class AwsSecrets extends Secrets {
  constructor(private readonly client: AwsSecretsClient) {
    super();
  }

  override async read(name: string): Promise<string> {
    return this.client.getSecretValue(name);
  }
}
