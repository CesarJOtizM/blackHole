# Apply progress: p2-04-production

Tasks 1.3, 1.4, 1.5, and 1.6 only. Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. `openspec/config.yaml` still requires the failing test first, so each pair ran RED then GREEN.

Delivery: chain strategy `feature-branch-chain`. Decision needed before apply: No. No branch was created. Not committed. Not pushed. No pull request.

Previous apply-progress: none.

Tasks 1.1 and 1.2 stay open. `contexts/inventory/domain/stock-ledger.ts` and `stock-ledger.test.ts` were not edited.

## Completed tasks

- [x] 1.3 RED `contexts/inventory/domain/production.test.ts`: `floor(line * expected / outputQuantity)`. Variance actual − expected (−400 at 4600). Actual 0 has no output. Costs 6 and 5. Compensate once.
- [x] 1.4 GREEN `contexts/inventory/domain/production.ts`: run, variance, `consumed_average` or `standard`, compensate. Export `contexts/inventory/domain/index.ts`.
- [x] 1.5 RED `contexts/inventory/domain/recipe-catalog.test.ts`: `explodePreparation` keeps a stocked child collapsed on the id `explode` returns. Non-stocked children expand. Require `outputQuantity`.
- [x] 1.6 GREEN `contexts/inventory/domain/recipe-catalog.ts`: `outputQuantity` and `explodePreparation`. Leave product `explode`.

## Work unit evidence

Slice of work unit 1 (Domain). Assigned tasks 1.3–1.6. Tasks 1.1 and 1.2 remain for the ledger agent.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/production.test.ts contexts/inventory/domain/recipe-catalog.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  20 passed (20)`. Same result after `pnpm exec biome check --write` on the domain files touched here. |
| Runtime harness command/scenario and exact result | N/A. Pure domain. `ProductionRun` and `RecipeCatalog.explodePreparation` do not open files, sockets, or a database. |
| Rollback boundary | `contexts/inventory/domain/production.ts`, `contexts/inventory/domain/production.test.ts`, the `outputQuantity` / `explodePreparation` / `MissingOutputQuantity` edits in `contexts/inventory/domain/recipe-catalog.ts` and `recipe-catalog.test.ts`, and the production plus `MissingOutputQuantity` exports in `contexts/inventory/domain/index.ts`. Reverting those removes this slice. Leave other index exports (`operational-waste`, `producible-quantity`, `purchasing`, `stock-count`, `nextAverageCost`) in place. `stock-ledger.ts` and `stock-ledger.test.ts` stay. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.3 → 1.4 | `pnpm exec vitest run --project inventory contexts/inventory/domain/production.test.ts` exit 1. `FAIL contexts/inventory/domain/production.test.ts` — `Cannot find module '#domain/production.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `production.ts` and the `domain/index.ts` exports: exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |
| 1.5 → 1.6 | `pnpm exec vitest run --project inventory contexts/inventory/domain/recipe-catalog.test.ts` exit 1. `Test Files  1 failed (1)`. `Tests  2 failed \| 10 passed (12)`. `catalog.explodePreparation is not a function`. `outputQuantity` 0 did not throw. The missing-output case called `toThrow(MissingOutputQuantity)` before that class existed; the loader left the binding undefined, so that one assertion accepted any throw. The two failures above are the RED signal. | `pnpm exec vitest run --project inventory contexts/inventory/domain/production.test.ts contexts/inventory/domain/recipe-catalog.test.ts` after `outputQuantity` and `explodePreparation`: exit 0. `Test Files  2 passed (2)`. `Tests  20 passed (20)`. Repeated after Biome: exit 0, same counts. |

### Production rules

