# Tasks: Dining Room and Kitchen

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 4200–6200 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Units 1–23 in order |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Resolved as menu and attendance (2026-10-23): stacked PRs to master. One work unit per apply. PR 1 is tasks 1.1–1.2 only.

Cloud slice (D-37). RED then GREEN (ADR-017). `strict_tdd` false. Test names are Given / When / Then. Threat matrix N/A. No `size:exception`.

Each GREEN exports from `contexts/orders/application/entry-port.ts` and adds one `#application/<folder>/*` key. No relative imports. Outside the package, import `@blackhole/orders/application/entry-port`. Domain has no Nest, SQL, or Zod. State changes store UTC ISO from the orders `Clock`.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Table states. Occupied stays; `to_clean` becomes `free`. | 1 | `pnpm vitest run --project orders dining-table` | N/A: pure instants | `dining-table.ts`, its test, `domain/index.ts` |
| 2 | Courses, held total, resend price, 190 s. | 2 | `pnpm vitest run --project orders check` | N/A: pure instants | course and price behavior on `check.ts` |
| 3 | No step back. Origin kept. Free and `to_clean` reject. | 3 | `pnpm vitest run --project orders check` | N/A: pure instants | transition and origin behavior on `check.ts` |
| 4 | Router and UTF-8 ticket. Combo and missing station reject. | 4 | `pnpm vitest run --project orders station-router kitchen-ticket` | N/A: pure instants | `station-router.ts`, `kitchen-ticket.ts`, their tests |
| 5 | Place a table in a zone. Rejection does not save. | 5 | `pnpm vitest run --project orders place-table` | N/A: memory fakes | `place-table/` and `dining-room-repository.ts` |
| 6 | Open and release. Existing account kept. Release sets `to_clean`. | 6 | `pnpm vitest run --project orders open-table release-table` | N/A: memory fakes | `open-table/` and `release-table/` |
| 7 | First send copies `Menu.quote`. Missing station saves nothing. | 7 | `pnpm vitest run --project orders take-order` | N/A: memory fakes | send path, `station-directory.ts`, `printer.ts` |
| 8 | Resend keeps the total. Failed print keeps the line. Hub sees ids. | 8 | `pnpm vitest run --project orders take-order` | N/A: memory fakes | resend and print path, `realtime-hub.ts` |
| 9 | Join and transfer. Origins and states stay. One save. | 9 | `pnpm vitest run --project orders reassign-check` | N/A: memory fakes | `reassign-check/` |
| 10 | Bill request records a pre-bill request. No template. | 10 | `pnpm vitest run --project orders request-check` | N/A: memory fakes | `request-check/` |
| 11 | Forward-only line. Ready notice emitted. | 11 | `pnpm vitest run --project orders change-line-state` | N/A: memory fakes | `change-line-state/` |
| 12 | One product, one station, per venue. | 12 | `pnpm vitest run --project orders configure-station-route` | N/A: memory fakes | `configure-station-route/` and `station-route-repository.ts` |
| 13 | Map, queue order, red at 16 min, check ids. Held stays off the queue. | 13 | `pnpm vitest run --project orders view-table-map view-station-queue get-check` | N/A: memory fakes | those three folders |
| 14 | Memory round-trip. Other tenant hidden. Printer can fail. | 14 | `pnpm vitest run --project orders adapters/memory` | N/A: memory ports | memory dining, route, printer, and hub |
| 15 | Tables and checks on PGlite. Forced RLS. Hidden tenant. | 15 | `pnpm vitest run --project orders drizzle-dining-room` | N/A: PGlite, no listen, no Drizzle mock | table and check tables in `0002_dining_room.sql` |
| 16 | Orders, lines, one transaction, `NOTIFY` ids at commit. | 16 | `pnpm vitest run --project orders drizzle-dining-room` | N/A: PGlite, no listen, no Drizzle mock | order tables, line timestamps, `NOTIFY orders_realtime` |
| 17 | Station routes on PGlite. Hidden tenant. | 17 | `pnpm vitest run --project orders drizzle-station-route` | N/A: PGlite, no listen, no Drizzle mock | route tables in `0002_dining_room.sql` |
| 18 | Floor HTTP: 200, 400, 403, 409. 403 saves nothing. | 18 | `pnpm vitest run --project api-cloud place-table.controller configure-station-route.controller` | N/A: `inject`, no `listen` | those controllers, their Zod, composition |
| 19 | Open, release, bill HTTP. Audit open and bill after save. | 19 | `pnpm vitest run --project api-cloud open-table.controller release-table.controller request-check.controller` | N/A: `inject`, no `listen` | those controllers and their Zod |
| 20 | Send, resend, deliver HTTP. Audit send after save. | 20 | `pnpm vitest run --project api-cloud take-order.controller` | N/A: `inject`, no `listen` | that controller and its Zod |
| 21 | Reassign and kitchen advance. Session-only prepare. Audit reassignment. | 21 | `pnpm vitest run --project api-cloud reassign-check.controller change-line-state.controller` | N/A: `inject`, no `listen` | those controllers and their Zod |
| 22 | Reads and SSE id after send. | 22 | `pnpm vitest run --project api-cloud view-table-map.controller view-station-queue.controller get-check.controller orders-realtime.controller` | N/A: `inject`, no `listen` | those controllers and the SSE adapter |
| 23 | Node 403 `DiningRoomRejected`. Nothing stored. Skeleton allow-list only. | 23 | `pnpm vitest run --project local-node dining-room.controller` then `pnpm vitest run --project skeleton` | N/A: `inject`, no store | node controller, module registration, skeleton line |

