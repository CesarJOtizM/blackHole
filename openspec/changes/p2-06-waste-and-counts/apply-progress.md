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
