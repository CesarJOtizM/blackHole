# Apply progress: p2-10-inventory-reports

**Mode**: Standard (`strict_tdd: false`). Failing test written first per ADR-017 and `openspec/config.yaml` `rules.apply`.
**Delivery**: `auto-chain` / `feature-branch-chain`
**Work unit**: 1 — Domain formulas (tasks 1.1–1.2). Intended PR 1, base: feature/tracker branch.
**Batch**: 1.1 and 1.2 only. No read models, inventory adapters, or HTTP.

## RED then GREEN

Command (both runs):

```text
pnpm exec vitest run --project reporting contexts/reporting/domain/metrics.test.ts
```

| Phase | Exit code | Result |
|-------|-----------|--------|
| RED | 1 | 6 failed, 6 passed (12). New cases threw `foodCostRatio is not a function` and `stockGap is not a function`. |
| GREEN | 0 | 12 passed (12). |

RED was recorded before `foodCostRatio` and `stockGap` existed. GREEN is the same command after the domain implementation.

## Work Unit Evidence

| Evidence | Required value |
|----------|----------------|
| Focused test command and exact result | `pnpm exec vitest run --project reporting contexts/reporting/domain/metrics.test.ts` — GREEN exit 0, 12 passed. RED exit 1, 6 failed / 6 passed. |
| Runtime harness command/scenario and exact result | N/A. This unit is a pure domain formula. No HTTP, database, or process boundary. |
| Rollback boundary | Revert `contexts/reporting/domain/metrics.test.ts`, `contexts/reporting/domain/metrics.ts`, and the new exports in `contexts/reporting/domain/index.ts`. Existing `netSalesCop`, duration, and percentile exports stay. |

## Completed tasks

- [x] 1.1 RED domain tests for food cost and stock gap
- [x] 1.2 GREEN `foodCostRatio` and `stockGap`, exported from the domain barrel

## Behavior locked

- `foodCostRatio` is `theoreticalCop / netSalesCop` on `[from, to)`. 3,200,000 / 10,000,000 stays the 32% ratio. A line at `to` is outside the window. `sale_return` nets the theoretical cost. An uncosted product is listed once and leaves both sides. Zero net sales returns `ratio: null`. Each in-range consumption keeps its `recipeVersion`.
- `stockGap` actual = opening + purchase + transfer_in + production_output − closing, between `[opening.approvedAt, closing.approvedAt)`. Theoretical = net sale consumption + production consumption. Waste is `wasteQuantity` on the same row. Difference value uses the closing `averageCostCop`. Fewer than two approved counts returns `{ status: "pending" }` and no zero row.
- No `count_adjustment` kind and no snapshot table.

## Deviations

Domain exclusion is by `productId` for this unit. A product with no in-range `sale_consumption` is uncosted. Per-line pairing of a charged sale to a consumption line stays with the read model (task 2.2).

## Remaining

Phase 2 is recorded below. Phases 3–4 remain (3.1–4.3).

## Work unit 2 — Reporting read models

**Mode**: Standard (`strict_tdd: false`). Failing tests written first per ADR-017 and `openspec/config.yaml` `rules.apply`.
**Delivery**: `auto-chain` / `feature-branch-chain`
**Work unit**: 2 — Reporting read models (tasks 2.1–2.6). Intended PR 2, base: PR 1 branch.
**Batch**: 2.1–2.6 only. No inventory reads and no HTTP.

## RED then GREEN

Command (both runs):

```text
pnpm exec vitest run --project reporting contexts/reporting/application/read-food-cost-report/read-food-cost-report.test.ts contexts/reporting/application/read-stock-gap-report/read-stock-gap-report.test.ts
```

| Phase | Exit code | Result |
|-------|-----------|--------|
| RED | 1 | 2 failed suites, no tests. Both files failed to load: `Cannot find module '#adapters/memory/in-memory-inventory-facts.js'`. The use cases were absent too. |
| GREEN | 0 | 11 passed (11). |

RED was recorded after the port and both test files, and before the use cases and the memory adapter. GREEN is the same command after those implementations.

## Work Unit Evidence

| Evidence | Required value |
|----------|----------------|
| Focused test command and exact result | `pnpm exec vitest run --project reporting contexts/reporting/application/read-food-cost-report/read-food-cost-report.test.ts contexts/reporting/application/read-stock-gap-report/read-stock-gap-report.test.ts` — GREEN exit 0, 11 passed. RED exit 1, 2 failed suites / no tests. |
| Runtime harness command/scenario and exact result | N/A. This unit is application read models over in-memory ports. No HTTP, database, or process boundary. |
| Rollback boundary | Remove `contexts/reporting/application/ports/inventory-facts.ts`, `contexts/reporting/application/read-food-cost-report/`, `contexts/reporting/application/read-stock-gap-report/`, and `contexts/reporting/adapters/memory/in-memory-inventory-facts.ts`. Revert the `inventory.view-cost` permission, the two entry-port exports, and the two folder imports in `contexts/reporting/package.json`. |