## Phase 1: Domain (units 1–4)

- [x] 1.1 RED `contexts/orders/domain/dining-table.test.ts`: Given a free Terrace table, When opened for 4, Then `occupied`; Given occupied, When opened again, Then `TableAlreadyOccupied`; Given `to_clean`, When marked ready, Then `free`; Given `occupied` or `check_requested`, When released, Then `to_clean`.
- [x] 1.2 GREEN `contexts/orders/domain/dining-table.ts`. States `free`, `occupied`, `check_requested`, `to_clean`. Prefix `table_`. Export from `domain/index.ts`.
- [x] 1.3 RED `contexts/orders/domain/check.test.ts`: Given starters and mains, When course 1 is sent, Then mains stay `held` and off the total; Given a resent soup, Then price, state, and total stay; Given `12:00:00Z` and `12:03:10Z`, Then order-taking time is 190 s; Given a combo or no lines, Then `ComboNotSent` or `EmptyOrder`.
- [x] 1.4 GREEN `contexts/orders/domain/check.ts`. Prefixes `check_`, `order_`, `line_`. Integer COP. Channel `waiter` or `fixed_point`. Line states `held`, `sent`, `in_preparation`, `ready`, `delivered`.
- [x] 1.5 RED the same check test: Given `sent` then `in_preparation` and `ready`, Then both stamps and a ready notice exist; Given a step back, Then `LineTransitionRejected`; Given a join or transfer, Then `originTableId` and both table states stay; Given `free` or `to_clean`, Then `TableNotOpen`; Given `check_requested`, When another product is sent, Then `occupied`.
- [x] 1.6 GREEN those transitions on `check.ts`. Do not swap checks. Join shares the target check. Transfer moves lines.
- [x] 1.7 RED `contexts/orders/domain/station-router.test.ts` and `contexts/orders/domain/kitchen-ticket.test.ts`: Given Grill output `both`, When Steak is routed, Then screen and printer are selected; Given no station, Then `MissingStation`; Given two stations, Then `DuplicateStationProduct`; Given a ticket, Then UTF-8 text and no ESC/POS bytes.
- [x] 1.8 GREEN `contexts/orders/domain/station-router.ts` and `kitchen-ticket.ts`. Output `screen`, `printer`, or `both`. Products only.

## Phase 2: Table use cases (units 5–6)

