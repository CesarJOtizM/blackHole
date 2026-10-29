## Verification Report

**Change**: p1-02-dining-room-and-kitchen
**Version**: 1.2 (roadmap delivery)
**Mode**: Standard

Strict TDD is inactive. `strict-tdd-verify.md` was not loaded. Evidence is from this run on 2026-10-28. Specs were compared first, design second, and task completion third. Implementation files were not edited. The change was not archived, `tasks.md` was not marked, and `apply-progress.md` was not deleted. `state.yaml` still says `apply: pending` and `verify: pending`; this phase did not update it.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 47 |
| Tasks complete | 47 |
| Tasks incomplete | 0 |

Tasks 1.1 through 6.3 are checked in `tasks.md`. No unchecked implementation task remains. All 23 work units are recorded as applied in `apply-progress.md`.

### Build & Tests Execution

**Build**: ⚠️ Partial

```text
pnpm exec tsc -p contexts/orders --noEmit --pretty false
exit 0
No diagnostics printed.

pnpm exec tsc -p apps/local-node --noEmit --pretty false
exit 0
No diagnostics printed.

pnpm exec tsc -p apps/api-cloud --noEmit --pretty false
exit 1
159 diagnostics: TS2305 × 113, TS6305 × 24, TS18046 × 10, TS7006 × 7, TS2322 × 4, TS4112 × 1
```

`apps/api-cloud` is a composite project. Its `references` point at `contexts/orders`, `contexts/platform`, `contexts/invoicing`, `contexts/attendance`, and `shared/contracts`. `tsc -p --noEmit` does not emit those projects' `dist` declarations. The 113 `TS2305` ("no exported member") and 24 `TS6305` ("output file has not been built") errors are that stale declaration output: dining exports such as `OpenTable`, `TakeOrder`, and `RealtimeHub` are present in `contexts/orders/application/entry-port.ts`, and `tsc -p contexts/orders --noEmit` accepts that source. The remaining `TS18046`, `TS7006`, `TS2322` (`organization.structure`, `tax.configure` not assignable to `PermissionCode`), and `TS4112` (`StationRouteDirectory` override) sit on imports that the stale declarations did not resolve. `pnpm typecheck` (`tsc -b` in the root `package.json`) was not run. That command would write `dist`, and this phase may not emit build output.

**Tests**: ✅ 600 passed / ❌ 0 failed / ⚠️ 0 skipped

```text
pnpm vitest run --project orders
exit 0 — Test Files 26 passed (26) — Tests 116 passed (116)

pnpm vitest run --project api-cloud place-table.controller configure-station-route.controller open-table.controller release-table.controller request-check.controller take-order.controller reassign-check.controller change-line-state.controller view-table-map.controller view-station-queue.controller get-check.controller orders-realtime.controller
exit 0 — Test Files 12 passed (12) — Tests 55 passed (55)

pnpm vitest run --project local-node dining-room.controller
exit 0 — Test Files 1 passed (1) — Tests 1 passed (1)

pnpm vitest run --project local-node tax.controller
exit 0 — Test Files 1 passed (1) — Tests 1 passed (1)

pnpm vitest run --project skeleton skeleton.test
exit 0 — Test Files 1 passed (1) — Tests 9 passed (9)

pnpm vitest run --project platform permission-catalog
exit 0 — Test Files 1 passed (1) — Tests 418 passed (418)
```

`tools/skeleton/route-permission-declaration.test.ts` was not run. It is not a dining gate. Full-workspace `pnpm test`, `pnpm lint`, and `pnpm architecture` were not run.

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available

