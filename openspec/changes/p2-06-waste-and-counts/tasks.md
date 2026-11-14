# Tasks: Waste and Counts

## Review Workload Forecast

Estimated changed lines: 2400–3800.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

PA-42 open: variance after submit, no hide/show. Session feeds 2.10. No snapshot, node, sync, SQLite, VAT, or `record-waste` edits. Paths omit `contexts/inventory/`.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain | PR 1 | 1.1–1.6. Base: `phase-2/inventory`. |
| 2 | Waste | PR 2 | 2.1–2.2, 2.5–2.6. Base: PR 1. |
| 3 | Counts | PR 3 | 2.3–2.4, 2.7–2.10. Base: PR 2. |
| 4 | Persistence | PR 4 | 3.1–3.6. Base: PR 3. |
| 5 | HTTP | PR 5 | 4.1–4.2. Base: PR 4. |

## 1. Domain

- [x] 1.1 RED `domain/stock-ledger.test.ts`: nonzero `count_adjustment`; immutable `change`/`delete`. Reversal `waste` keeps `onHandDelta` 0. `balanceUntil` and `averageCostUntil` skip later lines and `nextAverageCost`.
- [x] 1.2 GREEN `domain/stock-ledger.ts`: writable `count_adjustment`. Keep sale-void waste. Export `domain/index.ts`.
- [x] 1.3 RED `domain/operational-waste.test.ts`: `expired`, `damaged`, `preparation_error`, `other` plus note. Negative, no reversal id, whole COP. Missing reason rejected. Average stays.
- [x] 1.4 GREEN `domain/operational-waste.ts`.
- [x] 1.5 RED `domain/stock-count.test.ts`: cut-off movers, category intersection, named gaps. Freeze location, ingredient, quantity, and `averageCost`. Later lines ignored. Zeros skipped. Absolute sum.
- [x] 1.6 GREEN `domain/stock-count.ts`.

## 2. Use cases

- [x] 2.1 RED `contexts/platform/application/evaluate-permission/evaluate-permission.test.ts`: omitted `selfAuthorizationAttempt` is false; `true` is forwarded.
- [x] 2.2 GREEN `contexts/platform/application/evaluate-permission/evaluate-permission.ts`: optional, default false.
- [x] 2.3 RED `application/set-ingredient-category/set-ingredient-category.test.ts`: other tenant hidden.
- [x] 2.4 GREEN that folder and `application/ports/ingredient-classification.ts`.
- [x] 2.5 RED `application/record-operational-waste/record-operational-waste.test.ts`: 1000 ml at 4 COP posts −1000/4000 `waste`/`operational_waste`, on-hand drops. 12000 under 30000 posts+audits. 45000 needs another authorizer.
- [x] 2.6 GREEN `application/record-operational-waste/`. `StockMoved` on `after_sales`, `recipeVersion` 0, document id as `orderLineId`.
- [x] 2.7 RED `application/record-stock-count/record-stock-count.test.ts`: dairy. −600 g at 900 under 1000 posts one `count_adjustment`; 1500 posts none. Later sale ignored. `LimitRaised` if raised. Factor, then `QUANTITY_SCALE`.
- [x] 2.8 GREEN `application/record-stock-count/`. Snapshot `averageCost`. Never `nextAverageCost`.
- [ ] 2.9 RED `application/approve-adjustment/approve-adjustment.test.ts`: approval posts frozen lines. Reject audits, writes nothing, recount may open. Self-approval needs the shift flag.
- [ ] 2.10 GREEN `application/approve-adjustment/`. Export four use cases from `application/entry-port.ts` and `#application/<folder>/*` in `package.json`.

## 3. Persistence

- [ ] 3.1 RED `application/ports/stock-count-repository.contract.ts` on memory: freeze matches, other tenant hidden, reject leaves stock. No Drizzle mock.
- [ ] 3.2 GREEN `adapters/memory` for sessions, lines, and classifications. Roles on `application/ports/stock-ledger-repository.ts` and `application/ports/stock-movement-queue.ts`.
- [ ] 3.3 RED that contract on PGlite with `SET LOCAL` `app.tenant_id`.
- [ ] 3.4 GREEN `adapters/postgres/schema.ts` and the next `*_waste_and_counts.sql`: session, line, classification. Reuse `stock_movements`.
- [ ] 3.5 GREEN Postgres repositories and `package.json` exports. Retry unique (tenant, document, role, ingredient). Sale rows stay.
- [ ] 3.6 `shared/contracts/stock-movement.ts` and `shared/contracts/index.ts`: allow both roles on `StockMoved`.

## 4. Cloud HTTP

- [ ] 4.1 RED `apps/api-cloud/test/http/stock-operations.controller.test.ts` via `inject`, no listen: flag off skips routes. Over-cap waste posts nothing. Approval returns the freeze. Bad reason is 400.
- [ ] 4.2 GREEN `apps/api-cloud/src/http/stock-operations.controller.ts` and `apps/api-cloud/src/composition/application-module.ts`. Postgres. `wasteAndCountsEnabled` defaults off.
