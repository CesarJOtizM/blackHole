# Tasks: Anti-Theft Controls

## Review Workload Forecast

Estimated changed lines: 3200–4200. Delivery strategy: auto-chain.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

Cloud only. One RED/GREEN checkbox. In-memory until 3.1. Entry ports only. Consume-then-write. Thresholds are venue rows (D-31). Tracker `feat/anti-theft` is not created.

Excluded: SQLite, outbox, node-queue, deferred-emission, contingency-receipt, credit-note, waste, schedule-alerts, site-UI, hybrid-offline, post-sync. Threat matrix N/A. `shared/printing` stays.

Test: `pnpm vitest run --project <project>`. Runtime harness: N/A. PR-cell is branch/base. Prefix `feat/anti-theft-` except unit 1 base `feat/anti-theft`.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Bind | binding/feat/anti-theft | platform | N/A | domain-auth |
| 2 | Consume | consume/binding | platform | N/A | consume-count |
| 3 | PIN | grant/consume | platform | N/A | operate-authorization |
| 4 | SQL | sql/grant | platform | N/A | 0014 |
| 5 | Alerts | alerts/sql | platform | N/A | detector-report |
| 6 | Voids | voids/alerts | orders | N/A | void-folders |
| 7 | Comps | comps/voids | orders | N/A | discount-courtesy |
| 8 | Checks | checks/comps | orders | N/A | price-take-order-reassign |
| 9 | Drawer | drawer/checks | cash-register | N/A | open-drawer-printer |
| 10 | Reversals | reversals/drawer | cash-register | N/A | reopen-tender |
| 11 | Void HTTP | void-http/reversals | api-cloud | N/A | auth-void-http |
| 12 | Comp HTTP | comp-http/void-http | api-cloud | N/A | discount-http |
| 13 | Check HTTP | check-http/comp-http | api-cloud | N/A | prebill-http |
| 14 | Cash HTTP | cash-http/check-http | api-cloud | N/A | cash-http-reprint |
| 15 | Report HTTP | report-http/cash-http | api-cloud | N/A | report-http |
| 16 | Node | node/report-http | local-node | N/A | node-controller |

## Phase 1: Domain

- [x] 1.1 RED/GREEN `contexts/platform/domain/authorization.ts` `evaluate.ts` + tests: `targetId`, one consume, mismatch unconsumed, second consume throws, `compShiftCop`. platform

## Phase 2: Application

- [x] 2.1 RED/GREEN `contexts/platform/application/consume-authorization/` `entry-port.ts`: failed-write needs new-grant. platform
- [x] 2.2 RED/GREEN `contexts/platform/application/count-executed-operations/`: successful audits only. platform
- [x] 2.3 RED/GREEN `contexts/platform/application/operate-authorization/operate-authorization.ts` + test: `targetId`, shift totals, `pin.confirmation-failed` without PIN. platform
- [x] 2.4 RED/GREEN `contexts/platform/application/detect-unusual-behavior/`: void seed 5; every self-authorization; other seeds venue 5. platform
- [x] 2.5 RED/GREEN `contexts/platform/application/read-control-report/`: voids, discounts, courtesies, cash differences, openings, reopened and post-pre-bill. `audit.view`. platform

## Phase 3: Postgres

- [x] 3.1 RED/GREEN `contexts/platform/adapters/postgres/drizzle-authorization-repository.contract.test.ts` `0014_authorization_binding.sql` `schema.ts`: `target_id` from `venue_id`, `consumed_at` null, updatable thresholds, insert-only alerts, RLS `authorization_app`. PGlite. platform

## Phase 4: Orders

- [x] 4.1 RED/GREEN `contexts/orders/application/void-line/` `ports/open-shift-reader.ts` `entry-port.ts`: `held`/`sent` within cap; `in_preparation` and later stay. `@blackhole/platform/application/entry-port`. orders
- [ ] 4.2 RED/GREEN `contexts/orders/application/void-account/` `entry-port.ts`: matching grant. orders
- [ ] 4.3 RED/GREEN `contexts/orders/application/apply-discount/` `entry-port.ts`: over percent cap waits; same value and target apply. orders
- [ ] 4.4 RED/GREEN `contexts/orders/application/apply-courtesy/` `entry-port.ts`: `compShiftCop` from executed operations. orders
- [ ] 4.5 RED/GREEN `contexts/orders/application/change-price/` `entry-port.ts`: line only; menu stays. orders
- [ ] 4.6 RED/GREEN `contexts/orders/application/take-order/take-order.ts` + test: post-pre-bill add without `sale.edit-printed-check` leaves the account. orders
- [ ] 4.7 RED/GREEN `contexts/orders/application/reassign-check/reassign-check.ts` + test: `sale.transfer-table` audits the new waiter. orders

## Phase 5: Cash-register

- [ ] 5.1 RED/GREEN `contexts/cash-register/application/open-drawer/` `ports/printer.ts` `entry-port.ts`: `drawer_open`, `kickDrawer: true`. Missing drawer is `absent`. No `@blackhole/printing`. cash-register
- [ ] 5.2 RED/GREEN `contexts/cash-register/application/reopen-paid-account/` `entry-port.ts`: reversal on the open shift. cash-register
- [ ] 5.3 RED/GREEN `contexts/cash-register/application/change-tender/` `entry-port.ts`: reversal and new payment on the open shift, linked to the original. cash-register

## Phase 6: HTTP

- [ ] 6.1 RED/GREEN `shared/contracts/authorization.ts` `sensitive-actions.ts` `index.ts` `apps/api-cloud/src/http/authorization.controller.ts` + test: Zod 4 `safeParse`, `targetId`, shift totals. api-cloud
- [ ] 6.2 RED/GREEN `apps/api-cloud/src/http/void-line.controller.ts` `void-account.controller.ts` `src/composition/application-module.ts` + tests: denied leaves the account; authorized audits. api-cloud
- [ ] 6.3 RED/GREEN `apps/api-cloud/src/http/apply-discount.controller.ts` `apply-courtesy.controller.ts` `change-price.controller.ts` + tests. api-cloud
- [ ] 6.4 RED/GREEN `apps/api-cloud/src/http/take-order.controller.ts` `reassign-check.controller.ts` + tests: pre-bill denial; audited transfer. api-cloud
- [ ] 6.5 RED/GREEN `apps/api-cloud/src/http/open-drawer.controller.ts` `reopen-paid-account.controller.ts` `change-tender.controller.ts` + tests: `PendingSalePrinter` enqueues `drawer_open`. api-cloud
- [ ] 6.6 RED/GREEN `apps/api-cloud/src/http/printing.controller.ts` `src/composition/sale-receipt.ts` `test/http/printing.controller.test.ts`: over cap audits, no enqueue; null cap 409 `ReprintCapUnconfigured`. api-cloud
- [ ] 6.7 RED/GREEN `apps/api-cloud/src/http/read-control-report.controller.ts` `detect-unusual-behavior.controller.ts` + tests: `audit.view`. api-cloud

## Phase 7: Node

- [ ] 7.1 RED/GREEN `apps/local-node/src/http/sensitive-actions.controller.ts` `src/composition/application-module.ts` `test/http/sensitive-actions.controller.test.ts`: copy `printing.controller.ts`; 403 `{ error: "SensitiveActionRejected" }`; store nothing; no providers. local-node
