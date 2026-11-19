# Apply progress: p2-06-waste-and-counts

Tasks 1.3–1.6 only. Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing tests were written and run before the domain modules existed.

Delivery: feature-branch-chain. Decision needed before apply: No. This batch is the waste and count slice of work unit 1 (domain). Tasks 1.1 and 1.2 stay open for the ledger agent. Not committed. No pull request.

Previous apply-progress: none.

## Completed tasks

- [x] 1.3 RED `contexts/inventory/domain/operational-waste.test.ts`: reasons `expired`, `damaged`, `preparation_error`, and `other` with a note. Quantity is negative. No reversal id. Value is whole COP. A missing or unknown reason is rejected. Average cost stays the supplied snapshot.
- [x] 1.4 GREEN `contexts/inventory/domain/operational-waste.ts` and the operational-waste exports in `contexts/inventory/domain/index.ts`.
- [x] 1.5 RED `contexts/inventory/domain/stock-count.test.ts`: full-count movers at the location by the cut-off, category intersection, named gaps, frozen location / ingredient / quantity / `averageCost`, later lines ignored, zero variance skipped, absolute sum.
- [x] 1.6 GREEN `contexts/inventory/domain/stock-count.ts` and the stock-count exports in `contexts/inventory/domain/index.ts`.

## Work unit evidence

Slice of work unit 1 (domain tasks 1.3–1.6). Intended PR 1 on `phase-2/inventory`. Ledger tasks 1.1–1.2 are a separate agent and are not in this rollback boundary.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/operational-waste.test.ts contexts/inventory/domain/stock-count.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  14 passed (14)`. Same result after `pnpm exec biome check --write` on the domain files. |
| Runtime harness command/scenario and exact result | N/A. Pure domain. `recordOperationalWaste` and `submitStockCount` do not open files, sockets, or a database. |
| Rollback boundary | `contexts/inventory/domain/operational-waste.ts`, `contexts/inventory/domain/operational-waste.test.ts`, `contexts/inventory/domain/stock-count.ts`, `contexts/inventory/domain/stock-count.test.ts`, and the operational-waste and stock-count exports in `contexts/inventory/domain/index.ts`. Reverting those removes this slice. `stock-ledger.ts`, `stock-ledger.test.ts`, transfer, production, and producible-quantity exports stay. Phase marks live in this change's `tasks.md`, `state.yaml`, and `apply-progress.md`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.3 → 1.4 | Same vitest command before `operational-waste.ts` existed. Exit 1. `FAIL contexts/inventory/domain/operational-waste.test.ts` — `Cannot find module '#domain/operational-waste.js'`. `Test Files  2 failed (2)`. `Tests  no tests`. | Same command after `operational-waste.ts`, `stock-count.ts`, exports, and Biome. Exit 0. `Test Files  2 passed (2)`. `Tests  14 passed (14)`. |
| 1.5 → 1.6 | Same RED run. Exit 1. `FAIL contexts/inventory/domain/stock-count.test.ts` — `Cannot find module '#domain/stock-count.js'`. | Same GREEN run. Exit 0. `Tests  14 passed (14)`. |

### Operational waste

`recordOperationalWaste` accepts `expired`, `damaged`, `preparation_error`, and `other`. `other` requires a non-blank note. A missing or unknown reason throws `MissingWasteReason`. Quantity must be a negative integer of scaled base units. The result has no `reversesMovementId`. `type` is `waste`. `averageCost` is copied from the input. Value is `abs(quantity) * averageCost / QUANTITY_SCALE` and must already be a whole number of COP; otherwise `InvalidWaste`. The module does not call `nextAverageCost`. The test calls `nextAverageCost` only to show the stored average is not that recomputed cost. 1000 ml at 4 COP/ml is −1000 ml and 4000 COP, and the average stays 4.

### Stock count

`submitStockCount` keeps movements at the count location with `occurredAt` at or before the cut-off. A full count expects every ingredient in that set. A category count expects the intersection with `classification`. A missing line throws `MissingCountLine` and lists those ingredient ids. Variance is counted quantity minus the cut-off balance from `onHandDelta`. The frozen line stores `locationId`, `ingredientId`, that variance as `quantity`, and the supplied `averageCost`. A zero variance is omitted. `valueCop` is the sum of each line's absolute whole-COP value. Later movements, including a later purchase cost, do not change the freeze. There is no blind-count flag. PA-42 is not decided. `nextAverageCost` is not called.

### Deviations

None in the assigned behavior. A value that does not divide to a whole COP is rejected instead of rounded. The cut-off balance uses the existing `onHandDelta` so a sale-void waste still contributes 0. `stock-ledger.ts` and `stock-ledger.test.ts` were not edited.

### Left unchecked

- Phases 2, 3, and 4, except tasks 2.1 and 2.2, which were already checked outside this ledger slice. Tasks 2.5 and 2.6 stay open.

`state.yaml` is `status: applying` and `apply: partial`.

### Size

New files: `operational-waste.ts` 118 lines, `operational-waste.test.ts` 177, `stock-count.ts` 258, `stock-count.test.ts` 332. Index exports were added beside the existing transfer, production, producible-quantity, and no-restock exports. This slice is above the 400-line review budget. It stops at task 1.6.

## Tasks 2.1 and 2.2

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing assertion was written and run before `selfAuthorizationAttempt` was read from the input.

### RED 2.1

`pnpm exec vitest run --project platform contexts/platform/application/evaluate-permission/evaluate-permission.test.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  1 failed | 6 passed (7)`.

The omitted field still returns `requires_authorization` for 45,000 COP of `inventory.record-waste` (`wasteCop` cap 30,000). `selfAuthorizationAttempt: true` is ignored: the same call still returns `requires_authorization` instead of `denied`.

### GREEN 2.2

Same command after `selfAuthorizationAttempt` became optional and is forwarded with a default of `false`. Exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`.

