# Apply progress: p2-03-purchasing

Work units 1, 2, and 3. Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. `openspec/config.yaml` still requires the failing test first, so each pair ran RED then GREEN.

Delivery: auto-chain. Chain strategy: feature-branch-chain. Decision needed before apply: No.

Work unit 1 intended PR boundary: branch `p2-03/domain` based on `phase-2/inventory`. Not created. Not committed. Not pushed. No pull request.

Work unit 2 intended PR boundary: PR 2 on PR 1 (`p2-03/domain`). Tasks 2.1–2.6 only. Not created. Not committed. Not pushed. No pull request.

Work unit 3 intended PR boundary: PR 3 on PR 2. Tasks 2.7–2.8 only. Not created. Not committed. Not pushed. No pull request.

Previous apply-progress: work units 1 and 2 (tasks 1.1–2.6). Merged below. Unit 1 and unit 2 evidence was not dropped.

## Completed tasks

- [x] 1.1 RED `contexts/inventory/domain/stock-ledger.test.ts`: purchase above zero appends; zero or below throws; 1000 g at 10 then 1000 g at 14 is 12; on-hand at or below zero takes the receipt cost; waste stays 12. Half-up of 10 and 11 is 11.
- [x] 1.2 GREEN `contexts/inventory/domain/stock-ledger.ts`: `purchase` is writable when quantity is a positive integer. `nextAverageCost` rounds half-up to a whole COP. `averageCost` replays purchases only. Movements stay immutable.
- [x] 1.3 RED `contexts/inventory/domain/purchasing.test.ts`: duplicate supplier id and duplicate order id are rejected; 5 kg at 4000 becomes 5000 g at 4; 4500/kg becomes 5 and the line keeps 4500; cancelled, received, and over-receipt are rejected; the order line factor stays frozen.
- [x] 1.4 GREEN `contexts/inventory/domain/purchasing.ts` and `domain/index.ts`. Supplier, order status, `purchaseQuantity * factor`, `round(cost * QUANTITY_SCALE / factor)`.
- [x] 2.1 RED `contexts/inventory/application/create-supplier/create-supplier.test.ts`: same NIT rejected inside one tenant; another tenant may reuse it; `issuesEInvoices` and lead time are stored. No document, Factus, or VAT fields.
- [x] 2.2 GREEN `CreateSupplier`, `PurchasingRepository`, and `InMemoryPurchasingRepository`.
- [x] 2.3 RED `contexts/inventory/application/create-purchase-order/create-purchase-order.test.ts`: one supplier, one location, purchase units, `open`, frozen factor.
- [x] 2.4 GREEN `CreatePurchaseOrder`. The line stores the supplied purchase quantity and factor.
- [x] 2.5 RED `contexts/inventory/application/cancel-purchase-order/cancel-purchase-order.test.ts`: no stock movement; a later receipt is rejected by domain status.
- [x] 2.6 GREEN `CancelPurchaseOrder`. Status becomes `cancelled`. `receive` throws `PurchaseOrderClosed`. No `append`.
- [x] 2.7 RED `contexts/inventory/application/receive-purchase/receive-purchase.test.ts`: direct 5 kg at 4000 becomes 5000 g at 4; 6 of 10 stays partial with 4 pending; the rest marks the order received; over-receipt and a closed order are rejected; the same `receiptId` is a no-op.
- [x] 2.8 GREEN `ReceivePurchase` calls `confirm`. Sale columns stay null, no `after_sales` row, `actorId` and the published factor are stored, and the location comes from `InventoryLocationDirectory`. The fourth use case is exported. `#application/receive-purchase/*` was added before that import.

## Work unit 1 evidence

