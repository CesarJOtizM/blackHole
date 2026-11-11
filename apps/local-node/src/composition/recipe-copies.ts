import type { DatabaseSync } from "node:sqlite";
import {
  DrizzleRecipeCopyRepository,
  prepareRecipeCopyDatabase,
} from "@blackhole/inventory/adapters/sqlite/drizzle-recipe-copy-repository";

export function sqliteRecipeCopies(
  client: DatabaseSync,
): DrizzleRecipeCopyRepository {
  prepareRecipeCopyDatabase(client);
  return new DrizzleRecipeCopyRepository(client);
}
