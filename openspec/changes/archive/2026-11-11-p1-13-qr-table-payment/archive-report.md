# Archive Report

**Change**: p1-13-qr-table-payment
**Project**: blackhole
**Artifact store**: hybrid (openspec on disk + Engram project `blackhole`)
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-11-11
**Archived to**: `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/`
**Verification verdict**: PASS WITH WARNINGS
**CRITICAL**: None
**strict_tdd**: false (`strict-tdd` files were not loaded)
**Checkout at archive**: `master` `20c8d7d45fe972ad89c1dbeea6149e6a076e17a6`

## Gate

Persistence is hybrid. Filesystem artifacts were read from `openspec/changes/p1-13-qr-table-payment/`. Engram was searched in projects `blackhole` and `cli` for `sdd/p1-13-qr-table-payment/proposal`, `sdd/p1-13-qr-table-payment/spec`, `sdd/p1-13-qr-table-payment/design`, `sdd/p1-13-qr-table-payment/tasks`, and `sdd/p1-13-qr-table-payment/verify-report`.

`verify-report.md` verdict is PASS WITH WARNINGS. CRITICAL count is zero. Tasks total 32, complete 32, incomplete 0. The orchestrator instructed archive and said the closed live gateway, the missing `QrPaymentDesk` provider, the demo screen figures, and deferred PA-52 do not block archive. Those warnings were preserved. This phase did not fix them and did not edit product code.

`openspec/config.yaml` `rules.archive` says warn before merging destructive deltas. The cash-register delta contains only `ADDED Requirements`. It has no `MODIFIED`, `REMOVED`, or `RENAMED` sections. The qr-table-payment delta is a full specification with no delta section headers, and `openspec/specs/qr-table-payment/spec.md` did not exist. The merge adds requirements and creates one spec. It deletes nothing. No extra confirmation was required.

This phase did not commit, did not push, and did not touch `openspec/changes/p1-11-site-reports` or `openspec/changes/p1-12-qr-table-ordering`.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/proposal.md` | none (filesystem only; searched `blackhole` and `cli`) |
| spec | `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/specs/` | none (filesystem only; searched `blackhole` and `cli`) |
| design | `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/design.md` | 1255, topic `sdd/p1-13-qr-table-payment/design` |
| tasks | `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/tasks.md` | 1258, topic `sdd/p1-13-qr-table-payment/tasks` |
| apply-progress | `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/apply-progress.md` | 1261, topic `sdd/p1-13-qr-table-payment/apply-progress` |
| verify-report | `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/verify-report.md` | 1270, topic `sdd/p1-13-qr-table-payment/verify-report` |
| archive-report | `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/archive-report.md` | 1271 (`obs-6c88892344593d0e`), topic `sdd/p1-13-qr-table-payment/archive-report` |

Engram tasks observation 1258 is a narrative summary. It does not repeat checkbox marks. The completion gate used `tasks.md` on disk.

## Task Completion Gate

`tasks.md` has 32/32 implementation tasks checked (1.1–1.4, 2.1–2.18, 3.1–3.2, 4.1–4.6, 5.1–5.2). No `- [ ]` implementation task remains. No archive-time checkbox reconciliation was required. The verify report records tasks total 32, complete 32, incomplete 0.

Proposal success criteria in `proposal.md` remain unchecked. Those are pilot outcomes, not implementation tasks:

- A customer pays the bill from the QR, the gateway confirms only once, the invoice is issued and the table becomes "to clean". The cash count separates that money from cash.
- A payment made during an outage is applied once on reconnection.

This archive does not mark those proposal criteria done.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| qr-table-payment | Created | Full spec copied. 7 requirements, 14 scenarios. 0 modified, 0 removed, 0 renamed. |
| cash-register | Updated | 2 added, 0 modified, 0 removed, 0 renamed. The previous 8 requirements stay in place. |

`openspec/specs/qr-table-payment/spec.md` was copied from the change delta before the folder move. SHA-256 of both copies at sync time: `E5969C85D2E4CF23114CDFC40811FD88248149D70FFA01A3AF63718D6419932B`. No sentence was rewritten.

Copied requirements:

- Balance and Tip: View balance; Split account
- Exact-Amount Charge: Charge started; Tampered amount
- Gateway Confirmation: Confirmed once; Invalid signature
- Payment Application: Online site; Partial payment
- Payment During an Outage: Paid during outage; Batch delivered twice
- Coexistence With Register Payments: Mixed payment; Balance changed after charge started
- Gateway Reconciliation: Matching report; Missing in report

Appended to `openspec/specs/cash-register/spec.md`:

- QR Payment Method in the Shift: Cash count with QR payments; Closed shift
- QR Payment Pending Application: No open shift; Shift opens

Partial verify scenarios stay in the main spec with their original wording. This archive does not mark them compliant:

- View balance (portal tip choices, including no tip, are not on the screen)
- Online site (hybrid node remains PA-52)
- Paid during outage (cloud pending-until-next-open is tested; reconnect is not)
- Batch delivered twice (one confirmation and one apply are tested; no node batch)
- Mixed payment (part 2 stays unpaid; no cashier view of only the unpaid part)
- No open shift (`pending_application` is tested; the staff alert is a static label)

## Warnings Preserved

These verify warnings were not fixed:

- The live composition gateway stays closed. `BoldPaymentGateway` is reachable through the package-private `#adapters/bold/*` import, so `ApplicationModule` does not wire it. `ClosedQrGateway.verifyWebhook` always returns null. `ClosedQrTableAccess.resolve` always returns null. `DisabledQrPayments` always refuses a start. `PendingQrIssuer` always reports `pending_issuance`. `EmptySplits` never finds a part. The Nest store stays `MemoryQrPayments`, not `DrizzleQrPaymentRepository`.
- `QrPaymentDesk` has no provider. With `desk === undefined`, `listStale` returns `[]` and `readCount` returns zeros. The passing HTTP stale/count test supplies its own desk.
- Register and payment screens keep fixed demo figures. `RegisterScreen` renders `qrpay_stale`, `QR $120.000`, and `Efectivo esperado $200.000`. `/d/$token` passes balance `85000`, paid `part_1` at `45000`, and unpaid `part_2` at `40000`. The pay screen does not offer a tip, including no tip.
- Hybrid outage, payment during an outage on the node, and a batch delivered twice stay deferred on PA-52. There is no offline-reconnect test.
- `cash-count.controller.ts` does not add `qrCop` / `qrReportCop`. The count fields exist on `cashCountView` and on `SubmitCount`.

## Archive Contents

- proposal.md
- specs/qr-table-payment/spec.md
- specs/cash-register/spec.md
- design.md
- tasks.md (32/32 implementation tasks complete)
- verify-report.md
- apply-progress.md
- state.yaml
- archive-report.md

## Source of Truth Updated

- `openspec/specs/qr-table-payment/spec.md`
- `openspec/specs/cash-register/spec.md`

## SDD Cycle

The change was planned, implemented, verified, and archived. Ready for the next change. Follow-up for the preserved warnings is a new change, not a reopen of this archive.

**Where**: `openspec/changes/archive/2026-11-11-p1-13-qr-table-payment/archive-report.md`, `openspec/specs/qr-table-payment/spec.md`, `openspec/specs/cash-register/spec.md`
**Learned**: Proposal and spec observations are absent from Engram. Design 1255, tasks 1258, apply-progress 1261, and verify-report 1270 are the recorded lineage. PASS WITH WARNINGS did not block archive. The closed gateway, missing desk, demo figures, PA-52, and the cash-count controller gap stay open.
