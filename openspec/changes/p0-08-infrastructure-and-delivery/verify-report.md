## Verification Report

**Change**: p0-08-infrastructure-and-delivery
**Version**: N/A
**Mode**: Standard
**Commit**: `208b30349b6c7b63f4db9898a2a84ba8e3b26df3` on `C:\Users\csar-\Proyectos\blackHole`
**Scope**: Re-verify after phase 5. This run is not a clean commit. The worktree is dirty above that commit (invoicing, monitoring, Grafana, and this phase 5). Nothing was reverted. No `terraform apply`. No credentials added. `pnpm test` was not run. `pnpm typecheck` was not run. `terraform validate` was skipped because it would download providers and the Grafana module files are dirty.

Deferred by design and excluded from the fail set: D-37 sync, SQLite, node image, staged node rollout (0.7), node secret file, simulated node, local HTTPS, offline alerts. Grafana, alarms, and Sentry content are 0.9. Azure apply is plan-only (D-39). The tasks file "Not placed" list is not a deferral unless `design.md` already records that scenario.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 32 |
| Tasks complete | 32 (1.1–5.3) |
| Tasks incomplete | 0 |

### Build & Tests Execution

**Build**: ➖ Not run (`pnpm typecheck` and `terraform validate` skipped; dirty tree, not a clean commit)

**Tests**: phase-5 commands only. Full `pnpm test` was not run.

**Coverage**: Not available / threshold: 0% → ➖ Not available

| Command | Exit | Result |
|---------|------|--------|
| `node tools/delivery/check-rehearsal-rollout.mjs` | 0 | `rehearsal restore and partial rollout hold` |
| `node tools/infra/compare-module-outputs.mjs` | 0 | `module outputs match` |
| `node tools/infra/compare-module-outputs.mjs --self-check` | 0 | Extra. Rejection path for a GCP module missing `api_hostname`, then the real modules still match |
| `node --permission --allow-fs-read=* tools/delivery/restore-dump.mjs --cloud gcp --dump C:\Users\csar-\Proyectos\blackHole\missing-encrypted-dump-p0-08.sql.enc` with `NODE_DEBUG=net,http,https,tls,dns` and no `--allow-net` | 1 | stderr: `encrypted dump is missing for gcp`. No net, http, https, tls, or dns debug lines. Node's permission model denies network without `--allow-net`; the process still exited on the missing dump |

### Phase 5 claims (this run)

| Claim | Result |
|-------|--------|
| `restore-dump.mjs` fails when the dump is missing and names the target cloud | Holds. Exit 1. Message names `gcp`. No network connection |
| `rehearsal.yml` calls the script instead of echoing | Holds. Restore step runs `node tools/delivery/restore-dump.mjs --cloud "${{ steps.target.outputs.cloud }}"`. The old echo is gone. Checker exit 0 |
| A failure alert names the step | Holds. `if: failure()` sets `failing` from the step outcome and prints `alert: failing step: ...`, including `Restore the encrypted dump`. Checker exit 0 |
| First production apply passes a partial rollout (50) | Holds. `delivery.yml` first production apply is `-var "rollout_percent=50"`. Checker exit 0 |
| Finish apply completes only when signals are not worsened | Holds in the workflow gate: `if: steps.signals.outputs.worsened != 'true'` and `-var "rollout_percent=100"`. Checker exit 0. See warning: a failed signal step leaves that output unset |
| Rollback uses the previous digest and no migration | Holds. Rollback is `git_ref=${{ steps.previous.outputs.digest }}` and the step command is `terraform apply` only. Checker exit 0 |

The present-dump path of `restore-dump.mjs` only prints `restore encrypted dump into <cloud>` and exits 0. It does not load the dump. That is not a real restore.

### Spec Compliance Matrix

A scenario is compliant only when a covering test or command passed in this run. Static reading is not compliance. The previous verify report and the apply note are not evidence. Deferred rows are excluded from the fail set.

