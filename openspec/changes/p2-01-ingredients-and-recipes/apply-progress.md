# Apply progress: p2-01-ingredients-and-recipes

Tasks 1.1 through 6.1. Mode: Standard (`strict_tdd: false`). `strict-tdd.md` was not loaded. Admin-web has no vitest project, so task 6.1 is verified with `tsc -b`.

Delivery: feature-branch-chain. Current branch `p2-01/admin`. PR base `p2-01/node-http`. Not committed. Not pushed. Not retargeted to `master`, `phase-2/inventory`, or `feat/portal-customer-billing`. `size:exception` was not granted.

Previous apply-progress for tasks 1.1–5.6 was read and merged below. Those tasks stay complete. This batch adds task 6.1 only. Domain, Postgres, SQLite, and the node were not edited.

## Completed tasks

- [x] 1.1 `@blackhole/inventory` package, root `tsconfig.json` reference, vitest project `inventory`.
- [x] 1.2 `contexts/inventory/domain/recipe-catalog.test.ts` written first and observed failing.
- [x] 1.3 `contexts/inventory/domain/recipe-catalog.ts` and `domain/index.ts`. `RecipeCatalog.open` id `recipe_catalog_<brandId>`. `BASE_UNIT` `g` / `ml` / `unit`. `QUANTITY_SCALE` 1000. `referenceCostCop`. `explode` returns scaled integers. Non-stocked sub-recipes expand. `RecipeCycle` on publish. No Nest, Drizzle, Zod, or `node:crypto`.
- [x] 2.1 Failing use-case tests written first: import row 17 saves nothing; an older copy is ignored; a stocked sub-recipe stays collapsed.
- [x] 2.2 Five ports under `contexts/inventory/application/ports/` and memory adapters for both repositories. No stock port.
- [x] 2.3 Five use cases. One save writes version N+1 and one publication row. Margin 60 for cost 8000 and price 20000. A rejected import writes nothing.
- [x] 2.4 Exported from `contexts/inventory/application/entry-port.ts`. No stock command.
- [x] 3.1 Memory contract tests: round-trip, other tenant hidden, copy apply. Drizzle is not mocked. No Postgres, SQLite, HTTP, or admin screens.
- [x] 4.1 PGlite contract, then the Postgres recipe catalog. `inventory_app`, forced RLS, no stock tables. Drizzle is not mocked.
- [x] 4.2 SQLite contract, then the recipe copy repository. A missed publication keeps the last copy. An older or repeated version does not replace it. Drizzle is not mocked.
- [x] 4.3 Skeleton allowlist: `inventory` is an allowed context. The only sqlite adapter is `contexts/inventory/adapters/sqlite`. `shared/sync`, cursor, and outbox stay absent. Postgres is not on the local-node source list.
- [x] 5.1 Strict Zod command, import body, import report, cost, and publication payload in `shared/contracts/recipe-catalog.ts`, exported from `shared/contracts/index.ts`.
- [x] 5.2 `apps/api-cloud/test/http/recipe-catalog.controller.test.ts` written first and observed failing. Fastify `inject` only. No `listen`.
- [x] 5.3 `apps/api-cloud/src/http/recipe-catalog.controller.ts`. Catalog POST/GET, import POST, venue cost GET. `recipe.edit` and `inventory.view-cost`. Audit action `recipe.edit` records the version before and the version after.
- [x] 5.4 api-cloud Excel `RecipeWorkbook`. Site price and catalog ids go through `ViewVenueMenu` on `@blackhole/orders/application/entry-port`. Module, composition, and `@blackhole/inventory` dependency are wired. `postgresRecipeCatalogs` builds the Postgres catalog store. The HTTP tests use the in-memory catalog adapter. Drizzle is not mocked. api-cloud does not import sqlite.
- [x] 5.5 `apps/local-node/test/http/recipe-copy.controller.test.ts` written first and observed failing. Fastify `inject` only. No `listen`. POST is 403 `RecipeRejected`. GET returns the last stored copy. The node does not parse the body with Zod.
- [x] 5.6 `apps/local-node/src/http/recipe-copy.controller.ts`, `sqliteRecipeCopies`, and the skeleton source list. Startup still has no persistence provider. The node does not import the postgres adapter.
- [x] 6.1 Admin screens for ingredients, recipes, and Excel import on the cloud API. Theoretical cost and margin render only when the payload includes those fields.

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