- Consumption of each line is `floor(line * expectedQuantity / outputQuantity)`. A line of 100, output 3, expected 2 consumes −66. A zero scaled line writes no movement.
- Variance is `actualQuantity - expectedQuantity`. Expected 5000 and actual 4600 store −400. Consumption still follows the expected batch (tomato −6000, onion −500). Output quantity is the actual 4600 and its ingredient id is the recipe id.
- Actual 0 consumes the ingredients, writes no `production_output`, sets `outputUnitCost` to null, and stores variance −5000.
- `consumed_average` values output with half-up `floor((sum(abs(quantity) * unitCost) + floor(actual / 2)) / actual)`. 12000 + 12000 over 4000 g is 6. 5 COP over 2 g is 3.
- `standard` uses `standardUnitCost` on the output. 5 COP/g stays 5. Consumption keeps each line's unit cost. A standard rule without `standardUnitCost` throws `InvalidProduction`.
- `compensate` appends the opposite sign once, same movement type, `reversesMovementId` pointing at the original. A second compensate throws `ProductionAlreadyCompensated`. Original rows stay.

### Recipe rules

- `outputQuantity` is optional on `upsertRecipe` so existing product recipes and callers stay valid. A positive whole number is stored scaled by `QUANTITY_SCALE`. Zero throws `InvalidQuantity`.
- `explodePreparation` requires a stored `outputQuantity` and throws `MissingOutputQuantity` when it is absent. It starts at that recipe id. A stocked child stays collapsed on the recipe id `explode` already returns. A non-stocked child expands to its ingredients. Product `explode` is unchanged.

### Deviations

`outputQuantity` is not required on every `upsertRecipe`. Requiring it would reject the existing product recipes and the application upsert path, which this slice must not edit. Production of a recipe without it is rejected at `explodePreparation`.

### Left open

- Phases 2–5 (use cases, persistence, HTTP, screens).

`state.yaml` is `status: applying` and `apply: partial`.

## Tasks 1.1 and 1.2

Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing assertions were written and run before `production_consumption` and `production_output` became writable.

- [x] 1.1 RED signs, positive `production_output` replays `nextAverageCost`, purchase 10 then 14 stays 12, second reverse throws, `reverse` stays sale-only. No new movement types.
- [x] 1.2 GREEN writable signs on `stock-ledger.ts`. `nextAverageCost` and `roundHalfUp` unchanged.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/transfer.test.ts contexts/inventory/domain/production.test.ts`. RED exit code **1** (`Test Files  1 failed \| 2 passed (3)`, `Tests  3 failed \| 31 passed (34)`, `MovementTypeNotWritable` for both production types). GREEN exit code **0** (`Test Files  3 passed (3)`, `Tests  34 passed (34)`). |
| Runtime harness command/scenario and exact result | N/A. Domain ledger only. `ProductionRun` was not opened or edited. |
| Rollback boundary | Revert the production arms in `contexts/inventory/domain/stock-ledger.ts` and the production cases in `stock-ledger.test.ts`. Leave `production.ts`, `production.test.ts`, and `domain/index.ts` in place. |

`production_consumption` must be negative and `production_output` positive. The other sign throws `InvalidQuantity`. A positive output replays `nextAverageCost`: 10 g at 10 plus 5 g at 12 is 11. Consumption of 1 g leaves the average at 10. Purchase of 10 then 14 stays 12. A second `reverse` of a sale throws `MovementAlreadyReversed`. `reverse` of a purchase throws the same error and appends nothing.

### Deviations

The design's removal half-up formula was not added. The orchestrator kept one formula. The average update set is `purchase`, `transfer_in`, and positive `production_output`. Task 1.2's "purchase and positive output only" does not drop `transfer_in`. `production.ts` and `domain/index.ts` were not edited. `state.yaml` stays `applying` and `apply: partial`.

## Tasks 2.1 and 2.2

Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing test was written and run before `RecordProduction` existed. Tasks 1.1–1.6 stay checked. `stock-ledger.ts`, `stock-ledger.test.ts`, and `production.ts` were not edited.

### RED

| Task | RED (command and result) |
|---|---|
| 2.1 | `pnpm exec vitest run --project inventory contexts/inventory/application/record-production/record-production.test.ts` exit **1**. `FAIL contexts/inventory/application/record-production/record-production.test.ts`. `Missing "#application/record-production/record-production.js" specifier in "@blackhole/inventory" package`. `Test Files  1 failed (1)`. `Tests  no tests`. The import key is added only with the GREEN export, so the suite cannot load yet. |

### GREEN

| Task | GREEN |
|---|---|
| 2.1 → 2.2 | Same command after `record-production.ts`, `ports/production-repository.ts`, the `entry-port.ts` export, and `#application/record-production/*`: exit **0**. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. Same result after `pnpm exec biome check` on those files. |

