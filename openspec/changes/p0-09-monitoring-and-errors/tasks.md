# Tasks: Monitoring and errors

## Review Workload Forecast

Estimated changed lines: 2200–3600. Delivery strategy: ask-on-risk. Suggested split: 1→6. Split Grafana off PR 5 if that diff exceeds 400 lines.

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Shared with 0.8: `application-module.ts`, `main.ts`, `worker.ts`, `contexts/platform/package.json`, `apps/api-cloud/package.json`, `ci.yml`. Add only these lines. They and `infra/` land with 0.8. `create-application.ts` only constructs ports. Health and `metricsFrom` stay. Test titles: given / when / then. `strict_tdd` stays false. Imports use the package map, never relative specifiers.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Scrub, catalog | 1, base tracker | `pnpm vitest run --project platform telemetry-scrub metric-catalog` | N/A: pure functions | both domain modules |
| 2 | Gate, `0005` | 2, base PR 1 | `pnpm vitest run --project platform provider-rate pending-issuance` | N/A: PGlite | `0005` and ports |
| 3 | Simulator worker | 3, base PR 2 | `pnpm vitest run --project api-cloud factus-simulator worker` | N/A: not scale-out | `issue-pending` |
| 4 | Export off | 4, base PR 3 | `pnpm vitest run --project api-cloud telemetry` | N/A: empty env | `telemetry.ts` |
| 5 | Terraform | 5, base PR 4 | `terraform fmt -check` and `terraform validate` | N/A: no apply; Azure plan-only | collector, grafana, sentry |
| 6 | CI tools | 6, base PR 5 | `node tools/observability/check-catalog.mjs` | `node tools/load/factus-rate.mjs`; smoke stays | `ci.yml` tool steps |

## Phase 1: Telemetry scrub and metric catalog

- [x] 1.1 Failing test first. `contexts/platform/domain/telemetry-scrub.ts`: `scrubTelemetry` drops authorization, cookie, password, token, secret, name, phone, address, identification, and phone or ID digit runs. Export from `domain/index.ts` via `#domain/*`.
- [x] 1.2 Failing test first. `metric-catalog.ts`: `invoices.pending`, `invoices.max_age_seconds`, `factus.requests`, `factus.responses` (`429`, `rejected`, `server_error`), `http.server.request.duration`, `http.server.requests`, `postgres.connections_in_use`, `pgboss.jobs_waiting`, `pgboss.oldest_job_seconds`, `pgboss.jobs_failed`, `deployment.info`. `service.instances` counts `target_info`. Invoice labels `tenant_id`, `venue_id`, `tax_id`, `status`. No HTTP `venue_id`. Digest `service.version`, not a label. Reject device, user, order, and metrics outside the four questions.

## Phase 2: Provider-rate gate and pending issuance

- [x] 2.1 Failing test first. Off `entry-port.ts`. `acquire(taxId, at)` allows 80 per tax id per minute, else `{ allowed: false, retryAfterSeconds }`. `snapshot()` returns `venueId`, `status`, `ageSeconds` for `pending_issuance` or `uncertain`. Contract on `in-memory-provider-rate-gate.ts` and `in-memory-pending-issuance.ts`. `#application/ports/*`, `#adapters/memory/*`.
- [x] 2.2 Failing PGlite test first: two callers, one window. `drizzle-provider-rate-gate.ts`, `drizzle-pending-issuance.ts`, `0005_provider_rate.sql` (window, synthetic rows). Do not edit `0001`–`0004`. Renumber only if `0005` is taken when apply starts. Export `contexts/platform/package.json`. `#adapters/postgres/*`.

## Phase 3: Worker issue-pending

- [x] 3.1 Failing test first. `apps/api-cloud/src/factus-simulator.ts` (`#src/*`): `issue()` returns `200` or `429` plus `retryAfterSeconds`. Real Factus HTTP and D-19 stay in delivery 1.5.
- [x] 3.2 Failing test first. `worker.test.ts`: `issue-pending` keeps sale order; over 80 or `429` reschedules in order; `factus.responses` records `429`, `rejected`, or `server_error`. Ports on `application-module.ts`. `publishQueue` stays depth and age, not Grafana.

## Phase 4: OTLP and Sentry wiring

- [x] 4.1 Failing test first. `telemetry.test.ts`: empty `OTEL_EXPORTER_OTLP_ENDPOINT` or `SENTRY_DSN` skips export. Failure does not fail the request or `GET /health` `{ "status": "ok" }`. Scrub first. Project `api-cloud`, release `service.version`, optional `SENTRY_ENVIRONMENT`. `telemetry.ts` from `main.ts` and `worker.ts`. SDK deps in `apps/api-cloud/package.json`. No browser SDK.

## Phase 5: Collector, Grafana, and Sentry

- [x] 5.1 `infra/modules/common/collector`: pinned contrib image, same redaction. Endpoint only on `infra/modules/{aws,gcp,azure}/service`. Azure plan-only. No `terraform apply`. PWAs stay in `static_bucket`. Cloudflare DNS only (D-40). Leave `common/dns`.
- [x] 5.2 `infra/modules/common/grafana`: dashboards site, invoices, cloud, deployment; one panel per catalog metric. Alarms, owner `blackhole`: under 99.5% this month or silent 5 minutes; invoice age over 30 minutes; over 3 rejections in 10 minutes per tax id; first production Sentry issue. No node, sync, wallet, platform-order, or cost panels. No retention (PA-41, p0-06), budget, or wallet source (PA-39).
- [x] 5.3 `infra/modules/common/sentry`: free-plan project `api-cloud`. `terraform fmt -check` and `validate` only. Rollout stays the load-balancer 5xx ratio and p95. Sentry does not replace that signal.

## Phase 6: Catalog check and Factus rate in CI

- [ ] 6.1 `tools/observability/check-catalog.mjs` fails device, user, or order labels, off-catalog metrics, a missing panel, and a collector mismatch. `tools/load/factus-rate.mjs` holds 80 per tax id per minute on the simulator, not cloud scale-out. Add both to `ci.yml`. Do not change the bake or `tools/delivery/smoke.mjs`.

## Leave untouched

`apps/local-node`, `health.controller.ts`, `metrics-*`, `tools/delivery/*`, `p0-04-identity-and-devices`, `p0-05-roles-and-permissions`, and their product files. Do not revert or restage `operate-identity.test.ts`, `shared/contracts/tsconfig.json`, `drizzle-authorization-repository.ts`.

## Refused

None for an open question. Threat matrix is N/A, so no threat RED task. Omitted as already closed: node telemetry, offline queue, SQLite, hybrid sync, node and sync alarms, browser Sentry, wallet, cost alarm, retention, real Factus, D-19.
