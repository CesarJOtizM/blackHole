# Proposal: Rappi Connector

## Intent

With only manual capture, cashiers still retype every Rappi order. This change adds the Rappi anti-corruption adapter so orders enter automatically, and adds to the hub the generic behaviors the first real connector exercises: status publishing, availability propagation, store pause and the silent-node watchdog (PRD-M5 HU-M5-02, TRD-00 sec. 6.1, TRD-M5 sec. 4 and 7, ADR-011).

## Scope

### In Scope
- Rappi adapter in `contexts/delivery/adapters/rappi`: signed webhook or polling, normalization, declared capabilities
- Encrypted per-store credentials in the cloud
- Order statuses (accepted, preparing, ready), channel menu, availability, store pause/resume, cancellations
- Hub: status propagation, availability propagation from inventory, manual pause, silent-node watchdog
- Fallback to manual capture without duplicates

### Out of Scope
- DiDi Food and integrator → 3.4
- Rappi settlement import → 3.5
- Platform reports → 3.9

## Capabilities

### New Capabilities
- `rappi-connector`: Rappi intake, publishing and cancellation behavior behind the connector port

### Modified Capabilities
- `platform-hub` (delta, added by this change): status and availability propagation, store pause, silent-node watchdog

## Approach

The adapter translates Rappi payloads into the domain `ExternalOrder`; Rappi JSON never leaves the adapter. Status events travel from the operation owner through the outbox to the hub, which calls the connector only for declared operations. The watchdog runs as a cloud worker and pauses stores of hybrid sites whose node is silent past a threshold.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/delivery/adapters/rappi` | New | Anti-corruption adapter |
| `contexts/delivery/application` | Modified | Propagation, pause, watchdog use cases |
| `contexts/inventory` | Modified | Availability events consumed by the hub |
| `shared/contracts`, `shared/sync` | Modified | Status and availability events |
| `apps/api-cloud` | Modified | Webhook endpoint, polling and watchdog workers, secrets |
| `apps/venue-app`, `apps/admin-web` | Modified | Pause controls, connector state |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rappi API access open: PA-28 (ADR-011) | High | Manual adapter remains; 3.4 integrator path |
| Accepted on Rappi but not in kitchen | Med | Watchdog pauses; auto-accept off when node silent |
| Rappi contract changes | Med | Contract suite per adapter |

## Rollback Plan

Switch the site's Rappi channel back to the Manual adapter (configuration only). Credentials can be revoked; hub keeps dedup by (platform, external id).

## Dependencies

- Platform hub (3.2); producible quantity (2.7) for availability
- Rappi API credentials and agreement (PA-28, ADR-011). Until then, adapters and test data (D-35).

## Success Criteria

- [ ] Real Rappi orders enter without being typed
- [ ] A Rappi order received during a site internet cut enters on reconnect without duplicates
- [ ] A silent hybrid node pauses the Rappi store and resumes it when back