## Work unit evidence

Slice of work unit 2 (Use cases). Assigned tasks 2.1 and 2.2 only. Tasks 2.3–2.6 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/record-production/record-production.test.ts`. RED exit **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#application/record-production/*`). GREEN exit **0** (`Test Files  1 passed (1)`, `Tests  10 passed (10)`). |
| Runtime harness command/scenario and exact result | N/A. The use case only calls ports. This slice has no HTTP listener, database, or screen. Persistence is task 3. |
| Rollback boundary | `contexts/inventory/application/record-production/`, `contexts/inventory/application/ports/production-repository.ts`, the `RecordProduction` exports in `contexts/inventory/application/entry-port.ts`, and the `#application/record-production/*` import in `contexts/inventory/package.json`. Leave every other import key and export. Do not revert domain files. |

### Recorded behavior

- The output ingredient id is the recipe id `explode` already returns for the stocked preparation.
- Movements store `catalog.currentVersion`. A version 1 recipe is not used after version 2 is current.
- A preparation is rejected unless the current published version has a stocked line pointing at it. No movement and no audit.
- The same `runId` returns the stored run. It does not append or audit again.
- Actual 0 consumes the ingredients and writes no `production_output`. Variance is actual minus expected: −400 at 4600 g, and −5000 when the batch is burned.
- Both movement types leave in one `ProductionRepository.append`. `orderLineId` and `role` are null. `reference` is the `runId`. `StockLedgerRepository.append` is not called, so nothing is queued for `after_sales`.
- A short ingredient still posts. Its balance goes negative and one `NegativeStockOpened` alert is part of that append.
- The cost policy is `consumed_average` or `standard`, read from the production port. Output unit cost is 6 or 5. A positive output is the quantity the existing `nextAverageCost` replays. Consumption leaves the input average. The purchase formula was not edited.
- The run is audited as `inventory.record-production`. Compensation is not implemented.

### Deviations

Stock quantities use `QUANTITY_SCALE`, as purchases do. `ProductionRun` receives gram quantities so variance stays in grams and the output cost stays 6 COP/g. The port scales the movement quantities. `nextAverageCost` is unchanged.

A missing cost policy, an unknown location, or a venue without a brand is rejected before any append. The permission check stays with the HTTP task.

The production port interface is `application/ports/production-repository.ts`. Memory and Postgres adapters remain tasks 3.1–3.4.

`state.yaml` stays `status: applying` and `apply: partial`.

### Left open

- Tasks 2.3–2.6 and phases 3–5.

## Tasks 2.3–2.6

Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing test was written and run before `CorrectProduction` existed. Tasks 1.1–1.6, 2.1, and 2.2 stay checked. `stock-ledger.ts`, `production.ts`, and `record-production.ts` were not edited.

### RED

| Task | RED (command and result) |
|---|---|
| 2.3 | `pnpm exec vitest run --project inventory contexts/inventory/application/correct-production/correct-production.test.ts` exit **1**. `FAIL contexts/inventory/application/correct-production/correct-production.test.ts`. `Missing "#application/correct-production/correct-production.js" specifier in "@blackhole/inventory" package`. `Test Files  1 failed (1)`. `Tests  no tests`. The import key is added only with the later exports, so the suite cannot load yet. |
| 2.5 | `pnpm exec vitest run --project inventory contexts/inventory/application/configure-production-cost/configure-production-cost.test.ts` exit **1**. `FAIL contexts/inventory/application/configure-production-cost/configure-production-cost.test.ts`. `Missing "#application/configure-production-cost/configure-production-cost.js" specifier in "@blackhole/inventory" package`. `Test Files  1 failed (1)`. `Tests  no tests`. |

