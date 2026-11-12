# Tasks: QR Table Payment

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1800–2600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1–PR16, one pair each |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

PR1 base = tracker `p1-13-qr-table-payment`. Cloud only: no SQLite, outbox, local-node, sync, PA-52, or `QrPaymentPendingApply` test. No `StartQrTablePayment`. Bold adapter. `qrpay_` ignores amount. One started charge. Tender `qr`. D-44 pending. `to_clean` at zero. Unique `(tenant_id, payment_id)`. No QR-ordering, `/m`, or table-qr imports. Current or new ports. Threats N/A. Given/When/Then. `#imports` only. No `size:exception`.

### Suggested Work Units

`pnpm vitest run --project <name> <file>`.

|Unit|Goal|PR|Test|Harness|Rollback|
|---|---|---|---|---|---|
|1|Tender|PR1-tracker|cash-register:domain/payment.test.ts|pure|payment,shift,count|
|2|Charge|PR2←PR1|cash-register:domain/qr-payment.test.ts|pure|qr-payment.ts|
|3|Start|PR3←PR2|cash-register:start-qr-payment.test.ts|memory|start,ports|
|4|Confirm|PR4←PR3|cash-register:confirm-qr-payment.test.ts|memory|confirm|
|5|Apply|PR5←PR4|cash-register:apply-qr-payment.test.ts|memory|apply|
|6|Release|PR6←PR5|cash-register:apply-qr-payment.test.ts|memory|part,zero|
|7|Pending|PR7←PR6|cash-register:open-shift.test.ts|memory|drain|
|8|Closure|PR8←PR7|cash-register:charge-check.test.ts|memory|guard|
|9|Count|PR9←PR8|cash-register:submit-count.test.ts|memory|qrCop|
|10|Reconcile|PR10←PR9|cash-register:reconcile-qr-payments.test.ts|memory|diffs|
|11|Stale|PR11←PR10|cash-register:list-stale-qr-payments.test.ts|memory|900s|
|12|Postgres|PR12←PR11|cash-register:drizzle-qr-payment-repository.contract.test.ts|PGlite|0016|
|13|Bold|PR13←PR12|cash-register:bold-payment-gateway.test.ts|scripted|bold|
|14|Contract|PR14←PR13|api-cloud:test/contracts/qr-table-payment.test.ts|Nest-inject-no-listen|contracts|
|15|HTTP|PR15←PR14|api-cloud:test/http/qr-payment.controller.test.ts|Nest-inject-no-listen|webhook|
|16|Screens|PR16←PR15|api-cloud:test/http/qr-payment.controller.test.ts|portal,venue builds|`/d/$token`|

## 1. Domain

- [x] 1.1 RED `payment.test.ts`, `cash-shift.test.ts`, `cash-count.test.ts`: QR leaves `expectedCashCop` unchanged.
- [x] 1.2 GREEN `payment.ts`, `cash-shift.ts`, `cash-count.ts`. Method `qr`.
- [x] 1.3 RED `qr-payment.test.ts`: started is not `QrPaymentConfirmed`.
- [x] 1.4 GREEN `qr-payment.ts`. Includes `pending_application`.

## 2. Application

GREEN adds `#application/<folder>/*` and `entry-port.ts`.

- [x] 2.1 RED `start-qr-payment.test.ts`: 93500; amount ignored; `qrpay_`; one started; replaced tip; disabled refuses.
- [x] 2.2 GREEN start, ports, memory. Balance from `AccountGateway`.
- [x] 2.3 RED `confirm-qr-payment.test.ts`: twice one row; forged null; same reference.
- [x] 2.4 GREEN `confirm-qr-payment.ts`.
- [x] 2.5 RED `apply-qr-payment.test.ts`: `qr`, `tipCop`; card→`card`; wallets→`transfer`; down `pending_issuance`.
- [x] 2.6 GREEN apply through `IssueDocument`. No invoicing edits.
- [x] 2.7 RED apply: part stays occupied; `markPaid` at zero; snapshot kept.
- [x] 2.8 GREEN `SplitAccount.pay` and current `MarkAccountPaid`.
- [x] 2.9 RED `open-shift.test.ts`: pending until the next open applies once.
- [x] 2.10 GREEN `open-shift.ts`. D-44.
- [x] 2.11 RED `charge-check.test.ts`: second cashier closure rejected; two `payment_id`s allowed.
- [x] 2.12 GREEN `charge-check.ts`.
- [x] 2.13 RED `submit-count.test.ts`: cash 300000; QR 120000 vs the report.
- [x] 2.14 GREEN `qrCop` and `qrReportCop`.
- [x] 2.15 RED `reconcile-qr-payments.test.ts`: match clean; missing reference flagged.
- [x] 2.16 GREEN `reconcile-qr-payments.ts`.
- [x] 2.17 RED `list-stale-qr-payments.test.ts`: pending older than 900s. No scheduler.
- [x] 2.18 GREEN `list-stale-qr-payments.ts`.

## 3. Postgres

- [x] 3.1 RED contract: duplicate reference fails; other tenant hidden; unique `(tenant_id, payment_id)`.
- [x] 3.2 GREEN `0016_qr_table_payment.sql`, `schema.ts`, repo, ledger `qr`. Drop `sale_closures_one_check`.

## 4. HTTP

- [x] 4.1 RED `bold-payment-gateway.test.ts`: bad signature null; redirect; report rows.
- [x] 4.2 GREEN `bold-payment-gateway.ts`. Add `#adapters/bold/*`.
- [x] 4.3 RED `test/contracts/qr-table-payment.test.ts`: `{ tipCop, partId? }` drops `amount`. Unpublished.
- [x] 4.4 GREEN `qr-table-payment.ts`, `cash-register.ts`, `index.ts`.
- [x] 4.5 RED `qr-payment.controller.test.ts`: balance; ignored amount; one payment; raw body; no session.
- [x] 4.6 GREEN controllers and `application-module.ts`. No new pool or table-qr controller.

## 5. Screens

Skip `vitest.config.ts`.

- [x] 5.1 RED pay HTTP: part 2 remains; stale pending alerts; `qrCop` separate.
- [x] 5.2 GREEN `register-screen.tsx`, `table-payment-screen.tsx`, `router.tsx` `/d/$token` only. No `/m`.
