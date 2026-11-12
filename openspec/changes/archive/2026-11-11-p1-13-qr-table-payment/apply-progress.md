# Apply progress: p1-13-qr-table-payment

Status: sections 1–5 done (1.1–1.4, 2.1–2.18, 3.1–3.2, 4.1–4.6, 5.1–5.2). The existing QR payment controller is registered. No commit.
Mode: standard (`strict_tdd: false`). Each assigned pair still ran RED then GREEN. `strict-tdd.md` was not loaded.
Delivery: the forecast says auto-chain, one pair per PR. The orchestrator assigned sections 1–2 and forbade a commit. No commit was created.

## Completed

- [x] 1.1–1.4 QR tender, unchanged expected cash, started charge distinct from confirmed, `pending_application`
- [x] 2.1–2.4 `StartQrPayment` and `ConfirmQrPayment`
- [x] 2.5–2.8 `ApplyQrPayment`, invoice method mapping, part occupied, `markPaid` only at zero
- [x] 2.9–2.10 next open shift drains `pending_application` once (D-44)
- [x] 2.11–2.12 second cashier closure rejected; two payment ids allowed
- [x] 2.13–2.14 blind count shows `qrCop` against `qrReportCop`
- [x] 2.15–2.16 reconcile: match is clean; missing reference is flagged
- [x] 2.17–2.18 stale list: `pending_application` older than 900s; no scheduler
- [x] 3.1–3.2 Postgres `qr_payments`, unique `(tenant_id, payment_id)`, ledger method `qr`
- [x] 4.1–4.2 Bold adapter: bad signature is null, redirect is built, report rows come from the port
- [x] 4.3–4.4 Published start body is `{ tipCop, partId? }`. `amount` and `price` are rejected. `cashCountView` accepts optional `qrCop` and `qrReportCop`. `QrPaymentPendingApply` stays off the barrel.
- [x] 4.5 HTTP controller test: server balance, client amount ignored, one payment, raw body, no session. The controller file is in place. 4.6 stays open because `application-module.ts` is not wired.
- [x] 4.6 `QrPaymentController` is registered beside the existing controllers. One memory payment store and one closed gateway are shared by start, confirm, and apply. No new pool and no second table-qr controller.
- [x] 5.1–5.2 Part 2 stays payable and the table stays occupied. A pending payment older than 900s is listed. `qrCop` stays off expected cash. `/d/$token` shows the payment screen with billing data. `/m/$token` and `/f/$link` stay.

## Skipped

- Task 4.6 and section 5 were open at the end of the HTTP-controller slice. They are done in the registration and screens section below.
- `0016_qr_table_payment.sql` and every SQL file
- `apps/api-cloud/src/composition/application-module.ts`
- `apps/venue-app/src/cash-register/register-screen.tsx`
- `apps/customer-portal`
- `contexts/invoicing`
- `StartQrTablePayment`, `QrPaymentPendingApply`, and the PA-52 test
- SQLite, outbox, local-node, and sync

## Work unit evidence