Work unit 1 of 6: Domain (tasks 1.1, 1.2, 1.3, and 1.4). Intended branch `p2-03/domain`. Intended base `phase-2/inventory`.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/purchasing.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  15 passed (15)`. Re-run after `pnpm exec biome check --write` on the five domain files: same result, exit 0. |
| Runtime harness command/scenario and exact result | N/A. Pure domain. `StockLedger`, `nextAverageCost`, `PurchaseOrder`, and `Purchasing` do not open files, sockets, or a database. |
| Rollback boundary | `contexts/inventory/domain/purchasing.ts`, `contexts/inventory/domain/purchasing.test.ts`, the purchasing and `nextAverageCost` exports in `contexts/inventory/domain/index.ts`, the purchase and average-cost tests in `contexts/inventory/domain/stock-ledger.test.ts`, and the purchase / `nextAverageCost` / `averageCost` edits in `contexts/inventory/domain/stock-ledger.ts`. Reverting those removes this slice. The pre-existing `onHandDelta` rule and `reversesMovementId` stay. Phase marks live in this change's `tasks.md`, `state.yaml`, and `apply-progress.md`. |

### RED then GREEN (unit 1)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts` exit 1. `Test Files  1 failed (1)`. `Tests  5 failed \| 5 passed (10)`. A purchase above zero threw `MovementTypeNotWritable`. Quantity 0 and below threw `MovementTypeNotWritable` instead of `InvalidQuantity`. `nextAverageCost is not a function`. The five existing ledger tests, including waste that reverses a sale consumption, still passed. | Same command after `purchase` was allowed and `nextAverageCost` / `averageCost` were added: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |
| 1.3 → 1.4 | `pnpm exec vitest run --project inventory contexts/inventory/domain/purchasing.test.ts` exit 1. `FAIL contexts/inventory/domain/purchasing.test.ts` — `Cannot find module '#domain/purchasing.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | `pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/purchasing.test.ts` after `purchasing.ts`, the `domain/index.ts` exports, and Biome: exit 0. `Test Files  2 passed (2)`. `Tests  15 passed (15)`. |

### Average-cost rule

`nextAverageCost` is half-up to a whole COP per base unit.

- On-hand above zero: `(onHand * averageCost + receivedQuantity * receiptCost) / (onHand + receivedQuantity)`, with integer half-up `floor((numerator + floor(denominator / 2)) / denominator)`.
- On-hand at or below zero: the receipt cost. A negative balance is not weighted.
- 1000 g at 10 COP/g then 1000 g at 14 COP/g is 12. One unit at 10 and one unit at 11 (10.5) is 11.
- `averageCost` on the ledger calls `nextAverageCost` only for `purchase`. Waste, sale consumption, and sale return change on-hand and leave the average unchanged. After 10 then 14, 200 g of waste stays at 12.
- A receipt line stores the entered COP per purchase unit. Base quantity is `purchaseQuantity * factor` (factor already scaled). Base unit cost is the same half-up of `purchaseUnitCost * QUANTITY_SCALE / factor`. 5 kg at factor `1000 * QUANTITY_SCALE` and 4000 COP/kg is `5000 * QUANTITY_SCALE` g at 4 COP/g. 4500 COP/kg is 5 COP/g, and the line keeps 4500.

### Waste rule kept

`onHandDelta` still returns 0 when a waste movement's `reversesMovementId` points at a `sale_consumption` of the same ingredient. `reversesMovementId` is still stored. `balance` and `averageCost` both use `onHandDelta`. A domain test covers that waste line and expects on-hand to stay at the consumption quantity. This slice did not edit `contexts/inventory/domain/stock-ledger.ts`.

### Deferred from unit 1

Same `receiptId` as a no-op belongs to task 2.7. Unit 1 requires a non-empty `receiptId` and does not remember it. Duplicate NIT was deferred to task 2.1 and is now implemented in the supplier use case. Unit 1 still rejects a repeated supplier id and a repeated purchase order id in the domain.

### Deviations (unit 1)

None in the assigned behavior. `averageCost` is a derived query on `StockLedger` so the waste scenario can read the average without a second balance. The order decision's receipt idempotency is not in tasks 1.1–1.4.

### Size (unit 1)

New files: `purchasing.ts` 355 lines, `purchasing.test.ts` 181 lines. `index.ts` +18. `stock-ledger.test.ts` +205 / −3 against HEAD. `stock-ledger.ts` +108 / −3 against HEAD includes the pre-existing uncommitted waste rule plus the domain slice. The domain unit is above the 400-line review budget. The assigned slice stopped at task 1.4.

## Work unit 2 evidence

Work unit 2 of 6: Orders (tasks 2.1, 2.2, 2.3, 2.4, 2.5, and 2.6). Intended PR 2 on PR 1. Receive, persistence, HTTP, and screens were not started.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/create-supplier/create-supplier.test.ts contexts/inventory/application/create-purchase-order/create-purchase-order.test.ts contexts/inventory/application/cancel-purchase-order/cancel-purchase-order.test.ts` — exit 0. `Test Files  3 passed (3)`. `Tests  4 passed (4)`. |
| Runtime harness command/scenario and exact result | N/A. In-memory use cases. `CreateSupplier`, `CreatePurchaseOrder`, and `CancelPurchaseOrder` do not open sockets, listen, or use Postgres. The stock check reads `InMemoryStockLedgerRepository.balance` only. |
| Rollback boundary | `contexts/inventory/application/create-supplier/`, `contexts/inventory/application/create-purchase-order/`, `contexts/inventory/application/cancel-purchase-order/`, `contexts/inventory/application/ports/purchasing-repository.ts`, `contexts/inventory/adapters/memory/in-memory-purchasing-repository.ts`, the three `#application/<folder>/*` import patterns in `contexts/inventory/package.json`, and the three use-case exports in `contexts/inventory/application/entry-port.ts`. Reverting those removes this slice. Domain files, including the waste `onHandDelta` rule, stay. |

