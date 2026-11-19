# Apply progress: p2-02-sale-consumption

Change: `p2-02-sale-consumption`
Work units recorded: 1, 2, 3, and 4 of 4
Branch: `p2-02/domain`
PR base: `phase-2/sale-consumption`
Committed: no
Pushed: no
Mode: Standard (`strict_tdd: false`). RED then GREEN still ran, as required by ADR-017 and `rules.apply`. `strict-tdd.md` was not loaded.

Tasks 1.1–4.6 are complete. This is the last implementation unit. Ready for `sdd-verify`. Verify was not run. The change was not archived.

## Completed tasks

- [x] 1.1 RED `contexts/inventory/domain/stock-ledger.test.ts`: balance −200; no edit or delete; one reversal. No Nest.
- [x] 1.2 GREEN `domain/stock-ledger.ts`. `MOVEMENT_TYPE`. Writers: `sale_consumption`, `sale_return`, `waste`. p2-01 scaled integer.
- [x] 2.1 RED `application/register-sale-consumption/register-sale-consumption.test.ts` (`ExplodeRecipe` double): portions 2, version 4, POS shared with bar; missing recipe writes nothing; stocked sauce stays; dressing expands; new send uses version 5; −200 g opens one alert; second send opens none; retry writes nothing; stale `generation` throws `StaleGeneration`.
- [x] 2.2 GREEN that folder. Ports `stock-ledger-repository`, `point-of-sale-directory`, `operation-generation`, `stock-alert-publisher`. Snapshot reference cost.
- [x] 2.3 RED `application/return-stock/return-stock.test.ts`: restore stored version; retry writes nothing; other reversal throws `LineReversalConflict` and copies unit cost.
- [x] 2.4 GREEN `return-stock/`. Unique `(tenantId, orderLineId, role)`: `consumption` or `reversal`.
- [x] 2.5 RED `application/record-waste/record-waste.test.ts`: reason, actor, no return, version 4, cost unchanged. Audit `inventory.record-waste` via platform entry port.
- [x] 2.6 GREEN `record-waste/`. Export three use cases from `entry-port.ts`. Add `#application/<folder>/*` in `package.json`.
- [x] 2.7 `shared/contracts/stock-movement.ts`: `StockMoved`, `NegativeStockOpened`. Export from `index.ts`. No Zod in domain.
- [x] 3.1 RED `application/ports/stock-ledger-repository.contract.ts` on memory: equal balances; other tenant hidden; failed third insert rolls back movements, balance, alert, and the queued row.
- [x] 3.2 GREEN `adapters/memory`. Lane `after_sales`, key = movement id, same transaction. No Drizzle mock. No `outbox` path segment.
- [x] 3.3 RED on PGlite with `SET LOCAL` `app.tenant_id`. Tenant B hidden.
- [x] 3.4 GREEN `adapters/postgres/0002_stock_ledger.sql`: insert-only `stock_movements`, `stock_balances`, `negative_stock_alerts`, `stock_movement_outbox`, POS location. No backfill.
- [x] 3.5 RED the contract on single-tenant SQLite.
- [x] 3.6 GREEN repository in `adapters/sqlite`. Cruiser still blocks api-cloud from `adapters/sqlite` and allows local-node through the existing inventory sqlite folder. `shared/sync` stays absent.
- [x] 4.1 RED `contexts/orders/application/take-order/take-order.test.ts`: flag on, one call per line leaving `held`, `portions: 1`, after `send`, before `saveCheck`. Flag off skips. Missing recipe still saves.
- [x] 4.2 GREEN `take-order.ts` `saleConsumptionEnabled`. Entry port only. Later `fire` throws `EmptyOrder`.
- [x] 4.3 RED `contexts/orders/application/void-line/void-line.test.ts`: `sent` returns stored version; started states waste with reason and actor; `held` skips; flag off skips; never both.
- [x] 4.4 GREEN `void-line.ts`. Keep `sale.void-after-kitchen`. Audit via platform entry port.
- [x] 4.5 `apps/api-cloud/src/composition/application-module.ts`: Postgres ledger, flag, POS, generation, publisher. No SQLite.
- [x] 4.6 `apps/local-node/src/composition/application-module.ts`: SQLite ledger. No Postgres. `pnpm vitest run --project inventory` and `--project orders`.

## Unit 1 RED / GREEN evidence