### GREEN

| Task | GREEN |
|---|---|
| 2.3 → 2.4 and 2.5 → 2.6 | `pnpm exec vitest run --project inventory contexts/inventory/application/correct-production/correct-production.test.ts contexts/inventory/application/configure-production-cost/configure-production-cost.test.ts contexts/inventory/application/record-production/record-production.test.ts` exit **0**. `Test Files  3 passed (3)`. `Tests  24 passed (24)`. Same result after `pnpm exec biome check --write` on the use-case files and `production-repository.ts`. |

## Work unit evidence

Slice of work unit 2 (Use cases). Assigned tasks 2.3–2.6. Tasks 1.1–1.6, 2.1, and 2.2 stay checked. Phases 3–5 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED 2.3 exit **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#application/correct-production/*`). RED 2.5 exit **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#application/configure-production-cost/*`). GREEN exit **0** (`Test Files  3 passed (3)`, `Tests  24 passed (24)`), including the existing record-production suite. |
| Runtime harness command/scenario and exact result | N/A. Both use cases only call ports. This slice has no HTTP listener, database, or screen. Persistence is phase 3. |
| Rollback boundary | `contexts/inventory/application/correct-production/`, `contexts/inventory/application/configure-production-cost/`, the compensation and cost-policy additions on `contexts/inventory/application/ports/production-repository.ts`, the `CorrectProduction` and `ConfigureProductionCost` exports in `contexts/inventory/application/entry-port.ts`, and the two new `#application/...` import keys in `contexts/inventory/package.json`. Leave every other import key and export. Do not revert `record-production` or domain files. |

### Corrected behavior

- `inventory.adjust` compensates once. A kitchen chief with no authorization writes nothing: no compensation, no audit, no balance change, and the original movements stay.
- A consumed `ConsumeAuthorization` for `inventory.adjust` lets the chief compensate. A rejected authorization writes nothing.
- Compensation appends the opposite sign and `reversesMovementId`. `append` is not called, so the original rows are not edited or deleted. A second compensation throws `ProductionAlreadyCompensated` and adds nothing.
- A burned batch (actual 0) still has no `production_output`. Its compensation also writes no output. `nextAverageCost` is not called and the preparation average stays.
- `orderLineId` and `role` stay null. Nothing is queued for `after_sales`.
- The company cost rule is `consumed_average` or `standard`, with `standardUnitCost` per preparation. Setting it requires `recipe.edit`. A chief's attempt saves nothing.

### Deviations

`ProductionRun` has no loader for stored movements, and `production.ts` was not edited. `CorrectProduction` replays `ProductionRun.record` from the stored consumption, then `compensate`, so the opposite rows keep the original movement ids.

A chief is rejected with `ProductionCorrectionDenied` before any write. Stock, the original run, and the audit stay unchanged.

`findCompensation`, `appendCompensation`, and `saveCostPolicy` are concrete defaults on the existing port. Previous methods stay. A repository that does not override them does not store a compensation or a cost policy. Memory and Postgres adapters remain tasks 3.1–3.4.

`state.yaml` stays `status: applying` and `apply: partial`.

### Left open

- Phases 3–5 (persistence, HTTP, screens).

## Tasks 3.1–3.5

Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing contract was written and run before either adapter existed. Tasks 1.1–2.6 stay checked. Domain, use cases, `entry-port.ts`, `package.json`, and `drizzle-stock-ledger-repository.ts` were not edited.

### RED

| Task | RED (command and result) |
|---|---|
| 3.1 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-production-repository.contract.test.ts` exit **1**. `Cannot find module '#adapters/memory/in-memory-production-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. |
| 3.3 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-production-repository.contract.test.ts` exit **1**. `Cannot find module '#adapters/postgres/drizzle-production-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. |

### GREEN