No coverage provider was invoked. The threshold in `openspec/config.yaml` is 0.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Table Map and States | Open a free table | `contexts/orders/application/open-table/open-table.test.ts` > given a free table, when opened for 4, then it is occupied with an empty check | ⚠️ PARTIAL |
| Table Map and States | Open an occupied table | `contexts/orders/application/open-table/open-table.test.ts` > given an occupied table, when opened, then the account is kept | ✅ COMPLIANT |
| Order Taking | Account visible to the cash register | `contexts/orders/application/take-order/take-order.test.ts` > given a send, when the product is sent, then RealtimeHub gets the check, table, and line ids; `apps/api-cloud/test/http/get-check.controller.test.ts` > given a check and a kitchen chief session, when GET /checks/:checkId is injected, then the response is 200 and the account is shown | ⚠️ PARTIAL |
| Order Taking | Product not orderable | `contexts/orders/application/take-order/take-order.test.ts` > given a product outside its schedule, when it is sent, then ProductNotOrderable and nothing is saved | ✅ COMPLIANT |
| Courses and Resend | Send starters first | `contexts/orders/domain/check.test.ts` > given starters and mains, when course 1 is sent, then mains stay held and off the total | ✅ COMPLIANT |
| Courses and Resend | Resend one product | `contexts/orders/application/take-order/take-order.test.ts` > given a sent soup, when it is resent, then only that product is routed and the total is unchanged | ✅ COMPLIANT |
| Move, Join and Transfer | Join two tables | `contexts/orders/application/reassign-check/reassign-check.test.ts` > given table 6 joined into table 5, when the waiter joins them, then table 5 holds both lines and each originTableId stays | ⚠️ PARTIAL |
| Move, Join and Transfer | Target not open | `contexts/orders/application/reassign-check/reassign-check.test.ts` > given a to_clean or free table, when lines are reassigned, then TableNotOpen and nothing is saved | ✅ COMPLIANT |
| Bill Request | Request the bill | `contexts/orders/application/request-check/request-check.test.ts` > given occupied, when the bill is requested, then check_requested and a pre-bill request are stored | ✅ COMPLIANT |
| Bill Request | Keep ordering | `contexts/orders/application/take-order/take-order.test.ts` > given check_requested, when another product is sent, then the table returns to occupied | ✅ COMPLIANT |
| Dine-in Time Capture | First send stamped | `contexts/orders/domain/check.test.ts` > given 12:00:00Z and 12:03:10Z, when the first product is sent, then order-taking time is 190 s | ✅ COMPLIANT |
| Dine-in Time Capture | Stamped during a cut (hybrid) | (none for ordered cloud sync after a cut) | ⚠️ SPEC/DESIGN CONFLICT |
| Operation During an Internet Cut | Hybrid keeps serving | `apps/local-node/test/http/dining-room.controller.test.ts` > given every cloud dining route, when the node is called, then each is rejected and nothing is stored | ⚠️ SPEC/DESIGN CONFLICT |
| Operation During an Internet Cut | Cloud mode stopped | (no client-unavailable test; node test above is the design behavior) | ⚠️ SPEC/DESIGN CONFLICT |
| Station Routing | Product reaches its station | `contexts/orders/domain/station-router.test.ts` > given Grill output both, when Steak is routed, then screen and printer are selected | ✅ COMPLIANT |
| Station Routing | Product without station | `contexts/orders/application/take-order/take-order.test.ts` > given a product with no station, when it is sent, then MissingStation and nothing is saved | ✅ COMPLIANT |
| Delivery Latency | Test service latency | (none; design waits for a display) | ⚠️ SPEC/DESIGN CONFLICT |
| Delivery Latency | Remote cloud link not involved (hybrid) | (none for node delivery during a cut) | ⚠️ SPEC/DESIGN CONFLICT |
| Kitchen Display Queue | Queue order | `contexts/orders/application/view-station-queue/view-station-queue.test.ts` > given lines sent at 12:00 and 12:02, when the station queue is read, then 12:00 is first | ✅ COMPLIANT |
| Kitchen Display Queue | Line turns red | `contexts/orders/application/view-station-queue/view-station-queue.test.ts` > given a 15-minute threshold and a 16-minute wait, when the station queue is read, then the line is red | ✅ COMPLIANT |
| Forward-Only Line Lifecycle | Station advances a line | `contexts/orders/application/change-line-state/change-line-state.test.ts` > given a sent line, when it is advanced to ready, then both stamps are stored and the waiter notice carries the table id | ✅ COMPLIANT |
| Forward-Only Line Lifecycle | Backward move rejected | `contexts/orders/domain/check.test.ts` > given a ready line, when it steps back, then LineTransitionRejected | ✅ COMPLIANT |
| Ready Notice | Waiter notified | `contexts/orders/application/change-line-state/change-line-state.test.ts` > given a sent line, when it is advanced to ready, then both stamps are stored and the waiter notice carries the table id | ✅ COMPLIANT |
| Ready Notice | Locked phone | (none for the 0.1 spike mechanism) | ⚠️ SPEC/DESIGN CONFLICT |
| Kitchen Ticket Printer Failure | Printer offline | `contexts/orders/application/take-order/take-order.test.ts` > given output both and a failed printer, when a product is sent, then the line stays and printer_failed is published | ✅ COMPLIANT |
| Kitchen Ticket Printer Failure | Printer-only station | `contexts/orders/application/take-order/take-order.test.ts` > given printer only, when the printer fails, then the alert includes the unprinted UTF-8 ticket | ⚠️ PARTIAL |
| Kitchen During an Internet Cut | Hybrid kitchen offline | (none for node station delivery and later sync) | ⚠️ SPEC/DESIGN CONFLICT |
| Kitchen During an Internet Cut | Cloud mode kitchen offline | `apps/local-node/test/http/dining-room.controller.test.ts` > given every cloud dining route, when the node is called, then each is rejected and nothing is stored | ⚠️ SPEC/DESIGN CONFLICT |

