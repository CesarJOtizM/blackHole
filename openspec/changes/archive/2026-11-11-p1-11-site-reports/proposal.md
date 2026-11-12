# Proposal: Site Reports

## Intent

The site administrator must see the day's operation even during an internet outage, and the site's history from the web, with numbers that match between node and cloud and never double count after a sync (PRD-00 8.1, 8.2, 8.5, PRD-M6, TRD-00 sec. 11).

## Scope

### In Scope
- Shared metric definitions: time between two states, net sales, p50/p90.
- Sales (PRD-00 8.2, dining-room subset): sales, tickets, channel (waiter vs QR table), per waiter, products, table rotation, payment methods with QR apart from cash, invoices with customer data, re-invoicing.
- Times (8.1, dining room) by site, station, product, waiter, hour band and weekday.
- Cash register: shift closings and payment-method totals.
- Staff (8.5): hours, lateness, absences, corrections, sales per hour worked, tips, productivity.
- Day reports on the operation owner; history projections in the cloud with lagging-site marking.

### Out of Scope
- Control reports and unusual-behavior detectors (8.4) → 1.7.
- Cost and inventory (8.3) → 2.10; delivery, platform and reservation reports → 3.9.
- Multi-site consolidation, menu engineering → 4.1; accountant summary and exports → 4.2.

## Capabilities

### New Capabilities
- `reporting`: metric definitions, day reports, cloud history projections, role-scoped access.

### Modified Capabilities
None

## Approach

New context `contexts/reporting` holds pure metric definitions shared by node and cloud (TRD-M6 sec. 2). Day queries read the operation owner's store: SQLite on local-node (hybrid) or PostgreSQL on api-cloud (cloud mode). Cloud workers project inbox events idempotently and flag lagging sites. Reporting writes no operation data.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reporting/domain`, `contexts/reporting/application` | New | Definitions, day queries, projector |
| `contexts/reporting/adapters` (sqlite, postgres) | New | Day queries and fact tables |
| `apps/local-node` | Modified | Read-only day endpoints |
| `apps/api-cloud` | Modified | Projection workers, history endpoints |
| `apps/venue-app`, `apps/admin-web` | Modified | Day and history screens |
| `shared/contracts` | Modified | Filter schemas |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Phase 1 events missing timestamps cannot be rebuilt (TRD-M6 sec. 10) | High | Verify event catalog before build |
| Roadmap row says "cash register and hours worked (8.5)", but 8.5 covers staff and tips only; cash metrics live in 8.2/8.4 | Low | Include payment and closing metrics; product owner confirms |
| Node and cloud SQL diverge | Med | One domain definition, contract tests on both dialects |

## Rollback Plan

Reports are read-only: disabling endpoints or screens has no effect on operation. Projections can be dropped and rebuilt from the inbox.

## Dependencies

- p1-02, p1-03, p1-05, p1-08, p1-09, p1-10, p0-02, p0-05.
- Unusual-behavior thresholds start at the PRD-01 examples and each venue can change them (D-31).

## Success Criteria

- [ ] The administrator reviews the day's operation on the node during an outage, and the history from the web.
- [ ] A hybrid site offline for 2 hours appears complete after syncing, with zero duplicates in totals.
- [ ] The same day yields the same totals on node and cloud.
