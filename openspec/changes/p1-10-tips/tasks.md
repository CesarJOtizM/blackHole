# Tasks: Tips

## Review Workload Forecast

2400–3200 lines. ask-on-risk. `pnpm vitest run --project <project>`.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High
size:exception: not granted. One RED/GREEN pair per slice. Report an overage. Do not split the pair.

D-37 cloud writer. One RED/GREEN slice. In-memory until 6.1. Entry ports. `cash.settle-tips` before write. `RecordAuditEvent` only. Add `#application/<folder>/*` first. Bases pending.

Skip: role percentages, hybrid offline, SQLite, outbox, node queue, deferred emission, contingency receipt, `shared/sync`, UI, tax, QR tips, reports.

Units: PR1 1.1–1.2; PR2 1.3 after PR1; PR3 1.4 after PR2; PR4 2.1 after PR3; PR5 3.1; PR6 4.1 after PR2 and PR5; PR7 4.2 after PR6; PR8 5.1–5.2 after PR3; PR9 6.1 after PR6; PR10 7.1 after PR4 and PR9; PR11 7.2 after PR10; PR12 7.3 after PR8 and PR11; PR13 8.1 after PR12.

## 1. Domain

- [x] 1.1 RED/GREEN `contexts/cash-register/domain/tip-period.ts` + test: half-open America/Bogota day and week (UTC−5). Shift is caller `from`/`to`. cash-register
- [x] 1.2 RED/GREEN `contexts/cash-register/domain/tip-rule.ts` + test: `equal`, `percentage`, `hours`. `{ employeeId, percent }` integers sum 100. Reject other sums and role keys (D-24). cash-register
- [x] 1.3 RED/GREEN `contexts/cash-register/domain/distribute-tips.ts` + test: `sum(baseCop) + residueCop = poolCop`. Integer extra pesos by `userId` `localeCompare` on the share. Zero minutes stay 0. Removed percent stays in `residueCop`. Zero pool, no shares. Repeat matches. cash-register
- [x] 1.4 RED/GREEN `contexts/cash-register/domain/tip-settlement.ts` `domain/index.ts` + test: append-only snapshot. Adjustment has `adjustsSettlementId` and the original snapshot. Same `settlement_` id returns the first row. Share edit rejected. cash-register

## 2. Configure

- [x] 2.1 RED/GREEN `contexts/cash-register/application/configure-tip-rule/` `entry-port.ts` `package.json`: `cash.settle-tips` before write. Employee percents. Sum 100. Audit `tips.rule-changed` only. cash-register

## 3. Attendance

- [x] 3.1 RED/GREEN `contexts/attendance/application/list-tip-participants/` `entry-port.ts` `package.json`: `userId` and `workedMinutes` via `projectHours`, same policy path as `export-hours`. attendance

## 4. Use cases

- [x] 4.1 RED/GREEN `contexts/cash-register/application/settle-tips/` `ports/tip-pool.ts` `ports/tip-participant-source.ts` `entry-port.ts` `package.json`: permission first. `PaymentTip.amountCop` by `recorded_at` and method (20,000 cash + 30,000 card = 50,000). No `saleCop` or tax. Empty means no shares. Add or remove needs a reason. Removed employee excluded. Same id returns first row. Audit `tips.settlement-closed`. cash-register
- [x] 4.2 RED/GREEN `contexts/cash-register/application/adjust-tip-settlement/` `entry-port.ts` `package.json`: permission first. New row, `adjustsSettlementId`, original snapshot after a later rule change. Audit `tips.settlement-adjusted`. cash-register

## 5. Print

- [x] 5.1 RED/GREEN `shared/printing/domain/templates.ts` `domain/operation-templates.test.ts` `application/enqueue-print-job/enqueue-print-job.ts` `application/entry-port.ts`: methods, rule, residue, share, signature; 80 mm and 58 mm; `kickDrawer` false. Export `DispatchPrintJobs`. printing
- [x] 5.2 RED/GREEN `contexts/cash-register/application/print-tip-settlement/` `ports/printer.ts` `entry-port.ts` `package.json`: permission before enqueue. `tips_settlement`, `kickDrawer: false`. Backup or queued failure. No `@blackhole/printing` import. cash-register

## 6. Postgres

- [x] 6.1 RED/GREEN `contexts/cash-register/adapters/postgres/0015_tips.sql` `schema.ts` `drizzle-cash-register-ledger.contract.test.ts` `application/charge-check/`: `tip_rules`, append-only `tip_settlements`. New `payments.recorded_at` from the platform clock. Backfill `1970-01-01T00:00:00.000Z`. Role `cash_register_app`. Tax unchanged. PGlite. cash-register

## 7. HTTP

- [ ] 7.1 RED/GREEN `shared/contracts/tips.ts` `index.ts` `apps/api-cloud/src/http/configure-tip-rule.controller.ts` `src/composition/application-module.ts` `test/http/configure-tip-rule.controller.test.ts`: Zod 4 `.strict()` and `safeParse`. `PUT tenants/:tenantId/venues/:venueId/tip-rule`. Denial writes nothing. api-cloud
- [ ] 7.2 RED/GREEN `apps/api-cloud/src/http/settle-tips.controller.ts` `adjust-tip-settlement.controller.ts` + tests + composition: `POST .../tip-settlements` and `POST .../tip-settlements/:id/adjustments`. Wire both entry ports. api-cloud
- [ ] 7.3 RED/GREEN `apps/api-cloud/src/http/print-tip-settlement.controller.ts` + test + composition: `POST .../tip-settlements/:id/print`. `EnqueuePrintJob`, then `DispatchPrintJobs`. api-cloud

## 8. Node

- [x] 8.1 RED/GREEN `apps/local-node/src/http/sensitive-actions.controller.ts` `src/composition/application-module.ts` `test/http/sensitive-actions.controller.test.ts`: rule, settle, adjust, and print return 403 `{ error: "SensitiveActionRejected" }` and store nothing. No providers. local-node
