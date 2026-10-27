# Apply progress: p1-01-menu-and-catalog

Work units 1, 2, 3, 4, and 5. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: stacked-to-main. Unit 1 is PR 1 (tasks 1.1–1.2). Unit 2 is PR 2 (tasks 2.1–2.2). Unit 3 is PR 3 (tasks 3.1–3.4). Unit 4 is PR 4 (tasks 4.1–4.2). This batch is PR 5 and stops at tasks 5.1–5.2. Not committed. `size:exception` was not granted.

## Completed tasks

- [x] 1.1 RED `contexts/orders/domain/menu.test.ts`: variants, `MissingTaxClassification`, `ForeignModifier`, combo. Package `@blackhole/orders`, vitest project `orders`, root tsconfig reference, skeleton `allowedContexts`.
- [x] 1.2 GREEN `contexts/orders/domain/menu.ts` and `domain/index.ts`. Prices are integer COP. Identifiers use the `menu_` prefix. No Nest, SQL, Zod, or `node:crypto`.
- [x] 2.1 RED same test: quote 23,000; site price leaves the brand product; unavailable combo stays listed and is not orderable; outside the `HH:mm` window the item stays listed with `orderable: false`.
- [x] 2.2 GREEN `VenuePrice`, `Menu.setVenuePrice`, `Menu.quote`, and `Menu.viewAt`. The domain receives the minute. No tax math, `Intl`, Nest, SQL, or Zod.
- [x] 3.1 RED `application/update-menu/update-menu.test.ts`: `publishProduct`, `publishCombo`, `setVenuePrice`; a rejection does not save; a venue of another brand is rejected.
- [x] 3.2 GREEN `update-menu.ts`, `ports/menu-repository.ts` (`load`, `save`), `ports/venue-directory.ts`.
- [x] 3.3 RED `ports/menu-repository.contract.ts` and `adapters/memory/in-memory-menu-repository.contract.test.ts`: round-trip; a hidden tenant is not visible.
- [x] 3.4 GREEN `adapters/memory/in-memory-menu-repository.ts`. Imports `#application/update-menu/*`, `#application/ports/*`, and `#adapters/memory/*`.
- [x] 4.1 RED `application/view-venue-menu/view-venue-menu.test.ts`: other brand hidden; 12:00 not orderable. Bogota minute via `Intl`.
- [x] 4.2 GREEN `view-venue-menu.ts`, `adapters/memory/in-memory-venue-directory.ts`, `application/entry-port.ts`. Callers outside the context use `entry-port.ts` only.
- [x] 5.1 RED `adapters/postgres/drizzle-menu-repository.contract.test.ts`: PGlite, `orders_app`, forced RLS, hidden tenant, round-trip. No Drizzle mock. The test calls `menuRepositoryContract(...)`.
- [x] 5.2 GREEN `adapters/postgres/0001_menu.sql`, `schema.ts`, `drizzle-menu-repository.ts`. Not a platform migration. `Menu.venuePrices` is the read-only list the adapter replays.

## Work Unit Evidence

### Unit 1

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project orders menu.test` — exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. `pnpm vitest run --project skeleton` — exit 0. `Test Files  2 passed (2)`. `Tests  10 passed (10)`. |
| Runtime harness command/scenario and exact result | N/A, pure domain. The aggregate does not open files, sockets, or a database. |
| Rollback boundary | `contexts/orders`, the `orders` project in `vitest.config.ts`, the `contexts/orders` reference in `tsconfig.json`, and `allowedContexts` in `tools/skeleton/skeleton.test.ts`. |

### Unit 2

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project orders menu.test` — exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. `pnpm vitest run --project attendance worker-shift` — exit 0. `Test Files  1 passed (1)`. `Tests  13 passed (13)`. Attendance was not edited. |
| Runtime harness command/scenario and exact result | N/A, pure domain. Quote and the venue view do not open files, sockets, or a database. The minute arrives as an `HH:mm` string. |
| Rollback boundary | `quote`, `setVenuePrice`, `viewAt`, and `VenuePrice` in `contexts/orders/domain/menu.ts`, the `VenuePrice` export in `domain/index.ts`, and the four new cases in `menu.test.ts`. |

