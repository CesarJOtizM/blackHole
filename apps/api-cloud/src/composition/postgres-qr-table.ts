import { DrizzleQrOrderIntentRepository } from "@blackhole/orders/adapters/postgres/drizzle-qr-order-intent-repository";
import { DrizzleTableQrRepository } from "@blackhole/orders/adapters/postgres/drizzle-table-qr-repository";

export type QrTableDatabase = ConstructorParameters<
  typeof DrizzleTableQrRepository
>[0];

export interface PostgresQrTable {
  tokens: DrizzleTableQrRepository;
  intents: DrizzleQrOrderIntentRepository;
}

export const postgresQrTable = (client: QrTableDatabase): PostgresQrTable => ({
  tokens: new DrizzleTableQrRepository(client),
  intents: new DrizzleQrOrderIntentRepository(client),
});