| Requirement | Scenario | Evidence from this run | Result |
|-------------|----------|------------------------|--------|
| Equivalent Cloud Modules | Staging from scratch | No apply and no smoke. Azure apply is D-39 and is not a pass of "all three come up". AWS and GCP staging were not brought up | ❌ UNTESTED |
| Equivalent Cloud Modules | Mismatched outputs | `compare-module-outputs.mjs` exit 0 and `--self-check` exit 0 | ✅ COMPLIANT |
| Provider Ports | Switch storage provider | Platform adapter tests were not run | ❌ UNTESTED |
| Provider Ports | Node secrets | Design defers the node secret file (D-37) | DEFERRED |
| Portable PostgreSQL | New extension | `check-postgres-extensions.mjs` was not run | ❌ UNTESTED |
| Portable PostgreSQL | Public access | No command showed a refused internet connection | ❌ UNTESTED |
| Environments and Changes | Manual change | `drift.yml` was not executed | ❌ UNTESTED |
| Environments and Changes | Local apply | No command showed a workstation production apply failing | ❌ UNTESTED |
| Autoscaling with Limits | Queue burst | `worker.test.ts` was not run. No scale-up or scale-down | ❌ UNTESTED |
| Autoscaling with Limits | Runaway scaling | No test asserts the maximum instance count | ❌ UNTESTED |
| Cloud Availability | One instance lost | No test showed a surviving instance or a replacement | ❌ UNTESTED |
| Cloud Availability | Gradual rollout | Checker exit 0 keeps AWS `desired_count` at `local.min_instances` and the first apply passes `rollout_percent=50`. No request was answered | ⚠️ PARTIAL |
| Cross-Cloud Backup | Restore in another cloud | Missing dump exits 1 and names `gcp` with no network. No dump was loaded and smoke was not run | ❌ UNTESTED |
| Cross-Cloud Backup | Missed export | `backup-check.yml` was not executed | ❌ UNTESTED |
| Automatic Path to Staging | Green change | Staging was not deployed and smoke was not run | ❌ UNTESTED |
| Automatic Path to Staging | Failing check | No command showed a failed check skipping publish | ❌ UNTESTED |
| Build Once, Promote | Promotion | No command showed the same digest deployed to production | ❌ UNTESTED |
| Build Once, Promote | Critical vulnerability | The image scan was not run | ❌ UNTESTED |
| Gradual Production with Automatic Rollback | Injected error | Checker proves rollback uses `steps.previous.outputs.digest` and does not run a migration. No error was injected and the previous image was not restored. `compare-signals.mjs` was not run | ⚠️ PARTIAL |
| Gradual Production with Automatic Rollback | Healthy release | Checker proves the finish apply is `rollout_percent=100` only when `worsened != 'true'`. No command showed every instance on the new digest | ⚠️ PARTIAL |
| Forward-Only Two-Step Migrations | Column rename | `check-forward-migrations.mjs` was not run | ❌ UNTESTED |
| Forward-Only Two-Step Migrations | Rollback after migration | Checker proves the rollback step does not run a migration. The previous image was not shown serving on a migrated schema | ⚠️ PARTIAL |
| Compatibility with Older Nodes | Previous node | Design defers sync (D-37) | DEFERRED |
| Compatibility with Older Nodes | Two versions behind | Design defers sync (D-37) | DEFERRED |
| Monthly Cloud-Switch Rehearsal | Rehearsal passes | Rehearsal was not run. The job selects one of AWS or GCP. That is D-39, not a pass of "both clouds" | ❌ UNTESTED |
| Monthly Cloud-Switch Rehearsal | Rehearsal fails | `check-rehearsal-rollout.mjs` exit 0. The failure step names the failing step, including `Restore the encrypted dump` | ✅ COMPLIANT |