Omitted stays `requires_authorization`. `true` is forwarded, and without shift self-authorization the decision is `denied`. Session, support, inactive-user, and foreign-pin behavior is unchanged. `shiftId` stays `null`.

## Tasks 1.1 and 1.2

Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing assertions were written and run before `count_adjustment` became writable. The earlier note that `stock-ledger.ts` was not edited applies only to tasks 1.3–1.6.

- [x] 1.1 RED nonzero `count_adjustment`, immutable `change` and `delete`, reversal waste keeps `onHandDelta` 0, `balanceUntil` and `averageCostUntil` skip later lines and do not call `nextAverageCost` for a count.
- [x] 1.2 GREEN writable `count_adjustment` on `stock-ledger.ts`. Sale-void waste stays. `domain/index.ts` was not edited: `StockLedger` is already exported, so `balanceUntil` and `averageCostUntil` travel with it.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/transfer.test.ts contexts/inventory/domain/production.test.ts`. RED exit code **1** (`Test Files  1 failed \| 2 passed (3)`, `Tests  4 failed \| 33 passed (37)`, `count_adjustment` threw `MovementTypeNotWritable`). GREEN exit code **0** (`Test Files  3 passed (3)`, `Tests  37 passed (37)`). |
| Runtime harness command/scenario and exact result | N/A. Domain ledger only. No count session, HTTP, or database. |
| Rollback boundary | Revert the `count_adjustment` write, `balanceUntil`, and `averageCostUntil` in `contexts/inventory/domain/stock-ledger.ts`, and the count cases in `stock-ledger.test.ts`. Leave `operational-waste.ts`, `stock-count.ts`, and `domain/index.ts` in place. |

A nonzero `count_adjustment` may be positive or negative. Zero throws `InvalidQuantity`. `change` and `delete` still throw `MovementImmutable`. A waste that points at a `sale_consumption` of the same ingredient keeps `onHandDelta` 0. Lines with `occurredAt` after the cut-off are ignored. A count snapshots the average: 10 g at 10 plus a count of 5 g at 12 stays 10, and the cut-off average stays 10 while the later purchase of 10 g at 14 makes the full average 12. `nextAverageCost` is not called for a count. `state.yaml` stays `applying` and `apply: partial`. Tasks 1.3–1.6, 2.5, and 2.6 were not changed by this slice.

## Tasks 2.3 and 2.4

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing test was written and run before `set-ingredient-category.ts` and `ingredient-classification.ts` existed.

### RED 2.3

`pnpm exec vitest run --project inventory contexts/inventory/application/set-ingredient-category/set-ingredient-category.test.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  no tests`.

`FAIL contexts/inventory/application/set-ingredient-category/set-ingredient-category.test.ts` — `Missing "#application/set-ingredient-category/set-ingredient-category.js" specifier in "@blackhole/inventory" package`.

### GREEN 2.4

Same command after `set-ingredient-category.ts`, `ingredient-classification.ts`, and the `#application/set-ingredient-category/*` import. Exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`. Same result after `pnpm exec biome check --write` on those three files.

`SetIngredientCategory` stores `{ tenantId, ingredientId, category }` for an ingredient visible in this company. Milk in company A classified as `dairy` is stored for that ingredient. Company B does not see the ingredient: `ingredientOf` is null, `find` is null, and classifying it throws `IngredientHidden` without a second `save`. Company A's dairy row stays. The stored object has only `category`, `ingredientId`, and `tenantId`. No count adjustment and no waste movement are posted. PA-42 is not decided. `entry-port.ts`, `domain/index.ts`, `stock-ledger.ts`, `record-operational-waste`, `evaluate-permission`, and adapters were not edited.

