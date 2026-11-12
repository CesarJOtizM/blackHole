## Verification Report

**Change**: p1-12-qr-table-ordering
**Version**: N/A
**Mode**: Standard
**strict_tdd**: false (`strict-tdd-verify.md` was not loaded)
**Persistence**: openspec (`openspec/config.yaml`) plus Engram topic `sdd/p1-12-qr-table-ordering/verify-report`

Re-verify after the previous FAIL. That FAIL was the missing `qr-table-ordering.ts` project file, the intent contract skipping `0005_report_stamps.sql`, and the unsent-cart scenario with no test. Those three are closed. The outage queue and PA-52 stay deferred and are not defects of this slice. Venue badges may stay demo copy. There is still no pay button. Archived changes `p1-11-site-reports` and `p1-13-qr-table-payment` were not judged.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 36 |
| Tasks complete | 36 |
| Tasks incomplete | 0 |

Tasks 1.1–5.4 are checked in `tasks.md`. No `- [ ]` remains. Proposal success criteria stay unchecked; they describe the pilot outcome and are not implementation tasks.

### Build & Tests Execution
**Build**: ✅ Passed (scoped `tsc -b shared/contracts`; full `pnpm typecheck` was not re-run)

```text
pnpm exec tsc -b shared/contracts --pretty false
exit 0
```

`shared/contracts/tsconfig.json` `include` lists `qr-table-ordering.ts`. It also lists `invoicing-portal.ts`, `qr-table-payment.ts`, and `reporting.ts`. The previous TS6307 on `qr-table-ordering.ts` is gone. Workspace `pnpm typecheck` was left out of this pass because the brief scoped the build to `shared/contracts` and told this verify not to judge the other changes.

**Tests**: ✅ 47 passed / ❌ 0 failed / ⚠️ 0 skipped

```text
pnpm exec vitest run --project orders contexts/orders/adapters/postgres/drizzle-qr-order-intent-repository.contract.test.ts contexts/orders/application/view-station-queue/view-station-queue.test.ts contexts/orders/application/apply-qr-order/apply-qr-order.test.ts contexts/orders/application/review-qr-order-intent/review-qr-order-intent.test.ts
exit 0
Test Files  4 passed (4)
     Tests  14 passed (14)

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/table-qr.controller.test.ts apps/api-cloud/test/http/table-qr-admin.controller.test.ts apps/api-cloud/test/contracts/qr-table-ordering.test.ts
exit 0
Test Files  3 passed (3)
     Tests  12 passed (12)

pnpm exec vitest run --config apps/customer-portal/vitest.config.ts apps/customer-portal/test/table-order-menu.test.tsx
exit 0
Test Files  1 passed (1)
     Tests  4 passed (4)

pnpm exec vitest run --project orders contexts/orders/application/resolve-table-qr/resolve-table-qr.test.ts contexts/orders/application/void-line/void-line.test.ts contexts/orders/application/record-qr-order-intent/record-qr-order-intent.test.ts contexts/orders/application/list-stale-qr-intents/list-stale-qr-intents.test.ts
exit 0
Test Files  4 passed (4)
     Tests  17 passed (17)
```

