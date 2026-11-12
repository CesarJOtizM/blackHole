# Tasks: Site Reports

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2800–4200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 18 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Cloud only (D-37). No SQLite, local-node, outbox, sync, lagging site, or duplicate batch. No `qr_table`, QR tender, or capture column (`unspecified`). Channels: `waiter` and `fixed_point`. Threats N/A. Given / When / Then. `#imports`. Entry ports only. Reporting tsconfig has no references. size:exception not granted. PR 1 base = tracker; each next PR bases on the previous. Do not merge a pair.

Tests: `pnpm vitest run --project <P> <filter>`.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Metrics | PR1 tracker | `reporting metrics` | N/A: pure | reporting domain |
| 2 | Check diners | PR2 on PR1 | `orders open-table` | N/A: memory | check, open-table |
| 3 | `releasedAt` | PR3 on PR2 | `orders release-table` | N/A: memory | release-table |
| 4 | Station snapshot | PR4 on PR3 | `orders change-line-state` | N/A: memory | change-line-state |
| 5 | Nullable columns | PR5 on PR4 | `orders drizzle-dining-room-repository.contract` | PGlite | `0004_report_stamps.sql` |
| 6 | Service facts | PR6 on PR5 | `orders list-service-facts` | N/A: memory | list-service-facts |
| 7 | Cash facts | PR7 on PR6 | `cash-register list-cash-facts` | N/A: memory | list-cash-facts |
| 8 | Staff hours | PR8 on PR7 | `attendance list-staff-hours` | N/A: memory | list-staff-hours |
| 9 | Invoice facts | PR9 on PR8 | `invoicing list-invoice-facts` | N/A: memory | list-invoice-facts |
| 10 | Access | PR10 on PR9 | `reporting authorize-report` | N/A: injected port | authorize-report |
| 11 | Facts port | PR11 on PR10 | `reporting in-memory-operation-facts` | N/A: memory | operation-facts |
| 12 | Sales | PR12 on PR11 | `reporting read-sales-report` | N/A: memory | read-sales-report |
| 13 | Times | PR13 on PR12 | `reporting read-time-report` | N/A: memory | read-time-report |
| 14 | Cash report | PR14 on PR13 | `reporting read-cash-report` | N/A: memory | read-cash-report |
| 15 | Staff report | PR15 on PR14 | `reporting read-staff-report` | N/A: memory | read-staff-report |
| 16 | Contract | PR16 on PR15 | `api-cloud read-site-report.controller` | N/A: schema | `reporting.ts` |
| 17 | HTTP | PR17 on PR16 | `api-cloud read-site-report.controller` | Nest, no listen | controller, reporting-facts |
| 18 | Screen | PR18 on PR17 | `admin-web reports-screen` | N/A: jsdom | reports route |

## 1. Definitions

- [x] 1.1 RED `contexts/reporting/domain/metrics.test.ts`. Add vitest project `reporting` and the root tsconfig reference. Missing end drops. Empty is not zero. Nearest-rank `ceil(p/100*n)-1`. Net: `grossCop - discountCop - includedTaxCop - tipCop`.
- [x] 1.2 GREEN `domain/metrics.ts`, `domain/index.ts`, `package.json`, `tsconfig.json` (no references).

## 2. Order stamps

- [x] 2.1 RED `contexts/orders/application/open-table/open-table.test.ts`: check keeps `diners`.
- [x] 2.2 GREEN `domain/check.ts`, `application/open-table/open-table.ts`.
- [x] 2.3 RED `application/release-table/release-table.test.ts`: stamp `releasedAt`.
- [x] 2.4 GREEN `application/release-table/release-table.ts`.
- [x] 2.5 RED `application/change-line-state/change-line-state.test.ts`: snapshot `stationId` from the station route.
- [x] 2.6 GREEN `application/change-line-state/change-line-state.ts`.
- [x] 2.7 RED `adapters/postgres/drizzle-dining-room-repository.contract.test.ts`: nullable diners, `released_at`, line `station_id`.
- [x] 2.8 GREEN `0004_report_stamps.sql` after `0003_check_waiter.sql`, `schema.ts`, drizzle repo.