Command (worktree `blackHole-p2-02`):

```text
pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts
```

RED (before `stock-ledger.ts` existed):

- Exit code: 1
- `FAIL contexts/inventory/domain/stock-ledger.test.ts`
- `Error: Cannot find module '#domain/stock-ledger.js'`
- Test Files: 1 failed (1)
- Tests: no tests

GREEN (after `stock-ledger.ts`):

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 4 passed (4)
- Duration: 194ms

## Unit 2 RED / GREEN evidence

Commands from `blackHole-p2-02`. Each RED ran before that slice's production file existed.

| Task | Command | RED | GREEN |
|---|---|---|---|
| 2.1 → 2.2 | `pnpm exec vitest run --project inventory contexts/inventory/application/register-sale-consumption/register-sale-consumption.test.ts` | Exit 1. `Cannot find module '#application/ports/operation-generation.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 10 passed. |
| 2.3 → 2.4 | `pnpm exec vitest run --project inventory contexts/inventory/application/return-stock/return-stock.test.ts` | Exit 1. `Cannot find module '#application/return-stock/return-stock.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 4 passed. |
| 2.5 → 2.6 | `pnpm exec vitest run --project inventory contexts/inventory/application/record-waste/record-waste.test.ts` | Exit 1. `Cannot find module '#application/record-waste/record-waste.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 4 passed. |
| 2.7 | `pnpm exec vitest run --project inventory contexts/inventory/application/record-waste/stock-movement-contract.test.ts` | Exit 1. `Cannot find module '.../shared/contracts/stock-movement.ts'`. Tests 1 failed. | Exit 0, included in the confirmation run below. |

Confirmation after Biome, on the final sources:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/register-sale-consumption/register-sale-consumption.test.ts contexts/inventory/application/return-stock/return-stock.test.ts contexts/inventory/application/record-waste/record-waste.test.ts contexts/inventory/application/record-waste/stock-movement-contract.test.ts
```

- Exit code: 0
- Test Files: 4 passed (4)
- Tests: 19 passed (19)

`pnpm exec tsc -b contexts/inventory shared/contracts` exited 0.

## Unit 3 RED / GREEN evidence

Commands from `blackHole-p2-02`. Each RED ran before that dialect's repository file existed.

| Task | Command | RED | GREEN |
|---|---|---|---|
| 3.1 → 3.2 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-stock-ledger-repository.contract.test.ts` | Exit 1. `Cannot find module '#adapters/memory/in-memory-stock-ledger-repository.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 4 passed. |
| 3.3 → 3.4 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.contract.test.ts` | Exit 1. `Cannot find module '#adapters/postgres/drizzle-stock-ledger-repository.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 7 passed. |
| 3.5 → 3.6 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.contract.test.ts` | Exit 1. `Cannot find module '#adapters/sqlite/drizzle-stock-ledger-repository.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 5 passed. |

Confirmation after Biome, on the final sources:

```text
pnpm exec vitest run --project inventory
```

- Exit code: 0
- Test Files: 18 passed (18)
- Tests: 67 passed (67)

`pnpm exec tsc -b contexts/inventory` exited 0.

The memory file gained two tests after the 4-test GREEN (queue idempotence and the point-of-sale directory). Those tests are in the 67.

## Unit 4 RED / GREEN evidence

Commands from `blackHole-p2-02`. RED ran before the production change for that use case. Existing assertions were not weakened.

| Task | Command | RED | GREEN |
|---|---|---|---|
| 4.1 → 4.2 | `pnpm exec vitest run --project orders contexts/orders/application/take-order/take-order.test.ts` | Exit 1. Sequence was `["send","save"]` instead of `["send","consume","consume","save"]`. Missing-recipe call count was 0. Test Files 1 failed. Tests 2 failed, 15 passed (17). | Exit 0. Test Files 1 passed. Tests 17 passed. |
| 4.3 → 4.4 | `pnpm exec vitest run --project orders contexts/orders/application/void-line/void-line.test.ts` | Exit 1. Return command was `[]`. A started line stayed `in_preparation`. Test Files 1 failed. Tests 2 failed, 11 passed (13). | Exit 0. Test Files 1 passed. Tests 13 passed. |

Confirmation after Biome, on the final sources:

