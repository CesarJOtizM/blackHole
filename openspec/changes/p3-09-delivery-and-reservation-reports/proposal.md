# Proposal: Delivery and Reservation Reports

## Intent

Delivery stages, platform commissions and reservations are captured since 3.1–3.8, but nobody can read them. This change adds the delivery and platform time metrics (PRD-00 sec. 8.1), sales by channel and platform metrics (sec. 8.2) and reservation reports (sec. 8.6) to `reporting` (PRD-M6 sec. 7, TRD-M6).

## Scope

### In Scope
- Times: platform acceptance, platform rider wait, delivery preparation, dispatch, en route, total; by site, channel, courier, slot and weekday with average, p50, p90
- Sales by channel: waiter table, QR table, counter, own delivery, each platform
- Net sales per platform, rejected or cancelled orders per platform, settlement differences
- Reservations: by day, slot and channel; no-show rate; occupancy; income (deposits credited, fees, retained); ticket with vs without reservation
- Day view on the operation owner; history in the cloud

### Out of Scope
- Company-wide consolidation and percentiles across all dimensions → 4.1
- Accountant exports → 4.2

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `reporting`: delivery and platform times, channel sales, platform metrics, reservation reports

## Approach

Pure metric definitions in `contexts/reporting/domain` reused by node (SQLite) and cloud (PostgreSQL) queries. Cloud projections consume delivery and reservation events from the inbox idempotently. Lagging sites are marked, never zero-filled.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/reporting/domain` | Modified | New metric definitions |
| `contexts/reporting/application`, `adapters/{sqlite,postgres}` | Modified | Day queries, projections |
| `contexts/delivery`, `contexts/reservations` | Modified | Event fields needed by projections |
| `shared/contracts` | Modified | Report filter schemas |
| `apps/local-node`, `apps/api-cloud` | Modified | Day and history endpoints |
| `apps/site-app`, `apps/web-admin` | Modified | Report screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Missing stage events make times unreliable | Med | Missing endpoint yields no value, not zero |
| Courier-side timestamps from phone clock | Med | Use node/cloud receipt time per TRD-M6 |
| Commission data incomplete | Med | Show "commission missing" separately |

## Rollback Plan

Hide the new report screens; projections are read models and can be dropped and rebuilt from the inbox without touching operational data.

## Dependencies

- Site reports (1.11); deliveries 3.1–3.8 emitting events

## Success Criteria

- [ ] Times and commissions measured in at least 1 site
- [ ] A hybrid site offline for 2 hours shows complete delivery times after sync, without duplicates
- [ ] The admin sees today's delivery times on the node during an internet cut
