## Verification Report

**Change**: p0-09-monitoring-and-errors
**Version**: N/A
**Mode**: Standard
**Evidence HEAD**: `f14e521` on `master`
**Spec**: `openspec/changes/p0-09-monitoring-and-errors/specs/observability/spec.md`

Strict TDD is inactive (`openspec/config.yaml` `strict_tdd: false`). The strict-TDD module was not loaded. `state.yaml` still says `status: applying` and `apply: partial`. Task checkboxes are the completion evidence. This phase did not rewrite `state.yaml`.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 11 |
| Tasks complete | 11 |
| Tasks incomplete | 0 |

Tasks 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 5.1, 5.2, 5.3, and 6.1 are checked.

### Build & Tests Execution
**Build**: ✅ Passed
```text
pnpm typecheck
$ tsc -b
EXIT_TYPECHECK:0
```

**Tests**: ❌ configured suite failed; task-scoped commands passed
```text
pnpm vitest run --project platform telemetry-scrub metric-catalog
  Test Files  2 passed (2)
  Tests       36 passed (36)
  EXIT_PLATFORM_SCRUB:0

pnpm vitest run --project platform provider-rate pending-issuance
  Test Files  4 passed (4)
  Tests       19 passed (19)
  EXIT_PLATFORM_RATE:0

pnpm vitest run --project api-cloud factus-simulator worker
  Test Files  2 passed (2)
  Tests       9 passed (9)
  EXIT_API_WORKER:0

pnpm vitest run --project api-cloud telemetry
  Test Files  1 passed (1)
  Tests       6 passed (6)
  EXIT_API_TELEMETRY:0

node tools/observability/check-catalog.mjs
  catalog panels, labels, and collector redaction match
  EXIT_CATALOG:0

node tools/load/factus-rate.mjs
  factus stays at 80 requests per tax id per minute
  EXIT_FACTUS_RATE:0

pnpm test
  Test Files  4 failed | 136 passed (140)
  Tests       4 failed | 1085 passed (1089)
  EXIT_PNPM_TEST:1

  FAIL |skeleton| route-permission-declaration.test.ts
    expected [] to equal missing permission declarations:
      local-node/tax.controller.ts POST tax-quotes
      local-node/tax.controller.ts POST fiscal-profiles/adopt

  FAIL |platform| drizzle-identity-repository.contract.test.ts
    Test timed out in 5000ms
    (given an identity and its change, when they are saved, then both can be read back)

  FAIL |platform| drizzle-organization-repository.contract.test.ts
    Test timed out in 5000ms
    (given an organization and its change, when they are saved, then both can be read back)

  FAIL |platform| drizzle-provider-rate-gate.contract.test.ts
    Test timed out in 5000ms
    (given a tax id with no requests in the minute, when acquire runs, then the request is allowed)

Isolated retry of the three timed-out files:
  pnpm vitest run --project platform drizzle-identity-repository.contract.test.ts drizzle-organization-repository.contract.test.ts drizzle-provider-rate-gate.contract.test.ts
  Test Files  3 passed (3)
  Tests       14 passed (14)
  EXIT_RETRY:0

Terraform v1.16.6
terraform fmt -check -recursive
  infra/modules/common/collector   EXIT 0
  infra/modules/common/grafana     EXIT 0
  infra/modules/common/sentry      EXIT 0
  infra/modules/aws/service        EXIT 0
  infra/modules/gcp/service        EXIT 0
  infra/modules/azure/service      EXIT 0

terraform init -backend=false -input=false && terraform validate
  collector, grafana, sentry, aws/service, gcp/service, azure/service
  each EXIT 0 (Success! The configuration is valid.)
No terraform apply was run. Init lock files and .terraform directories were removed after validate.
```

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available

