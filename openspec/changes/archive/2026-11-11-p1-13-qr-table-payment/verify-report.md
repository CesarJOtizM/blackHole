## Verification Report

**Change**: p1-13-qr-table-payment
**Version**: N/A
**Mode**: Standard
**strict_tdd**: false (`strict-tdd-verify.md` was not loaded)
**Persistence**: openspec (`openspec/config.yaml`) plus Engram `sdd/p1-13-qr-table-payment/verify-report` (project `blackhole`)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 32 |
| Tasks complete | 32 |
| Tasks incomplete | 0 |

Tasks 1.1–5.2 are checked in `tasks.md`. Proposal success criteria stay unchecked; they describe the pilot outcome and are not implementation tasks. `0016_invoicing_portal.sql` was not judged. PA-52 was not implemented.

### Build & Tests Execution
**Build**: ✅ Passed (`pnpm exec tsc -b shared/contracts --pretty false`, exit 0)

```text
pnpm exec tsc -b shared/contracts --pretty false
exit 0
```

Full `pnpm typecheck` was not run. The requested contracts build is clean.

**Tests**: ✅ 104 passed / ❌ 0 failed / ⚠️ 0 skipped

```text
pnpm exec vitest run --project cash-register contexts/cash-register/domain/qr-payment.test.ts contexts/cash-register/application/start-qr-payment/start-qr-payment.test.ts contexts/cash-register/application/confirm-qr-payment/confirm-qr-payment.test.ts contexts/cash-register/application/apply-qr-payment/apply-qr-payment.test.ts contexts/cash-register/application/list-stale-qr-payments/list-stale-qr-payments.test.ts contexts/cash-register/adapters/bold/bold-payment-gateway.test.ts contexts/cash-register/adapters/postgres/drizzle-qr-payment-repository.contract.test.ts
exit 0
Test Files  7 passed (7)
     Tests  23 passed (23)

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/qr-payment.controller.test.ts apps/api-cloud/test/contracts/qr-table-payment.test.ts apps/api-cloud/test/composition/bootstrap.test.ts
exit 0
Test Files  3 passed (3)
     Tests  8 passed (8)
```

Bootstrap passed on the first run. The ReportingFacts factory was not the cause of a failure, so `bootstrap.test.ts` was not re-run. `apps/api-cloud/src/composition/reporting-facts.ts` was not edited and was not judged.

```text
pnpm exec vitest run --config apps/customer-portal/vitest.config.ts apps/customer-portal/test/table-payment-screen.test.tsx
exit 0
Test Files  1 passed (1)
     Tests  1 passed (1)

pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/cash-register/register-screen.test.tsx
exit 0
Test Files  1 passed (1)
     Tests  3 passed (3)
```

Additional scenario tests, not in the requested command list, also passed:

```text
pnpm exec vitest run --project cash-register contexts/cash-register/domain/payment.test.ts contexts/cash-register/domain/cash-shift.test.ts contexts/cash-register/domain/cash-count.test.ts contexts/cash-register/application/open-shift/open-shift.test.ts contexts/cash-register/application/charge-check/charge-check.test.ts contexts/cash-register/application/submit-count/submit-count.test.ts contexts/cash-register/application/reconcile-qr-payments/reconcile-qr-payments.test.ts
exit 0
Test Files  7 passed (7)
     Tests  69 passed (69)
```

