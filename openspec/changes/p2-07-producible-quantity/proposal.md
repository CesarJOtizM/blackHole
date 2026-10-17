# Proposal: How Much Can Be Produced (Roadmap 2.7)

## Intent

Waiters keep offering dishes the kitchen cannot prepare. This change computes per product and site the units producible with point stock and with restocking, names the limiting ingredient, and pushes "available / low units / sold out" to the waiter menu in real time (PRD-00 M4, TRD-00 sec. 9.3, PRD-M4 rule 7, TRD-M4 sec. 2).

## Scope

### In Scope
- Producible units from point stock, and with point + supplying warehouses stock.
- Limiting ingredient per product.
- Recalculation on every stock change through an ingredient-to-product index.
- Automatic menu availability with a configurable "low units" threshold per product.
- `AvailabilityChanged` event to the waiter menu (orders context) in real time.

### Out of Scope
- Shortage alerts, dish-level alert thresholds and one-tap restocking → 2.8.
- "Not restocked today" mark and line withdrawal → 2.9.
- "Producible dishes today" report → 2.10.
- Publishing availability to delivery platforms through the hub → 3.2 / 3.3.

## Capabilities

### New Capabilities
- `producible-quantity`: producible units, limiting ingredient, restock-aware units, availability state and event.

### Modified Capabilities
- `catalog` (delta): effective menu availability combines manual availability and schedules (1.1) with the computed inventory state; per-product low-units threshold.

## Approach

A pure rule in `contexts/inventory/domain` explodes the current recipe version and returns the minimum over ingredients. It runs where the point is owned: `apps/local-node` (SQLite) for hybrid sites, `apps/api-cloud` (PostgreSQL) for cloud-mode sites. Only a state transition emits `AvailabilityChanged` (`shared/contracts`); orders applies it in-process and pushes it to the waiter PWA by WebSocket.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | New | Producible-units rule, limiting ingredient |
| `contexts/inventory/application` | New | Recalculate on stock change, ingredient index |
| `contexts/orders/application` | Modified | Apply availability to the waiter menu |
| `shared/contracts` | New | `AvailabilityChanged` schema |
| `apps/local-node`, `apps/api-cloud` | Modified | Wiring, WebSocket push |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Recalculation cost at peak hour | Medium | Index limits work to products using the changed ingredient |
| Wrong counts mark dishes sold out | Medium | Computed sold-out never blocks a sale (PRD-00 rule 1) |
| Stale general-warehouse stock | High | Restock figure shows the last-sync timestamp |
| Doc conflict: flujos M4 says sold out "prevents new orders"; PRD-00 rule 1 says sales never block | Medium | Master wins: computed sold-out is informational; only 2.9 blocks |

## Rollback Plan

Disable automatic availability per site via configuration; the menu falls back to manual availability from 1.1. The feature writes no stock movements, so no data repair is needed.

## Dependencies

- p2-02 (consumption ledger), p2-04 (intermediate stock), p2-05 (warehouses and supply relations), p1-01 (catalog), p1-02 (waiter menu).

## Success Criteria

- [ ] The waiter menu marks sold out and low units in real time.
- [ ] A hybrid site keeps updating availability during an internet outage.
- [ ] The limiting ingredient matches the minimum of the point stock in domain tests.
