## Verification Report

**Change**: p1-11-site-reports
**Version**: N/A
**Mode**: Standard
**strict_tdd**: false (`strict-tdd-verify.md` was not loaded)
**Persistence**: openspec (`openspec/config.yaml`) plus Engram `sdd/p1-11-site-reports/verify-report` (project `blackhole`)

Re-verify after the composition fix. The previous verdict was FAIL because `ReportingFacts` nulled service stamps and never called `ListCashFacts`.

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 36 |
| Tasks complete | 36 |
| Tasks incomplete | 0 |

Tasks 1.1–5.6 are checked in `tasks.md` (36 `- [x]`, no `- [ ]` task lines). Proposal success criteria stay unchecked; they describe the pilot outcome and are not implementation tasks.

Not run, and not judged as defects: `bootstrap.test.ts`, QR payment controller tests, `shared/contracts` typecheck, local-node, sync, hybrid outage, lagging sites, duplicate batches, a QR tender, and portal capture share. Design still defers those. Attendance, invoicing, and admin-web suites were not re-run in this pass.

### Build & Tests Execution
**Build**: ✅ Passed

```text
pnpm exec tsc -b contexts/reporting --pretty false
exit 0
```

Full `pnpm typecheck` and `tsc -b shared/contracts` were not run. Another verifier may be typechecking contracts.

**Tests**: ✅ 42 passed / ❌ 0 failed / ⚠️ 0 skipped

```text
pnpm exec vitest run --project reporting
exit 0
Test Files  7 passed (7)
     Tests  32 passed (32)

pnpm exec vitest run --project orders contexts/orders/application/list-service-facts/list-service-facts.test.ts
exit 0
Test Files  1 passed (1)
     Tests  2 passed (2)

pnpm exec vitest run --project cash-register contexts/cash-register/application/list-cash-facts/list-cash-facts.test.ts contexts/cash-register/adapters/postgres/drizzle-cash-fact-reader.contract.test.ts
exit 0
Test Files  2 passed (2)
     Tests  5 passed (5)

pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/read-site-report.controller.test.ts
exit 0
Test Files  1 passed (1)
     Tests  3 passed (3)
```

**Coverage**: ➖ Not available (openspec `coverage.available: false`; no coverage command)

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Shared Metric Definitions | Missing end state | `contexts/reporting/domain/metrics.test.ts` > given a line never marked ready, when preparation time is computed, then that line contributes no value | ✅ COMPLIANT |
| Shared Metric Definitions | Same day, both sides | (design defers the node reader) | ➖ DEFERRED |
| Day Reports on the Operation Owner | Hybrid outage | (design defers local-node) | ➖ DEFERRED |
| Day Reports on the Operation Owner | Cloud outage | `apps/api-cloud/test/http/read-site-report.controller.test.ts` > given the fact read fails, when GET sales is injected, then the response is not a zeroed report | ⚠️ PARTIAL |
| Sales Reports | QR separate from cash | (design defers a QR tender to p1-12) | ➖ DEFERRED |
| Sales Reports | Portal capture share | (design defers capture to p1-08; invoices stay `EmptyIssuedInvoices`) | ➖ DEFERRED |
| Time Reports | Station filter | `contexts/reporting/application/read-time-report/read-time-report.test.ts` > given grill and bar lines, when preparation is filtered by grill, then only grill feeds average, p50 and p90 | ✅ COMPLIANT |
| Time Reports | Empty filter | `contexts/reporting/application/read-time-report/read-time-report.test.ts` > given a filter with no matching lines, when times are requested, then no figures are shown | ✅ COMPLIANT |
| Cash Register and Staff Reports | Sales per hour worked | `contexts/reporting/application/read-staff-report/read-staff-report.test.ts` > given net sales of 2000000 and 40 staff hours, when the staff report runs, then sales per hour worked is 50000 | ✅ COMPLIANT |
| Cash Register and Staff Reports | Corrected clock event | `contexts/attendance/application/list-staff-hours/list-staff-hours.test.ts` > given an auto-closed clock-out and a later correction, when staff hours are listed, then projectHours keeps the corrected clock | ⚠️ PARTIAL |
| Cloud History Projections | Duplicate after outage | (design leaves duplicate batches in the hybrid remainder) | ➖ DEFERRED |
| Cloud History Projections | Lagging site | (design leaves lagging sites in the hybrid remainder) | ➖ DEFERRED |
| Role-Scoped Access | Other site | `contexts/reporting/application/authorize-report/authorize-report.test.ts` > given an administrator of another venue, when they request this venue, then access is denied | ✅ COMPLIANT |
| Role-Scoped Access | Supervisor history | `contexts/reporting/application/authorize-report/authorize-report.test.ts` > given a supervisor, when they open a previous shift, then access is denied | ✅ COMPLIANT |

