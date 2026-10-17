# Proposal: DiDi Food Connector

## Intent

DiDi Food orders are still typed by hand. This change connects DiDi Food to the hub, either directly or through a third-party integrator, per ADR-011, with the same behavior as Rappi (roadmap 3.4, PRD-M5, TRD-00 sec. 6.1, TRD-M5).

## Scope

### In Scope
- DiDi Food anti-corruption adapter in `contexts/delivery/adapters/didi-food`, or Integrator adapter in `contexts/delivery/adapters/integrator`
- Encrypted credentials, automatic reception, statuses, menu, availability, store pause, cancellations
- Platform identity preserved when orders come through an integrator
- Manual fallback without duplicates

### Out of Scope
- DiDi Food settlement import → 3.5
- Platform reports → 3.9
- Additional platforms beyond Rappi and DiDi Food (architecture allows them; no delivery scheduled)

## Capabilities

### New Capabilities
- `didi-food-connector`: DiDi Food intake, publishing and cancellations, direct or via integrator

### Modified Capabilities
None

## Approach

Reuse the connector port, hub propagation and watchdog from 3.2/3.3. The chosen path (direct or integrator) is a site-channel configuration; the hub only sees declared capabilities. The idempotency key always uses the real platform, never the integrator, so a manual capture and an integrator delivery of the same order collapse into one.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/delivery/adapters/didi-food` | New | Direct adapter |
| `contexts/delivery/adapters/integrator` | New (if ADR-011 picks it) | Integrator adapter |
| `shared/contracts` | Modified | Channel configuration schema |
| `apps/api-cloud` | Modified | Webhook/polling endpoints, secrets |
| `apps/admin-web` | Modified | Link DiDi store, choose path |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| DiDi API access or integrator quote open: PA-28 (ADR-011) | High | Manual adapter stays; decision gate before build |
| Integrator exposes fewer capabilities | Med | Declared capabilities; portal fallback |
| Integrator outage affects several platforms | Med | Per-channel manual fallback and alert |

## Rollback Plan

Switch the DiDi channel to the Manual adapter by configuration and revoke credentials. Received orders remain as normal internal orders.

## Dependencies

- Platform hub (3.2) and hub delta from Rappi connector (3.3)
- PA-28 (ADR-011) decision; DiDi or integrator credentials

## Success Criteria

- [ ] Real DiDi Food orders enter without being typed
- [ ] The same order captured manually and received by the connector exists once