| Task | GREEN |
|---|---|
| 3.1 → 3.2 | Same memory command after `in-memory-production-repository.ts`: exit **0**. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |
| 3.3 → 3.5 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-production-repository.contract.test.ts contexts/inventory/adapters/postgres/drizzle-production-repository.contract.test.ts` after `0006_production.sql`, both schemas, and `drizzle-production-repository.ts`: exit **0**. `Test Files  2 passed (2)`. `Tests  9 passed (9)`. Same result after `pnpm exec biome check --write` on the files touched here. |

## Work unit evidence

Slice of work unit 3 (Persistence). Assigned tasks 3.1–3.5. Phases 4 and 5 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED memory exit **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#adapters/memory/in-memory-production-repository.js`). RED PGlite exit **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#adapters/postgres/drizzle-production-repository.js`). GREEN exit **0** (`Test Files  2 passed (2)`, `Tests  9 passed (9)`) after Biome. |
| Runtime harness command/scenario and exact result | PGlite applies `0001_recipe_catalog.sql`, `0002_stock_ledger.sql`, `0003_purchasing.sql`, and `0006_production.sql`, then `SET LOCAL ROLE inventory_app` and `set_config('app.tenant_id', tenantId, true)`. No HTTP listener. Recipe catalog contract and sqlite recipe-copy contract still pass after `output_quantity`: `Test Files  2 passed (2)`, `Tests  6 passed (6)`. |
| Rollback boundary | `contexts/inventory/application/ports/production-repository.contract.ts`, `contexts/inventory/adapters/memory/in-memory-production-repository.ts`, `contexts/inventory/adapters/memory/in-memory-production-repository.contract.test.ts`, `contexts/inventory/adapters/postgres/drizzle-production-repository.ts`, `contexts/inventory/adapters/postgres/drizzle-production-repository.contract.test.ts`, `contexts/inventory/adapters/postgres/0006_production.sql`, the production tables and `output_quantity` columns in both `schema.ts` files, the `0006` exec in `drizzle-recipe-catalog-repository.contract.test.ts`, and the nullable `output_quantity` alter in `drizzle-recipe-copy-repository.ts` plus its contract test. Leave domain, use cases, and purchasing files in place. |

### Stored behavior

- One append writes the run, movements, balances, and alerts in one transaction. The same `runId` does not append again.
- Tomato 10000 g at 4 and onion 1000 g at 5, after consumption, are 4000 g at 4 and 500 g at 5. Sauce already at 4600 g and cost 0, plus 4600 g at 6, is 9200 g at average 3 (`nextAverageCost`).
- Tenant B cannot see the run, the movements, the balance, the alert, or the cost policy.
- `failOnInsert(3)` throws on the output movement. The failed run, its consumption, its balance change, and its alert are gone. The earlier run stays. `after_sales` stays empty. The memory adapter never enqueues that lane, and Postgres does not insert `stock_movement_outbox`.
- Compensation appends the opposite movements with `reversesMovementId` and does not edit the original run. A negative output does not call `nextAverageCost`, so the sauce average stays 3 and the balance returns to 4600 g.
- `saveCostPolicy` stores `standard` and 5 COP for the preparation. Another preparation on that policy has a null standard cost.
- `0006_production.sql` adds `production_runs`, `production_cost_policies`, `preparation_standard_costs`, and nullable `output_quantity` on `recipes` and `recipe_versions`. It does not insert stock movements. `0004` and `0005` were not created.

### Deviations

`output_quantity` is nullable. Requiring it would reject recipes already stored by the catalog. Production still rejects a missing quantity in `explodePreparation`.

The catalog contract now applies `0006_production.sql` because `recipe_versions` is selected in full and the new column must exist. `prepareRecipeCopyDatabase` adds the same nullable column when a sqlite copy is opened, including a database created before this column. That is the schema read path, not a local production repository. No local-node file was edited.

`state.yaml` stays `status: applying` and `apply: partial`.

### Left open

- Phases 4–5 (HTTP and screens).

## Tasks 4.1–4.3

Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing HTTP test was written and run before `production.controller.ts` existed. Tasks 1.1–3.5 stay checked. Screens 5.1 and 5.2 stay open. `state.yaml` stays `status: applying` and `apply: partial`.

### RED