`openspec/config.yaml` sets `coverage.command: null`. No coverage run.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Signals Through a Collector | End-to-end trace | (none found) | ❌ UNTESTED |
| Signals Through a Collector | High-cardinality label | `contexts/platform/domain/metric-catalog.test.ts` > given a metric labelled by user_id, when it is reviewed, then it is rejected | ✅ COMPLIANT |
| Metric Catalog | Panel per metric | `node tools/observability/check-catalog.mjs` (source panel parity; dashboards not applied) | ⚠️ PARTIAL |
| Metric Catalog | Unanswered question | `contexts/platform/domain/metric-catalog.test.ts` > given node.connected / factus.wallet_balance / platforms.orders / order.total, when it is reviewed, then it is rejected | ✅ COMPLIANT |
| Node Telemetry at Lowest Priority | Weak link | (none found) | ❌ UNTESTED |
| Node Telemetry at Lowest Priority | Full buffer | (none found) | ❌ UNTESTED |
| Dashboards and Alarms as Code | Node disconnected | (none found) | ❌ UNTESTED |
| Dashboards and Alarms as Code | Pending invoice | (none found; Grafana expr exists, no evaluation test) | ❌ UNTESTED |
| Dashboards and Alarms as Code | Cloud availability below target | (none found; Grafana expr exists, no evaluation test) | ❌ UNTESTED |
| Dashboards and Alarms as Code | Sync delay over target | (none found) | ❌ UNTESTED |
| Error Tracking with Deferred Sending | PWA error offline | (none found) | ❌ UNTESTED |
| Error Tracking with Deferred Sending | New error in production | (none found; Grafana expr exists, no evaluation test) | ❌ UNTESTED |
| No Personal Data | Error with customer phone | `contexts/platform/domain/telemetry-scrub.test.ts` > given an error whose message contains a phone number, when it is scrubbed, then the number is removed; `apps/api-cloud/test/composition/telemetry.test.ts` > given a phone and a bearer token, when the payload is exported, then both destinations receive it scrubbed | ✅ COMPLIANT |
| No Personal Data | Pattern test | `contexts/platform/domain/telemetry-scrub.test.ts` > given a log line containing an identification number, when it is scrubbed, then the number is removed | ⚠️ PARTIAL |
| Worker Scaling Within Provider Limit | Load test | `node tools/load/factus-rate.mjs`; `apps/api-cloud/test/composition/worker.test.ts` > given more than 80 requests in the minute, when the issue-pending job runs, then the sales are rescheduled in sale order | ⚠️ PARTIAL |
| Worker Scaling Within Provider Limit | Provider throttles | `apps/api-cloud/test/composition/worker.test.ts` > given Factus returns 429, when the issue-pending job runs, then the sales are rescheduled in sale order and factus.responses records 429 | ✅ COMPLIANT |

**Compliance summary**: 4/16 scenarios compliant, 3 partial, 9 untested, 0 failing

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Signals Through a Collector | ⚠️ Partial | Collector module is pinned to `otel/opentelemetry-collector-contrib:0.163.2` and environment roots pass `collector_endpoint` into api and worker services. `startTelemetry` builds a trace exporter only. `metricReaders` and `logRecordProcessors` are empty and `instrumentations` is empty. `startApi` and `startWorker` discard the returned `ActiveTelemetry`, so request handlers do not export logs, metrics, or a shared trace id. No node emitter. |
| Metric Catalog | ⚠️ Partial | `reviewMetric` allow-list matches the task catalog, invoice labels, Factus statuses, and `service.instances` counting `target_info`. `check-catalog.mjs` passed. Nothing in the API or worker records those names on an OTLP meter. `issuePending` returns `factus.responses` records in memory. |
| Node Telemetry at Lowest Priority | ❌ Missing | No telemetry event class, priority, or bounded buffer under `shared/` or `apps/local-node`. Design defers this (D-37). The delta spec still requires it. |
| Dashboards and Alarms as Code | ⚠️ Partial | `infra/modules/common/grafana/main.tf` has dashboards `site`, `invoices`, `cloud`, and `deployment`, and alarm expressions for 99.5% / 5 minutes silent, invoice age over 1800 seconds, more than 3 rejections in 10 minutes, and the first production Sentry issue. Owner label is `blackhole`. No environment root instantiates the grafana module, so a service plan does not include the dashboard. No node-offline or sync-delay alarm. Annotations carry `summary` and no action. |
| Error Tracking with Deferred Sending | ⚠️ Partial | `@sentry/node` initializes when `SENTRY_DSN` is set, with project `api-cloud` and release `service.version`. Empty DSN skips the client. Export failure does not fail `/health`. No PWA queue, no source-map upload, no node Sentry. `infra/modules/common/sentry` is not referenced by any environment root. |
| No Personal Data | ✅ Implemented | `scrubTelemetry` redacts the named fields and phone / dotted-id / 7–10 digit runs. Collector `drop_keys` and `digit_run` match that set (`check-catalog.mjs` passed). Export scrubs before the destination `export` call. |
| Worker Scaling Within Provider Limit | ⚠️ Partial | In-memory and PGlite gates share 80 requests per tax id per minute. `issuePending` reschedules in sale order on refusal or HTTP 429 and records `429`, `rejected`, and `server_error`. `factus-rate.mjs` holds the same cap on the simulator. No test scales worker instances up or down. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cloud MVP only; no `apps/local-node` edits (D-37) | ✅ Yes | No OpenTelemetry or Sentry imports under `apps/local-node` or `shared/`. |
| API and workers emit OTLP logs, metrics, and traces; worker sends Factus and queue gauges to the collector | ❌ No | Trace SDK only, and the handle is discarded. `publishQueue` stays on `RuntimeMetrics` depth and age. |
| Empty `OTEL_EXPORTER_OTLP_ENDPOINT` or `SENTRY_DSN` skips export; export failure does not fail the request or `GET /health` | ✅ Yes | Covered by `telemetry.test.ts` (6 passed). |
| Factus simulator instead of live HTTP; D-19 stays in 1.5 | ✅ Yes | `FactusSimulator.issue()` replays scripted `200` / `429` outcomes. |
| Pinned contrib collector; Azure plan-only; no `terraform apply` | ✅ Yes | Image tag `0.163.2`. `staging-azure` sets `plan_only = true`. Validate only. |
| Grafana dashboards and the four in-scope alarms; no node, sync, wallet, or cost panels | ⚠️ Partial | Module contents match. Environment roots do not instantiate `common/grafana` or `common/sentry`. |
| Sentry free-plan project `api-cloud` | ⚠️ Partial | `local.plan` precondition compares the constant `"free"` with itself. The resource does not set a plan, and no environment calls the module. |
| Ports off `entry-port.ts`; `0005_provider_rate.sql`; `0001`–`0004` left alone | ✅ Yes | Gate and pending-issuance ports are separate. PGlite tests load `0005_provider_rate.sql`. |
| `factus-rate.mjs` is the 80/minute cap, not cloud scale-out; both tools run in `ci.yml` | ✅ Yes | CI steps at `.github/workflows/ci.yml` run `check-catalog.mjs` and `factus-rate.mjs`. |
| Scrub before either destination receives the payload | ✅ Yes | `exportSignal` calls `scrubTelemetry` before `destination.export`. |
| `common/dns` left as DNS-only; PWAs stay in `static_bucket` | ✅ Yes | `staging-azure` still uses `common/dns` and outputs `static_bucket`. No PWA Sentry package. |

