# Proposal: Inventory Reports (Roadmap 2.10)

## Intent

Administrators cannot see what food really costs or how much goes missing between theory and the shelf. This change delivers the PRD-00 sec. 8.3 cost and inventory reports per site (PRD-M6 sec. 2 and rule 7, TRD-M6 sec. 2–7, TRD-00 sec. 11, PRD-M4 sec. 7).

## Scope

### In Scope
- Food cost % per site and period from theoretical cost of what was sold.
- Theoretical vs actual consumption between two physical counts, per site and ingredient.
- Waste by reason, ingredient, location and responsible.
- Inventory value per location at weighted average cost.
- Rotation and days of inventory per ingredient.
- Producible dishes today with limiting ingredient.
- Shortage alerts (open by site and level, average attention time, stockouts) and coverage.
- Day view on the owner of the operation; history per site in the cloud.

### Out of Scope
- Menu engineering (popularity × margin) and consolidated multi-site views → 4.1.
- Accountant exports → 4.2.
- Control reports for adjustments and transfer differences (PRD-00 8.4) are fed but extended in → 4.1.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `reporting` (delta): inventory and cost report family (PRD-00 sec. 8.3) at site scope.

## Approach

Metric definitions live in `contexts/reporting/domain` so node and cloud compute the same number. The cloud projects movements, counts, alerts and sales from the inbox into daily PostgreSQL fact tables (`apps/api-cloud`), idempotent by device and sequence. Day reports query SQLite on `apps/local-node` for hybrid sites and PostgreSQL for cloud-mode sites. Lagging sites are flagged, never shown as zero.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reporting/domain` | New | Food cost, theoretical vs actual, rotation definitions |
| `contexts/reporting/application` | Modified | Inventory projections, day and history queries |
| `contexts/inventory/application` | Modified | Read ports for day reports |
| `shared/contracts` | New | Report filter schemas |
| `apps/api-cloud`, `apps/local-node` | Modified | Read endpoints, projection workers |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Products without recipe distort food cost | High | Excluded and listed, never costed as zero |
| Late node data skews history | Medium | Lagging flag from sync cursor |
| Cost leakage to unauthorized roles | Low | Separate view-costs permission; waiter has no endpoint |
| Doc conflict: roadmap 2.10 says "all of 8.3", which lists menu engineering; PRD-00 sec. 11 and PRD-M6 place it in phase 4 | Low | Master wins: deferred to 4.1 |

## Rollback Plan

Reports are read-only: disable the new endpoints and projection jobs. Projections can be dropped and rebuilt from the inbox; operational data is untouched.

## Dependencies

- p1-11 (reporting base), p2-01 to p2-08 (recipes, consumption, purchases, transfers, counts, producible units, alerts).

## Success Criteria

- [ ] The administrator sees food cost and the theoretical vs actual difference per site.
- [ ] A hybrid site answers the day's inventory reports during an outage.
- [ ] A site that was offline 2 hours shows complete totals after sync, without duplicates.
