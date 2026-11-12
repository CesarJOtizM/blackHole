# Apply progress: p1-11-site-reports

**Mode**: Standard, with RED then GREEN (strict_tdd is false; strict-tdd.md was not loaded).
**Assigned**: 1.1, 1.2, 4.1–4.12.
**Skipped**: sections 2, 3, and 5.

## Work Unit Evidence

| Unit | Focused test command | Result | Runtime harness | Rollback boundary |
|------|----------------------|--------|-----------------|-------------------|
| Metrics (1.1–1.2) | `pnpm exec vitest run --project reporting contexts/reporting/domain/metrics.test.ts` | GREEN: 1 file, 6 tests passed | N/A: pure functions | `contexts/reporting/domain`, vitest project `reporting`, root tsconfig reference |
| Access (4.1–4.2) | `pnpm exec vitest run --project reporting contexts/reporting/application/authorize-report/authorize-report.test.ts` | GREEN: 1 file, 6 tests passed | N/A: injected port | `contexts/reporting/application/authorize-report`, `application/ports/report-access.ts` |
| Facts (4.3–4.4) | `pnpm exec vitest run --project reporting contexts/reporting/adapters/memory/in-memory-operation-facts.test.ts` | GREEN: 1 file, 2 tests passed | N/A: memory | `application/ports/operation-facts.ts`, `adapters/memory/in-memory-operation-facts.ts` |
| Sales (4.5–4.6) | `pnpm exec vitest run --project reporting contexts/reporting/application/read-sales-report/read-sales-report.test.ts` | GREEN: 1 file, 3 tests passed | N/A: memory | `application/read-sales-report`, `application/entry-port.ts`, `application/load-report.ts` |
| Times (4.7–4.8) | `pnpm exec vitest run --project reporting contexts/reporting/application/read-time-report/read-time-report.test.ts` | GREEN: 1 file, 10 tests passed | N/A: memory | `application/read-time-report` |
| Cash (4.9–4.10) | `pnpm exec vitest run --project reporting contexts/reporting/application/read-cash-report/read-cash-report.test.ts` | GREEN: 1 file, 3 tests passed | N/A: memory | `application/read-cash-report` |
| Staff (4.11–4.12) | `pnpm exec vitest run --project reporting contexts/reporting/application/read-staff-report/read-staff-report.test.ts` | GREEN: 1 file, 2 tests passed | N/A: memory | `application/read-staff-report` and the four reader exports |

Final suite after Biome: `pnpm exec vitest run --project reporting` → Test Files 7 passed (7), Tests 32 passed (32), exit 0.
`pnpm exec tsc -b contexts/reporting --pretty false` → exit 0. Reporting tsconfig has no `references`.

## RED → GREEN