The `#application/set-ingredient-category/*` import is the only `package.json` change. Task 2.10 still owns the `entry-port.ts` export. The import is required by the package alias rule; without it Vitest cannot load the test.

## Work unit evidence

Slice of work unit 3 (counts): tasks 2.3 and 2.4 only. Intended later PR on the feature-branch chain. Not committed. Tasks 2.7–2.10 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/set-ingredient-category/set-ingredient-category.test.ts`. RED exit code **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#application/set-ingredient-category/set-ingredient-category.js` specifier). GREEN exit code **0** (`Test Files  1 passed (1)`, `Tests  2 passed (2)`), including after Biome. |
| Runtime harness command/scenario and exact result | N/A. The use case talks only to the in-memory classification port. It does not open a socket, listen, or touch PostgreSQL. |
| Rollback boundary | `contexts/inventory/application/set-ingredient-category/set-ingredient-category.ts`, `contexts/inventory/application/set-ingredient-category/set-ingredient-category.test.ts`, `contexts/inventory/application/ports/ingredient-classification.ts`, and the `#application/set-ingredient-category/*` import in `contexts/inventory/package.json`. Reverting those removes this slice. Waste, ledger, `entry-port.ts`, and adapters stay. |

`state.yaml` stays `status: applying` and `apply: partial`. Tasks 2.1, 2.2, 2.5, and 2.6 were not changed by this slice.

## Tasks 2.5 and 2.6

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing test was written and run before `record-operational-waste.ts` existed.

### RED 2.5

`pnpm exec vitest run --project inventory contexts/inventory/application/record-operational-waste/record-operational-waste.test.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  no tests`.

`Missing "#application/record-operational-waste/record-operational-waste.js" specifier in "@blackhole/inventory" package`.

### GREEN 2.6

Same command after the use case, the `#application/record-operational-waste/*` import, and `CONSUMPTION_ROLE.OPERATIONAL_WASTE`. Exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Same result after `pnpm exec biome check --write` on the touched files.

1000 ml at 4 COP/ml posts `waste` / `operational_waste` with quantity `-1000 * QUANTITY_SCALE`, value 4000 COP, and unit cost 4. There is no reversal id, so on-hand falls from 5000 ml to 4000 ml. `StockMoved` uses lane `after_sales`, `recipeVersion` 0, and the document id as `orderLineId`. `nextAverageCost` is not called. 12000 COP posts and audits `inventory.record-waste`. 45000 COP returns `requires_authorization` for `wasteCop` 30000 and posts nothing, including when the kitchen chief is named as authorizer. Reasons stay on `recordOperationalWaste`: `expired`, `damaged`, `preparation_error`, and `other` with a note. Value stays whole COP. No blind-count switch. PA-42 is not decided. `entry-port.ts` was not changed.

## Work unit evidence

Work unit 2 (waste): tasks 2.1, 2.2, 2.5, and 2.6. Intended PR 2 on the feature-branch chain, based on PR 1. Not committed.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Permission: `pnpm exec vitest run --project platform contexts/platform/application/evaluate-permission/evaluate-permission.test.ts`. RED exit 1 (`Tests  1 failed \| 6 passed (7)`). GREEN exit 0 (`Tests  7 passed (7)`), including after Biome. Waste: `pnpm exec vitest run --project inventory contexts/inventory/application/record-operational-waste/record-operational-waste.test.ts`. RED exit 1 (`Tests  no tests`, missing package import). GREEN exit 0 (`Tests  3 passed (3)`), including after Biome. |
| Runtime harness command/scenario and exact result | N/A. Both paths use in-memory ports. They do not open a socket, listen on a port, or touch PostgreSQL. |
| Rollback boundary | `contexts/platform/application/evaluate-permission/evaluate-permission.ts`, `contexts/platform/application/evaluate-permission/evaluate-permission.test.ts`, `contexts/inventory/application/record-operational-waste/record-operational-waste.ts`, `contexts/inventory/application/record-operational-waste/record-operational-waste.test.ts`, the `OPERATIONAL_WASTE` role in `contexts/inventory/application/ports/stock-ledger-repository.ts`, and the `#application/record-operational-waste/*` import in `contexts/inventory/package.json`. Reverting those removes this slice. Ledger, transfer, production, `operational-waste.ts`, and `stock-count.ts` stay. |

`state.yaml` stays `status: applying` and `apply: partial`.

## Tasks 2.7 and 2.8

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing test was written and run before `record-stock-count.ts` existed.

### RED 2.7

