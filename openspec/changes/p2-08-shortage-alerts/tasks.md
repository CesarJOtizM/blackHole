# Tasks: Early Shortage Alert

## Review Workload Forecast

Estimated changed lines: 2800–4200. Delivery strategy: auto-chain.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Cloud-only. No `shared/sync`.

### Suggested Work Units

`pnpm vitest run --project` + filter.

|Unit|Goal|Likely PR|Focused test command|Runtime harness|Rollback boundary|
|---|---|---|---|---|---|
|1|Domain|PR 1 base `phase-2/inventory`|`inventory shortage-alert.test.ts`|N/A-domain|`shortage-alert` files|
|2|Levels|PR 2 base PR 1|`inventory "set-stock-levels\|evaluate-stock-levels\|mark-alert-seen\|resolve-alert"`|N/A-memory|levels|
|3|Coverage|PR 3 base PR 2|`inventory "evaluate-coverage\|evaluate-dish-alert\|escalate-alerts"`|N/A-memory|coverage|
|4|One tap|PR 4 base PR 3|`inventory "restock-from-alert\|propose-stock-levels\|accept-stock-levels"`|N/A-existing-cases|actions|
|5|Persistence|PR 5 base PR 4|`inventory shortage-repository.contract.ts`|PGlite-no-listen|SQL, writers|
|6|HTTP|PR 6 base PR 5|`api-cloud shortage-alerts`|Nest-inject-no-listen|controllers, worker|
|7|Screens|PR 7 base PR 6|`api-cloud shortage-alerts`|N/A-screens|screens|

## Phase 1: Domain

- [x] 1.1 RED `contexts/inventory/domain/shortage-alert.test.ts`: bad levels rejected; one critical; no flap; round up. No Nest.
- [x] 1.2 GREEN `contexts/inventory/domain/shortage-alert.ts`, `domain/index.ts`. Sold out ≤ 0. `critical` uses the red clock.

## Phase 2: Levels

- [x] 2.1 RED `contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts`: site override; reject reorder below minimum; `inventory.configure-levels` only.
- [x] 2.2 GREEN `contexts/inventory/application/set-stock-levels/`, `application/ports/shortage-repository.ts`.
- [x] 2.3 RED `contexts/inventory/application/evaluate-stock-levels/evaluate-stock-levels.test.ts`: yellow; one critical; no repeat; flag off; `NegativeStockOpened` stays.
- [x] 2.4 GREEN `contexts/inventory/application/evaluate-stock-levels/`. Same transaction.
- [x] 2.5 RED `contexts/inventory/application/mark-alert-seen/`, `resolve-alert/` tests: who/when; reason; resolve above reorder; `ports/shortage-audit.ts` calls `RecordAuditEvent`.
- [x] 2.6 GREEN both. No platform import. Export `application/entry-port.ts`.

## Phase 3: Jobs

- [ ] 3.1 RED `contexts/inventory/application/evaluate-coverage/evaluate-coverage.test.ts`: Friday hours; history under N skips; missing N, margin, slot, or service end skips. No numeric default.
- [ ] 3.2 GREEN `contexts/inventory/application/evaluate-coverage/`, `application/ports/consumption-history.ts`.
- [ ] 3.3 RED `contexts/inventory/application/evaluate-dish-alert/evaluate-dish-alert.test.ts`: name every limiter; no minimum skips. Port `producible-units.ts`.
- [ ] 3.4 GREEN `contexts/inventory/application/evaluate-dish-alert/`. Leave p2-07.
- [ ] 3.5 RED `contexts/inventory/application/escalate-alerts/escalate-alerts.test.ts`: red clock only; `critical` shares it; yellow, coverage do not.
- [ ] 3.6 GREEN `contexts/inventory/application/escalate-alerts/`. One `RoleNotice` per role. No WhatsApp, SMS, email, or Web Push.

## Phase 4: One tap

- [ ] 4.1 RED `contexts/inventory/application/restock-from-alert/restock-from-alert.test.ts`: 16 kg; one link is the destination; several need actor warehouse id; zero offers a purchase order; actor `supplierId`; no preferred supplier.
- [ ] 4.2 GREEN `contexts/inventory/application/restock-from-alert/` via `ports/transfer-request.ts` or `CreatePurchaseOrder`. Store document id. Cases unchanged.
- [ ] 4.3 RED `contexts/inventory/application/propose-stock-levels/`, `accept-stock-levels/` tests: pending ignored; accept activates.
- [ ] 4.4 GREEN both. Export `entry-port.ts`. Add imports in `contexts/inventory/package.json`.

## Phase 5: Persistence

- [ ] 5.1 RED `contexts/inventory/application/ports/shortage-repository.contract.ts` on memory: hidden tenant; rollback; one open row.
- [ ] 5.2 GREEN `contexts/inventory/adapters/memory/in-memory-shortage-repository.ts`.
- [ ] 5.3 RED that contract on PGlite, `SET LOCAL` `app.tenant_id`.
- [ ] 5.4 GREEN `contexts/inventory/adapters/postgres/schema.ts`, `drizzle-shortage-repository.ts`, next SQL for `stock_level_templates`, `stock_levels`, `dish_levels`, `coverage_settings`, `notification_rules`, `shortage_alerts`, `role_notices`, `suggested_stock_levels`. No SQLite. Flag off.
- [ ] 5.5 `EvaluateStockLevels` inside `ledger.inTransaction`: `register-sale-consumption`, `record-waste`, `return-stock`, `receive-purchase`. Leave `NegativeStockOpened`.

## Phase 6: HTTP

- [ ] 6.1 `shared/contracts/shortage-alerts.ts`: Zod `alertId`, `kind`, `severity`, `role`, `venueId`. Export `index.ts`. No Zod in domain.
- [ ] 6.2 RED `apps/api-cloud/test/http/shortage-alerts.controller.test.ts`, `shortage-realtime.controller.test.ts`: `inject`, no listen. Flag off; waiter denied; kitchen sees it.
- [ ] 6.3 GREEN `apps/api-cloud/src/http/shortage-alerts.controller.ts`, `shortage-realtime.controller.ts`, `src/composition/application-module.ts`. Postgres only. `inventory.request-replenishment` guards one tap.
- [ ] 6.4 `apps/api-cloud/src/composition/worker.ts`: PgBoss coverage every 15 minutes, dish, escalation, suggestions.

## Phase 7: Screens

- [ ] 7.1 `apps/admin-web/src/inventory/inventory-screen.tsx`: edit levels; accept proposals.
- [ ] 7.2 `apps/venue-app/src/kitchen/kitchen-screen.tsx`, `cash-register/register-screen.tsx`: notice, one tap.