- [x] 2.1 RED `contexts/orders/application/place-table/place-table.test.ts`: Given a venue, When a table is placed in Terrace, Then the zone is kept; Given a rejection, Then nothing is saved.
- [x] 2.2 GREEN `place-table.ts` and `contexts/orders/application/ports/dining-room-repository.ts` (`load`, `save`).
- [x] 2.3 RED `open-table.test.ts` and `release-table.test.ts`: Given a free table, When opened for 4, Then `occupied` with an empty check; Given occupied, When opened, Then the account is kept; Given release, Then `to_clean`; Given `to_clean` marked ready, Then `free`; Given a rejection, Then nothing is saved.
- [x] 2.4 GREEN `open-table.ts` and `release-table.ts`.

## Phase 3: Order and kitchen use cases (units 7–13)

- [x] 3.1 RED `contexts/orders/application/take-order/take-order.test.ts`: Given course 1, When sent, Then the line copies `Menu.quote` from the existing `MenuRepository` and mains stay `held`; Given an unordered product, combo, empty send, or missing station, Then `ProductNotOrderable`, `ComboNotSent`, `EmptyOrder`, or `MissingStation`, and nothing is saved. Variants, modifiers, notes, and channel stay.
- [x] 3.2 GREEN the send path. Add `station-directory.ts` and `printer.ts` under `contexts/orders/application/ports`.
- [x] 3.3 RED the same test: Given a resend, Then only that product is routed and the total is unchanged; Given `both` and a failed printer, Then the line stays and `printer_failed` is published; Given `printer` only, Then the alert includes the unprinted UTF-8 ticket; Given a send, Then `RealtimeHub` gets ids; Given `check_requested`, When another product is sent, Then `occupied`.
- [x] 3.4 GREEN resend and printer failure. Add `realtime-hub.ts`. Text in, UTF-8 out. Do not create `shared/printing`.
- [x] 3.5 RED `reassign-check.test.ts`: Given 6 joined into 5, Then 5 holds both lines and each `originTableId` stays; Given a transfer, Then states stay; Given `to_clean` or `free`, Then `TableNotOpen` and nothing is saved; Given a join, Then one save covers both checks.
- [x] 3.6 GREEN `reassign-check.ts`.
- [x] 3.7 RED `request-check.test.ts`: Given occupied, When the bill is requested, Then `check_requested` and a pre-bill request are stored; Given a rejection, Then nothing is saved.
- [x] 3.8 GREEN `request-check.ts`. Request only. No template, queue, or backup printer.
- [x] 3.9 RED `change-line-state.test.ts`: Given `sent`, When advanced to `ready`, Then both stamps are stored and the waiter notice carries the table id; Given a step back, Then nothing is saved; Given deliver, Then `delivered`.
- [x] 3.10 GREEN `change-line-state.ts`. Publish the notice through `RealtimeHub`.
- [x] 3.11 RED `configure-station-route.test.ts`: Given a venue station, When a product is routed with output and a red threshold, Then the route is per venue; Given the product again, or a station off the venue, Then nothing is saved (`DuplicateStationProduct` for the duplicate).
- [x] 3.12 GREEN `configure-station-route.ts` and `station-route-repository.ts`. Not a `Menu` field.
- [x] 3.13 RED `view-table-map.test.ts`, `view-station-queue.test.ts`, and `get-check.test.ts`: Given zones, Then the map groups by zone; Given 12:00 and 12:02, Then 12:00 is first; Given a 15-minute threshold and a 16-minute wait, Then the line is red; Given held lines, Then they are off the queue and the total; Given a check, Then ids and the account return. Other tenants stay hidden.
- [x] 3.14 GREEN `view-table-map.ts`, `view-station-queue.ts`, and `get-check.ts`. Queue order uses `sentAt`.

## Phase 4: Adapters (units 14–17)