### RED then GREEN (unit 2)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.1 → 2.2 | `pnpm exec vitest run --project inventory contexts/inventory/application/create-supplier/create-supplier.test.ts` exit 1. `Cannot find module '#adapters/memory/in-memory-purchasing-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, port, and in-memory repository: exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. |
| 2.3 → 2.4 | `pnpm exec vitest run --project inventory contexts/inventory/application/create-purchase-order/create-purchase-order.test.ts` exit 1. `Cannot find module '#application/create-purchase-order/create-purchase-order.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command: exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. |
| 2.5 → 2.6 | `pnpm exec vitest run --project inventory contexts/inventory/application/cancel-purchase-order/cancel-purchase-order.test.ts` exit 1. `Cannot find module '#application/cancel-purchase-order/cancel-purchase-order.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command: exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. |

### Supplier and order rules

- The same NIT is rejected inside one tenant with `DuplicateSupplierIdentification` and is stored again for another tenant.
- The stored supplier is only `id`, `identification`, `name`, `issuesEInvoices`, and `leadTimeDays`.
- An order targets one existing supplier and one location. Lines keep purchase quantity. The factor passed at open is the factor stored on the line. Status is `open`.
- Cancel writes no stock movement. The test ledger throws if `append` is called, and the balance stays 0. A later `PurchaseOrder.receive` throws `PurchaseOrderClosed`. `ReceivePurchase` was not implemented.

### Deviations (unit 2)

`CancelPurchaseOrder` receives the stock ledger and reads `balance` before and after cancel. A change throws `PurchaseCancelChangedStock`. It never calls `append`. The design says cancel does not touch the ledger. The read is the guard that makes the no-movement test observe that port. No Nest, Drizzle, Zod, Factus, support document, or VAT split was added.

### Left for 2.7 and 2.8

- `ReceivePurchase` and `receive-purchase.test.ts`: direct 5 kg at 4000 → 5000 g at 4; partial 6/10 with 4 pending; full `received`; over-receipt and closed order rejected; same `receiptId` is a no-op.
- `confirm`, not `append`. Null sale columns, no outbox, `actorId`, published factor for a direct receipt, and `inventory-location-directory`.
- The three order use cases and their `#application/<folder>/*` patterns are already exported. Task 2.8 still adds the receive folder pattern and the fourth export.
- Persistence, HTTP, and screens were not started.

`state.yaml` stays `status: applying` and `apply: partial`.

## Work unit 3 evidence

Work unit 3 of 6: Receive (tasks 2.7 and 2.8). Intended PR 3 on PR 2. Persistence, HTTP, and screens were not started.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/receive-purchase/receive-purchase.test.ts contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/purchasing.test.ts` — exit 0. `Test Files  3 passed (3)`. `Tests  26 passed (26)`. The order use cases from unit 2 were re-run after `confirm` was added to the repository: exit 0. `Test Files  3 passed (3)`. `Tests  4 passed (4)`. |
| Runtime harness command/scenario and exact result | N/A. In-memory use case. `ReceivePurchase` does not open a socket, listen, or use Postgres. `confirm` reads `StockLedgerRepository.balance` and does not call `append`. |
| Rollback boundary | `contexts/inventory/application/receive-purchase/`, `contexts/inventory/application/ports/inventory-location-directory.ts`, `contexts/inventory/application/ports/published-purchase-factor.ts`, the `confirm` types and method on `contexts/inventory/application/ports/purchasing-repository.ts`, the confirm, movement, and average additions in `contexts/inventory/adapters/memory/in-memory-purchasing-repository.ts`, the `#application/receive-purchase/*` import in `contexts/inventory/package.json`, and the `ReceivePurchase` export in `contexts/inventory/application/entry-port.ts`. Reverting those removes this slice. Domain files, including `onHandDelta`, stay. Units 1 and 2 stay. |

