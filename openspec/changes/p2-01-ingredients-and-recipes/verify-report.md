## Verification Report

**Change**: p2-01-ingredients-and-recipes
**Version**: N/A
**Mode**: Standard
**Workspace**: `c:\Users\csar-\Proyectos\blackHole-phase-2`
**Branch / commit**: `p2-01/admin` @ `914dd67e702541ac331762997d7fedbda6134f38`
**strict_tdd**: false (`strict-tdd-verify.md` was not loaded)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 18 |
| Tasks complete | 18 |
| Tasks incomplete | 0 |

Tasks 1.1 through 6.1 are checked in `tasks.md`. Proposal success criteria stay unchecked; they describe the pilot outcome and are not implementation tasks.

### Build & Tests Execution
**Build**: ✅ Passed (`pnpm typecheck` exit 0; `pnpm --filter @blackhole/admin-web build` exit 0)

```text
pnpm typecheck
exit 0
$ tsc -b

pnpm --filter @blackhole/admin-web build
exit 0
$ vite build
✓ 170 modules transformed.
✓ built in 398ms
dist/assets/index-DPuWh0t5.js  353.46 kB │ gzip: 110.93 kB
```

**Tests**: ✅ 44 passed / ❌ 0 failed / ⚠️ 0 skipped across the four requested vitest commands

```text
pnpm exec vitest run --project inventory
exit 0
Test Files  10 passed (10)
     Tests  26 passed (26)
Duration  5.17s
(node) ExperimentalWarning: SQLite is an experimental feature

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/recipe-catalog.controller.test.ts
exit 0
Test Files  1 passed (1)
     Tests  7 passed (7)
Duration  3.13s

pnpm exec vitest run --project local-node apps/local-node/test/http/recipe-copy.controller.test.ts
exit 0
Test Files  1 passed (1)
     Tests  1 passed (1)
Duration  2.46s
(node) ExperimentalWarning: SQLite is an experimental feature
Nest started in-process (inject). No listen.

pnpm exec vitest run --project skeleton
exit 0
Test Files  2 passed (2)
     Tests  10 passed (10)
Duration  933ms
```

**Lint**: ❌ Failed

```text
pnpm lint
exit 1
$ biome check .
Checked 724 files in 706ms. No fixes applied.
Found 651 errors.
Found 1 warning.
× Some errors were emitted while running checks.
[ELIFECYCLE] Command failed with exit code 1.
```

Visible diagnostics are formatter diffs that replace `␍` (CRLF) with LF on `package.json` and `tsconfig.json` files, including paths outside this change (`apps/customer-portal`, `apps/venue-app`, `contexts/cash-register`, `shared/ui`). Biome hid 632 diagnostics. `git config core.autocrlf` is `true`. The index stores LF (`i/lf`). The working tree has 1318 `w/crlf` paths. Sampled change sources that stayed LF: `contexts/inventory/domain/recipe-catalog.ts`, `apps/admin-web/src/catalog/cloud-recipe-api.ts`, `shared/contracts/recipe-catalog.ts`. `apps/admin-web/package.json` is `i/lf` and `w/crlf`.

**Architecture**: ✅ exit 0, with a known transpiler warning