```text
pnpm exec vitest run --project orders contexts/orders/application/take-order/take-order.test.ts
pnpm exec vitest run --project orders contexts/orders/application/void-line/void-line.test.ts
pnpm exec vitest run --project inventory
pnpm exec vitest run --project orders
```

- take-order: exit 0, 1 file, 17 tests
- void-line: exit 0, 1 file, 13 tests
- inventory: exit 0, 18 files, 67 tests
- orders: exit 0, 43 files, 226 tests

`RegisterSaleConsumption`, `ReturnStock`, `RecordWaste`, and the ledger adapter sources were not changed. Orders imports `@blackhole/inventory/application/entry-port` only.

## Work unit evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | Unit 1: `pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts` — exit 0, 1 file, 4 tests. Unit 2: the three use-case files plus the contract file, exit 0, 4 files, 19 tests. Unit 3: `pnpm exec vitest run --project inventory` — exit 0, 18 files, 67 tests. Unit 4: take-order exit 0, 17 tests; void-line exit 0, 13 tests; inventory exit 0, 18 files, 67 tests; orders exit 0, 43 files, 226 tests. |
| Runtime harness | Units 1 and 2: N/A. In-memory domain and port doubles only. Unit 3: PGlite applies `0001_recipe_catalog.sql` then `0002_stock_ledger.sql` and sets `SET LOCAL ROLE inventory_app` plus `set_config('app.tenant_id', ..., true)`. SQLite applies `0002_stock_ledger.sql` on `node:sqlite` `:memory:`. Both contract suites passed, including tenant B hidden and the failed third insert. Unit 4: in-memory check doubles and inventory port doubles. No browser. After Biome, `pnpm exec vitest run --project api-cloud apps/api-cloud/test/composition/bootstrap.test.ts` and the local-node bootstrap file each exited 0 with 3 tests. |
| Rollback boundary | Unit 4: remove the optional `SaleConsumption` argument from `TakeOrder` and the optional `SaleReversal` argument from `VoidLine`, the two new tests, the cloud `sale-consumption.ts` adapters, the node `stock-ledger.ts` helper, and the stock providers in both composition modules. Uncheck 4.1–4.6. Units 1–3 stay. The flag default is off, so leaving the providers in place without `saleConsumptionEnabled: true` does not call the ledger. |

## Files touched

### Unit 1 (unchanged by later units)

| File | Action |
|---|---|
| `contexts/inventory/domain/stock-ledger.test.ts` | Created |
| `contexts/inventory/domain/stock-ledger.ts` | Created |
| `contexts/inventory/domain/index.ts` | Re-exported `StockLedger`, `MOVEMENT_TYPE`, and the ledger errors. `InvalidQuantity` from the ledger is not re-exported. |

### Unit 2 (unchanged by unit 3)

| File | Action |
|---|---|
| `contexts/inventory/application/register-sale-consumption/register-sale-consumption.test.ts` | Created. ExplodeRecipe double. No catalog repository. |
| `contexts/inventory/application/register-sale-consumption/register-sale-consumption.ts` | Created |
| `contexts/inventory/application/return-stock/return-stock.test.ts` | Created |
| `contexts/inventory/application/return-stock/return-stock.ts` | Created. `LineReversalConflict`. |
| `contexts/inventory/application/record-waste/record-waste.test.ts` | Created |
| `contexts/inventory/application/record-waste/record-waste.ts` | Created. Audits `inventory.record-waste` through `@blackhole/platform/application/entry-port`. |
| `contexts/inventory/application/record-waste/stock-movement-contract.test.ts` | Created |
| `contexts/inventory/application/ports/stock-ledger-repository.ts` | Created |
| `contexts/inventory/application/ports/point-of-sale-directory.ts` | Created |
| `contexts/inventory/application/ports/operation-generation.ts` | Created |
| `contexts/inventory/application/ports/stock-alert-publisher.ts` | Created |
| `contexts/inventory/application/ports/stock-movement-queue.ts` | Created. Lane `after_sales`, key = movement id. |
| `contexts/inventory/application/ports/recipe-version.ts` | Created |
| `contexts/inventory/application/ports/reference-cost.ts` | Created |
| `contexts/inventory/application/entry-port.ts` | Exports `RegisterSaleConsumption`, `ReturnStock`, `RecordWaste`, and `LineReversalConflict` |
| `contexts/inventory/package.json` | Added `#application/register-sale-consumption/*`, `#application/return-stock/*`, `#application/record-waste/*` |
| `shared/contracts/stock-movement.ts` | Created. `stockMoved` / `StockMoved`, `negativeStockOpened` / `NegativeStockOpened` |
| `shared/contracts/index.ts` | Re-exports those schemas and types |
| `shared/contracts/tsconfig.json` | Includes `stock-movement.ts` |