`pnpm exec vitest run --project inventory contexts/inventory/application/record-stock-count/record-stock-count.test.ts contexts/inventory/application/set-ingredient-category/set-ingredient-category.test.ts`

Exit 1. `Test Files  1 failed | 1 passed (2)`. `Tests  2 passed (2)`.

`FAIL contexts/inventory/application/record-stock-count/record-stock-count.test.ts` — `Missing "#application/record-stock-count/record-stock-count.js" specifier in "@blackhole/inventory" package`. The category tests still passed.

### GREEN 2.8

Same command after `record-stock-count.ts`, `application/ports/stock-count-repository.ts`, and the `#application/record-stock-count/*` import. Exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. Same result after `pnpm exec biome check --write` on the touched files.

A dairy count reads `IngredientClassification`. Milk and cheese are compared. Beef is not. Cheese at the cut-off balance is a zero line and is skipped. Tenant B cannot classify the ingredient (`IngredientHidden`), `find` and `ingredientOf` stay null, and B's count posts no `count_adjustment`.

−600 g valued at 900 COP, under the 1,000 COP cap, posts one `count_adjustment` with role `count_adjustment`, `recipeVersion` 0, and the document id as `orderLineId`. There is no reversal id. 1,500 COP saves a pending session and posts nothing (`requires_authorization`, `countAdjustmentCop`). A sale after the cut-off stays in the ledger. The variance uses `balanceUntil`. `averageCostUntil` supplies 1,500 COP. A later purchase would make `nextAverageCost` a different figure, and that figure is not stored. The use case does not call `nextAverageCost`.

Raising the site cap above 1,000 COP throws `LimitRaised` and writes nothing. Lowering it to 500 COP makes the 900 COP variance wait. Counted units are multiplied by the purchase factor, then by `QUANTITY_SCALE` for the ledger line. No blind-count switch. PA-42 is not decided.

The ledger repository was not edited. It still has no movement list and its role union has no `count_adjustment`, so this slice reads and appends through `stock-count-repository.ts`. `StockMoved` waits until that role exists on the queue. `entry-port.ts`, `stock-ledger.ts`, and `stock-ledger.test.ts` were not edited.

## Work unit evidence

Slice of work unit 3 (counts): tasks 2.7 and 2.8 only. Intended later PR on the feature-branch chain. Not committed. Tasks 2.9 and 2.10 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/record-stock-count/record-stock-count.test.ts contexts/inventory/application/set-ingredient-category/set-ingredient-category.test.ts`. RED exit code **1** (`Test Files  1 failed \| 1 passed (2)`, `Tests  2 passed (2)`, missing `#application/record-stock-count/record-stock-count.js` specifier). GREEN exit code **0** (`Test Files  2 passed (2)`, `Tests  7 passed (7)`), including after Biome. |
| Runtime harness command/scenario and exact result | N/A. The use case talks only to in-memory ports. It does not open a socket, listen, or touch PostgreSQL. |
| Rollback boundary | `contexts/inventory/application/record-stock-count/record-stock-count.ts`, `contexts/inventory/application/record-stock-count/record-stock-count.test.ts`, `contexts/inventory/application/ports/stock-count-repository.ts`, and the `#application/record-stock-count/*` import in `contexts/inventory/package.json`. Reverting those removes this slice. Classification, waste, the ledger repository, and `entry-port.ts` stay. |

`state.yaml` stays `status: applying` and `apply: partial`. Tasks 2.1–2.6 and 2.9–2.10 were not changed by this slice.

## Tasks 3.1 and 3.2

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing contract was written and run before `in-memory-stock-count-repository.ts` existed.

### RED 3.1

`pnpm exec vitest run --project inventory contexts/inventory/application/ports/stock-count-repository.contract.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  no tests`.

`FAIL contexts/inventory/application/ports/stock-count-repository.contract.ts` — `Cannot find module '#adapters/memory/in-memory-stock-count-repository.js'`.

### GREEN 3.2