```text
pnpm architecture
exit 0
✔ no dependency violations found (791 modules, 2632 dependencies cruised)
‼ missing-typescript-transpiler: TypeScript >=7 is outside dependency-cruiser's supported compiler range.
```

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available (`@vitest/coverage-v8` is not installed; `openspec/config.yaml` sets `coverage_threshold: 0`)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Ingredient Units | Purchase unit converts | `contexts/inventory/domain/recipe-catalog.test.ts` > given rice with a 50 kg sack of 50000 g, when 2 sacks are converted, then the result is 100000 g | ✅ COMPLIANT |
| Ingredient Units | Zero factor rejected | `contexts/inventory/domain/recipe-catalog.test.ts` > given an ingredient being edited, when a unit factor is set to 0, then the change is rejected naming the unit; also `apps/api-cloud/test/http/recipe-catalog.controller.test.ts` > … unit factor to 0 … 409 ZeroUnitFactor | ✅ COMPLIANT |
| Recipe per Product and Variant | Variant overrides product | `contexts/inventory/domain/recipe-catalog.test.ts` > given burger and variant double each with a recipe, when double is resolved, then the variant recipe is used | ✅ COMPLIANT |
| Recipe per Product and Variant | Yield applied | `contexts/inventory/domain/recipe-catalog.test.ts` > given 150 g net onion at 75 percent yield, when exploded for one unit, then 200 g gross onion is required | ✅ COMPLIANT |
| Sub-recipes Without Cycles | Sub-recipe expands | `contexts/inventory/domain/recipe-catalog.test.ts` > given lasagna uses non-stocked bechamel, when exploded, then bechamel ingredients appear scaled by the lasagna line | ✅ COMPLIANT |
| Sub-recipes Without Cycles | Cycle rejected | `contexts/inventory/domain/recipe-catalog.test.ts` > given sauce A uses sauce B, when sauce B is edited to use sauce A, then the publish is rejected naming the cycle | ✅ COMPLIANT |
| Modifier Adjustments | Extra and without | `contexts/inventory/domain/recipe-catalog.test.ts` > given burger uses 30 g cheese and 20 g onion, when exploded with extra cheese and no onion, then cheese is 60 g and onion is 0 g | ✅ COMPLIANT |
| Modifier Adjustments | Floor at zero | `contexts/inventory/domain/recipe-catalog.test.ts` > given a delta of -50 g on a 20 g line, when exploded, then the quantity is 0 g | ✅ COMPLIANT |
| Immutable Versions | Edit creates version | `contexts/inventory/domain/recipe-catalog.test.ts` > given version 3 is current, when an owner publishes a change, then version 4 is current and version 3 stays unchanged; `apps/api-cloud/test/http/recipe-catalog.controller.test.ts` > … audit records both versions | ✅ COMPLIANT |
| Immutable Versions | Unauthorized edit | `apps/api-cloud/test/http/recipe-catalog.controller.test.ts` > given a site administrator without recipe edit, when they publish, then the response is 403 RecipeEditDenied and nothing is saved | ✅ COMPLIANT |
| Distribution by Operating Mode | Version reaches node | `contexts/inventory/application/ports/recipe-copy-repository.contract.ts` > given a stored copy, when a newer copy is applied and then an older one, then the newer copy stays (memory and sqlite contract runs) | ✅ COMPLIANT |
| Distribution by Operating Mode | Outage keeps copy | `contexts/inventory/adapters/sqlite/drizzle-recipe-copy-repository.contract.test.ts` > given a node holding version 3, when version 4 is not applied, then version 3 stays; `contexts/inventory/application/apply-recipe-copy/apply-recipe-copy.test.ts` > given the node holds version 4, when an older copy is applied, then version 4 stays; reconnect apply is the newer-copy half of the copy contract | ✅ COMPLIANT |
| Excel Import | Valid import | `contexts/inventory/application/import-recipes/import-recipes.test.ts` > given a valid workbook, when it is imported, then the dish is published with version, yield and cost | ✅ COMPLIANT |
| Excel Import | Invalid row | `contexts/inventory/application/import-recipes/import-recipes.test.ts` > given row 17 has an unknown ingredient…; `apps/api-cloud/test/http/recipe-catalog.controller.test.ts` > … 409 RecipeImportRejected and nothing is saved | ✅ COMPLIANT |
| Theoretical Cost and Margin | Cost and margin | `contexts/inventory/application/view-theoretical-cost/view-theoretical-cost.test.ts` > given exploded cost 8000 COP and price 20000 COP…; `apps/api-cloud/test/http/recipe-catalog.controller.test.ts` > … cost 8000 and margin 60 | ✅ COMPLIANT |
| Theoretical Cost and Margin | Waiter sees no costs | `apps/api-cloud/test/http/recipe-catalog.controller.test.ts` > given a waiter session, when product cost is requested, then the response is 403 CostViewDenied and no amounts are returned | ✅ COMPLIANT |

**Compliance summary**: 16/16 scenarios compliant

