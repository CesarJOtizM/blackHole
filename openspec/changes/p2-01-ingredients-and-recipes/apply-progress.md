# Apply progress: p2-01-ingredients-and-recipes

Work units 1, 2, and 3 of 5. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. Current branch `p2-01/port-contract`. PR base `p2-01/use-cases` (commit `58c92ef`). Not committed. Not pushed. Not retargeted to `master`, `phase-2/inventory`, or `feat/portal-customer-billing`. `size:exception` was not granted.

Previous apply-progress for work units 1 and 2 was read and merged below. Tasks 1.1–2.4 stay complete.

## Completed tasks

- [x] 1.1 `@blackhole/inventory` package, root `tsconfig.json` reference, vitest project `inventory`.
- [x] 1.2 `contexts/inventory/domain/recipe-catalog.test.ts` written first and observed failing.
- [x] 1.3 `contexts/inventory/domain/recipe-catalog.ts` and `domain/index.ts`. `RecipeCatalog.open` id `recipe_catalog_<brandId>`. `BASE_UNIT` `g` / `ml` / `unit`. `QUANTITY_SCALE` 1000. `referenceCostCop`. `explode` returns scaled integers. Non-stocked sub-recipes expand. `RecipeCycle` on publish. No Nest, Drizzle, Zod, or `node:crypto`.
- [x] 2.1 Failing use-case tests written first: import row 17 saves nothing; an older copy is ignored; a stocked sub-recipe stays collapsed.
- [x] 2.2 Five ports under `contexts/inventory/application/ports/` and memory adapters for both repositories. No stock port.
- [x] 2.3 Five use cases. One save writes version N+1 and one publication row. Margin 60 for cost 8000 and price 20000. A rejected import writes nothing.
- [x] 2.4 Exported from `contexts/inventory/application/entry-port.ts`. No stock command.
- [x] 3.1 Memory contract tests: round-trip, other tenant hidden, copy apply. Drizzle is not mocked. No Postgres, SQLite, HTTP, or admin screens.

## Work unit 1 evidence

Work unit 1 of 5: RecipeCatalog package (tasks 1.1, 1.2, and 1.3). Branch at the time: `p2-01/recipe-catalog`. PR base `phase-2/inventory` (points at `origin/master`, `8816366`).

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/recipe-catalog.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`. The run is after `pnpm exec biome check --write` on `contexts/inventory`, `vitest.config.ts`, and `tsconfig.json`, and after the zero-factor guard was narrowed so only a factor of 0 throws `ZeroUnitFactor`. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `RecipeCatalog` converts, publishes, and explodes in memory. It does not open files, sockets, or a database. |
| Typecheck | `pnpm exec tsc -b contexts/inventory --pretty false` — exit 0. |
| Import boundaries | `pnpm exec dependency-cruiser --output-type err contexts/inventory` — exit 0. `no dependency violations found (3 modules, 2 dependencies cruised)`. The TypeScript 7 transpiler warning is the known workspace warning. |
| Rollback boundary | `contexts/inventory/`, the `inventory` project in `vitest.config.ts`, the `contexts/inventory` reference in `tsconfig.json`, and the phase-1 marks in this change's `tasks.md` / `state.yaml` / `apply-progress.md`. |

### RED then GREEN (unit 1)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.2 → 1.3 | `pnpm exec vitest run --project inventory contexts/inventory/domain/recipe-catalog.test.ts` exit 1. `FAIL contexts/inventory/domain/recipe-catalog.test.ts` — `Cannot find module '#domain/recipe-catalog.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. Package shell from 1.1 was already in place so the import map resolved and the missing domain module failed the suite. | Same command after `domain/recipe-catalog.ts`, `domain/index.ts`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`. Re-run after narrowing `assertFactor`: same result. |

Scenarios covered in unit 1: zero purchase factor names `50 kg sack` and stores nothing; 2 × 50 kg sack (50000 g) converts to `100000 * QUANTITY_SCALE`; 150 g onion at 75% yield explodes to `200 * QUANTITY_SCALE`; variant `double` is selected; non-stocked bechamel (40 g butter × 2 batches) explodes to `80 * QUANTITY_SCALE`; sauce A → sauce B → sauce A publish throws `RecipeCycle` and version 1 stays; extra cheese and no onion yield 60 g and 0 g; a −50 g delta on a 20 g line floors at 0; version 3 stays frozen when version 4 is published.

