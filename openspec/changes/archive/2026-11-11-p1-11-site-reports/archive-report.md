# Archive Report

**Change**: p1-11-site-reports
**Project**: blackhole
**Artifact store**: hybrid (openspec on disk + Engram project `blackhole`)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-11
**Archived to**: `openspec/changes/archive/2026-11-11-p1-11-site-reports/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `master` `20c8d7d45fe972ad89c1dbeea6149e6a076e17a6`

## Gate

Persistence is hybrid. Filesystem artifacts were read from `openspec/changes/p1-11-site-reports/`. Engram was searched in projects `blackhole` and `cli` for `sdd/p1-11-site-reports/proposal`, `sdd/p1-11-site-reports/spec`, `sdd/p1-11-site-reports/design`, `sdd/p1-11-site-reports/tasks`, and `sdd/p1-11-site-reports/verify-report`.

`verify-report.md` and Engram observation 1267 verdict is PASS WITH WARNINGS. CRITICAL count is zero. Tasks total 36, complete 36, incomplete 0. The orchestrator instructed archive and said these warnings do not block archive and must not be fixed: composed line `chargedAt` stays null so sales stay empty; product id is the line id; `AbsentOpenShift` remains; `MemoryLedgerCashFacts` is the factory reader; task 2.8 names `0004_report_stamps.sql` while the file is `0005_report_stamps.sql`. Deferred scenarios (local-node, sync, hybrid outage, QR tender, portal capture) stay deferred. Those warnings were preserved. This phase did not fix them and did not edit product code.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The reporting delta is a full specification with no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` section headers, and `openspec/specs/reporting/spec.md` did not exist. The merge creates one spec. It deletes nothing. No extra confirmation was required.

