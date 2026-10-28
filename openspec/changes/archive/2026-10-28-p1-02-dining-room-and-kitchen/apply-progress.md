# Apply Progress: Dining Room and Kitchen

## Unit 1 — Table states

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 1 only (tasks 1.1–1.2). No `size:exception`.

### Completed

- [x] 1.1 RED `contexts/orders/domain/dining-table.test.ts`
- [x] 1.2 GREEN `contexts/orders/domain/dining-table.ts`, exported from `domain/index.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders dining-table` failed because `#domain/dining-table.js` was missing.
- GREEN: the same command passed, 6 tests.

### Files

| File | Action |
|------|--------|
| `contexts/orders/domain/dining-table.test.ts` | Created |
| `contexts/orders/domain/dining-table.ts` | Created |
| `contexts/orders/domain/index.ts` | Exported `DiningTable`, `TableState`, `InvalidTableId`, `TableAlreadyOccupied` |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 1.1 and 1.2 done |

### Notes

A free Terrace table opens for 4 diners into `occupied`. Opening it again throws `TableAlreadyOccupied` and keeps the seating. `release` moves `occupied` or `check_requested` to `to_clean`. `markReady` moves `to_clean` to `free` and clears the diner count. Identifiers must use the `table_` prefix. `requestCheck` is how a table reaches `check_requested` in this unit. The empty account stays on the later check aggregate.

`TableAlreadyOccupied` is also thrown when `requestCheck`, `release`, or `markReady` run from a state that cannot make that move. The named scenario is only a second open.

### Remaining

Tasks 1.3 onward stay unchecked. Next batch is unit 2 (tasks 1.3–1.4).

## Unit 2 — Courses, held total, resend price, 190 s

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 2 only (tasks 1.3–1.4). No `size:exception`.

### Completed

- [x] 1.3 RED `contexts/orders/domain/check.test.ts`
- [x] 1.4 GREEN `contexts/orders/domain/check.ts`, exported from `domain/index.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders check` failed because `#domain/check.js` was missing.
- GREEN: the same command passed, 10 tests.
- `pnpm vitest run --project orders dining-table` still passed, 6 tests.

### Files

| File | Action |
|------|--------|
| `contexts/orders/domain/check.test.ts` | Created |
| `contexts/orders/domain/check.ts` | Created |
| `contexts/orders/domain/index.ts` | Exported `Check` and its errors. Dining-table exports kept |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 1.3 and 1.4 done |

### Notes

Sending course 1 moves starters to `sent` and leaves mains `held`. The total sums only lines that are not `held`, so mains stay off the account. Resend of a sent soup does not change price, state, or total. Order-taking time is the elapsed seconds from `openedAt` to `firstSentAt`: `2026-10-28T12:00:00Z` to `2026-10-28T12:03:10Z` is 190. A combo line rejects that course send with `ComboNotSent` and leaves the account unchanged. A send with no lines in that course throws `EmptyOrder`. Identifiers use `check_`, `order_`, and `line_`. Prices are integer COP. Channel is `waiter` or `fixed_point`. Line states include `held`, `sent`, `in_preparation`, `ready`, and `delivered`. This unit only moves `held` to `sent`.

Step-back, `originTableId`, join, and transfer stay for tasks 1.5 and 1.6.

### Remaining

Tasks 1.5 onward stay unchecked. Next batch is unit 3 (tasks 1.5–1.6).

## Unit 3 — No step back, origin kept, closed tables rejected

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 3 only (tasks 1.5–1.6). No `size:exception`.

Unit 2 (tasks 1.3–1.4, `check.ts`, `check.test.ts`, and the domain index export) already landed over the 400-line review budget. This batch does not rewrite or shrink that unit.

### Completed

- [x] 1.5 RED `contexts/orders/domain/check.test.ts`
- [x] 1.6 GREEN `contexts/orders/domain/check.ts`, exported from `domain/index.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders check` failed the 5 new cases and kept the 10 unit 2 cases green. `advance` and `requestCheck` were missing. `LineTransitionRejected` and `TableNotOpen` were not constructors.
- GREEN: the same command passed, 15 tests.
- `pnpm vitest run --project orders dining-table` still passed, 6 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the three domain files passed.

### Files

| File | Action |
|------|--------|
| `contexts/orders/domain/check.test.ts` | Added forward-only, join, transfer, closed-table, and bill-requested cases |
| `contexts/orders/domain/check.ts` | Line advance, ready notice, join, transfer, and table state on the check |
| `contexts/orders/domain/index.ts` | Exported `LineTransitionRejected` and `TableNotOpen`. Dining-table exports kept |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 1.5 and 1.6 done |

### Notes

A sent line advances to `in_preparation` and then `ready`. Each step stores its timestamp (`inPreparationAt`, `readyAt`). Becoming ready appends one ready notice with the check table id, the line id, and the ready time. A step back, including ready to sent, throws `LineTransitionRejected` and leaves the line and the notice unchanged. The next forward step after ready is `delivered`.

Join moves every line onto the target check and leaves the source check empty. Transfer moves only the named lines. Neither operation swaps check ids or table ids. Each line keeps the `originTableId` recorded when it was added. Both table states stay: join leaves an occupied target and a `check_requested` source as they were; transfer leaves the reverse pairing as it was. `free` or `to_clean` on either side throws `TableNotOpen` and moves nothing.

`requestCheck` moves the check from `occupied` to `check_requested`. Sending another product after that returns the check to `occupied`.

The course-send expectation now lists `originTableId` because every line projects it. The unit 2 behavior is unchanged.

### Remaining

Tasks 1.7 onward stay unchecked. Next batch is unit 4 (tasks 1.7–1.8).

## Unit 4 — Router and UTF-8 ticket

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 4 only (tasks 1.7–1.8). No `size:exception`.

Units 1–3 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 1.7 RED `contexts/orders/domain/station-router.test.ts` and `contexts/orders/domain/kitchen-ticket.test.ts`
- [x] 1.8 GREEN `contexts/orders/domain/station-router.ts` and `kitchen-ticket.ts`, exported from `domain/index.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders station-router kitchen-ticket` failed because `#domain/station-router.js` and `#domain/kitchen-ticket.js` were missing.
- GREEN: the same command passed, 13 tests.
- `pnpm vitest run --project orders check` still passed, 15 tests.
- `pnpm vitest run --project orders dining-table` still passed, 6 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the domain files passed.

### Files

| File | Action |
|------|--------|
| `contexts/orders/domain/station-router.test.ts` | Created |
| `contexts/orders/domain/kitchen-ticket.test.ts` | Created |
| `contexts/orders/domain/station-router.ts` | Created |
| `contexts/orders/domain/kitchen-ticket.ts` | Created |
| `contexts/orders/domain/index.ts` | Exported `StationRouter`, `KitchenTicket`, and their errors. Check and dining-table exports kept |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 1.7 and 1.8 done |

### Notes

A venue router assigns each product to one station. Output is `screen`, `printer`, or `both`. Routing Steak on Grill with `both` selects the screen and the printer, and the cash register stays included. `screen` selects only the screen. `printer` selects only the printer. A product with no station throws `MissingStation`. Assigning the same product to a second station throws `DuplicateStationProduct` and leaves the first station. A combo is not stored or routed as a product: `ComboNotSent`. Station identifiers use the `station_` prefix. Product identifiers use the `menu_` prefix. Two venues keep separate routes.

`KitchenTicket.render` returns a ticket whose `text` is plain UTF-8. Control characters, including ESC (`0x1B`) and GS (`0x1D`), are dropped. The ticket keeps UTF-8 text such as "jalapeño". A combo ticket throws `ComboNotSent`. No ESC/POS bytes are emitted. `shared/printing` was not created.

### Remaining

Tasks 2.1 onward stay unchecked. Next batch is unit 5 (tasks 2.1–2.2). Phase 2 was not started.

## Unit 5 — Place a table in a zone

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 5 only (tasks 2.1–2.2). No `size:exception`.

Units 1–4 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 2.1 RED `contexts/orders/application/place-table/place-table.test.ts`
- [x] 2.2 GREEN `place-table.ts` and `contexts/orders/application/ports/dining-room-repository.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders place-table` failed because `#application/ports/dining-room-repository.js` was missing. `place-table.ts` did not exist yet.
- GREEN: the same command passed, 2 tests.
- `pnpm vitest run --project orders dining-table` still passed, 6 tests.
- `pnpm vitest run --project orders check` still passed, 15 tests.
- `pnpm vitest run --project orders station-router kitchen-ticket` still passed, 13 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the three new TypeScript files passed.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/place-table/place-table.test.ts` | Created |
| `contexts/orders/application/place-table/place-table.ts` | Created |
| `contexts/orders/application/ports/dining-room-repository.ts` | Created |
| `contexts/orders/package.json` | Added `#application/place-table/*`. `#application/ports/*` was already present |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 2.1 and 2.2 done |

### Notes

`PlaceTable` calls `DiningTable.place` and then `DiningRoomRepository.save`. A Terrace table is stored free, and `load` returns the same zone. An identifier without the `table_` prefix throws `InvalidTableId` before `save`. The rejection test spies on `save` and also checks that the already placed Terrace table stays.

The test double `MemoryDiningRoom` lives in the test file. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, or Zod was added. `entry-port.ts` was not changed: task 2.2 does not export the use case. The orders `Clock` is unused because `DiningTable.place` does not stamp a time, and `dining-table.ts` was left unchanged.

`load` takes `tenantId`, `venueId`, and `tableId`. `save` takes the `DiningTable`. Later units that persist checks and lines will extend this port.

### Remaining

Tasks 2.3 onward stay unchecked. Next batch is unit 6 (tasks 2.3–2.4).

## Unit 6 — Open and release

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 6 only (tasks 2.3–2.4). No `size:exception`.

Units 1–5 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 2.3 RED `contexts/orders/application/open-table/open-table.test.ts` and `contexts/orders/application/release-table/release-table.test.ts`
- [x] 2.4 GREEN `open-table.ts` and `release-table.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders open-table release-table` failed because `#application/open-table/open-table.js` and `#application/release-table/release-table.js` were missing. No tests ran.
- GREEN: the same command passed, 6 tests.
- `pnpm vitest run --project orders place-table` still passed, 2 tests.
- `pnpm vitest run --project orders dining-table` still passed, 6 tests.
- `pnpm vitest run --project orders check` still passed, 15 tests.
- `pnpm vitest run --project orders station-router kitchen-ticket` still passed, 13 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the new TypeScript files and `contexts/orders/package.json` passed.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/open-table/open-table.test.ts` | Created |
| `contexts/orders/application/open-table/open-table.ts` | Created |
| `contexts/orders/application/release-table/release-table.test.ts` | Created |
| `contexts/orders/application/release-table/release-table.ts` | Created |
| `contexts/orders/package.json` | Added `#application/open-table/*` and `#application/release-table/*`. `#application/place-table/*` kept |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 2.3 and 2.4 done |

