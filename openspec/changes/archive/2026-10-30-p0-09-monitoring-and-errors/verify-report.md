## Verification Report

**Change**: p0-09-monitoring-and-errors
**Version**: N/A
**Mode**: Standard
**Evidence**: working tree on `docs/cash-register-change` at HEAD `208b303`
**Spec**: `openspec/changes/p0-09-monitoring-and-errors/specs/observability/spec.md`

Strict TDD is inactive (`openspec/config.yaml` `strict_tdd: false`). The strict-TDD module was not loaded. This run judges the current cloud-MVP spec (D-37): api-cloud and its worker on PostgreSQL. REMOVED requirements are not acceptance criteria and are not rows below. The FAIL report written against commit `208b303` before tasks 7.1–7.6 is replaced by this run. A scenario is compliant only when a covering test passed in this run.

Phase 7 files are modified in the working tree and are not in commit `208b303`. This run did not commit.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 17 |
| Tasks complete | 17 |
| Tasks incomplete | 0 |

Tasks 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 5.1, 5.2, 5.3, 6.1, 7.1, 7.2, 7.3, 7.4, 7.5, and 7.6 are checked.

### Build & Tests Execution
**Build**: ✅ Passed
```text
pnpm exec tsc -b apps/api-cloud --pretty false
(no compiler output)
EXIT: 0
```

**Tests**: ✅ scoped and covering commands passed
```text
pnpm exec vitest run --project api-cloud telemetry
  Test Files  1 passed (1)
  Tests       8 passed (8)
EXIT: 0

pnpm exec vitest run --project platform telemetry-scrub metric-catalog provider-rate
  Test Files  4 passed (4)
  Tests       45 passed (45)
EXIT: 0

pnpm exec vitest run --project api-cloud worker factus-simulator
  Test Files  2 passed (2)
  Tests       9 passed (9)
EXIT: 0

node tools/observability/evaluate-alarms.mjs
  availability, invoice age, rejections, and first production alarms fire
EXIT: 0

node tools/observability/check-catalog.mjs
  catalog panels, labels, collector redaction, alarm actions, and grafana modules match
EXIT: 0

node tools/load/factus-rate.mjs
  factus stays at 80 requests per tax id per minute
EXIT: 0
```

`pnpm test` was not run. The invoicing context was not run.

Negative catalog probe, outside the repo, on a temp root whose only environment mounts `module "collector"` and omits `module "grafana"`. Exit 1 is the expected rejection, not a product failure:
```text
node tools/observability/check-catalog.mjs <temp root>
  staging-aws mounts the collector without module "grafana"
EXIT: 1
```

**Terraform**: ✅ format and validate passed for `infra/modules/common/grafana`. Terraform 1.16.6 is on PATH. `terraform apply` was not run. Init and validate used a temp copy, so the worktree did not gain `.terraform` or a lock file.
```text
terraform -chdir=infra/modules/common/grafana fmt -check
EXIT: 0

terraform -chdir=<temp copy> init -backend=false -input=false
EXIT: 0

terraform -chdir=<temp copy> validate
  Success! The configuration is valid.
EXIT: 0
```