Same command after `in-memory-stock-count-repository.ts`, `COUNT_ADJUSTMENT` on `CONSUMPTION_ROLE`, the inventory Vitest include for the contract, and `pnpm exec biome check --write` on the touched files. Exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`.

The memory contract stores a posted freeze of −600 g at 1,500 COP. After a later sale, the session still has that location, ingredient, quantity, and average cost, and the stored `count_adjustment` line matches it. Tenant B does not see tenant A's session, line, dairy classification, or milk stock. Tenant A's beef classification stays null. A pending count that is rejected keeps the freeze, writes no `count_adjustment`, and leaves 8,000 g on hand. Tenant B's reject does not open tenant A's session. No Drizzle client is mocked. `nextAverageCost` is not called. PA-42 is not decided.

`StockMovedEvent.role` is `ConsumptionRole`. Adding `count_adjustment` on `stock-ledger-repository.ts` is the queue role. `stock-movement-queue.ts` was not edited. No read methods were added. `append`, `listByVenue`, and purchase behavior were not changed. Postgres and SQLite ledger repositories were not edited. `package.json`, `entry-port.ts`, `schema.ts`, and domain files were not edited.

## Work unit evidence

Slice of work unit 4 (persistence): tasks 3.1 and 3.2 only. Intended later PR on the feature-branch chain. Not committed. Tasks 3.3–3.6 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/ports/stock-count-repository.contract.ts`. RED exit code **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#adapters/memory/in-memory-stock-count-repository.js`). GREEN exit code **0** (`Test Files  1 passed (1)`, `Tests  3 passed (3)`), including after Biome. |
| Runtime harness command/scenario and exact result | N/A. The contract runs the in-memory adapter. It does not open a socket, listen, or touch PostgreSQL. Drizzle is not mocked. |
| Rollback boundary | `contexts/inventory/application/ports/stock-count-repository.contract.ts`, `contexts/inventory/adapters/memory/in-memory-stock-count-repository.ts`, the `COUNT_ADJUSTMENT` role in `contexts/inventory/application/ports/stock-ledger-repository.ts`, and the inventory include for that contract in `vitest.config.ts`. Reverting those removes this slice. Ledger append, purchase, Postgres, SQLite, `entry-port.ts`, and `package.json` stay. |

`state.yaml` stays `status: applying` and `apply: partial`. Tasks 2.9, 2.10, 3.3–3.6, and phase 4 were not changed by this slice.

## Tasks 3.3 and 3.4

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The PGlite contract was written and run before `drizzle-stock-count-repository.ts` and `0008_waste_and_counts.sql` existed. The memory scenarios in `stock-count-repository.contract.ts` were not rewritten.

### RED 3.3

`pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  no tests`.

`FAIL contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-stock-count-repository.js'`.

### GREEN 3.4

Same command after `0008_waste_and_counts.sql`, the session, line, and classification tables in `schema.ts`, and `drizzle-stock-count-repository.ts`. Exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`.

After `pnpm exec biome check --write` on those TypeScript files, the same PGlite file plus the memory contract:

`pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts contexts/inventory/application/ports/stock-count-repository.contract.ts`

Exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`.

PGlite applies `0001_recipe_catalog.sql`, `0002_stock_ledger.sql`, `0006_production.sql`, and `0008_waste_and_counts.sql`. Each repository call runs `SET LOCAL ROLE inventory_app` and `SELECT set_config('app.tenant_id', tenantId, true)`, the local form of `SET LOCAL app.tenant_id`. No Drizzle mock. No SQLite. No HTTP listener.

The shared contract still freezes −600 g at 1,500 COP. After a later sale, the session keeps that location, ingredient, quantity, and average cost, and the stored `count_adjustment` line matches it. Tenant B does not see tenant A's session, line, dairy classification, or milk stock. A pending count that is rejected keeps the freeze, writes no `count_adjustment`, and leaves 8,000 g on hand. An empty database has `count_sessions`, `count_session_lines`, and `ingredient_classifications`, still has the production tables and `output_quantity`, and has zero `stock_movements`. `nextAverageCost` is not called. PA-42 is not decided.

`0008` reuses `stock_movements`. It widens `stock_movements_role` so `consumption` and `reversal` stay valid and `operational_waste` and `count_adjustment` are allowed. It widens `stock_movements_recipe_version` from `>= 1` to `>= 0` so a count line can store `recipeVersion` 0. No rows are backfilled. `0004`, `0005`, `0006`, and `0007` were not edited.

`drizzle-stock-ledger-repository.ts` was not edited. This repository inserts the count line itself. It does not update `stock_balances` and does not write `stock_movement_outbox`. `stockOf` replays `onHandDelta` over `stock_movements`, which is what the contract reads. The outbox role check still allows only `consumption` and `reversal`. Unique-conflict retry stays on task 3.5. `package.json`, `entry-port.ts`, `application-module.ts`, and `shared/contracts` were not edited.

## Work unit evidence

