import type { DatabaseSync } from "node:sqlite";
import {
  DrizzlePointOfSaleDirectory,
  DrizzleStockLedgerRepository,
  DrizzleStockMovementQueue,
} from "@blackhole/inventory/adapters/sqlite/drizzle-stock-ledger-repository";

export function sqliteStockLedger(client: DatabaseSync) {
  const ledger = new DrizzleStockLedgerRepository(client);

  return {
    ledger,
    pointsOfSale: new DrizzlePointOfSaleDirectory(client),
    movements: new DrizzleStockMovementQueue(ledger),
  };
}