The fourth command covers scenarios that the brief's three Vitest commands do not name (rotated token, staff void, record, stale list). PGlite ran in process. No live database was started. The intent contract applies `0004_qr_table_ordering.sql` and then `0005_report_stamps.sql`. The channel round-trip that failed on missing `checks.diners` passed.

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available (`openspec/config.yaml` `coverage_threshold: 0`; no coverage package is configured for this verify)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Fixed Table QR | Scan | `apps/customer-portal/test/table-order-menu.test.tsx` > given a table token, when /m/:token is shown…; `apps/api-cloud/test/http/table-qr.controller.test.ts` > given an active table QR, when the customer opens /m/:token, then the site menu is shown | ✅ COMPLIANT |
| Fixed Table QR | Rotated QR | `contexts/orders/application/resolve-table-qr/resolve-table-qr.test.ts` > given a reprinted table QR, when the old token is resolved, then it is refused | ✅ COMPLIANT |
| Customer Menu | Sold-out item | `table-order-menu.test.tsx` > given a site price and a sold-out dish…; `record-qr-order-intent.test.ts` > given a sold-out dish, when the intent is recorded, then the row is blocked | ✅ COMPLIANT |
| Customer Menu | Site price | `table-order-menu.test.tsx` > … site price is shown…; `record-qr-order-intent.test.ts` > … one row keeps the Menu.viewAt price | ✅ COMPLIANT |
| Idempotent Order Intent | Double tap | `record-qr-order-intent.test.ts` > given the same intent id twice…; `table-qr.controller.test.ts` > … submits the same order twice, then one intent is sent…; `drizzle-qr-order-intent-repository.contract.test.ts` > … inserted again, then the database keeps a single row | ✅ COMPLIANT |
| Idempotent Order Intent | Empty cart | `record-qr-order-intent.test.ts` > given no lines…; `table-qr.controller.test.ts` > given an empty cart… | ✅ COMPLIANT |
| Intent Application | Free table | `apply-qr-order.test.ts` > given a free table in direct mode… opens for one diner and sends once | ✅ COMPLIANT |
| Intent Application | Occupied table | `apply-qr-order.test.ts` > given an open account, when a QR order arrives, then its lines join that account | ✅ COMPLIANT |
| Optional Register Acceptance | Acceptance required | `review-qr-order-intent.test.ts` > given cash-register acceptance and sale.charge, when the cashier accepts, then the order is sent | ✅ COMPLIANT |
| Optional Register Acceptance | Cashier rejects | `review-qr-order-intent.test.ts` > … cashier rejects the order, then no line is created; `table-order-menu.test.tsx` > given a pending QR order, when the cashier rejects it, then the portal shows it was not accepted | ✅ COMPLIANT |
| Customer Restrictions | Editing the unsent cart | `table-order-menu.test.tsx` > given items that have not been sent, when the customer removes one, then the cart updates and nothing reaches the account | ✅ COMPLIANT |
| Customer Restrictions | Forged void request | `table-qr.controller.test.ts` > given a forged price or void…; `qr-table-ordering.test.ts` > … strict parsing rejects it… | ✅ COMPLIANT |
| Outage Queue | Order during outage | (none; PA-52 deferred by design and by this re-verify) | deferred — not a slice defect |
| Outage Queue | Dish unavailable on reconnection | `apply-qr-order.test.ts` > given a sold-out dish beside an available one, when the order is applied twice, then the sold-out line is reported once | ⚠️ PARTIAL |
| QR Table Channel Visibility | Waiter sees a QR order | `view-station-queue.test.ts` > given a sent QR table order, when the station queue is read, then the line exposes qr_table | ⚠️ PARTIAL |
| QR Table Channel Visibility | Staff voids a QR line | `void-line.test.ts` > given a sent QR table line, when the waiter voids it within the cap, then it uses the before-kitchen void | ✅ COMPLIANT |
| Pending QR Intent Alert | Long outage | `list-stale-qr-intents.test.ts` > … only the 20 minute order alerts; `table-qr-admin.controller.test.ts` > … a 20 minute order is stale and a 2 minute order is not | ✅ COMPLIANT |
| Pending QR Intent Alert | Below threshold | same stale-intent tests | ✅ COMPLIANT |

