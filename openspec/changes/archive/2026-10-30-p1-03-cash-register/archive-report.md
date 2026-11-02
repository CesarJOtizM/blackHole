# Archive Report

**Change**: p1-03-cash-register
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-10-30
**Archived to**: `openspec/changes/archive/2026-10-30-p1-03-cash-register/`
**Verification verdict**: PASS WITH WARNINGS
**Engram**: not used. No observation IDs. Orchestrator forbade Engram for this archive.

## Gate

`reviewGate.result` from the orchestrator is `allow`. This repo has no Engram review receipt. The 2026-10-28 archives used `verify-report.md` as the gate. This archive does the same. There is no transaction, ledger, or receipt file. That absence is not a blocker.

`verify-report.md` records `verdict: pass_with_warnings`, `blockers: 0`, `critical_findings: 0`, requirements 7/8, scenarios 15/16, and `Archive is allowed: yes`. `pnpm test` exited 0 (161 files, 1218 tests). `pnpm typecheck` exited 0. No CRITICAL finding blocked this archive.

`state.yaml` was stale before the move: `status: tasked`, `apply: partial`, `verify: pending`, `archive: pending`. It was not edited. The orchestrator owns that file. The verify report and `tasks.md` are the authority: tasks 35/35 are checked.

The orchestrator accepted two behavioral warnings as non-blocking and instructed this phase not to fix them. They are recorded under Residual Warnings.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/p1-03-cash-register/proposal.md` | n/a (openspec) |
| spec | `openspec/changes/p1-03-cash-register/specs/cash-register/spec.md` | n/a (openspec) |
| design | `openspec/changes/p1-03-cash-register/design.md` | n/a (openspec) |
| tasks | `openspec/changes/p1-03-cash-register/tasks.md` | n/a (openspec) |
| apply-progress | `openspec/changes/p1-03-cash-register/apply-progress.md` | n/a (openspec) |
| verify-report | `openspec/changes/p1-03-cash-register/verify-report.md` | n/a (openspec) |
| archive-report | `openspec/changes/archive/2026-10-30-p1-03-cash-register/archive-report.md` | n/a (openspec) |

## Task Completion Gate

`tasks.md` has 35/35 implementation tasks checked (1.1–1.11, 2.1–2.8, 3.1–3.6, 4.1–4.2, 5.1–5.6, 6.1–6.2). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. The test suite was not run in this phase.

`apply-progress.md` is a cumulative slice log. Early units still describe later tasks as unchecked. Unit 17 is the last slice and records tasks 6.1–6.2 done, with no implementation tasks remaining. The persisted task artifact is `tasks.md`.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks:

- A trial shift with every payment method balances against what was counted.
- Cashier and supervisor cannot see the expected total before counting.
- A closed shift rejects any edit.

The third criterion overlaps the accepted charge-after-close warning. The domain scenario "Edit after close" stayed compliant. This archive does not mark those proposal criteria done.

## Spec Reconciliation

No sentence or scenario was rewritten. The orchestrator instructed a straight copy and said not to fix the warnings.

The delta has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. It is a full spec. The main spec `openspec/specs/cash-register/spec.md` did not exist, so the change spec was copied unchanged before the folder move. SHA-256 of both copies at sync time: `A0F50F4C5D2A9A7D7AD419111745C8671DCB25444C1478DCB1F834CAFE367F95`.

This merge adds requirements. It does not delete existing main-spec requirements. `openspec/config.yaml` `rules.archive` ("Warn before merging destructive deltas") does not apply as a destructive merge. Other domains (catalog, attendance, electronic-invoicing, monitoring, and the rest) were not touched.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| cash-register | Created | Full spec copied unchanged. 8 requirements, 16 scenarios. 0 modified, 0 removed, 0 renamed in a prior main spec. |

Source of truth: `openspec/specs/cash-register/spec.md`.

## Residual Warnings (not blocking)

Accepted by the orchestrator. This archive does not treat them as resolved and does not change product source:

1. `DrizzleCashRegisterRepository.toShift` always calls `CashShift.open` and ignores `cash_shifts.status`. A stored counting or closed shift row reloads as domain state `open`. `CashShift` itself only models `open`. `readCount` returns the stored count status. The use-case `CashCountStore` in api-cloud keeps the live object.
2. `ChargeCheck.execute` does not read the count. A new `commandId` can still record a payment after close. Domain and `CloseShift` tests still reject an edit after close, and those tests passed, so the spec scenario "Edit after close" stays compliant.

Also recorded from the verify report, and also left unfixed:

3. There is no HTTP route for cash in, cash out, or withdrawal. Mapped cash routes are open, charge, count, approve, partial close, and final close. Movement spec scenarios passed at domain and application.
4. api-cloud defaults to in-memory cash stores. Postgres is tested in the PGlite contract tests, not wired as the Nest default. That matches the no-persistence-dialect composition rule.
5. The opening float is one integer. The spec sentence asks for a float by denomination; denominations are on the count. The open-shift scenario (200000) passed.
6. Diner split has no diner id. Equal split and the partially paid scenario passed. Line split assigns lines and copies `originTableId`.
7. Hybrid outbox, SQLite, and sync are absent under D-37. Local-node 403 `CashRegisterRejected` is the cloud-mode stand-in and passed. The hybrid scenario "Paid during a cut (hybrid)" is partial because the outbox clause has no passing test. Compliance is 15/16 scenarios and 7/8 requirements.

Suggestions left as delivery notes, not blockers: `pnpm lint` exited 1 (463 format diagnostics, mostly CRLF, and 1 `useOptionalChain` in `contexts/platform/domain/authorization.ts`); dependency-cruiser prints `missing-typescript-transpiler` for TypeScript 7 while `pnpm architecture` exited 0; the tasks review-budget forecast is High and recommends chained PRs.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, no CRITICAL), copied unchanged into the main spec, and archived. Active `openspec/changes/` no longer contains `p1-03-cash-register`.
