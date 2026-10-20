import { DrizzleVenueOperationRepository } from "@blackhole/platform/adapters/postgres/drizzle-venue-operation-repository";

type VenueOperationDatabase = ConstructorParameters<
  typeof DrizzleVenueOperationRepository
>[0];

export function postgresVenueOperations(
  db: VenueOperationDatabase,
): DrizzleVenueOperationRepository {
  return new DrizzleVenueOperationRepository(db);
}