| Pair | RED result | GREEN result |
|------|------------|--------------|
| 1.1 / 1.2 | Exit 1. `Failed to load tsconfig 'contexts/reporting': Tsconfig not found`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 6 passed. |
| 4.1 / 4.2 | Exit 1. `Missing "#application/authorize-report/authorize-report.js" specifier`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 6 passed. |
| 4.3 / 4.4 | Exit 1. `Missing "#adapters/memory/in-memory-operation-facts.js" specifier`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 2 passed. |
| 4.5 / 4.6 | Exit 1. `Cannot find module '#application/read-sales-report/read-sales-report.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 3 passed. |
| 4.7 / 4.8 | Exit 1. `Cannot find module '#application/read-time-report/read-time-report.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 10 passed. Re-run after removing an unused constant: 10 passed. |
| 4.9 / 4.10 | Exit 1. `Cannot find module '#application/read-cash-report/read-cash-report.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 3 passed. |
| 4.11 / 4.12 | Exit 1. `Cannot find module '#application/read-staff-report/read-staff-report.js'`. Test Files 1 failed. Tests: no tests. | Exit 0. Test Files 1 passed. Tests 2 passed. |

Each GREEN pair was followed by `pnpm exec biome check --write` on the files touched in that pair.

## Completed tasks

- [x] 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12

## Not started here

- [ ] 3.3–3.4

## Notes

- Reporting reads other contexts only through ports defined in `contexts/reporting`. Facts in these tests are in-memory. No import of `@blackhole/orders`, `@blackhole/cash-register`, `@blackhole/attendance`, `@blackhole/invoicing`, or `@blackhole/platform`.
- Channels are `waiter` and `fixed_point`. No `qr_table` and no QR tender.
- Missing end returns null. Empty samples return null, not zero. Nearest rank index is `ceil(p/100*n)-1`. Net is `grossCop - discountCop - includedTaxCop - tipCop`.
- Bogota hour and weekday use a fixed UTC−5 offset, the same rule attendance already uses.
- A supervisor asking for another shift is denied. A matching open shift clamps the period to that shift.
- Cash counts stay hidden without `cash.view-expected-total`.
- Invoice facts sit on the operation-facts port (`buyer`, `capture`, `reinvoiceCount`). This slice does not aggregate portal versus register share; capture stays `unspecified` until p1-08.
- `pnpm exec` added the `contexts/reporting` importer to `pnpm-lock.yaml`. The same diff also contains `@testing-library/react` and `jsdom` lines this agent did not author. `pnpm-workspace.yaml` was not edited.

## Tasks 3.5–3.8

Assigned only 3.5, 3.6, 3.7, and 3.8. Sections 2, 3.1–3.4, and 5 were not started. No commit.

| Pair | Command | RED | GREEN |
|------|---------|-----|-------|
| 3.5 / 3.6 | `pnpm exec vitest run --project attendance contexts/attendance/application/list-staff-hours/list-staff-hours.test.ts` | Exit 1. `Cannot find module '#application/list-staff-hours/list-staff-hours.js'`. Test Files 1 failed (1). Tests: no tests. Start 18:24:35. Duration 215ms. | Exit 0. Test Files 1 passed (1). Tests 2 passed (2). Start 18:25:17. Duration 213ms. |
| 3.7 / 3.8 | `pnpm exec vitest run --project invoicing contexts/invoicing/application/list-invoice-facts/list-invoice-facts.test.ts` | Exit 1. `Missing "#application/list-invoice-facts/list-invoice-facts.js" specifier in "@blackhole/invoicing" package`. Test Files 1 failed (1). Tests: no tests. Start 18:26:58. Duration 191ms. | Exit 0. Test Files 1 passed (1). Tests 2 passed (2). Start 18:27:36. Duration 429ms. |

Biome after 3.6: `pnpm exec biome check --write` on `contexts/attendance/application/list-staff-hours/list-staff-hours.test.ts`, `list-staff-hours.ts`, `contexts/attendance/application/entry-port.ts`, and `contexts/attendance/package.json`. Checked 4 files. Fixed 3 files. Exit 0. Re-run of the attendance command: exit 0, Test Files 1 passed (1), Tests 2 passed (2), start 18:26:06, duration 203ms.

Biome after 3.8: `pnpm exec biome check --write` on `contexts/invoicing/application/list-invoice-facts/list-invoice-facts.test.ts`, `list-invoice-facts.ts`, `contexts/invoicing/application/entry-port.ts`, and `contexts/invoicing/package.json`. Checked 4 files. Fixed 3 files. Exit 0. Re-run of the invoicing command: exit 0, Test Files 1 passed (1), Tests 2 passed (2), start 18:28:01, duration 311ms.

The first invoicing RED, before the test import was corrected, failed on `Missing "#application/entry-port.js" specifier` because invoicing has no one-segment `#application/*` map. The test now imports the entry port through `@blackhole/invoicing/application/entry-port`. The recorded RED is the missing use-case specifier.