| Task | RED (command and result) |
|---|---|
| 4.2 | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/production.controller.test.ts` exit **1**. `FAIL \|api-cloud\| test/http/production.controller.test.ts`. `Cannot find module '#src/http/production.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. |

### GREEN

| Task | GREEN |
|---|---|
| 4.2 → 4.3 | Same command after `production.controller.ts`, `productionEnabled` in `application-module.ts`, and Biome: exit **0**. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |

## Work unit evidence

Slice of work unit 4 (HTTP). Assigned tasks 4.1–4.3. Phase 5 stays open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED exit **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#src/http/production.controller.js`). GREEN exit **0** (`Test Files  1 passed (1)`, `Tests  6 passed (6)`) after Biome. `pnpm exec vitest run --project platform contexts/platform/domain/permission-catalog.test.ts` exit **0**. `Test Files  1 passed (1)`. `Tests  447 passed (447)`. |
| Runtime harness command/scenario and exact result | Fastify `inject` on the Nest app. `server.listening` is false. Flag off returns 404 and `ProductionController` is not registered. Waiter `POST` is 403 `ProductionRecordDenied`. A kitchen chief records 4600 g of a 5000 g batch and the body omits `variance` and `outputUnitCost`. An administrator with `inventory.view-cost` sees variance −400 and `outputUnitCost` 0; the second post of the same `runId` returns the same body. Sale columns `order_line_id` and `role` stay null. `DrizzleStockLedgerRepository.queued` is empty. An extra field is 400. A chief correction is 403 `ProductionCorrectionDenied`. An owner correction is 200 and still queues nothing. |
| Rollback boundary | `shared/contracts/production.ts`, the production export in `shared/contracts/index.ts`, the appended `inventory.record-production` row in `contexts/platform/domain/permission-catalog.ts` and its expected cell in `permission-catalog.test.ts`, `apps/api-cloud/test/http/production.controller.test.ts`, `apps/api-cloud/src/http/production.controller.ts`, the `productionEnabled` / `openProduction` wiring in `apps/api-cloud/src/composition/application-module.ts`, and the two `@blackhole/inventory` export lines for `production-repository` and `drizzle-production-repository`. Leave purchasing, inventory-report, and transfer registration in place. |

### HTTP behavior

- `productionEnabled` false skips the controller. The route is 404. Nothing listens.
- `productionEnabled` true without PostgreSQL throws `Production requires PostgreSQL.` The adapter is `DrizzleProductionRepository` only.
- Record requires `inventory.record-production`. Correct requires `inventory.adjust` or a consumed authorization inside `CorrectProduction`. Policy requires `recipe.edit` inside `ConfigureProductionCost`.
- Variance and `outputUnitCost` are omitted unless the session has `inventory.view-cost`.
- Strict Zod rejects an extra field with 400. No movement is written.
- The same `runId` does not append again. `after_sales` stays empty.

### Deviations

`inventory.record-production` is not in the PRD role table. The new matrix row matches receive-purchase: owner, general manager, site administrator, kitchen chief, and warehouse keeper. Waiter, cashier, and shift supervisor stay denied. The expected matrix in `permission-catalog.test.ts` gained that one appended row so the catalog test still typechecks.

`UpdateRecipeCatalog` does not pass `outputQuantity`. The HTTP test publishes the sauce through `RecipeCatalog` and the in-memory catalog repository. The entry port was not edited.

`contexts/inventory/package.json` gained two export lines, `./application/ports/production-repository` and `./adapters/postgres/drizzle-production-repository`. Without them `api-cloud` cannot import the Postgres adapter. No import key was removed. `entry-port.ts`, `schema.ts`, and the SQL files were not edited.

The HTTP database applies `0003_purchasing.sql` as well as `0001`, `0002`, and `0006`. `0003` adds `stock_balances.average_cost` and makes the sale columns nullable. The production repository reads that column. `0003` was not edited.

### Left open

- Tasks 5.1 and 5.2 (admin and venue screens).

## Tasks 5.1 and 5.2

Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing screen tests were written and run before `ProductionScreen` existed and before the kitchen posted a run. Tasks 1.1–4.3 stay checked. `state.yaml` stays `status: applying` and `apply: partial`. No branch, no commit, no pull request.

