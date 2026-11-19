# Archive Report

**Change**: p2-09-not-restocked-today
**Project**: blackhole
**Artifact store**: openspec (`openspec/config.yaml` persistence: openspec)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-19
**Archived to**: `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `p2-11/rollout-status` `750d0f365f7f2ed36d6eaa57d40ab3fed54bab20`

## Gate

Persistence is openspec. Filesystem artifacts were read from `openspec/changes/p2-09-not-restocked-today/`: `proposal.md`, `specs/dish-withdrawal/spec.md`, `design.md`, `tasks.md`, `apply-progress.md`, `verify-report.md`, and `state.yaml`. No Engram review receipt exists in this change folder. The orchestrator authorized archive when tasks are complete and the verify report has zero CRITICAL.

`verify-report.md` front matter is `verdict: pass_with_warnings`, `critical_findings: 0`, `archive_allowed: false`. The body says **CRITICAL**: None and **Verdict**: PASS WITH WARNINGS. `archive_allowed: false` treats `p2-02`, `p2-05`, `p2-07`, and `p2-08` as not archived, and treats `p1-12-qr-table-ordering` as not archive-done because its `state.yaml` still says `specified`. Those rows are stale. Archive folders exist:

- `openspec/changes/archive/2026-10-28-p1-02-dining-room-and-kitchen/`
- `openspec/changes/archive/2026-11-11-p1-12-qr-table-ordering/`
- `openspec/changes/archive/2026-11-19-p2-02-sale-consumption/`
- `openspec/changes/archive/2026-11-19-p2-05-warehouses-and-transfers/`
- `openspec/changes/archive/2026-11-19-p2-07-producible-quantity/`
- `openspec/changes/archive/2026-11-19-p2-08-shortage-alerts/`

The orchestrator stated that a dependency is satisfied by the archive folder even when a later `state.yaml` still says pending or verify fail, and that `p1-12-qr-table-ordering` is already archived.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The dish-withdrawal artifact is a full specification. It has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. `openspec/specs/dish-withdrawal/spec.md` did not exist. The merge creates that spec and deletes nothing. No extra confirmation was required. Proposal capabilities list `dish-withdrawal` as new and modified capabilities as none.

This phase did not commit, did not re-verify, did not edit product code, and did not update `docs/roadmap.md`.

`state.yaml` `artifacts.archive` was set to `done` before the folder move. `status` stays `applied`. `verify` stays `pass` as written in that file. `archive_blocked` and `dependency_verification` were left as the verifier wrote them.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/proposal.md` | none (openspec filesystem) |
| spec | `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/specs/dish-withdrawal/spec.md` | none (openspec filesystem) |
| design | `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/design.md` | none (openspec filesystem) |
| tasks | `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/tasks.md` | none (openspec filesystem) |
| apply-progress | `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/apply-progress.md` | none (openspec filesystem) |
| verify-report | `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/verify-report.md` | none (openspec filesystem) |
| archive-report | `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/archive-report.md` | Engram `1397` (`obs-548537a0c5158d52`), topic `sdd/p2-09-not-restocked-today/archive-report` |

## Task Completion Gate

`tasks.md` has 29/29 implementation tasks checked (1.1–1.2, 2.1–2.2, 3.1–3.6, 4.1–4.8, 5.1–5.4, 6.1–6.7). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was performed. The verify report records 29/29 tasks checked.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| dish-withdrawal | Created | Full spec copied. 7 requirements, 14 scenarios. 0 modified, 0 removed, 0 renamed. |

SHA-256 at sync time, main spec equals the change spec: `DFE23654D089B0C10595AA589D04E7F60C8CF9FC625EBF3A01AAF7F05F3C9D88`.

Copied requirements: System Proposal, Human Confirmation, Menu Block, Queue Withdrawal, Kitchen Cannot Finish, Instant Waiter Notice, Customer Notified.

The verify report marks 10/14 scenarios compliant. Two ledger clauses are partial and two hybrid scenarios are design-deferred. The copied spec keeps those texts.

## Warnings Preserved

- QR order queued during an outage, and hybrid offline notice within 2 s, have no reconnect or offline test.
- Unstarted withdrawal does not return ingredients, and a station mark does not call `RecordWaste`.
- `noRestockTodayEnabled` defaults off.
- The Drizzle no-restock repository is not on the package exports.
- Cloud confirm withdraws with `Number.MAX_SAFE_INTEGER`, so every `sent` line of the product leaves the queue.
- Guest told stays in `MemoryGuestTold` and does not survive a process restart.
- QR controllers construct `TakeOrder` without `NotRestockedProductReader`.
- `ProposeNoRestockToday` is not called from `api-cloud`.
- This run did not execute the in-memory contract, the permission catalog, the orders withdrawal PGlite file, typecheck, lint, or architecture.

## Archive Contents

- proposal.md
- specs/dish-withdrawal/spec.md
- design.md
- tasks.md (29/29 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml (`artifacts.archive: done`)
- archive-report.md

Active `openspec/changes/p2-09-not-restocked-today/` is gone.

## Source of Truth Updated

- `openspec/specs/dish-withdrawal/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-19-p2-09-not-restocked-today/archive-report.md`, `openspec/specs/dish-withdrawal/spec.md`
**Learned**: `p1-12` is satisfied by its archive folder even though its copied state still says specified. Zero CRITICAL and complete tasks allowed archive as intentional-with-warnings.
