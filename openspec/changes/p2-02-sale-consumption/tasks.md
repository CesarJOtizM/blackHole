# Tasks: Sale Consumption

## Review Workload Forecast

Estimated changed lines: 2400–3600.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Assumptions: p2-01 created `contexts/inventory`, `package.json`, `entry-port.ts`, `ExplodeRecipe`. No recipe tasks. `portions: 1` until `StoredLine` has quantity. No `shared/sync`; enqueue the outbox row only. RED/GREEN, given/when/then, `#` imports.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain ledger | PR 1 | 1.1–1.2. Base: last p2-01 branch on `phase-2/inventory`. Starts after `ExplodeRecipe` exists. |
| 2 | Use cases | PR 2 | 2.1–2.7. Base: PR 1. |
| 3 | Both dialects | PR 3 | 3.1–3.6. Base: PR 2. May exceed 400. |
| 4 | Orders wiring | PR 4 | 4.1–4.6. Base: PR 3. |

## 1. Domain

- [x] 1.1 RED `contexts/inventory/domain/stock-ledger.test.ts`: balance −200; no edit or delete; one reversal. No Nest.
- [x] 1.2 GREEN `domain/stock-ledger.ts`. `MOVEMENT_TYPE`. Writers: `sale_consumption`, `sale_return`, `waste`. p2-01 scaled integer.

## 2. Use cases

- [x] 2.1 RED `application/register-sale-consumption/register-sale-consumption.test.ts` (`ExplodeRecipe` double): portions 2, version 4, POS shared with bar; missing recipe writes nothing; stocked sauce stays; dressing expands; new send uses version 5; −200 g opens one alert; second send opens none; retry writes nothing; stale `generation` throws `StaleGeneration`.
- [x] 2.2 GREEN that folder. Ports `stock-ledger-repository`, `point-of-sale-directory`, `operation-generation`, `stock-alert-publisher`. Snapshot reference cost.
- [x] 2.3 RED `application/return-stock/return-stock.test.ts`: restore stored version; retry writes nothing; other reversal throws `LineReversalConflict` and copies unit cost.
- [x] 2.4 GREEN `return-stock/`. Unique `(tenantId, orderLineId, role)`: `consumption` or `reversal`.
- [x] 2.5 RED `application/record-waste/record-waste.test.ts`: reason, actor, no return, version 4, cost unchanged. Audit `inventory.record-waste` via platform entry port.
- [x] 2.6 GREEN `record-waste/`. Export three use cases from `entry-port.ts`. Add `#application/<folder>/*` in `package.json`.
- [x] 2.7 `shared/contracts/stock-movement.ts`: `StockMoved`, `NegativeStockOpened`. Export from `index.ts`. No Zod in domain.

## 3. Ledger adapters

- [x] 3.1 RED `application/ports/stock-ledger-repository.contract.ts` on memory: equal balances; other tenant hidden; failed third insert rolls back movements, balance, alert, and outbox.
- [x] 3.2 GREEN `adapters/memory`. Lane `after_sales`, key = movement id, same transaction. No Drizzle mock. No `outbox` path segment.
- [x] 3.3 RED on PGlite with `SET LOCAL` `app.tenant_id`. Tenant B hidden.
- [x] 3.4 GREEN `adapters/postgres/0002_stock_ledger.sql`: insert-only `stock_movements`, `stock_balances`, `negative_stock_alerts`, `stock_movement_outbox`, POS location. No backfill.
- [x] 3.5 RED the contract on single-tenant SQLite.
- [x] 3.6 GREEN repo in p2-01 `adapters/sqlite`. Cruiser blocks api-cloud from `adapters/sqlite`; local-node allowed. Use p2-01 Vitest `inventory`. `shared/sync` stays absent.

## 4. Orders and composition

- [x] 4.1 RED `contexts/orders/application/take-order/take-order.test.ts`: flag on, one call per line leaving `held`, `portions: 1`, after `send`, before `saveCheck`. Flag off skips. Missing recipe still saves.
- [x] 4.2 GREEN `take-order.ts` `saleConsumptionEnabled`. Entry port only. Later `fire` throws `EmptyOrder`.
- [x] 4.3 RED `contexts/orders/application/void-line/void-line.test.ts`: `sent` returns stored version; started states waste with reason and actor; `held` skips; flag off skips; never both.
- [x] 4.4 GREEN `void-line.ts`. Keep `sale.void-after-kitchen`. Audit via platform entry port.
- [x] 4.5 `apps/api-cloud/src/composition/application-module.ts`: Postgres ledger, flag, POS, generation, publisher. No SQLite.
- [x] 4.6 `apps/local-node/src/composition/application-module.ts`: SQLite ledger. No Postgres. `pnpm vitest run --project inventory` and `--project orders`.