Unit 1 deviations kept: command quantities are whole base units. The catalog stores factors, net quantities, and modifier deltas as milli-units (`× QUANTITY_SCALE`). `convertPurchase` and `explode` return those scaled integers. A stocked sub-recipe does not expand; task 2.1 owns that test. At the end of unit 1, `contexts/inventory/tsconfig.json` did not set `types: ["node"]`. Task 4.1 sets it. `tools/skeleton/skeleton.test.ts` still omits `inventory` until task 4.3.

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

## Work unit: Postgres catalog (task 4.1)

Task 4.1 only. Branch `p2-01/postgres`. PR base `p2-01/port-contract`. The copy repository, skeleton allowlist, HTTP, and admin screens are not in this batch.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory` — exit 0. `Test Files  9 passed (9)`. `Tests  23 passed (23)`. The run is after `pnpm exec biome check --write` on `contexts/inventory/adapters/postgres` and `contexts/inventory/tsconfig.json`. |
| Runtime harness command/scenario and exact result | PGlite executes `contexts/inventory/adapters/postgres/0001_recipe_catalog.sql`. The shared `recipeCatalogRepositoryContract` runs against `DrizzleRecipeCatalogRepository`. A second case inserts ingredients for tenants A and B, `SET ROLE inventory_app`, sets `app.tenant_id` to tenant A, and selects without a tenant filter. Only tenant A's ingredient returns. |
| Typecheck | `pnpm exec tsc -b contexts/inventory --pretty false` — exit 0. |
| Import boundaries | `pnpm exec dependency-cruiser --output-type err contexts/inventory` — exit 0. `no dependency violations found (34 modules, 73 dependencies cruised)`. The TypeScript 7 transpiler warning is the known workspace warning. |
| Rollback boundary | `contexts/inventory/adapters/postgres/`, the `#adapters/postgres/*` import and the postgres repository export in `contexts/inventory/package.json`, the `types: ["node"]` entry in `contexts/inventory/tsconfig.json`, the inventory importer in `pnpm-lock.yaml`, and the task 4.1 mark in this change's `tasks.md` and `apply-progress.md`. |

### RED then GREEN (task 4.1)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.1 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-recipe-catalog-repository.contract.test.ts` exit 1. `FAIL contexts/inventory/adapters/postgres/drizzle-recipe-catalog-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-recipe-catalog-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The package import map already resolved `#adapters/postgres/*`. | `pnpm exec vitest run --project inventory` after the SQL migration, Drizzle schema, repository, and Biome: exit 0. `Test Files  9 passed (9)`. `Tests  23 passed (23)`. |

Scenarios covered in task 4.1:

- A published catalog with onion (150 g at 75% yield, reference cost 80) and modifier `extra cheese` (+30 g) is saved in PGlite. Load returns that catalog at version 1. Explode without the modifier is `200 * QUANTITY_SCALE` of onion. Explode with the modifier adds `30 * QUANTITY_SCALE` of cheese. `listPublications` returns that one publication. Another brand loads as null and lists no publications.
- Tenants A and B share a brand id and save different recipe ids. Each load and each publication list contains only that tenant's recipe. The repository sets `SET LOCAL ROLE inventory_app` and `set_config('app.tenant_id', ..., true)` and does not add a tenant predicate to the brand read, so the other tenant stays hidden by forced RLS.
- `inventory_app` selects `ingredients` with no tenant filter after the session tenant is A. Only `ingredient_onion` returns.

No stock table is created. `api-cloud` can import the postgres adapter through the package export. `local-node` is not wired to it. `tools/skeleton/skeleton.test.ts` was not edited.

## Work unit: SQLite recipe copy (task 4.2)

