import { DrizzleIdentityRepository } from "@blackhole/platform/adapters/postgres/drizzle-identity-repository";

type IdentityDatabase = ConstructorParameters<
  typeof DrizzleIdentityRepository
>[0];

export function postgresIdentities(
  db: IdentityDatabase,
): DrizzleIdentityRepository {
  return new DrizzleIdentityRepository(db);
}