**Coverage**: ➖ Not available / threshold: 0%

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Metric Catalog | Panel per metric | `node tools/observability/check-catalog.mjs` (each catalog metric has a panel) | ✅ COMPLIANT |
| Metric Catalog | Unanswered question | `metric-catalog.test.ts` > given `node.connected` / `factus.wallet_balance` / `platforms.orders` / `service.instances`, when reviewed, then rejected | ✅ COMPLIANT |
| Worker Scaling Within Provider Limit | Load test | `provider-rate-gate.contract.ts` > given 80 requests for one tax id in the minute, when another acquire runs, then it is refused; `worker.test.ts` > given more than 80 requests in the minute, when issue-pending runs, then the sales are rescheduled in sale order; `tools/load/factus-rate.mjs` | ⚠️ PARTIAL |
| Worker Scaling Within Provider Limit | Provider throttles | `worker.test.ts` > given Factus returns 429, when the issue-pending job runs, then the sales are rescheduled in sale order and `factus.responses` records 429 | ✅ COMPLIANT |
| Export Stays Off the Request Path | Unset exporters | `telemetry.test.ts` > given empty export destinations, when telemetry starts, then neither client is constructed | ✅ COMPLIANT |
| Export Stays Off the Request Path | Export failure | `telemetry.test.ts` > given a throwing exporter, when a request exports telemetry and health is read, then the request succeeds and health stays ok | ✅ COMPLIANT |
| Signals Through a Collector | Cloud logs, metrics, and traces | `telemetry.test.ts` > given the worker continues a cloud request, when telemetry is exported, then logs, catalog metrics, and traces share one trace id | ✅ COMPLIANT |
| Signals Through a Collector | High-cardinality label | `metric-catalog.test.ts` > given a metric labelled by `user_id`, when it is reviewed, then it is rejected | ✅ COMPLIANT |
| Dashboards and Alarms as Code | Cloud availability below target | `evaluate-alarms.mjs` > under 99.5% this month, and silent 5 minutes, fire; 99.5% with recent traffic does not | ✅ COMPLIANT |
| Dashboards and Alarms as Code | Pending invoice | `evaluate-alarms.mjs` > an invoice pending 31 minutes fires; 30 minutes does not | ✅ COMPLIANT |
| Dashboards and Alarms as Code | Repeated rejections | `evaluate-alarms.mjs` > over 3 rejections in 10 minutes for one tax id fires; 3 for one tax id, and 4 split across two tax ids, do not | ✅ COMPLIANT |
| Dashboards and Alarms as Code | First production error | `evaluate-alarms.mjs` > an error never seen in production fires; a repeated production error, and a first error outside production, do not | ✅ COMPLIANT |
| Cloud Error Tracking | Cloud error report | `telemetry.test.ts` > given company, site, role, and release on a cloud error, when api-cloud or the worker reports it, then the sentry double stores company, site, role, and release `service.version` | ✅ COMPLIANT |
| No Personal Data | Error with customer phone | `telemetry-scrub.test.ts` > given an error whose message contains a phone number, when it is scrubbed, then the number is removed; `telemetry.test.ts` > given a phone and a bearer token, when the payload is exported, then both destinations receive it scrubbed | ✅ COMPLIANT |
| No Personal Data | Pattern test | `telemetry-scrub.test.ts` > given a log line containing an identification number, when it is scrubbed, then the number is removed (`not.toMatch(/\d{7,10}/)` fails the run if the digit run remains) | ✅ COMPLIANT |

**Compliance summary**: 14/15 scenarios compliant, 1 partial, 0 failing, 0 untested

