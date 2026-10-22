import { InMemorySecrets } from "#adapters/memory/in-memory-secrets.js";
import { secretsContract } from "#application/ports/secrets.contract.js";

secretsContract((stored) => new InMemorySecrets(stored));
