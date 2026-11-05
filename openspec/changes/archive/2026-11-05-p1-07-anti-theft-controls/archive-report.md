# Archive Report

**Change**: p1-07-anti-theft-controls
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-05
**Archived to**: `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false
**Published specs**: `openspec/specs/authorization/spec.md`, `openspec/specs/sensitive-actions/spec.md`
**Checkout at archive**: `master` `27e730779e56470a5fa0566492d7c4d8e4c3c98d` (same SHA recorded by `verify-report.md`)

## Gate

Persistence mode is openspec (`openspec/config.yaml`). Filesystem artifacts were read from `openspec/changes/p1-07-anti-theft-controls/`. Engram was searched for `sdd/p1-07-anti-theft-controls/proposal`, `sdd/p1-07-anti-theft-controls/spec`, `sdd/p1-07-anti-theft-controls/design`, `sdd/p1-07-anti-theft-controls/tasks`, and `sdd/p1-07-anti-theft-controls/verify-report` in projects `blackhole` and `cli`. Review topics `sdd/p1-07-anti-theft-controls/review/{transaction,ledger,receipt,gate-context}` were searched in `blackhole` and were not found. There is no `openspec/changes/p1-07-anti-theft-controls/reviews/` directory.

`verify-report.md` is the receipt (`schema: gentle-ai.verify-result/v1`). Recorded values match the orchestrator gate: `verdict: pass_with_warnings`, `test_exit_code: 0`, `build_exit_code: 0`, `blockers: 0`, `critical_findings: 0`, `archive_allowed: true`. Requirements 11/11. Scenarios 20/22. The two missing scenarios are "Hybrid offline PIN" and "Offline action". Both are **DEFERRED** under D-37. They are not COMPLIANT and they are not PASS.

This repository has no native review receipt. The 2026-10-30, 2026-11-03, and 2026-11-05 archives used `verify-report.md` as the gate. This archive does the same. No transaction, ledger, or receipt file was required. That absence is not a blocker. The orchestrator instructed archive after that verify file matched the gate above.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The authorization delta has only `ADDED Requirements`. It has no `MODIFIED`, `REMOVED`, or `RENAMED` sections. Existing requirements in `openspec/specs/authorization/spec.md` were preserved. The sensitive-actions file is a full specification with no delta sections. `openspec/specs/sensitive-actions/spec.md` did not exist. The copy creates that source of truth and deletes nothing from a prior main spec. Neither merge is destructive. No extra confirmation was required.

This phase did not edit product source, did not commit, did not push, and did not archive another change. `verify-report.md` was untracked and moved with the change folder. It was not committed.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/proposal.md` | none (filesystem only; searched `blackhole` and `cli`) |
| spec authorization | `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/specs/authorization/spec.md` | none (filesystem only; searched `blackhole` and `cli`) |
| spec sensitive-actions | `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/specs/sensitive-actions/spec.md` | none (filesystem only; searched `blackhole` and `cli`) |
| design | `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/design.md` | none (filesystem only; searched `blackhole` and `cli`) |
| tasks | `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/tasks.md` | none (filesystem only; searched `blackhole` and `cli`) |
| apply-progress | `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/apply-progress.md` | none (filesystem only) |
| verify-report | `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/verify-report.md` | 1181, topic `sdd/p1-07-anti-theft-controls/verify-report` |
| review transaction | none | none |
| review ledger | none | none |
| review receipt | none | none |
| review gate-context | none | none |
| archive-report | `openspec/changes/archive/2026-11-05-p1-07-anti-theft-controls/archive-report.md` | 1192 (`obs-ada6d72188c272be`), topic `sdd/p1-07-anti-theft-controls/archive-report` |

## Task Completion Gate

`tasks.md` has 25/25 implementation tasks checked (1.1, 2.1–2.5, 3.1, 4.1–4.7, 5.1–5.3, 6.1–6.7, 7.1). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. `apply-progress.md` records the same 25/25. The verify report records tasks total 25, complete 25, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks. This archive does not mark them done.

## Deferred Hybrid Scenarios (not PASS)

These two scenarios stay **DEFERRED** under decision D-37. This archive does not mark them compliant, does not mark them pass, and does not implement them.

- **Hybrid offline PIN**, requirement **Authorization by Operating Mode** (authorization). D-37 and the design leave out PIN without internet, SQLite, outbox, node queue, and later sync.
- **Offline action**, requirement **Control Reports** (sensitive-actions). D-37 and the design leave out the void on an offline hybrid node and its single appearance after sync.

The scenario sentences stay in both specs as written. No sentence was rewritten into a passing result. `local-node` still returns 403 `{ error: "SensitiveActionRejected" }` and stores nothing. **Cloud mode cut** and **Authorized void listed** remain the covered cloud scenarios.

## Spec Reconciliation

### authorization

`openspec/specs/authorization/spec.md` already existed. The delta at `specs/authorization/spec.md` contains only `## ADDED Requirements`. Three requirements were appended. Zero requirements were replaced, removed, or renamed. The seven prior requirements stay:

- Permission Catalog and Matrix
- Scoped Assignments
- Server-Side Evaluation
- Limits and Site Adjustments
- No Privilege Escalation
- Supervisor Authorization
- Support Access

Appended:

- Authorization Bound to One Operation: Value matches; Value increased
- Shift Accumulators From Executed Operations: Courtesy cap reached; Rejected request not counted
- Authorization by Operating Mode: Hybrid offline PIN (**DEFERRED**, D-37, not PASS); Cloud mode cut

### sensitive-actions

`openspec/specs/sensitive-actions/spec.md` did not exist. The delta is a full specification. It was copied unchanged before the folder move. SHA-256 of both copies at sync time: `BC832B8676DF7E7F5E0D2D2766C8ED6A09D30551A55761573059EA08B50112BD`. Length 4537 bytes.

The copied file keeps eight requirements and sixteen scenarios:

- Blocked Without Authorization: Direct call blocked; Authorized by PIN
- Voids: Within waiter cap; After kitchen started
- Discounts, Courtesies and Price Changes: Discount over cap; Price change
- Edits After Pre-bill and Table Transfer: Edit after pre-bill; Supervisor transfers table
- Reopen and Payment Method Change: Change payment method; Closed shift
- Drawer Without Sale: Authorized opening; Unauthorized opening
- Control Reports: Authorized void listed; Offline action (**DEFERRED**, D-37, not PASS)
- Unusual Behavior Alerts: Too many voids; Self-authorization

Other domains and other active changes were not touched.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| authorization | Updated | 3 added, 0 modified, 0 removed, 0 renamed. 7 prior requirements preserved. Hybrid offline PIN remains DEFERRED under D-37 and is not recorded as pass. |
| sensitive-actions | Created | Full spec copied unchanged. 8 requirements, 16 scenarios. 0 requirements deleted from a prior main spec. Offline action remains DEFERRED under D-37 and is not recorded as pass. |

Source of truth: `openspec/specs/authorization/spec.md` and `openspec/specs/sensitive-actions/spec.md`.

## Recorded Verification (not re-run)

From `verify-report.md` only. That report's checkout is `master` at `27e730779e56470a5fa0566492d7c4d8e4c3c98d`. Archive-time HEAD is the same SHA. This phase did not re-run tests.

- Tests: `pnpm test`. Exit 0. 226 files, 1650 passed, 0 failed, 0 skipped. `test_output_hash: sha256:f24965478545f1ee87375bde96e51560eec8856a420fe8a7e0079bbbf7588e9b`.
- Build: `pnpm typecheck`. Exit 0. `build_output_hash: sha256:1de08e7c59b5fe34b6c30da5e43ca23050ae4d9ac4ebba35f75abec87805234c`.
- Lint: `pnpm exec biome check`. Exit 1. Recorded as CRLF format noise. Not a blocker.
- Architecture: `pnpm architecture`. Exit 0. 712 modules, 0 violations. TypeScript 7 parser warning recorded.
- `blockers: 0`. `critical_findings: 0`. `archive_allowed: true`.
- `evidence_revision: sha256:e2d458fffad7ec8f0a0fc78dc533cf88aec3a9e38840ee74e3dadc78ff9558b0`.

## Residual Warnings (not blocking)

Accepted with the recorded verdict. This archive does not treat them as resolved and does not change product source:

1. Hybrid offline PIN and Offline action stay **DEFERRED** under D-37. PIN without internet, SQLite, outbox, node queue, and later sync are not built. This is not a pass.
2. `pnpm exec biome check` exited 1 in that run (CRLF in `package.json` and `tsconfig.json`). That exit does not enter the blocker count.
3. `pnpm architecture` exited 0 and warned that dependency-cruiser wants TypeScript `>=2.0.0 <7.0.0`.
4. Cash-register Drizzle still persists movements only. Reversals and the replacement payment live on the in-memory shift. Spec tests pass against that double.
5. `DetectUnusualBehavior` does not insert into `authorization_alerts`. The alert is returned by the detector. The SQL table stays unused on that path.
6. The proposal says `shared/printing` changes. The design and the code leave it unchanged. The design was followed.
7. Proposal success criteria stay unchecked. They are not implementation tasks.
8. Several apply slices exceeded 400 lines without `size:exception`. They are already on `master`. This archive does not reopen them.

## State

`state.yaml` in this archive has `status: archived`, `apply: done`, `verify: done`, `archive: done`, and `verify_verdict: pass-with-warnings`. `apply` was pending in the pre-archive file even though `tasks.md` and `apply-progress.md` already recorded 25/25. Closing it records that completed apply. The active folder `openspec/changes/p1-07-anti-theft-controls/` is removed by the move.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, zero CRITICAL, 25/25 tasks, 20/22 scenarios, Hybrid offline PIN and Offline action DEFERRED under D-37 and not pass), merged into the main specs, and archived with warnings. Active `openspec/changes/` no longer contains `p1-07-anti-theft-controls`.