This phase did not commit, did not push, and did not touch `openspec/changes/p1-12-qr-table-ordering` or `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment`.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-11-p1-11-site-reports/proposal.md` | none (filesystem only; searched `blackhole` and `cli`) |
| spec | `openspec/changes/archive/2026-11-11-p1-11-site-reports/specs/reporting/spec.md` | none (filesystem only; searched `blackhole` and `cli`) |
| design | `openspec/changes/archive/2026-11-11-p1-11-site-reports/design.md` | 1236, topic `sdd/p1-11-site-reports/design` |
| tasks | `openspec/changes/archive/2026-11-11-p1-11-site-reports/tasks.md` | none (filesystem only; searched `blackhole` and `cli`) |
| apply-progress | `openspec/changes/archive/2026-11-11-p1-11-site-reports/apply-progress.md` | 1259, topic `sdd/p1-11-site-reports/apply-progress` |
| verify-report | `openspec/changes/archive/2026-11-11-p1-11-site-reports/verify-report.md` | 1267, topic `sdd/p1-11-site-reports/verify-report` |
| archive-report | `openspec/changes/archive/2026-11-11-p1-11-site-reports/archive-report.md` | 1272 (`obs-f8231254909ab530`), topic `sdd/p1-11-site-reports/archive-report` |

The completion gate used `tasks.md` on disk. No Engram tasks observation exists to reconcile against.

## Task Completion Gate

`tasks.md` has 36/36 implementation tasks checked (1.1–1.2, 2.1–2.8, 3.1–3.8, 4.1–4.12, 5.1–5.6). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. The verify report records tasks total 36, complete 36, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked. Those are pilot outcomes, not implementation tasks:

- The administrator reviews the day's operation on the node during an outage, and the history from the web.
- A hybrid site offline for 2 hours appears complete after syncing, with zero duplicates in totals.
- The same day yields the same totals on node and cloud.

This archive does not mark those proposal criteria done. Task 2.8 stays checked and still names `0004_report_stamps.sql`. The migration file name was not rewritten.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| reporting | Created | Full spec copied. 7 requirements, 14 scenarios. 0 modified, 0 removed, 0 renamed. |

`openspec/specs/reporting/spec.md` was copied from the change delta before the folder move. SHA-256 of both copies at sync time: `460ABE6D75A15594CBB9133A7175DEC59B5D05BE53301EE1AB49C05D865E63BA`. No sentence was rewritten.

Copied requirements:

- Shared Metric Definitions: Missing end state; Same day, both sides
- Day Reports on the Operation Owner: Hybrid outage; Cloud outage
- Sales Reports: QR separate from cash; Portal capture share
- Time Reports: Station filter; Empty filter
- Cash Register and Staff Reports: Sales per hour worked; Corrected clock event
- Cloud History Projections: Duplicate after outage; Lagging site
- Role-Scoped Access: Other site; Supervisor history

Deferred and partial scenarios stay in the main spec with their original wording. This archive does not mark them compliant:

- Same day, both sides (design defers the node reader)
- Hybrid outage (design defers local-node)
- Cloud outage (failed read is not zeroed; no node day path, by design D-37)
- QR separate from cash (design defers a QR tender to p1-12)
- Portal capture share (design defers capture; invoices stay empty)
- Corrected clock event (proven on `ListStaffHours`, not re-run through `ReadStaffReport`)
- Duplicate after outage (hybrid remainder)
- Lagging site (hybrid remainder)

## Warnings Preserved

These verify warnings were not fixed:

- Composed service lines still have `chargedAt: null`. `ReadSalesReport` keeps only lines with `chargedAt`, so sales, sales per hour, payment time, and table duration stay empty on the API. Gross, net, tickets, Bogotá bands, channels, tips, products, rotation, and tender share stay the empty section.
- `productId` and `productName` are `line.lineId`. `quantity` is 1. `discountCop` is 0. Included tax and tip default to 0. A product filter matches the line id.
- `AbsentOpenShift` remains. `application-module.ts` still injects `AbsentOpenShift` into all four readers, so every supervisor request is `previous_shift`. The use case can clamp to an injected open shift. The open-shift clamp is not loaded.
- `MemoryLedgerCashFacts` is the factory reader. The api-cloud factory passes `MemoryLedgerCashFacts`, not `LedgerCashFactReader`. Counts still flow through `ListCashFacts`. The HTTP test only proves the empty ledger (`rows: []`). `MemoryLedgerCashFacts` sets tender `waiterId` to null, so waiter tips on the composed snapshot stay empty.
- Task 2.8 names `0004_report_stamps.sql`. The change's migration is `contexts/orders/adapters/postgres/0005_report_stamps.sql`. The dining-room contract that applies `0005` was not run in the last verify pass.
- Deferred scenarios stay deferred: local-node, sync, hybrid outage, QR tender, and portal capture. Also deferred with them: same-day node and cloud totals, duplicate batches, and lagging sites. `reportedChannel` still drops `qr_table`. `ListCashFacts` still drops stored method `qr`. Capture stays `unspecified`. `ListInvoiceFacts` stays `EmptyIssuedInvoices`.
- Task 5.4 says wire `EvaluatePermission`. The composition rechecks `authorization.evaluateFor` inside `PermissionReportAccess`. The kitchen-chief 403 test passed.
- The corrected-clock scenario was not re-run. It is proven on `ListStaffHours`, not through `ReadStaffReport`.

## Archive Contents

- proposal.md
- specs/reporting/spec.md
- design.md
- tasks.md (36/36 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml
- archive-report.md

Active `openspec/changes/p1-11-site-reports/` is gone.

## Source of Truth Updated

- `openspec/specs/reporting/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-11-p1-11-site-reports/archive-report.md`, `openspec/specs/reporting/spec.md`
**Learned**: Proposal, spec, and tasks observations are absent from Engram. Design 1236, apply-progress 1259, verify-report 1267, and archive-report 1272 are the recorded lineage. PASS WITH WARNINGS did not block archive. `chargedAt` null, line-id products, `AbsentOpenShift`, `MemoryLedgerCashFacts`, the `0004` versus `0005` task name, and the deferred local-node, sync, hybrid, QR, and portal scenarios stay open.