### Unit 3

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project orders update-menu in-memory-menu` — exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. `pnpm vitest run --project orders menu.test` — exit 0. `Test Files  2 passed (2)`. `Tests  15 passed (15)`. The `menu.test` filter also collected `update-menu.test.ts`. `pnpm vitest run --project attendance worker-shift project-hours` — exit 0. `Test Files  2 passed (2)`. `Tests  21 passed (21)`. Attendance was not edited. |
| Runtime harness command/scenario and exact result | N/A, memory ports. `UpdateMenu` and `InMemoryMenuRepository` do not open files, sockets, or a database. |
| Rollback boundary | `contexts/orders/application/update-menu`, `contexts/orders/application/ports/menu-repository.ts`, `menu-repository.contract.ts`, `venue-directory.ts`, `contexts/orders/adapters/memory`, the three new `package.json` import patterns, and the `application`/`adapters` entries in `contexts/orders/tsconfig.json`. Domain `menu.ts` stays. |

### Unit 4

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project orders view-venue-menu` — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. Same command after `pnpm biome check --write` on the touched files — exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. Regression `pnpm vitest run --project orders menu.test update-menu in-memory-menu` — exit 0. `Test Files  4 passed (4)`. `Tests  21 passed (21)`. The `menu.test` filter also collected `view-venue-menu.test.ts`. |
| Runtime harness command/scenario and exact result | N/A, memory Clock. `ViewVenueMenu` and `InMemoryVenueDirectory` do not open files, sockets, or a database. `Clock.now()` becomes the `America/Bogota` `HH:mm` minute inside the use case via `Intl`. The domain receives that minute. |
| Rollback boundary | `contexts/orders/application/view-venue-menu`, `contexts/orders/application/entry-port.ts`, `contexts/orders/application/ports/clock.ts`, `contexts/orders/adapters/memory/in-memory-venue-directory.ts`, the `#application/view-venue-menu/*` import, and the `./application/entry-port` package export. Domain `menu.ts` and the `UpdateMenu` test double stay. |

### Unit 5

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm vitest run --project orders drizzle-menu-repository` — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Same command after `pnpm biome check --write` on the touched files — exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Regression `pnpm vitest run --project orders menu.test update-menu in-memory-menu view-venue-menu` — exit 0. `Test Files  4 passed (4)`. `Tests  21 passed (21)`. |
| Runtime harness command/scenario and exact result | N/A, PGlite, no listen. Each test opens an in-process PGlite database, applies `0001_menu.sql`, and closes the client in `afterAll`. There is no live Postgres and no Drizzle mock. |
| Rollback boundary | `contexts/orders/adapters/postgres/0001_menu.sql`, `schema.ts`, `drizzle-menu-repository.ts`, `drizzle-menu-repository.contract.test.ts`, the `#adapters/postgres/*` import, the `catalog:` dependencies in `contexts/orders/package.json`, the orders importer lines in `pnpm-lock.yaml`, and the `venuePrices` getter in `contexts/orders/domain/menu.ts`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm vitest run --project orders menu.test` exit 1. `FAIL contexts/orders/domain/menu.test.ts` — `Cannot find module '#domain/menu.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/menu.ts` and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |
| 2.1 → 2.2 | `pnpm vitest run --project orders menu.test` exit 1. `Test Files  1 failed (1)`. `Tests  4 failed \| 6 passed (10)`. `menu.quote is not a function` and `menu.setVenuePrice is not a function`. | Same command after `VenuePrice` and `Menu.quote`: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |
| 3.1 → 3.2 | `pnpm vitest run --project orders update-menu` exit 1. `FAIL contexts/orders/application/update-menu/update-menu.test.ts` — `Cannot find module '#adapters/memory/in-memory-menu-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | The use case test imports the memory adapter from 3.4, so this file stayed red until that adapter existed. After 3.4, `pnpm vitest run --project orders update-menu in-memory-menu` exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. |
| 3.3 → 3.4 | `pnpm vitest run --project orders in-memory-menu` exit 1. `FAIL contexts/orders/adapters/memory/in-memory-menu-repository.contract.test.ts` — `Cannot find module '#adapters/memory/in-memory-menu-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same filter inside `pnpm vitest run --project orders update-menu in-memory-menu` after `in-memory-menu-repository.ts`: exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. |
| 4.1 → 4.2 | `pnpm vitest run --project orders view-venue-menu` exit 1. `FAIL contexts/orders/application/view-venue-menu/view-venue-menu.test.ts` — `Cannot find module '#adapters/memory/in-memory-venue-directory.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. `view-venue-menu.ts` and `clock.ts` were also absent; Vitest stopped at the first missing import. | Same command after `view-venue-menu.ts`, `in-memory-venue-directory.ts`, `clock.ts`, and `entry-port.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. Repeated after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  4 passed (4)`. |
| 5.1 → 5.2 | `pnpm vitest run --project orders drizzle-menu-repository` exit 1. `FAIL contexts/orders/adapters/postgres/drizzle-menu-repository.contract.test.ts` — `Cannot find module '#adapters/postgres/drizzle-menu-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. The import map already existed, so the failure is the missing module. | Same command after `0001_menu.sql`, `schema.ts`, `drizzle-menu-repository.ts`, and `Menu.venuePrices`: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. Repeated after Biome: exit 0. `Test Files  1 passed (1)`. `Tests  3 passed (3)`. |

