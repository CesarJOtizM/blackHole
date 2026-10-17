# Proposal: Hybrid Resilience

## Intent

In hybrid mode the node is a single point of failure inside the site (TRD-00 5.3). Hybrid sites need power and crash recovery, a spare-node restore under 30 minutes, a safe failover to the cloud (ADR-004), robust retries on intermittent links with a recommended 4G backup (ADR-008), and staged node updates with rollback (TRD-00 17, TRD-01 2.3, 5.3). Applies only to sites with hybrid active.

## Scope

### In Scope
- Automatic service restart; UPS as kit requirement for hybrid sites.
- Spare-node restore from the cloud in under 30 minutes.
- Failover to the cloud only with empty outbox or administrator confirmation; reconciliation of the returning node.
- Sync retries with growing backoff, resume after reconnect, backup 4G link.
- Two-way drain on reconnect: pending invoice-class events out, cloud-held QR orders and payments in.
- Return to cloud with pending events only through explicit, audited administrator acceptance (D-02).
- Local capacity: at least 90 days of site operation stored on the node (TRD-00 15).
- Staged node updates, off-hours, automatic rollback; cloud accepts current and previous sync contract.

### Out of Scope
- Real invoices, QR orders and QR payments → 1.5, 1.12, 1.13 (this change uses their event classes).
- The 4G modem is recommended and the owner buys it (D-36, ADR-008).
- Hot standby second node → excluded until failure data exists (TRD-00 5.3).
- Node telemetry → 0.9.

## Capabilities

### New Capabilities
- `node-resilience`: restart, restore, failover, staged updates, cut drill.

### Modified Capabilities
- `sync`: retries and backoff, backup link, two-way drain on reconnect.

## Approach

Failover and reconciliation as use cases next to `ActivateHybrid` / `ReturnToCloud` in `contexts/platform/application`; retry policy and link switching in `shared/sync`; node container restart policy and staged update channel in `apps/local-node` packaging. Fault-injection tests per TRD-00 16.9: simulated cut, duplicate, out-of-order, node restart, owner change mid-batch.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/application` | Modified | `FailOverToCloud`, reconciliation |
| `shared/sync` | Modified | Backoff, resume, link switching, inbound drain |
| `apps/local-node` | Modified | Restart policy, update agent, restore command |
| `apps/api-cloud` | Modified | Failover endpoint, dual sync contract |
| `infra/` (planned) | Modified | Node image channel with stages |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Invoice/QR flows not built yet | High | Drill with synthetic events of those priority classes; re-run in 1.5 and 1.13 |
| Administrator accepts losing unsent events by mistake | Med | Explicit acceptance step showing the pending count; audited with the unsent events (D-02) |
| Failed update during service | Low | Off-hours only, health gate, rollback |

## Rollback Plan

Disable failover and staged updates by flag; nodes keep the previous image. Sites can return to cloud with empty outbox, or with audited acceptance of the unsent remainder (D-02).

## Dependencies

- p0-02, p0-03, p0-04, p0-06; ADR-004, ADR-008.

## Success Criteria

- [ ] Restore in under 30 minutes.
- [ ] A 2-hour cut loses no dining-room orders; on reconnect pending invoices go out and the QR orders and payments left in the cloud come in.
- [ ] Returning to cloud mode requires an empty outbox, or an explicit administrator acceptance of what remains unsent, audited with the unsent events (D-02).
- [ ] The node keeps at least 90 days of site operation without depending on the cloud (TRD-00 15).- [ ] A failed node update rolls back on its own.