**Coverage**: ➖ Not available (threshold 0; no coverage provider in `openspec/config.yaml`)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Balance and Tip | View balance | `qr-payment.controller.test.ts` > given a table balance of 85000…; `table-payment-screen.test.tsx` renders a passed balance | ⚠️ PARTIAL |
| Balance and Tip | Split account | `start-qr-payment.test.ts` > each part keeps one started charge; `qr-payment.controller.test.ts` > part 2 stays payable; `table-payment-screen.test.tsx` > part 2 stays payable | ✅ COMPLIANT |
| Exact-Amount Charge | Charge started | `start-qr-payment.test.ts` > gateway is asked for 93500 with a qrpay_ reference | ✅ COMPLIANT |
| Exact-Amount Charge | Tampered amount | `start-qr-payment.test.ts` > tampered amount; `qr-table-payment.test.ts` > strict parsing drops amount; `qr-payment.controller.test.ts` > client amount ignored | ✅ COMPLIANT |
| Gateway Confirmation | Confirmed once | `confirm-qr-payment.test.ts` > confirms it twice; `qr-payment.controller.test.ts` > raw webhook arrives twice | ✅ COMPLIANT |
| Gateway Confirmation | Invalid signature | `confirm-qr-payment.test.ts` > forged signature; `bold-payment-gateway.test.ts` > forged signature; `qr-payment.controller.test.ts` > forged signature confirms nothing | ✅ COMPLIANT |
| Payment Application | Online site | `apply-qr-payment.test.ts` > tender is qr, invoice is card; `apply-qr-payment.test.ts` > markPaid frees the table | ⚠️ PARTIAL |
| Payment Application | Partial payment | `apply-qr-payment.test.ts` > table stays occupied; `qr-payment.controller.test.ts` > part 2 stays payable | ✅ COMPLIANT |
| Payment During an Outage | Paid during outage | `open-shift.test.ts` > pending qr payment applied once | ⚠️ PARTIAL |
| Payment During an Outage | Batch delivered twice | `confirm-qr-payment.test.ts` > one row; `open-shift.test.ts` > applied once, one shift payment | ⚠️ PARTIAL |
| Coexistence With Register Payments | Mixed payment | `apply-qr-payment.test.ts` > table stays occupied; `qr-payment.controller.test.ts` > remaining part 2 | ⚠️ PARTIAL |
| Coexistence With Register Payments | Balance changed after charge started | `apply-qr-payment.test.ts` > snapshot is kept and the table stays occupied | ✅ COMPLIANT |
| Gateway Reconciliation | Matching report | `reconcile-qr-payments.test.ts` > no difference appears | ✅ COMPLIANT |
| Gateway Reconciliation | Missing in report | `reconcile-qr-payments.test.ts` > that reference is flagged | ✅ COMPLIANT |
| QR Payment Method in the Shift | Cash count with QR payments | `submit-count.test.ts` > expected cash stays 300000 and qr is shown against the report; `cash-count.test.ts` > expectedCashCop stays 300000; `cash-shift.test.ts` > expectedCashCop stays 200000 | ✅ COMPLIANT |
| QR Payment Method in the Shift | Closed shift | `open-shift.test.ts` > closed shift stays unchanged; payment lands on the opened shift | ✅ COMPLIANT |
| QR Payment Pending Application | No open shift | `open-shift.test.ts` > status pending_application before the next open | ⚠️ PARTIAL |
| QR Payment Pending Application | Shift opens | `open-shift.test.ts` > applied once; expected cash unchanged; second open does not add another payment | ✅ COMPLIANT |

**Compliance summary**: 12/18 scenarios compliant, 6/18 partial, 0 failing, 0 untested

Partial scenarios still have a passing test for the cloud slice this change owns. The missing clauses are the portal tip choices, the hybrid node (PA-52), a cashier view of the remaining part, and a live staff alert.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Exact charge and `qrpay_` reference | ✅ Implemented | Server uses balance plus tip. Client amount is ignored. One started charge per account or part. |
| Signed confirmation, once | ✅ Implemented | `ConfirmQrPayment` and `BoldPaymentGateway` reject a bad signature and keep one row per reference. |
| Apply on an open shift | ✅ Implemented | Tender `qr`, tip apart, card→`card`, wallets→`transfer`, provider down → `pending_issuance`, part stays occupied, zero calls `markPaid`. |
| Closed shift and next open | ✅ Implemented | Late payment stays `pending_application` and `OpenShift` applies it once. `expectedCashCop` does not include QR. |
| Reconciliation and stale list | ✅ Implemented | Match is clean; a missing reference is flagged. Pending rows older than 900s are listed. No scheduler. |
| Postgres uniqueness | ✅ Implemented | `0016_qr_table_payment.sql` drops `sale_closures_one_check` and adds `sale_closures_one_payment` on `(tenant_id, payment_id)`. Contract test rejects a repeated `payment_id` and hides the other tenant. |
| Unpublished pending-apply contract | ✅ Implemented | `index.ts` exports `startQrPaymentCommand` only. `qrPaymentPendingApply` stays in the module and is absent from `@blackhole/contracts`. |
| Live Nest wiring | ⚠️ Partial | `ApplicationModule.register` builds `ClosedQrGateway`, `MemoryQrPayments`, `ClosedQrTableAccess`, `DisabledQrPayments`, `EmptySplits`, and `PendingQrIssuer`. `QrPaymentDesk` has no provider. |
| Portal and register screens | ⚠️ Partial | `/d/$token` exists and `/m/$token` stays the order route. Both screens render fixed figures. The pay screen has no tip choices. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cloud-only; no local-node, SQLite, outbox, or PA-52 | ✅ Yes | No node gateway client and no `QrPaymentPendingApply` acceptance test. |
| `PaymentGateway` port; Bold is one adapter | ⚠️ Partial | Bold is tested behind `#adapters/bold/*`. It is not a public export of `@blackhole/cash-register`. Composition uses `ClosedQrGateway`, whose `verifyWebhook` always returns null. |
| Payment exists only after a valid webhook | ✅ Yes | Use case and HTTP tests. Live gateway cannot confirm. |
| Snapshot amount, `qrpay_`, one started charge | ✅ Yes | Covered by start, contract, and HTTP tests. |
| Tender `qr`; cash expected unchanged; `qrCop` vs report | ⚠️ Partial | Domain, submit-count, and the contract view do this. `CashCountController` does not expose `qrCop`. The register screen prints `QR $120.000` and `Efectivo esperado $200.000` as constants. |
| `pending_application` until the next open shift (D-44) | ✅ Yes | `open-shift.test.ts`. |
| Release the table only at zero | ✅ Yes | Part payment stays occupied. Zero calls `markPaid`. |
| Invoice mapping; down leaves `pending_issuance` | ⚠️ Partial | Apply tests cover card, transfer, and `pending_issuance`. Composition `PendingQrIssuer` always returns `pending_issuance`. |
| Unique `(tenant_id, payment_id)` | ✅ Yes | Migration `0016_qr_table_payment.sql` and the Postgres contract. This is the intended key, not a defect. |
| `ListStaleQrPayments` over 900s, no scheduler | ⚠️ Partial | Use case test passes. Live `GET /d/:token/stale` and `GET /d/:token/count` return empty or zeros because `desk` is optional and unprovided. The HTTP test injects its own desk. |
| `qr_payment_enabled` false until a gateway is configured | ✅ Yes | `DisabledQrPayments.enabled()` returns false. There is no configured Bold branch beside that default. |
| Drizzle `qr_payments` repository | ⚠️ Partial | Repository and migration exist and the contract passed. The Nest module keeps `MemoryQrPayments`. |
| Screens: pay on `/d/$token`; register shows QR and a pending alert | ⚠️ Partial | Routes match. `router.tsx` hardcodes balance `85000` and parts. `RegisterScreen` hardcodes `qrpay_stale`, QR `120000`, and expected cash `200000`. |
| Threat matrix N/A; bad signature writes nothing | ✅ Yes | Forged webhook tests leave the charge started. |