### Notes

`OpenTable` loads the table, opens it for the given diners, and returns that table with an empty `Check`. `openedAt` is `new Date(clock.now()).toISOString()`. A free Terrace table opened for 4 is stored `occupied`. The check id uses the `check_` prefix, the total is 0, and `orders` is empty. An identifier without that prefix throws `InvalidCheckId` before `DiningTable.open` and before `save`, so the table stays free.

Opening an occupied table calls `DiningTable.open`, which throws `TableAlreadyOccupied` before the diner count changes. `save` is not called. The check from the first open keeps its id, its sent soup, and its total. A missing table throws `TableAlreadyOccupied` and does not save.

`ReleaseTable` calls `DiningTable.release` and saves. An occupied table becomes `to_clean` and keeps its diner count. Releasing a free table throws `TableAlreadyOccupied` before `save`, and the table stays free. `MarkTableReady` calls `DiningTable.markReady`. A `to_clean` table becomes `free` and its diner count becomes 0.

The test doubles live in the test files. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, or Zod was added. `entry-port.ts` was not changed: task 2.4 does not export the use cases. `place-table.ts` and `dining-room-repository.ts` were not changed. `load` and `save` still take a `DiningTable` only, so the empty check is the use-case result and is not written through the port. Later units that persist checks can extend that port.

### Remaining

Tasks 3.1 onward stay unchecked. Next batch is unit 7 (tasks 3.1–3.2). Phase 3 was not started.

## Unit 7 — First send copies Menu.quote

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 7 only (tasks 3.1–3.2). No `size:exception`.

Units 1–6 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 3.1 RED `contexts/orders/application/take-order/take-order.test.ts`
- [x] 3.2 GREEN the send path, `station-directory.ts`, and `printer.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders take-order` failed because `#application/ports/printer.js` was missing. `take-order.ts` and `station-directory.ts` did not exist yet. No tests ran.
- GREEN: the same command passed, 5 tests.
- `pnpm vitest run --project orders open-table release-table` still passed, 6 tests.
- `pnpm vitest run --project orders place-table` still passed, 2 tests.
- `pnpm vitest run --project orders dining-table` still passed, 6 tests.
- `pnpm vitest run --project orders check` still passed, 15 tests.
- `pnpm vitest run --project orders station-router kitchen-ticket` still passed, 13 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the send-path files passed.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/take-order/take-order.test.ts` | Created |
| `contexts/orders/application/take-order/take-order.ts` | Created |
| `contexts/orders/application/ports/station-directory.ts` | Created |
| `contexts/orders/application/ports/printer.ts` | Created |
| `contexts/orders/application/ports/dining-room-repository.ts` | Added `loadCheck` and `saveCheck`. Table `load` and `save` stay |
| `contexts/orders/domain/check.ts` | A line can keep variant ids, modifier ids, and a note. Empty values stay off the projection |
| `contexts/orders/package.json` | Added `#application/take-order/*` |
| `contexts/orders/application/place-table/place-table.test.ts` | Memory double implements the new check methods. Place behavior unchanged |
| `contexts/orders/application/open-table/open-table.test.ts` | Memory double implements the new check methods. Open behavior unchanged |
| `contexts/orders/application/release-table/release-table.test.ts` | Memory double implements the new check methods. Release behavior unchanged |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 3.1 and 3.2 done |

### Notes

`TakeOrder` loads the open check and the menu from `MenuRepository`. Sending course 1 quotes each line with `Menu.quote` for that venue, including modifier prices, then sends only that course. A soup whose venue price is 22_000 COP plus a 3_000 COP modifier is stored at 25_000 COP, not the 20_000 COP brand price. The steak in course 2 stays `held` and off the total. The sent line keeps its variant, modifier, note, and the order keeps `fixed_point`. `sentAt` is `new Date(clock.now()).toISOString()`.

A product outside its venue window throws `ProductNotOrderable`. A combo throws `ComboNotSent`. A course with no lines throws `EmptyOrder`. A product with no station throws `MissingStation`. Each rejection happens before `saveCheck` and before the printer runs, and the stored check stays empty. `ProductNotOrderable` lives on the use case.

After a successful save, a station whose output includes a printer receives `KitchenTicket` text. The port takes that UTF-8 string. Screen-only output does not print. This unit does not resend, does not handle a failed printer, and does not publish to `RealtimeHub`.

The test doubles live in the test file. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, or Zod was added. `entry-port.ts` was not changed: task 3.2 does not export the use case. `open-table.ts`, `release-table.ts`, and `place-table.ts` were not changed.

### Remaining

Tasks 3.3 onward stay unchecked. Next batch is unit 8 (tasks 3.3–3.4).

## Unit 8 — Resend, printer failure, and realtime ids

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 8 only (tasks 3.3–3.4). No `size:exception`.

Units 1–7 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 3.3 RED `contexts/orders/application/take-order/take-order.test.ts`
- [x] 3.4 GREEN resend and printer failure, and `realtime-hub.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders take-order` failed because `#application/ports/realtime-hub.js` was missing. No tests ran. `resend`, printer-failure handling, and hub publication were not implemented yet.
- GREEN: the same command passed, 10 tests.
- `pnpm vitest run --project orders place-table open-table release-table dining-table check station-router kitchen-ticket` still passed, 42 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the three unit files passed.

### Review budget

This unit exceeds 400 changed lines. `take-order.test.ts` grew from 400 lines to 681, `take-order.ts` from 172 to 281, and `realtime-hub.ts` adds 25 lines. Net growth is 415 lines. Replaced blocks add further deletions, so additions plus deletions are about 500. Tasks 3.3–3.4 were not split.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/take-order/take-order.test.ts` | Added resend, printer failure, UTF-8 alert, realtime ids, and `check_requested` send |
| `contexts/orders/application/take-order/take-order.ts` | Resend routes one product. A failed print keeps the line and publishes `printer_failed` |
| `contexts/orders/application/ports/realtime-hub.ts` | Created. `ids` and `printer_failed` |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 3.3 and 3.4 done |

### Notes

`TakeOrder.resend` loads the open check, routes only that product, and calls `Check.resend`. Price, state, and total stay. Soup and soda can both be sent; resending the soup prints only `Grill\ntable_5\nSoup`. The soda line is not routed again.

A failed `Printer.print` happens after `saveCheck`. The sent line stays. The hub then receives `printer_failed`. Output `both` publishes the alert without ticket text, because the station screen still has the line. Output `printer` includes `text`: the `KitchenTicket` UTF-8 string, including `jalapeño`, with no ESC/POS bytes. The printer port still takes text and returns nothing. That UTF-8 ticket leaves through the hub. `shared/printing` was not created.

Every successful save publishes `ids`: tenant, venue, check, table, and the line ids fired by that command. Held lines in another course are not in that list.

Sending another product while the check is `check_requested` returns the table to `occupied` through the existing `Check.send`. The domain was not changed.

The test doubles live in the test file. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, Zod, or SSE was added. `entry-port.ts` was not changed: task 3.4 does not export the use case. `package.json` was not changed: `#application/ports/*` already covers `realtime-hub.ts`. `open-table.ts`, `release-table.ts`, and `place-table.ts` were not changed.

### Remaining

Tasks 3.5 onward stay unchecked. Next batch is unit 9 (tasks 3.5–3.6).

## Unit 9 — Join and transfer

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 9 only (tasks 3.5–3.6). No `size:exception`.

Units 1–8 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 3.5 RED `contexts/orders/application/reassign-check/reassign-check.test.ts`
- [x] 3.6 GREEN `reassign-check.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders reassign-check` failed because `#application/reassign-check/reassign-check.js` was missing. No tests ran.
- GREEN: the same command passed, 4 tests.
- `pnpm vitest run --project orders take-order place-table open-table release-table dining-table check station-router kitchen-ticket` still passed, 56 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the unit files passed.

### Review budget

This unit exceeds 400 changed lines. `reassign-check.test.ts` is 389 lines, `reassign-check.ts` is 97, `saveChecks` adds 2 lines on the dining-room port, the four existing memory doubles add 24 lines, and `package.json` adds 1 import. Additions are 513. Deletions are 0. Tasks 3.5–3.6 were not split.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/reassign-check/reassign-check.test.ts` | Created |
| `contexts/orders/application/reassign-check/reassign-check.ts` | Created |
| `contexts/orders/application/ports/dining-room-repository.ts` | Added `saveChecks`. Table `load` and `save`, and `loadCheck` / `saveCheck`, stay |
| `contexts/orders/package.json` | Added `#application/reassign-check/*` |
| `contexts/orders/application/place-table/place-table.test.ts` | Memory double implements `saveChecks`. Place behavior unchanged |
| `contexts/orders/application/open-table/open-table.test.ts` | Memory double implements `saveChecks`. Open behavior unchanged |
| `contexts/orders/application/release-table/release-table.test.ts` | Memory double implements `saveChecks`. Release behavior unchanged |
| `contexts/orders/application/take-order/take-order.test.ts` | Memory double implements `saveChecks`. Take-order behavior unchanged |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 3.5 and 3.6 done |

### Notes

`ReassignCheck` loads both checks and both dining tables. Join calls `Check.join` and moves every line onto the target check. Transfer calls `Check.transfer` and moves only the named lines. Check ids and table ids are not swapped. Each line keeps the `originTableId` recorded when it was added. Joining table 6 into table 5 leaves the steak on `table_5` and the soup on `table_6`, both stored on check 5. The source check is empty. Table states stay: an occupied target and a `check_requested` source stay that way on both the check and the dining table. A transfer leaves a `check_requested` target and an occupied source as they were, and the unnamed line stays on the source.

`free` or `to_clean` on either side throws `TableNotOpen` before `saveChecks`. The lines and both table states stay. `save`, `saveCheck`, and `saveChecks` are not called.

`saveCheck` takes one check, so one save of both checks could not be expressed. `saveChecks` takes both checks. A join calls it once with the target check and then the source check. Table `load` and `save` are unchanged, and a reassignment does not save tables.

The test double lives in the test file. The other memory doubles implement `saveChecks` only so the abstract port still typechecks. Those use cases do not call it. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, Zod, or SSE was added. `entry-port.ts` was not changed: task 3.6 does not export the use case. `open-table.ts`, `release-table.ts`, `place-table.ts`, and `take-order.ts` were not changed. Domain files were not changed.

