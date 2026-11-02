# Apply progress: p0-09-monitoring-and-errors

Mode: Standard. `strict_tdd` is false. ADR-017 still ran RED then GREEN for 7.1 before 7.2, for 7.3 before 7.4, and for 7.5 before 7.6. The strict-TDD module was not loaded.

Workload: feature-branch-chain. The trace batch is PR 7, the base of the chain. The alarms batch is PR 8 and targets that slice. This Sentry batch is PR 9 and targets the PR 8 branch. No commit, push, or pull request.

17 of 17 tasks are checked. Phases 1–6 were already checked and were not edited. 7.1 through 7.6 are checked. `state.yaml` was not edited.

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness | Rollback boundary |
|------|----------------------------------------|-----------------|-------------------|
| 7 One trace id for logs, metrics, and traces | RED, before production changes: `pnpm exec vitest run --project api-cloud telemetry` — 1 file, 7 tests, 1 failed, 6 passed, exit 1. The new test expected 6 shared trace ids and received 0 while logs and metrics were not exported. GREEN, after the pipeline: the same command — 1 file, 7 tests passed, exit 0. `pnpm exec tsc -b apps/api-cloud --pretty false` — exit 0. | N/A: exporter doubles, no live collector. `GET /health` stays covered by the existing inject test in the same file (`server.listening` is false). | Revert `apps/api-cloud/src/composition/telemetry.ts`, `apps/api-cloud/src/composition/main.ts`, `apps/api-cloud/src/composition/worker.ts`, `apps/api-cloud/test/composition/telemetry.test.ts`, the OpenTelemetry pins in `apps/api-cloud/package.json`, and the matching `pnpm-lock.yaml` importer lines. |
| 8 Four alarms fire; environments compose Grafana | RED, before Terraform edits: `node tools/observability/evaluate-alarms.mjs` — exit 1 (`availability did not fire for silent 5 minutes`; `first_production_sentry_issue fired for a repeated production error`). `node tools/observability/check-catalog.mjs` — exit 1 (four alarms and `grafana_rule_group.blackhole` annotations had no action; `production-aws`, `production-azure`, `production-gcp`, `staging-aws`, `staging-azure`, and `staging-gcp` mount the collector without `module "grafana"`). GREEN, after actions, expressions, and the six modules: both commands — exit 0. | N/A: no terraform apply; Azure stays plan-only. No Grafana provider credentials. | Revert `tools/observability/evaluate-alarms.mjs`, `tools/observability/check-catalog.mjs`, alarm `action` and the availability and first-production expressions in `infra/modules/common/grafana/main.tf`, and `module "grafana"` in the six environment `main.tf` files. |
| 9 Sentry stores company, site, role, and release | RED, before the scope was stored: `pnpm exec vitest run --project api-cloud telemetry` — 1 file, 8 tests, 1 failed, 7 passed, exit 1. The new test expected `{ company: "company-1", site: "site-1", role: "cashier", release: "service.version" }` and received `[]`. GREEN, after the scope is stored: the same command — 1 file, 8 tests passed, exit 0. A format-only line wrap was applied and the same command was run again — 1 file, 8 tests passed, exit 0. | N/A: Sentry client double. No live Sentry project. | Revert the error-scope read, the Sentry tags, and the second `export` argument in `apps/api-cloud/src/composition/telemetry.ts`, and the company/site/role case in `apps/api-cloud/test/composition/telemetry.test.ts`. Leave the OTLP pipeline from unit 7 in place. |

Code diff for the trace slice, additions plus deletions, from `git diff --numstat` on those paths: 547. Code diff for the alarms slice: 778 additions and 10 deletions (606 in the new evaluator, 135/8 in `check-catalog.mjs`, 7/2 in the Grafana module, 5 additions in each of the six environments). `tasks.md` and this file are extra artifact lines.

## Task status

- [x] 1.1–1.2 Scrub and catalog. Already complete. Not edited.
- [x] 2.1–2.2 Rate gate and pending issuance. Already complete. Not edited.
- [x] 3.1–3.2 Simulator and worker. Already complete. Not edited.
- [x] 4.1 OTLP and Sentry wiring. Already complete. Not edited.
- [x] 5.1–5.3 Collector, Grafana, Sentry Terraform. Already complete. Not edited.
- [x] 6.1 Catalog check and Factus rate. Already complete. Not edited.
- [x] 7.1 Failing shared-trace test.
- [x] 7.2 OTLP logs, metrics, and traces, with the continued trace passed from `main.ts` and `worker.ts`.
- [x] 7.3 Failing alarm evaluator and catalog checks for a missing action and a collector stack without `module "grafana"`.
- [x] 7.4 Alarm actions, the first-production expression, `prometheus_datasource_uid`, and `module "grafana"` in the six environments.
- [x] 7.5 Failing Sentry scope test. Project `api-cloud` and release `service.version` alone do not satisfy it. The existing DSN test stayed.
- [x] 7.6 Company, site, and role are stored with project `api-cloud` and release `service.version`. Scrub runs before send. No browser Sentry.

## Deviations