Unit 1 deviations kept: command quantities are whole base units. The catalog stores factors, net quantities, and modifier deltas as milli-units (`× QUANTITY_SCALE`). `convertPurchase` and `explode` return those scaled integers. A stocked sub-recipe does not expand; task 2.1 owns that test. `contexts/inventory/tsconfig.json` does not set `types: ["node"]`. `tools/skeleton/skeleton.test.ts` still omits `inventory` until task 4.3.

## Work unit 2 evidence

Work unit 2 of 5: memory-port use cases (tasks 2.1, 2.2, 2.3, and 2.4). Branch at the time: `p2-01/use-cases`. PR base `p2-01/recipe-catalog` (commit `4931ce8`).

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory` — exit 0. `Test Files  6 passed (6)`. `Tests  16 passed (16)`. The run is after `pnpm exec biome check --write contexts/inventory`. A second run after Biome matched that result. |
| Runtime harness command/scenario and exact result | N/A. Use cases run against in-memory repository adapters. They do not open files, sockets, Postgres, or SQLite. |
| Typecheck | `pnpm exec tsc -b contexts/inventory --pretty false` — exit 0. |
| Import boundaries | `pnpm exec dependency-cruiser --output-type err contexts/inventory` — exit 0. `no dependency violations found (22 modules, 55 dependencies cruised)`. The TypeScript 7 transpiler warning is the known workspace warning. |
| Rollback boundary | `contexts/inventory/application/`, `contexts/inventory/adapters/memory/`, the `#application` and `#adapters/memory` import map and exports in `contexts/inventory/package.json`, the `application` and `adapters` entries in `contexts/inventory/tsconfig.json`, and the phase-2 marks in this change's `tasks.md` and `apply-progress.md`. |

### RED then GREEN (unit 2)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 2.1 → 2.3 | `pnpm exec vitest run --project inventory` exit 1. Five suites failed to load: `Cannot find module '#adapters/memory/in-memory-recipe-catalog-repository.js'` and `Cannot find module '#adapters/memory/in-memory-recipe-copy-repository.js'`. `Test Files  5 failed | 1 passed (6)`. `Tests  9 passed (9)`. The domain suite from unit 1 still passed. The package import map already resolved `#` aliases. | Same command after ports, memory adapters, five use cases, `entry-port.ts`, and Biome: exit 0. `Test Files  6 passed (6)`. `Tests  16 passed (16)`. |

Scenarios covered in unit 2:

- Row 17 names an unknown ingredient. `RecipeImportRejected` reports `{ row: 17, reason: "Unknown ingredient." }`. `save` is not called. Version 1 and its single publication stay. The valid onion row in that file is not stored.
- A valid workbook publishes version 1 with yield 100 and the ingredient reference cost.
- The node holds publication version 4. Applying version 3 returns and keeps version 4.
- Lasagna uses stocked bechamel (2 batches). `ExplodeRecipe` returns one line `{ ingredientId: recipe_bechamel, quantity: 2 * QUANTITY_SCALE }` and does not add a publication.
- Version 1 is current. The next publish stores version 2 and exactly one new publication row. Version 1 stays frozen.
- 100 g at 80 COP per gram and site price 20000 show `{ costCop: 8000, marginPercent: 60 }`.
- Stocked bechamel (40 g butter at 10 COP, 2 batches) and price 2000 show `{ costCop: 800, marginPercent: 60 }`.

Unit 2 size note: about 1360 lines under `contexts/inventory/application` and `contexts/inventory/adapters/memory` (about 780 implementation, about 560 tests), plus the package import map and the tsconfig `include`. That is above the 400-line review budget. The assigned unit was the whole memory-port use-case slice. `size:exception` was not granted.

## Work unit 3 evidence

