# Proposal: Waste and Counts

## Intent

The gap between theoretical and real stock is the Phase 2 success metric (PRD-00 sec. 11–12). It can only be measured if waste is recorded with a reason and physical counts are compared against the ledger, adjusting through movements rather than edited balances (PRD-M4 rule 4, TRD-M4 `RecordStockCount`, `ApproveAdjustment`).

## Scope

### In Scope
- Waste and write-offs with reason (expired, damaged, preparation error, other) at any owned location.
- Waste cap per role (kitchen chief up to 30,000 COP per record by default); above cap needs supervisor authorization.
- Physical counts, full or by category, at a location, with a cut-off time.
- Comparison against theoretical stock at cut-off, per ingredient, in quantity and value.
- Approval of a count adjustment above a configurable cap (default 1,000 COP, lowerable per site) (D-28), and count adjustment movements; rejection leaves stock untouched.

### Out of Scope
- Waste, variance and adjustment reports (PRD-00 sec. 8.3, 8.4) → 2.10.
- Theoretical vs real measured across sites for a month → 2.11.
- Waste from voided sales → already in 2.2.

## Capabilities

### New Capabilities
- `waste-and-counts`: waste with reason and cap, full/category counts, variance against theoretical, approval and adjustment.

### Modified Capabilities
None

## Approach

Use cases run on the location owner (`local-node` offline-capable for hybrid sites and warehouse nodes; `api-cloud` for cloud-mode sites and web-only warehouses). Caps and supervisor PIN come from the `platform` entry port (p0-05). Waste and adjustments are ledger movements valued at average cost, which they do not modify.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | Modified | Waste, count session, variance rule |
| `contexts/inventory/application` | Modified | Register waste, register count, approve adjustment |
| `contexts/platform/application/entry-port.ts` | Modified | Waste and count-approval caps |
| `shared/contracts` | Modified | Waste and adjustment events |
| Site PWA | New | Waste and count screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Count-approval cap not defined in PRD-01 sec. 7 | High | Configurable cap, default 1,000 COP, lowerable per site (D-28) |
| Sales during a count distort variance | Med | Variance computed at cut-off; later movements untouched |
| Counters bias to the theoretical | Med | Blind count (D-49): the sheet lists ingredient ids and the unit, and the difference appears after submit |

## Rollback Plan

Disable waste and count endpoints by flag. Approved adjustments remain as movements and can be compensated by a new count; nothing is deleted.

## Dependencies

- p2-02 ledger, p2-03 average cost, p0-05 caps and supervisor PIN, p0-06 audit.

## Success Criteria

- [ ] One full physical count is completed, with its difference against the theoretical stock.
- [ ] Waste above cap is blocked without authorization.
- [ ] No balance changes without a movement.