## Completed tasks

- [x] 2.1 Inventory facts port: movement lines, count fields, read only
- [x] 2.2 RED food cost access, one product row, uncosted lines, and sale-return cost
- [x] 2.3 GREEN `ReadFoodCostReport` with `inventory.view-cost` and the home venue
- [x] 2.4 RED stock gap: 40 vs 43, waste column, pending, duplicate id, no append
- [x] 2.5 GREEN `ReadStockGapReport`; pending replaces rows
- [x] 2.6 In-memory inventory facts, entry-port exports, folder imports

## Behavior locked

- Food cost is per venue. Another venue is `other_venue`. A waiter is `missing_permission` even when the access port would allow the actor. Missing `inventory.view-cost` is `missing_permission`.
- A charged line is costed only when a `sale_consumption` shares its `orderLineId`. One product id is one row. Recipe versions on those lines are kept. An uncosted line, including a repeated product id, stays off both sides and is listed once. A voided line is ignored.
- Cost is `foodCostRatio`: `abs(quantity) * unitCost`, and `sale_return` nets it. A repeated movement id counts once. A line at `to` stays outside the half-open window.
- Stock gap calls `stockGap`. 40 kg theoretical against 43 kg actual is 3 kg at the closing `averageCostCop` (difference value 3,000 when that cost is 1,000). Waste stays in `wasteQuantity`. Only an opening count is `{ status: "pending" }`. A second ingredient with only an opening count replaces every row with pending. A repeated movement id counts once. The memory adapter has no `append` or `write`, and reading does not grow the stored lines.

## Deviations

`InventoryCountFact` keeps `locationId`, `ingredientId`, `quantity`, and `approvedAt`, and also carries `averageCostCop`. The domain gap values the difference from the closing count, and this read model does not replay purchases to derive that average.

## Remaining

Phases 3–4 were untouched at the end of work unit 2 (3.1–4.3). Work unit 3 starts below.

## Work unit 3 — Inventory reads

**Mode**: Standard (`strict_tdd: false`). Failing test written first per ADR-017 and `openspec/config.yaml` `rules.apply`.
**Delivery**: `auto-chain` / `feature-branch-chain`
**Work unit**: 3 — Inventory reads (tasks 3.1–3.2 of 3.1–3.5). Intended PR 3, base: PR 2 branch.
**Batch**: 3.1 and 3.2 only. No memory, PostgreSQL, or SQLite `listByVenue`. No HTTP.

## RED

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/list-venue-stock-facts/list-venue-stock-facts.test.ts
```

| Phase | Exit code | Result |
|-------|-----------|--------|
| RED | 1 | 1 failed suite, no tests. The file failed to load: `Cannot find module '#application/list-venue-stock-facts/list-venue-stock-facts.js'`. |

RED was recorded after the test file and before `ListVenueStockFacts` and `ApprovedCountFacts` existed.

## GREEN

Same command after the use case, the count port, and `listByVenue` on the ledger port.

| Phase | Exit code | Result |
|-------|-----------|--------|
| GREEN | 0 | 3 passed (3). |

## Work Unit Evidence

| Evidence | Required value |
|----------|----------------|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/list-venue-stock-facts/list-venue-stock-facts.test.ts` — GREEN exit 0, 3 passed. RED exit 1, 1 failed suite / no tests. |
| Runtime harness command/scenario and exact result | N/A. This batch is an application read over in-test ports. No HTTP, database, or process boundary. Adapters stay for 3.3–3.5. |
| Rollback boundary | Remove `contexts/inventory/application/list-venue-stock-facts/` and `contexts/inventory/application/ports/approved-count-facts.ts`. Remove `listByVenue` from `contexts/inventory/application/ports/stock-ledger-repository.ts` and the `#application/list-venue-stock-facts/*` import in `contexts/inventory/package.json`. |

## Completed tasks

- [x] 3.1 RED venue stock facts: `listByVenue` only, no `append`, closing average cost, empty session
- [x] 3.2 GREEN `ListVenueStockFacts`, ledger `listByVenue`, and empty `ApprovedCountFacts`

## Behavior locked

- The use case calls `listByVenue` on the ledger and on approved counts, with tenant and venue. It never calls `append`.
- Another tenant and another venue stay out when those ports filter by the arguments they receive.
- Each approved count keeps its quantity and `approvedAt`. `averageCostCop` is `StockLedger.averageCostUntil` at that `approvedAt` for that location. A purchase after the close does not change the closing cost. A receipt in another location does not change it.
- `new ApprovedCountFacts()` returns no rows. An empty session stays an empty count list while movements are still listed. No snapshot table and no `count_adjustment` line is written. `transfer_out` and `count_adjustment` are omitted from the movement facts.