Work unit 3 of 5: port contract (task 3.1 only). Branch `p2-01/port-contract`. PR base `p2-01/use-cases` (commit `58c92ef`).

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory` — exit 0. `Test Files  8 passed (8)`. `Tests  20 passed (20)`. The run is after `pnpm exec biome check --write` on the four new contract files. |
| Runtime harness command/scenario and exact result | N/A. The contract runs the real in-memory repositories. It does not mock Drizzle and does not open Postgres, SQLite, HTTP, or a socket. |
| Typecheck | `pnpm exec tsc -b contexts/inventory --pretty false` — exit 0. |
| Import boundaries | `pnpm exec dependency-cruiser --output-type err contexts/inventory` — exit 0. `no dependency violations found (26 modules, 63 dependencies cruised)`. The TypeScript 7 transpiler warning is the known workspace warning. |
| Rollback boundary | The four new contract files under `contexts/inventory/application/ports/` and `contexts/inventory/adapters/memory/`, plus the phase-3 mark in this change's `tasks.md` and `apply-progress.md`. No adapter implementation file changed. |

### RED then GREEN (unit 3)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 3.1 | `pnpm exec vitest run --project inventory` exit 1. Two suites failed to load: `Cannot find module '#application/ports/recipe-catalog-repository.contract.js'` and `Cannot find module '#application/ports/recipe-copy-repository.contract.js'`. `Test Files  2 failed \| 6 passed (8)`. `Tests  16 passed (16)`. The domain and use-case suites from units 1 and 2 still passed. | Same command after the two port contracts, Biome, and no adapter edit: exit 0. `Test Files  8 passed (8)`. `Tests  20 passed (20)`. |

Scenarios covered in unit 3:

- A published catalog with onion (150 g at 75% yield, reference cost 80) and modifier `extra cheese` (+30 g) is saved. Load returns that catalog at version 1. Explode without the modifier is `200 * QUANTITY_SCALE` of onion. Explode with the modifier adds `30 * QUANTITY_SCALE` of cheese. `listPublications` returns that one publication. Another brand loads as null and lists no publications.
- Tenants A and B share a brand id and save different recipe ids. Each load and each publication list contains only that tenant's recipe. The other brand stays hidden.
- Copy apply stores version 1, replaces it with version 4, and keeps version 4 when version 3 or an equal version 4 is applied. Another brand loads as null.
- Tenants A and B each keep their own copy. Loading one tenant does not return the other tenant's publication.

The in-memory catalog and copy repositories already implemented these rules. Task 3.1 did not change their source.

## Deviations from Design

Unit 1 deviations above still stand.

`referenceCostCop` is the cost of one purchase unit. Theoretical cost is `floor(explodedScaled * referenceCostCop / purchaseUnit.factor)`. A collapsed stocked line is costed from that sub-recipe's own exploded ingredients, then scaled by the collapsed batch quantity.

`ApplyRecipeCopy` keeps the stored copy when the incoming version is older or equal. The design names the older case. An equal version is treated as a replay and does not replace the copy. The copy contract now locks that replay.

`UpdateRecipeCatalog` commands are `upsertIngredient` and `upsertRecipe`. Execute publishes once. There is no modifier command and no stock command. Publication rows still carry `modifiers`, which stay empty unless the aggregate already has them.

`savePublishedVersion` is an internal helper used by update and import so both paths write one catalog version and one publication in the same `save`. It is not a sixth use case and it is not exported.

Unit 3 adds no further deviation. The catalog contract compares the public aggregate (identity, published version, explode, publication list). It does not require a new `RecipeCatalog` instance, matching the menu repository contract. Postgres reconstruction stays in task 4.1 and can reuse this contract.

## Issues Found

The in-memory catalog repository keeps the live aggregate. Import rejection validates unknown rows before any upsert, so a rejected file does not dirty the stored draft. A domain exception thrown after a later upsert on that same instance would change the draft before `save`. Postgres reconstruction belongs to phase 4.

`tools/skeleton/skeleton.test.ts` still omits `inventory`. Task 4.3 owns that allowlist. This batch did not edit it and did not run the skeleton project.

Work unit 2 is about 1360 lines and stays above the 400-line review budget. `size:exception` was not granted for that slice.

Work unit 3 is about 230 lines across four new files. It stays inside the 400-line budget. No adapter implementation changed.

## Remaining Tasks

- [ ] 4.1 PGlite contract, then the Postgres recipe catalog repository. `inventory_app`, forced RLS, no stock tables.
- [ ] 4.2 SQLite contract, then the recipe copy repository. A missed publication keeps the last copy.
- [ ] 4.3 Skeleton allowlist for `inventory` and this sqlite adapter. `shared/sync` stays absent.
- [ ] Phase 5: Cloud and node HTTP. `inject` only.
- [ ] Phase 6: Admin screens. Cost only when the payload includes it.

## Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 3 of 5, port contract
- Branch: `p2-01/port-contract`
- PR base: `p2-01/use-cases` (not `master`, not `phase-2/inventory`, not `p2-01/recipe-catalog`, not `feat/portal-customer-billing`)
- Boundary: task 3.1 only. Memory contract tests for both repositories. No Postgres, SQLite, HTTP, admin screens, stock commands, stock ports, or stock tables. Drizzle is not mocked.
- Estimated review budget impact: about 230 lines. Inside the 400-line budget. The change forecast stays High because later units are larger.
