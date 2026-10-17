# Proposal: Support Panel

## Intent

blackHole support must diagnose a site — node, sync, pending invoices — without remote desktop access to the venue's mini PC, and only under an access the owner granted (PRD-M7 HU-M7-04; TRD-M7 sec. 8; TRD-00 sec. 8.4 Factus signals).

## Scope

### In Scope
- Per-company diagnostic view: site mode, node heartbeat, version, outbox backlog, sync cursor lag.
- Pending invoices per taxpayer and site: `pending_issue` and `uncertain`, by reason and age.
- Factus negotiation signals with thresholds (TRD-00 sec. 8.4): 429 responses per NIT, peak invoices per minute, queue drain time, monthly documents across companies, company count.
- Bag consumption by NIT and site.
- Support session using the owner-granted, expiring access token; everything audited in the customer's chain.

### Out of Scope
- Granting/revoking support access and its token rules — already in authorization (→ 0.5).
- Infrastructure dashboards in Grafana (→ 0.9).
- WhatsApp/email delivery of internal alerts (→ 5.1).
- Remote desktop or node credential retrieval: never in scope.

## Capabilities

### New Capabilities
- `support-panel`: tenant diagnostics, pending-invoice view, Factus signals and support sessions under granted access.

### Modified Capabilities
None

## Approach

Cloud read models in `contexts/saas/application` fed by node heartbeats (TRD-01 sec. 7), sync cursors and M3 document events. Factus signals are computed per NIT and cross-tenant (aggregates only). Panel routes require a valid support token evaluated by M0; Factus signals require the platform role and expose no operational data.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/saas/application` | Modified | Diagnostics and signal queries |
| `contexts/saas/adapters/postgres` | Modified | Signal and heartbeat projections |
| `contexts/platform/application/entry-port.ts` | Modified | Validate support token, audit support reads |
| `shared/sync` | Modified | Expose cursor lag and backlog per site |
| `contexts/invoicing/application/entry-port.ts` | Modified | Pending documents read model |
| `apps/api-cloud`, `apps/web-admin` | Modified | Panel routes and screens |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Support sees more than needed | Med | Token scope + expiry; panel shows status, not order content |
| Offline node looks healthy | Med | Stale heartbeat shown as unknown with last-seen time |
| Overlap with 0.5 support access | Low | This change consumes the 0.5 token; it does not redefine it |

## Rollback Plan

Panel is read-only. Disable panel routes and projections; support falls back to Grafana dashboards (0.9). No customer data is changed.

## Dependencies

- 0.5 support token, 0.9 heartbeats, 1.5 document states, 4.3 bag data.

## Success Criteria

- [ ] Support diagnoses a site without asking for remote access to the equipment.
- [ ] Without a valid grant, the panel opens nothing for that company.
- [ ] Every support read appears in the customer's audit trail.
- [ ] Crossing a Factus threshold raises one internal alert.