### RED then GREEN (unit 3)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.7 → 2.8 | `pnpm exec vitest run --project inventory contexts/inventory/application/receive-purchase/receive-purchase.test.ts` exit 1. `Missing "#application/receive-purchase/receive-purchase.js" specifier in "@blackhole/inventory" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | The command in the evidence table, after the use case, ports, `confirm`, the import pattern, and the entry-port export: exit 0. `Test Files  3 passed (3)`. `Tests  26 passed (26)`. |

### Receipt rules

- A direct receipt resolves the location through `InventoryLocationDirectory` and converts with the published factor. 5 kg at factor `1000 * QUANTITY_SCALE` and 4000 COP/kg is `5000 * QUANTITY_SCALE` g at 4 COP/g. The stored movement keeps `actorId`. `orderLineId`, `role`, and `recipeVersion` are null.
- `confirm` applies the order rules. 6 of 10 is `partially_received` with 4 pending. The remaining 4 marks the order `received`. A further receipt throws `PurchaseOrderClosed`. Quantity above the remainder throws `OverReceipt` and writes no movement. A cancelled order throws `PurchaseOrderClosed`.
- The same `receiptId` returns the stored receipt and does not receive again, even when the second payload would exceed the remainder.
- An order line keeps its frozen factor when the published factor is different.
- `ReceivePurchase` calls `purchasing.confirm`. It does not call `StockLedgerRepository.append`. A guarded ledger throws if `append` is used. `afterSales` stays empty. A waste row appended on the stock ledger is the only `after_sales` envelope in that test, and the purchase average stays 12.
- Average cost uses `nextAverageCost`. On-hand at or below zero takes the receipt cost. On-hand already on the ledger is included. Two receipts of 1000 g at 10 then 14 are 12. Waste does not call `nextAverageCost`.
- `contexts/inventory/domain/stock-ledger.ts` was not edited. `onHandDelta` still returns 0 when a waste movement's `reversesMovementId` points at a `sale_consumption` of the same ingredient. The domain suite in the green command covers that case.

### Deviations (unit 3)

`PublishedPurchaseFactor` is an extra port. The design file names `inventory-location-directory` and says a direct receipt uses the published factor. The use case reads that factor from the port and records it. An order receipt still converts with the factor frozen on the line.

`confirm` stores the purchase movement, the purchase quantity, and the average on the in-memory purchasing repository. On-hand for `nextAverageCost` is the stock-ledger balance plus those confirmed purchase quantities, so a purchase is not counted twice and `append` is not used. Task 3.2 still moves those rows onto the ledger maps. Until then, the stock-ledger balance does not include the purchase quantity.

No Nest, Drizzle, Zod, Factus, support document, or VAT split was added.

### Left for the persistence slice

- 3.1 RED `purchasing-repository.contract.ts` on memory: balances match, other tenant hidden, rollback of receipt, movements, average, and status. No Drizzle mock.
- 3.2 GREEN memory adapter on the ledger maps. Skip `after_sales`. Do not count a purchase both in the purchasing on-hand map and on the ledger.
- 3.3 RED that contract on PGlite with `SET LOCAL` `app.tenant_id`.
- 3.4 GREEN `0003_purchasing.sql`: purchasing tables, `average_cost` 0, nullable sale columns, partial unique `stock_movements_line`. No backfill.
- 3.5 SQLite columns only. No purchase wiring, local-node, or `shared/sync`.
- HTTP (4.1–4.3) and screens (5.1–5.2) were not started.

`state.yaml` stays `status: applying` and `apply: partial`.

## Work unit 4 evidence