Chain strategy: `feature-branch-chain`. This batch is work unit 5 (screens), the slice after HTTP. Decision needed before apply: No.

### RED

| Task | RED (command and result) |
|---|---|
| 5.1 | `pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/production-screen.test.tsx` exit **1**. `Test Files  1 failed (1)`. `Tests  6 failed (6)`. `Element type is invalid ... got: undefined` because `ProductionScreen` was not exported. |
| 5.2 | `pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/kitchen/kitchen-production.test.tsx` exit **1**. `Test Files  1 failed (1)`. `Tests  5 failed (5)`. The kitchen still showed `Cocina` and two `Listo` buttons. `Registrar producción` and `Ubicación` were absent. |

### GREEN

| Task | GREEN |
|---|---|
| 5.1 | Same admin command after `ProductionScreen`: exit **0**. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. Same counts after `pnpm exec biome check --write` on the four owned files. |
| 5.2 | Same venue command after the kitchen POST: exit **0**. `Test Files  1 passed (1)`. `Tests  5 passed (5)`. Same counts after that Biome write. |

## Work unit evidence

Slice of work unit 5 (Screens). Assigned tasks 5.1 and 5.2. Tasks 1.1–4.3 stay checked.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED admin exit **1** (`Test Files  1 failed (1)`, `Tests  6 failed (6)`, `ProductionScreen` undefined). RED venue exit **1** (`Test Files  1 failed (1)`, `Tests  5 failed (5)`, missing `Registrar producción`). GREEN admin exit **0** (`Test Files  1 passed (1)`, `Tests  6 passed (6)`). GREEN venue exit **0** (`Test Files  1 passed (1)`, `Tests  5 passed (5)`). Repeated after Biome with the same counts. |
| Runtime harness command/scenario and exact result | jsdom component tests, no listening server. Admin fills location `point-1`, recipe `sauce`, expected 5000, actual 4600 and posts `/tenants/pilot/production-runs` with `x-session-id: admin-web`. Variance `-400` is shown only when the body includes it. Consumed-average policy is `PUT /tenants/pilot/venues/chapinero/production-cost-policy` with `preparations: []`. Standard policy sends `standardUnitCost` 5. Venue uses the same production POST. `localStorage` and `sessionStorage` stay empty. The two kitchen `Listo` buttons stay. Offline fetch shows `No se puede registrar hasta que vuelva la conexión.` |
| Rollback boundary | `ProductionScreen` and its helpers in `apps/admin-web/src/inventory/inventory-screen.tsx`, `apps/admin-web/test/inventory/production-screen.test.tsx`, the production form in `apps/venue-app/src/kitchen/kitchen-screen.tsx`, and `apps/venue-app/test/kitchen/kitchen-production.test.tsx`. Leave `PurchaseScreen`, `PurchaseView`, the kitchen ticket list, `router.tsx`, `venue-cloud.ts`, and `service-session.tsx` in place. |

### Screen behavior

- Admin `ProductionScreen` posts a run (`runId`, `locationId`, `recipeId`, `expectedQuantity`, `actualQuantity`) and puts a cost policy (`consumed_average` or `standard`, plus `standardUnitCost` when the rule is standard).
- Variance renders as `Variación -400` only when `productionRun` includes `variance`. A body without it stays hidden. `outputUnitCost` is not shown.
- The kitchen posts that same run to `/tenants/pilot/production-runs`. It does not keep a local run, does not write storage, and does not add a ticket.
- Purchasing on the admin inventory screen is unchanged. `PurchaseView` was not edited.

### Deviations

The kitchen does not save the cost policy. Task 5.2 asks for the production POST. The policy route is `PUT` and stays on the admin screen.

Neither screen is mounted from a router. `apps/venue-app/src/router.tsx` was not edited. `ProductionScreen` is exported for the admin test the same way `PurchaseScreen` is.

### Left open

- None in this change. Verify is next. Do not archive from this batch.