### Issues Found
**CRITICAL**:
- Nine spec scenarios have no passing covering test: end-to-end trace, weak link, full buffer, node disconnected, pending-invoice alarm, cloud availability alarm, sync-delay alarm, PWA error offline, and new production error. Design and tasks defer node telemetry, the offline buffer, node and sync alarms, and browser Sentry (D-37). The delta spec still states those behaviors as MUST. Specs are judged first. Archive cannot merge this delta as written.
- In-scope cloud signals do not match the spec or the design sequence. `NodeSDK` is constructed with empty metric readers, log processors, and instrumentations. `startApi` and `startWorker` ignore the object that would export a scrubbed payload. Catalog metrics are not emitted on the OTLP path. The collector therefore has no logs, metrics, or request trace to forward.
- Configured `pnpm test` exited 1 (4 failed, 1085 passed). The skeleton failure is deterministic and outside this change's tasks: `route-permission-declaration.test.ts` reports `local-node/tax.controller.ts` POST `tax-quotes` and POST `fiscal-profiles/adopt` with no permission declaration. Tasks say to leave `apps/local-node` untouched. The three PGlite timeouts (identity, organization, and this change's provider-rate gate) passed on an immediate isolated retry (14/14) and the task-scoped provider-rate run passed 19/19. The configured command is still red on this HEAD.

**WARNING**:
- Panel-per-metric is only source parity. `check-catalog.mjs` passed, and no environment applies the Grafana module.
- The load-test scenario's 80-per-minute cap passed on the simulator and the worker reschedule path. Workers are not scaled up and then down.
- The pattern-test scenario says the privacy test fails when a log line contains an ID number. The scrub test passes by asserting the number is removed.
- Alarm rules have an owner and a threshold expression, and no action annotation.
- `state.yaml` still records `applying` / `apply: partial` / `verify: pending` after tasks 1.1–6.1 were checked. Verify did not change that file.
- Task 3.1 names `apps/api-cloud/src/factus-simulator.ts`. The implementation is `apps/api-cloud/src/composition/factus-simulator.ts` (same for `telemetry.ts`). Behavior is present; the path differs from the task line.

**SUGGESTION**:
- Before another apply, split the delta spec. Mark D-37 deferrals as REMOVED or MODIFIED, and keep only behaviors this change will actually ship and test.
- If availability, invoice-age, rejection, and first-Sentry alarms are in this delivery, compose `common/grafana` and `common/sentry` from the environment roots and add a test that those expressions fire.
- Emit catalog metrics and logs through the collector, or narrow the signals requirement to the trace exporter that exists today. Keep the `ActiveTelemetry` handle and call it from the request path.

### Verdict
FAIL
4/16 scenarios are compliant. Task-scoped Vitest, catalog check, Factus rate check, typecheck, `terraform fmt -check`, and `terraform validate` passed. The delta spec still requires untested node, alarm, trace, and PWA behavior; the cloud SDK does not emit logs or metrics; and `pnpm test` is red. Archive is not allowed.