**Compliance summary**: 6/14 scenarios compliant, 2 partial, 6 deferred, 0 failing, 0 untested defects

Deferred rows stay in the spec and were not given a passing test. Design and the tasks header still leave them out of this slice, so they are not defects to fix here.

The corrected-clock test was not re-executed in this pass. The attendance project was outside the requested commands. The previous verify recorded that test passing. `ReadStaffReport` itself still has no corrected-clock assertion.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Shared metric definitions | ✅ Implemented | Nearest-rank, empty is null, net subtracts discount, included tax, and tip. Missing end drops. |
| Day on the operation owner | ⚠️ Partial | Cloud GET exists. A failed fact read returns 503 and is not zeroed. Day and history share `from`/`to`. No node day path, by design D-37. |
| Sales reports | ⚠️ Partial | `ReadSalesReport` reports gross, net, tickets, Bogotá bands, channels, tips, products, rotation, and tenders when injected lines have `chargedAt`. `ReportingFacts.serviceLine` copies the line stamps and then sets `chargedAt: null`. `chargedLines` drops those lines, so composed sales stay the empty section (`grossCop: null`), including tender share. `productId` and `productName` are `line.lineId`. `quantity` is 1. `discountCop` stays 0. Included tax and tip fall back to 0. |
| Time reports | ⚠️ Partial | Times can see `openedAt`, `sentAt`, `inPreparationAt`, `readyAt`, `deliveredAt`, `requestedAt`, `releasedAt`, and `stationId`. Order-taking, kitchen wait, preparation, total kitchen, table delivery, and total service can be computed. Payment time and table duration still drop because they need `chargedAt`, which stays null. A product filter matches the line id. |
| Cash closings | ✅ Implemented | `createReportingFacts` constructs `ListCashFacts`. `read` maps `cash.counts` into `cashCounts` and `cash.tenders` into tenders. The factory in `application-module.ts` passes `MemoryLedgerCashFacts`, a `CashFactReader` over the module charge, settlement, and count ledgers. Empty cash stays empty (`rows: []`, not a zero row). The Postgres `LedgerCashFactReader` contract passed and is not the object injected in the factory. |
| Staff hours, tips, productivity | ⚠️ Partial | 2,000,000 / 40 hours = 50,000 passes on injected facts. The composition calls `ListStaffHours` and copies `workedMinutes`. Sales per hour on the API stays empty because charged lines never appear. Composed tenders set `waiterId` to null, so waiter tips stay empty. |
| Invoice customer data and reinvoices | ➖ Deferred | `ListInvoiceFacts` is still built with `EmptyIssuedInvoices` and a portal `find` that returns null. Mapped invoices force `capture: "unspecified"`. Design defers capture to p1-08. This pass does not treat that as a defect. |
| Cloud history, lag, duplicate batch | ➖ Deferred | Design and tasks leave sync, lagging sites, and duplicate batches in the hybrid remainder. |
| Role scope | ⚠️ Partial | Other venue, missing `report.view-sales`, other waiter, and previous shift are denied in the use case. HTTP 403 for a kitchen chief passed. `AbsentOpenShift.findOpen` returns null, so every supervisor request is `previous_shift`. This fix leaves that in place. |
| Admin screen | ➖ Not re-run | Previous verify recorded Bogotá today, history, and the empty section passing. This pass did not run the admin-web project. |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| Cloud-only api-cloud PostgreSQL (D-37) | ✅ Yes | No local-node report route. HTTP test asserts that file is absent. |
| Reporting reads other contexts only through entry ports | ✅ Yes | `ListServiceFacts`, `ListStaffHours`, `ListInvoiceFacts`, and `ListCashFacts` are constructed. Cash is no longer a hardcoded empty snapshot. |
| Wire facts in `reporting-facts.ts` | ✅ Yes | Service mapping copies line stamps. `chargedAt` on the line stays null because the line has no charge stamp. Cash rows come from `ListCashFacts`. Invoices stay empty, as this fix claims. |
| Numbers: nearest-rank, empty is not zero, missing end drops | ✅ Yes | Domain and the readers. HTTP and the empty-cash tests refuse a zeroed failure or a zero row. |
| Net sales formula | ✅ Yes | Domain test. Composed lines never reach the formula because `chargedAt` is null. |
| Access via `EvaluatePermission`; counts also need `cash.view-expected-total` | ⚠️ Partial | `PermissionReportAccess` calls `authorization.evaluateFor` directly. Count hiding is tested on the use case. The HTTP cash boot has `visible: true` and empty rows. |
| Supervisor clamped to open cash shifts | ⚠️ Left as claimed | `application-module.ts` still injects `AbsentOpenShift` into all four readers. The previous-shift denial test passed. The open-shift clamp is not loaded. |
| Owning use cases write stamps; reporting reads them | ⚠️ Partial | `ListServiceFacts` returns `openedAt`, `releasedAt`, `requestedAt`, `sentAt`, `inPreparationAt`, `readyAt`, `deliveredAt`, and `stationId`. `ReportingFacts` copies those. It does not invent a charge stamp. Cash `chargedAt` is `recordedAt` on the tender and the count, from `ListCashFacts`. |
| No `qr_table`, QR tender, or capture column until later changes | ✅ Yes | Deferred, not a defect. `reportedChannel` still drops `qr_table`. `ListCashFacts` still drops stored method `qr`. Capture stays `unspecified`. |
| Channels `waiter` and `fixed_point` | ✅ Yes | `reportedChannel` keeps those two. |
| Day and history share one query | ✅ Yes | Controller test passed. |
| Reporting writes nothing | ✅ Yes | Readers do not save. |
| Migration `0005_report_stamps.sql` | ✅ File present | Task 2.8 still names `0004_report_stamps.sql`. The dining-room contract that applies `0005` was not run this pass. |

