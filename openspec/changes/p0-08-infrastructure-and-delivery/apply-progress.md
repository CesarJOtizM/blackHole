# Apply progress: p0-08-infrastructure-and-delivery

Mode: Standard. `strict_tdd` is false. ADR-017 still wrote the TypeScript tests before the production files for ports, adapters, health, and the worker.

Workload: size:exception. The forecast asked for a feature-branch chain and a decision before apply. The orchestrator assigned phases 1 through 4 in this worktree and forbade commits and pushes. No pull request was opened.

29 of 29 tasks passed their local check. Task 3.5 fmt and validate passed on Terraform v1.16.6. No `terraform apply`, `terraform destroy`, or Azure apply was run. `verify` and `archive` stay pending. `state.yaml` was not edited; the orchestrator owns `status`, `apply`, `verify`, and `archive`.

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness | Rollback boundary |
|------|----------------------------------------|-----------------|-------------------|
| 1 Ports, health, worker | `pnpm vitest run --project platform` — 29 files, 99 tests, exit 0. `pnpm vitest run --project api-cloud` — 8 files, 29 tests, exit 0. `pnpm vitest run --project skeleton` — 1 file, 9 tests, exit 0. `pnpm architecture` — no dependency violations (172 modules, 347 dependencies), exit 0. dependency-cruiser printed its known TypeScript 7 transpiler warning. | `GET /health` exercised with Nest `inject`. The test asserts `server.listening` is false. No cloud process was started. | Revert `contexts/platform` ports and adapters, `apps/api-cloud` health, worker, main, module, tests, and `package.json`, plus `pnpm-lock.yaml` and the skeleton list. |
| 2 Image and Compose | `docker compose config --services` printed `postgres`, `api`, `worker`. Skeleton compose assertion passed in the same skeleton run. | The image was not booted. The Docker daemon was not required for `compose config`. | Revert `apps/api-cloud/Dockerfile`, `docker-compose.yml`, and `infra/environments/local/.env.example`. |
| 3 Terraform | `node tools/infra/compare-module-outputs.mjs` — `module outputs match`. `node tools/infra/check-postgres-extensions.mjs` — `postgres extensions are pgcrypto and pg_trgm`. `node tools/infra/check-forward-migrations.mjs` — `migrations stay forward-only and keep 0001 and 0002`. Each script also passed `--self-check` on an earlier run. Task 3.5: `terraform fmt -check -recursive -diff` on `infra/modules`, `infra/environments`, and `infra/bootstrap` — each exit 0, no diffs. Then `terraform init -backend=false -input=false -no-color` and `terraform validate -no-color` in each configuration directory listed below — each init exit 0 and validate exit 0. | N/A for a cloud runtime. `terraform validate` is local. `terraform init -backend=false` did not configure remote state. No `terraform apply`. | This batch changed no `.tf` files. Rollback is `tasks.md` and `apply-progress.md`. Earlier module work still rolls back with `infra/`. |
| 4 Pipeline | The three `tools/infra` scripts above, exit 0. `node tools/delivery/compare-signals.mjs --self-check` — `5xx ratio and p95 comparison holds`. Direct calls returned `worsened=true` for a higher error ratio, `worsened=false` for equal samples, and `worsened=true` for a non-numeric sample. | Workflows were not executed. `tools/delivery/smoke.mjs` was not run; it requires `SMOKE_BASE_URL`. | Revert `.github/workflows/` and `tools/delivery/`. |

## Task status

- [x] 1.1–1.9 Platform ports, memory doubles, cloud adapters, health, worker, main, bootstrap, skeleton.
- [x] 2.1–2.4 Dockerfile, Compose, local env, three services.
- [x] 3.1–3.4 Modules, DNS, six environments, bootstrap. Azure environments set `plan_only`.
- [x] 3.5 Fmt and validate. Terraform v1.16.6. Fmt check exit 0 on three trees. Init and validate exit 0 on 31 configuration directories. No apply.
- [x] 4.1–4.11 Infra scripts, smoke script, CI plan, delivery, drift, backup check, rehearsal, bootstrap dispatch.

