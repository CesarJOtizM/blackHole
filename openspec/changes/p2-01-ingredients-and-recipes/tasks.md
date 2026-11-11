# Tasks: Ingredients and Recipes

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 3500–5500 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Five PRs: domain, use cases, persistence, HTTP, admin-web |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | RecipeCatalog package | PR 1 | Domain tests. No stock. Base: phase-2/inventory. |
| 2 | Memory-port use cases | PR 2 | After 1. Read-only explode. |
| 3 | Postgres and SQLite | PR 3 | After 2. No stock tables. |
| 4 | Cloud and node HTTP | PR 4 | After 3. inject only. |
| 5 | Admin screens | PR 5 | After 4. Cost if present. |

## Phase 1: Domain

- [ ] 1.1 Add `@blackhole/inventory` (`contexts/inventory/package.json`, `tsconfig.json`), the root `tsconfig.json` reference, and vitest project `inventory`.
- [ ] 1.2 Failing `contexts/inventory/domain/recipe-catalog.test.ts`: zero factor, 100000 g, yield 200 g, variant, named cycle, cheese/onion, floor 0, frozen version N.
- [ ] 1.3 `contexts/inventory/domain/recipe-catalog.ts`: id `recipe_catalog_<brandId>`, `BASE_UNIT`, scale 1000, `referenceCostCop`, explode. Non-stocked lines expand. `RecipeCycle` on publish. No Nest, Drizzle, Zod, or `node:crypto`.

## Phase 2: Use cases with in-memory adapters

- [ ] 2.1 Failing tests: import row 17 saves nothing; older copy ignored; stocked sub-recipe stays collapsed.
- [ ] 2.2 Add the five ports under `contexts/inventory/application/ports/` and memory adapters for both repositories. No stock port.
- [ ] 2.3 Implement the five use cases. One transaction writes version N+1 and one `recipe_publications` row. Margin 60 for 8000/20000. Import writes nothing.
- [ ] 2.4 Export them from `contexts/inventory/application/entry-port.ts`. No stock command.

## Phase 3: Port contract

- [ ] 3.1 Memory contract tests: round-trip, hidden tenant, copy apply. Do not mock Drizzle.

## Phase 4: External adapters

- [ ] 4.1 PGlite contract, then `contexts/inventory/adapters/postgres/0001_recipe_catalog.sql`, `schema.ts`, and `drizzle-recipe-catalog-repository.ts`. `inventory_app`, forced RLS, no stock tables.
- [ ] 4.2 SQLite contract, then `contexts/inventory/adapters/sqlite/drizzle-recipe-copy-repository.ts`. A missed publication keeps the last copy.
- [ ] 4.3 `tools/skeleton/skeleton.test.ts`: allow `inventory` and only this sqlite adapter. `shared/sync` stays absent.

## Phase 5: HTTP entry

- [ ] 5.1 `shared/contracts/recipe-catalog.ts` and `index.ts`: strict Zod command, import report, cost, publication payload.
- [ ] 5.2 Failing `apps/api-cloud/test/http/recipe-catalog.controller.test.ts` via `inject`: owner 200; admin 403 `RecipeEditDenied`; waiter 403 `CostViewDenied`, no amounts; import 409; Zod 400; domain 409.
- [ ] 5.3 `apps/api-cloud/src/http/recipe-catalog.controller.ts`: catalog POST/GET, import POST, venue cost GET. Check `recipe.edit` and `inventory.view-cost`, then audit both versions.
- [ ] 5.4 api-cloud owns Excel `RecipeWorkbook` and calls `@blackhole/orders/application/entry-port` for price and catalog. Wire module, composition, dependency.
- [ ] 5.5 Failing `apps/local-node/test/http/recipe-copy.controller.test.ts`: POST 403 `RecipeRejected`; GET last copy. No Zod.
- [ ] 5.6 `apps/local-node/src/http/recipe-copy.controller.ts`, sqlite wiring, skeleton source list. Node must not import postgres.

## Phase 6: Admin web

- [ ] 6.1 `apps/admin-web/src/router.tsx`: ingredient, recipe, and import screens on the cloud API. Cost only when the payload includes it.