## Deviations

The folder import `#application/list-venue-stock-facts/*` was added to `contexts/inventory/package.json` so the test command can resolve the new folder. `application/entry-port.ts` was not changed. Task 3.5 still exports the use case. The import line is already present, so that task should not add it again.

## Remaining

3.3–3.5 and phase 4 (4.1–4.3) remain. `state.yaml` stays `applying` with `apply: partial`.

## Work unit 3 — Ledger listByVenue

**Mode**: Standard (`strict_tdd: false`). The contract case was written before the adapter methods, per ADR-017 and `openspec/config.yaml` `rules.apply`.
**Delivery**: `auto-chain` / `feature-branch-chain`
**Work unit**: 3 — Inventory reads (tasks 3.3–3.5). Intended PR 3, base: PR 2 branch.
**Batch**: 3.3, 3.4, and 3.5 only. No HTTP. No schema change. No `apps/local-node` route.

## RED then GREEN

The assigned command does not collect `stock-ledger-repository.contract.ts`. The inventory Vitest project includes `contexts/inventory/**/*.test.ts`, so the new case runs from the three adapter contract tests.

Assigned command (both runs):

```text
pnpm exec vitest run --project inventory contexts/inventory/application/ports/stock-ledger-repository.contract.ts contexts/inventory/application/list-venue-stock-facts/list-venue-stock-facts.test.ts contexts/inventory/adapters/memory/in-memory-purchasing-repository.contract.test.ts
```

| Phase | Exit code | Result |
|-------|-----------|--------|
| RED | 0 | 2 files, 7 passed. The contract source was not loaded. |
| GREEN | 0 | 2 files, 7 passed. |

Command that loads the new case (memory, PostgreSQL, and SQLite):

```text
pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-stock-ledger-repository.contract.test.ts contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.contract.test.ts contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.contract.test.ts
```

| Phase | Exit code | Result |
|-------|-----------|--------|
| RED | 1 | 3 failed, 19 passed (22). `repository.listByVenue is not a function` on memory, PostgreSQL, and SQLite. |
| GREEN | 0 | 5 files, 29 passed, together with the venue-facts test and the in-memory purchasing contract. |

RED was recorded after the contract case and before `listByVenue` existed on the three adapters. GREEN is after those methods and the entry-port export.

## Work Unit Evidence

| Evidence | Required value |
|----------|----------------|
| Focused test command and exact result | Adapter contract command above — RED exit 1, 3 failed / 19 passed. GREEN exit 0, 29 passed across the three adapters, `list-venue-stock-facts.test.ts`, and `in-memory-purchasing-repository.contract.test.ts`. Assigned command stayed exit 0 (7 passed) because Vitest does not collect the contract source. |
| Runtime harness command/scenario and exact result | The PostgreSQL contract uses PGlite and the SQLite contract uses `node:sqlite`, in process. No HTTP server was started. GREEN exit 0. |
| Rollback boundary | Remove the new contract case. Remove `listByVenue` from the memory, PostgreSQL, and SQLite ledger repositories, including `listedLine`. Remove the `ListVenueStockFacts` export from `contexts/inventory/application/entry-port.ts`. Leave the existing `#application/list-venue-stock-facts/*` import, the purchase insert, and the single purchase balance sum. |

## Completed tasks

- [x] 3.3 Contract case, then in-memory `listByVenue`. Another tenant stays hidden
- [x] 3.4 PostgreSQL `listByVenue`. No schema change
- [x] 3.5 SQLite `listByVenue` as a port only. `ListVenueStockFacts` exported. Folder import was already present

## Behavior locked

- `listByVenue` returns the stored lines for that tenant and venue, in insert order. Another tenant is absent. Another venue of the same tenant is absent. Listing does not append, does not change the queue, and does not change the balance.
- A row whose sale columns are null is still readable. Its order line id is the movement reference, its role is `consumption`, and its recipe version is 0. Sale rows keep `lineFromRow`. The purchase insert and `quantity + excluded.quantity` were not changed.
- SQLite exposes the port method only. No local-node route was added. No `count_adjustment` is written and no snapshot table is created.
- `ListVenueStockFacts` is exported from the inventory entry port. Existing exports stay. The folder import was not added again.

## Deviations

Vitest does not collect `stock-ledger-repository.contract.ts`, so the assigned command cannot show the RED failure. The three `*.contract.test.ts` files do. `ListVenueStockFacts` is sorted with the other application exports by Biome `organizeImports`, after `ImportRecipes` and before `MarkAlertSeen`.

## Remaining

Phase 4 (4.1–4.3) remains. `state.yaml` stays `applying` with `apply: partial`.