| Unit | Focused test | Result | Runtime harness | Rollback |
|---|---|---|---|---|
| 1 Tender | `pnpm vitest run --project cash-register contexts/cash-register/domain/payment.test.ts contexts/cash-register/domain/cash-shift.test.ts contexts/cash-register/domain/cash-count.test.ts` | RED: `qr` rejected as a tender and `qrCop` absent. GREEN: 3 files, 24 passed | N/A. Pure domain. | `payment.ts`, `cash-shift.ts`, `cash-count.ts` and their tests |
| 2 Charge | `pnpm vitest run --project cash-register contexts/cash-register/domain/qr-payment.test.ts` | RED: cannot find `#domain/qr-payment.js`. GREEN: 1 passed | N/A. Pure domain. | `qr-payment.ts` and its test |
| 3 Start | `pnpm vitest run --project cash-register contexts/cash-register/application/start-qr-payment/start-qr-payment.test.ts` | RED: missing specifier. GREEN: 4 passed | Memory accounts, splits, gateway, and repository. | start folder, QR ports, scripted gateway, memory repository |
| 4 Confirm | `pnpm vitest run --project cash-register contexts/cash-register/application/confirm-qr-payment/confirm-qr-payment.test.ts` | RED: missing specifier. GREEN: 3 passed | Memory repository and scripted gateway. | confirm folder |
| 5–6 Apply and release | `pnpm vitest run --project cash-register contexts/cash-register/application/apply-qr-payment/apply-qr-payment.test.ts` | RED invoice: missing specifier. GREEN invoice: 5 passed. RED release: part stayed unpaid and `markPaid` was 0. GREEN release: 8 passed | Memory shift, scripted issuer, accounts, and split. | apply folder |
| 7 Pending | `pnpm vitest run --project cash-register contexts/cash-register/application/open-shift/open-shift.test.ts` | RED: opened shift had no QR payment. GREEN: 6 passed | Memory register and `ApplyQrPayment`. | `open-shift.ts` and its test |
| 8 Closure | `pnpm vitest run --project cash-register contexts/cash-register/application/charge-check/charge-check.test.ts` | RED: 1 failed \| 24 passed (25). Second closure resolved. GREEN: 1 file, 25 passed. Start 18:39:54. Duration 205ms. Post-Biome with the stale file: 26 passed. Start 18:46:27 | Memory ledger. | `charge-check.ts`, its test, `AccountAlreadyCharged` export |
| 9 Count | `pnpm vitest run --project cash-register contexts/cash-register/application/submit-count/submit-count.test.ts` | RED: 1 failed \| 11 passed (12). `qrCop` was undefined, expected 120000. Start 18:41:45. GREEN: 12 passed. Start 18:42:27. Duration 336ms | Memory shift and scripted gateway report. | `submit-count.ts` and its test |
| 10 Reconcile | `pnpm vitest run --project cash-register contexts/cash-register/application/reconcile-qr-payments/reconcile-qr-payments.test.ts` | RED: Cannot find module `#application/reconcile-qr-payments/reconcile-qr-payments.js`, 0 tests. Start 18:43:29. GREEN: 2 passed. Start 18:44:16. Duration 247ms. Post-Biome recheck: 2 passed. Start 18:44:57 | Memory repository and scripted gateway. | reconcile folder, import map, entry-port export |
| 11 Stale | `pnpm vitest run --project cash-register contexts/cash-register/application/list-stale-qr-payments/list-stale-qr-payments.test.ts` | RED: Cannot find module `#application/list-stale-qr-payments/list-stale-qr-payments.js`, 0 tests. Start 18:44:57. GREEN: 1 passed. Start 18:45:36. Duration 987ms. Post-Biome with charge-check: 26 passed. Start 18:46:27 | Memory repository and a fixed clock. | stale folder, import map, entry-port export |

## Exact commands

```text
pnpm vitest run --project cash-register contexts/cash-register/domain/payment.test.ts contexts/cash-register/domain/cash-shift.test.ts contexts/cash-register/domain/cash-count.test.ts
GREEN: Test Files 3 passed, Tests 24 passed

pnpm vitest run --project cash-register contexts/cash-register/domain/qr-payment.test.ts
GREEN: Tests 1 passed

pnpm vitest run --project cash-register contexts/cash-register/application/start-qr-payment/start-qr-payment.test.ts
GREEN: Tests 4 passed

pnpm vitest run --project cash-register contexts/cash-register/application/confirm-qr-payment/confirm-qr-payment.test.ts
GREEN: Tests 3 passed

pnpm vitest run --project cash-register contexts/cash-register/application/apply-qr-payment/apply-qr-payment.test.ts
GREEN: Tests 8 passed

pnpm vitest run --project cash-register contexts/cash-register/application/open-shift/open-shift.test.ts
GREEN: Tests 6 passed

pnpm vitest run --project cash-register contexts/cash-register/application/charge-check/charge-check.test.ts
RED: Test Files 1 failed, Tests 1 failed | 24 passed (25)
GREEN: Test Files 1 passed, Tests 25 passed. Start 18:39:54. Duration 205ms

pnpm vitest run --project cash-register contexts/cash-register/application/submit-count/submit-count.test.ts
RED: Test Files 1 failed, Tests 1 failed | 11 passed (12). Start 18:41:45
AssertionError: expected undefined to be 120000 (submitted.qrCop)
GREEN: Test Files 1 passed, Tests 12 passed. Start 18:42:27. Duration 336ms

pnpm vitest run --project cash-register contexts/cash-register/application/reconcile-qr-payments/reconcile-qr-payments.test.ts
RED: Cannot find module '#application/reconcile-qr-payments/reconcile-qr-payments.js', 0 tests. Start 18:43:29
GREEN: Test Files 1 passed, Tests 2 passed. Start 18:44:16. Duration 247ms

pnpm vitest run --project cash-register contexts/cash-register/application/list-stale-qr-payments/list-stale-qr-payments.test.ts
RED: Cannot find module '#application/list-stale-qr-payments/list-stale-qr-payments.js', 0 tests. Start 18:44:57
GREEN: Test Files 1 passed, Tests 1 passed. Start 18:45:36. Duration 987ms

pnpm vitest run --project cash-register contexts/cash-register/application/list-stale-qr-payments/list-stale-qr-payments.test.ts contexts/cash-register/application/charge-check/charge-check.test.ts
Post-Biome: Test Files 2 passed, Tests 26 passed. Start 18:46:27. Duration 227ms

pnpm vitest run --project cash-register contexts/cash-register/domain/payment.test.ts contexts/cash-register/domain/cash-shift.test.ts contexts/cash-register/domain/cash-count.test.ts contexts/cash-register/domain/qr-payment.test.ts contexts/cash-register/application/start-qr-payment/start-qr-payment.test.ts contexts/cash-register/application/confirm-qr-payment/confirm-qr-payment.test.ts contexts/cash-register/application/apply-qr-payment/apply-qr-payment.test.ts contexts/cash-register/application/open-shift/open-shift.test.ts contexts/cash-register/application/charge-check/charge-check.test.ts contexts/cash-register/application/submit-count/submit-count.test.ts contexts/cash-register/application/reconcile-qr-payments/reconcile-qr-payments.test.ts contexts/cash-register/application/list-stale-qr-payments/list-stale-qr-payments.test.ts
Slice recheck: Test Files 12 passed, Tests 86 passed. Start 18:47:00. Duration 465ms
```