### Remaining

Tasks 3.7 onward stay unchecked. Next batch is unit 10 (tasks 3.7–3.8).

## Unit 10 — Bill request

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 10 only (tasks 3.7–3.8). No `size:exception`.

Units 1–9 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 3.7 RED `contexts/orders/application/request-check/request-check.test.ts`
- [x] 3.8 GREEN `request-check.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders request-check` failed because `#application/request-check/request-check.js` was missing. No tests ran.
- GREEN: `pnpm vitest run --project orders request-check reassign-check take-order place-table open-table release-table dining-table check station-router kitchen-ticket` passed, 10 files, 58 tests. The two new request-check tests are included. The previous 56 stayed green.
- Biome check on the unit files passed after formatting.

### Review budget

This unit stays inside the 400-line budget. `request-check.test.ts` is 195 lines, `request-check.ts` is 76, `check.ts` adds 19 lines so the pre-bill request can live on the check, and `package.json` adds 1 import. Additions are 291. Deletions are 0. Tasks 3.7–3.8 were not split.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/request-check/request-check.test.ts` | Created |
| `contexts/orders/application/request-check/request-check.ts` | Created |
| `contexts/orders/domain/check.ts` | `requestCheck` stores an optional pre-bill stamp. Zero-arg callers still only change `tableState` |
| `contexts/orders/package.json` | Added `#application/request-check/*` |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 3.7 and 3.8 done |

### Notes

`RequestCheck` loads the check and its dining table. An occupied table and an occupied check move both to `check_requested`. The check stores one pre-bill request, `{ requestedAt }`, taken from `Clock.now()` as a UTC ISO string. `save` stores the table and `saveCheck` stores the check. `saveChecks` is not used. The dining-room port was not widened.

A domain rejection saves nothing. `free`, `to_clean`, or an already `check_requested` table throws `TableAlreadyOccupied` from `DiningTable.requestCheck` before the check changes. A check that is already `check_requested` throws `TableNotOpen` from `Check.requestCheck` before the table changes. `save`, `saveCheck`, and `saveChecks` are not called, and `preBillRequest` stays absent.

The request is only a stamp on the check. There is no print template, queue, backup printer, ESC/POS payload, or `Printer` call.

The test double lives in the test file. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, Zod, or SSE was added. `entry-port.ts` was not changed: task 3.8 does not export the use case. `reassign-check.ts`, `take-order.ts`, `open-table.ts`, `release-table.ts`, and `place-table.ts` were not changed. `DiningTable.requestCheck` was not changed.

### Remaining

Tasks 3.9 onward stay unchecked. Next batch is unit 11 (tasks 3.9–3.10).

## Unit 11 — Forward-only line

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 11 only (tasks 3.9–3.10). No `size:exception`.

Units 1–10 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 3.9 RED `contexts/orders/application/change-line-state/change-line-state.test.ts`
- [x] 3.10 GREEN `change-line-state.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders change-line-state` failed because `#application/change-line-state/change-line-state.js` was missing. No tests ran.
- GREEN: `pnpm vitest run --project orders change-line-state request-check reassign-check take-order place-table open-table release-table dining-table check station-router kitchen-ticket` passed, 11 files, 61 tests. The three new change-line-state tests are included. The previous 58 stayed green.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the unit files passed after formatting.

### Review budget

This unit stays inside the 400-line budget. `change-line-state.test.ts` is 242 lines, `change-line-state.ts` is 71, `realtime-hub.ts` adds the `line_ready` notice (10 lines, one replaced union), and `package.json` adds 1 import. Additions are 325. Deletions are 1. Tasks 3.9–3.10 were not split.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/change-line-state/change-line-state.test.ts` | Created |
| `contexts/orders/application/change-line-state/change-line-state.ts` | Created |
| `contexts/orders/application/ports/realtime-hub.ts` | Added `line_ready`. `ids` and `printer_failed` stay |
| `contexts/orders/package.json` | Added `#application/change-line-state/*` |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 3.9 and 3.10 done |

### Notes

`ChangeLineState` loads the check and calls `Check.advance` once. The clock supplies one UTC ISO stamp per call. A sent line becomes `in_preparation` and stores `inPreparationAt`. The next call to `ready` stores `readyAt` and the domain ready notice. Both stamps stay on the saved line. The hub then receives `line_ready` with the notice table id, line id, and ready time. `saveCheck` runs twice for that path. `save` and `saveChecks` are not used.

A step back, including ready to sent, throws `LineTransitionRejected` from `Check.advance`. `save`, `saveCheck`, `saveChecks`, and `publish` are not called. The line stays `ready` and the existing notice stays.

Deliver moves a ready line to `delivered` and stores `deliveredAt`. The ready notice stays. Deliver does not publish another hub notice.

Prepare and ready do not check a permission. There is no session lookup in this unit.

The test double lives in the test file. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, Zod, or SSE was added. `entry-port.ts` was not changed: task 3.10 does not export the use case. `request-check.ts`, `reassign-check.ts`, `take-order.ts`, `open-table.ts`, `release-table.ts`, and `place-table.ts` were not changed. Domain files were not changed.

### Remaining

Tasks 3.11 onward stay unchecked. Next batch is unit 12 (tasks 3.11–3.12).

## Unit 12 — One product, one station, per venue

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 12 only (tasks 3.11–3.12). No `size:exception`.

Units 1–11 stay as they landed. This batch does not rewrite them.

### Completed

- [x] 3.11 RED `contexts/orders/application/configure-station-route/configure-station-route.test.ts`
- [x] 3.12 GREEN `configure-station-route.ts` and `contexts/orders/application/ports/station-route-repository.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders configure-station-route` failed because `#application/configure-station-route/configure-station-route.js` was missing. No tests ran.
- GREEN: `pnpm vitest run --project orders configure-station-route change-line-state request-check reassign-check take-order place-table open-table release-table dining-table check station-router kitchen-ticket` passed, 12 files, 64 tests. The three new configure-station-route tests are included. The previous 61 stayed green.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the unit files passed after formatting.

### Review budget

This unit stays inside the 400-line budget. `configure-station-route.test.ts` is 137 lines, `configure-station-route.ts` is 81, `station-route-repository.ts` is 20, and `package.json` adds 1 import. Additions are 239. Deletions are 0. Tasks 3.11–3.12 were not split.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/configure-station-route/configure-station-route.test.ts` | Created |
| `contexts/orders/application/configure-station-route/configure-station-route.ts` | Created |
| `contexts/orders/application/ports/station-route-repository.ts` | Created |
| `contexts/orders/package.json` | Added `#application/configure-station-route/*` |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 3.11 and 3.12 done |

### Notes

`ConfigureStationRoute` stores one product on one station for one venue. The station is `{ id, venueId, name }`. Output is `screen`, `printer`, or `both`, checked by the existing `StationRouter`. The red threshold is minutes on the saved route. Grill with `both` and 15 minutes is visible only on that tenant and venue. The same product on another venue keeps its own station. The route is not a `Menu` field. `MenuRepository` is not used.

Routing the same product again on that venue throws `DuplicateStationProduct` from `StationRouter.assign`. A station whose `venueId` is not the command venue throws `StationOffVenue` before the router runs. Neither path calls `save`. The first route stays as it was.

`organization.structure` is not checked. This use case does not read a session. `entry-port.ts` was not changed: task 3.12 does not export the use case. Domain files were not changed. `change-line-state.ts`, `request-check.ts`, `reassign-check.ts`, `take-order.ts`, `open-table.ts`, `release-table.ts`, and `place-table.ts` were not changed.

The test double lives in the test file. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, Zod, or SSE was added. The map, station queue, and get-check queries were not started.

### Remaining

Tasks 3.13 onward stay unchecked. Next batch is unit 13 (tasks 3.13–3.14).

## Unit 13 — Map, queue order, red at 16 min, check ids

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 13 only (tasks 3.13–3.14). No `size:exception`.

Units 1–12 stay as they landed. This batch does not rewrite them. Tasks 3.13–3.14 were not split.

### Completed

- [x] 3.13 RED `view-table-map.test.ts`, `view-station-queue.test.ts`, and `get-check.test.ts`
- [x] 3.14 GREEN `view-table-map.ts`, `view-station-queue.ts`, and `get-check.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders view-table-map view-station-queue get-check` failed because `#application/view-table-map/view-table-map.js`, `#application/view-station-queue/view-station-queue.js`, and `#application/get-check/get-check.js` were missing. No tests ran.
- GREEN: the same command passed, 3 files, 9 tests.
- `pnpm vitest run --project orders configure-station-route change-line-state request-check reassign-check take-order place-table open-table release-table dining-table check station-router kitchen-ticket view-table-map view-station-queue get-check` passed, 15 files, 73 tests. The previous 64 stayed green.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the unit files passed after formatting.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 3.13–3.14 were not split.

| File | Lines |
|------|------:|
| `view-table-map.test.ts` | 157 |
| `view-table-map.ts` | 69 |
| `view-station-queue.test.ts` | 433 |
| `view-station-queue.ts` | 150 |
| `get-check.test.ts` | 170 |
| `get-check.ts` | 51 |
| `dining-room-repository.ts` | 11 added |
| `package.json` | 3 added |

Additions are 1044. Deletions are 0. The queue test file is the overrun. Earlier units were not rewritten to make room.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/view-table-map/view-table-map.test.ts` | Created |
| `contexts/orders/application/view-table-map/view-table-map.ts` | Created |
| `contexts/orders/application/view-station-queue/view-station-queue.test.ts` | Created |
| `contexts/orders/application/view-station-queue/view-station-queue.ts` | Created |
| `contexts/orders/application/get-check/get-check.test.ts` | Created |
| `contexts/orders/application/get-check/get-check.ts` | Created |
| `contexts/orders/application/ports/dining-room-repository.ts` | Added `listTables` and `listChecks`. `save`, `saveCheck`, and `saveChecks` stay |
| `contexts/orders/package.json` | Added `#application/view-table-map/*`, `#application/view-station-queue/*`, and `#application/get-check/*` |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 3.13 and 3.14 done |

### Notes

`ViewTableMap` lists tables for the tenant and venue and groups them by zone. Zones are ordered by name and tables by id. A Terrace table opened for 4 is `occupied`. A free table in Bar is its own group. Another tenant, and another venue of the same tenant, stay out of the map. The query does not save.

