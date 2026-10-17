# Proposal: Production

## Intent

Kitchens prepare sauces, doughs and portions ahead of service. Without recording that production, the theoretical stock of raw ingredients and of the preparations drifts from reality (PRD-00 sec. 6.6 step 4, flujos M4 "Producción", TRD-M4 `RegistrarProduccion`).

## Scope

### In Scope
- Production runs of stocked intermediate preparations at a point-of-sale location or warehouse.
- Consumption of the preparation recipe's ingredients and output of the preparation's own stock in one transaction.
- Actual output quantity versus expected yield, with the difference visible.
- Output unit cost derived from consumed cost.
- Corrections through compensating runs, audited.

### Out of Scope
- Moving preparations between locations → 2.5.
- Waste of preparations outside a run → 2.6.
- Production planning or suggested batches → not in roadmap; levels and alerts → 2.8.

## Capabilities

### New Capabilities
- `production`: production runs of stocked preparations, consumption and output movements, yield variance, output cost.

### Modified Capabilities
None

## Approach

A run is registered by the location owner (`local-node` for hybrid sites and node-backed warehouses, `api-cloud` otherwise). The p2-01 explosion rule yields ingredient quantities; the ledger (p2-02) receives production-consumption and production-output movements plus balances and outbox in one unit of work. Sales already deduct stocked preparations (p2-02).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | Modified | Production run, output cost rule |
| `contexts/inventory/application` | Modified | Register production, correct production |
| `contexts/inventory/adapters/http` | Modified | Production endpoints for site PWA |
| `shared/contracts` | Modified | Production events |
| `apps/local-node`, `apps/api-cloud` | Modified | Wire use cases |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Output cost rule not defined in docs | Med | Consumed cost ÷ actual output; confirm with PO |
| Preparation not marked stocked | Med | Production only allowed for stocked preparations |
| Kitchens skip registering runs | Med | Negative preparation stock alert (p2-02) surfaces it |

## Rollback Plan

Disable production endpoints by flag. Recorded runs remain as ledger movements and can be compensated; sale consumption of stocked preparations keeps working.

## Dependencies

- p2-01 stocked sub-recipes, p2-02 ledger and stocked-preparation deduction, p2-03 average cost.

## Success Criteria

- [ ] The pilot site's preparations are registered and deducted correctly.
- [ ] A run lowers ingredients and raises the preparation in the same location atomically.
- [ ] Yield variance per run is visible to administrators.