Work unit 4 of 6: Persistence (tasks 3.1–3.5). Intended PR 4 on PR 3. HTTP and screens were not started.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-purchasing-repository.contract.test.ts contexts/inventory/adapters/postgres/drizzle-purchasing-repository.contract.test.ts contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.contract.test.ts contexts/inventory/application/receive-purchase/receive-purchase.test.ts` — exit 0. `Test Files  4 passed (4)`. `Tests  25 passed (25)`. |
| Runtime harness command/scenario and exact result | PGlite loads `0001_recipe_catalog.sql`, `0002_stock_ledger.sql`, and `0003_purchasing.sql`, then `SET LOCAL ROLE inventory_app` and `SELECT set_config('app.tenant_id', tenant, true)` inside the purchasing transaction. The postgres contract above is that harness: exit 0, 4 tests. Memory confirm does not open a socket. SQLite stays on `node:sqlite` for sale movements; it is not a purchasing runtime. |
| Rollback boundary | `contexts/inventory/application/ports/purchasing-repository.contract.ts`, `contexts/inventory/adapters/memory/in-memory-purchasing-repository.ts`, `contexts/inventory/adapters/memory/in-memory-stock-ledger-repository.ts`, `contexts/inventory/adapters/postgres/0003_purchasing.sql`, `contexts/inventory/adapters/postgres/drizzle-purchasing-repository.ts`, the nullable sale columns and `average_cost` in `contexts/inventory/adapters/sqlite/schema.ts`, and the sale-row narrowing plus the balance insert in `contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.ts`. Reverting those removes this slice. Units 1–3 stay. Domain files were not edited. |

### RED then GREEN (unit 4)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.1 → 3.2 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-purchasing-repository.contract.test.ts` exit 1. `Test Files  1 failed (1)`. `Tests  4 failed (4)`. Ledger balance stayed 0 after 5 kg, stayed 1000 g after a purchase onto 1000 g, and `storedReceipts` was missing. | The same command, after purchases post once onto the ledger maps and skip `after_sales`: exit 0. The later four-file command also includes this contract: exit 0. |
| 3.3 → 3.4 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-purchasing-repository.contract.test.ts` exit 1. `Cannot find module '#adapters/postgres/drizzle-purchasing-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | The same command after `0003_purchasing.sql` and `DrizzlePurchasingRepository`: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |
| 3.5 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.contract.test.ts` exit 1. `Tests  1 failed \| 5 passed (6)`. `stockMovements.orderLineId.notNull` was true. | The same command after the schema columns and the sale-row narrowing: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |

### Confirm rules that stayed

- 5 kg at factor `1000 * QUANTITY_SCALE` and 4000 COP/kg is `5000 * QUANTITY_SCALE` g at 4 COP/g. The ledger balance equals that quantity. Average cost is 4.
- The same `receiptId` with a different payload returns the stored receipt and does not receive again.
- A purchase movement keeps `orderLineId`, `role`, and `recipeVersion` null. `after_sales` is not enqueued. `outboxCount` stays 0 on a direct receipt.
- Another tenant loads no order, no receipt, no movement, and balance 0.
- A failed receipt rolls back the receipt, the movements, the average, and the order status. On memory that is a snapshot restore. On Postgres the throw happens inside the tenant transaction, after the receipt insert and the status update, so the database rolls those writes back.

### Deviations (unit 4)

`stock_movements.venue_id` is `NOT NULL` and a receipt has no venue. The Postgres repository stores `locationId` in `venue_id`.

The purchasing repository sums the ledger balance. A posted purchase is already inside that balance, so confirm adds the quantity once when it writes the movement. It does not keep a second purchase on-hand map. Within one receipt, only lines not yet posted are added to the running on-hand used by `nextAverageCost`.

`contexts/inventory/application/receive-purchase/receive-purchase.test.ts` now expects the ledger balance to include the purchase: `5000 * QUANTITY_SCALE` for a direct receipt, and `grams(2000)` when 1000 g was already on the ledger. The average assertions are unchanged. `append` is still not called.

SQLite `0002_stock_ledger.sql` was not changed, so the table the sale tests create has no `average_cost` and still requires the sale columns. The Drizzle schema makes `order_line_id`, `role`, and `recipe_version` nullable and adds `stock_balances.average_cost integer not null default 0`. The sale balance insert lists only `tenant_id`, `location_id`, `ingredient_id`, and `quantity`, because Drizzle would otherwise send `average_cost` and the 0002 table would reject it. Sale reads still select `quantity` only. `lineFromRow` throws when a sale row is missing its order line, role, or recipe version. Outbox columns stay `NOT NULL`. No purchasing tables, no local-node, and no `shared/sync`.

`0003_purchasing.sql` does not backfill. `average_cost` defaults to 0. The sale columns drop `NOT NULL`. `stock_movements_line` is a partial unique index where `order_line_id IS NOT NULL`.

### Left for HTTP and screens

- 4.1–4.3 Cloud HTTP. Not started.
- 5.1–5.2 Screens. Not started.

`state.yaml` stays `status: applying` and `apply: partial`.

## Work unit 5 evidence

Work unit 5 of 6: HTTP (tasks 4.1, 4.2, and 4.3). Intended PR 5 on PR 4. Screens were not started. `strict_tdd: false`. `strict-tdd.md` was not loaded. The failing HTTP test was written before the controller.

### RED (4.2, before the controller)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.2 → 4.3 | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/purchasing.controller.test.ts` exit 1. `FAIL apps/api-cloud/test/http/purchasing.controller.test.ts`. `Cannot find module '#src/http/purchasing.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | The same command after the controller, Postgres wiring, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. |

4.1 is the strict Zod command and receipt in `shared/contracts/purchasing.ts`, exported from `shared/contracts/index.ts`. No Zod was added to the domain.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/purchasing.controller.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. Re-run after `pnpm exec biome check --write` on the six HTTP and contract files: same result, exit 0. |
| Runtime harness command/scenario and exact result | Nest boots Fastify and the tests call `inject`. `server.listening` stays false. No `listen`. Flag off returns 404 and the controller is not registered. With `purchasingEnabled`, PGlite loads `0001_recipe_catalog.sql`, `0002_stock_ledger.sql`, and `0003_purchasing.sql`. A waiter is 403 `PurchaseReceiveDenied`. A warehouse keeper receipt at the site warehouse omits `averageCost`. An administrator with `inventory.view-cost` sees `averageCost` 4. The same `receiptId` returns the same body. The purchase row keeps `order_line_id`, `role`, and `recipe_version` null. `queued` stays empty. A body with `supportDocument` and `vat` is 400 and writes no movement. |
| Rollback boundary | `shared/contracts/purchasing.ts`, the purchasing export in `shared/contracts/index.ts`, `apps/api-cloud/test/http/purchasing.controller.test.ts`, `apps/api-cloud/src/http/purchasing.controller.ts`, `apps/api-cloud/src/composition/inventory-location-directory.ts`, the `purchasingEnabled` registration in `apps/api-cloud/src/composition/application-module.ts`, the purchasing port, location directory, factor port, and Postgres repository exports in `contexts/inventory/package.json`, and `@electric-sql/pglite` on `@blackhole/api-cloud` (package.json and pnpm-lock.yaml). Reverting those removes this slice. Units 1–4 stay. Domain, SQL, SQLite, and the purchasing repositories were not edited. |

### Receipt route

- `POST /tenants/:tenantId/purchase-receipts` is registered only when `purchasingEnabled` is true. The host is Postgres through `DrizzlePurchasingRepository`. There is no SQLite purchasing wiring and no in-memory purchasing fallback.
- The handler calls `ReceivePurchase.execute`, which calls `PurchasingRepository.confirm`. A repeated `receiptId` is the stored receipt.
- A location must be a point of sale or a warehouse. The permission target is the venue when the location has one, and the warehouse when it does not.
- `inventory.receive-purchase` is required. `inventory.view-cost` only decides whether each line includes `averageCost`.
- The Zod command is strict: `receiptId`, `locationId`, optional `purchaseOrderId`, and purchase lines. The receipt schema is strict and leaves `averageCost` optional. Invalid input, including a support document or VAT field, is 400. No Factus.

### Deviations (unit 5)

`PurchaseAverageCost` reads `DrizzlePurchasingRepository.averageCost` after confirm. The purchasing repository files were not edited, and the abstract port still has no average method.

`CatalogPublishedPurchaseFactor` resolves the published purchase-unit factor from the recipe catalog. A direct receipt uses that factor. 5 kg at 4000 COP/kg is `5000 * QUANTITY_SCALE` g at 4 COP/g, and the average is 4.

`@electric-sql/pglite` was added to `@blackhole/api-cloud` so the HTTP test can open the same Postgres client the composition requires. The inventory package exports the purchasing port, the location directory, the factor port, and the Postgres purchasing repository so api-cloud can import them.

### Left for screens

- 5.1–5.2 Screens. Not started.

`state.yaml` stays `status: applying` and `apply: partial`.

## Work unit 6 evidence

Work unit 6 of 6: Screens (tasks 5.1 and 5.2). Intended PR 6 on PR 5. Not created. Not committed. Not pushed. No pull request. `strict_tdd: false`. `strict-tdd.md` was not loaded. The screen behavior checks were written before the production screen changes.

### RED (before the screens posted)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 5.1 | `pnpm exec vitest run --project admin-web test/inventory/purchase-screen.test.tsx` exit 1. `Test Files  1 failed (1)`. `Tests  5 failed (5)`. The purchase screen still rendered `Enviar por WhatsApp`, `Precio factura`, and the invoice photo note. There was no location field and no receipt POST. | The same command after `PurchaseScreen` posted the receipt and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. |
| 5.2 | `pnpm exec vitest run --config apps/venue-app/vitest.config.ts test/purchasing/receive-screen.test.tsx` exit 1. `FAIL test/purchasing/receive-screen.test.tsx`. `Failed to resolve import "#src/purchasing/receive-screen.js"`. `Test Files  1 failed (1)`. `Tests  no tests`. | The same command after the route, `ReceiveScreen`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Admin: `pnpm exec vitest run --project admin-web test/inventory/purchase-screen.test.tsx` — exit 0. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. Venue: `pnpm exec vitest run --config apps/venue-app/vitest.config.ts test/purchasing/receive-screen.test.tsx` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. Both ran after `pnpm exec biome check --write` on the five screen and test files. |
| Runtime harness command/scenario and exact result | jsdom screen tests above. Each confirmation calls `fetch` `POST /tenants/pilot/purchase-receipts` with `x-session-id: admin-web` and a strict receipt body (`receiptId`, `locationId`, lines of `ingredientId`, `purchaseQuantity`, `purchaseUnitCost`). Admin also sends `purchaseOrderId` `oc-0418`. Venue omits `purchaseOrderId`. A response line with `averageCost` 4 shows `Costo promedio 4`. A response without that field does not. A rejected `fetch` shows the reconnect message. `localStorage` and `sessionStorage` stay empty. Live api-cloud was not contacted; `fetch` is stubbed. |
| Rollback boundary | `apps/admin-web/src/inventory/inventory-screen.tsx`, `apps/admin-web/test/inventory/purchase-screen.test.tsx`, `apps/venue-app/src/router.tsx`, `apps/venue-app/src/purchasing/receive-screen.tsx`, and `apps/venue-app/test/purchasing/receive-screen.test.tsx`. Reverting those removes this slice. Units 1–5 stay. `inventory-view.tsx`, contracts, api-cloud, and `venue-cloud.ts` were not edited. |

### Receipt screens

- `PurchaseScreen` posts to `/tenants/pilot/purchase-receipts`. The body is the purchasing command. It does not send a photo, an invoice price, WhatsApp, `supportDocument`, or `vat`. The order field starts as `oc-0418` because that route is the OC-0418 screen. Clearing it omits `purchaseOrderId`.
- The rendered admin screen no longer uses `PurchaseView`, so WhatsApp, the invoice photo note, and the invoice price columns are not on the page. `PurchaseView` remains in `inventory-view.tsx` and is unused by this screen.
- Average cost is rendered only when the parsed receipt line includes `averageCost`. Admin parses with `purchaseReceipt` from `@blackhole/contracts`. A keeper response that omits the field shows `Recepción registrada.` and no average.
- `ReceiveScreen` is the `/purchasing` route, linked as `Recepción`. It posts the same path and session header. An empty order field omits `purchaseOrderId`. The screen does not write `localStorage` or `sessionStorage`, and it does not keep a receipt on the service session.
- A failed `fetch` does not record a local receipt. The status is `No se puede registrar hasta que vuelva la conexión.`

### Deviations (unit 6)

`venue-app` does not depend on `@blackhole/contracts`, and `package.json` was outside this slice. `ReceiveScreen` checks the receipt shape in the screen instead of importing the Zod schema. The accepted body is the same command: `receiptId`, `locationId`, optional `purchaseOrderId`, and purchase lines.

`PurchaseScreen` stopped rendering `PurchaseView`. That view still contains the WhatsApp action, the invoice photo note, and the invoice price columns. They are not part of the screen the route renders.

### Completed tasks

Tasks 1.1–4.3 stay complete from units 1–5. Their evidence above was not removed.

- [x] 5.1 `PurchaseScreen` posts the receipt. No invoice photo, invoice price, or WhatsApp. Average only when the response includes it.
- [x] 5.2 `/purchasing` renders `ReceiveScreen` and posts the same receipt. No local receipt.

`state.yaml` is `status: applied` and `apply: done`. Verify and archive stay pending.