## Deviations from Design

`Menu.quote` and `VenuePrice` are in PR 2. A foreign modifier is rejected by `Menu.attachLine` and also by `Menu.quote`. `InvalidMenuId` and `InvalidMenuPrice` enforce the `menu_` prefix and integer COP. A combo component that is not a published product throws `UnknownMenuReference`. The package has no dependencies, so `pnpm-lock.yaml` is unchanged.

`Menu.viewAt` is the domain read for one site at one minute. The design names the later use case `ViewVenueMenu` and does not name this method. The window `07:00`–`11:00` is inclusive of both minutes. `12:00` is outside, so the item stays listed with `orderable: false`. Another site with no override stays orderable. Quote does not apply the window: it uses the site price, else the brand price, plus modifiers, as an integer number of COP.

PR 3 adds these choices the design does not name:

- A brand with no stored menu opens as `menu_${brandId}` inside `UpdateMenu`. One menu per brand. The id still uses the `menu_` prefix.
- A venue whose brand is not the menu brand, including an unknown venue, throws `ForeignVenue` before `setVenuePrice`. Nothing is saved.
- `InMemoryMenuRepository` keeps the `Menu` instance. The contract reads products, combos, `quote`, and `viewAt`, because the domain does not expose the venue-price list. A later Postgres adapter has to rebuild that state to pass the same contract.
- `contexts/orders/tsconfig.json` now includes `application` and `adapters`.
- The import map was added before the first import of those folders. Task 3.4 names the same three patterns: `#application/update-menu/*`, `#application/ports/*`, `#adapters/memory/*`.

The use case test keeps its venue directory in the test file. `in-memory-venue-directory.ts` stays in task 4.2.

PR 4 adds these choices the design does not name:

- `application/ports/clock.ts` is `now(): number`, the same shape as attendance. Orders had no clock port. `Intl` stays in `ViewVenueMenu`. The domain still receives `HH:mm` and was not changed.
- Input is `tenantId` and `venueId` only. The brand comes from `VenueDirectory.brandOf`. An unknown venue returns `null` and does not load a menu. A venue of another brand loads only that brand. A read does not save.
- The noon case also publishes an item sold only at `12:00` and expects it orderable. Breakfast stays listed with `orderable: false`. A UTC minute of `17:00` fails that case. `2026-10-26T17:00:00.000Z` is 12:00 in `America/Bogota`.
- `entry-port.ts` re-exports `UpdateMenu` and `ViewVenueMenu`, plus `ForeignVenue` and the input types, so a later caller does not import the use case modules. The new test imports `ViewVenueMenu` from its module, matching `update-menu.test.ts`. Existing update-menu tests were not moved. There is no HTTP caller in this slice.
- The read test uses `InMemoryVenueDirectory`. `UpdateMenu`'s `MapVenueDirectory` stays in its own test.