### Composition answer
`ListServiceFacts` now returns the line stamps above. `ReportingFacts.serviceLine` copies them. A line still has no charge stamp, so `chargedAt` stays null. `productId` and `productName` are still the line id.

Times can see the copied stamps. Sales cannot: `ReadSalesReport` keeps only lines with `chargedAt`, so a real check still contributes the empty section. Cash counts come from `ListCashFacts` (`cash.counts`), fed by the ledger `CashFactReader` the factory passes. They are not hardcoded `[]`. An empty ledger stays empty. A failed read stays 503.

### Issues Found
**CRITICAL**: None

**WARNING**:
- Composed service lines still have `chargedAt: null`. Sales, sales per hour, payment time, and table duration stay empty on the API even though the other stamps are copied.
- `productId` and `productName` are `line.lineId`. `quantity` is 1. `discountCop` is 0. Included tax and tip default to 0. The list-service-facts test expects `discountCop: 0`.
- `AbsentOpenShift` makes every supervisor report `previous_shift`. The use case can clamp to an injected open shift. This fix leaves the production binding as `AbsentOpenShift`.
- Task 5.4 says wire `EvaluatePermission`. The composition rechecks `authorization.evaluateFor` inside `PermissionReportAccess`. The kitchen-chief 403 test passed.
- The api-cloud factory passes `MemoryLedgerCashFacts`, not `LedgerCashFactReader`. Counts still flow through `ListCashFacts`. The HTTP test only proves the empty ledger (`rows: []`). The Postgres contract passed on its own.
- `MemoryLedgerCashFacts` sets tender `waiterId` to null, so waiter tips on the composed snapshot stay empty.
- Task 2.8 names `0004_report_stamps.sql`. The change's migration is `contexts/orders/adapters/postgres/0005_report_stamps.sql`. This pass did not run the dining-room contract.
- The corrected-clock scenario was not re-run. It is proven on `ListStaffHours`, not through `ReadStaffReport`.

**SUGGESTION**:
- When a cash charge exists, carry that instant onto the service line (or let sales join tenders without a line charge stamp) so gross, net, and payment time can leave the empty section. Map `productId` from the menu line when the order line has one.

### Verdict
PASS WITH WARNINGS
6/14 scenarios compliant, 2 partial, 6 deferred by design. Requested tests and the reporting typecheck passed. Times can see the copied line stamps. Cash counts come from `ListCashFacts`. Sales stay empty because `chargedAt` is still null and the product id is still the line id.