### Unit 3

| File | Action |
|---|---|
| `contexts/inventory/application/ports/stock-ledger-repository.contract.ts` | Created. Shared contract: balance −200 g, duplicate line rejected, other tenant hidden, failed third insert rolls back movements, balance, alert, and the queued row. |
| `contexts/inventory/adapters/memory/in-memory-stock-ledger-repository.ts` | Created. Snapshot transaction. Lane `after_sales`, key = movement id. Also the in-memory queue and point-of-sale directory. |
| `contexts/inventory/adapters/memory/in-memory-stock-ledger-repository.contract.test.ts` | Created |
| `contexts/inventory/adapters/postgres/0002_stock_ledger.sql` | Created. Insert-only `stock_movements`, balances, alerts, `stock_movement_outbox`, `point_of_sale_locations`. Forced RLS. No backfill. |
| `contexts/inventory/adapters/postgres/schema.ts` | Added the ledger tables. |
| `contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.ts` | Created. `SET LOCAL ROLE inventory_app` and `set_config('app.tenant_id', ..., true)`. |
| `contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.contract.test.ts` | Created. PGlite. Tenant B hidden without a SQL tenant filter. Update rejected. |
| `contexts/inventory/adapters/sqlite/0002_stock_ledger.sql` | Created. Same tables. Update and delete triggers keep movements insert-only. |
| `contexts/inventory/adapters/sqlite/schema.ts` | Added the ledger tables. |
| `contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.ts` | Created beside the recipe-copy repository. |
| `contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.contract.test.ts` | Created |
| `contexts/inventory/package.json` | Exported the three ledger repositories the same way the recipe repositories are exported. |
| `openspec/changes/p2-02-sale-consumption/tasks.md` | Checked 3.1–3.6. Kept 1.x and 2.x checked. |

### Unit 4

| File | Action |
|---|---|
| `contexts/orders/application/take-order/take-order.test.ts` | Flag on: one `RegisterSaleConsumption` per line that was `held`, `portions: 1`, sequence `send`, consume, consume, `save`. Flag off skips. `missingRecipe: true` still saves. A later fire throws `EmptyOrder`. |
| `contexts/orders/application/take-order/take-order.ts` | Optional `SaleConsumption`. `fire` captures held lines, calls `check.send`, then one entry-port call per captured line, then the existing `saveCheck`. |
| `contexts/orders/application/void-line/void-line.test.ts` | `sent` calls `ReturnStock` only. Started states detach, require `sale.void-after-kitchen`, and call `RecordWaste` with reason and actor. `held` and flag off skip both ports. |
| `contexts/orders/application/void-line/void-line.ts` | Optional `SaleReversal`. After-start void runs only when the flag is on. Audit stays on the platform entry port. |
| `contexts/orders/package.json` | Depends on `@blackhole/inventory` so orders can import the entry port. |
| `contexts/inventory/package.json` | Exported the stock ports so composition can import them under NodeNext. Use cases and ledger adapters were not edited. |
| `apps/api-cloud/src/composition/sale-consumption.ts` | Created. Catalog version reader, catalog reference-cost list, venue-operation generation, stored alert publisher. |
| `apps/api-cloud/src/composition/application-module.ts` | Postgres ledger when `inventoryDatabase` is set; otherwise the existing in-memory fallback. Flag defaults to false. No SQLite import. |
| `apps/api-cloud/test/composition/bootstrap.test.ts` | Provider snapshot includes the stock ports and the three use cases. |
| `apps/local-node/src/composition/stock-ledger.ts` | Created. Builds the SQLite ledger, POS directory, and movement queue. |
| `apps/local-node/src/composition/application-module.ts` | Registers those three ports. No Postgres import. Class providers stay empty. |
| `apps/local-node/src/composition/create-application.ts` | Optional `stock` dependency. |
| `openspec/changes/p2-02-sale-consumption/tasks.md` | Checked 4.1–4.6. Left 1.1–3.6 checked. |

