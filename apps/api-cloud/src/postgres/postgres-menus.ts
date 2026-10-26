import { DrizzleMenuRepository } from "@blackhole/orders/adapters/postgres/drizzle-menu-repository";

type MenuDatabase = ConstructorParameters<typeof DrizzleMenuRepository>[0];

export function postgresMenus(db: MenuDatabase): DrizzleMenuRepository {
  return new DrizzleMenuRepository(db);
}
