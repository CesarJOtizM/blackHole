# Archive Report

**Change**: p1-06-printing
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-03
**Archived to**: `openspec/changes/archive/2026-11-03-p1-06-printing/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false
**Published spec**: `openspec/specs/printing/spec.md`

## Gate

Persistence mode is openspec. Filesystem artifacts were read from `openspec/changes/p1-06-printing/`. Engram was searched for `sdd/p1-06-printing/proposal`, `sdd/p1-06-printing/spec`, `sdd/p1-06-printing/design`, `sdd/p1-06-printing/tasks`, and `sdd/p1-06-printing/verify-report` in project `blackhole`, and proposal and spec were searched again in project `cli`. Proposal and spec have no Engram observation. Design, tasks, and verify-report were retrieved in full.

The recorded verdict is PASS WITH WARNINGS. Tasks 32/32. In-scope scenarios 7/10 compliant, 3 partial, 2 deferred. CRITICAL is None. The orchestrator instructed an intentional archive with warnings. Those warnings do not block archive. This phase did not re-run tests and does not claim a new test run.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The delta at `specs/printing/spec.md` is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/printing/spec.md` did not exist. The copy creates the source of truth and deletes nothing from a prior main spec. The merge is not destructive. No extra confirmation was required.

This phase did not edit product source, did not commit, did not push, did not merge pull requests, and did not edit another change. Git line-ending noise was left untouched and was not staged.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-03-p1-06-printing/proposal.md` | none (filesystem only; searched `blackhole` and `cli`) |
| spec | `openspec/changes/archive/2026-11-03-p1-06-printing/specs/printing/spec.md` | none (filesystem only; searched `blackhole` and `cli`) |
| design | `openspec/changes/archive/2026-11-03-p1-06-printing/design.md` | 1166, topic `sdd/p1-06-printing/design` |
| tasks | `openspec/changes/archive/2026-11-03-p1-06-printing/tasks.md` | 1168, topic `sdd/p1-06-printing/tasks` |
| apply-progress | `openspec/changes/archive/2026-11-03-p1-06-printing/apply-progress.md` | 1169, topic `sdd/p1-06-printing/apply-progress` |
| verify-report | `openspec/changes/archive/2026-11-03-p1-06-printing/verify-report.md` | 1172, topic `sdd/p1-06-printing/verify-report` |
| archive-report | `openspec/changes/archive/2026-11-03-p1-06-printing/archive-report.md` | 1173 (`obs-474f971d54943465`), topic `sdd/p1-06-printing/archive-report` |

Related, not a phase artifact: observation 1171, title "Printing node rejection stacked".

## Task Completion Gate

`tasks.md` has 32/32 implementation tasks checked (1.1–1.6, 2.1–2.6, 3.1–3.2, 4.1–4.4, 5.1–5.8, 6.1–6.6). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. `apply-progress.md` records the same 32/32. The verify report records tasks total 32, complete 32, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked. Those are not implementation tasks:

- All templates print correctly on the pilot's real printers, in 80 and 58 mm.
- A failing primary printer falls back to its backup without losing the job.
- Every reprint appears in the audit.

This archive does not mark those proposal criteria done. Physical printer proof stays on p0-01. The backup and reprint behaviors that shipped are the partial ones recorded below.

## Spec Reconciliation

No sentence or scenario was rewritten. The orchestrator instructed a straight copy because `openspec/specs/printing/spec.md` did not exist.

The delta was copied there unchanged before the folder move. SHA-256 of both copies at sync time: `ED0880AC8291BABAF8C3D9BBB05C37A8DF08738B256816100D1A669B872C4332`. Length 3431 bytes.

The copied file keeps six requirements and twelve scenarios:

- Templates and Widths: Invoice on 58 mm; Offline receipt
- Where Printing Runs: Hybrid offline; Bridge off (cloud mode)
- Queue, Retries and Status: Transient failure; Retries exhausted
- Backup Printer: Primary down; Both down
- Audited Reprint: Reprint within cap; Over cap
- Cash Drawer: Cash sale opens drawer; Drawer on kitchen printer

Deferred and partial scenarios stay in the source of truth. This archive does not implement them, does not remove them, and does not add a queue worker, a screen alert, or a physical printer proof. Other domains were not touched.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| printing | Created | Full spec copied unchanged. 6 requirements, 12 scenarios. 0 delta add, 0 modify, 0 remove, 0 rename. 0 requirements deleted from a prior main spec. |

Source of truth: `openspec/specs/printing/spec.md`.

## Recorded Verification (not re-run)

From `verify-report.md` only. Checkout `feat/printing-node` at `74dcb1c` (`74dcb1cf793495d56b8d12685fb375e0026de6d3`).

- Build: `pnpm exec tsc -b shared/printing contexts/cash-register contexts/invoicing contexts/orders apps/api-cloud apps/local-node shared/contracts --pretty false`. Exit 0.
- Tests: six commanded Vitest suites. 144 passed, 0 failed, 0 skipped.
- Coverage: not available. Threshold 0%.
- `pnpm test`, `pnpm lint`, and `pnpm architecture` were not run in that phase.

This archive did not run those commands again.

## Residual Warnings (not blocking)

Accepted by the orchestrator as intentional-with-warnings. They do not block archive. This archive does not treat them as resolved and does not change product source:

1. Reprint within cap audits `sale.reprint` with actor, device, document, and time. `ReprintDocument` does not enqueue and does not print. The spec sentence "it prints" is not covered.
2. Retry exhaustion marks the job `failed` when there is no backup. `DispatchPrintJobs` does not alert a screen. Both printers down marks the job `failed` and does not alert the cash register.
3. Cashier, kitchen, pre-bill, and cash-close HTTP jobs stay in `PendingSalePrinter`. They do not insert `print_jobs` and do not call `EnqueuePrintJob`.
4. The charge response does not call `PrintDocument`, so that queued receipt has no "not an invoice" statement, lookup QR, number, CUFE, or pulse.
5. Paper and backup from the structure command live on `StructurePrinters` in api-cloud memory. They are not written to `0012_printing.sql`. Dispatch backup is a separate in-memory route.
6. `printing_app` is SELECT and INSERT only. The contract test locks that grant in. A later worker cannot mark a Postgres job `printed` or `failed` with this role.
7. The local node rejects only `POST /tenants/:tenantId/reprints` with 403 `PrintingRejected`. It does not host a queue.
8. Over-cap reprint stays in 1.7. The delta still contains "Over cap". There is no route and no authorizer. A numeric cap is treated as already under the limit. That absence is not a failure of this slice.
9. Hybrid printing (SQLite, the outbox, a node queue, offline node printing, and a bridge on the venue LAN) stays deferred under D-37. Physical 80 mm and 58 mm proof, and a physical drawer open, stay deferred on p0-01. This run did not use a live printer or a cloud deploy.

## State

`state.yaml` in this archive has `status: archived` and `archive: done`. `verify_verdict` is `pass-with-warnings`. The active folder `openspec/changes/p1-06-printing/` is removed by the move.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, zero CRITICAL, 32/32 tasks), copied unchanged into the main spec, and archived with warnings. Active `openspec/changes/` no longer contains `p1-06-printing`.
