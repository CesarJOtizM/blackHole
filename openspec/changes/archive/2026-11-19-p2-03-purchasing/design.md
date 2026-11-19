# Design: Purchasing

## Technical Approach

Cloud-only purchasing stays in `contexts/inventory` ([ADR-018](../../docs/adr/ADR-018-screaming-y-bounded-context.md)). `ReceivePurchase` converts with the p2-01 factor, appends a `purchase` movement, and stores average cost on `stock_balances` in one PostgreSQL transaction ([ADR-017](../../docs/adr/ADR-017-tdd-sobre-hexagonal.md)). Host is `api-cloud` only (D-37). No Factus, support document, or supplier XML (D-14, D-15, roadmap 2.3). Those spec sections, plus hybrid and offline receipt, are not built.

## Architecture Decisions

| Decision | Choice | Rejected | Why |
|----------|--------|----------|-----|
| Host | `api-cloud` and flag `purchasingEnabled` | Node, offline queue, sync drain, warehouse node | D-37. ADR-010 and PA-44 stay hybrid. |
| Fiscal | Store `issuesEInvoices` and lead time | Support document, XML, VAT split | D-14, D-15. Lead time waits for 2.8. |
| Ledger | `append` allows `purchase` with quantity > 0. No edit or delete | Second balance; update in place | PRD-M4 rule 4. |
| Sale columns | Purchase leaves `order_line_id`, `role`, `recipe_version` null. Partial unique index keeps the p2-02 key | Fake order line | Those columns are for consumption. |
| Write | `PurchasingRepository.confirm` re-reads holding in the tenant transaction, then inserts | `StockLedgerRepository.append` | That path enqueues `after_sales`. Purchases skip the outbox. |
| Average | Whole COP. On-hand ≤ 0 takes the receipt cost; else half-up | Weight a negative balance | TRD-M4 §1. Waste does not call it. Sales keep the p2-01 reference snapshot. |
| Cost | Line stores entered COP per purchase unit. `unitCost` is `round(cost * QUANTITY_SCALE / factor)` | Fractional column | `unit_cost` is whole COP. Entered value is not split into VAT. |
| Quantity | `purchaseQuantity * factor` (factor already scaled) | Float grams | 5 kg at 4000 COP/kg is scaled 5000 g at 4 COP/g. |
| Order | One supplier and location. Status `open`, `partially_received`, `received`, `cancelled`. Over remainder or a closed order is rejected. Same `receiptId` is a no-op | Over-receipt; edit | A correction is a later movement. |
| Factor | Frozen on the order line. Direct receipt uses the published factor | Live catalog on an open order | A recipe edit must not change pending quantity. |
| Auth | Writes need `inventory.receive-purchase`. Hide `averageCost` without `inventory.view-cost` | New permission | Waiter cannot receive. Warehouse keeper does not see the average. |
| Audit | `actorId` on the receipt | `RecordAuditEvent` | TRD-M4 §8 does not list receipts. |

## Data Flow

```mermaid
sequenceDiagram
  participant Web as admin-web or venue-app
  participant Api as api-cloud
  participant Rec as ReceivePurchase
  participant Db as Postgres
  Web->>Api: POST receipt and session
  Api->>Api: flag and receive-purchase
  Api->>Rec: lines, location, optional order
  Rec->>Db: receipt, order, movements, average
  Api-->>Web: receipt; average only with view-cost
```

Cancel does not touch the ledger. Neither app stores a receipt locally.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `contexts/inventory/domain/stock-ledger.ts` | Modify | Accept `purchase`; add `nextAverageCost` |
| `contexts/inventory/domain/purchasing.ts` | Create | Supplier, status, conversion. Export from `domain/index.ts` |
| `contexts/inventory/application/{create-supplier,create-purchase-order,cancel-purchase-order,receive-purchase}/` | Create | Four use cases |
| `contexts/inventory/application/ports/{purchasing-repository,inventory-location-directory}.ts` | Create | Store, contract, point or warehouse |
| `contexts/inventory/application/entry-port.ts`, `package.json` | Modify | Export use cases; add `#application/...` imports |
| `contexts/inventory/adapters/memory/` | Create | In-memory store on the ledger maps |
| `contexts/inventory/adapters/postgres/` | Modify | One receipt transaction, `average_cost`, nullable sale columns |
| `contexts/inventory/adapters/sqlite/schema.ts`, `drizzle-stock-ledger-repository.ts` | Modify | Same columns only. No purchase wiring |
| `shared/contracts/purchasing.ts`, `index.ts` | Create / Modify | Strict Zod command and receipt |
| `apps/api-cloud/src/http/purchasing.controller.ts` | Create | Flag, permission, cost redaction |
| `apps/api-cloud/src/composition/application-module.ts`, `inventory-location-directory.ts` | Modify / Create | Postgres adapters, flag, cloud locations |
| `apps/admin-web/src/inventory/inventory-screen.tsx` | Modify | API receive. No invoice photo, invoice price, or WhatsApp |
| `apps/venue-app` receive route | Create | Same POST |

No `local-node` composition, `shared/sync`, or invoicing adapter.

## Interfaces / Contracts

Command: `receiptId`, `locationId`, optional `purchaseOrderId`, lines of `ingredientId`, `purchaseQuantity`, `purchaseUnitCost`. Identification is unique per tenant.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Domain | 10 then 14 COP/g is 12; waste stays 12; closed order rejects | No Nest |
| Use case | 5 kg → 4 COP/g; 6 of 10 stays partial; duplicate receipt | In-memory ports |
| Contract | Memory and PostgreSQL match; failed insert rolls back | `purchasing-repository.contract.ts` |
| HTTP | Flag off; waiter denied; average omitted | Nest bootstrap, no listen |

SQLite is not a purchasing runtime.

## Migration / Rollout

New tables: `suppliers`, `purchase_orders`, `purchase_order_lines`, `purchase_receipts`, `purchase_receipt_lines`. `average_cost` defaults to 0. `stock_movements_line` becomes a partial unique index where `order_line_id` is not null. No backfill. Flag off rejects new calls. Appended rows stay.

## Open Questions

- [x] Half-up to a whole COP per base unit. `unit_cost` is already an integer, and the cost decision above stores `round(cost * QUANTITY_SCALE / factor)`. 4500 COP/kg becomes 5 COP/g. The receipt line keeps the entered 4500 COP. The 500 COP difference stays in the average; it is not a second amount.