`ViewStationQueue` orders the station by `sentAt`. A line sent at 12:00 is before a line sent at 12:02. A product routed to Cold does not appear on Grill. The red threshold is `redThresholdMinutes` on that product's route from unit 12. It is not a field on `StationRouter`. Soup with a 15-minute threshold is red after a 16-minute wait. Steak on the same station with a 30-minute threshold stays green after the same wait. A line that is `ready` or `delivered` is not red. Held lines stay off the queue. `delivered` lines stay on the queue because this unit only removes `held`.

`GetCheck` returns the check id, table id, tenant id, venue id, line ids, the orders, and `Check.total`. Held lines stay on the account and off the total: soup at 12000 plus a held steak at 45000 returns 12000. Another tenant's check with the same id returns null. None of the three queries call `save`, `saveCheck`, `saveChecks`, or `StationRouteRepository.save`.

`load` and `loadCheck` cannot list a floor or a station, so the dining-room port gained `listTables` and `listChecks`. The existing save methods are unchanged. The new methods reject until an adapter overrides them, so the earlier in-test doubles keep compiling. `StationRouteRepository.load` already answers the threshold. `entry-port.ts` was not changed. Domain files were not changed. `configure-station-route.ts`, `change-line-state.ts`, `request-check.ts`, `reassign-check.ts`, `take-order.ts`, `open-table.ts`, `release-table.ts`, and `place-table.ts` were not changed.

The test doubles live in the test files. No memory adapter, HTTP controller, Postgres repository, Nest, SQL, Zod, SSE, or ESC/POS was added. The dining migration was not started.

### Remaining

Tasks 4.1 onward stay unchecked. Next batch is unit 14 (tasks 4.1–4.2). Phase 4 adapters were not started.

## Unit 14 — Memory dining, routes, printer, and hub

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 14 only (tasks 4.1–4.2). No `size:exception`.

Units 1–13 stay as they landed. This batch does not rewrite them. Tasks 4.1–4.2 were not split.

### Completed

- [x] 4.1 RED `dining-room-repository.contract.ts`, `station-route-repository.contract.ts`, and the matching `adapters/memory` contract tests
- [x] 4.2 GREEN memory dining, station-route, printer, and hub adapters, exported from `contexts/orders/package.json`

### RED / GREEN

- RED: `pnpm vitest run --project orders adapters/memory` failed 4 suites because the memory dining, station-route, printer, and hub modules were missing. No tests ran in those files. The existing menu memory contract stayed green, 2 tests.
- GREEN: the same command passed, 5 files, 10 tests. The 8 new contract tests are included. The menu contract stayed green.
- `pnpm vitest run --project orders view-table-map view-station-queue get-check configure-station-route change-line-state request-check reassign-check take-order place-table open-table release-table dining-table check station-router kitchen-ticket` passed, 15 files, 73 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the unit files passed after formatting.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 4.1–4.2 were not split. Earlier units were not rewritten.

| File | Lines |
|------|------:|
| `dining-room-repository.contract.ts` | 244 |
| `station-route-repository.contract.ts` | 59 |
| `in-memory-dining-room-repository.ts` | 97 |
| `in-memory-dining-room-repository.contract.test.ts` | 4 |
| `in-memory-station-route-repository.ts` | 28 |
| `in-memory-station-route-repository.contract.test.ts` | 4 |
| `in-memory-printer.ts` | 14 |
| `in-memory-printer.contract.test.ts` | 27 |
| `in-memory-realtime-hub.ts` | 20 |
| `in-memory-realtime-hub.contract.test.ts` | 57 |
| `package.json` | 4 added |

Additions are 558. Deletions are 0. The dining-room contract is the overrun.

### Files

| File | Action |
|------|--------|
| `contexts/orders/application/ports/dining-room-repository.contract.ts` | Created |
| `contexts/orders/application/ports/station-route-repository.contract.ts` | Created |
| `contexts/orders/adapters/memory/in-memory-dining-room-repository.contract.test.ts` | Created |
| `contexts/orders/adapters/memory/in-memory-station-route-repository.contract.test.ts` | Created |
| `contexts/orders/adapters/memory/in-memory-printer.contract.test.ts` | Created |
| `contexts/orders/adapters/memory/in-memory-realtime-hub.contract.test.ts` | Created |
| `contexts/orders/adapters/memory/in-memory-dining-room-repository.ts` | Created |
| `contexts/orders/adapters/memory/in-memory-station-route-repository.ts` | Created |
| `contexts/orders/adapters/memory/in-memory-printer.ts` | Created |
| `contexts/orders/adapters/memory/in-memory-realtime-hub.ts` | Created |
| `contexts/orders/package.json` | Exported the four memory adapters. `#adapters/memory/*` was already present |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 4.1 and 4.2 done |

### Notes

A saved Terrace table opened for 4 loads as a new `DiningTable` with the same zone, state, and diner count. A saved check loads as a new `Check`. Soup is `ready` with its sent, preparation, and ready stamps, the note, variant, and modifier. Steak stays `held`. The total is 12000. The pre-bill request and the ready notice come back. `listTables` and `listChecks` return that tenant and venue only. Changing the caller's table or the loaded check does not change the stored copy.

`saveChecks` stores both checks. The same table id and check id for tenant B stay hidden from tenant A. Another venue of tenant A stays hidden too. A missing id loads as null.

A Grill route with output `both` and a 15-minute threshold loads as a new object. Changing the caller's threshold leaves the stored route at 15. Tenant B and another venue stay hidden. The same product key replaces the previous route.

`InMemoryPrinter` records the ticket text, including "Jalapeño", and stores no ESC or GS byte. `fail = true` throws `The printer is offline.` and records nothing.

`InMemoryRealtimeHub` records `ids`, `printer_failed`, and `line_ready`. The ids notice keeps its own line id list.

Imports use `#adapters/memory/*`. No relative import was added. The menu adapter was not changed. In-test doubles were not changed: `listTables` and `listChecks` already reject on the port until an adapter overrides them. No Postgres, Drizzle, PGlite, SQL, HTTP, SSE, Nest, Zod, ESC/POS, or `shared/printing` was added. `0002_dining_room.sql` was not created. `entry-port.ts` was not changed.

### Remaining

Tasks 4.3 onward stay unchecked. Next batch is unit 15 (tasks 4.3–4.4). The shared dining and station-route contracts are ready for a Postgres adapter to call. That adapter must satisfy `listTables`, `listChecks`, and `saveChecks` as well as the round-trip.

## Unit 15 — Tables and checks on PGlite

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 15 only (tasks 4.3–4.4). No `size:exception`.

Units 1–14 stay as they landed. This batch does not rewrite them. Tasks 4.3–4.4 were not split.

### Completed

- [x] 4.3 RED `drizzle-dining-room-repository.contract.test.ts` for tables and checks: PGlite, existing `orders_app`, forced RLS, hidden tenant, round-trip
- [x] 4.4 GREEN `dining_tables` and `checks` in `0002_dining_room.sql`, `schema.ts`, and `drizzle-dining-room-repository.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders drizzle-dining-room-repository` failed before the SQL and repository existed. The suite did not collect tests. Vitest reported `Cannot find module '#adapters/postgres/drizzle-dining-room-repository.js'`.
- GREEN: the same command passed, 1 file, 4 tests. The shared dining contract supplies the round-trip, the joined save, and the hidden tenant. The fourth test selects `dining_tables` and `checks` as `orders_app` with no tenant filter and returns only tenant A.
- `pnpm vitest run --project orders adapters/memory` passed, 5 files, 10 tests.
- `pnpm vitest run --project orders view-table-map view-station-queue get-check configure-station-route change-line-state request-check reassign-check take-order place-table open-table release-table dining-table check station-router kitchen-ticket drizzle-menu-repository` passed, 16 files, 76 tests. The menu Postgres contract is the extra file, because `schema.ts` changed.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the unit files passed after formatting.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 4.3–4.4 were not split. Earlier units were not rewritten.

| File | Lines |
|------|------:|
| `0002_dining_room.sql` | 53 |
| `drizzle-dining-room-repository.ts` | 598 |
| `drizzle-dining-room-repository.contract.test.ts` | 89 |
| `schema.ts` | 34 added |
| `package.json` | 1 added |

Additions are 775. Deletions are 0. The repository is the overrun. It replays a saved check, including lines kept on the check row, through the public `Check` API.

### Files

| File | Action |
|------|--------|
| `contexts/orders/adapters/postgres/drizzle-dining-room-repository.contract.test.ts` | Created |
| `contexts/orders/adapters/postgres/0002_dining_room.sql` | Created |
| `contexts/orders/adapters/postgres/schema.ts` | Added `diningTables` and `checks` |
| `contexts/orders/adapters/postgres/drizzle-dining-room-repository.ts` | Created |
| `contexts/orders/package.json` | Exported the Drizzle dining repository |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 4.3 and 4.4 done |

### Notes

The contract test applies `0001_menu.sql` and then `0002_dining_room.sql`. The first file already creates `orders_app`. The dining file does not `CREATE ROLE` and its rollback comment drops only `checks` and `dining_tables`.

Both new tables carry `tenant_id`, forced RLS, and a policy for `orders_app`. `GRANT` is `SELECT`, `INSERT`, and `DELETE`. The repository sets `SET LOCAL ROLE orders_app` and `app.tenant_id` inside each transaction, same as the menu adapter.

`load`, `save`, `loadCheck`, `saveCheck`, `saveChecks`, `listTables`, and `listChecks` are implemented. `saveChecks` writes every check in one transaction. A Terrace table opened for 4 loads as a new `DiningTable`. A served check loads as a new `Check`: soup is `ready` with its stamps, note, variant, and modifier; steak stays `held`; the total is 12000; the pre-bill and the ready notice come back. Tenant B and another venue stay hidden. A missing id loads as null. Changing the caller's objects after save does not change the stored copy.

There is no `orders`, `order_lines`, `station_routes`, or `station_route_products` table. A check that already carries lines stores that document in `checks.orders` jsonb so the shared round-trip matches. Those lines are not written to `order_lines`. Restoring replays `open`, `addLine`, `send`, `advance`, and `requestCheck`. A course that mixes held and sent lines, or a line whose origin table is not the check's table, cannot be restored this way. The shared contract does not use those shapes. Unit 16 still owns the order tables, line timestamps, and `NOTIFY`.

No relative import was added. `0001_menu.sql` was not edited. Memory adapters, domain behavior, and application scenarios were not changed. No HTTP, SSE, Nest, Zod, ESC/POS, `shared/printing`, Drizzle mock, SQLite, or live Postgres was added. `entry-port.ts` was not changed.

### Remaining

Tasks 4.5 onward stay unchecked. Next batch is unit 16 (tasks 4.5–4.6). It should add `orders` and `order_lines`, move the line document off `checks.orders`, store each line-state timestamp, and run `NOTIFY orders_realtime` inside the save transaction.