Task 4.2 only. Branch `p2-01/sqlite`. PR base `p2-01/postgres`. The skeleton allowlist, HTTP, and admin screens are not in this batch. The Postgres catalog repository was not edited.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory` — exit 0. `Test Files  10 passed (10)`. `Tests  26 passed (26)`. The run is after `pnpm exec biome check --write` on `contexts/inventory/adapters/sqlite` and `contexts/inventory/package.json`, and after a second `pnpm exec tsc -b contexts/inventory --pretty false` — exit 0. |
| RED command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/adapters/sqlite/drizzle-recipe-copy-repository.contract.test.ts` — exit 1. `FAIL contexts/inventory/adapters/sqlite/drizzle-recipe-copy-repository.contract.test.ts` — `Cannot find module '#adapters/sqlite/drizzle-recipe-copy-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The package import map already resolved `#adapters/sqlite/*`. |
| Runtime harness command/scenario and exact result | `node:sqlite` `DatabaseSync` executes `contexts/inventory/adapters/sqlite/0001_recipe_copy.sql` on an in-memory database. The shared `recipeCopyRepositoryContract` runs against `DrizzleRecipeCopyRepository`. A later case stores a full version 3 copy and does not apply version 4. Load still returns version 3. Node prints `ExperimentalWarning: SQLite is an experimental feature`. |
| Typecheck | `pnpm exec tsc -b contexts/inventory --pretty false` — exit 0. |
| Import boundaries | `pnpm exec dependency-cruiser --output-type err contexts/inventory` — exit 0. `no dependency violations found (43 modules, 93 dependencies cruised)`. The TypeScript 7 transpiler warning is the known workspace warning. |
| Rollback boundary | `contexts/inventory/adapters/sqlite/`, the `#adapters/sqlite/*` import and the sqlite repository export in `contexts/inventory/package.json`, and the task 4.2 mark in this change's `tasks.md` and `apply-progress.md`. |

### RED then GREEN (task 4.2)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.2 | `pnpm exec vitest run --project inventory contexts/inventory/adapters/sqlite/drizzle-recipe-copy-repository.contract.test.ts` exit 1. `Cannot find module '#adapters/sqlite/drizzle-recipe-copy-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | `pnpm exec vitest run --project inventory` after the SQL copy schema, Drizzle schema, `node:sqlite` session, repository, and Biome: exit 0. `Test Files  10 passed (10)`. `Tests  26 passed (26)`. |

Scenarios covered in task 4.2:

- A stored copy at version 1 is replaced by version 4. Version 3 and a repeated version 4 do not replace it. Another brand loads as null.
- Tenants A and B each keep their own copy for the same brand id. Loading one tenant does not return the other tenant's publication.
- A node holds version 3, including onion (purchase factor `50000 * QUANTITY_SCALE`), variant `double`, an ingredient line, a stocked bechamel line, modifier `extra cheese`, and an empty modifier. Version 4 is not applied. Load still returns that version 3 copy.

The copy tables are `recipe_copies`, `recipe_copy_ingredients`, `recipe_copy_units`, `recipe_copy_recipes`, `recipe_copy_lines`, `recipe_copy_modifiers`, and `recipe_copy_deltas`. They are not the cloud catalog tables. No stock table is created. `api-cloud` does not import this adapter. `local-node` is not wired to it. `tools/skeleton/skeleton.test.ts` was not edited in task 4.2.

## Work unit: Skeleton allowlist (task 4.3)

