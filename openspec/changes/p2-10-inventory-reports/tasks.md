# Tasks: Inventory Reports

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1200–1600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1→PR2→PR3→PR4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain formulas | PR 1 | 1.1–1.2. Base: feature/tracker branch. |
| 2 | Reporting read models | PR 2 | 2.1–2.6. Base: PR 1 branch. |
| 3 | Inventory reads | PR 3 | 3.1–3.5. Base: PR 2 branch. |
| 4 | Cloud HTTP | PR 4 | 4.1–4.3. Base: PR 3 branch. |

Approved count = p2-06 frozen session (`locationId`, `ingredientId`, quantity, `approvedAt`). No `count_adjustment`, snapshot table, or p2-06 edit. Missing close is `pending`. Waste is a column. No other §8.3 report.

## Phase 1: Domain formulas

- [x] 1.1 RED `contexts/reporting/domain/metrics.test.ts` (Given/When/Then, no Nest): 32% of 3,200,000/10,000,000; uncosted product listed and off both sides; no ratio at zero net sales; keep `recipeVersion`. Actual = opening + purchase + transfer_in + production_output − closing; theoretical = net sale and production consumption; waste column; no closing count is `pending`, not 0.
- [x] 1.2 GREEN `contexts/reporting/domain/metrics.ts`: `foodCostRatio` (`theoreticalCop / netSalesCop` on `[from, to)`) and `stockGap`. Export both from `contexts/reporting/domain/index.ts`.

## Phase 2: Reporting read models

- [x] 2.1 Create `contexts/reporting/application/ports/inventory-facts.ts` with movement lines and those four count fields. No write method.
- [x] 2.2 RED `contexts/reporting/application/read-food-cost-report/read-food-cost-report.test.ts`: other venue and waiter denied; one row per id; uncosted line off both sides; `abs(quantity) * unitCost` net of `sale_return`.
- [x] 2.3 GREEN `contexts/reporting/application/read-food-cost-report/read-food-cost-report.ts`. Require `inventory.view-cost` and the home venue. Allow it on `contexts/reporting/application/ports/report-access.ts`.
- [x] 2.4 RED `contexts/reporting/application/read-stock-gap-report/read-stock-gap-report.test.ts`: 40 vs 43 kg = 3 kg at closing `averageCostCop`; waste column; opening only is `pending`; duplicate id once; no append.
- [x] 2.5 GREEN `contexts/reporting/application/read-stock-gap-report/read-stock-gap-report.ts`. Row: `locationId`, `ingredientId`, `theoreticalQuantity`, `actualQuantity`, `differenceQuantity`, `wasteQuantity`, `averageCostCop`, `differenceCop`. `pending` replaces rows.
- [x] 2.6 Create `contexts/reporting/adapters/memory/in-memory-inventory-facts.ts`. Export both from `contexts/reporting/application/entry-port.ts`. Add both folder imports in `contexts/reporting/package.json`.

## Phase 3: Inventory reads

- [x] 3.1 RED `contexts/inventory/application/list-venue-stock-facts/list-venue-stock-facts.test.ts`: `listByVenue` only; no `append`; map closing average cost; empty session stays empty.
- [x] 3.2 GREEN `contexts/inventory/application/list-venue-stock-facts/list-venue-stock-facts.ts`. Add `listByVenue` on `contexts/inventory/application/ports/stock-ledger-repository.ts`. Create `contexts/inventory/application/ports/approved-count-facts.ts` for that session, empty until p2-06. No table.
- [x] 3.3 Extend `contexts/inventory/application/ports/stock-ledger-repository.contract.ts`, then GREEN `contexts/inventory/adapters/memory/in-memory-stock-ledger-repository.ts` `listByVenue`. Other tenant hidden.
- [x] 3.4 GREEN `contexts/inventory/adapters/postgres/drizzle-stock-ledger-repository.ts` `listByVenue`. No schema change.
- [x] 3.5 GREEN `contexts/inventory/adapters/sqlite/drizzle-stock-ledger-repository.ts` `listByVenue` as a port only. No `apps/local-node` route. Export from `contexts/inventory/application/entry-port.ts` and add its folder import in `contexts/inventory/package.json`.

## Phase 4: Cloud HTTP

- [x] 4.1 Add families `food-cost` and `stock-gap` only in `shared/contracts/reporting.ts`.
- [x] 4.2 RED `apps/api-cloud/test/http/read-inventory-report.controller.test.ts` via `application.inject`, no listen: missing `inventory.view-cost` denied; other venue denied; `pending` is not zero.
- [x] 4.3 GREEN `apps/api-cloud/src/http/read-inventory-report.controller.ts` (`GET .../venues/:venueId/inventory-reports/:family`). Create `apps/api-cloud/src/composition/inventory-report-facts.ts` on PostgreSQL. Wire `inventory.view-cost` in `apps/api-cloud/src/composition/application-module.ts`. No admin-web screen.
