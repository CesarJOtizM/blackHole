# Tasks: Infrastructure and continuous delivery

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2800–4200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

TypeScript: RED then GREEN. No local-node, sync, node image, Grafana, or Sentry content. Cloudflare DNS only. PWAs use `static_bucket`.

### Suggested Work Units

| Unit | Goal | PR | Base | Verify |
|------|------|----|------|--------|
| 1 | Ports, adapters, health, worker | 1 | tracker branch | platform, api-cloud, skeleton |
| 2 | Image and Compose | 2 | PR 1 branch | `docker compose config` |
| 3 | Terraform. Azure plan-only | 3 | PR 2 branch | fmt and validate |
| 4 | Workflows and smoke | 4 | PR 3 branch | `node tools/infra/*.mjs` |

Unit 1 waits for `p0-04-identity-and-devices`. It alone edits `contexts/platform/package.json`, `create-application.ts`, `application-module.ts`.

## Phase 1: Platform and api-cloud (PR 1)

- [ ] 1.1 RED `file-storage`, `secrets`, `runtime-metrics` contracts: signed URL, `read`, `publishQueue`.
- [ ] 1.2 GREEN classes and memory doubles. Not on `entry-port.ts`. Export from `contexts/platform/package.json`.
- [ ] 1.3 RED stub-client tests: disk, s3, gcs, blob, `secrets-*`, `metrics-*`.
- [ ] 1.4 GREEN those adapters. Client via constructor. `#adapters/<folder>/*`.
- [ ] 1.5 RED `health.controller.test.ts`: `GET /health` `{ "status": "ok" }`, no listen.
- [ ] 1.6 GREEN `health.controller.ts`, `application-module.ts`, `create-application.ts`.
- [ ] 1.7 RED `worker.test.ts`: depth and age. No handlers.
- [ ] 1.8 GREEN `worker.ts` (pg-boss) and `main.ts`. Add `pg-boss`. Env `FILE_STORAGE_ADAPTER`, `SECRETS_ADAPTER`, `METRICS_ADAPTER`, `PORT`, `DATABASE_URL`.
- [ ] 1.9 `bootstrap.test.ts` allows `/health`. Skeleton removes `infra` from `absent`.

## Phase 2: Image and Compose (PR 2)

- [ ] 2.1 `apps/api-cloud/Dockerfile`: Node 24, repo root, `main.ts`, `worker.ts`.
- [ ] 2.2 `docker-compose.yml`: Postgres, API, worker. No node.
- [ ] 2.3 `infra/environments/local/.env.example`: disk, file, log, `PORT`, `DATABASE_URL`.
- [ ] 2.4 Compose config lists only those three services.

## Phase 3: Terraform (PR 3)

- [ ] 3.1 Same contract in `infra/modules/{aws,gcp,azure}/{network,postgres,service,storage,secrets,registry}`. Private Postgres 16. Outputs: `api_hostname`, `registry_url`, `storage_bucket`, `static_bucket`, `secrets_prefix`, `postgres_endpoint`, `backup_bucket`. API min 2. Workers min 1, maxed, queue-scaled. `pgcrypto`, `pg_trgm`.
- [ ] 3.2 `infra/modules/common/dns`: Cloudflare records. No Pages.
- [ ] 3.3 `infra/environments/{staging,production}-{aws,gcp,azure}`: separate accounts, remote state, lock, git `ref`. Azure plan-only.
- [ ] 3.4 `infra/bootstrap/{aws,gcp,azure}`: state, lock, OIDC. No keys.
- [ ] 3.5 Fmt and validate. No apply. Needs 1.9.

## Phase 4: Pipeline (PR 4)

- [ ] 4.1 `compare-module-outputs.mjs` rejects a missing output.
- [ ] 4.2 `check-postgres-extensions.mjs`: `pgcrypto` and `pg_trgm` only.
- [ ] 4.3 `check-forward-migrations.mjs` rejects `DROP` and `RENAME`. Keep `0001` and `0002`.
- [ ] 4.4 `tools/delivery/smoke.mjs`: `/health` and one `AcceptCloudWrite`.
- [ ] 4.5 `ci.yml` plans AWS, GCP, and Azure. A failed check publishes nothing.
- [ ] 4.6 `delivery.yml`: one digest, scan gate, Sentry token, `static_bucket`, approval, partial rollout, previous digest if 5xx or p95 worsens, no DB change. No Azure apply.
- [ ] 4.7 `drift.yml` fails on a non-empty plan.
- [ ] 4.8 `backup-check.yml`: encrypted dump to the other of AWS or GCP. Fail if missing.
- [ ] 4.9 `rehearsal.yml`: apply, restore, smoke, destroy non-production AWS or GCP.
- [ ] 4.10 `bootstrap.yml`: `workflow_dispatch` only.
- [ ] 4.11 Run the three `tools/infra` scripts.

## Not placed

Node secrets. Previous-node sync. Two versions behind. Azure apply, backup, rehearsal.
