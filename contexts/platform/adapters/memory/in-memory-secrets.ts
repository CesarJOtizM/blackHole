import { Secrets } from "#application/ports/secrets.js";

export class InMemorySecrets extends Secrets {
  constructor(private readonly stored: Readonly<Record<string, string>>) {
    super();
  }

  override async read(name: string): Promise<string> {
    const value = this.stored[name];

    if (value === undefined) {
      throw new Error(`Unknown secret: ${name}`);
    }

    return value;
  }
}