**Compliance summary**: 2/23 in-scope scenarios compliant, 4 partial, 17 untested this run. 3 scenarios deferred and excluded (node secrets, previous node, two versions behind).

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Missing dump | ✅ Matches the phase-5 claim | Exit 1, names `gcp`, no network. Success path only logs |
| Rehearsal wiring | ✅ Matches the phase-5 claim | Script call, one of AWS or GCP, failure alert names the step, destroy uses `if: always()` |
| Partial production rollout | ✅ Matches the phase-5 claim | First production apply passes `rollout_percent=50`. Finish passes `100` only when signals are not worsened. Rollback passes `steps.previous.outputs.digest` and does not migrate. `rollout_percent` is on the AWS, GCP, and Azure service modules. No Azure apply |
| Module output parity | ✅ Checker passed | Default run and `--self-check` exit 0 |
| Live staging, drift, smoke, restore, lost instance, refused connection | ❌ Not executed | Spec still requires them. Design does not defer these executions |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cloud MVP, adapters behind ports (D-37, ADR-018) | ✅ Not re-tested | This run did not re-execute adapter tests |
| Azure plan-only (D-39) | ✅ Yes | Rehearsal and delivery stay on AWS or GCP. Azure apply was not run |
| Rehearsal on one of AWS or GCP (D-39) | ⚠️ Deviation | Design follows D-39. The spec scenario "Rehearsal passes" still says both clouds. One cloud is not a pass |
| No down migration; previous digest only | ✅ Yes for the workflow contract | Rollback command has no migration. Not executed live |
| Grafana / Sentry content is 0.9 | ✅ Recorded | Drift execution is still required by the spec and was not run. Alarm content stays 0.9 |
| Smoke is `GET /health` plus one `AcceptCloudWrite` | ➖ Not run | `smoke.mjs` was not invoked |
| Apply from a laptop rejected | ➖ Not run | Bootstrap remains `workflow_dispatch` in source. This run did not attempt an apply |
| Monthly rehearsal restores, smokes, and destroys | ❌ Live path not run | The workflow calls the script, then smoke, then destroy. The script does not load a dump. One cloud, not both |

### Issues Found

**CRITICAL**:

- Staging from scratch was not applied and did not pass smoke. Azure apply is a recorded D-39 deferral and does not make this scenario compliant. AWS and GCP were not brought up either.
- A refused internet connection to the database was not shown.
- Drift was not executed.
- A lost production instance was not shown.
- Live smoke was not run (green path to staging, and smoke after restore).
- A real cross-cloud restore was not run. The present-dump path only logs a line and exits 0, so this run also has no local restore.
- These spec scenarios also have no covering command in this run: local production apply, runaway scaling, missed backup export, a failed check that publishes nothing, same-digest promotion, and the critical-vulnerability gate.
- Rehearsal pass is untested. "Both clouds" versus one of AWS or GCP is a D-39 design deviation, not a pass.

**WARNING**:

- Switch-storage, extension allowlist, queue-depth worker tests, and the forward-migration check were not re-executed. They are not compliant in this run. This report does not call them regressions.
- Gradual rollout, injected error, healthy release, and rollback-after-migration are only partly covered by `check-rehearsal-rollout.mjs`.
- GCP signal collection reads `distributionValue.mean`, not p95. AWS reads `TargetResponseTime` p95. The spec and design require p95.
- The finish step's `if` replaces the default success check. If the signal step fails before it writes `worsened=true`, `worsened != 'true'` is still true, so the finish apply can complete the shift without a successful comparison. `compare-signals.mjs` treats a non-finite sample as worsened, but that script was not what ran when the shell fails first.
- The spec asks for both non-production clouds in one rehearsal. Design D-39 and `rehearsal.yml` run one of AWS or GCP.

**SUGGESTION**:

- None.

### Verdict

FAIL

Phase 5 structural claims hold: the missing dump exits 1, names `gcp`, and opens no network; rehearsal calls the script; the failure alert names the step; the first production apply passes `rollout_percent=50`; the finish apply is gated on signals that are not worsened; rollback uses the previous digest and does not migrate. Archive is not allowed. Live spec scenarios were not executed, and a one-cloud rehearsal is not a pass of "both clouds". This run is not a clean commit.
