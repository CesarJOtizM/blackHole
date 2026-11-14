# Apply progress: p2-07-producible-quantity

Work unit 1 only (tasks 1.1 and 1.2). Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. `openspec/config.yaml` still requires the failing test first, so this pair ran RED then GREEN.

Delivery: chained PR slice. Chain strategy: feature-branch-chain. Decision needed before apply: No. 400-line budget risk for the whole change: High. This batch is only the domain rule.

Work unit 1 intended PR boundary: PR 1, base `phase-2/inventory`. Not created. Not committed. Not pushed. No pull request.

Previous apply-progress: none.

## Completed tasks

- [x] 1.1 RED `contexts/inventory/domain/producible-quantity.test.ts`: 12 buns limit at 12; −200 is 0; a missing row limits at 0; a tie lists both ids; skip `quantity <= 0`; restock 52 keeps point state; 0 is `sold_out`; at or under a threshold is `low_units`; no threshold stays `available`; stocked stock uses the explode recipe id. No Nest.
- [x] 1.2 GREEN `contexts/inventory/domain/producible-quantity.ts` (`PossibleUnits`, `AvailabilityState`). Export `domain/index.ts`.

## Work unit 1 evidence

Work unit 1 of 6: Domain rule (tasks 1.1 and 1.2). Intended branch for PR 1. Intended base `phase-2/inventory`.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/producible-quantity.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. Re-run after `pnpm exec biome check --write` on the domain files: same result, exit 0. |
| Runtime harness command/scenario and exact result | N/A. Pure domain. `possibleUnits` does not open files, sockets, or a database, and it does not append to `StockLedger`. |
| Rollback boundary | `contexts/inventory/domain/producible-quantity.ts`, `contexts/inventory/domain/producible-quantity.test.ts`, and the `AvailabilityState`, `PossibleUnits`, and `possibleUnits` exports in `contexts/inventory/domain/index.ts`. Reverting those removes this slice. Purchasing, recipe catalog, stock ledger, and production exports stay. Phase marks live in this change's `tasks.md`, `state.yaml`, and `apply-progress.md`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm exec vitest run --project inventory contexts/inventory/domain/producible-quantity.test.ts` exit 1. `FAIL contexts/inventory/domain/producible-quantity.test.ts` — `Cannot find module '#domain/producible-quantity.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `producible-quantity.ts`, the `domain/index.ts` exports, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |

### Domain rule

`possibleUnits` is read-only. Per line with `quantity > 0`, units are `floor(max(balance, 0) / quantity)`. A missing balance row is 0. The minimum wins. A tie lists every ingredient id, sorted with `localeCompare`. Replenishment adds the point balance and the supplying balance, then uses the same floor. `state` uses point units only.

- 3,000 g of beef and 12 buns → 12, limited by the bun, state `available` when there is no threshold.
- Beef at −200 → 0, `sold_out`, limited by beef.
- No bun row → 0, limited by the bun.
- Beef and buns both allow 12 → both ids.
- Quantity 0 and quantity −1 are skipped.
- Point 12 plus 40 warehouse buns and enough beef → replenishment 52. With threshold 12 the state stays `low_units`.
- Point 0 with a threshold of 5 is `sold_out`.
- Threshold 5: 5 and 4 are `low_units`; 6 is `available`.
- No threshold (`null`) and 1 unit stays `available`.
- A stocked preparation uses the recipe id `RecipeCatalog.explode` returns. Child ingredient stock is not the limit.

`AvailabilityState` is `"available" | "low_units" | "sold_out"`. `PossibleUnits` carries `pointUnits`, `replenishmentUnits`, `limitingIngredientIds`, and `state`.

### Deviations

None in the assigned behavior. `PossibleUnitsInput` is exported from the module so the function parameter has a name. `possibleUnits` is exported from `domain/index.ts` next to the two types. Limiting ids are sorted so a tie is stable. Production exports added in `domain/index.ts` during this batch were kept.

### Deferred

Projector, ports, stores, menu flag, and cloud HTTP stay in tasks 2.1–5.2. No `append`. No Nest, Drizzle, or Zod. `package.json` was not edited.

## Remaining tasks

- [x] 1.1 and 1.2 (work unit 1)
- [x] 2.1 and 2.2 (work unit 2)
- [x] 3.1 and 3.2 (work unit 3)
- [x] 3.3 and 3.4 (work unit 4)
- [ ] 4.1 through 5.2

## Work unit 2

Work unit 2 of 6: Projector (tasks 2.1 and 2.2). Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing test was written and run before the use case existed.