Task 4.3 only. Branch `p2-01/skeleton`. PR base `p2-01/sqlite`. HTTP and admin screens are not in this batch. Recipe domain, use cases, Postgres, and the SQLite repository were not edited. `shared/sync` was not created.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project skeleton` — exit 0. `Test Files  2 passed (2)`. `Tests  10 passed (10)`. The run is after `pnpm exec biome check --write tools/skeleton/skeleton.test.ts`. |
| Inventory regression | `pnpm exec vitest run --project inventory` — exit 0. `Test Files  10 passed (10)`. `Tests  26 passed (26)`. Node prints `ExperimentalWarning: SQLite is an experimental feature`. |
| RED command and exact result | Before the allowlist change, `pnpm exec vitest run --project skeleton` — exit 1. `Test Files  1 failed \| 1 passed (2)`. `Tests  2 failed \| 8 passed (10)`. Context directories included `inventory`, and deferred copies listed the five files under `contexts/inventory/adapters/sqlite`. After the failing assertions and before the allowlist change, `pnpm exec vitest run --project skeleton tools/skeleton/skeleton.test.ts` — exit 1. `expected [ 'attendance', 'cash-register', …(3) ] to include 'inventory'`. `expected` the recipe copy repository path `to be undefined` because that file was still a deferred copy. `Test Files  1 failed (1)`. `Tests  2 failed \| 7 passed (9)`. |
| Runtime harness command/scenario and exact result | N/A. The skeleton test reads the tree. It does not open Postgres, SQLite, or a socket. |
| Rollback boundary | `tools/skeleton/skeleton.test.ts` and the task 4.3 mark in this change's `tasks.md` and `apply-progress.md`. |

### RED then GREEN (task 4.3)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 4.3 | `pnpm exec vitest run --project skeleton tools/skeleton/skeleton.test.ts` exit 1. `allowedContexts` did not include `inventory`. The sqlite recipe copy repository was still a deferred copy. `Tests  2 failed \| 7 passed (9)`. | `pnpm exec vitest run --project skeleton` after adding `inventory` and exempting only `contexts/inventory/adapters/sqlite`: exit 0. `Test Files  2 passed (2)`. `Tests  10 passed (10)`. `pnpm exec vitest run --project inventory` stayed exit 0. `Test Files  10 passed (10)`. `Tests  26 passed (26)`. |

`allowedContexts` now lists attendance, cash-register, inventory, invoicing, orders, and platform. A path segment named `sqlite` is ignored only inside `contexts/inventory/adapters/sqlite`. `cursor`, `outbox`, and `pairing` stay rejected, including inside that folder. `contexts/platform/adapters/sqlite` stays absent. `shared/sync` stays absent. The local-node source list is unchanged, so the Postgres adapter is not a node source.

## Work unit: Cloud recipe HTTP (tasks 5.1–5.4)

Tasks 5.1, 5.2, 5.3, and 5.4 only. Branch `p2-01/cloud-http`. PR base `p2-01/skeleton`. Local-node HTTP (5.5, 5.6) and admin screens (6.1) are not in this batch. Domain, use cases, Postgres repository, SQLite copy, and the skeleton allowlist were not edited.

| Evidence | Required value |
|---|---|
| RED command and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/recipe-catalog.controller.test.ts` — exit 1. `FAIL apps/api-cloud/test/http/recipe-catalog.controller.test.ts` — `Cannot find module '#src/http/recipe-catalog.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. Contracts, the api-cloud inventory dependency, and the test file were already in place. |
| Focused test command and exact result | Same command after the controller, Excel workbook, menu price adapter, module wiring, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. Routes mapped with `inject` and no `listen`: catalog POST, import POST, catalog GET, and venue cost GET. |
| Inventory regression | `pnpm exec vitest run --project inventory` — exit 0. `Test Files  10 passed (10)`. `Tests  26 passed (26)`. Node prints `ExperimentalWarning: SQLite is an experimental feature`. |
| Bootstrap | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/composition/bootstrap.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Startup still has no persistence dialect. |
| Typecheck | `pnpm exec tsc -b apps/api-cloud shared/contracts --pretty false` — exit 0. |
| Import boundaries | `pnpm exec dependency-cruiser --output-type err apps/api-cloud shared/contracts` — exit 0. `no dependency violations found (262 modules, 1189 dependencies cruised)`. The TypeScript 7 transpiler warning is the known workspace warning. api-cloud does not import sqlite. |
| Rollback boundary | `shared/contracts/recipe-catalog.ts` and its export, `apps/api-cloud` recipe HTTP, Excel workbook, menu price adapter, venue directory adapter, `postgresRecipeCatalogs`, the module and bootstrap provider list, the `@blackhole/inventory` and `xlsx` dependencies, and the task 5.1–5.4 marks in this change's `tasks.md` and `apply-progress.md`. |

### RED then GREEN (tasks 5.1–5.4)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 5.2 → 5.3 | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/recipe-catalog.controller.test.ts` exit 1. `Cannot find module '#src/http/recipe-catalog.controller.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the controller and adapters: exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |

Scenarios covered in this batch:

- An owner publishes onion and burger. The response is 200 with version 1 and author `user_owner`. The catalog id is `recipe_catalog_<brandId>`. GET returns that publication. The audit action is `recipe.edit` with `before.version` null and `after.version` 1.
- A site administrator publishes. The response is 403 `{ error: "RecipeEditDenied" }`. Nothing is saved and no audit is written.
- A waiter requests cost after the owner published the recipe and the menu price 20000. The response is 403 `{ error: "CostViewDenied" }`. The body has no `costCop`, `marginPercent`, `8000`, or `20000`.
- The owner views that dish. The response is 200 `{ costCop: 8000, marginPercent: 60 }`.
- Import of a workbook whose recipe line on row 17 names an unknown ingredient returns 409 `{ error: "RecipeImportRejected", rows: [{ row: 17, reason: "Unknown ingredient." }] }`. Nothing is saved.
- An unknown field on the catalog command is 400. A purchase factor of 0 is 409 `{ error: "ZeroUnitFactor" }`.

The Excel workbook reads sheets `ingredients` and `recipes`. Ingredient columns are `id`, `name`, `baseUnit`, `purchaseUnit`, `purchaseBaseQuantity`, `recipeUnit`, `recipeBaseQuantity`, and `referenceCostCop`. Recipe columns are `recipeId`, `recipeName`, `productId`, `variantId`, `kind`, `ingredientId`, `subRecipeId`, `stocked`, `netQuantity`, and `yieldPercent`. Blank rows keep their spreadsheet row number. The import body is `{ contents: base64 }`.

`MenuSitePrice` calls `ViewVenueMenu` from `@blackhole/orders/application/entry-port` and matches the product or combo id. `postgresRecipeCatalogs` returns `DrizzleRecipeCatalogRepository`. The Nest default stays the in-memory catalog so startup has no dialect. HTTP tests pass that in-memory adapter. Drizzle is not mocked.

## Work unit: Node recipe copy HTTP (tasks 5.5–5.6)

Tasks 5.5 and 5.6 only. Branch `p2-01/node-http`. PR base `p2-01/cloud-http`. Admin screens (6.1) are not in this batch. Domain, use cases, Postgres repository, and the SQLite copy tables were not redesigned. `shared/sync` was not created.

| Evidence | Required value |
|---|---|
| RED command and exact result | `pnpm exec vitest run --project local-node apps/local-node/test/http/recipe-copy.controller.test.ts` — exit 1. `FAIL apps/local-node/test/http/recipe-copy.controller.test.ts` — `Cannot find module '#src/composition/recipe-copies.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The local-node inventory dependency was already linked. |
| Focused test command and exact result | Same command after the controller, `sqliteRecipeCopies`, module registration, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. Routes mapped with `inject` and no `listen`: recipe-catalog POST and GET. Node prints `ExperimentalWarning: SQLite is an experimental feature`. |
| Local-node regression | `pnpm exec vitest run --project local-node` — exit 0. `Test Files  13 passed (13)`. `Tests  15 passed (15)`. |
| Inventory regression | `pnpm exec vitest run --project inventory` — exit 0. `Test Files  10 passed (10)`. `Tests  26 passed (26)`. Node prints `ExperimentalWarning: SQLite is an experimental feature`. |
| Skeleton | `pnpm exec vitest run --project skeleton` — exit 0. `Test Files  2 passed (2)`. `Tests  10 passed (10)`. |
| Cloud HTTP regression | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/recipe-catalog.controller.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  7 passed (7)`. |
| Typecheck | `pnpm exec tsc -b apps/local-node contexts/inventory --pretty false` — exit 0. |
| Import boundaries | `pnpm exec dependency-cruiser --output-type err apps/local-node` — exit 0. `no dependency violations found (36 modules, 73 dependencies cruised)`. The TypeScript 7 transpiler warning is the known workspace warning. The node does not import postgres. |
| Rollback boundary | `apps/local-node` recipe copy HTTP and `sqliteRecipeCopies`, the `@blackhole/inventory` dependency, the project reference, and `@types/node`, `prepareRecipeCopyDatabase`, the skeleton source list, the two cloud permission keys that match the existing Nest paths, and the task 5.5–5.6 marks in this change's `tasks.md` and `apply-progress.md`. |

### RED then GREEN (tasks 5.5–5.6)

| Task | RED (command and result) | GREEN |
|---|---|---|
| 5.5 → 5.6 | `pnpm exec vitest run --project local-node apps/local-node/test/http/recipe-copy.controller.test.ts` exit 1. `Cannot find module '#src/composition/recipe-copies.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after the controller and sqlite wiring: exit 0. `Test Files  1 passed (1)`. `Tests  1 passed (1)`. |