`ListStaffHours` calls `projectHours`. An auto-closed clock-out at `2026-10-24T03:00:00.000Z` corrected to `2026-10-23T21:00:00.000Z` yields 480 worked minutes, not the uncorrected 840. The stored clock row stays at the auto-close instant. `corrected` is true. Default policy is hours-only.

`ListInvoiceFacts` marks document `222222222222` / `Consumidor final` as `generic` and any other buyer as `identified`. Taxes are copied and summed. `reinvoiceCount` is 1 only when `PortalRepository.find` returns `approved`. A pending request and an invoice outside `[from, to)` stay out. Capture is not set here. `IssuedInvoiceReader` is a local read port: `SalesDocumentRepository` only finds by closure id, and `SalesDocument.buyer` is always the generic buyer type.

Neither context imports `@blackhole/reporting`.

## Completed tasks

- [x] 1.1, 1.2, 4.1–4.12, 3.5, 3.6, 3.7, 3.8

## Tasks 2.1–2.6

Assigned only 2.1 through 2.6. Tasks 2.7 and 2.8 were not started. No SQL file. No edits to `adapters/postgres`, `schema.ts`, `package.json`, `entry-port.ts`, or `apps/api-cloud`. No commit.

| Pair | Command | RED | GREEN |
|------|---------|-----|-------|
| 2.1 / 2.2 | `pnpm exec vitest run --project orders contexts/orders/application/open-table/open-table.test.ts` | Exit 1. `expected undefined to be 4` on `opened.check.diners`. Test Files 1 failed (1). Tests 1 failed \| 3 passed (4). Start 18:32:24. Duration 216ms. | Exit 0 with `contexts/orders/domain/check.test.ts` included. Test Files 2 passed (2). Tests 24 passed (24). Start 18:32:46. Duration 203ms. Re-run after Biome: same 2 files, 24 tests, exit 0, start 18:35:33, duration 238ms. |
| 2.3 / 2.4 | `pnpm exec vitest run --project orders contexts/orders/application/release-table/release-table.test.ts` | Exit 1. `expected undefined to be '2026-10-28T14:00:00.000Z'` on `releasedAt`. Test Files 1 failed (1). Tests 1 failed \| 3 passed (4). Start 18:33:20. Duration 230ms. | Exit 0. Test Files 1 passed (1). Tests 4 passed (4). Start 18:33:46. Duration 198ms. Re-run after Biome: 4 passed, exit 0, start 18:35:33, duration 202ms. |
| 2.5 / 2.6 | `pnpm exec vitest run --project orders contexts/orders/application/change-line-state/change-line-state.test.ts` | Exit 1. `stationId: station_grill` missing on the prepared line. Test Files 1 failed (1). Tests 1 failed \| 3 passed (4). Start 18:34:12. Duration 231ms. | Exit 0 with `contexts/orders/domain/check.test.ts` included. Test Files 2 passed (2). Tests 24 passed (24). Start 18:34:56. Duration 205ms. Re-run of the change-line-state file after Biome: Test Files 1 passed (1). Tests 4 passed (4). Start 18:35:34. Duration 208ms. |

Biome: `pnpm exec biome check --write` on the eight order files listed below. Checked 8 files. Fixed 6 files. Exit 0.

`Check.open` keeps optional `diners` (`null` when omitted). `OpenTable` passes the seated count. `ReleaseTable` still accepts the dining room alone; an optional clock defaults to `Date.now()`. It loads the open check with `loadOpenCheckByTable`, stamps `releasedAt`, then saves the table and the check. `ChangeLineState` keeps its three existing arguments. An optional station-route repository snapshots `stationId` through `StationRouter` only when the line enters `in_preparation`. `apps/api-cloud` composition was left unchanged, so production release uses the wall clock and production line changes do not snapshot a station until that fourth argument is wired.

## Completed tasks

- [x] 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.5, 3.6, 3.7, 3.8, 4.1–4.12

