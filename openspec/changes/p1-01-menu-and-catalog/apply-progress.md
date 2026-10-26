# Apply progress: p1-01-menu-and-catalog

Work units 1, 2, and 3. Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

Delivery: stacked-to-main. Unit 1 is PR 1 (tasks 1.1–1.2). Unit 2 is PR 2 (tasks 2.1–2.2). This batch is PR 3 and stops at tasks 3.1–3.4. Not committed. `size:exception` was not granted.

## Completed tasks

- [x] 1.1 RED `contexts/orders/domain/menu.test.ts`: variants, `MissingTaxClassification`, `ForeignModifier`, combo. Package `@blackhole/orders`, vitest project `orders`, root tsconfig reference, skeleton `allowedContexts`.
- [x] 1.2 GREEN `contexts/orders/domain/menu.ts` and `domain/index.ts`. Prices are integer COP. Identifiers use the `menu_` prefix. No Nest, SQL, Zod, or `node:crypto`.
- [x] 2.1 RED same test: quote 23,000; site price leaves the brand product; unavailable combo stays listed and is not orderable; outside the `HH:mm` window the item stays listed with `orderable: false`.
- [x] 2.2 GREEN `VenuePrice`, `Menu.setVenuePrice`, `Menu.quote`, and `Menu.viewAt`. The domain receives the minute. No tax math, `Intl`, Nest, SQL, or Zod.
- [x] 3.1 RED `application/update-menu/update-menu.test.ts`: `publishProduct`, `publishCombo`, `setVenuePrice`; a rejection does not save; a venue of another brand is rejected.
- [x] 3.2 GREEN `update-menu.ts`, `ports/menu-repository.ts` (`load`, `save`), `ports/venue-directory.ts`.
- [x] 3.3 RED `ports/menu-repository.contract.ts` and `adapters/memory/in-memory-menu-repository.contract.test.ts`: round-trip; a hidden tenant is not visible.
- [x] 3.4 GREEN `adapters/memory/in-memory-menu-repository.ts`. Imports `#application/update-menu/*`, `#application/ports/*`, and `#adapters/memory/*`.

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

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.1 → 1.2 | `pnpm vitest run --project orders menu.test` exit 1. `FAIL contexts/orders/domain/menu.test.ts` — `Cannot find module '#domain/menu.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same command after `domain/menu.ts` and `domain/index.ts`: exit 0. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |
| 2.1 → 2.2 | `pnpm vitest run --project orders menu.test` exit 1. `Test Files  1 failed (1)`. `Tests  4 failed \| 6 passed (10)`. `menu.quote is not a function` and `menu.setVenuePrice is not a function`. | Same command after `VenuePrice` and `Menu.quote`: exit 0. `Test Files  1 passed (1)`. `Tests  10 passed (10)`. |
| 3.1 → 3.2 | `pnpm vitest run --project orders update-menu` exit 1. `FAIL contexts/orders/application/update-menu/update-menu.test.ts` — `Cannot find module '#adapters/memory/in-memory-menu-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | The use case test imports the memory adapter from 3.4, so this file stayed red until that adapter existed. After 3.4, `pnpm vitest run --project orders update-menu in-memory-menu` exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. |
| 3.3 → 3.4 | `pnpm vitest run --project orders in-memory-menu` exit 1. `FAIL contexts/orders/adapters/memory/in-memory-menu-repository.contract.test.ts` — `Cannot find module '#adapters/memory/in-memory-menu-repository.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. | Same filter inside `pnpm vitest run --project orders update-menu in-memory-menu` after `in-memory-menu-repository.ts`: exit 0. `Test Files  2 passed (2)`. `Tests  7 passed (7)`. |

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

## Issues Found

None in this slice. This work unit is about 537 physical lines under `contexts/orders/application` and `contexts/orders/adapters`, plus the import map and the tsconfig include. That is over the 400-line default. The four tasks are one work unit and were finished together. `size:exception` was not granted. Engram was reported down in earlier batches; the file remains the source of progress.

## Remaining Tasks

- [ ] 4.1 through 7.3, including venue read, Postgres, cloud HTTP, and the node 403.

## Workload / PR Boundary

- Mode: stacked PR slice (`stacked-to-main`)
- Current work unit: 3 — save path and memory contract
- Boundary: starts from quote and `VenuePrice` (tasks 2.1–2.2) and ends when `UpdateMenu` and the in-memory menu repository are green. Does not include `ViewVenueMenu`, Postgres, or HTTP.
- Estimated review budget impact: about 537 physical lines in the new application and adapter files, plus the import map and tsconfig include. Over the 400-line default. `size:exception` was not granted.
