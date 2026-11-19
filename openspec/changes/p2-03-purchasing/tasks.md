# Tasks: Purchasing

## Review Workload Forecast

Estimated changed lines: 2800–4500.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Domain | PR 1 | 1.1–1.4 from `phase-2/inventory` |
| 2 | Orders | PR 2 | 2.1–2.6 on PR 1 |
| 3 | Receive | PR 3 | 2.7–2.8 on PR 2 |
| 4 | Persistence | PR 4 | 3.1–3.5 on PR 3. Memory, then Postgres. |
| 5 | HTTP | PR 5 | 4.1–4.3 on PR 4. `inject`, no listen. |
| 6 | Screens | PR 6 | 5.1–5.2 on PR 5 |

## 1. Domain

- [x] 1.1 RED `contexts/inventory/domain/stock-ledger.test.ts`: `purchase` > 0 appends; ≤ 0 throws; 10 then 14 is 12; on-hand ≤ 0 takes receipt cost; waste stays 12.
- [x] 1.2 GREEN `contexts/inventory/domain/stock-ledger.ts`: allow `purchase`; `nextAverageCost` half-up whole COP. Immutable.
- [x] 1.3 RED `contexts/inventory/domain/purchasing.test.ts`: duplicate id rejected; 5 kg at 4000 → 5000 g at 4; 4500/kg → 5, line keeps 4500; closed or over rejected; factor frozen.
- [x] 1.4 GREEN `contexts/inventory/domain/purchasing.ts`: supplier, status, `purchaseQuantity * factor`, `round(cost * QUANTITY_SCALE / factor)`. Export `domain/index.ts`.

## 2. Use cases

- [x] 2.1 RED `contexts/inventory/application/create-supplier/create-supplier.test.ts`: same NIT rejected; other tenant may reuse it; store `issuesEInvoices` and lead time. No document, Factus, or VAT.
- [x] 2.2 GREEN `contexts/inventory/application/create-supplier/` and in-memory `purchasing-repository`.
- [x] 2.3 RED `contexts/inventory/application/create-purchase-order/create-purchase-order.test.ts`: one supplier, one location, purchase units, `open`, frozen factor.
- [x] 2.4 GREEN `contexts/inventory/application/create-purchase-order/`.
- [x] 2.5 RED `contexts/inventory/application/cancel-purchase-order/cancel-purchase-order.test.ts`: no movement; later receipt rejected.
- [x] 2.6 GREEN `contexts/inventory/application/cancel-purchase-order/`.
- [x] 2.7 RED `contexts/inventory/application/receive-purchase/receive-purchase.test.ts`: direct 5 kg at 4000 → 5000 g at 4; 6/10 partial, 4 pending; full `received`; over or closed reject; same `receiptId` no-op.
- [x] 2.8 GREEN `contexts/inventory/application/receive-purchase/`: `confirm`, not `append`. Null sale columns, no outbox, `actorId`, published factor, `inventory-location-directory`. Export four use cases and `#application/<folder>/*` imports.

## 3. Persistence

- [x] 3.1 RED `contexts/inventory/application/ports/purchasing-repository.contract.ts` on memory: balances match; other tenant hidden; rollback receipt, movements, average, status. No Drizzle mock.
- [x] 3.2 GREEN `contexts/inventory/adapters/memory` on the ledger maps. Skip `after_sales`.
- [x] 3.3 RED that contract on PGlite with `SET LOCAL` `app.tenant_id`.
- [x] 3.4 GREEN `contexts/inventory/adapters/postgres/0003_purchasing.sql`: purchasing tables; `average_cost` 0; nullable sale columns; partial unique `stock_movements_line`. No backfill.
- [x] 3.5 `contexts/inventory/adapters/sqlite/schema.ts` and `drizzle-stock-ledger-repository.ts`: those columns only. No purchase wiring, local-node, or `shared/sync`.

## 4. Cloud HTTP

- [x] 4.1 `shared/contracts/purchasing.ts`: strict Zod `receiptId`, `locationId`, optional `purchaseOrderId`, purchase lines, and receipt. Export `index.ts`. No Zod in domain.
- [x] 4.2 RED `apps/api-cloud/test/http/purchasing.controller.test.ts` via `inject`, no listen: flag off; waiter denied; keeper omits `averageCost`; admin sees it; Zod 400.
- [x] 4.3 GREEN `apps/api-cloud/src/http/purchasing.controller.ts`, `apps/api-cloud/src/composition/application-module.ts`, and `apps/api-cloud/src/composition/inventory-location-directory.ts`: `purchasingEnabled`, `inventory.receive-purchase`, hide average without `inventory.view-cost`. Postgres, point or warehouse. No SQLite.

## 5. Screens

- [x] 5.1 `apps/admin-web/src/inventory/inventory-screen.tsx`: POST the receipt. No invoice photo, price, or WhatsApp. Average only when present.
- [x] 5.2 `apps/venue-app/src/router.tsx` and `apps/venue-app/src/purchasing/receive-screen.tsx`: same POST. No local receipt.