## Unit 16 — Orders, lines, and NOTIFY

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 16 only (tasks 4.5–4.6). No `size:exception`.

Units 1–15 stay as they landed. This batch does not rewrite them. Tasks 4.5–4.6 were not split.

### Completed

- [x] 4.5 RED `drizzle-dining-room-repository.contract.test.ts` for orders and lines
- [x] 4.6 GREEN `orders` and `order_lines` in `0002_dining_room.sql`, `schema.ts`, and `drizzle-dining-room-repository.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders drizzle-dining-room-repository` failed, 4 failed and 3 passed. The shared table and check contract stayed green. The new cases failed because `orders` and `order_lines` did not exist and `NOTIFY orders_realtime` carried nothing. The join case did see the abort trigger fire before the missing `orders` query failed.
- GREEN: the same command passed, 1 file, 7 tests.
- `pnpm vitest run --project orders adapters/memory` passed, 5 files, 10 tests.
- `pnpm vitest run --project orders view-table-map view-station-queue get-check configure-station-route change-line-state request-check reassign-check take-order place-table open-table release-table dining-table check station-router kitchen-ticket drizzle-menu-repository` passed, 16 files, 76 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the unit files passed after formatting.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 4.5–4.6 were not split. Earlier units were not rewritten.

Lengths against the unit 15 landing:

| File | Unit 15 | Now | Net |
|------|--------:|----:|----:|
| `0002_dining_room.sql` | 53 | 113 | +60 |
| `drizzle-dining-room-repository.ts` | 598 | 744 | +146 |
| `drizzle-dining-room-repository.contract.test.ts` | 89 | 399 | +310 |
| `schema.ts` | 152 | 194 | +42 |

Net growth is 558 lines. The review diff is larger: the jsonb line parser was removed and the hidden-tenant insert was rewritten. Additions plus deletions stay above 400.

### Files

| File | Action |
|------|--------|
| `contexts/orders/adapters/postgres/drizzle-dining-room-repository.contract.test.ts` | Added the join, NOTIFY, and line-timestamp cases. The hidden-tenant select now covers `orders` and `order_lines` |
| `contexts/orders/adapters/postgres/0002_dining_room.sql` | Added `orders` and `order_lines`. Removed `checks.orders` |
| `contexts/orders/adapters/postgres/schema.ts` | Added `orders` and `orderLines`. Removed the check document column |
| `contexts/orders/adapters/postgres/drizzle-dining-room-repository.ts` | Persists lines in `orders` and `order_lines` and notifies inside the save transaction |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 4.5 and 4.6 done |

### Notes

`orders` and `order_lines` both carry `tenant_id`, forced RLS, and a policy for `orders_app`. `GRANT` is `SELECT`, `INSERT`, and `DELETE`. The save still uses `SET LOCAL ROLE orders_app` and `app.tenant_id` inside the transaction. No new role was created.

`saveChecks` still writes every check in one transaction. A trigger that rejects `check_6` rolls the whole join back: no check, order, or line remains. After that trigger is dropped, `check_5` and `check_6` commit together. `check_5` owns `order_1`, `line_soup`, and `line_steak`. `check_6` has no lines.

`NOTIFY orders_realtime` runs with `pg_notify` inside that same transaction, so the payload is visible at commit. One save emits one payload. The body is `kind: "ids"` plus `tenantId`, `venueId`, `checkId`, `tableId`, and `lineIds`. It does not carry the product name, the note, the price, or ticket text.

Each line state keeps its own timestamp column: `sent_at`, `in_preparation_at`, `ready_at`, and `delivered_at`. A ready soup stores the first three. A held steak stores nulls in all four. `delivered_at` stays null until the line is delivered.

Lines no longer live in `checks.orders`. Restore still replays `open`, `addLine`, `send`, `advance`, and `requestCheck`. Two shapes cannot be rebuilt, and this unit does not add a second constructor:

- A course that mixes held and sent lines cannot be restored. `send` moves every held line in that course.
- A line whose `originTableId` is not the check table cannot be restored. `addLine` records the check table as the origin.

The public `orders` projection also omits line kind. A held combo is snapshotted as a product and comes back as a product. The shared contract does not use a combo, a mixed course, or a foreign origin.

The unit 16 rollback drops `order_lines` and `orders`. It does not drop `checks`, `dining_tables`, or `orders_app`. There is no `station_routes` or `station_route_products` table.

No relative import was added. `0001_menu.sql` was not edited. Memory adapters, domain behavior, and application scenarios were not changed. No HTTP, SSE, Nest, Zod, ESC/POS, `shared/printing`, Drizzle mock, SQLite, or live Postgres was added. `entry-port.ts` was not changed.

### Remaining

Tasks 4.7 onward stay unchecked. Next batch is unit 17 (tasks 4.7–4.8).

## Unit 17 — Station routes on PGlite

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 17 only (tasks 4.7–4.8). No `size:exception`.

Units 1–16 stay as they landed. This batch does not rewrite them. Tasks 4.7–4.8 were not split.

### Completed

- [x] 4.7 RED `drizzle-station-route-repository.contract.test.ts`: PGlite round-trip, forced RLS, hidden tenant
- [x] 4.8 GREEN `station_routes` and `station_route_products` in `0002_dining_room.sql`, `schema.ts`, and `drizzle-station-route-repository.ts`

### RED / GREEN

- RED: `pnpm vitest run --project orders drizzle-station-route-repository` failed before the tables and repository existed. The suite did not collect tests. Vitest reported `Cannot find module '#adapters/postgres/drizzle-station-route-repository.js'`.
- GREEN: the same command passed, 1 file, 4 tests.
- `pnpm vitest run --project orders drizzle-dining-room-repository` passed, 1 file, 7 tests.
- `pnpm vitest run --project orders adapters/memory` passed, 5 files, 10 tests.
- `pnpm vitest run --project orders view-table-map view-station-queue get-check configure-station-route change-line-state request-check reassign-check take-order place-table open-table release-table dining-table check station-router kitchen-ticket drizzle-menu-repository` passed, 16 files, 76 tests.
- `tsc -p contexts/orders --noEmit` passed. Biome check on the unit files passed after formatting.

### Review budget

This unit stays inside the 400-line budget. `size:exception` was not granted. Tasks 4.7–4.8 were not split. Earlier units were not rewritten.

Lengths against the unit 16 landing:

| File | Unit 16 | Now | Net |
|------|--------:|----:|----:|
| `drizzle-station-route-repository.contract.test.ts` | 0 | 162 | +162 |
| `drizzle-station-route-repository.ts` | 0 | 144 | +144 |
| `0002_dining_room.sql` | 113 | 160 | +47 |
| `schema.ts` | 194 | 224 | +30 |
| `contexts/orders/package.json` | export line | export line | +2 / −1 |

Additions are 385. Deletions are 1. Additions plus deletions are 386.

### Files

| File | Action |
|------|--------|
| `contexts/orders/adapters/postgres/drizzle-station-route-repository.contract.test.ts` | Created. Applies `0001_menu.sql` and `0002_dining_room.sql`. Round-trip, forced RLS, hidden tenant, duplicate product |
| `contexts/orders/adapters/postgres/0002_dining_room.sql` | Added `station_routes` and `station_route_products` |
| `contexts/orders/adapters/postgres/schema.ts` | Added `stationRoutes` and `stationRouteProducts` |
| `contexts/orders/adapters/postgres/drizzle-station-route-repository.ts` | Created |
| `contexts/orders/package.json` | Exported the Drizzle station-route repository |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 4.7 and 4.8 done |

### Notes

The contract test applies `0001_menu.sql` and then `0002_dining_room.sql`. The first file already creates `orders_app`. This unit does not `CREATE ROLE`.

`station_routes` is one station per venue. It stores the name, the output (`screen`, `printer`, or `both`), and `red_threshold_minutes`. `station_route_products` stores the product. Its primary key is `(tenant_id, venue_id, product_id)`, so the same product cannot be stored twice for one venue. Another venue, or another tenant, can still route that product.

Both new tables carry `tenant_id`, forced RLS, and a policy for `orders_app`. `GRANT` is `SELECT`, `INSERT`, and `DELETE`. The repository sets `SET LOCAL ROLE orders_app` and `app.tenant_id` inside each transaction, same as the dining-room adapter.

`save` of a product that is already stored for that venue returns without writing. The first station, its output, and its red threshold stay. A second station for that product is not inserted.

The first product for a station inserts the station row. A later, different product on that same station does not replace the station's output or red threshold. Load copies those station columns onto each product route.

The shared contract covers the round-trip and the hidden tenant. The forced-RLS case selects both tables as `orders_app` with no tenant filter and returns only tenant A.

The unit 17 rollback drops `station_route_products` and `station_routes`. It does not drop `orders_app`, `dining_tables`, `checks`, `orders`, or `order_lines`.

No relative import was added. `0001_menu.sql` was not edited. The dining-room line mapper, memory adapters, and application scenarios were not changed. No HTTP, SSE, Nest, Zod, ESC/POS, `shared/printing`, Drizzle mock, SQLite, or live Postgres was added. `entry-port.ts` was not changed.

### Remaining

Phase 4 is complete. Tasks 5.1 onward stay unchecked. Next batch is unit 18 (tasks 5.1–5.2).

## Unit 18 — Floor HTTP

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 18 only (tasks 5.1–5.2). No `size:exception`.

Units 1–17 stay as they landed. This batch does not rewrite them. Tasks 5.1–5.2 were not split.

### Completed

- [x] 5.1 RED `place-table.controller.test.ts` and `configure-station-route.controller.test.ts`: `POST .../dining-tables` and `POST .../station-routes` need `organization.structure`. 200, 403, 400, 409
- [x] 5.2 GREEN those controllers, Zod, `application-module.ts`, and `create-application.ts`. No audit

### RED / GREEN

- RED: `pnpm vitest run --project api-cloud place-table.controller configure-station-route.controller` failed before the controllers existed. The suite did not collect tests. Vitest reported `Cannot find module '#src/http/place-table.controller.js'` and `Cannot find module '#src/http/configure-station-route.controller.js'`.
- GREEN: the same command passed after formatting, 2 files, 8 tests.
- `pnpm vitest run --project orders` passed, 26 files, 116 tests.
- `pnpm vitest run --project platform permission-catalog` passed, 1 file, 418 tests.
- Biome check on the unit files passed after formatting.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 5.1–5.2 were not split. Earlier units were not rewritten.

Lengths against the unit 17 landing:

| File | Unit 17 | Now | Net |
|------|--------:|----:|----:|
| `place-table.controller.ts` | 0 | 152 | +152 |
| `place-table.controller.test.ts` | 0 | 213 | +213 |
| `configure-station-route.controller.ts` | 0 | 158 | +158 |
| `configure-station-route.controller.test.ts` | 0 | 227 | +227 |
| `shared/contracts/dining-room.ts` | 0 | 66 | +66 |
| `shared/contracts/index.ts` | 65 | 76 | +11 |
| `entry-port.ts` | 18 | 34 | +16 |
| `application-module.ts` | 261 | 297 | +36 |
| `contexts/orders/package.json` | 47 | 49 | +2 |
| `permission-catalog.ts` | 275 | 277 | +2 |
| `permission-catalog.test.ts` | 185 | 186 | +1 |

Additions are 884. Deletions are 0. Additions plus deletions are 884.

### Files

| File | Action |
|------|--------|
| `apps/api-cloud/test/http/place-table.controller.test.ts` | Created. `inject`, `x-session-id`, 200, 403, 400, 409 |
| `apps/api-cloud/test/http/configure-station-route.controller.test.ts` | Created. Same statuses for station routes |
| `apps/api-cloud/src/http/place-table.controller.ts` | Created. `POST .../dining-tables` |
| `apps/api-cloud/src/http/configure-station-route.controller.ts` | Created. `POST .../station-routes` |
| `shared/contracts/dining-room.ts` | Created. `safeParse` schemas and `z.enum` |
| `shared/contracts/index.ts` | Exported the dining-room schemas through `#contracts/*` |
| `contexts/orders/application/entry-port.ts` | Exported `PlaceTable`, `ConfigureStationRoute`, and the errors these routes return |
| `contexts/orders/package.json` | Exported the dining-room and station-route ports |
| `apps/api-cloud/src/composition/application-module.ts` | Registered the controllers and in-memory repositories |
| `contexts/platform/domain/permission-catalog.ts` | Registered the existing `organization.structure` string |
| `contexts/platform/domain/permission-catalog.test.ts` | Expected matrix cell for that string |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 5.1 and 5.2 done |

### Notes

`create-application.ts` already forwards `CloudApplicationDependencies` into `ApplicationModule.register`. The new `diningRooms` and `stationRoutes` fields are optional on that type, so the composition root is wired without a further edit. Tests pass the in-memory repositories in. A missing dependency falls back to the in-memory adapter. There is no audit on these routes.

Both routes live under `tenants/:tenantId/venues/:venueId`. They require `x-session-id` and `organization.structure`. A missing session header or a body that fails `safeParse` is 400. A cashier is 403 `OrganizationStructureDenied` and nothing is saved. `InvalidTableId` and `DuplicateStationProduct` are 409 and the rejected command saves nothing. A client `occurredAt` is rejected by `.strict()`. Output is `screen`, `printer`, or `both`.

`organization.structure` was already the declared permission on `POST structure`. It was not a `PermissionCode`. `EvaluatePermission` looks the code up in the matrix, and a missing cell throws for a matrix role. The existing string is now a catalog code. Only the owner is `yes`. Every other matrix role is `no`. No second permission name was added.

The permission target is the venue (`kind: "site"`). A company-scoped owner still covers it. api-cloud imports the schemas from `@blackhole/contracts` and the use cases from `@blackhole/orders/application/entry-port`. It does not import a use-case file. There is no relative import, `listen()`, live Postgres, ESC/POS, SSE, or `shared/printing`.

### Remaining

Tasks 5.3 onward stay unchecked. Next batch is unit 19 (tasks 5.3–5.4).

## Unit 19 — Open, release, and bill HTTP

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 19 only (tasks 5.3–5.4). No `size:exception`.

Units 1–18 stay as they landed. This batch does not rewrite them. Tasks 5.3–5.4 were not split.

### Completed

- [x] 5.3 RED `open-table.controller.test.ts`, `release-table.controller.test.ts`, and `request-check.controller.test.ts`: `POST .../open`, `.../release`, `.../ready`, and `POST .../checks/:checkId/bill` need `sale.open-table`. Audit only after a successful save
- [x] 5.4 GREEN those controllers. Audit open and bill with `RecordAuditEvent`

### RED / GREEN

- RED: `pnpm vitest run --project api-cloud open-table.controller release-table.controller request-check.controller` failed before the controllers existed. The suite did not collect tests. Vitest reported `Cannot find module '#src/http/open-table.controller.js'`, `Cannot find module '#src/http/release-table.controller.js'`, and `Cannot find module '#src/http/request-check.controller.js'`.
- GREEN: the same command passed after formatting, 3 files, 14 tests.
- `pnpm vitest run --project api-cloud place-table.controller configure-station-route.controller` passed, 2 files, 8 tests.
- `pnpm vitest run --project orders` passed, 26 files, 116 tests.
- `pnpm vitest run --project platform permission-catalog` passed, 1 file, 418 tests.
- Biome check on the unit files passed after formatting.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 5.3–5.4 were not split. Earlier units were not rewritten.

Lengths against the unit 18 landing:

| File | Unit 18 | Now | Net |
|------|--------:|----:|----:|
| `open-table.controller.ts` | 0 | 195 | +195 |
| `open-table.controller.test.ts` | 0 | 169 | +169 |
| `release-table.controller.ts` | 0 | 198 | +198 |
| `release-table.controller.test.ts` | 0 | 183 | +183 |
| `request-check.controller.ts` | 0 | 191 | +191 |
| `request-check.controller.test.ts` | 0 | 144 | +144 |
| `platform-dining-audit.ts` | 0 | 22 | +22 |
| `dining-room-session.ts` | 0 | 182 | +182 |
| `shared/contracts/dining-room.ts` | 66 | 128 | +62 |
| `shared/contracts/index.ts` | 76 | 90 | +14 |
| `entry-port.ts` | 34 | 50 | +16 |
| `application-module.ts` | 297 | 347 | +50 |

Additions are 1426. Deletions are 0 against that landing. Additions plus deletions are 1426.

### Files

| File | Action |
|------|--------|
| `apps/api-cloud/test/http/open-table.controller.test.ts` | Created. `inject`, `x-session-id`, 200, 403, 400, 409. Audit only after a successful open |
| `apps/api-cloud/test/http/release-table.controller.test.ts` | Created. Release and ready. No audit |
| `apps/api-cloud/test/http/request-check.controller.test.ts` | Created. Bill. Audit only after a successful bill |
| `apps/api-cloud/test/http/dining-room-session.ts` | Created. Shared in-memory cloud session for these three suites |
| `apps/api-cloud/src/http/open-table.controller.ts` | Created. `POST .../dining-tables/:tableId/open` |
| `apps/api-cloud/src/http/release-table.controller.ts` | Created. `POST .../release` and `POST .../ready` |
| `apps/api-cloud/src/http/request-check.controller.ts` | Created. `POST .../checks/:checkId/bill` |
| `apps/api-cloud/src/http/platform-dining-audit.ts` | Created. `import type { RecordAuditEvent }` and `record()` after save |
| `shared/contracts/dining-room.ts` | Extended. `safeParse` commands. `tableState` stays `z.enum` |
| `shared/contracts/index.ts` | Exported the new dining-room schemas |
| `contexts/orders/application/entry-port.ts` | Exported `OpenTable`, `ReleaseTable`, `MarkTableReady`, `RequestCheck`, and the errors these routes return |
| `apps/api-cloud/src/composition/application-module.ts` | Registered the controllers and use cases. Adapts the existing platform `Clock` |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 5.3 and 5.4 done |

### Notes

Routes live under `tenants/:tenantId/venues/:venueId`. Each requires `x-session-id` and `sale.open-table`. A missing session header or a body that fails `safeParse` is 400. A kitchen chief is 403 `SaleOpenTableDenied` and nothing is saved. `TableAlreadyOccupied`, `InvalidCheckId`, and `TableNotOpen` are 409 and the rejected command saves nothing. A client `occurredAt` is rejected by `.strict()`. No client timestamp is accepted.

`sale.open-table` was already in the permission catalog. The matrix was not changed. Owner is allowed. Kitchen chief is denied. The permission target is the venue (`kind: "site"`).

Audit runs only after `OpenTable.execute` or `RequestCheck.execute` returns. `PlatformDiningAudit` imports `RecordAuditEvent` as a type from `@blackhole/platform/application/entry-port`, matching the attendance adapter, and calls `execute` from `record()`. A 403 or a domain rejection does not construct that call. Release and ready do not audit. The recorded open is `before: { state: "free", diners: 0 }` and `after` the occupied table plus `checkId`. The recorded bill is `before: { state: "occupied" }` and `after` `check_requested` plus `preBillRequestedAt`. Action, entity, and reason use `sale.open-table` for open (entity is the table) and the same action for the bill (entity is the check).

`create-application.ts` was not edited. `CloudApplicationDependencies` already carries `clock`, `audits`, and `diningRooms`. The module adapts the platform clock to the orders clock and builds `OpenTable` and `RequestCheck` from those fields.

`OpenTable` still returns the empty check without saving it. That use case was not changed. The open response returns the check from the use case. The bill test seats the check through the in-memory dining repository. Controllers import schemas from `@blackhole/contracts` and use cases from `@blackhole/orders/application/entry-port`. They do not import a use-case file. There is no relative import, `listen()`, live Postgres, ESC/POS, SSE, or `shared/printing`.

### Remaining

Tasks 5.5 onward stay unchecked. Next batch is unit 20 (tasks 5.5–5.6).

## Unit 20 — Send, resend, and deliver HTTP

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 20 only (tasks 5.5–5.6). No `size:exception`.

Units 1–19 stay as they landed. This batch does not rewrite them. Tasks 5.5–5.6 were not split.

### Completed

- [x] 5.5 RED `take-order.controller.test.ts`: `POST .../lines`, `.../send`, `.../resend`, and deliver need `sale.open-table`. Audit send only after save. 403 saves nothing
- [x] 5.6 GREEN `take-order.controller.ts`. A printer failure still returns the saved line

### RED / GREEN

- RED: `pnpm vitest run --project api-cloud take-order.controller` failed before the controller existed. The suite did not collect tests. Vitest reported `Cannot find module '#src/http/take-order.controller.js'`.
- GREEN: the same command passed after formatting, 1 file, 15 tests.
- `pnpm vitest run --project api-cloud open-table.controller release-table.controller request-check.controller place-table.controller configure-station-route.controller` passed, 5 files, 22 tests.
- `pnpm vitest run --project orders` passed, 26 files, 116 tests.
- Biome check on the unit files passed after formatting.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 5.5–5.6 were not split. Earlier units were not rewritten.