Delivery: chained PR slice. Chain strategy: feature-branch-chain. Decision needed before apply: No. This batch is the projector only. Intended PR 2, base PR 1. Not created. Not committed. Not pushed.

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.1 → 2.2 | `pnpm exec vitest run --project inventory contexts/inventory/application/project-producible-quantity/project-producible-quantity.test.ts` exit 1. `FAIL contexts/inventory/application/project-producible-quantity/project-producible-quantity.test.ts` — `Missing "#application/project-producible-quantity/project-producible-quantity.js" specifier in "@blackhole/inventory" package`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the use case, ports, `entry-port.ts` export, `#application/project-producible-quantity/*`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  12 passed (12)`. |

## Work unit 2 evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/project-producible-quantity/project-producible-quantity.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  12 passed (12)`. Run after `pnpm exec biome check --write` on the projector files. |
| Runtime harness command/scenario and exact result | N/A. The use case talks to in-memory ports only. It does not open a socket, listen, or read SQL. `StockLedgerRepository.append` is never called. |
| Rollback boundary | `contexts/inventory/application/project-producible-quantity/project-producible-quantity.ts`, `contexts/inventory/application/project-producible-quantity/project-producible-quantity.test.ts`, `contexts/inventory/application/ports/producible-quantity-repository.ts`, `contexts/inventory/application/ports/supplying-locations.ts`, `contexts/inventory/application/ports/low-units-threshold.ts`, `contexts/inventory/application/ports/availability-publisher.ts`, the `ProjectProducibleQuantity` export in `contexts/inventory/application/entry-port.ts`, and the `#application/project-producible-quantity/*` imports entry in `contexts/inventory/package.json`. Reverting those removes this slice. Domain, orders, adapters, and schema stay. |

### Projector rule

`ProjectProducibleQuantity` is read-only. It calls `possibleUnits` from `#domain/producible-quantity.js` and the current `explode` (no version, no modifiers). A missing recipe or an empty explosion stores nothing. The ingredient index is replaced only when a recipe version is projected. A point movement recalculates indexed products. A warehouse movement writes `replenishmentUnits` from the sum of supplying locations and leaves point units and menu state untouched. The event is `siteId`, `productId`, `variantId`, `state`. No cost. `append` is never called.

- Lemons are not indexed, so the burger projection is not recalculated.
- Beef recalculates the burger and the sandwich. A bun movement recalculates only the burger.
- Publishing the next recipe version recalculates that product from the current explode and drops ingredients the new version no longer uses.
- 30 to 29 stays `available` and emits nothing when there is no threshold.
- 6 to 5 with threshold 5 emits one `low_units` event. 4 is `low_units`. 0 is `sold_out`.
- Point 12 plus supplying locations 40 and 10, with threshold 12, stores replenishment 62 and menu state `low_units`.
- The same balances changed at a warehouse store replenishment 62 and keep the previous menu state, with no event.
- A stocked preparation is limited by the recipe id `explode` returns. Butter, the child ingredient, is not indexed.
- Recipe publication, a point movement, a warehouse movement, and an unrelated ingredient finish with `appendCalls` 0.

### Deviations

None in the assigned behavior. The event fields use `siteId`, `productId`, and `variantId` (`string | null`). A first projection with no previous row publishes once so the menu can receive the initial state. A later version that keeps the same state does not publish. `UnknownVenue` is the existing error from the theoretical-cost use case.

### Deferred

Projection store, menu flag, and cloud HTTP stay in tasks 3.1–5.2. No Nest, Drizzle, or Zod. `menu.ts` was not edited.

## Work unit 3

Work unit 3 of 6: Memory store (tasks 3.1 and 3.2). Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing contract was written and run before the memory store existed.

Delivery: chained PR slice. Chain strategy: feature-branch-chain. Decision needed before apply: No. This batch is the memory store only. Intended PR 3, base PR 2. Not created. Not committed. Not pushed. PGlite, Postgres schema, menu, and HTTP stay out.

### RED

