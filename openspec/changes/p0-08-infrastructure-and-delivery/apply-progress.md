# Apply progress: p0-08-infrastructure-and-delivery

Mode: Standard. `strict_tdd` is false. ADR-017 still wrote the TypeScript tests before the production files for ports, adapters, health, and the worker.

Workload: size:exception. The forecast asked for a feature-branch chain and a decision before apply. The orchestrator assigned phases 1 through 4 in this worktree and forbade commits and pushes. No pull request was opened.

28 of 29 tasks passed their local check. Task 3.5 stays open because `terraform` is not on PATH. `status` and `apply` stay `partial`. `verify` and `archive` stay pending.

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness | Rollback boundary |
|------|----------------------------------------|-----------------|-------------------|
| 1 Ports, health, worker | `pnpm vitest run --project platform` — 29 files, 99 tests, exit 0. `pnpm vitest run --project api-cloud` — 8 files, 29 tests, exit 0. `pnpm vitest run --project skeleton` — 1 file, 9 tests, exit 0. `pnpm architecture` — no dependency violations (172 modules, 347 dependencies), exit 0. dependency-cruiser printed its known TypeScript 7 transpiler warning. | `GET /health` exercised with Nest `inject`. The test asserts `server.listening` is false. No cloud process was started. | Revert `contexts/platform` ports and adapters, `apps/api-cloud` health, worker, main, module, tests, and `package.json`, plus `pnpm-lock.yaml` and the skeleton list. |
| 2 Image and Compose | `docker compose config --services` printed `postgres`, `api`, `worker`. Skeleton compose assertion passed in the same skeleton run. | The image was not booted. The Docker daemon was not required for `compose config`. | Revert `apps/api-cloud/Dockerfile`, `docker-compose.yml`, and `infra/environments/local/.env.example`. |
| 3 Terraform | `node tools/infra/compare-module-outputs.mjs` — `module outputs match`. `node tools/infra/check-postgres-extensions.mjs` — `postgres extensions are pgcrypto and pg_trgm`. `node tools/infra/check-forward-migrations.mjs` — `migrations stay forward-only and keep 0001 and 0002`. Each script also passed `--self-check` on an earlier run. | `terraform fmt` and `terraform validate` were not run. `terraform` is missing. No `terraform apply`. | Revert `infra/`. |
| 4 Pipeline | The three `tools/infra` scripts above, exit 0. `node tools/delivery/compare-signals.mjs --self-check` — `5xx ratio and p95 comparison holds`. Direct calls returned `worsened=true` for a higher error ratio, `worsened=false` for equal samples, and `worsened=true` for a non-numeric sample. | Workflows were not executed. `tools/delivery/smoke.mjs` was not run; it requires `SMOKE_BASE_URL`. | Revert `.github/workflows/` and `tools/delivery/`. |

## Task status

- [x] 1.1–1.9 Platform ports, memory doubles, cloud adapters, health, worker, main, bootstrap, skeleton.
- [x] 2.1–2.4 Dockerfile, Compose, local env, three services.
- [x] 3.1–3.4 Modules, DNS, six environments, bootstrap. Azure environments set `plan_only`.
- [ ] 3.5 Fmt and validate. Blocked: `terraform` binary missing. No apply was run, and no fmt/validate pass is claimed.
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

Terraform fmt/validate cannot be completed in this environment until the binary is installed. Docker Compose config succeeded without booting the daemon.