Scenarios covered in this batch:

- The node holds version 3 of the onion burger copy in SQLite. POST of a body with `version: 9` and an unknown command returns 403 `{ error: "RecipeRejected" }`. GET returns that version 3 copy. The stored copy is unchanged.
- GET for another brand returns 404.
- `ApplicationModule` providers and imports stay empty, so startup still has no persistence dialect. The test passes the sqlite repository into `createApplication`.
- The controller does not import Zod or `@blackhole/contracts`. The POST handler does not read the body.

`sqliteRecipeCopies` calls `prepareRecipeCopyDatabase` and returns `DrizzleRecipeCopyRepository`. The schema runs once, when `recipe_copies` is absent. `registerRecipeCopies` supplies that repository only when a caller has a client. The default `createApplication()` path does not open SQLite.

## Work unit: Admin catalog screens (task 6.1)

Task 6.1 only. Branch `p2-01/admin`. PR base `p2-01/node-http`. Domain, use cases, Postgres, SQLite, cloud HTTP, and the node were not edited. Cloud HTTP already exists on the parent commit.

| Evidence | Required value |
|---|---|
| Typecheck | `pnpm --filter @blackhole/admin-web exec tsc -b --pretty false` — exit 0. Re-run after Biome. |
| Lint | `pnpm exec biome check --write apps/admin-web` — exit 0. `Checked 18 files`. |
| Tests | N/A. `apps/admin-web` is not a vitest project. `strict_tdd` is false. No Zod in the browser. |
| Runtime harness | The screens call `GET` and `POST /tenants/:tenantId/brands/:brandId/recipe-catalog`, `POST .../recipe-catalog/import` with `{ contents: base64 }`, and `GET /tenants/:tenantId/venues/:venueId/recipes/:productId/cost`. The dev server proxies `/tenants` to `http://127.0.0.1:4310`. Session header `x-session-id`. |
| Rollback boundary | `apps/admin-web/src/router.tsx`, `apps/admin-web/src/home-screen.tsx`, `apps/admin-web/src/catalog/`, the `/tenants` proxy in `apps/admin-web/vite.config.ts`, and the task 6.1 mark in this change's `tasks.md`, `state.yaml`, and `apply-progress.md`. |