## 3. Source facts

- [x] 3.1 RED `contexts/orders/application/list-service-facts/list-service-facts.test.ts`: lines, channel, diners, discounts, voids.
- [x] 3.2 GREEN that folder. `#application/list-service-facts/*` on `entry-port.ts`.
- [x] 3.3 RED `contexts/cash-register/application/list-cash-facts/list-cash-facts.test.ts`: tenders, tips, settlement, counts. `chargedAt` is `recorded_at`.
- [x] 3.4 GREEN that folder. `#application/list-cash-facts/*`. No new column.
- [x] 3.5 RED `contexts/attendance/application/list-staff-hours/list-staff-hours.test.ts`: corrected clock wins via `projectHours`.
- [x] 3.6 GREEN that folder. `#application/list-staff-hours/*`.
- [x] 3.7 RED `contexts/invoicing/application/list-invoice-facts/list-invoice-facts.test.ts`: generic versus identified, taxes, approved `PortalRepository` reinvoices.
- [x] 3.8 GREEN that folder. `#application/list-invoice-facts/*`.

## 4. Reports

- [x] 4.1 RED `contexts/reporting/application/authorize-report/authorize-report.test.ts`: other venue, previous shift, missing `report.view-sales`, other waiter denied.
- [x] 4.2 GREEN that folder. Injected permission port and open-shift bounds. No platform import.
- [x] 4.3 RED `adapters/memory/in-memory-operation-facts.test.ts`: second read matches. No writes.
- [x] 4.4 GREEN `application/ports/operation-facts.ts` and the memory adapter.
- [x] 4.5 RED `application/read-sales-report/read-sales-report.test.ts`: gross, net, tickets, Bogota band, channel, tips, products, rotation, tenders. Empty is not zero.
- [x] 4.6 GREEN that folder and `entry-port.ts`.
- [x] 4.7 RED `application/read-time-report/read-time-report.test.ts`: missing end drops (open/send, send/prep, prep/ready, send/ready, ready/delivered, send/delivered, open/released if charged, request/charged). Grill filter. Empty shows nothing.
- [x] 4.8 GREEN that folder. Site, station, product, waiter, hour band, weekday.
- [x] 4.9 RED `application/read-cash-report/read-cash-report.test.ts`: expected, counted, difference. Counts need `cash.view-expected-total`.
- [x] 4.10 GREEN that folder.
- [x] 4.11 RED `application/read-staff-report/read-staff-report.test.ts`: 2000000 and 40 hours is 50000. Tips, productivity, no salary.
- [x] 4.12 GREEN that folder. Export four readers.

## 5. HTTP and screen

- [x] 5.1 RED `apps/api-cloud/test/http/read-site-report.controller.test.ts`: `.strict()` `safeParse`, families, `from`, `to`. No `z.any()`.
- [x] 5.2 GREEN `shared/contracts/reporting.ts`, `index.ts`.
- [x] 5.3 RED same test: `GET tenants/:tenantId/venues/:venueId/reports/:family`. Shared day/history query. 403. Failed read is not zeroed. No local-node route.
- [x] 5.4 GREEN `read-site-report.controller.ts`, `composition/reporting-facts.ts`, `application-module.ts`, api-cloud tsconfig reference. Wire `EvaluatePermission` and the fact entry ports. Leave `control-report` untouched.
- [x] 5.5 RED `apps/admin-web/test/reports/reports-screen.test.tsx`: Bogota today, history, empty section.
- [x] 5.6 GREEN `src/reports/reports-screen.tsx`, `reports-source.ts`. Replace `pending("reports", "Reportes")` in `router.tsx`.