## Deviations

- `ExplodeRecipe` returns `{ ingredientId, quantity }` and does not return the recipe version or the reference cost. `RegisterSaleConsumption` therefore also depends on `RecipeVersionReader` and `ReferenceCostList`. The register test doubles `ExplodeRecipe` and does not call the catalog repository. `ReturnStock` and `RecordWaste` copy the version and unit cost stored on the consumption lines.
- Enqueue is `StockMovementQueue` under `application/ports`. There is no `outbox` path segment and no `shared/sync`. The use case calls append, alert publish, and enqueue in sequence. `append` writes the queued `StockMoved` row in the same transaction as the movements, balance, and alert. `enqueue` is idempotent on tenant and movement id, so the use case's later call does not insert a second row. `RegisterSaleConsumption`, `ReturnStock`, and `RecordWaste` were not changed.
- `RecordAuditEvent` requires `deviceId` and `authorizerId`. The waste command adds `actorId` and `reason` only, so the audit uses `authorizerId: null` and `deviceId` equal to `venueId`.
- A waste line repeats the stored negative quantity. After a −300 g consumption, waste leaves the balance at −600 g. The domain rejects a positive waste quantity, and the line must not also get a sale return. This is a second deduction. Unit 3 stores that signed quantity and does not treat waste as a restore.
- `LineReversalConflict.unitCost` is the consumption line's stored unit cost. The conflicting reversal row is not the source of that number.
- The contract test loads `shared/contracts/stock-movement.ts` by file URL. `@blackhole/inventory` does not depend on `@blackhole/contracts`. The domain ledger does not import Zod.
- The database unique key is `(tenant_id, order_line_id, role, ingredient_id)`. The triple alone cannot be unique: one order line explodes to many ingredients, and `findLine` returns that array. The ingredient keeps each exploded line unique. A retry with a new movement id and the same triple plus ingredient is rejected, and the balance stays.
- The shared contract opens a subject `{ repository, failOnInsert, queued }` instead of the repository alone. The port has no failure seam and no queue read. `failOnInsert` lives on the concrete repository. The recipe catalog factory still returns only the repository.
- Postgres `0002` does not create `inventory_app`. The PGlite test applies `0001_recipe_catalog.sql` first. SQLite `0002` stands alone. Movements reject update and delete: Postgres grants `inventory_app` select and insert only, with no update or delete policy; SQLite uses before-update and before-delete triggers.
- The point-of-sale store is `point_of_sale_locations` (`tenant_id`, `venue_id`, `location_id`). `locationOf` reads it. `remember` on the concrete directory seeds a row. There is no second location model.
- A `position` column orders movements and queued rows. It is not part of the port. The repository stores the signed scaled integer it receives and does not multiply by 1000 again.
- No `prepareStockLedgerDatabase` helper. The contract tests execute the SQL, matching the postgres recipe catalog test. `sqliteStockLedger` does not apply `0002_stock_ledger.sql`. The caller migrates.
- `.dependency-cruiser.cjs` and `tools/skeleton` were not edited. The existing rule already allows `contexts/inventory/adapters/sqlite` and blocks `api-cloud` from `adapters/sqlite`.
- After-kitchen void runs only when `saleConsumptionEnabled` is true. Flag off keeps the previous check: states after start return unchanged and the existing void-line test still passes. The flag is the rollback switch.
- `TakeOrder.execute` (immediate send) does not consume stock. Only `fire` of lines that were `held`.
- `generation` is read from `VenueOperationRepository` in composition and passed into the inventory command. `FireCourseInput`, `VoidLineInput`, and the HTTP send were not given a generation field. A missing venue operation throws `StaleGeneration` before `saveCheck`.
- `saleConsumptionEnabled` defaults to false in api-cloud. Stock is not consumed until the dependency is set to true.
- When `inventoryDatabase` is absent, the cloud module uses the in-memory stock ledger, POS directory, and queue, the same fallback already used for the recipe catalog. Postgres drizzle is used only when that database is passed. No second database is opened. api-cloud does not import SQLite.
- `StoredStockAlertPublisher.publish` is a no-op. The ledger already stores the open alert. `RealtimeNotice` has no stock kind.
- Reference cost scans the tenant's brands because `ReferenceCostList.costOf` has no `brandId`. The first brand that contains the ingredient wins.
- The recipe version reader returns the catalog's current published version when that version contains the product and, when a variant was sent, the first variant. It does not explode the recipe.
- local-node registers the SQLite ledger, POS directory, and movement queue. It does not construct `TakeOrder`, `VoidLine`, or the three inventory use cases. The node has recipe copies, not the catalog `ExplodeRecipe` needs. local-node does not import Postgres.
- Void return and waste `occurredAt` is wall-clock ISO. The orders clock is not used for that timestamp.
- After-kitchen permission value is `line.price`. Before-kitchen stays `1`.
- Orders depends on `@blackhole/inventory` only to import `application/entry-port`. Inventory use cases and ledger adapter sources were not edited. Port exports were added so the apps can import the ports under NodeNext.

