# Apply progress: p2-01-ingredients-and-recipes

Work unit 1 of 5: RecipeCatalog package (tasks 1.1, 1.2, and 1.3). Mode: Standard (`strict_tdd: false`) with ADR-017 RED then GREEN. `strict-tdd.md` was not loaded.

Delivery: feature-branch-chain. Branch `p2-01/recipe-catalog`. PR base `phase-2/inventory` (points at `origin/master`, `8816366`). Not committed. Not pushed. `size:exception` was not granted.

No previous apply-progress existed for this change.

## Completed tasks

- [x] 1.1 `@blackhole/inventory` package, root `tsconfig.json` reference, vitest project `inventory`.
- [x] 1.2 `contexts/inventory/domain/recipe-catalog.test.ts` written first and observed failing.
- [x] 1.3 `contexts/inventory/domain/recipe-catalog.ts` and `domain/index.ts`. `RecipeCatalog.open` id `recipe_catalog_<brandId>`. `BASE_UNIT` `g` / `ml` / `unit`. `QUANTITY_SCALE` 1000. `referenceCostCop`. `explode` returns scaled integers. Non-stocked sub-recipes expand. `RecipeCycle` on publish. No Nest, Drizzle, Zod, or `node:crypto`.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/recipe-catalog.test.ts` — exit 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`. The run is after `pnpm exec biome check --write` on `contexts/inventory`, `vitest.config.ts`, and `tsconfig.json`, and after the zero-factor guard was narrowed so only a factor of 0 throws `ZeroUnitFactor`. |
| Runtime harness command/scenario and exact result | N/A, pure domain. `RecipeCatalog` converts, publishes, and explodes in memory. It does not open files, sockets, or a database. |
| Typecheck | `pnpm exec tsc -b contexts/inventory --pretty false` — exit 0. |
| Import boundaries | `pnpm exec dependency-cruiser --output-type err contexts/inventory` — exit 0. `no dependency violations found (3 modules, 2 dependencies cruised)`. The TypeScript 7 transpiler warning is the known workspace warning. |
| Rollback boundary | `contexts/inventory/`, the `inventory` project in `vitest.config.ts`, the `contexts/inventory` reference in `tsconfig.json`, and the phase-1 marks in this change's `tasks.md` / `state.yaml` / `apply-progress.md`. |

### RED then GREEN

| Task | RED (command and result) | GREEN |
|---|---|---|
| 1.2 → 1.3 | `pnpm exec vitest run --project inventory contexts/inventory/domain/recipe-catalog.test.ts` exit 1. `FAIL contexts/inventory/domain/recipe-catalog.test.ts` — `Cannot find module '#domain/recipe-catalog.js'`. `Test Files  1 failed (1)`. `Tests  no tests`. Package shell from 1.1 was already in place so the import map resolved and the missing domain module failed the suite. | Same command after `domain/recipe-catalog.ts`, `domain/index.ts`, and Biome: exit 0. `Test Files  1 passed (1)`. `Tests  9 passed (9)`. Re-run after narrowing `assertFactor`: same result. |

Scenarios covered: zero purchase factor names `50 kg sack` and stores nothing; 2 × 50 kg sack (50000 g) converts to `100000 * QUANTITY_SCALE`; 150 g onion at 75% yield explodes to `200 * QUANTITY_SCALE`; variant `double` is selected; non-stocked bechamel (40 g butter × 2 batches) explodes to `80 * QUANTITY_SCALE`; sauce A → sauce B → sauce A publish throws `RecipeCycle` and version 1 stays; extra cheese and no onion yield 60 g and 0 g; a −50 g delta on a 20 g line floors at 0; version 3 stays frozen when version 4 is published.

## Deviations from Design

Command quantities are whole base units (grams, millilitres, units, or batches). The catalog stores purchase and recipe factors, recipe net quantities, and modifier deltas as milli-units (`× QUANTITY_SCALE`). `convertPurchase` and `explode` return those scaled integers. `2 × 50000 g` is `100000 * 1000`.

A stocked sub-recipe does not expand. The collapsed line uses the sub-recipe id as `ingredientId` and the scaled batch quantity. Task 2.1 owns the test for that shape.

`contexts/inventory/tsconfig.json` does not set `types: ["node"]`. This package has no `@types/node` dependency. The domain does not import Node.

`tools/skeleton/skeleton.test.ts` still omits `inventory` from `allowedContexts`. Task 4.3 owns that allowlist. This slice does not edit it.

## Issues Found

Adding `contexts/inventory` makes the skeleton context-directory assertion fail until task 4.3 allows `inventory`. This batch did not run the skeleton project.

This work unit is about 1233 source lines (`recipe-catalog.ts` 771, `recipe-catalog.test.ts` 408, `index.ts` 25, package and tsconfig 22, plus 7 lines in the root vitest and tsconfig files). That is above the 400-line review budget. The assigned unit was the whole RecipeCatalog package. `size:exception` was not granted.

## Remaining Tasks

- [ ] 2.1 Failing tests: import row 17 saves nothing; older copy ignored; stocked sub-recipe stays collapsed.
- [ ] 2.2 Ports and memory adapters. No stock port.
- [ ] 2.3 Five use cases.
- [ ] 2.4 `entry-port.ts`.
- [ ] Phases 3–6.

## Workload / PR Boundary

- Mode: chained PR slice
- Chain strategy: feature-branch-chain
- Current work unit: 1 of 5, RecipeCatalog package
- Branch: `p2-01/recipe-catalog`
- PR base: `phase-2/inventory` (not `master`, not `feat/portal-customer-billing`)
- Boundary: tasks 1.1–1.3 only. No use cases, persistence, HTTP, or admin screens. No stock commands, stock tables, or ledger.
- Estimated review budget impact: about 1233 source lines. Above the 400-line budget. The change forecast stays High.