| Task | RED (command and result) |
|---|---|
| 3.1 | `pnpm exec vitest run --project inventory contexts/inventory/application/ports/producible-quantity-repository.contract.ts` exit 1. `FAIL contexts/inventory/application/ports/producible-quantity-repository.contract.ts` — `Cannot find module '#adapters/memory/in-memory-producible-quantity-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. |

### GREEN

| Task | GREEN (command and result) |
|---|---|
| 3.2 | Same command after `in-memory-producible-quantity-repository.ts` and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

## Work unit 3 evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/ports/producible-quantity-repository.contract.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Run after `pnpm exec biome check --write` on the contract and the memory store. |
| Runtime harness command/scenario and exact result | N/A. The memory store keeps an explode index in process. It does not open a socket, listen, read SQL, or append a stock movement. `pnpm architecture` exit 0 (`no dependency violations found`). The existing TypeScript 7 transpiler warning remains. |
| Rollback boundary | `contexts/inventory/application/ports/producible-quantity-repository.contract.ts`, `contexts/inventory/adapters/memory/in-memory-producible-quantity-repository.ts`, the inventory `include` entry in `vitest.config.ts`, and the two `producible-quantity-repository.contract.ts` exceptions in `.dependency-cruiser.cjs`. Reverting those removes this slice. The port, domain, projector, Postgres, SQLite, and schema stay. |

### Memory store

`InMemoryProducibleQuantityRepository` is read-only toward the ledger. `replaceIndex` keeps an explode index keyed by tenant, site, and ingredient. Replacing a product drops it from the previous ingredients and adds the new ones. `productsFor` and `find` return copies. `save` stores the projection for that tenant. Another tenant's index and projection stay hidden. `stockMovements` stays empty after index writes, saves, and reads. No Drizzle mock. No `append`.

- Burger on beef and bun, sandwich on beef: beef lists both, bun lists the burger, lemon lists nothing.
- Replacing the burger with cheese leaves the sandwich on beef and lists the burger under cheese.
- Tenant A stores the burger at 12 point units and 52 replenishment units. Tenant B stores the sandwich. Each read returns only that tenant's rows.
- After those writes, `stockMovements` for both tenants is empty.

### Deviations

The inventory Vitest project only included `**/*.test.ts`, so the requested command could not collect the contract. `vitest.config.ts` now includes this contract file. Application code cannot import adapters, so `.dependency-cruiser.cjs` treats this contract like a test: memory adapters are allowed, and Drizzle, apps, and other adapters stay forbidden. The port was not changed. The contract module registers the memory suite at load time so this file is the memory run. Task 3.3 should call the exported `producibleQuantityRepositoryContract` from its own runner. Importing this module also registers the memory cases in that runner.

### Deferred

PGlite, the Postgres schema, the menu flag, and cloud HTTP stay in tasks 3.3–5.2. No Nest, Drizzle, or Zod. `package.json` was not edited.

## Work unit 4

Work unit 4 of 6: Postgres read (tasks 3.3 and 3.4). Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. The failing PGlite contract was written and run before `drizzle-producible-quantity-repository.ts` existed.

Delivery: chained PR slice. Chain strategy: feature-branch-chain. Decision needed before apply: No. This batch is the Postgres read only. Intended PR 4, base PR 3. Not created. Not committed. Not pushed. Menu and HTTP stay out. `0004_transfers.sql` stays reserved for p2-05 and was not created.

### RED

| Task | RED (command and result) |
|---|---|
| 3.3 | `pnpm exec vitest run --project inventory contexts/inventory/application/ports/producible-quantity-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-producible-quantity-repository.contract.test.ts` exit 1. `FAIL contexts/inventory/adapters/postgres/drizzle-producible-quantity-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-producible-quantity-repository.js'`. `Test Files  1 failed | 1 passed (2)`. `Tests  3 passed (3)`. |

### GREEN

| Task | GREEN (command and result) |
|---|---|
| 3.4 | Same command after `0005_producible_quantity.sql`, the projection tables in `schema.ts`, `drizzle-producible-quantity-repository.ts`, and Biome: exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. |

## Work unit 4 evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/ports/producible-quantity-repository.contract.ts contexts/inventory/adapters/postgres/drizzle-producible-quantity-repository.contract.test.ts` — exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. The memory file contributes 3. The PGlite file contributes the same 3 contract cases plus the `stock_balances` read. Run after `pnpm exec biome check --write` on the Postgres files and the contract guard. |
| Runtime harness command/scenario and exact result | The PGlite file is the runtime harness. It applies `0001_recipe_catalog.sql`, `0002_stock_ledger.sql`, `0003_purchasing.sql`, and `0005_producible_quantity.sql`. Each repository call uses `SET LOCAL ROLE inventory_app` and `set_config('app.tenant_id', tenantId, true)`. Tenant B does not see tenant A's index or projection. `stock_movements` stays empty. A separate case reads `stock_balances` for tenant A (3000) and hides tenant B. No socket and no `listen`. |
| Rollback boundary | `contexts/inventory/adapters/postgres/0005_producible_quantity.sql`, the three `producible*` tables in `contexts/inventory/adapters/postgres/schema.ts`, `contexts/inventory/adapters/postgres/drizzle-producible-quantity-repository.ts`, `contexts/inventory/adapters/postgres/drizzle-producible-quantity-repository.contract.test.ts`, and the memory-suite guard at the bottom of `contexts/inventory/application/ports/producible-quantity-repository.contract.ts`. Reverting those removes this slice. Purchasing SQL, stock tables, SQLite, and the stock-ledger repositories stay. |

### Postgres read

`DrizzleProducibleQuantityRepository` stores the explode index and the projection. `variant_id` is empty when the product has no variant. Index order is the insert position. `replaceIndex` deletes that product's index rows, then appends the new ingredients. `save` replaces the quantity row and the limiting ingredient ids. On-hand stays in `stock_balances`; this repository does not insert into `stock_movements`.

The contract module registers the memory suite only when Vitest's current file is not the PGlite contract. The PGlite run calls `producibleQuantityRepositoryContract` once. The memory file still runs its own 3 tests. The suite is not registered twice.

### Deviations

The task text says the next SQL file after `0002_stock_ledger.sql`. `0003_purchasing.sql` already exists, and p2-05 reserves `0004_transfers.sql`, which is still absent. This slice adds `0005_producible_quantity.sql` and does not create `0004`. `schema.ts` gained only the three projection tables. Purchasing and stock tables were left in place. No SQLite file was added.

### Deferred

The menu flag and cloud HTTP stay in tasks 4.1–5.2. No Nest listener. `package.json` was not edited. Not committed.