PR 5 adds these choices the design does not name:

- `Menu.venuePrices` is a read-only copy of the stored `VenuePrice` list. `products` and `combos` were already public. The in-memory repository keeps the same instance, so it never read the list. Postgres deletes and inserts rows, then rebuilds with `Menu.open`, `publishProduct`, `publishCombo`, and `setVenuePrice`. `quote`, `viewAt`, windows, and price rules are unchanged.
- Primary keys include `tenant_id` (and `menu_id` on child tables). Organization uses a single global `id`. Two tenants can store the same menu-scoped id. `menus` also has `UNIQUE (tenant_id, brand_id)`.
- `GRANT SELECT, INSERT, DELETE` to `orders_app`. Save replaces a menu by deleting its rows and inserting the current tree, so `UPDATE` is not granted. The statement shape matches organization.
- `venue_prices` checks that `window_start` and `window_end` are both null or both set.

## Issues Found

Unit 3 is about 537 physical lines under `contexts/orders/application` and `contexts/orders/adapters`, plus the import map and the tsconfig include. That is over the 400-line default. The four tasks are one work unit and were finished together. `size:exception` was not granted. Engram was reported down in earlier batches; the file remains the source of progress.

Unit 4 has no implementation issue. The new files are 295 physical lines, plus the import pattern and the `entry-port` export. That stays under the 400-line default. `size:exception` was not granted.

Unit 5 is 663 changed lines (661 additions, 2 deletions): 620 physical lines in the four new Postgres files (`0001_menu.sql` 142, `schema.ts` 118, `drizzle-menu-repository.ts` 313, contract test 47), plus 17 lines for `venuePrices`, 9 additions and 2 deletions in `package.json`, and 15 lockfile lines. That is over the 400-line default. The two tasks are one work unit and were finished together. `size:exception` was not granted. `pnpm architecture` exit 0: `no dependency violations found (288 modules, 707 dependencies cruised)`. The TypeScript 7 `missing-typescript-transpiler` warning is the existing cruiser notice. Cruiser rules were not changed.

## Remaining Tasks

- [x] 7.1 through 7.3. The node returns 403 `MenuRejected` and stores nothing. Tasks 1.1–7.3 are complete. Hybrid copy, SQLite, the node clock, admin-web, and venue-app stay out of scope.

## Workload / PR Boundary

- Mode: stacked PR slice (`stacked-to-main`)
- Current work unit: 6 — cloud POST and GET
- Boundary: starts after the PGlite menu repository (tasks 5.1–5.2) and ends when cloud publish and venue read are green. Does not include the node 403, SQLite, or UI. Tasks 7.x stay open.
- Estimated review budget impact: about 1100 changed lines. Over the 400-line default. `size:exception` was not granted. The unit was finished because tasks 6.1–6.4 are the assigned slice.

## Work unit 6