## Deviations

- `ConfirmQrPayment` does not call `ApplyQrPayment`. Confirmation only stores the confirmed row. Section 4 wires the sequence after `verifyWebhook`.
- Apply calls `QrInvoiceIssuer`, whose `execute` matches `IssueDocument`. `@blackhole/invoicing` is not a cash-register dependency, and `contexts/invoicing` was not edited.
- `ChargeLedger` did not gain a required `findByCheck`. `ChargeCheck` calls it only when the ledger object has that method, so `application-module.ts` still typechecks. The unit-test ledger implements it and the second closure is rejected there. The composition `MemoryChargeLedger` does not, so the HTTP path will not reject a second cashier closure until section 4 adds the method.
- Reconciliation compares confirmed, `pending_application`, and `applied` rows with the gateway report. A started charge is ignored. A report row with no confirmed payment is not flagged. There is no shift or day filter because the repository has no time query.
- `SubmitCount` takes an optional gateway. Readings omit `qrCop` and `qrReportCop` when they were not submitted, so existing `toEqual` readings stay unchanged.
- `ListStaleQrPayments` returns `pending_application` rows whose age is strictly greater than 900 seconds. A row aged exactly 900 seconds stays off the list. There is no scheduler.
- `0016_qr_table_payment.sql` drops `sale_closures_one_check` and adds `sale_closures_one_payment` on `(tenant_id, payment_id)`. Two payment ids on one account are stored. `ChargeCheck` was not changed; it still rejects a second cashier closure in the use case. A duplicate `qrpay_` reference throws. `qr_payments` allows status, instrument, and voided updates so a started charge can be confirmed or replaced.

## Postgres

| Unit | Focused test | Result | Runtime harness | Rollback |
|---|---|---|---|---|
| 12 Postgres | `pnpm vitest run --project cash-register contexts/cash-register/adapters/postgres/drizzle-qr-payment-repository.contract.test.ts` | RED: Cannot find module `#adapters/postgres/drizzle-qr-payment-repository.js`, 0 tests. Start 18:52:35. GREEN: Test Files 1 passed, Tests 3 passed. Start 18:54:16. Duration 3.53s. Post-Biome with the ledger contract: Test Files 2 passed, Tests 13 passed. Start 18:55:18. Duration 12.45s | PGlite. Migrations `0010_cash_register.sql`, `0015_tips.sql`, `0016_qr_table_payment.sql`. | `0016_qr_table_payment.sql`, `schema.ts`, `drizzle-qr-payment-repository.ts`, ledger `qr`, package export |

```text
pnpm vitest run --project cash-register contexts/cash-register/adapters/postgres/drizzle-qr-payment-repository.contract.test.ts
RED: Cannot find module '#adapters/postgres/drizzle-qr-payment-repository.js', 0 tests. Start 18:52:35
GREEN: Test Files 1 passed, Tests 3 passed. Start 18:54:16. Duration 3.53s

pnpm vitest run --project cash-register contexts/cash-register/adapters/postgres/drizzle-qr-payment-repository.contract.test.ts contexts/cash-register/adapters/postgres/drizzle-cash-register-ledger.contract.test.ts
Post-Biome: Test Files 2 passed, Tests 13 passed. Start 18:55:18. Duration 12.45s
```

