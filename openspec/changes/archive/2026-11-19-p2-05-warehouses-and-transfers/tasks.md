# Tasks: Warehouses and Transfers

## Review Workload Forecast

Estimated changed lines: 3400–4600.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

- PR 1 Domain (1.1–1.4), base tracker `phase-2/inventory`
- PR 2 Request and dispatch (2.1–2.4), base PR 1
- PR 3 Receipt and levels (2.5–2.10), base PR 2
- PR 4 Memory (3.1–3.2), base PR 3
- PR 5 Postgres and supply (3.3–3.6), base PR 4
- PR 6 HTTP (4.1–4.3), base PR 5
- PR 7 Screens (5.1–5.2), base PR 6

Add `#application/<folder>/*` before import. English identifiers. No local-node, `shared/sync`, or warehouse node.

## 1. Domain

- [x] 1.1 RED `contexts/inventory/domain/stock-ledger.test.ts`: `transfer_out` < 0; `transfer_in` > 0. 10 then 9 keeps average.
- [x] 1.2 GREEN `contexts/inventory/domain/stock-ledger.ts`: those signs. `averageCost` stays purchase-only. Append-only. No second formula.
- [x] 1.3 RED `contexts/inventory/domain/transfer.test.ts`: dispatch stamps `dispatched` and `in_transit`; receipt only then. Both `unitCost` copy origin `averageCost` (D-27). Full negative out; positive received in; shortfall on the line. Existing `nextAverageCost`: 1000 g at 10 plus 1000 g at 12 is 11; on-hand <= 0 takes the receipt cost. Reject over on-hand. 5/20/4 suggests 16. Not roadmap 2.10.
- [x] 1.4 GREEN `contexts/inventory/domain/transfer.ts` and `domain/index.ts`. `transfer_in` calls `nextAverageCost`.

## 2. Use cases

- [x] 2.1 RED `contexts/inventory/application/request-transfer/request-transfer.test.ts`: unlinked warehouse rejected; lines stored; no movement.
- [x] 2.2 GREEN `request-transfer/` and `application/ports/{transfer-repository,warehouse-supply,stock-level-repository,transfer-voucher}.ts`.
- [x] 2.3 RED `contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts`: copy `averageCost`; `transfer_out`; print `transfer`; audit. Company: destination `venueId`. Site-to-site: origin venue.
- [x] 2.4 GREEN `dispatch-transfer/`. Null sale columns.
- [x] 2.5 RED `contexts/inventory/application/receive-transfer/receive-transfer.test.ts`: early receipt rejected; duplicate no-op; no `authorizerId` stores nothing; 9/10 at copied cost; same `nextAverageCost` result as 1.3.
- [x] 2.6 GREEN `receive-transfer/`: one `TransferRepository` transaction updates `average_cost`.
- [x] 2.7 RED `contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts`: scaled base units. No alerts.
- [x] 2.8 GREEN `set-stock-levels/`.
- [x] 2.9 RED `contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts`: below minimum returns `maximum - onHand`; else nothing.
- [x] 2.10 GREEN `suggest-replenishment/`. Export five use cases from `application/entry-port.ts`.

## 3. Persistence

- [x] 3.1 RED `contexts/inventory/application/ports/transfer-repository.contract.ts` on memory: balances; rollback of movements, status, `average_cost`; tenant hidden. No Drizzle mock.
- [x] 3.2 GREEN `contexts/inventory/adapters/memory`. Append-only. Skip `stock_movement_outbox`.
- [x] 3.3 RED that contract on PGlite with `SET LOCAL` `app.tenant_id`.
- [x] 3.4 GREEN `contexts/inventory/adapters/postgres/0004_transfers.sql`: `transfers`, `transfer_lines`, `stock_levels`; reuse `stock_movements`; `transfer_in` sets `average_cost`. No backfill or SQLite. After `0003_purchasing.sql`.
- [x] 3.5 RED `contexts/platform/application/declare-warehouse-supply/declare-warehouse-supply.test.ts`: unlinked warehouse rejected.
- [x] 3.6 GREEN that use case and `contexts/platform/adapters/postgres/0015_warehouse_supplies.sql`.

## 4. Cloud HTTP

- [x] 4.1 `shared/contracts/transfer.ts` and `index.ts`: strict Zod request, dispatch, receipt, levels. No Zod in domain.
- [x] 4.2 RED `apps/api-cloud/test/http/transfers.controller.test.ts` via Fastify `inject`, no listen: flag off; unregistered device; waiter denied; hide cost without `inventory.view-cost`; Zod 400.
- [x] 4.3 GREEN `apps/api-cloud/src/http/transfers.controller.ts` and `composition/application-module.ts`: `transfersEnabled`; `inventory.request-replenishment`; keeper or `inventory.receive-transfer`; differences need YES or `authorizerId`.

## 5. Screens

- [x] 5.1 `apps/admin-web/src/inventory/inventory-screen.tsx`: request, dispatch, QR receipt. Hide cost when absent.
- [x] 5.2 `apps/venue-app/src/router.tsx` plus a transfer screen. No local receipt.