- Each `startTelemetry` owns a `TracerProvider`, `LoggerProvider`, and `MeterProvider`. `NodeSDK` registers one global provider per process, so a second call in the test would not export the worker pipeline. `@opentelemetry/sdk-node` stays in `package.json` and is no longer imported.
- Processors need `@opentelemetry/sdk-logs`, `@opentelemetry/sdk-metrics`, and `@opentelemetry/sdk-trace` at `3.0.0`. pnpm does not allow importing those from the `sdk-node` tree. The task named only the two OTLP exporter pins; those SDK packages are direct dependencies for the same reason.
- Metric data points in this SDK have no exemplar field. `http.server.requests` carries `trace_id` as an attribute so the cloud and worker metrics share the trace id. It is not `venue_id`, and it is not a device, user, or order label.
- `main.ts` and `worker.ts` pass `continuedTraceFromEnv(env)`, which reads a W3C `TRACEPARENT`. The test continues the span the cloud export actually produced.
- The availability expression dropped a false `bool` result before `or`, so a healthy month that is silent for 5 minutes now fires. PromQL `or` keeps the left series when the labels match, including a zero. The invoice-age and rejection expressions were already correct and were not rewritten.
- The first-production series is `sentry_issues{environment="production", first_seen="true"}`. A repeated production error is the same metric with `first_seen="false"` and the same value, so a count comparison cannot tell them apart.
- Company, site, and role are read from the scrubbed export payload. The stored release is always `service.version` (`RELEASE_DIGEST`). The Sentry double receives that scope as the second argument of `export`. The real client sets those three tags inside `Sentry.withScope`, keeps project `api-cloud`, and keeps the init release `service.version`. `main.ts` and `worker.ts` were not edited. An OTLP exporter ignores the extra scope argument. The OTLP processors were not rewritten.

## Issues

Trace slice: none. Empty `OTEL_EXPORTER_OTLP_ENDPOINT`, a throwing exporter, and `GET /health` `{ "status": "ok" }` still pass in the same file. No browser SDK. `apps/local-node` was not edited.

Alarm slice: `module "grafana"` needs the Grafana provider. This slice does not add a token or provider credentials, and it does not run `terraform apply`. A later `terraform plan` in those environments will fail until that provider is configured outside this change. The datasource uid passed here is the non-secret literal `prometheus`.

Sentry slice: none. The existing DSN test and the shared-trace test still pass in the same file. A phone in the reported message is removed before the scope is read and before send. `contexts/invoicing`, `infra`, and `tools/observability` were not edited.

## Workload / PR boundary

- Mode: chained PR slice, feature-branch-chain
- Current work unit: 7
- This slice is PR 7 and is the base of the chain. Later slices target this branch.
- Boundary: tasks 7.1 and 7.2 only
- Files: `apps/api-cloud/src/composition/telemetry.ts`, `apps/api-cloud/src/composition/main.ts`, `apps/api-cloud/src/composition/worker.ts`, `apps/api-cloud/test/composition/telemetry.test.ts`, `apps/api-cloud/package.json`, `pnpm-lock.yaml`, `openspec/changes/p0-09-monitoring-and-errors/tasks.md`, `openspec/changes/p0-09-monitoring-and-errors/apply-progress.md`
- Review budget: about 547 changed lines in the code paths above, over the 400-line budget. Tasks 7.3–7.6 were not included.

### PR 8 boundary

- Mode: chained PR slice, feature-branch-chain
- Current work unit: 8
- This slice is PR 8. It targets the PR 7 branch. It does not target `main`.
- Boundary: tasks 7.3 and 7.4 only
- Files: `tools/observability/evaluate-alarms.mjs`, `tools/observability/check-catalog.mjs`, `infra/modules/common/grafana/main.tf`, `infra/environments/staging-aws/main.tf`, `infra/environments/staging-gcp/main.tf`, `infra/environments/staging-azure/main.tf`, `infra/environments/production-aws/main.tf`, `infra/environments/production-gcp/main.tf`, `infra/environments/production-azure/main.tf`, `openspec/changes/p0-09-monitoring-and-errors/tasks.md`, `openspec/changes/p0-09-monitoring-and-errors/apply-progress.md`
- Review budget: about 788 changed lines in the code paths (778 additions, 10 deletions), over the 400-line budget. The evaluator is most of that. Tasks 7.5 and 7.6 were not included. `apps/api-cloud` was not edited.

### PR 9 boundary

- Mode: chained PR slice, feature-branch-chain
- Current work unit: 9
- This slice is PR 9. It targets the PR 8 branch. It does not target `main`.
- Boundary: tasks 7.5 and 7.6 only
- Files: `apps/api-cloud/src/composition/telemetry.ts`, `apps/api-cloud/test/composition/telemetry.test.ts`, `openspec/changes/p0-09-monitoring-and-errors/tasks.md`, `openspec/changes/p0-09-monitoring-and-errors/apply-progress.md`
- Review budget: the Sentry scope and its test stay under the 400-line budget. `telemetry.ts` and `telemetry.test.ts` also hold the uncommitted trace slice from unit 7, so a diff of those files against `main` is larger than this unit.