`recipeCostFromPayload` returns cost and margin only when both `costCop` and `marginPercent` are own finite numbers. `{ error: "CostViewDenied" }` has neither field, so the recipe screen prints the error name and no amount. A missing field is not rendered as zero. Ingredient reference cost stays on the ingredient list and is not labeled as theoretical cost. The import screen shows version, yields, and rejected rows. It does not invent a dish cost.

## Deviations from Design

Unit 1 deviations above still stand.

`referenceCostCop` is the cost of one purchase unit. Theoretical cost is `floor(explodedScaled * referenceCostCop / purchaseUnit.factor)`. A collapsed stocked line is costed from that sub-recipe's own exploded ingredients, then scaled by the collapsed batch quantity.

`ApplyRecipeCopy` keeps the stored copy when the incoming version is older or equal. The design names the older case. An equal version is treated as a replay and does not replace the copy. The copy contract now locks that replay.

`UpdateRecipeCatalog` commands are `upsertIngredient` and `upsertRecipe`. Execute publishes once. There is no modifier command and no stock command. Publication rows still carry `modifiers`, which stay empty unless the aggregate already has them.

`savePublishedVersion` is an internal helper used by update and import so both paths write one catalog version and one publication in the same `save`. It is not a sixth use case and it is not exported.

Unit 3 adds no further deviation. The catalog contract compares the public aggregate (identity, published version, explode, publication list). It does not require a new `RecipeCatalog` instance, matching the menu repository contract.

Task 4.1 keeps the eight design tables and does not add a JSON payload on `recipe_publications`. That row is the version header (`tenant_id`, `brand_id`, `version`, `author_id`). `listPublications` assembles ingredients, recipes, and modifiers from the normalized rows. `ingredients`, `unit_conversions`, and `modifier_deltas` carry a `version` column so a frozen version can be rebuilt. `recipes` and `recipe_lines` are the latest version. `recipe_versions` and `recipe_version_lines` keep every published recipe. A modifier with no deltas is one row whose ingredient and quantity are null.

The domain has no restore method, and this batch does not change it. Load opens a catalog and replays each published version through `upsertIngredient`, `upsertRecipe`, `upsertModifier`, and `publish`. That matches catalogs the domain can produce, because those commands replace by id and do not delete an ingredient, recipe, or modifier. `contexts/inventory/tsconfig.json` now sets `types: ["node"]`, matching the orders PGlite contract. Unit 1 had left that unset.

