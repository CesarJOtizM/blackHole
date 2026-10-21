import { DrizzleOrganizationRepository } from "@blackhole/platform/adapters/postgres/drizzle-organization-repository";

type OrganizationDatabase = ConstructorParameters<
  typeof DrizzleOrganizationRepository
>[0];

export function postgresOrganizations(
  db: OrganizationDatabase,
): DrizzleOrganizationRepository {
  return new DrizzleOrganizationRepository(db);
}