## Tasks 2.7, 2.8, 3.1, 3.2

The migration file is `contexts/orders/adapters/postgres/0005_report_stamps.sql`. It is 0005 because `0004_qr_table_ordering.sql` already belongs to QR ordering. `0004_report_stamps.sql` was not created. `0004_qr_table_ordering.sql` was not edited. QR tables, tokens, intents, and the `qr_table` channel stay in `schema.ts`. No commit.

| Pair | Command | RED | GREEN |
|------|---------|-----|-------|
| 2.7 / 2.8 | `pnpm exec vitest run --project orders contexts/orders/adapters/postgres/drizzle-dining-room-repository.contract.test.ts` | Exit 1. `column "diners" does not exist`. Test Files 1 failed (1). Tests 2 failed \| 8 passed (10). Start 18:40:57. Duration 9.07s. | Exit 0. Test Files 1 passed (1). Tests 10 passed (10). Start 18:41:58. Duration 8.89s. |
| 3.1 / 3.2 | `pnpm exec vitest run --project orders contexts/orders/application/list-service-facts/list-service-facts.test.ts` | Exit 1. `Missing "#application/list-service-facts/list-service-facts.js" specifier`. Test Files 1 failed (1). Tests: no tests. Start 18:43:22. Duration 190ms. | Exit 0. Test Files 1 passed (1). Tests 2 passed (2). Start 18:43:55. Duration 421ms. |

Biome: `pnpm exec biome check --write` on the stamp and service-fact files. Checked 7 files. Fixed 3 files. Exit 0. Re-run of both commands together: exit 0, Test Files 2 passed (2), Tests 12 passed (12), start 18:44:24, duration 9.36s.

`0005_report_stamps.sql` adds nullable `checks.diners`, `checks.released_at`, and `order_lines.station_id`. No backfill. The dining-room contract test applies `0004_qr_table_ordering.sql` and then `0005_report_stamps.sql`. A prepared line round-trips `station_grill`; an untouched check keeps the three columns null.

`ListServiceFacts` lists lines from `listChecks`. Channel stays `waiter`, `fixed_point`, or `qr_table`. Diners come from the check. `discountCop` is 0 because a check does not store a separate discount. A line on `check_void_sink` is `voided`. Lines outside `[from, to)` are omitted. QR exports on the entry port were left in place.

## Completed tasks

- [x] 1.1, 1.2, 2.1–2.8, 3.1, 3.2, 3.5–3.8, 4.1–4.12

## Tasks 5.1, 5.2, 5.5, 5.6

The contract proof does not live in `apps/api-cloud/test/http/read-site-report.controller.test.ts`. That file belongs to tasks 5.3 and 5.4, and `apps/api-cloud` was left untouched. The same `.strict()` `safeParse` checks for families, `from`, and `to` run in `apps/admin-web/test/reports/reporting-contract.test.ts`. No `z.any()`.

`pending("reports", "Reportes")` is already gone from `apps/admin-web/src/router.tsx`. The sales, times, cash, and staff routes already load `ReportsScreen`, so the router was not edited. Control, leakage, and the other sections still use the existing view. `control-report` was not touched.

| Pair | Command | RED | GREEN |
|------|---------|-----|-------|
| 5.1 / 5.2 | `pnpm exec vitest run --project admin-web apps/admin-web/test/reports/reporting-contract.test.ts` | Exit 1. `Cannot read properties of undefined (reading 'safeParse')`. Test Files 1 failed (1). Tests 1 failed (1). Start 18:51:58. Duration 1.71s. | Exit 0. Test Files 1 passed (1). Tests 1 passed (1). Start 18:53:09. Duration 1.69s. |
| 5.5 / 5.6 | `pnpm exec vitest run --project admin-web apps/admin-web/test/reports/reports-screen.test.tsx` | Exit 1. `Element type is invalid` (`SiteReportPanel` undefined). Test Files 1 failed (1). Tests 4 failed (4). Start 18:53:39. Duration 2.30s. | Exit 0. Test Files 2 passed (2). Tests 5 passed (5), screen 4 and contract 1. Start 18:55:26. Duration 2.81s. |