Every row above is a test that passed in this run (`inventory` 26, cloud HTTP 7, node HTTP 1, skeleton 10). Admin-web has no vitest project; its screens are not the covering tests for these scenarios.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Ingredient units and scaled quantities | ✅ Implemented | `QUANTITY_SCALE = 1000`. `convertPurchase` of 2 × 50 kg returns `100_000 * QUANTITY_SCALE`. Zero factor throws `ZeroUnitFactor` and names the unit. |
| Variant, yield, sub-recipe, cycle, modifiers | ✅ Implemented | Domain tests assert variant selection, 200 g gross, expanded bechamel, `RecipeCycle`, 60 g / 0 g, and the floor at 0. |
| Immutable publish and audit | ✅ Implemented | Publish appends the next version. Controller action `recipe.edit` records `before.version` and `after.version` via `RecordAuditEvent`. Site admin without `recipe.edit` gets 403 `RecipeEditDenied`. |
| Cloud write, node copy | ✅ Implemented | Node POST returns 403 `RecipeRejected` and does not parse the body with Zod. GET returns the stored copy. `shared/sync` stays absent (skeleton test passed). |
| Excel import | ✅ Implemented | Unknown ingredient on row 17 is `RecipeImportRejected` and does not save. Valid import stores version 1, yield 100, and `referenceCostCop`. HTTP body is `{ contents: base64 }`. |
| Theoretical cost and margin | ✅ Implemented | 8000 COP and 20000 COP return margin 60. Waiter response has no `costCop`, `marginPercent`, `8000`, or `20000`. |
| Admin screens | ✅ Implemented, untested at runtime | Ingredient, recipe, and import screens call the cloud routes. `recipeCostFromPayload` returns cost only when both `costCop` and `marginPercent` are own finite numbers. Covered by `tsc -b` and the production build, not by a passing test. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| `RecipeCatalog` aggregate, id `recipe_catalog_<brandId>` | ✅ Yes | Domain open id matches. |
| Base unit `g` / `ml` / `unit` | ✅ Yes | `BASE_UNIT`. |
| `QUANTITY_SCALE = 1000` milli-units | ✅ Yes | Known representation. Spec prose says 100000 g; the passing assertion is `100_000 * 1000`. |
| `referenceCostCop` per purchase unit; margin `(price - cost) * 100 / price` | ✅ Yes | Stocked sub-recipe cost comes from that recipe's own ingredients, then the batch scale. |
| Permissions `recipe.edit` and `inventory.view-cost`; audit in the controller | ✅ Yes | No peso cap. |
| Price and catalog ids through `@blackhole/orders/application/entry-port` | ✅ Yes | `MenuSitePrice` calls `ViewVenueMenu`. |
| One publication row; `shared/sync` absent | ✅ Yes | Skeleton allowlist passed. Eight cloud tables, no stock tables. |
| Cost HTTP is cloud-only; node does not compute margin | ✅ Yes | |
| `ExplodeRecipe` reads only; no stock command | ✅ Yes | Stocked sub-recipe stays one collapsed line. |
| HTTP via `inject`, no `listen` | ✅ Yes | Both HTTP suites boot Nest in-process. |
| Domain imports no Nest, Drizzle, Zod, or `node:crypto` | ✅ Yes | No such imports under `contexts/inventory/domain`. |
| Postgres is the catalog store | ⚠️ Deviation | `postgresRecipeCatalogs` exists. Nest defaults to `InMemoryRecipeCatalogRepository` unless the caller passes `recipeCatalogs`. HTTP tests use that memory adapter. Startup stays dialect-free. Does not break a spec scenario. |
| SQLite repository file only | ⚠️ Deviation | `node:sqlite` `DatabaseSync` plus `0001_recipe_copy.sql` and copy tables (`recipe_copies` and children), not the eight cloud tables. `better-sqlite3` was not added. |
| Import workbook shape unnamed in the design | ⚠️ Deviation | Strict JSON `{ contents: base64 }`. Sheets `ingredients` and `recipes` with the columns recorded in `apply-progress.md`. |
| Older publication ignored | ⚠️ Extra rule | An equal version is also ignored as a replay. The spec requires the older version to be ignored. |
| Frozen version rebuild | ⚠️ Extra columns | `ingredients`, `unit_conversions`, and `modifier_deltas` store `version` so load can replay a frozen version. Design named the tables without that column. |
| Admin cost hidden unless the payload has it | ✅ Yes, untested | Both fields must be present. A `CostViewDenied` body has neither, so the screen prints the error and no amount. No admin-web test ran. |

### Issues Found
**CRITICAL**:
- `pnpm lint` exited 1. Biome reported 651 errors and 1 warning (`Checked 724 files in 706ms`). The shown errors are CRLF formatter mismatches. `core.autocrlf=true` checks out 1318 index-LF paths as CRLF, including `apps/admin-web/package.json`. This required command did not pass. The hidden warning was not identified because Biome truncated 632 diagnostics.

**WARNING**:
- Quantities are milli-units (`× 1000`). The purchase-conversion scenario's passing assertion is `100_000 * QUANTITY_SCALE`, not the literal integer 100000.
- Cloud Nest bootstrap uses the in-memory catalog unless a Postgres client is injected.
- Node copy persistence is a `node:sqlite` session and a separate copy schema. Node prints `ExperimentalWarning` for SQLite; the suites still exited 0.
- Excel import on the wire is JSON base64, not a raw workbook upload.
- Admin cost rendering requires both `costCop` and `marginPercent`. Task 6.1 has no runtime test.
- An equal recipe-copy version is treated as a replay and does not replace the stored copy.
- Version columns on ingredient, conversion, and modifier rows go beyond the design table list.
- The in-memory catalog keeps one live aggregate. A domain error after a later upsert could dirty that draft. The row-17 rejection is tested before any upsert. Postgres reloads from stored versions.
- Apply slices are above the 400-line review budget and `size:exception` was not granted (`apply-progress.md`). This does not fail a spec scenario.
- `pnpm architecture` exited 0 and reported no violations, and also printed `missing-typescript-transpiler` for TypeScript 7. That warning is already documented in `openspec/config.yaml`.

**SUGGESTION**:
- Give `recipeCostFromPayload` a test so the admin cost gate has runtime evidence.
- Run `pnpm lint` on an LF working tree so the gate measures this change rather than `core.autocrlf`.

### Verdict
FAIL
16/16 spec scenarios have a covering test that passed in this run, and typecheck, architecture, the four vitest commands, and the admin-web build exited 0. `pnpm lint` exited 1 (651 Biome format errors, CRLF in the working tree), which is CRITICAL.

### Orchestrator follow-up
The change files lint clean. `pnpm exec biome check` on the 59 TypeScript files in this change exited 0: `Checked 59 files in 54ms. No fixes applied.` The 651 errors belong to the rest of the checkout, where `core.autocrlf=true` turns the LF index into CRLF. They are not reformatted here. Archive gate for this change: PASS WITH WARNINGS.
