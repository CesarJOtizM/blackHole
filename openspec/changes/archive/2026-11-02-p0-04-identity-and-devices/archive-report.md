# Archive Report

**Change**: p0-04-identity-and-devices
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-02
**Archived to**: `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/`
**Verification verdict**: PARTIAL
**CRITICAL**: None
**strict_tdd**: false
**Engram review receipt**: none. `verify-report.md` is the review receipt.

## Gate

Intentional archive with warnings. The orchestrator instructed this phase to archive `p0-04-identity-and-devices` and not to treat the recorded warnings as blockers. `verify-report.md` records `verdict: partial`, `blockers: 0`, `critical_findings: 0`, and `CRITICAL: None`. Requirements 9/12 and scenarios 15/25. The three incomplete requirements are PIN Attempt Limit, User Deactivation, and Immediate Revocation. Seven scenarios are deferred by D-37 or the design hybrid/phone deferral. Three scenarios are partial warnings. No scenario is a CRITICAL failure.

`tasks.md` has 20/20 implementation tasks checked. `apply-progress.md` records the same 20 tasks complete. `state.yaml` had `status: applied`, `apply: done`, `verify: partial`, and `archive: pending` before this phase. This phase set `archive: done` in that file before the move, as instructed. `status` stays `applied` and `verify` stays `partial`.

No CRITICAL finding and no unchecked implementation task blocked this archive. This phase did not re-run tests, did not commit, did not edit product source, and did not edit another change.

## Review Receipt

There is no Engram review receipt. Engram searches for `sdd/p0-04-identity-and-devices/proposal`, `sdd/p0-04-identity-and-devices/spec`, `sdd/p0-04-identity-and-devices/design`, `sdd/p0-04-identity-and-devices/tasks`, and `sdd/p0-04-identity-and-devices/verify-report` in project `blackhole` returned no memories. Observation IDs for those artifacts are none.

The filesystem `verify-report.md` is the review receipt. Evidence in that existing report, not a new run:

- `pnpm typecheck` exited 0 (`build_exit_code: 0`).
- Tests passed (`test_exit_code: 0`): 567 passed, 0 failed, 0 skipped (34 files) via `pnpm exec vitest run --project platform --project api-cloud --project local-node --project skeleton`.
- The report states the first typecheck exited 2 and that the type errors were fixed before the passing typecheck. This archive does not claim a new test or typecheck run.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/proposal.md` | none (openspec; Engram search returned no memory) |
| spec identity | `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/specs/identity/spec.md` | none (openspec; Engram search returned no memory) |
| spec device-registry | `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/specs/device-registry/spec.md` | none (openspec; Engram search returned no memory) |
| design | `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/design.md` | none (openspec; Engram search returned no memory) |
| tasks | `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/tasks.md` | none (openspec; Engram search returned no memory) |
| apply-progress | `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/apply-progress.md` | none (openspec) |
| verify-report (review receipt) | `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/verify-report.md` | none (openspec; no Engram review receipt) |
| archive-report | `openspec/changes/archive/2026-11-02-p0-04-identity-and-devices/archive-report.md` | 1161 (`obs-977b523c147ba0fd`) |

## Task Completion Gate

`tasks.md` has 20/20 implementation tasks checked: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 7.5. No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. `apply-progress.md` proves the same 20 tasks complete. The test suite was not run in this phase.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks. They still name an unregistered phone that cannot print, offline revocation in under 5 seconds, and a Playwright journey. Hybrid sync, printing, and the phone app stay deferred.

## Spec Reconciliation

Both delta specs are full specs (`Purpose` and `Requirements`). Neither contains `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/identity/spec.md` and `openspec/specs/device-registry/spec.md` did not exist, so each delta was copied unchanged before the folder move.

`openspec/config.yaml` `rules.archive` says "Warn before merging destructive deltas". That rule was checked and did not fire. There is no removal, rename, or replacement of an existing main-spec requirement. No prior requirement was deleted. Other domains were not touched.

SHA-256 at sync time:

| Domain | Hash |
|--------|------|
| identity | `75E6FA9A40936C0DB86649695E24012E9019FF6B4329A969EF4954D57C4E4088` |
| device-registry | `FE96D25E3B8BEC96748316579691E09A9AADE668C27F078389160D1FDCADFDDB` |

The change-folder copy and the main-spec copy of each file hashed equal.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| identity | Created | Full spec copied unchanged. 5 requirements, 11 scenarios. 0 modified, 0 removed, 0 renamed. |
| device-registry | Created | Full spec copied unchanged. 7 requirements, 14 scenarios. 0 modified, 0 removed, 0 renamed. |

Source of truth:

- `openspec/specs/identity/spec.md`
- `openspec/specs/device-registry/spec.md`

Identity requirements: Administration Session, Personal PIN Session, Quick Switch and Inactivity Lock, PIN Attempt Limit, User Deactivation.

Device-registry requirements: Single-Use Registration Code, Signed Requests, Unregistered Devices Get Nothing, On-Premises Presence, No Business Data on Phones, Fixed Station Device, Immediate Revocation.

## Residual Warnings (not blocking)

Accepted by the orchestrator as an intentional archive. These stay warnings. They are not CRITICAL and this archive does not treat them as resolved. Product source was not changed.

1. Lock after failures sets `pinAttemptsLocked` and keeps refusing PINs, including a later valid PIN. There is no expiry and no separate administrator alert. `apps/admin-web` is deferred. The verify report classifies this as a WARNING, not a CRITICAL. The public snapshot is the only admin-visible signal.
2. Hybrid sync, offline PIN success, shared Wi-Fi, port scan, phone storage, and print-after-revoke stay deferred under D-37 and printing 1.6. The verify report lists those rows as DEFERRED or partial only for the deferred half (offline upload, print job). They are not failures of this change.
3. Evidence is the existing verify report. `pnpm typecheck` exited 0 and the recorded test command passed (567/567, exit 0). This phase did not run tests again.

Other warnings left in the verify report and not treated as blockers: deactivate-on-offline-node is partial only for "reaches the cloud on reconnect"; the design sentence "A refusal does not save" is broader than save-then-rethrow for a changed snapshot; cloud bridge refusal is the `siteOffline` flag; identity HTTP tests always send `x-session-id`; `pnpm lint` exit 1 is recorded CRLF noise plus p0-05 diagnostics and is not a failure of this change.

## SDD Cycle

The change was planned, implemented, verified (PARTIAL, zero CRITICAL, intentional warnings), copied unchanged into the main specs, and archived. Active `openspec/changes/` no longer contains `p0-04-identity-and-devices`. `state.yaml` in the archive has `archive: done`.