- [x] 4.1 RED `contexts/orders/application/ports/dining-room-repository.contract.ts`, `contexts/orders/application/ports/station-route-repository.contract.ts`, and the matching `contexts/orders/adapters/memory` contract tests: Given a saved table, check, lines, and route, When loaded, Then the copy matches; Given tenant B, Then A cannot see it. The memory printer records UTF-8 text and can fail.
- [x] 4.2 GREEN memory dining, station-route, printer, and hub adapters. Add their `exports` on `contexts/orders/package.json`. Import `#adapters/memory/*`.
- [x] 4.3 RED `drizzle-dining-room-repository.contract.test.ts` for tables and checks: PGlite, existing `orders_app`, forced RLS, hidden tenant, round-trip. No Drizzle mock. Do not `CREATE ROLE`.
- [x] 4.4 GREEN `dining_tables` and `checks` in `contexts/orders/adapters/postgres/0002_dining_room.sql`, `schema.ts`, and `drizzle-dining-room-repository.ts`. `tenant_id` on every table. Rollback drops those tables, not `orders_app`.
- [x] 4.5 RED the same contract for orders and lines: Given a join, Then both checks commit together; Given commit, Then `NOTIFY orders_realtime` carries ids only; Given a line state, Then its timestamp is stored.
- [x] 4.6 GREEN `orders` and `order_lines` in that SQL and mapper. `NOTIFY` runs inside the save transaction.
- [x] 4.7 RED `drizzle-station-route-repository.contract.test.ts`: PGlite round-trip, forced RLS, hidden tenant. No Drizzle mock.
- [x] 4.8 GREEN `station_routes` and `station_route_products` in `0002_dining_room.sql` and `drizzle-station-route-repository.ts`. Reuse `orders_app`.

## Phase 5: Cloud HTTP (units 18–22)

Routes: `tenants/:tenantId/venues/:venueId`. `x-session-id` required. Bad body 400. Domain rejection 409, no save. Missing permission 403, no save. Zod in `shared/contracts/dining-room.ts`, exported from `shared/contracts/index.ts`, `safeParse` and `z.enum`. No client timestamp. `inject`, no `listen`.

- [x] 5.1 RED `place-table.controller.test.ts` and `configure-station-route.controller.test.ts`: `POST .../dining-tables` and `POST .../station-routes` need `organization.structure`. 200, 403, 400, 409.
- [x] 5.2 GREEN those controllers, Zod, `application-module.ts`, and `create-application.ts`. No audit here.
- [x] 5.3 RED `open-table.controller.test.ts`, `release-table.controller.test.ts`, and `request-check.controller.test.ts`: `POST .../open`, `.../release`, `.../ready`, and `POST .../checks/:checkId/bill` need `sale.open-table`. Audit only after a successful save.
- [x] 5.4 GREEN those controllers. Audit open and bill with `RecordAuditEvent`.
- [x] 5.5 RED `take-order.controller.test.ts`: `POST .../lines`, `.../send`, `.../resend`, and deliver need `sale.open-table`. Audit send only after save. 403 saves nothing.
- [x] 5.6 GREEN `take-order.controller.ts`. A printer failure still returns the saved line.
- [x] 5.7 RED `reassign-check.controller.test.ts` and `change-line-state.controller.test.ts`: `POST .../checks/reassign` needs `sale.move-items` and audits after save; `POST .../preparation` and `.../ready` allow a session without `sale.open-table`, including a kitchen chief.
- [x] 5.8 GREEN those controllers. Do not audit prepare or ready.
- [x] 5.9 RED the map, queue, check, and `orders-realtime.controller.test.ts`: a session reads without `sale.open-table`; Given a send, When SSE is read, Then ids only; `GetCheck` shows the account.
- [x] 5.10 GREEN those reads and `@Sse` from `NOTIFY orders_realtime`. Ids only. `printer_failed` rides the same stream.

## Phase 6: Node rejection (unit 23)

- [x] 6.1 RED `apps/local-node/test/http/dining-room.controller.test.ts`: every cloud dining-room route, including SSE, returns 403 `DiningRoomRejected` and stores nothing.
- [x] 6.2 GREEN `apps/local-node/src/http/dining-room.controller.ts` and register it in `application-module.ts`. No repository. No SQLite. Route permissions stay declared; the body is still the rejection.
- [x] 6.3 `tools/skeleton/skeleton.test.ts`: allow `http/dining-room.controller.ts` only. `shared/printing`, `shared/sync`, sqlite, and outbox stay absent.

## Out of scope

No SQLite, outbox, sync, hybrid offline, node clock, internet-cut flow, admin-web, or venue-app. p90 waits for a display. p0-01 stays blocked: no ESC/POS proof and no locked-phone delivery (PA-30). Payment setting `to_clean` stays in 1.3.