Tasks 6.1–6.4. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`) with ADR-017 RED then GREEN. Threat matrix N/A. The node 403 was not started.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 6.1 | Test before `update-menu.controller.ts`. Exit 1, `Cannot find module '#src/http/update-menu.controller.js'`, 0 tests | — | — |
| 6.2 | Same command | Exit 0, 1 file, 6 tests | Biome, then the same command still exit 0, 6 tests |
| 6.3 | Test before `view-venue-menu.controller.ts`. Exit 1, `Cannot find module '#src/http/view-venue-menu.controller.js'`, 0 tests | — | — |
| 6.4 | Same command | Exit 0, 1 file, 4 tests | Biome, then POST and GET together exit 0, 2 files, 10 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project api-cloud update-menu.controller view-venue-menu.controller` → exit 0, 2 files, 10 passed. Bootstrap included in the later run: `pnpm vitest run --project api-cloud update-menu.controller view-venue-menu.controller bootstrap.test` → exit 0, 3 files, 13 passed |
| Typecheck | `pnpm exec tsc -b apps/api-cloud contexts/attendance --pretty false` → exit 0 |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (308 modules, 793 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler`. Cruiser rules were not changed |
| Runtime harness | N/A, `inject`, no `listen`. Each test builds the Nest app and closes it. No port is opened |
| Rollback | `apps/api-cloud` menu controllers, `organization-venue-directory.ts`, `postgres-menus.ts`, the module providers, `shared/contracts/menu.ts`, the orders package exports, and the domain error re-exports on `entry-port.ts` |

`POST /tenants/:tenantId/menu` requires `x-session-id` and `menu.edit`. An owner publishes a product and receives 200 `{ menuId, brandId }`. The audit action is `menu.edit`. `before` and `after` are `{ price }`. A brand edit uses the brand id as `siteId`. A site price uses the venue id. A cashier, and a site administrator editing another site, receive 403 `{ error: "MenuEditDenied" }` and nothing is saved. A body without a command is 400. A fractional price is 409 `{ error: "InvalidMenuPrice" }` and nothing is saved. The price is read before `UpdateMenu.execute`, because the memory repository keeps one menu instance.

`GET /tenants/:tenantId/venues/:venueId/menu` requires a session and does not require `menu.edit`. A pin session at 12:00 in `America/Bogota` sees Breakfast at 15,000 with `orderable: false` and the site burger at 22,000 with `orderable: true`. The same pin session reading another venue receives 403 `{ error: "MenuReadDenied" }`. A missing session is 400. A cashier administration session, which has no `menu.edit`, still receives 200.

## Work unit 7

Tasks 7.1–7.3. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`) with ADR-017 RED then GREEN. Threat matrix N/A. No SQLite and no menu store.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 7.1 | Test before `update-menu.controller.ts`. Exit 1, `Cannot find module '#src/http/update-menu.controller.js'`, 0 tests | — | — |
| 7.2 | Same command | Exit 0, 1 file, 1 test | Biome, then the same command still exit 0, 1 test |
| 7.3 | Skeleton list omitted the new controller | `pnpm vitest run --project skeleton skeleton.test.ts` exit 0, 1 file, 9 tests | — |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project local-node update-menu.controller` → exit 0, 1 file, 1 passed. Regression: `pnpm vitest run --project attendance --project local-node` → exit 0, 13 files, 52 passed |
| Typecheck | `pnpm exec tsc -b apps/local-node contexts/attendance --pretty false` → exit 0 |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (312 modules, 810 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler`. Cruiser rules were not changed |
| Runtime harness | N/A, `inject`, no `listen`. The test builds the Nest app and closes it. No port is opened and nothing is stored |
| Rollback | `apps/local-node/src/http/update-menu.controller.ts`, its registration in `application-module.ts`, and the skeleton allow-list entry |

`POST /tenants/:tenantId/menu` and `GET /tenants/:tenantId/venues/:venueId/menu` both return 403 `{ error: "MenuRejected" }`. `routePermissions["POST menu"]` is `menu.edit`. `ApplicationModule` providers and imports stay empty. The controller has no repository and no Zod.

About 75 physical lines: controller 28, test 42, module registration 4, skeleton 1. Under the 400-line default. `size:exception` was not granted.

## Deviations

`create-application.ts` is unchanged. `createApplication` already calls `ApplicationModule.register`, and the new `menus` and `digests` fields live on that dependency type. `postgresMenus` matches `postgresOrganizations`: it is a factory and `startApi` does not call it yet. Orders gained `"types": ["node"]` and `@types/node` so the new api-cloud project reference can compile the existing Postgres contract test. The controller imports use cases and domain rejections only from `@blackhole/orders/application/entry-port`. Ports and adapters stay package exports, the same shape platform already uses. `MenuEditDenied` and `MenuReadDenied` are the HTTP error names. The design requires 403 and does not name them. On the node, GET is rejected with the same `MenuRejected` body and is absent from `routePermissions`. Only `POST menu` is `menu.edit`.