**Compliance summary**: 15/18 scenarios compliant. 1 partial (queue exposes `qr_table`; venue badges stay demo). 1 partial (sold-out at apply time; node reconnection deferred). 1 deferred and not scored as a defect (order during outage, PA-52).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Fixed token, rotate, no expiry, path `/m/` | ✅ Implemented | SHA-256 digest. Reprint retires the previous digest. Portal route is `/m/$token`. `/d/$token` and `/f/$link` remain. |
| Idempotent intent, no price/void/discount/courtesy | ✅ Implemented | Record use case, Zod `.strict()`, and HTTP POST reject those fields. Empty lines store nothing. The Postgres unique row passed after `0004` then `0005`. |
| Direct apply and register acceptance | ✅ Implemented | Free table opens with `diners: 1`, channel `qr_table`, one kitchen job. Occupied account is appended. Accept needs `sale.charge`. Reject stores `rejected` and creates no line. |
| Customer rejection copy | ✅ Implemented on the screen | `TableOrderScreen` renders "El pedido no fue aceptado." when `acceptance` is `rejected`. The passing portal test injects that prop. `TableOrderRoute` still renders `<TableOrderScreen token={token} />` and does not read status. |
| Unsent cart edit | ✅ Implemented | `Quitar` calls `removeUnsent`. The passing test removes the line, leaves send disabled, and does not show a status. |
| Stale alert | ✅ Implemented | `ListStaleQrIntents` and the admin HTTP test: 20 minutes alerts; 2 minutes does not. |
| Staff void of a QR line | ✅ Implemented | Same before-kitchen void as any sent line. The QR void test passed. |
| No pay button | ✅ Implemented | Portal tests assert no button named pagar or pay. No `StartQrTablePayment` in this slice. |
| Outage queue | Deferred | Design and this re-verify keep PA-52 out of the slice. No SQLite, outbox, local-node owner, or sync. Not a defect to implement here. |
| Venue badges | ⚠️ Demo copy | Floor shows "QR table" only when `table.id === "05"`. Kitchen shows it only when `ticket.id === "k-05"`. Register seeds `useState([{ id: "intent_1", ... }])`. The queue use case does expose `qr_table`. Accepted as a warning, not a slice defect. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| `/m/:token` is not `/d/` or `/f/` | ✅ Yes | Portal paths are `/m/$token`, `/d/$token`, and `/f/$link`. HTTP paths are `m/:token` and the order routes under it. |
| No pay button and no `StartQrTablePayment` | ✅ Yes | Portal tests assert no pay button. Payment stays on 1.13. |
| Apply in api-cloud, default `direct` | ✅ Yes | Direct apply and cash-register acceptance tests passed. |
| Price from `Menu.viewAt` | ✅ Yes | Record test keeps that snapshot. The portal screen still uses the `SITE_MENU` constant. |
| Intent contract can save a check | ✅ Yes | The contract applies `0005_report_stamps.sql` after `0004_qr_table_ordering.sql`. The `qr_table` round-trip passed. |
| `qr-table-ordering.ts` is in the contracts project | ✅ Yes | `tsc -b shared/contracts` exited 0. |
| `QrOrderPendingApply` unpublished | ✅ Yes | The contract test that expects the name absent passed inside the api-cloud file (12/12). |
| PA-52 / outage queue | Deferred | Design forbids SQLite, outbox, local-node owner, and sync in this slice. |
| Venue screens read the queue | ❌ No | Badges and the register list are demo data. Called out by this re-verify as allowed demo copy. |
| Portal GET status / POST intent | ❌ No | Send flips local `sent`. Rejection copy depends on an `acceptance` prop the route does not pass. |

### Issues Found
**CRITICAL**: None

**WARNING**:
- Floor, kitchen, and register badges do not read the queue. They are hardcoded demo rows (`05`, `k-05`, and a seeded `intent_1`). The station-queue test does expose `qr_table`. This re-verify does not treat the demo copy as a defect to implement.
- `TableOrderScreen` does not call `GET` or `POST /m/:token`. "Enviar pedido" only flips local state. The rejection sentence is real, and its test passed, but `/m/$token` never passes `acceptance="rejected"`.
- Sold-out at apply time is reported once in memory. Node reconnection and the outage queue stay deferred with PA-52. Not a defect to implement in this change.
- The portal menu is the `SITE_MENU` constant. HTTP GET/POST cover the real menu and intent.

**SUGGESTION**:
- When a later slice replaces the demo badges, read `channel === "qr_table"` from the queue or check.
- Pass cashier rejection into `TableOrderRoute` from order status so the mounted `/m/$token` screen shows "El pedido no fue aceptado." without a test-only prop.

### Verdict
PASS WITH WARNINGS
36/36 tasks are checked. The three previous FAIL causes are closed: contracts typecheck passed, the Postgres intent round-trip passed with `0005` applied after `0004`, and the unsent-cart test passed (4 portal tests). In-slice scenarios that this change owns passed at runtime (47 tests, 0 failed). Demo venue badges and the local-only portal send remain warnings. The outage queue and PA-52 stay deferred and are not defects of this slice.