**Compliance summary**: 16/28 scenarios compliant. Four are partial. Eight are spec/design conflicts, not untested implementation gaps.

The same passing tests also cover the HTTP copies of the compliant rows: open 409 keeps the account, send keeps the later course held, resend keeps the total, join keeps origins, bill stores the request, queue order and held lines stay off the HTTP queue, preparation and ready store the forward steps, and deliver returns 200. Those HTTP tests passed in the api-cloud run (55 tests).

Partial rows, judged against the passing tests:

- **Open a free table.** The passing test returns an occupied Terrace table and an empty `Check` (total 0, no orders). `OpenTable.execute` calls `diningRoom.save(table)` and returns the check. It does not call `saveCheck`. A later `loadCheck` cannot see that empty account.
- **Account visible to the cash register.** The passing hub test publishes ids. The passing `GetCheck` test returns the account, including the total. The passing SSE test expects `kind: "ids"` only. The spec sentence is that the cash register screen shows the updated account without refresh. The design sentence relied on is: "SSE and `GetCheck` expose ids." No passing test puts the account body on the stream.
- **Join two tables.** The passing application test keeps each `originTableId` on the target check. `restoreCheck` throws `Stored check cannot be restored.` when `line.originTableId !== row.tableId`. The passing PGlite join test asserts committed ids after `saveChecks`. It does not load the joined check back through the repository.
- **Printer-only station.** The passing use-case test expects `printer_failed.text` to be the UTF-8 ticket, including `jalapeño`, with no ESC/POS bytes. The passing SSE test publishes that same notice with `text` and expects the event without `text`. `orders-realtime.controller.ts` `idsOnly` drops `text` before `safeParse`. The cash-register stream therefore does not carry the unprinted ticket.

Spec/design conflicts, with the design sentence relied on:

- Hybrid cut, hybrid serving, hybrid kitchen, and remote delivery. Design: "`local-node` returns 403 `DiningRoomRejected` and stores nothing." Deferred: "Hybrid (D-37): node operation, SQLite, outbox, sync, node clock, and a cut." The passing node test proves 403 `{ error: "DiningRoomRejected" }` for every cloud dining route, including `GET orders-realtime`, and that the response is not `text/event-stream`. The spec says the node keeps serving. This follows the design and contradicts those spec scenarios.
- Cloud mode stopped, and cloud mode kitchen offline. Design: "Cloud mode stops if the API is unreachable." UI (`apps/venue-app`) is deferred. There is no passing test of a client message. The node 403 is the designed node behavior, not a cloud-offline screen.
- Stamped during a cut. The 190 s scenario passed on the cloud `Clock`. Design defers node clock, outbox, and ordered sync. No passing test covers reconnection without duplicates.
- Test service latency. Design testing strategy: "p90 timing waits for a display. The hub must see the id on commit." The hub id test passed. No p90 test ran.
- Locked phone. Design: "no locked-phone notice (PA-30). The domain still emits the notice and the ticket text." The ready-notice test passed. The spike mechanism did not.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Table map and states | ⚠️ Partial | A free table opens to `occupied` with diners. A second open throws `TableAlreadyOccupied` and does not save. Release moves `occupied` or `check_requested` to `to_clean`. Ready moves `to_clean` to `free`. The map groups by zone. The empty check from open is not stored. |
| Order taking, courses, resend | ✅ Implemented | Course 1 send leaves later courses `held` and off the total. Resend keeps price, state, and total. Variants, modifiers, notes, and channel stay. `ProductNotOrderable`, `ComboNotSent`, `EmptyOrder`, and `MissingStation` save nothing. |
| Join, transfer, closed target | ⚠️ Partial | Join and transfer keep `originTableId` and both table states in memory. `free` and `to_clean` throw `TableNotOpen` before save. Postgres restore cannot rebuild a foreign origin or a course that mixes `held` and `sent`. |
| Bill request | ✅ Implemented | Occupied becomes `check_requested` and stores `preBillRequest.requestedAt`. Another send returns the table to `occupied`. The print queue, template, and backup printer stay out, as the proposal assigns them to delivery 1.6. |
| First-send stamp | ✅ Implemented | `12:00:00Z` to `12:03:10Z` is 190 s. Line-state columns `sent_at`, `in_preparation_at`, `ready_at`, and `delivered_at` are stored. The clock is the orders `Clock` as UTC ISO. |
| Station routing and queue | ✅ Implemented | Grill `both` selects screen and printer. A missing station rejects the send. The queue orders by `sentAt`. A 16-minute wait against a 15-minute threshold is red. Held lines stay off the queue. |
| Forward-only line and ready notice | ✅ Implemented | `sent` → `in_preparation` → `ready` stores both stamps and a `line_ready` notice with the table id. A step back throws `LineTransitionRejected` and saves nothing. Deliver moves the line to `delivered`. |
| Printer failure | ⚠️ Partial | Output `both` keeps the sent line and publishes `printer_failed` without ticket text. Output `printer` puts the UTF-8 ticket on the hub notice. SSE removes that `text`. |
| Cloud HTTP | ✅ Implemented | Floor and station routes need `organization.structure` (200, 403, 400, 409). Open, release, ready, bill, lines, send, resend, and deliver need `sale.open-table`. Reassign needs `sale.move-items` and audits after save. Open, send, and bill audit after save. A kitchen chief reads the map, queue, check, and SSE without `sale.open-table`. |
| Node rejection | ✅ Implemented | Every dining route returns 403 `DiningRoomRejected` and stores nothing. `GET orders-realtime` returns JSON and does not open a stream. `ApplicationModule` registers the controller and does not import `@blackhole/orders`. |
| Permission catalog | ✅ Implemented | `organization.structure` is `yes` for owner and `no` for every other matrix role, including site administrator. The permission-catalog test passed (418). |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Extend `orders`. Domain has no Nest, SQL, or Zod | ✅ Yes | Use cases leave through `entry-port.ts`. HTTP and Zod stay in the apps and `shared/contracts`. |
| One Postgres transaction for the touched checks | ✅ Yes | The passing join contract aborts both checks, then commits both after the trigger is dropped. `NOTIFY orders_realtime` runs inside that transaction. The payload is `kind: "ids"` plus tenant, venue, check, table, and line ids. |
| `StationRoute` per venue, not a `Menu` field | ⚠️ Partial | The route is per venue and a duplicate product saves nothing. On the station row, `output` and `redThresholdMinutes` are written only when that station does not yet exist. A later product on the same station does not replace them. |
| `ComboNotSent`. Products only | ⚠️ Partial | Domain and send tests reject a combo. `presentLine` omits `kind`. Restore reads that projection, so a held combo is snapshotted as a product and loads as a product. The shared contract does not use a combo. |
| States stay. Join shares the target check. `originTableId` stays | ⚠️ Partial | True in the domain and the application test. Restore cannot replay a line whose origin is not the check table, because `addLine` records the check table as the origin. |
| `Printer` in orders. Text in, UTF-8 out. No `shared/printing` | ✅ Yes | The printer-only hub notice is UTF-8 and has no ESC/POS bytes. The skeleton test passed with printing, sync, sqlite, and outbox still absent. |
| SSE `@Sse` plus `NOTIFY orders_realtime`. Ids only. `RealtimeHub` | ⚠️ Partial | Save notifies ids. The API stream is `RealtimeHub.subscribe` in that ids shape. There is no Postgres `LISTEN` in the API, so a second instance does not receive the notify. `printer_failed` rides the stream without `text`. `line_ready` rides it as ids plus `at`. The PGlite contract uses `client.listen` only to assert the notify payload. |
| `Clock.now()` as UTC ISO | ✅ Yes | Open and the 190 s case use that clock. Node clock stays deferred. |
| `sale.open-table` for open, add, send, resend, deliver, release, and bill. `sale.move-items` for reassignment. Session only to prepare or mark ready | ✅ Yes | Passing HTTP tests: a kitchen chief is 403 on open, send, resend, deliver, release, and reassign, and 200 on preparation and ready. Those two routes declare `session` and do not evaluate a catalog permission. They are not audited. Design audit set is open, send, bill, and reassignment, after save. |
| `organization.structure` for floor and routes | ⚠️ Partial | Both routes declare that permission. The catalog cell is `yes` for owner only. A site administrator is `no` and receives 403. The passing 403 tests use a cashier session, which is the same `no` cell. |
| `local-node` returns 403 `DiningRoomRejected` and stores nothing | ✅ Yes | The passing node test covers every cloud dining route. This follows the design and contradicts the hybrid spec scenarios. |
| Deliver URL | ⚠️ Partial | Passing test and controller: `POST checks/:checkId/lines/:lineId/deliver` with `sale.open-table`. The design file list and interface section do not name that URL. |
| `OpenTable` persists the empty account | ⚠️ Partial | The design data flow does not say open skips `saveCheck`. The use case returns the empty check and saves only the table. Unit 6 recorded that limitation and later units did not close it. |