## Bold

| Unit | Focused test | Result | Runtime harness | Rollback |
|---|---|---|---|---|
| 13 Bold | `pnpm vitest run --project cash-register contexts/cash-register/adapters/bold/bold-payment-gateway.test.ts` | RED: Missing `#adapters/bold/bold-payment-gateway.js` specifier, 0 tests. Start 18:58:06. GREEN: Test Files 1 passed, Tests 3 passed. Start 18:58:48. Duration 235ms. Post-Biome: Test Files 1 passed, Tests 3 passed. Start 18:59:21. Duration 208ms | Scripted report client. HMAC-SHA256 over the raw body. No network and no Factus. | `adapters/bold/`, `#adapters/bold/*` import |

```text
pnpm vitest run --project cash-register contexts/cash-register/adapters/bold/bold-payment-gateway.test.ts
RED: Missing "#adapters/bold/bold-payment-gateway.js" specifier in "@blackhole/cash-register" package, 0 tests. Start 18:58:06
GREEN: Test Files 1 passed, Tests 3 passed. Start 18:58:48. Duration 235ms
Post-Biome: Test Files 1 passed, Tests 3 passed. Start 18:59:21. Duration 208ms
```

`BoldPaymentGateway` implements `PaymentGateway`. A forged signature returns null. A matching signature returns the verified body and does not confirm a payment. `startCharge` builds `https://checkout.bold.co/pay/qrpay_…?amount=`. `report` returns the rows from the injected client. References stay `qrpay_`.

## Contract

| Unit | Focused test | Result | Runtime harness | Rollback |
|---|---|---|---|---|
| 14 Contract | `pnpm vitest run --project api-cloud test/contracts/qr-table-payment.test.ts` | RED: `startQrPaymentCommand` undefined, 1 failed. Start 19:01:56. Duration 324ms. GREEN: Test Files 1 passed, Tests 1 passed. Start 19:02:33. Duration 344ms. Post-Biome: Test Files 1 passed, Tests 1 passed. Start 19:03:18. Duration 340ms | Zod safeParse. No HTTP and no database. | `shared/contracts/qr-table-payment.ts`, `cash-register.ts` count fields, one `index.ts` export, the contract test |

```text
pnpm vitest run --project api-cloud test/contracts/qr-table-payment.test.ts
RED: TypeError Cannot read properties of undefined (reading 'safeParse'), Tests 1 failed (1). Start 19:01:56. Duration 324ms
GREEN: Test Files 1 passed, Tests 1 passed. Start 19:02:33. Duration 344ms
Post-Biome: Test Files 1 passed, Tests 1 passed. Start 19:03:18. Duration 340ms
```

`startQrPaymentCommand` is `{ tipCop, partId? }` and `.strict()`. `amount`, `amountCop`, and `price` fail. `cashCountView` keeps existing reads and accepts optional `qrCop` and `qrReportCop`. `qrPaymentPendingApply` exists in the module file and is not exported from `shared/contracts/index.ts`. Reporting, qr-table-ordering, and invoicing-portal exports stayed. No controller was registered.

## HTTP controller

| Unit | Focused test | Result | Runtime harness | Rollback |
|---|---|---|---|---|
| 15 HTTP | `pnpm vitest run --project api-cloud test/http/qr-payment.controller.test.ts` | RED: Cannot find module `#src/http/qr-payment.controller.js`, 0 tests. Start 19:14:11. Duration 296ms. GREEN: Test Files 1 passed, Tests 2 passed. Start 19:15:25. Duration 735ms. Post-Biome: Test Files 1 passed, Tests 2 passed. Start 19:15:52. Duration 715ms | Direct `new QrPaymentController(...)`. Memory payments, scripted gateway, no listen, no pool. | `qr-payment.controller.ts` and its test |

```text
pnpm vitest run --project api-cloud test/http/qr-payment.controller.test.ts
RED: Cannot find module '#src/http/qr-payment.controller.js', 0 tests. Start 19:14:11. Duration 296ms
GREEN: Test Files 1 passed, Tests 2 passed. Start 19:15:25. Duration 735ms
Post-Biome: Test Files 1 passed, Tests 2 passed. Start 19:15:52. Duration 715ms
```