Slice of work unit 4 (persistence): tasks 3.3 and 3.4 only. Intended later PR on the feature-branch chain. Not committed. Tasks 2.9, 2.10, 3.5, 3.6, and phase 4 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts`. RED exit code **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#adapters/postgres/drizzle-stock-count-repository.js`). GREEN exit code **0** (`Test Files  1 passed (1)`, `Tests  4 passed (4)`). After Biome, that file plus the memory contract: exit code **0** (`Test Files  2 passed (2)`, `Tests  7 passed (7)`). |
| Runtime harness command/scenario and exact result | PGlite applies `0001`, `0002`, `0006`, and `0008`, then `SET LOCAL ROLE inventory_app` and `set_config('app.tenant_id', tenantId, true)`. The four PGlite tests pass, including the empty-database check that no movement was backfilled. No HTTP listener. |
| Rollback boundary | `contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts`, `contexts/inventory/adapters/postgres/drizzle-stock-count-repository.ts`, `contexts/inventory/adapters/postgres/0008_waste_and_counts.sql`, and the `countSessions`, `countSessionLines`, and `ingredientClassifications` tables in `contexts/inventory/adapters/postgres/schema.ts`. Reverting those removes this slice. `0006`, the ledger repository, SQLite, `package.json`, `entry-port.ts`, and the memory contract stay. |

`state.yaml` stays `status: applying` and `apply: partial`. Tasks 2.9, 2.10, 3.5, 3.6, and phase 4 were not changed by this slice.

## Tasks 2.9 and 2.10

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing test was written and run before `approve-adjustment.ts` and the `#application/approve-adjustment/*` import existed.

### RED 2.9

`pnpm exec vitest run --project inventory contexts/inventory/application/approve-adjustment/approve-adjustment.test.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  no tests`.

`FAIL contexts/inventory/application/approve-adjustment/approve-adjustment.test.ts` — `Missing "#application/approve-adjustment/approve-adjustment.js" specifier in "@blackhole/inventory" package`.

### GREEN 2.10

Same command after `approve-adjustment.ts`, the `#application/approve-adjustment/*` import, and the four use-case exports appended to `entry-port.ts`. Exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`.

Same command after `pnpm exec biome check --write contexts/inventory/application/approve-adjustment`. Exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. Biome was not run on `entry-port.ts`, so the existing export list stayed in place.

Approval of a pending freeze posts those lines as `count_adjustment` with `recipeVersion` 0, the document id as `orderLineId`, and no reversal id. Milk −600 g and cheese −400 g stay at the frozen average of 1,500 COP. `movementsAt` is not called. `nextAverageCost` is not called. The session becomes `posted`. The audit action is `inventory.approve-count`.

Rejection stores that audit, appends no movement, and leaves the original pending freeze. Another tenant still cannot see it. A recount may open: the same frozen lines are saved as a new pending session and no stock line is written.

Self-approval sets `selfAuthorizationAttempt` when the actor is the counter. The site administrator is the only approver and the 1,500 COP freeze is over the 1,000 COP cap. Without the shift flag the decision is `denied` and nothing is written. With the shift flag the same frozen lines post and `authorizerId` stays null. No blind-count switch. PA-42 is not decided.

`entry-port.ts` appends `ApproveAdjustment`, `RecordOperationalWaste`, `RecordStockCount`, and `SetIngredientCategory`. `package.json` gains only `#application/approve-adjustment/*`. `StockMoved` is not enqueued. The outbox role check still belongs to task 3.6.

## Work unit evidence

Slice of work unit 3 (counts): tasks 2.9 and 2.10 only. Intended later PR on the feature-branch chain. Not committed. Tasks 3.5, 3.6, and phase 4 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/approve-adjustment/approve-adjustment.test.ts`. RED exit code **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#application/approve-adjustment/approve-adjustment.js` specifier). GREEN exit code **0** (`Test Files  1 passed (1)`, `Tests  4 passed (4)`), including after Biome on the new folder. |
| Runtime harness command/scenario and exact result | N/A. The use case talks only to in-memory ports. It does not open a socket, listen, or touch PostgreSQL. |
| Rollback boundary | `contexts/inventory/application/approve-adjustment/approve-adjustment.ts`, `contexts/inventory/application/approve-adjustment/approve-adjustment.test.ts`, the `#application/approve-adjustment/*` import in `contexts/inventory/package.json`, and the four use-case exports appended at the end of `contexts/inventory/application/entry-port.ts`. Reverting those removes this slice. Record stock count, the count repository, Postgres, and the earlier entry-port exports stay. |

`state.yaml` stays `status: applying` and `apply: partial`. Tasks 3.3 and 3.4 were left as found. Tasks 3.5, 3.6, and phase 4 were not changed by this slice.

## Task 3.5

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing assertions were written and run before balances, the outbox insert, and the unique retry existed.

### RED 3.5

`pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  3 failed | 4 passed (7)`.

A count adjustment of −600 g left `stock_balances` empty (`expected null to be -600000`). Appending the same tenant, document, role, and ingredient again threw `23505` on `stock_movements_line`. An operational waste append wrote the movement and the balance, then rolled back because `stock_movement_outbox_role` still allowed only `consumption` and `reversal`. The four existing cases still passed.

### GREEN 3.5

