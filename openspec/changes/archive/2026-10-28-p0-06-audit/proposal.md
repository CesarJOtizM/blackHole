# Proposal: Audit

## Intent

Voids, discounts and authorizations are only trustworthy if nobody, not even the owner, can edit or delete their record, and if tampering on a node is detected in the cloud (PRD-M0 HU-M0-05, rule 9; PRD-01 8.7; TRD-00 10.3; TRD-M0 2, 4, 6).

## Scope

### In Scope
- Audit event with actor, authorizer, device, site, action, entity, before/after, reason and node time.
- Append-only storage in SQLite (node) and PostgreSQL (cloud); no edit or delete path.
- Hash chain per device.
- Cloud chain verification on batch receipt; findings for altered, deleted or reordered events.
- `RecordAuditEvent` on the platform entry port for other contexts.
- Scoped read access (auditor, site administrator).

### Out of Scope
- Control reports and unusual-behavior detectors → 1.7 / 1.11.
- Audit viewer in the support panel → 4.5.
- Long-term archive and retention policy → PA-41.

## Capabilities

### New Capabilities
- `audit`: append-only events, per-device hash chain, cloud verification, scoped reads.

### Modified Capabilities
None

## Approach

`AuditEvent` entity with chain linking in `contexts/platform/domain`; `RecordAuditEvent` and `VerifyChain` use cases; an `AuditRepository` contract suite proving insert-only on memory, SQLite and PostgreSQL (TRD-M0 9). Chain verification runs in a cloud worker when batches arrive. Owner of audit data: the node in hybrid mode, the cloud in cloud mode.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/platform/domain` | Modified | `AuditEvent`, chain rules |
| `contexts/platform/application` | Modified | `RecordAuditEvent`, `VerifyChain`, entry port |
| `contexts/platform/adapters/{sqlite,postgres,memory}` | Modified | Insert-only stores and contract suite |
| `shared/contracts` | Modified | Audit event schema |
| `apps/api-cloud` | Modified | Verification worker, findings |
| `apps/local-node` | Modified | Bind insert-only store |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Attacker rewrites a whole chain on the node | Med | Cloud keeps last verified hash per device; rewrite of confirmed events breaks it |
| Events still unsent when node is replaced | Med | Chain gap reported as finding, reconciled in 0.7 |
| SQLite cannot enforce insert-only at engine level like PostgreSQL | Med | Triggers plus contract suite; difference documented |

## Rollback Plan

Audit tables are additive and never dropped in production. Revert application commits; stored events stay. A broken verifier is disabled by flag while findings are kept.

## Dependencies

- p0-02 sync; p0-04 devices.

## Success Criteria

- [ ] Altering or deleting an event on a node is detected in the cloud.
- [ ] No route, role or adapter can edit or delete an audit event.
- [ ] `AuditRepository` contract suite passes on memory, SQLite and PostgreSQL.