### Issues Found
**CRITICAL**: None

**WARNING**:
- Composition gateway is a closed local double. `BoldPaymentGateway` is only reachable through the package-private `#adapters/bold/*` import, so `ApplicationModule` cannot wire it. `ClosedQrGateway.verifyWebhook` always returns null, so a live webhook never confirms a payment. `ClosedQrTableAccess.resolve` always returns null, so live `GET /d/:token` is `UnknownTable`. `DisabledQrPayments` always refuses a start. `PendingQrIssuer` always reports `pending_issuance`. `EmptySplits` never finds a part. The store is in-memory, not `DrizzleQrPaymentRepository`.
- `QrPaymentDesk` has no provider. With `desk === undefined`, `listStale` returns `[]` and `readCount` returns `{ countedCashCop: 0, expectedCashCop: 0, qrCop: 0 }`. The passing HTTP stale/count test supplies a desk object inside the test.
- Register and payment screens show fixed demo figures. `RegisterScreen` always renders `qrpay_stale`, `QR $120.000`, and `Efectivo esperado $200.000` (opening copy also uses `200000`). `/d/$token` always passes balance `85000`, paid `part_1` at `45000`, and unpaid `part_2` at `40000`. The pay screen does not offer a tip, including no tip. Those tests assert the literals.
- Spec scenarios for a connected hybrid node, payment during an outage, and a batch delivered twice are only partly covered. Design and tasks leave that path on PA-52. Cloud confirm-once and apply-on-next-open are tested. There is no offline-reconnect test and no cashier test that opening the account shows only the unpaid part. The no-open-shift staff alert is a static label, not an effect of the pending payment.
- `cash-count.controller.ts` does not add `qrCop` / `qrReportCop`, although the design file list names that controller. The count fields exist on `cashCountView` and on `SubmitCount`.

**SUGGESTION**:
- Export a Bold composition factory (or keep Bold inside api-cloud behind the port) and select it only when the site flag is on.
- Provide `QrPaymentDesk` from `ListStaleQrPayments` and the shift count, and point the register and portal screens at those routes.
- Add tip choices, including no tip, on `TablePaymentScreen`.

### Verdict
PASS WITH WARNINGS
All 32 tasks are checked and every requested test passed, including contracts typecheck. Twelve scenarios are compliant in the cloud use cases. Live composition and the two screens do not yet carry a real Bold charge, a stale desk, or live figures, and PA-52 stays deferred.