Biome: `pnpm exec biome check --write` on the contract, the new export, the screen, the source, both tests, and `apps/admin-web/package.json`. Checked 7 files. Fixed 7 files. Exit 0. Re-run of both tests: exit 0, Test Files 2 passed (2), Tests 5 passed (5), start 18:55:58, duration 2.10s.

Bogota today is the half-open window `2026-11-11T05:00:00.000Z` to `2026-11-12T05:00:00.000Z` for `2026-11-11T18:00:00.000Z`. History applies the typed range. An empty sales section renders `Sin datos`. A failed read renders `No se pudo leer`. Neither renders `0`.

## Completed tasks

- [x] 1.1, 1.2, 2.1–2.8, 3.1, 3.2, 3.5–3.8, 4.1–4.12, 5.1, 5.2, 5.5, 5.6

## Tasks 5.3, 5.4

`GET /tenants/:tenantId/venues/:venueId/reports/:family` uses the shared `from`/`to` query for today and history. A kitchen chief without `report.view-sales` gets 403. A thrown fact read returns 503 `{ error: "ReportReadFailed" }` and not a zeroed report. Empty sales figures stay null. Cash, with no cash-fact port, returns `{ visible: true, rows: [] }` for an owner and does not invent `expectedCop: 0`. No local-node route. `control-report` stays. No new database pool. `ListServiceFacts`, `ListStaffHours`, and `ListInvoiceFacts` are wired. Invoice documents stay empty because there is no issued-invoice reader on the entry port; the portal find is never called. No commit.

| Pair | Command | RED | GREEN |
|------|---------|-----|-------|
| 5.3 / 5.4 | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/read-site-report.controller.test.ts` | Exit 1. `Cannot find module '#src/composition/reporting-facts.js'`. Test Files 1 failed (1). Tests: no tests. Start 19:02:16. Duration 327ms. | Exit 0. Test Files 1 passed (1). Tests 3 passed (3). Start 19:06:15. Duration 4.23s. |

Bootstrap: `pnpm exec vitest run --project api-cloud apps/api-cloud/test/composition/bootstrap.test.ts apps/api-cloud/test/http/read-site-report.controller.test.ts`. After the graph expectation also listed the report providers plus the table-qr and portal providers already registered in the module, exit 0. Test Files 2 passed (2). Tests 6 passed (6). Start 19:08:28. Duration 2.31s.

Biome: `pnpm exec biome check --write` on the controller, `reporting-facts.ts`, `application-module.ts`, both tests, `package.json`, and `apps/api-cloud/tsconfig.json`. Checked 7 files. Fixed 7 files. Exit 0. Re-run: exit 0, Test Files 2 passed (2), Tests 6 passed (6), start 19:09:11, duration 2.25s.

## Completed tasks

- [x] 1.1, 1.2, 2.1–2.8, 3.1, 3.2, 3.5–3.8, 4.1–4.12, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6

## Not started here

- [ ] 3.3–3.4

## Tasks 3.3, 3.4

`ListCashFacts` lists tenders, tips, settlements, and counts. `chargedAt` is the existing `recordedAt` (`recorded_at`). No SQL column, no migration, and no edit to `schema.ts`. A `qr` method is dropped. A row outside `[from, to)` is omitted. An empty period returns empty arrays and does not invent a zero amount. Difference is `countedCop - expectedCop`. The reader is not registered in `apps/api-cloud`. `#adapters/bold/*` and the existing entry-port exports stay. No commit.

