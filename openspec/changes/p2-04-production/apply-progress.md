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
