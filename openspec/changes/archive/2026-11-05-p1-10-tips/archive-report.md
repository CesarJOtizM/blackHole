# Archive Report

**Change**: p1-10-tips
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-05
**Archived to**: `openspec/changes/archive/2026-11-05-p1-10-tips/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false
**Published spec**: `openspec/specs/tips/spec.md`
**Checkout at archive**: `master` `2916554c038e3ba035a97e3262afa75a0f0f11da` (same as `origin/master`)

## Gate

Persistence mode is openspec (`openspec/config.yaml`). Filesystem artifacts were read from `openspec/changes/p1-10-tips/`. Engram was searched for `sdd/p1-10-tips/proposal`, `sdd/p1-10-tips/spec`, `sdd/p1-10-tips/design`, `sdd/p1-10-tips/tasks`, and `sdd/p1-10-tips/verify-report` in project `blackhole`, and proposal, design, and tasks were searched again in project `cli`. Review topics `sdd/p1-10-tips/review/{transaction,ledger,receipt,gate-context}` were searched and were not found. There is no `openspec/changes/p1-10-tips/reviews/` directory.

`verify-report.md` is the receipt (`schema: gentle-ai.verify-result/v1`). Recorded values match the orchestrator gate: `verdict: pass_with_warnings`, `test_exit_code: 0`, `build_exit_code: 0`, `blockers: 0`, `critical_findings: 0`, `archive_allowed: true`. Requirements 7/7. Scenarios 13/14. The missing scenario is "Hybrid outage". It is **DEFERRED** under D-37. It is not COMPLIANT and it is not PASS.

This repository has no native review receipt. The 2026-10-30 and 2026-11-03 archives used `verify-report.md` as the gate. This archive does the same. No transaction, ledger, or receipt file was required. That absence is not a blocker. The orchestrator instructed archive after that verify file matched the gate above.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The delta at `specs/tips/spec.md` is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/tips/spec.md` did not exist. The copy creates the source of truth and deletes nothing from a prior main spec. The merge is not destructive. No extra confirmation was required.