`readBalance` returns the server balance of 85,000. A client `amount` of 10,000 is dropped and the gateway is asked for 93,500 under `qrpay_`. The row stays `started` until `verifyWebhook`. A forged signature confirms nothing. The same raw body posted twice leaves one `pending_application` payment because no shift is open. `receiveWebhook` takes the raw body and the signature, and no session. At the end of this slice the controller was not yet registered. Registration is in the next section.

## Registration and screens

| Unit | Focused test | Result | Runtime harness | Rollback |
|---|---|---|---|---|
| 16 Register | `pnpm vitest run --project api-cloud test/composition/bootstrap.test.ts` | Included with the HTTP re-run below. Providers for `QrTableAccess`, `StartQrPayment`, `ConfirmQrPayment`, and `ApplyQrPayment` match the module. | Nest module metadata. No listen and no pool. | `application-module.ts`, `qr-table-payment.ts`, `bootstrap.test.ts` |
| 17 Pay HTTP | `pnpm vitest run --project api-cloud test/http/qr-payment.controller.test.ts` | RED: 2 failed \| 2 passed (4). Start 19:23:26. Duration 763ms. GREEN: Tests 4 passed (4). Start 19:24:35. Duration 775ms. | Direct controller. Part apply uses an overwriting register store. Desk is injected only in these cases. | `qr-payment.controller.ts` and its test |
| 18 Screens | customer-portal `test/table-payment-screen.test.tsx`; venue-app `test/cash-register/register-screen.test.tsx` | RED portal: 0 tests, missing module. Start 19:25:35. Duration 1.49s. RED register: 1 failed \| 2 passed (3). Start 19:25:35. Duration 1.67s. GREEN portal: Tests 1 passed (1). Start 19:28:16. Duration 1.89s. GREEN register: Tests 3 passed (3). Start 19:28:17. Duration 1.76s. | jsdom. Static split and static stale line. | `table-payment-screen.tsx`, `router.tsx`, `register-screen.tsx`, both tests |

```text
pnpm vitest run --project api-cloud test/http/qr-payment.controller.test.ts
RED: 2 failed | 2 passed (4). Start 19:23:26. Duration 763ms
GREEN: Tests 4 passed (4). Start 19:24:35. Duration 775ms

pnpm exec vitest run --config apps/customer-portal/vitest.config.ts test/table-payment-screen.test.tsx
RED: 0 tests, failed to resolve #src/table-payment/table-payment-screen.js. Start 19:25:35. Duration 1.49s
GREEN: Test Files 1 passed, Tests 1 passed (1). Start 19:28:16. Duration 1.89s

pnpm exec vitest run --config apps/venue-app/vitest.config.ts test/cash-register/register-screen.test.tsx
RED: 1 failed | 2 passed (3). Start 19:25:35. Duration 1.67s
GREEN: Test Files 1 passed, Tests 3 passed (3). Start 19:28:17. Duration 1.76s

pnpm vitest run --project api-cloud test/http/qr-payment.controller.test.ts test/composition/bootstrap.test.ts
Post-Biome: Test Files 2 passed, Tests 7 passed (7). Start 19:28:48. Duration 2.98s

pnpm exec vitest run --config apps/customer-portal/vitest.config.ts test/table-payment-screen.test.tsx test/portal-screens.test.tsx test/table-order-menu.test.tsx
Post-Biome: Test Files 3 passed, Tests 8 passed (8). Start 19:28:49. Duration 2.28s

pnpm exec vitest run --config apps/venue-app/vitest.config.ts test/cash-register/register-screen.test.tsx
Post-Biome: Test Files 1 passed, Tests 3 passed (3). Start 19:28:49. Duration 2.00s
```

`QrPaymentController` is in the controllers array after `CashCountController`. `PortalController`, `ReinvoiceController`, `TableQrController`, `ReadSiteReportController`, and `PreBillLink` stayed. `main.ts` gained no pool. One `MemoryQrPayments` and one `ClosedQrGateway` are closed over by the three factories. The gateway stays closed because Bold is not a public cash-register export. `QrPaymentDesk` is optional and has no provider, so the production stale and count routes return an empty list and zeros. The part-2 and stale proofs inject the desk in the HTTP test. `/d/$token` renders `TablePaymentScreen` and `BillingDataScreen`. `/m/$token` and `/f/$link` stayed. The register still shows «Datos recibidos», plus a static `qrpay_stale` status, `QR $120.000`, and expected cash `$200.000`. No commit.


