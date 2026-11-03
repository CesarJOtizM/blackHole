# Tasks: Printing

## Review Workload Forecast

3600–4800 lines. ask-on-risk. `pnpm vitest run --project <filter>`.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

D-37 cloud. RED/GREEN ADR-017. given/when/then. `strict_tdd` stays false. Entry-port only. No Nest/SQL/Zod/spike/`ticketLegible`/`drawerOpened`.

Skip SQLite, outbox, node queue, TCP/USB, bridge, no-sale open, over-cap reprint. `waiting` allowed. Pilot: p0-01.

PR1 base `p1-06-printing`. Later base = previous branch. One apply. Do not split a pair.

Units: 1 widths (skeleton), 2 sale-templates, 3 other-templates, 4 enqueue, 5 dispatch, 6 reprint, 7 postgres use `printing`. 8–9 drawer model/SQL `platform`. 10 orders. 11–12 cash present, other tenders `cash-register`. 13 payloads `invoicing`. 14–15 cloud responses, reprint HTTP `api-cloud`. 16 node `local-node`+`skeleton`.

1. Domain

- [x] 1.1 RED `shared/printing/domain/render.test.ts`: 80→48, 58→32. Pulse `1B-70-00-19-FA` on kicked invoice/receipt only. Else `DrawerKickRejected`.
- [x] 1.2 GREEN `domain/render.ts`, `@blackhole/printing`, `tsconfig.json`, vitest `printing`. Un-absent `shared/printing` in `tools/skeleton/skeleton.test.ts`.
- [x] 1.3 RED `shared/printing/domain/sale-templates.test.ts`: 58 mm keeps number, CUFE, QR. Offline: not-an-invoice + lookup QR.
- [x] 1.4 GREEN both in `shared/printing/domain/templates.ts`.
- [x] 1.5 RED `shared/printing/domain/operation-templates.test.ts`: kitchen, pre-bill, close, transfer, tips. Both-widths. No pulse.
- [x] 1.6 GREEN five templates in `shared/printing/domain/templates.ts`.

2. Use cases

- [x] 2.1 RED `shared/printing/application/enqueue-print-job/enqueue-print-job.test.ts`: `waiting`. Repeat `commandId` skips insert. `PrinterNotConfigured`. Store kick. No socket.
- [x] 2.2 GREEN `enqueue-print-job.ts`, `savePrinter`, `application/entry-port.ts`.
- [x] 2.3 RED `shared/printing/application/dispatch-print-jobs/dispatch-print-jobs.test.ts`: memory transport retries, then backup, else `failed`.
- [x] 2.4 GREEN `dispatch-print-jobs.ts`. No TCP/USB.
- [x] 2.5 RED `shared/printing/application/reprint-document/reprint-document.test.ts`: under limit, `sale.reprint` carries actor, device, document, time. Null throws `ReprintCapUnconfigured`.
- [x] 2.6 GREEN `reprint-document.ts`. No authorizer. No over-cap path.

3. Postgres

- [x] 3.1 RED `shared/printing/adapters/postgres/drizzle-print-job-repository.contract.test.ts`: PGlite `0012_printing.sql`, `printing_app`, forced RLS. No SQLite.
- [x] 3.2 GREEN `schema.ts`, `0012_printing.sql`, drizzle repo: `printers`, `print_jobs`.

4. Register drawer

- [x] 4.1 RED `contexts/platform/domain/organization.test.ts`, `application/update-structure/update-structure.test.ts`: drawer present|absent, register/station `printerId`, mixed venue, missing=`absent`.
- [x] 4.2 GREEN `domain/organization.ts`, `organization-repository.ts`, `update-structure.ts`.
- [x] 4.3 RED `contexts/platform/adapters/postgres/drizzle-organization-repository.contract.test.ts`: `0013_register_drawer.sql` defaults `absent`; nullable `printerId`.
- [x] 4.4 GREEN platform `schema.ts`, `0013_register_drawer.sql`.

5. Producers

- [x] 5.1 RED `contexts/orders/application/take-order/take-order.test.ts`, `request-check/request-check.test.ts`: kitchen, pre-bill, no kick. `failed`/`waiting` publishes `printer_failed`.
- [x] 5.2 GREEN `ports/printer.ts`, `take-order.ts`, `request-check.ts`. No ESC/POS.
- [x] 5.3 RED `contexts/cash-register/application/charge-check/charge-check.test.ts`: present+cash kicks that printer, audits `cash.drawer-opened` once. Absent prints; no kick/audit/open-without-sale.
- [x] 5.4 GREEN `charge-check.ts`, `ports/register-lookup.ts`.
- [x] 5.5 RED `contexts/cash-register/application/close-shift/close-shift.test.ts` and charge: `card/transfer/wallet/voucher/customer_credit/corporate_credit` and `cash_close` never kick. Mixed kicks only with cash.
- [x] 5.6 GREEN `charge-check.ts`, `close-shift.ts`.
- [x] 5.7 RED `contexts/invoicing/application/print-document/print-document.test.ts`: number, CUFE, QR. Offline not-an-invoice + QR. No kick.
- [x] 5.8 GREEN `print-document.ts`, invoicing `entry-port.ts`. No enqueue.

6. HTTP

- [ ] 6.1 RED `apps/api-cloud/test/http` charge, request-check, take-order, cash-count: `printed: false` while `waiting`. Drawer audit only after saved cash+`present`.
- [ ] 6.2 GREEN those controllers, `src/composition/application-module.ts`. One `RecordAuditEvent`. No bridge.
- [ ] 6.3 RED `apps/api-cloud/test/http/printing.controller.test.ts`, `update-structure.controller.test.ts`: under cap, one `sale.reprint`. Missing cap 409 `ReprintCapUnconfigured`, no-store. Structure sets drawer/printer/paper/backup. `safeParse`.
- [ ] 6.4 GREEN `shared/contracts/printing.ts`, `index.ts`, `src/http/printing.controller.ts`. `sale.reprint`.
- [ ] 6.5 RED `apps/local-node/test/http/printing.controller.test.ts`: 403 `PrintingRejected`. No store. No drawer.
- [ ] 6.6 GREEN node `printing.controller.ts`, `application-module.ts`. Allow in `skeleton.test.ts`. No Postgres.
