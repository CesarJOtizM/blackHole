# Tasks: QR Table Ordering

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2400–3800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR1–PR18, one pair each |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

PR1 base = tracker `p1-12-qr-table-ordering`. `/m/:token` is not `/d/` or `/f/`. No invoicing, admin-web, SQLite, outbox, local-node, or sync. No `StartQrTablePayment`. `QrOrderPendingApply` unpublished. Default `direct`. Price from `Menu.viewAt`. PA-52 deferred. Threats N/A. Given/When/Then. `#imports` only.

### Suggested Work Units

`pnpm vitest run --project <name> <file>`.

|Unit|Goal|PR|Test|Harness|Rollback|
|---|---|---|---|---|---|
|1|Channel|PR1-tracker|orders:check.test.ts;printing:operation-templates.test.ts|pure|check.ts,kitchen-ticket.ts,templates.ts|
|2|Token|PR2←PR1|orders:table-qr-token.test.ts|pure|table-qr-token.ts|
|3|Intent|PR3←PR2|orders:qr-order-intent.test.ts|pure|qr-order-intent.ts|
|4|Resolve|PR4←PR3|orders:resolve-table-qr.test.ts|memory|resolve,token-port|
|5|Rotate|PR5←PR4|orders:issue-table-qr.test.ts|memory|issue-folder|
|6|Record|PR6←PR5|orders:record-qr-order-intent.test.ts|memory|record,intent-port|
|7|Send|PR7←PR6|orders:take-order.test.ts|memory|lookup,take-order,printer|
|8|Open|PR8←PR7|orders:apply-qr-order.test.ts|memory|apply-folder|
|9|Replay|PR9←PR8|orders:apply-qr-order.test.ts|memory|apply-folder|
|10|Accept|PR10←PR9|orders:review-qr-order-intent.test.ts|memory|review,stale,void-line|
|11|Token-rows|PR11←PR10|orders:drizzle-table-qr-repository.contract.test.ts|PGlite|0004,settings|
|12|Intent-row|PR12←PR11|orders:drizzle-qr-order-intent-repository.contract.test.ts|PGlite|intent-table,orders_channel|
|13|Contract|PR13←PR12|api-cloud:test/contracts/qr-table-ordering.test.ts|Nest-inject-no-listen|contracts|
|14|Menu|PR14←PR13|api-cloud:test/http/table-qr.controller.test.ts|Nest-inject-no-listen|GET|
|15|Submit|PR15←PR14|api-cloud:test/http/table-qr.controller.test.ts|Nest-inject-no-listen|POST,status|
|16|Staff|PR16←PR15|api-cloud:test/http/table-qr-admin.controller.test.ts|Nest-inject-no-listen|admin,module|
|17|Badges|PR17←PR16|orders:view-station-queue.test.ts|venue-app-build|three-screens|
|18|Cart|PR18←PR17|api-cloud:test/http/table-qr.controller.test.ts|customer-portal-build|screen,router|

## 1. Domain

- [ ] 1.1 RED `check.test.ts`, `kitchen-ticket.test.ts`, `operation-templates.test.ts`: "QR table".
- [ ] 1.2 GREEN `check.ts`, `kitchen-ticket.ts`, `templates.ts`.
- [ ] 1.3 RED `table-qr-token.test.ts`: rotate digest; no expiry; not `/f/`.
- [ ] 1.4 GREEN `table-qr-token.ts`. SHA-256.
- [ ] 1.5 RED `qr-order-intent.test.ts`: one id; empty none; no price, void, discount, or courtesy.
- [ ] 1.6 GREEN `qr-order-intent.ts`: `pending_acceptance`, `applied`, `rejected`.

## 2. Application

GREEN adds `#application/<folder>/*` and `entry-port.ts`.

- [ ] 2.1 RED `resolve-table-qr.test.ts`: ids, or retired or disabled.
- [ ] 2.2 GREEN resolve, `table-qr-repository.ts`, memory token repo.
- [ ] 2.3 RED `issue-table-qr.test.ts`: `sale.reprint` rotates.
- [ ] 2.4 GREEN issue folder.
- [ ] 2.5 RED `record-qr-order-intent.test.ts`: one row; `Menu.viewAt`; sold-out blocked.
- [ ] 2.6 GREEN record, intent port, memory intent repo.
- [ ] 2.7 RED `take-order.test.ts`: `loadOpenCheckByTable`; printer channel.
- [ ] 2.8 GREEN port, memory, `take-order.ts`, `printer.ts`.
- [ ] 2.9 RED `apply-qr-order.test.ts`: free, `diners: 1`, direct, once.
- [ ] 2.10 GREEN apply via `TakeOrder`. No payment.
- [ ] 2.11 RED apply: append; `to_clean`; replay; sold-out reported.
- [ ] 2.12 GREEN those branches.
- [ ] 2.13 RED review, stale, `void-line.test.ts`: `sale.charge`; 900s; 20 vs 2 min; same void.
- [ ] 2.14 GREEN review and stale. No void exception.

## 3. Postgres

`contexts/orders/adapters/postgres/`. No SQLite.

- [ ] 3.1 RED token contract: retired; other tenant hidden.
- [ ] 3.2 GREEN `0004_qr_table_ordering.sql`, `schema.ts`, `drizzle-table-qr-repository.ts`: `table_qr_tokens`, `qr_table_settings`, default `direct`.
- [ ] 3.3 RED intent contract: unique id; `qr_table` round-trip.
- [ ] 3.4 GREEN `qr_order_intents` and package exports. Widen `orders_channel`.

## 4. HTTP

- [ ] 4.1 RED `test/contracts/qr-table-ordering.test.ts`: `.strict()`; no price; unpublished.
- [ ] 4.2 GREEN `shared/contracts/qr-table-ordering.ts`, `index.ts`, `dining-room.ts`.
- [ ] 4.3 RED `table-qr.controller.test.ts`: GET `/m/:token`; disabled refuses.
- [ ] 4.4 GREEN GET `apps/api-cloud/src/http/table-qr.controller.ts`.
- [ ] 4.5 RED POST once; empty none; price or void rejected.
- [ ] 4.6 GREEN POST and status.
- [ ] 4.7 RED admin test: reprint, charge, staff stale.
- [ ] 4.8 GREEN admin, `application-module.ts`, `postgres-qr-table.ts`. No new pool in `main.ts`.

## 5. Screens

Skip `vitest.config.ts`.

- [ ] 5.1 RED `view-station-queue.test.ts`: exposes `qr_table`.
- [ ] 5.2 GREEN `floor-screen.tsx`, `kitchen-screen.tsx`, `register-screen.tsx`.
- [ ] 5.3 RED menu DTO: site price and sold-out.
- [ ] 5.4 GREEN `table-order-screen.tsx`, `router.tsx` `/m/$token`. No pay.