| Pair | Command | RED | GREEN |
|------|---------|-----|-------|
| 3.3 / 3.4 | `pnpm exec vitest run --project cash-register contexts/cash-register/application/list-cash-facts/list-cash-facts.test.ts` | Exit 1. `Cannot find module '#application/list-cash-facts/list-cash-facts.js'`. Test Files 1 failed (1). Tests: no tests. Start 19:13:46. Duration 499ms. | Exit 0. Test Files 1 passed (1). Tests 3 passed (3). Start 19:14:25. Duration 277ms. |

Biome: `pnpm exec biome check --write` on the use case, its test, `entry-port.ts`, and `contexts/cash-register/package.json`. Checked 4 files. Fixed 2 files. Exit 0. Re-run: exit 0, Test Files 1 passed (1), Tests 3 passed (3), start 19:14:53, duration 282ms.

## Completed tasks

- [x] 1.1, 1.2, 2.1–2.8, 3.1–3.8, 4.1–4.12, 5.1–5.6

## Not started here

None. The change tasks are marked.

## Verify remediation: stamps and cash composition

No task was unchecked. `ListServiceFacts` now returns `openedAt`, `releasedAt`, `requestedAt`, `sentAt`, `inPreparationAt`, `readyAt`, `deliveredAt`, and `stationId`. `discountCop` stays 0. `ReportingFacts.serviceLine` copies those stamps, `stationId`, gross, discount, diners, and void. `qr_table` stays out of the reporting channel. `chargedAt` on a line stays null because the line has no charge stamp. Tax and tip stay 0 only when the orders fact does not carry them.

`LedgerCashFactReader` reads existing `payments`, `sale_closures`, `tip_settlements`, and `cash_counts`. `chargedAt` is `payments.recorded_at`. No new column and no new SQL file. The reader keeps method `qr`; `ListCashFacts` still omits it. Settlements and counts have no clock column, so they use the latest payment `recorded_at` for the venue or register and are omitted when that clock or the counted amounts are missing. An empty ledger stays empty. `createReportingFacts` now builds `ListCashFacts` and maps its tenders and counts. The cloud factory passes `MemoryLedgerCashFacts` over the in-memory charge, settlement, and count stores. `AbsentOpenShift` and `EmptyIssuedInvoices` stay. QR payment registration stays.

| Command | Result |
|---------|--------|
| `pnpm exec vitest run --project orders contexts/orders/application/list-service-facts/list-service-facts.test.ts` | RED exit 1. Stamps missing. 1 failed, 1 passed (2). Start 19:33:06. GREEN exit 0. 1 file, 2 passed. Start 19:33:39. After Biome, exit 0, 2 passed, start 19:37:28. |
| `pnpm exec vitest run --project cash-register contexts/cash-register/adapters/postgres/drizzle-cash-fact-reader.contract.test.ts` | RED exit 1. Missing `#adapters/postgres/ledger-cash-fact-reader.js`. 1 file failed, no tests. Start 19:33:39. GREEN exit 0. 1 file, 2 passed. Start 19:34:43. |
| `pnpm exec vitest run --project cash-register contexts/cash-register/application/list-cash-facts/list-cash-facts.test.ts contexts/cash-register/adapters/postgres/drizzle-cash-fact-reader.contract.test.ts` | Exit 0. 2 files, 5 passed. Start 19:36:28. After Biome, exit 0, 5 passed, start 19:37:29. |
| `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/read-site-report.controller.test.ts` | Exit 0. 1 file, 3 passed. Empty cash stays empty. Start 19:36:29. After Biome, exit 0, 3 passed, start 19:37:33. |

Biome: `pnpm exec biome check --write` on the eight touched files. Checked 8. Fixed 5. Exit 0.

Left open on purpose: invoice facts stay empty, the supervisor shift stays `AbsentOpenShift`, and the deferred spec scenarios (local-node, sync, hybrid outage, lagging sites, duplicate batches, a reporting QR tender, portal capture share) stay untested. A service line still has no charge stamp, so sales that require `chargedAt` do not count it. Product id remains the line id.