Lengths against the unit 19 landing:

| File | Unit 19 | Now | Net |
|------|--------:|----:|----:|
| `take-order.controller.ts` | 0 | 453 | +453 |
| `take-order.controller.test.ts` | 0 | 659 | +659 |
| `station-route-directory.ts` | 0 | 33 | +33 |
| `application-module.ts` | 347 | 401 | +54 |
| `dining-room-session.ts` | 182 | 195 | +13 |
| `shared/contracts/dining-room.ts` | 128 | 209 | +81 |
| `shared/contracts/index.ts` | 90 | 104 | +14 |
| `entry-port.ts` | 50 | 73 | +23 |
| `take-order.ts` | 282 | 420 | +138 |
| `contexts/orders/package.json` | — | — | +3 |

Additions are 1471. Deletions are 0 against that landing. Additions plus deletions are 1471.

### Files

| File | Action |
|------|--------|
| `apps/api-cloud/test/http/take-order.controller.test.ts` | Created. `inject`, `x-session-id`, 200, 403, 400, 409. Audit only after a successful send. Printer failure still returns the saved line |
| `apps/api-cloud/src/http/take-order.controller.ts` | Created. Lines, send, resend, and deliver |
| `apps/api-cloud/src/composition/station-route-directory.ts` | Created. Builds a `StationRouter` from the in-memory station-route repository |
| `apps/api-cloud/src/composition/application-module.ts` | Registered the controller, `TakeOrder`, and `ChangeLineState`. Optional `printer` and `realtime` |
| `apps/api-cloud/test/http/dining-room-session.ts` | Accepts the in-memory menu, station routes, printer, and organization |
| `shared/contracts/dining-room.ts` | Extended. `safeParse` commands. `z.enum` for channel and line state |
| `shared/contracts/index.ts` | Exported the new dining-room schemas |
| `contexts/orders/application/entry-port.ts` | Exported `TakeOrder`, `ChangeLineState`, and the errors these routes return |
| `contexts/orders/application/take-order/take-order.ts` | Added `hold` and `fire`. `execute` and `resend` stay |
| `contexts/orders/package.json` | Exported the printer, realtime hub, and station directory ports |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 5.5 and 5.6 done |

### Notes

Routes live under `tenants/:tenantId/venues/:venueId`. Each requires `x-session-id` and `sale.open-table`. A missing session header or a body that fails `safeParse` is 400. A kitchen chief is 403 `SaleOpenTableDenied` and nothing is saved or audited. `TableNotOpen` and `EmptyOrder` are 409 and the rejected command saves nothing. A client `occurredAt` is rejected by `.strict()`.

The design names the line state `delivered` and does not name a URL. Deliver is `POST checks/:checkId/lines/:lineId/deliver`, beside the later preparation and ready routes. Resend is `POST checks/:checkId/lines/:lineId/resend`. Add is `POST checks/:checkId/lines`. Send is `POST checks/:checkId/send`.

`POST .../lines` calls `TakeOrder.hold` and stores a held line. It does not audit. `POST .../send` with `lines` calls the existing `TakeOrder.execute`. `POST .../send` with only a course calls `TakeOrder.fire` for lines already held. Both send paths audit only after the save returns. The recorded send is `before: { course, lineIds, state: "held" }` and `after` `sent` plus `sentAt`. Action, entity, and reason use `sale.open-table`. The entity is the check. Resend and deliver do not audit. A 403 does not call the use case.

A printer failure is caught inside `TakeOrder` after the check is saved. The HTTP response is still 200 and the body contains the saved sent line. The audit is still recorded because the save succeeded.

Deliver calls the existing `ChangeLineState` with `delivered`. Preparation, ready, reassign, map, queue, and realtime HTTP were not added. The check is seeded in the test the way the bill test seats a check. `OpenTable` was not changed.

`execute` was not rewritten. `hold` and `fire` were added because `execute` both quotes and sends in one call, and it cannot fire a line that is already stored. The orders project stays green.

The controller imports schemas from `@blackhole/contracts` and `TakeOrder` plus `ChangeLineState` from `@blackhole/orders/application/entry-port`. It also imports `VenueDirectory` so a venue route can resolve the brand `TakeOrder` already requires. Permission and audit follow the bill controller: `EvaluatePermission`, then `PlatformDiningAudit` over `RecordAuditEvent`. `create-application.ts` was not edited. `printer` and `realtime` are optional fields on `CloudApplicationDependencies` because those ports were not already on the dependency object. The module defaults them to the in-memory printer and hub. Station routes already had a field; `StationRouteDirectory` adapts that repository to `StationDirectory`.

There is no relative import, `listen()`, live Postgres, ESC/POS, SSE, or `shared/printing`. Kitchen text stays UTF-8 inside the existing ticket path.

### Remaining

Tasks 5.7 onward stay unchecked. Next batch is unit 21 (tasks 5.7–5.8).

## Unit 21 — Reassign and kitchen advance HTTP

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 21 only (tasks 5.7–5.8). No `size:exception`.

Units 1–20 stay as they landed. This batch does not rewrite them. Tasks 5.7–5.8 were not split.

### Completed

- [x] 5.7 RED `reassign-check.controller.test.ts` and `change-line-state.controller.test.ts`: `POST .../checks/reassign` needs `sale.move-items` and audits after save; `POST .../preparation` and `.../ready` allow a session without `sale.open-table`, including a kitchen chief
- [x] 5.8 GREEN those controllers. Do not audit prepare or ready

### RED / GREEN

- RED: `pnpm vitest run --project api-cloud reassign-check.controller change-line-state.controller` failed before the controllers existed. The suites did not collect tests. Vitest reported `Cannot find module '#src/http/reassign-check.controller.js'` and `Cannot find module '#src/http/change-line-state.controller.js'`.
- GREEN: the same command passed, 2 files, 12 tests.
- `pnpm vitest run --project api-cloud take-order.controller open-table.controller release-table.controller request-check.controller place-table.controller configure-station-route.controller` passed, 6 files, 37 tests.
- `pnpm vitest run --project orders` passed, 26 files, 116 tests.
- `pnpm vitest run --project platform permission-catalog` passed, 1 file, 418 tests.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 5.7–5.8 were not split. Earlier units were not rewritten.

Lengths against the unit 20 landing:

| File | Unit 20 | Now | Net |
|------|--------:|----:|----:|
| `reassign-check.controller.ts` | 0 | 250 | +250 |
| `change-line-state.controller.ts` | 0 | 202 | +202 |
| `reassign-check.controller.test.ts` | 0 | 414 | +414 |
| `change-line-state.controller.test.ts` | 0 | 248 | +248 |
| `application-module.ts` | 401 | 412 | +11 |
| `shared/contracts/dining-room.ts` | 209 | 267 | +58 |
| `shared/contracts/index.ts` | 104 | 114 | +10 |
| `contexts/orders/application/entry-port.ts` | 73 | 75 | +2 |

Additions are 1195. Deletions are 0 against that landing. Additions plus deletions are 1195.

### Files

| File | Action |
|------|--------|
| `apps/api-cloud/test/http/reassign-check.controller.test.ts` | Created. `inject`, `x-session-id`. Join and transfer. 200, 403, 400, 409. Audit only after a successful reassignment |
| `apps/api-cloud/test/http/change-line-state.controller.test.ts` | Created. Preparation and ready accept a kitchen chief. No audit |
| `apps/api-cloud/src/http/reassign-check.controller.ts` | Created. `POST .../checks/reassign` |
| `apps/api-cloud/src/http/change-line-state.controller.ts` | Created. `POST .../lines/:lineId/preparation` and `POST .../lines/:lineId/ready` |
| `apps/api-cloud/src/composition/application-module.ts` | Registered both controllers and `ReassignCheck`. `ChangeLineState` was already provided |
| `shared/contracts/dining-room.ts` | Extended. `safeParse` commands. `z.enum` for join, transfer, and the reassigned line state |
| `shared/contracts/index.ts` | Exported the new dining-room schemas |
| `contexts/orders/application/entry-port.ts` | Exported `ReassignCheck`. `ChangeLineState` was already exported |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 5.7 and 5.8 done |

### Notes

Routes live under `tenants/:tenantId/venues/:venueId`. Reassign is `POST checks/reassign`. The body is a discriminated union: `join`, or `transfer` with `lineIds`. It requires `x-session-id` and `sale.move-items`. A missing session header or a body that fails `safeParse` is 400. A kitchen chief is 403 `SaleMoveItemsDenied`, both checks stay, and nothing is audited. A free source table is 409 `TableNotOpen` and nothing is audited. A client `occurredAt` is rejected by `.strict()`.

Audit runs only after `ReassignCheck.execute` returns. `PlatformDiningAudit` records `sale.move-items`. The entity is the target check. `before` is the kind and the two check ids. `after` adds the target line ids from the saved check. A 403 does not call the use case.

Preparation is `POST checks/:checkId/lines/:lineId/preparation`. Ready is `POST checks/:checkId/lines/:lineId/ready`. Deliver stays `POST checks/:checkId/lines/:lineId/deliver` on the take-order controller. Preparation and ready declare `session` and do not call `EvaluatePermission`. A known session is enough, including a kitchen chief who does not have `sale.open-table`. An unknown session is 403 `UnknownSession`. A step back is 409 `LineTransitionRejected`. Neither route audits. The clock stamp is the existing orders clock, so this suite records `2026-10-28T12:00:00.000Z`.

`sale.open-table` and `sale.move-items` were already in the permission catalog. The matrix was not changed. Owner may reassign. Kitchen chief may not. The permission target is the venue (`kind: "site"`).

`create-application.ts` was not edited. `ReassignCheck` is built from the existing `DiningRoomRepository`. Map, queue, get-check, and orders-realtime HTTP were not added. Take-order, open, release, bill, place-table, and station-route behavior were not changed.

Controllers import schemas from `@blackhole/contracts` and use cases from `@blackhole/orders/application/entry-port`. There is no relative import, `listen()`, live Postgres, ESC/POS, SSE, or `shared/printing`.

### Remaining

Tasks 5.9 onward stay unchecked. Next batch is unit 22 (tasks 5.9–5.10).

## Unit 22 — Reads and SSE

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 22 only (tasks 5.9–5.10). No `size:exception`.

Units 1–21 stay as they landed. This batch does not rewrite them. Tasks 5.9–5.10 were not split.

### Completed