REMOVED and not judged: Node Telemetry at Lowest Priority, Node Disconnected Alarm, Sync Delay Alarm, Offline PWA Error Queue and Deferred Browser Sentry, PWA-to-Node Trace.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Metric Catalog | ✅ Implemented | `reviewMetric` accepts the catalog and rejects names outside serve, invoices, cloud health, and release. `check-catalog.mjs` requires one Grafana panel per catalog metric. |
| Worker Scaling Within Provider Limit | ⚠️ Partial | The shared minute window caps one tax id at 80. A 429 reschedules in sale order and records `factus.responses` status `429`. `factus-rate.mjs` holds the same ceiling and states that it does not change cloud scale-out. No path scales worker replicas up and then down. |
| Export Stays Off the Request Path | ✅ Implemented | Empty `OTEL_EXPORTER_OTLP_ENDPOINT` and `SENTRY_DSN` skip clients. Export exceptions are swallowed. `GET /health` stays `{ "status": "ok" }`. |
| Signals Through a Collector | ✅ Implemented | The passing telemetry test records logs, `http.server.requests`, and traces from api-cloud and the worker on one trace id. Each log carries tenant, site, and that trace id. `main.ts` and `worker.ts` pass `continuedTraceFromEnv(env)` into `startTelemetry`. Export uses OTLP log, metric, and trace exporters pinned at `0.300.0`. The collector in this test is an exporter double, which task 7.1 allows. |
| Dashboards and Alarms as Code | ✅ Implemented | `evaluate-alarms.mjs` reads `infra/modules/common/grafana/main.tf` and the four cases fire. Each alarm has owner `blackhole`, a threshold expression, and an `action`. `grafana_rule_group.blackhole` annotations carry `action`. The six environment roots compose `module "grafana"` with source `../../modules/common/grafana`. A temp environment that mounts the collector without that module makes `check-catalog.mjs` exit 1. |
| Cloud Error Tracking | ✅ Implemented | The Sentry double for api-cloud and the worker stores `company`, `site`, `role`, and release `service.version`. Project `api-cloud` plus release alone does not satisfy the assertion. The phone in the same error is removed before send. |
| No Personal Data | ✅ Implemented | `scrubTelemetry` removes phone and ID digit runs and sensitive fields before export. Collector drop keys and the 7–10 digit run match the scrubber (`check-catalog.mjs`). |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Empty OTLP endpoint or Sentry DSN skips that export | ✅ Yes | Covered by `telemetry.test.ts`. |
| Export failure does not fail the request or `/health` | ✅ Yes | Covered by `telemetry.test.ts`. |
| 80 requests per tax id per minute, PostgreSQL window | ✅ Yes | In-memory and Drizzle gate tests passed in the platform run. |
| 429 reschedules in order and records `factus.responses` | ✅ Yes | `worker.test.ts`. |
| Scrub before data leaves api-cloud; collector uses the same redaction | ✅ Yes | Export test plus `check-catalog.mjs`. |
| api-cloud and the worker emit logs, metrics, and traces on one trace id | ✅ Yes | `telemetry.test.ts` plus `continuedTraceFromEnv` from `main.ts` and `worker.ts`. |
| Dashboards and alarms ship with the service; each alarm has owner, threshold, and action | ✅ Yes | Six environments compose Grafana. Alarm evaluation and the missing-module probe passed. |
| Errors carry company, site, role, and release | ✅ Yes | Sentry double stores those fields and release `service.version`. |
| Factus simulator, not live HTTP; `publishQueue` stays depth and age | ✅ Yes | `factus-simulator.test.ts` and `worker.test.ts`. |
| No local-node telemetry, offline buffer, node or sync alarms, or browser Sentry | ✅ Yes | Those requirements are REMOVED. This run did not edit `apps/local-node`. |
| Worker replicas scale up and then down | ❌ No | Deferred by D-37 and by the phase 7 task note. The rate ceiling is tested. This does not break a requirement that this change still claims to implement beyond the partial load-test scenario. |

### Issues Found
**CRITICAL**: None

**WARNING**:
- Load test: the 80-per-minute ceiling passed (gate, worker reschedule, and `factus-rate.mjs`). Workers are not scaled up and then down. Phase 7 still defers that as a D-37 warning, and `factus-rate.mjs` states that it does not change cloud scale-out.
- `proposal.md` success criteria still require a disconnected node, a PWA error after reconnect, and a sync-delay alarm. The current spec removed those. They were not judged.
- The verified phase 7 behavior is in the working tree on HEAD `208b303`, not in that commit. This run did not commit.

**SUGGESTION**:
- `invoice_age` is `max(invoices_max_age_seconds) > bool 1800`. The 31-minute pending series fires and the 30-minute series does not. The expression does not filter `pending_issuance`.

### Verdict
PASS WITH WARNINGS
14/15 cloud-MVP scenarios are compliant. The three gaps from `208b303` — one trace id across logs, catalog metrics, and traces; the four alarms plus a collector environment without `module "grafana"`; and company, site, role, and release `service.version` on a cloud error — now have passing tests. The load-test scale-up and scale-down path stays partial. No CRITICAL remains.
