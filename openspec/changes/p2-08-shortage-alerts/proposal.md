# Proposal: Early Shortage Alert (Roadmap 2.8)

## Intent

Sites run out of ingredients mid-service because nobody sees the trend in time. This change warns before stock runs out — by levels, by coverage at the day-of-week pace and by dish — notifies the right roles, escalates ignored red alerts and turns an alert into a restock request or purchase order in one tap (PRD-00 M4, TRD-00 sec. 9.4, PRD-M4 HU-M4-04 and rules 9–11).

## Scope

### In Scope
- Levels (maximum, reorder point, minimum; sold out at ≤ 0) per ingredient and location, inheritable from a brand template.
- Level evaluation in the balance transaction; coverage every 15 minutes; dish alerts.
- Lifecycle open → seen → resolved with hysteresis.
- Notification per site, alert type and role; escalation.
- One-tap restock request or purchase order with suggested quantity.
- Suggested levels from a cloud worker.

### Out of Scope
- WhatsApp or email channels → 5.1.
- Alert reports (attention time, stockouts, coverage) → 2.10.
- Consolidated cloud alert view → 4.1.

## Capabilities

### New Capabilities
- `shortage-alerts`: levels, coverage, dish alerts, lifecycle, notification, escalation, one-tap actions, suggested levels.

### Modified Capabilities
None

## Approach

`contexts/inventory/domain` holds the alert aggregate with hysteresis and the coverage rule. Level checks run in the unit of work that updates the balance; a scheduler runs coverage. The location owner evaluates: `apps/local-node` (SQLite) for hybrid sites and node-backed warehouses, `apps/api-cloud` (PostgreSQL) for cloud-mode sites and warehouses without a node. Screens get WebSocket notices; phones get Web Push from the cloud. One-tap actions reuse the 2.3 / 2.5 use cases. Transitions are audited via `contexts/platform`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/inventory/domain` | New | Alert aggregate, levels, coverage |
| `contexts/inventory/application` | New | Evaluate, escalate, one-tap, propose levels |
| `contexts/platform/application` | Modified | Notification rules, audit |
| `shared/contracts` | New | Alert events |
| `apps/local-node`, `apps/api-cloud` | Modified | Scheduler, WebSocket, push, worker |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Alert fatigue from flapping | Medium | Resolve only above reorder point |
| Little history for coverage | High | No coverage alert until history suffices |
| Push unavailable offline | High | Node WebSocket screens work offline |
| Doc conflict: PRD-M4 rule 10 uses weekday average; TRD-00 9.4 adds time slot over last N weeks | Low | Master wins |
| Doc conflict: PRD-M4 lists "sold out" as configurable level; TRD-00 stores three | Low | Sold out implicit at ≤ 0 |

## Rollback Plan

Disable evaluation per site by configuration. Alerts write no stock movements; stored alerts stay readable and one-tap documents remain normal documents.

## Dependencies

- p2-03, p2-05, p2-07, p0-05, p0-06.
- The system suggests minimum, reorder point and maximum from consumption metrics. The venue can accept or type the values (D-32).

## Success Criteria

- [ ] Alerts fire before running out of product in at least one real case.
- [ ] A hybrid site shows alerts on cash register and kitchen screens during an outage.
- [ ] A restock request or purchase order is created from an alert in one tap and audited.