## Verify

Ready for `sdd-verify`. Verify was not run. The change was not archived.

## Verify remediation: proposal rollback

Disabling `saleConsumptionEnabled` no longer returns the original check for a line past `sent`. `VoidLine` still authorizes, detaches, saves, and audits. `reverseConsumption` still skips the ledger when the flag is off or the line is `held`. A `sent` line still leaves without `ReturnStock`. A started line uses `sale.void-after-kitchen`, the line price, and the platform audit, and does not call `RecordWaste`. Flag on keeps the return-versus-waste split. The earlier note that after-kitchen void runs only when the flag is on is corrected here. Waste quantity is unchanged (−600 g balance stays).

The flag-off test now expects the started line to leave the check, both inventory arrays to stay empty, and the after-kitchen permission path to run. The within-cap started-line case in the same file no longer treats that void as a no-op.

RED, before the early return was removed:

```text
pnpm exec vitest run --project orders contexts/orders/application/void-line/void-line.test.ts
```

- Exit code: 1
- Failing assertion: `expected 'in_preparation' to be null`, received `"in_preparation"`, on the started line with the flag off
- Test Files: 1 failed (1)
- Tests: 2 failed, 11 passed (13)

GREEN, after the early return was removed:

- Same command, exit code 0
- Test Files: 1 passed (1)
- Tests: 13 passed (13)

```text
pnpm exec vitest run --project orders
```

- Exit code: 0
- Test Files: 43 passed (43)
- Tests: 226 passed (226)

`TakeOrder`, inventory use cases, adapters, SQL, and composition were not edited. `shared/sync`, the 300-movement drain, cloud apply, and node `TakeOrder` wiring remain deferred. No new tasks were checked. Verify was not set to pass.

| Evidence | Value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project orders contexts/orders/application/void-line/void-line.test.ts` — RED exit 1, 2 failed, 11 passed (13); GREEN exit 0, 1 file, 13 passed. Then `pnpm exec vitest run --project orders` — exit 0, 43 files, 226 passed. |
| Runtime harness | N/A. In-memory check and inventory port doubles only. No browser and no HTTP entry. |
| Rollback boundary | Restore the early return in `contexts/orders/application/void-line/void-line.ts` and the two started-line expectations in `void-line.test.ts`. |

## Balance fix: waste does not deduct twice

Void-after-start still appends a waste line with the stored version-4 quantity, unit cost, reason, and actor. `StockMoved` still carries that quantity. The line sets `reversesMovementId` to the sale consumption. `onHandDelta` posts 0 for that waste because the consumption already deducted the ingredient, so on-hand stays at −300 g and there is no `sale_return`. The consumption row is not updated or deleted. Standalone waste still reduces on-hand. The waste test publishes recipe version 5 before recording waste and still stores the version-4 quantities. RecordWaste does not re-explode.

RED, after the balance expectation changed and before the ledger rule: exit 1. Expected −300000, received −600000. Test Files 1 failed. Tests 1 failed, 3 passed (4).

GREEN: `pnpm exec vitest run --project inventory contexts/inventory/application/record-waste/record-waste.test.ts` exit 0, 1 file, 4 passed. `pnpm exec vitest run --project orders contexts/orders/application/void-line/void-line.test.ts` exit 0, 1 file, 13 passed. Verify stays fail.

Re-verify on 2026-11-13 stayed FAIL: 21/25 scenarios, four hybrid and upward-sync scenarios untested. `pnpm exec biome check --write` then sorted `MOVEMENT_TYPE`, `MovementType`, and `onHandDelta` in the Postgres and SQLite ledger repositories. That does not change the verdict.