This phase did not edit product source, did not commit, did not push, and did not archive another change. `verify-report.md` was untracked and moved with the change folder. It was not committed.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-05-p1-10-tips/proposal.md` | none (filesystem only; searched `blackhole` and `cli`) |
| spec | `openspec/changes/archive/2026-11-05-p1-10-tips/specs/tips/spec.md` | 1189, topic `sdd/p1-10-tips/spec` |
| design | `openspec/changes/archive/2026-11-05-p1-10-tips/design.md` | none (filesystem only; searched `blackhole` and `cli`) |
| tasks | `openspec/changes/archive/2026-11-05-p1-10-tips/tasks.md` | none (filesystem only; searched `blackhole` and `cli`) |
| apply-progress | `openspec/changes/archive/2026-11-05-p1-10-tips/apply-progress.md` | 1185, topic `sdd/p1-10-tips/apply-progress` |
| verify-report | `openspec/changes/archive/2026-11-05-p1-10-tips/verify-report.md` | 1186, topic `sdd/p1-10-tips/verify-report` |
| archive-report | `openspec/changes/archive/2026-11-05-p1-10-tips/archive-report.md` | 1191 (`obs-012dfc46d79b1015`), topic `sdd/p1-10-tips/archive-report` |

## Task Completion Gate

`tasks.md` has 15/15 implementation tasks checked (1.1–1.4, 2.1, 3.1, 4.1–4.2, 5.1–5.2, 6.1, 7.1–7.3, 8.1). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. `apply-progress.md` records the same 15/15. The verify report records tasks total 15, complete 15, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks:

- A tip settlement for one real week, signed by the staff.
- Shares plus residue always equal the pool.
- Changing the rule never alters a closed settlement.

This archive does not mark those proposal criteria done.

## Deferred Hybrid Scenario (not PASS)

Scenario **Hybrid outage** under requirement **Settlement Location and Outages** stays **DEFERRED** under decision D-37. This archive does not mark it compliant, does not mark it pass, and does not implement it.

Left out of this delivery, as recorded by `tasks.md`, `design.md`, `apply-progress.md`, and `verify-report.md`:

- SQLite settlement on the node
- Outbox
- Node queue
- Deferred emission
- Contingency receipt

`local-node` returns 403 `{ error: "SensitiveActionRejected" }` and stores nothing. Scenario **Cloud outage** is the covered cloud behavior. The hybrid scenario text stays in the copied spec. No sentence was rewritten into a passing result.

## Spec Reconciliation

No sentence or scenario was rewritten. `openspec/specs/tips/spec.md` did not exist, so the delta was copied there unchanged before the folder move. SHA-256 of both copies at sync time: `901D883C486F0B9569443295319C9F7F87BAE8BF7CD6B01FD45970863639F852`. Length 4310 bytes.

The copied file keeps seven requirements and fourteen scenarios:

- Distribution Rule: Valid percentage rule; Percentages not summing 100
- Common Pool: Mixed methods; Empty period
- Participants From Attendance: Default participants; Removal without reason
- Deterministic Calculation: Uneven split; Hours mode with zero hours
- Immutable Settlement: Rule changed later; Attempt to edit
- Printable Settlement: Print for signatures; Printer unavailable
- Settlement Location and Outages: Hybrid outage (**DEFERRED**, D-37, not PASS); Cloud outage

The committed scenario "Valid percentage rule" at this HEAD says employee A 70 % and employee B 30 % (merge `2916554`, PR #113). The verify report was written against `881aae6`, when that line was still uncommitted. This archive does not edit `verify-report.md`.

Other domains were not touched.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| tips | Created | Full spec copied unchanged. 7 requirements, 14 scenarios. 0 delta add, 0 modify, 0 remove, 0 rename. 0 requirements deleted from a prior main spec. Hybrid outage remains DEFERRED under D-37 and is not recorded as pass. |

Source of truth: `openspec/specs/tips/spec.md`.

## Recorded Verification (not re-run)

From `verify-report.md` only. That report's checkout is `master` at `881aae6556948c2ce776079434ae29aaa165c976`. Archive-time HEAD is `2916554c038e3ba035a97e3262afa75a0f0f11da`. This phase did not re-run tests.

- Tests: `pnpm test`. Exit 0. 222 files, 1629 passed, 0 failed, 0 skipped. `test_output_hash: sha256:b8d194298ea9a258899d071b6aa6dd3d81272ccf494dbd79f9f4a43088882c49`.
- Build: `pnpm typecheck`. Exit 0. `build_output_hash: sha256:faeaa94bcf7012d86f91ca647580449f56a263fb7eaf572c54789764f60a9b8f`.
- Lint: `pnpm exec biome check`. Exit 1. Recorded as CRLF format noise. Not a blocker.
- Architecture: `pnpm architecture`. Exit 0.
- `blockers: 0`. `critical_findings: 0`. `archive_allowed: true`.
- CI note in the report: delivery run `41966862437` success for `881aae6`.

## Residual Warnings (not blocking)

Accepted with the recorded verdict. This archive does not treat them as resolved and does not change product source:

1. Hybrid outage stays **DEFERRED** under D-37. SQLite, outbox, node queue, deferred emission, and contingency receipt are not built. This is not a pass.
2. The verify report still describes the employee A/B scenario line as uncommitted on `881aae6`. At archive time that line is on `master` via PR #113 (`2916554`). The report file was not rewritten.
3. `pnpm exec biome check` exited 1 in that run (CRLF in JSON and tsconfig). The recorded CI job on Ubuntu succeeded. That CI result does not replace the local exit.
4. `pnpm architecture` exited 0 and warned that dependency-cruiser wants TypeScript `>=2 <7`.
5. Commits after the verified SHA and before this archive include PR #112 (`feat/shared-ui`) and PR #113 (the tips scenario wording). This phase did not re-verify that range.
6. The proposal line about a signed settlement in a real site stays open. That run had no venue and no printer.

## State

`state.yaml` in this archive has `status: archived`, `verify: done`, `archive: done`, and `verify_verdict: pass-with-warnings`. The active folder `openspec/changes/p1-10-tips/` is removed by the move.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, zero CRITICAL, 15/15 tasks, 13/14 scenarios, hybrid outage DEFERRED under D-37 and not pass), copied unchanged into the main spec, and archived with warnings. Active `openspec/changes/` no longer contains `p1-10-tips`.
