# Tasks: Not Restocked Today

## Review Workload Forecast

Estimated changed lines: 2200–3000. Delivery strategy: auto-chain.

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

`api-cloud` only. No local-node, sync, or WhatsApp. No stock movement. Bogota date.

### Suggested Work Units

1. PR 1 on tracker: 1.1–1.2.
2. PR 2 on PR 1: 2.1–2.2.
3. PR 3 on PR 2: 3.1–3.2.
4. PR 4 on PR 3: 3.3–3.6.
5. PR 5 on PR 4: 4.1–4.2.
6. PR 6 on PR 5: 4.3–4.8.
7. PR 7 on PR 6: 5.1–5.4. Split at 5.3 if over 400.
8. PR 8 on PR 7: 6.1–6.5.
9. PR 9 on PR 8: 6.6–6.7.

## 1. Inventory domain

- [x] 1.1 RED `contexts/inventory/domain/no-restock-today.test.ts`. No Nest. Portions below 1 and no `dispatched` or `in_transit` transfer proposes; no actor confirms nothing.
- [x] 1.2 GREEN `contexts/inventory/domain/no-restock-today.ts` and `domain/index.ts`.

## 2. Orders domain

- [x] 2.1 RED `contexts/orders/domain/check.test.ts`: oldest uncovered `sent` to `not_delivered`; confirm leaves started lines; station may move `in_preparation` or `ready`.
- [x] 2.2 GREEN `contexts/orders/domain/check.ts`. `advance` stays one rank. `total` skips `not_delivered`.

## 3. Inventory application

- [x] 3.1 RED `propose-no-restock-today.test.ts`: flag off and covered stock write nothing.
- [x] 3.2 GREEN that folder and `application/ports/portion-supply.ts`. Add its `#` import.
- [x] 3.3 RED `confirm-no-restock-today.test.ts` and `permission-catalog.test.ts`: waiter rejected; chief confirms; retry is idempotent. Flag off rejects.
- [x] 3.4 GREEN confirm. `cells(Y, Y, Y, N, N, N, Y, N)` on `inventory.confirm-no-restock`. No line changes.
- [x] 3.5 RED `remove-no-restock-today.test.ts`: same roles; audit `inventory.remove-no-restock`.
- [x] 3.6 GREEN remove. Export three use cases. Add three `#application` maps.

## 4. Orders application

- [x] 4.1 RED `withdraw-unstarted-lines.test.ts`: uncovered `sent` to `not_delivered`; one `not_restocked` per check.
- [x] 4.2 GREEN that folder and `not_restocked` on `application/ports/realtime-hub.ts`.
- [x] 4.3 RED `confirm-guest-told.test.ts`: notice stays until `orders.guest-told`.
- [x] 4.4 GREEN that folder for `checkId`, `lineId`, `actorId`.
- [x] 4.5 RED `mark-line-undeliverable.test.ts`: `in_preparation` or `ready` only; `delivered` rejected.
- [x] 4.6 GREEN that folder. Export three use cases and `#` maps.
- [x] 4.7 RED `take-order.test.ts` and `apply-qr-order.test.ts`: marked product rejected; other lines proceed. No reconnect.
- [x] 4.8 GREEN `take-order.ts` `fire` and `apply-qr-order.ts` via the inventory entry port.

## 5. Memory, then Postgres

- [x] 5.1 RED `no-restock-repository.contract.ts` on memory: other tenant hidden; later date is `expired`.
- [x] 5.2 GREEN `adapters/memory/in-memory-no-restock-repository.ts`. No Drizzle mock.
- [x] 5.3 RED that contract on PGlite with `app.tenant_id`.
- [x] 5.4 GREEN `no_restock_today` (`tenant_id`, RLS) and orders withdrawal columns. No SQLite.

## 6. HTTP inject, then screen

- [x] 6.1 RED `apps/api-cloud/test/http/no-restock.controller.test.ts` with `inject`, not `listen`: list, confirm, remove, guest told, cannot finish. Waiter gets 403.
- [x] 6.2 GREEN `apps/api-cloud/src/http/no-restock.controller.ts`.
- [x] 6.3 RED `orders-realtime.controller.test.ts`: forward `not_restocked`.
- [x] 6.4 GREEN that controller and `ordersRealtimeEvent` in `shared/contracts/dining-room.ts`.
- [x] 6.5 GREEN `application-module.ts`: flag default off; confirm, then withdraw, then audit tables. No SQLite.
- [x] 6.6 RED `apps/venue-app/test/venue-cloud.test.tsx`: notice stays until guest told.
- [x] 6.7 GREEN `venue-cloud.ts` and `service-session.tsx`.

No E2E.