Same command after `0010_waste_count_outbox.sql`, the count repository posting balance and outbox, the ledger retry for those two roles, and the package export. Exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`.

The ledger contract, run after that file and not in parallel:

`pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.contract.test.ts`

Exit 0. `Test Files  1 passed (1)`. `Tests  8 passed (8)`.

A count adjustment and an operational waste each insert the movement, update `stock_balances`, and insert `stock_movement_outbox` inside one `inTenant` transaction. A failed outbox insert rolls the balance back with the movement. The outbox lane is `after_sales`. `recipeVersion` is 0. The document id is `orderLineId`.

A second append of the same tenant, document, role, and ingredient is a unique-violation retry. The stored movement, balance, and outbox row stay. The sale consumption row stays, including its quantity and `consumption` role. The sale seed still does not write a balance or an outbox row. Sale, reversal, purchase, transfer, and production appends still throw on that unique key. `schema.ts` was re-read and left unchanged: `stock_movements_line` is already declared, and the outbox role check lives in SQL. `0001` through `0009` were not edited. Task 3.6 still owns `shared/contracts`. No commit and no branch.

## Work unit evidence

Slice of work unit 4 (persistence): task 3.5 only. Intended later PR on the feature-branch chain. Not committed. Tasks 3.6, 4.1, and 4.2 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts`. RED exit code **1** (`Test Files  1 failed (1)`, `Tests  3 failed \| 4 passed (7)`). GREEN exit code **0** (`Test Files  1 passed (1)`, `Tests  7 passed (7)`). Ledger contract after the ledger edit: `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.contract.test.ts`. Exit code **0** (`Test Files  1 passed (1)`, `Tests  8 passed (8)`). |
| Runtime harness command/scenario and exact result | PGlite applies `0001`, `0002`, `0006`, `0008`, and `0010`, then `SET LOCAL ROLE inventory_app` and `set_config('app.tenant_id', tenantId, true)`. The count adjustment and the operational waste commit the movement, the balance, and the outbox row in that same transaction. The unique retry leaves the sale consumption row in place. No HTTP listener. |
| Rollback boundary | `contexts/inventory/adapters/postgres/drizzle-stock-count-repository.ts`, `contexts/inventory/adapters/postgres/drizzle-stock-count-repository.contract.test.ts`, the unique-retry branch in `contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.ts`, `contexts/inventory/adapters/postgres/0010_waste_count_outbox.sql`, and the appended `./adapters/postgres/drizzle-stock-count-repository` export in `contexts/inventory/package.json`. Reverting those removes this slice. `0001`–`0009`, `schema.ts`, sale consumption, reversal, purchase, transfer, production, `entry-port.ts`, and `shared/contracts` stay. |

`state.yaml` stays `status: applying` and `apply: partial`. Tasks 3.6, 4.1, and 4.2 were not changed by this slice.

## Task 3.6

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing assertion was written and run before `operational_waste` and `count_adjustment` were added to `CONSUMPTION_ROLE` in `shared/contracts/stock-movement.ts`.

### RED 3.6

`pnpm exec vitest run --project inventory contexts/inventory/application/record-waste/stock-movement-contract.test.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  1 failed | 1 passed (2)`.

`ZodError` on `role`: expected one of `"consumption"|"reversal"`. Consumption and reversal with `recipeVersion` 0 had already parsed. The failure was at `operational_waste`.

### GREEN 3.6

Same command after those two roles were added beside `consumption` and `reversal`. Exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`.

Same command after `pnpm exec biome check --write` on `shared/contracts/stock-movement.ts` and `contexts/inventory/application/record-waste/stock-movement-contract.test.ts`. Exit 0. `Test Files  1 passed (1)`. `Tests  2 passed (2)`.

`StockMoved.role` accepts `consumption`, `reversal`, `operational_waste`, and `count_adjustment`. Those four strings match `CONSUMPTION_ROLE` in `contexts/inventory/application/ports/stock-ledger-repository.ts`. `recipeVersion` stays `z.number().int()`, so 0 remains valid. `orderLineId` stays the document id. The object stays `.strict()`: an extra key is rejected, and an unknown role is rejected. `shared/contracts/index.ts` already exports `stockMoved` and `StockMoved`, so it was not edited. Domain files were not edited and still import no Zod.

## Work unit evidence

Slice of work unit 4 (persistence): task 3.6 only. Intended later PR on the feature-branch chain. Not committed. Task 3.5 was already checked by the parallel slice. Tasks 4.1 and 4.2 stay open.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/record-waste/stock-movement-contract.test.ts`. RED exit code **1** (`Test Files  1 failed (1)`, `Tests  1 failed \| 1 passed (2)`, `operational_waste` rejected as not `consumption` or `reversal`). GREEN exit code **0** (`Test Files  1 passed (1)`, `Tests  2 passed (2)`), including after Biome on the contract and the test. |
| Runtime harness command/scenario and exact result | N/A. The change is a Zod object parsed in process. It does not open a socket, listen, or touch PostgreSQL. |
| Rollback boundary | The `CONSUMPTION_ROLE` values in `shared/contracts/stock-movement.ts` and the second test in `contexts/inventory/application/record-waste/stock-movement-contract.test.ts`. Reverting those removes this slice. `shared/contracts/index.ts`, the ledger port, repositories, SQL, and domain stay. |