Task 4.2 stores one current publication per tenant and brand. It does not copy the eight cloud catalog tables. `drizzle-orm` 0.45.4 has no `drizzle-orm/node-sqlite` entry, so `contexts/inventory/adapters/sqlite/node-sqlite-database.ts` runs Drizzle's SQLite session on Node's `node:sqlite` `DatabaseSync`. `better-sqlite3` was not added. The SQL file and `schema.ts` follow the PGlite contract shape. The design named only the repository file.

This batch adds `prepareRecipeCopyDatabase` on the sqlite adapter so the node can apply `0001_recipe_copy.sql` without a relative import. The repository behavior is unchanged. An already migrated database is left as it is.

The permission scanner matches the Nest path. The cloud catalog POST paths are `brands/:brandId/recipe-catalog` and `brands/:brandId/recipe-catalog/import`. Those two keys were added beside the short names the cloud tests already read. Handlers were not changed. The node declares `POST brands/:brandId/recipe-catalog` as `recipe.edit` and still rejects every write.

## Issues Found

The in-memory catalog repository keeps the live aggregate. Import rejection validates unknown rows before any upsert, so a rejected file does not dirty the stored draft. A domain exception thrown after a later upsert on that same instance would change the draft before `save`. The Postgres repository reloads a new aggregate from the stored versions.

Work unit 2 is about 1360 lines and stays above the 400-line review budget. `size:exception` was not granted for that slice.

Work unit 3 is about 230 lines across four new files. It stays inside the 400-line budget. No adapter implementation changed.

Task 4.1 is about 1100 lines: the SQL migration, Drizzle schema, repository, PGlite contract, package export, lockfile importer, and `types: ["node"]`. That is above the 400-line review budget. The assigned slice is the whole cloud catalog repository, so the migration and the repository stay together. `size:exception` was not granted.

Task 4.2 is about 930 lines: the copy SQL, Drizzle schema, `node:sqlite` session, repository, contract, and the package import plus export. That is above the 400-line review budget. The assigned slice is the whole node copy repository, so the schema and the repository stay together. `size:exception` was not granted. Node 24 prints `ExperimentalWarning` for `node:sqlite`. The warning does not fail the inventory suite.

Task 4.3 now allows `inventory` and only `contexts/inventory/adapters/sqlite`. `shared/sync`, cursor, and outbox stay absent.

This batch adds one deviation. The design names the Postgres repository as the catalog store. `postgresRecipeCatalogs` is that store, matching `postgresMenus`. The Nest module still defaults to the in-memory catalog because startup must stay dialect-free and `startApi` has no database client. Callers pass `recipeCatalogs` when a Postgres client exists. The HTTP tests pass the in-memory adapter and do not mock Drizzle.

The design does not name Excel columns. The workbook adapter uses the two sheets and headers listed in the cloud HTTP work unit. The import HTTP body is strict JSON `{ contents: base64 }` so Zod can reject it with 400. The adapter still reads the decoded workbook bytes.

A menu variant has no separate price. `MenuSitePrice` returns the product price when the variant id is present on that product, and null when the product lists variants and the id is not among them.

The skeleton route scan was already red after the cloud controller: its POST keys did not match the Nest paths. This batch added the matching keys. The node copy route uses the Nest path from the start.

Task 6.1 does not add Zod to the browser. Response shapes are read with presence checks. A payload that has only one of `costCop` or `marginPercent` is treated as no theoretical cost, so the screen does not invent the missing number. The Vite dev server proxies `/tenants` to port 4310 because api-cloud does not enable CORS. The home route stays. Links live in the same page frame as the existing home screen. There is no new app shell. Task 6.1 is about 1600 non-blank lines, above the 400-line review budget. The assigned slice is the whole admin screen task. `size:exception` was not granted.

## Remaining Tasks

None. Tasks 1.1 through 6.1 are complete. Verify stays pending.

## Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: task 6.1, admin catalog screens
- Branch: `p2-01/admin`
- PR base: `p2-01/node-http` (not `master`, not `phase-2/inventory`, not `p2-01/cloud-http`, not `feat/portal-customer-billing`)
- Boundary: task 6.1 only. Admin router, home links, ingredient, recipe, and import screens, and the dev proxy for `/tenants`. No domain, Postgres, SQLite, cloud HTTP, or node changes.
- Estimated review budget impact: about 1600 non-blank lines under `apps/admin-web`. Above the 400-line budget. The assigned slice is the whole admin screen task, so the three screens stay together. `size:exception` was not granted.