## Deviations

- `startApi` keeps the domain repositories in memory. Existing Drizzle repositories take PGlite, not a Postgres wire URL. `DATABASE_URL` is required and is used by pg-boss in the worker.
- Cloud storage, secrets, and metrics adapters take a client and fail closed until one is injected. This batch does not add provider SDK packages. Disk storage, the JSON secrets file, and log metrics are real.
- The image command is `node --experimental-strip-types` on `main.ts` and `worker.ts`. Package imports use `.js` specifiers. The image was not booted, so runtime resolution of those specifiers is unproven.
- `create-application.ts` was not changed. It already calls `init()` and does not listen. `NodePublicKeyVerifier` was added to the platform package exports so the composition root can import that existing adapter.
- Delivery compares load-balancer samples in `compare-signals.mjs`. A missing or non-numeric sample sets `worsened=true`, and the next step reapplies the previous digest with no migration command. AWS reads `TargetResponseTime` p95. The GCP query reads the latency distribution mean. The first and last production applies pass the same digest; there is no traffic-weight variable.
- `backup-check.yml` fails when the object is missing. It does not write the encrypted dump.
- `rehearsal.yml` apply, smoke, and destroy are real commands. The restore step is a placeholder because Postgres is private and the password is not an output.
- Staging and production job names say migrate. The steps run `terraform apply` only.
- Rehearsal and backup select the other of AWS or GCP. They do not apply Azure.
- `compare-module-outputs.mjs` also requires the same variable names across the three clouds.
- `pnpm typecheck` still fails in `operate-identity.test.ts` and `shared/contracts` on this base. Those errors were not introduced here and were not edited.

## Issues

None for task 3.5. Docker Compose config succeeded without booting the daemon.

## Task 3.5 commands

Terraform v1.16.6 (`terraform version`, exit 0). No files were formatted.

| Command | Exit |
|---------|------|
| `terraform fmt -check -recursive -diff infra/modules` | 0 |
| `terraform fmt -check -recursive -diff infra/environments` | 0 |
| `terraform fmt -check -recursive -diff infra/bootstrap` | 0 |

`terraform fmt -recursive` was not run. The check found nothing to change.

Each directory below ran `terraform init -backend=false -input=false -no-color` and then `terraform validate -no-color`. Both commands exited 0 in every directory:

- `infra/bootstrap/aws`
- `infra/bootstrap/azure`
- `infra/bootstrap/gcp`
- `infra/environments/production-aws`
- `infra/environments/production-azure`
- `infra/environments/production-gcp`
- `infra/environments/staging-aws`
- `infra/environments/staging-azure`
- `infra/environments/staging-gcp`
- `infra/modules/aws/network`
- `infra/modules/aws/postgres`
- `infra/modules/aws/registry`
- `infra/modules/aws/secrets`
- `infra/modules/aws/service`
- `infra/modules/aws/storage`
- `infra/modules/azure/network`
- `infra/modules/azure/postgres`
- `infra/modules/azure/registry`
- `infra/modules/azure/secrets`
- `infra/modules/azure/service`
- `infra/modules/azure/storage`
- `infra/modules/common/collector`
- `infra/modules/common/dns`
- `infra/modules/common/grafana`
- `infra/modules/common/sentry`
- `infra/modules/gcp/network`
- `infra/modules/gcp/postgres`
- `infra/modules/gcp/registry`
- `infra/modules/gcp/secrets`
- `infra/modules/gcp/service`
- `infra/modules/gcp/storage`

Init wrote `.terraform/` and `.terraform.lock.hcl` under those directories. Those local artifacts were deleted after validate. They are not part of the change. `infra/environments/local` has no Terraform configuration.

## Phase 5 correction