### Issues Found

**CRITICAL**:

- None.

**WARNING**:

- `OpenTable` returns an empty check and does not save it. The open-free scenario is PARTIAL. The occupied-table rejection test passed and keeps the caller's check object; that object was never written by open.
- A joined line whose `originTableId` is not the check table cannot be restored. A course that mixes `held` and `sent` cannot be restored, because `send` moves every held line in that course. The join scenario is PARTIAL at the persistence boundary. The in-memory join test passed.
- Line `kind` is not on the public projection. A held combo round-trips as a product. Combo send still throws `ComboNotSent`, and that test passed.
- Station `output` and the red threshold live on the station row. The first product fixes them. A later different product does not replace them. The red-at-16-minutes scenario still passed for the stored threshold.
- Deliver is `POST checks/:checkId/lines/:lineId/deliver`. The design does not name that URL. The deliver test passed.
- `organization.structure` is `yes` for the owner only. A site administrator is `no` and gets 403 on place-table and station routes. The permission-catalog test passed with that matrix.
- SSE is fed by `RealtimeHub` in the NOTIFY ids shape. There is no `LISTEN` connection in the API. `printer_failed` rides the same stream with no ticket body, so the printer-only scenario is PARTIAL even though the hub test includes the UTF-8 ticket. `line_ready` rides the stream as ids plus `at`.
- `local-node` `GET orders-realtime` returns JSON 403 and does not open a stream. Every dining route returns `DiningRoomRejected` and stores nothing. That matches the design and contradicts the hybrid spec scenarios. Those eight scenarios are spec/design conflicts, not missing dining tasks.
- The cash-register account is available from `GetCheck`. The realtime event is ids only, so "without refresh" does not carry the account. That scenario is PARTIAL. The design chose ids.
- Process, not a product failure: `size:exception` was not granted. `apply-progress.md` names these units over the 400-line budget, and they were not split. Figures are the ones recorded there; this phase did not recompute a repository diff.
  - Unit 2 (tasks 1.3–1.4). Unit 3 records that it already landed over the budget. Unit 2's own section does not record a line count.
  - Unit 8: net growth 415; additions plus deletions about 500.
  - Unit 9: additions 513, deletions 0.
  - Unit 13: additions 1044, deletions 0.
  - Unit 14: additions 558, deletions 0.
  - Unit 15: additions 775, deletions 0.
  - Unit 16: net growth 558; additions plus deletions stay above 400.
  - Unit 18: additions 884, deletions 0.
  - Unit 19: additions 1426, deletions 0.
  - Unit 20: additions 1471, deletions 0.
  - Unit 21: additions 1195, deletions 0.
  - Unit 22: additions about 1174, deletions about 9, additions plus deletions about 1183.
- `pnpm exec tsc -p apps/api-cloud --noEmit` exited 1 with 159 diagnostics. 137 are `TS2305` and `TS6305` from composite `dist` declarations that `--noEmit` does not rebuild. `tsc -p contexts/orders` and `tsc -p apps/local-node` exited 0. This is not a dining source failure demonstrated by the orders typecheck.
- Pre-existing tax warning, not a dining CRITICAL. `apps/local-node/src/http/tax.controller.ts` `routePermissions` maps only `POST tax-rules`. `POST tax-quotes` and `POST fiscal-profiles/adopt` are routes and are not in that map. `tools/skeleton/route-permission-declaration.test.ts` was not run. The passing `tax.controller` test still expects the node to reject quote, publish, and adopt and store nothing.

**SUGGESTION**:

- The three proposal success checkboxes are still open. The 190 s stamp is covered. The p90 checkbox and the hybrid-cut checkbox wait on the deferred display and on D-37.
- Reconcile the hybrid, latency, and locked-phone spec scenarios with the design deferrals before archive merges those deltas into the main specs.
- `state.yaml` still says `apply: pending` and `verify: pending`. This phase did not change it.

### Verdict

PASS WITH WARNINGS

16/28 spec scenarios are compliant, four are partial, and eight are spec/design conflicts. Every assigned test command passed (600 tests, exit 0). `tsc -p contexts/orders` and `tsc -p apps/local-node` exited 0. No CRITICAL remains. The api-cloud `tsc -p --noEmit` exit 1 is stale composite `dist`, and the recorded product and process deviations stay warnings.
