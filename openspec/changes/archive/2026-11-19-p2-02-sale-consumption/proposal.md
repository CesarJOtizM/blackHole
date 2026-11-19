# Proposal: Sale Consumption

## Intent

Theoretical stock must reflect what went to production, not what was charged hours later (PRD-00 rule 2, PRD-M4 HU-M4-02). This change introduces the append-only stock ledger and deducts recipe ingredients from the site's point-of-sale location when `orders` sends a line to the kitchen.

## Scope

### In Scope
- Append-only movement ledger per location; balance updated in the same transaction (TRD-00 sec. 9.1).
- Sale consumption on send-to-kitchen using the recipe version current at that moment.
- Return when voided before kitchen starts; waste with reason when voided after.
- Stocked sub-recipes deducted as the preparation, not its ingredients.
- Negative stock allowed, with an alert; the sale never blocks.
- Idempotent consumption per order line.

### Out of Scope
- Purchases and average cost → 2.3. Production runs → 2.4. Transfers → 2.5. Manual waste and counts → 2.6.
- Menu availability, "low units" → 2.7. Level-based alerts → 2.8.
- Delivery-platform cancellations from M5 → 3.1 / 3.2.

## Capabilities

### New Capabilities
- `inventory-ledger`: append-only movements, derived balances, location ownership by operating mode, sync upward. *(Added: not in the global map; every later inventory delivery writes to it.)*
- `stock-consumption`: deduction on send-to-kitchen, return/waste on void, negative stock alert, idempotency.

### Modified Capabilities
None

## Approach

`orders` calls the `inventory` entry port in process (TRD-M4 sec. 5). The location owner explodes the recipe (p2-01 rule) and writes one movement per ingredient plus the balance and outbox record in one unit of work. Hybrid: `local-node` on SQLite; cloud mode: `api-cloud` on PostgreSQL with RLS.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | Modified | Ledger aggregate, balance rule |
| `contexts/inventory/application` | Modified | Register consumption, return, waste |
| `contexts/inventory/application/entry-port.ts` | New | Port used by `orders` |
| `contexts/inventory/adapters/{sqlite,postgres}` | New | Movements and balances, contract suite in both dialects |
| `contexts/orders/application` | Modified | Call inventory on send and void |
| `shared/contracts` | Modified | Movement and negative-stock events |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Double deduction on retried send | Med | Idempotency key = order line |
| Recipe changed mid-service | Med | Movement stores version used |
| Partial write on crash | Low | Single transaction for movements, balance, outbox |

## Rollback Plan

Feature flag on the entry-port call from `orders`; disabling it stops deduction without affecting orders. Ledger rows are append-only and harmless if left.

## Dependencies

- p2-01 recipes, p1-02 send-to-kitchen and kitchen "started" state, p0-02 outbox, p0-06 audit.

## Success Criteria

- [ ] The theoretical consumption of a service matches the recipes of what was sold.
- [ ] A void before start returns stock; after start it records waste — never both.
- [ ] A hybrid node keeps deducting during an outage and syncs without duplicates.