- [x] 5.9 RED the map, queue, check, and `orders-realtime.controller.test.ts`: a session reads without `sale.open-table`; Given a send, When SSE is read, Then ids only; `GetCheck` shows the account
- [x] 5.10 GREEN those reads and `@Sse` from `NOTIFY orders_realtime`. Ids only. `printer_failed` rides the same stream

### RED / GREEN

- RED: `pnpm vitest run --project api-cloud orders-realtime.controller view-table-map.controller view-station-queue.controller get-check.controller` failed before the controllers existed. The suites did not collect tests. Vitest reported `Cannot find module '#src/http/view-table-map.controller.js'`, `Cannot find module '#src/http/view-station-queue.controller.js'`, `Cannot find module '#src/http/get-check.controller.js'`, and `Cannot find module '#src/http/orders-realtime.controller.js'`.
- GREEN: `pnpm vitest run --project api-cloud orders-realtime.controller view-table-map.controller view-station-queue.controller get-check.controller reassign-check.controller change-line-state.controller take-order.controller` passed, 7 files, 33 tests.
- `pnpm vitest run --project orders` passed, 26 files, 116 tests.

### Review budget

This unit exceeds the 400-line budget. `size:exception` was not granted. Tasks 5.9–5.10 were not split. Earlier units were not rewritten.

Lengths against the unit 21 landing:

| File | Unit 21 | Now | Net |
|------|--------:|----:|----:|
| `view-table-map.controller.ts` | 0 | 67 | +67 |
| `view-station-queue.controller.ts` | 0 | 68 | +68 |
| `get-check.controller.ts` | 0 | 76 | +76 |
| `orders-realtime.controller.ts` | 0 | 170 | +170 |
| `view-table-map.controller.test.ts` | 0 | 87 | +87 |
| `view-station-queue.controller.test.ts` | 0 | 157 | +157 |
| `get-check.controller.test.ts` | 0 | 121 | +121 |
| `orders-realtime.controller.test.ts` | 0 | 192 | +192 |
| `dining-room-session.ts` | 192 | 206 | +14 |
| `application-module.ts` | 412 | 455 | +43 |
| `shared/contracts/dining-room.ts` | 267 | 390 | +123 |
| `shared/contracts/index.ts` | 114 | 123 | +9 |
| `contexts/orders/application/entry-port.ts` | 75 | 89 | +14 |
| `contexts/orders/application/ports/realtime-hub.ts` | 35 | 39 | +4 |
| `contexts/orders/adapters/memory/in-memory-realtime-hub.ts` | 20 | 40 | +20 |

Net growth is 1165 lines. The in-memory hub replaced its publish body, and the module dropped the static-only ignore plus the direct port import of `RealtimeHub`. Those replacements are about 9 deletions, so additions are about 1174. Additions plus deletions are about 1183.

### Files

| File | Action |
|------|--------|
| `apps/api-cloud/test/http/view-table-map.controller.test.ts` | Created. `inject`, `x-session-id`. Kitchen chief reads the map |
| `apps/api-cloud/test/http/view-station-queue.controller.test.ts` | Created. Queue order and held lines stay off the queue |
| `apps/api-cloud/test/http/get-check.controller.test.ts` | Created. The account, including the total, is shown |
| `apps/api-cloud/test/http/orders-realtime.controller.test.ts` | Created. SSE ids, `printer_failed`, and `line_ready` |
| `apps/api-cloud/test/http/dining-room-session.ts` | Added `getDining` |
| `apps/api-cloud/src/http/view-table-map.controller.ts` | Created. `GET .../table-map` |
| `apps/api-cloud/src/http/view-station-queue.controller.ts` | Created. `GET .../stations/:stationId/queue` |
| `apps/api-cloud/src/http/get-check.controller.ts` | Created. `GET .../checks/:checkId` |
| `apps/api-cloud/src/http/orders-realtime.controller.ts` | Created. `@Sse .../orders-realtime` |
| `apps/api-cloud/src/composition/application-module.ts` | Registered the four controllers and the three read use cases |
| `shared/contracts/dining-room.ts` | Extended. Response schemas use `safeParse` and `z.enum` |
| `shared/contracts/index.ts` | Exported the new dining-room schemas |
| `contexts/orders/application/entry-port.ts` | Exported `ViewTableMap`, `ViewStationQueue`, `GetCheck`, and `RealtimeHub` |
| `contexts/orders/application/ports/realtime-hub.ts` | Added `subscribe` with a no-op default |
| `contexts/orders/adapters/memory/in-memory-realtime-hub.ts` | Replays published notices and forwards later ones |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 5.9 and 5.10 done |

### Notes

Routes live under `tenants/:tenantId/venues/:venueId`. The map is `GET table-map`. The queue is `GET stations/:stationId/queue`. The check is `GET checks/:checkId`. Realtime is `GET orders-realtime` through Nest `@Sse`. Each route declares `session`. A missing `x-session-id` is 400. A known session is enough, including a kitchen chief who does not have `sale.open-table`. The permission matrix was not changed. None of these reads audit.

`GetCheck` returns the account: check id, table id, line ids, total, and orders. A held line stays on the account and off the total. A missing check is 404.

The SSE stream is driven by `RealtimeHub.subscribe`. There is no Postgres `LISTEN` connection. A published notice has the same ids a `NOTIFY orders_realtime` payload carries (`kind: "ids"`, tenant, venue, check, table, line ids). The in-memory hub replays notices already published and then forwards new ones, so one connection can carry more than the send.

`printer_failed` rides that same stream. `safeParse` runs after `text` is removed, so the ticket body is not sent. The hub still stores `text` for the printer-only alert; only the SSE event drops it.

`line_ready` was already on the port from the kitchen-advance unit. The same stream carries it as ids plus the ready timestamp `at` that the notice already has. No ticket body is added. That field stays because it is the notice's own time, not a ticket.

`RealtimeSocketMiddleware` fills `setKeepAlive`, `setNoDelay`, and `setTimeout` only when the request socket does not have them. Nest constructs `SseStream` before an async `@Sse` handler settles, and `inject` uses a socket that lacks those methods. A real socket is left unchanged.

`create-application.ts` was not edited. `ViewTableMap`, `ViewStationQueue`, and `GetCheck` are built from dependencies the module already had. Reassign, preparation, ready, take-order, open, release, bill, place-table, and station-route behavior were not changed. The local-node dining controller was not added.

Controllers import schemas from `@blackhole/contracts` and use cases plus `RealtimeHub` from `@blackhole/orders/application/entry-port`. There is no relative import, `listen()`, live Postgres, ESC/POS, or `shared/printing`.

### Remaining

Phase 6 stays unchecked. Next batch is unit 23 (tasks 6.1–6.3).

## Unit 23 — Node dining rejection

**Mode**: Standard. `strict_tdd` is false. RED then GREEN per ADR-017.
**Chain**: stacked-to-main. This batch is work unit 23 only (tasks 6.1–6.3). No `size:exception`.

Units 1–22 stay as they landed. This batch does not rewrite them. Tasks 6.1–6.3 were not split.

### Completed

- [x] 6.1 RED `apps/local-node/test/http/dining-room.controller.test.ts`: every cloud dining-room route, including SSE, returns 403 `DiningRoomRejected` and stores nothing
- [x] 6.2 GREEN `apps/local-node/src/http/dining-room.controller.ts` and register it in `application-module.ts`. No repository. No SQLite. Route permissions stay declared; the body is still the rejection
- [x] 6.3 `tools/skeleton/skeleton.test.ts`: allow `http/dining-room.controller.ts` only. `shared/printing`, `shared/sync`, sqlite, and outbox stay absent

### RED / GREEN

- RED: `pnpm vitest run --project local-node dining-room.controller` failed before the controller existed. The suite did not collect tests. Vitest reported `Cannot find module '#src/http/dining-room.controller.js'`.
- GREEN: the same command passed, 1 file, 1 test. All 17 routes, including `GET orders-realtime`, returned 403 `{ error: "DiningRoomRejected" }`. The response content type was not `text/event-stream`. `ApplicationModule` providers and imports stayed empty.
- `pnpm vitest run --project local-node tax.controller` passed, 1 file, 1 test.
- `pnpm vitest run --project skeleton skeleton.test` passed, 1 file, 9 tests.
- `pnpm vitest run --project api-cloud orders-realtime.controller view-table-map.controller view-station-queue.controller get-check.controller` passed, 4 files, 6 tests.
- `pnpm vitest run --project orders` passed, 26 files, 116 tests.

### Review budget

This unit stays under the 400-line budget. `size:exception` was not granted. Tasks 6.1–6.3 were not split. Earlier units were not rewritten.

| File | Additions | Deletions |
|------|----------:|----------:|
| `apps/local-node/src/http/dining-room.controller.ts` | 134 | 0 |
| `apps/local-node/test/http/dining-room.controller.test.ts` | 95 | 0 |
| `apps/local-node/src/composition/application-module.ts` | 2 | 0 |
| `tools/skeleton/skeleton.test.ts` | 1 | 0 |

Additions plus deletions are 232.

### Files

| File | Action |
|------|--------|
| `apps/local-node/test/http/dining-room.controller.test.ts` | Created. `inject`, every cloud dining route, 403, no store |
| `apps/local-node/src/http/dining-room.controller.ts` | Created. Rejection only. No repository |
| `apps/local-node/src/composition/application-module.ts` | Registered `DiningRoomController` beside `TaxController` |
| `tools/skeleton/skeleton.test.ts` | Allowed `http/dining-room.controller.ts`. Existing paths kept, including `http/tax.controller.ts` |
| `openspec/changes/p1-02-dining-room-and-kitchen/tasks.md` | Marked 6.1, 6.2, and 6.3 done |

### Notes

The controller base is `tenants/:tenantId/venues/:venueId`. Every handler returns `{ error: "DiningRoomRejected" }` with HTTP 403 and reads no body, session, or store. `local-node` does not import `@blackhole/orders`. There is no repository, SQLite, `listen()`, or `@Sse`.

`GET orders-realtime` is a normal GET. It returns the same JSON rejection and does not open a stream. Its permission key is still `GET orders-realtime` / `session`, copied from the cloud controller.

Declared keys match the cloud controllers: `POST dining-tables` and `POST station-routes` are `organization.structure`. Open, release, table ready, bill, lines, send, resend, and deliver are `sale.open-table`. `POST checks/reassign` is `sale.move-items`. Preparation, line ready, the map, the queue, the check, and realtime are `session`.

`TaxController` stays registered. Cloud dining controllers were not edited. `shared/printing`, `shared/sync`, sqlite, and outbox stay absent.

### Remaining

Every dining task, 1.1 through 6.3, is checked. This was the last dining unit. Do not archive from this batch. Next phase is `sdd-verify`.
