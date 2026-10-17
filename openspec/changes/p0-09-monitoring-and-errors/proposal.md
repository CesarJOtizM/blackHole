# Proposal: Monitoring and Errors

## Intent

The team must know, across any of the three clouds, whether a site can serve, whether invoices go out, whether the cloud holds up and whether the last release broke something, without telemetry competing with operation on a weak site link and without personal data (TRD-01 7, 8; ADR-013, ADR-014; Law 1581).

## Scope

### In Scope
- OpenTelemetry logs, metrics and traces from API, workers and node, through a collector to Grafana Cloud.
- Metric catalog of TRD-01 7.3 (site, invoices, cloud, deployment).
- Node telemetry every minute as lowest-priority sync batches, bounded offline buffer.
- Grafana dashboards and alarms as code (TRD-01 7.4, 7.5).
- Sentry in cloud, node and PWAs with deferred sending and personal-data scrubbing; releases and source maps.
- Load test proving worker scaling stays within Factus' per-NIT limit.

### Out of Scope
- Platform-order metrics and dashboard → 3.3.
- Support-panel view of alarms → 4.5.
- Real invoice emission → 1.5 (this change instruments the pending-invoice metric with a simulator).

## Capabilities

### New Capabilities
- `observability`: signals, metric catalog, node telemetry, dashboards/alarms, error tracking, privacy.

### Modified Capabilities
None

## Approach

OpenTelemetry SDK in `apps/api-cloud` and `apps/local-node`; node telemetry as a low-priority event class in `shared/sync`; collector image and Grafana/Sentry resources in `infra/modules/common`. A scrubber in the SDKs and collector, plus an automated test searching for ID-number and phone patterns. A per-NIT rate counter in PostgreSQL shared by all workers, exercised by a Factus simulator under load.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/api-cloud`, `apps/local-node` | Modified | OTel and Sentry SDKs, metric emitters |
| `shared/sync` | Modified | Telemetry event class, bounded buffer |
| `apps/site-app`, `apps/admin-web` (planned) | Modified | Sentry with offline queue |
| `infra/modules/common` | Modified | Collector, dashboards, alarms, Sentry projects |
| `tools/load/` (planned) | New | Worker scaling load test with Factus simulator |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Invoice metrics before invoicing exists | High | Factus simulator and synthetic pending documents; re-verify in 1.5 |
| Telemetry saturates weak site links | Med | Lowest priority, bounded buffer |
| Personal data leaks into logs or Sentry | Med | Scrubbing in SDK and collector; pattern test |
| ADR-014 (Sentry SaaS vs self-hosted) open | Low | SaaS assumed; DSN is configuration |

## Rollback Plan

Telemetry and Sentry are toggled by configuration; disabling them leaves operation untouched. Dashboards and alarms revert through Terraform.

## Dependencies

- p0-02 sync priority; p0-08 environments and pipeline; Grafana Cloud and Sentry accounts.

## Success Criteria

- [ ] A disconnected node appears in Grafana and triggers its alarm; an invoice pending for more than 30 minutes also does; an error in a PWA without internet reaches Sentry on reconnect, with no personal data; in a load test the workers scale up and down without exceeding Factus' per-NIT limit.
- [ ] Every metric in the catalog has a dashboard panel.