`state.yaml` stays `status: applying` and `apply: partial`. Tasks 4.1 and 4.2 were not changed by this slice.

## Tasks 4.1 and 4.2

Mode stays Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing HTTP test was written and run before `stock-operations.controller.ts` existed.

### RED 4.1

`pnpm exec vitest run --project api-cloud test/http/stock-operations.controller.test.ts`

Exit 1. `Test Files  1 failed (1)`. `Tests  no tests`.

`Cannot find module '#src/http/stock-operations.controller.js'`.

### GREEN 4.2

Same command after the controller and the `wasteAndCountsEnabled` wiring. Exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`.

Same command after `pnpm exec biome check --write` on the controller, the test, and `application-module.ts`. Exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`.

`wasteAndCountsEnabled` defaults off: the flag is on only when it is exactly `true`, the same check as `transfersEnabled` and `noRestockTodayEnabled`. Off skips the controller, so Fastify `inject` returns 404 and `server.listening` stays false.

Routes, all under `/tenants/:tenantId/venues/:venueId`:

- `POST operational-waste`
- `POST stock-counts`
- `POST stock-counts/:documentId/approval`
- `PUT ingredients/:ingredientId/category`

Reasons stay `expired`, `damaged`, `preparation_error`, and `other` with a note. A reason outside that set is 400 and writes no movement. 11250 ml at 4 COP is 45000 COP. The kitchen chief cap is 30000 COP, so the response is `requires_authorization` with `wasteCop` and nothing is inserted. Approval of a count above the 1000 COP company cap returns the frozen location, ingredient, quantity, and average cost. A sale after the cut-off stays in the ledger and does not change that freeze. Reject and self-approval go through `ApproveAdjustment`: reject writes no movement and leaves the audit; self-approval sets `selfAuthorizationAttempt` when the actor is the counter. There is no blind-count field. PA-42 is not decided.

Postgres only. The module constructs `DrizzleStockCountRepository` and `DrizzleIngredientClassification`. api-cloud does not import sqlite. `package.json` already exported `./adapters/postgres/drizzle-stock-count-repository`, so it was not edited. `entry-port.ts`, `schema.ts`, and SQL were not edited. Purchasing, `productionEnabled`, `transfersEnabled`, inventory reports, and `noRestockTodayEnabled`, including `NotRestockedProductReader`, stay.

## Work unit evidence

Slice of work unit 5 (HTTP): tasks 4.1 and 4.2. Intended later PR on the feature-branch chain. Not committed. No branch. Tasks 1.1–3.6 were already complete.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud test/http/stock-operations.controller.test.ts`. RED exit code **1** (`Test Files  1 failed (1)`, `Tests  no tests`, missing `#src/http/stock-operations.controller.js`). GREEN exit code **0** (`Test Files  1 passed (1)`, `Tests  4 passed (4)`), including after Biome on the controller, the test, and `application-module.ts`. |
| Runtime harness command/scenario and exact result | Fastify `inject` on the Nest app from `createApplication`. `server.listening` is false. PGlite applies `0001_recipe_catalog.sql`, `0002_stock_ledger.sql`, `0008_waste_and_counts.sql`, and `0010_waste_count_outbox.sql`. The repository sets `SET LOCAL ROLE inventory_app` and `app.tenant_id`. Flag off returns 404. Over-cap waste inserts no `operational_waste` row. Approval returns the frozen lines and inserts that `count_adjustment`. |
| Rollback boundary | `apps/api-cloud/src/http/stock-operations.controller.ts`, `apps/api-cloud/test/http/stock-operations.controller.test.ts`, and the `wasteAndCountsEnabled` append in `apps/api-cloud/src/composition/application-module.ts` (`openWasteAndCounts`, the flag, and the controller/provider spreads). Reverting those removes this slice. Purchasing, production, transfers, inventory reports, no-restock, `NotRestockedProductReader`, `entry-port.ts`, `package.json`, `schema.ts`, and SQL stay. |

`state.yaml` stays `status: applying` and `apply: partial`. No task after 4.2 exists in `tasks.md`. Screens were not added. This slice does not archive.