Mode stays Standard. `strict_tdd` is false. ADR-017 still wrote the failing check before the fix. This slice was not committed. `size:exception` was not granted. The RED/GREEN pair was not split.

Workload: feature-branch-chain, next slice after the pipeline unit. Changed lines in this slice, additions plus deletions, excluding the pre-existing grafana hunks: **458** (441 additions, 17 deletions). Tasks 1.1–4.11 stay complete. Tasks 5.1–5.3 are complete. `state.yaml` keeps `apply: done` and `verify: partial`. No `terraform apply`, no deploy, no cloud credentials. Grafana module and the uncommitted grafana blocks in the six environment files were not edited.

### Commands

| Command | Exit |
|---------|------|
| RED `node tools/delivery/check-rehearsal-rollout.mjs` | 1 |
| GREEN `node tools/delivery/check-rehearsal-rollout.mjs` | 0 (`rehearsal restore and partial rollout hold`) |
| `node tools/infra/compare-module-outputs.mjs` | 0 (`module outputs match`) |
| `pnpm exec biome check tools/delivery/check-rehearsal-rollout.mjs tools/delivery/restore-dump.mjs` | 0 |
| `terraform fmt` on the edited service modules and `production-aws` / `production-gcp` | 0, no diff |

`pnpm test` was not run. Terraform validate and apply were not run.

### What changed

- `tools/delivery/restore-dump.mjs` reads a local dump path. A missing dump exits 1 and names `aws` or `gcp`. It does not open a network connection and does not call terraform.
- `rehearsal.yml` calls that script with the one selected cloud. On failure, the alert step prints `failing step:` plus the failed step name (`steps.restore.outcome` and the other step outcomes). Rehearsal still selects one of AWS or GCP.
- The first production apply passes `rollout_percent=50` with the new digest. The finish apply passes `rollout_percent=100` only when `steps.signals.outputs.worsened != 'true'`. Rollback still applies `steps.previous.outputs.digest` and does not run a migration.
- `rollout_percent` is on the aws, gcp, and azure service modules (default 100). Production AWS and GCP pass it through. Below 100, AWS keeps `desired_count` at the API minimum on the active revision and starts the new digest on only that share. GCP sends that percent to the latest revision and holds the rest on the active revision. Azure accepts the variable as the traffic weight. No Azure apply.

### Deviations

- The spec sentence "both clouds" remains a design deviation (D-39). This slice does not widen rehearsal to AWS and GCP together, and it does not add an Azure apply.
- A partial AWS or GCP apply reads the active revision. An empty production stack has no revision yet, so the first partial apply assumes the previous digest is already running.
- Azure `traffic_weight` uses `rollout_percent` and does not add a second revision weight. A value below 100 would not sum to 100. Delivery does not apply Azure.
- This pair is 458 changed lines. The 400-line budget is exceeded. It was not split, because the orchestrator forbade splitting this RED/GREEN pair and did not grant `size:exception`.

### Task status

- [x] 1.1–1.9 Platform ports, memory doubles, cloud adapters, health, worker, main, bootstrap, skeleton.
- [x] 2.1–2.4 Dockerfile, Compose, local env, three services.
- [x] 3.1–3.4 Modules, DNS, six environments, bootstrap. Azure environments set `plan_only`.
- [x] 3.5 Fmt and validate. Terraform v1.16.6. Fmt check exit 0 on three trees. Init and validate exit 0 on 31 configuration directories. No apply.
- [x] 4.1–4.11 Infra scripts, smoke script, CI plan, delivery, drift, backup check, rehearsal, bootstrap dispatch.
- [x] 5.1 RED check. Exit 1 while restore echoed and both production applies passed only `git_ref`.
- [x] 5.2 GREEN restore script and rehearsal alert. No terraform.
- [x] 5.3 GREEN partial production apply and `rollout_percent` on aws, gcp, and azure. No Azure apply. No grafana edits.
