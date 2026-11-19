# Apply progress: Warehouses and Transfers

Mode: Standard (`strict_tdd: false`). Failing tests were written and run before production changes. `strict-tdd.md` was not loaded.

No previous apply-progress existed. This file is the first batch.

## Completed tasks

- [x] 1.1 RED stock-ledger signs and “10 then 9 keeps average”
- [x] 1.2 GREEN writable `transfer_out` / `transfer_in` with those signs. `averageCost` replays `nextAverageCost` for `purchase` and `transfer_in`. `nextAverageCost` unchanged
- [x] 1.3 RED transfer dispatch, receipt, copied cost, shortfall, over-on-hand, suggestion
- [x] 1.4 GREEN `transfer.ts` and the transfer export on `domain/index.ts`

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/transfer.test.ts`. RED exit code **1** (ledger: 3 failed, 10 passed; transfer suite failed to load `#domain/transfer.js`). GREEN exit code **0** after implementation and format (2 files, 22 passed). |
| Runtime harness command/scenario and exact result | N/A. This batch is domain-only. No HTTP, persistence, or screen boundary. |
| Rollback boundary | Revert `contexts/inventory/domain/stock-ledger.ts`, `stock-ledger.test.ts`, `transfer.ts`, `transfer.test.ts`, and the `#domain/transfer.js` export in `domain/index.ts`. Leave the other barrel exports in place. |

## Behavior locked

- `transfer_out` quantity is negative. `transfer_in` quantity is positive. Append-only. Change and delete still throw.
- `StockLedger.averageCost` updates on `purchase` and `transfer_in` through the existing `nextAverageCost`. A transfer out of part of the stock does not recompute it: 10 g at 10 COP/g, then 1 g out, leaves 9 g at 10. A transfer in blends the ledger average: 10 g at 10 plus 5 g at 12 is 11. Purchase 10 then 14 stays 12. Waste that reverses a `sale_consumption` of the same ingredient still has `onHandDelta` 0.
- Both movement `unitCost` values copy the origin `averageCost`. Nothing is added.
- `Transfer.receive` calls the existing `nextAverageCost`. 1000 g at 10 plus 1000 g at 12 is 11. On-hand at or below 0 takes the receipt cost. The ledger now replays that same function for `transfer_in`.
- Dispatch sets `dispatchedAt` and `inTransitAt` together and moves status to `in_transit`. Receipt before that throws. The out movement is the full negative dispatch quantity. The in movement is the positive received quantity. Shortfall stays on the line.
- Dispatch above on-hand throws and stamps nothing. Quantity equal to on-hand is accepted.
- Suggestion: below minimum returns `maximum - onHand`. Minimum 5, maximum 20, on-hand 4 suggests 16. On-hand at or above minimum suggests nothing.

## Deviations

- Corrected after the first batch: `transfer_in` does fold into `StockLedger.averageCost` by calling `nextAverageCost`. `transfer_out` still does not. `nextAverageCost` and `roundHalfUp` are unchanged. `Transfer.receive` was not edited.
- There is no lingering `dispatched` status. Dispatch records both timestamps and lands on `in_transit`.
- A received quantity above the dispatched quantity throws `InvalidTransfer`. A zero receipt records the shortfall and does not append a zero-quantity movement.

## Correction: destination average

The test "when 5 g are transferred in at another cost, then the quantity is positive and the average stays 10" was wrong. 10 g at 10 plus 5 g at 12 is 11. Tasks 1.1–1.4 stay checked. `state.yaml` stays `applying` / `apply: partial`.

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/stock-ledger.test.ts contexts/inventory/domain/transfer.test.ts contexts/inventory/domain/production.test.ts`. RED exit code **1** (`Test Files  1 failed \| 2 passed (3)`, `Tests  1 failed \| 29 passed (30)`, expected 11, received 10). GREEN exit code **0** (`Test Files  3 passed (3)`, `Tests  30 passed (30)`). |
| Runtime harness command/scenario and exact result | N/A. Domain replay only. No HTTP, persistence, or screen boundary. |
| Rollback boundary | Revert the `transfer_in` branch inside `StockLedger` replay and the average assertion in `stock-ledger.test.ts`. Leave `transfer.ts`, `production.ts`, and `domain/index.ts` untouched. |

## Workload / PR boundary

- Mode: feature-branch-chain, PR 1 Domain (tasks 1.1–1.4), base tracker `phase-2/inventory`
- Decision needed before apply: No
- Current work unit ends at the domain module. Use cases, persistence, HTTP, and screens are not started.

## Remaining

Tasks 2.1 through 5.2. 4 of 25 tasks complete.

## Batch 2.1 RED

Mode: Standard (`strict_tdd: false`). The failing test was written before the use case and ports. `strict-tdd.md` was not loaded.

- [x] 2.1 RED `contexts/inventory/application/request-transfer/request-transfer.test.ts`: an unlinked warehouse is rejected; requested lines are stored; a request writes no stock movement

Command: `pnpm exec vitest run --project inventory contexts/inventory/application/request-transfer/request-transfer.test.ts`

Exit code: **1**

Result: 1 failed suite, 0 tests. Vite reported `Missing "#application/request-transfer/request-transfer.js" specifier in "@blackhole/inventory"`. The use case module and its ports did not exist yet.

## Batch 2.2 GREEN

Mode: Standard (`strict_tdd: false`). Production code followed the failing test. `strict-tdd.md` was not loaded.

- [x] 2.1 RED unlinked warehouse rejected; requested lines stored; no stock movement
- [x] 2.2 GREEN `request-transfer/` and `application/ports/{transfer-repository,warehouse-supply,stock-level-repository,transfer-voucher}.ts`

Command: `pnpm exec vitest run --project inventory contexts/inventory/application/request-transfer/request-transfer.test.ts`

Exit code: **0**

Result: 1 file, 2 passed. Repeated after Biome format; exit code **0** again.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/request-transfer/request-transfer.test.ts`. RED exit code **1** (suite failed to load; 0 tests). GREEN exit code **0** (1 file, 2 passed) after the use case, ports, and the `#application/request-transfer/*` import. |
| Runtime harness command/scenario and exact result | N/A. This batch is the request use case with in-memory port doubles. No HTTP, persistence, dispatch, or screen boundary. |
| Rollback boundary | Delete `contexts/inventory/application/request-transfer/` and `application/ports/{transfer-repository,warehouse-supply,stock-level-repository,transfer-voucher}.ts`. Remove the `#application/request-transfer/*` line from `contexts/inventory/package.json`. |

## Behavior locked

- A warehouse that does not supply the venue is rejected with `UnlinkedWarehouse`. Nothing is stored.
- A linked warehouse stores the requested lines on `Transfer.request`. Status stays `requested`. `dispatchedAt`, `inTransitAt`, and `dispatchedBy` stay unset. Line `unitCost` stays unset.
- The use case calls `TransferRepository.save` only. It does not dispatch, print a voucher, read stock levels, or append a stock movement.
- Suggestion stays `maximum - onHand` when on-hand is below minimum. This slice does not implement that use case. `StockLevelRepository` only holds `minimum` and `maximum`.

## Deviations

- `contexts/inventory/package.json` gained `#application/request-transfer/*`. The test imports `#application/request-transfer/request-transfer.js`, and that specifier does not resolve without the imports map. Exports, dependencies, `entry-port.ts`, and the ledger were left alone.
- Requested user and time are not stored. `Transfer.request` has no actor or timestamp, and the domain file was outside this slice. Dispatch and receipt still own those stamps.
- The in-memory supply and repository doubles live in the test. Persistence adapters were not started.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch is the request half of PR 2 (tasks 2.1–2.2). Dispatch (2.3–2.4) is not included.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain

## Remaining

Tasks 2.3 through 5.2. 6 of 25 tasks complete. `state.yaml` stays `applying` and `apply: partial`.

## Batch 2.3 RED

Mode: Standard (`strict_tdd: false`). The failing test was written before the use case. `strict-tdd.md` was not loaded.

- [x] 2.3 RED `contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts`: copy `averageCost`; `transfer_out`; print `transfer`; audit. Company warehouse stores the destination `venueId`. Site-to-site stores the origin venue.

Command: `pnpm exec vitest run --project inventory contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts`

Exit code: **1**

Result: 1 failed suite, 0 tests. Vite reported `Missing "#application/dispatch-transfer/dispatch-transfer.js" specifier in "@blackhole/inventory"`. The use case module did not exist yet.

## Batch 2.4 GREEN

Mode: Standard (`strict_tdd: false`). Production code followed the failing test. `strict-tdd.md` was not loaded.

- [x] 2.3 RED copy `averageCost`; `transfer_out`; print `transfer`; audit. Company: destination `venueId`. Site-to-site: origin venue
- [x] 2.4 GREEN `dispatch-transfer/`. Null sale columns

Command: `pnpm exec vitest run --project inventory contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts contexts/inventory/application/request-transfer/request-transfer.test.ts`

Exit code: **0**

Result: 2 files, 5 passed. Repeated after Biome format; exit code **0** again (`Test Files  2 passed (2)`, `Tests  5 passed (5)`).

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts contexts/inventory/application/request-transfer/request-transfer.test.ts`. RED exit code **1** (dispatch suite failed to load; 0 tests). GREEN exit code **0** (2 files, 5 passed) after the use case, the `#application/dispatch-transfer/*` import, and Biome format. |
| Runtime harness command/scenario and exact result | N/A. This batch is the dispatch use case with in-memory port doubles. No HTTP, persistence, receipt, or screen boundary. |
| Rollback boundary | Delete `contexts/inventory/application/dispatch-transfer/`. Remove the `#application/dispatch-transfer/*` line from `contexts/inventory/package.json`. Remove `document: "transfer"` from `TransferVoucherDraft`. |

## Behavior locked

- Dispatch calls `Transfer.dispatch`. That stamps `dispatchedAt` and `inTransitAt` together and moves status to `in_transit`. This slice does not reimplement that state machine and does not call `receive`.
- Both stored costs copy the origin `averageCost`: the `transfer_out` movement `unitCost` and the line `unitCost`. Quantity is the negative dispatch quantity. `nextAverageCost` is not called. Origin average stays 12 when 4 leave a balance of 10.
- The voucher is printed with document `transfer`, the transfer id, and the lines. An audit `inventory.dispatch-transfer` records the actor, device, and the requested to in-transit change.
- A company warehouse (`originVenueId` null) stores the destination `venueId` on the movement. A site-to-site dispatch stores the origin venue. `stock_movements.venue_id` is not null.
- `orderLineId`, `role`, and `recipeVersion` stay null. The use case does not enqueue the `after_sales` outbox.
- Dispatch above origin on-hand throws `InsufficientOnHand`. Status, timestamps, line cost, movements, voucher, and audit stay unset.

## Deviations

- `TransferStock` lives in `dispatch-transfer.ts`. `TransferRepository` was not given a new abstract method, so the request-transfer double still typechecks. The single PostgreSQL transaction remains task 3.2.
- `TransferVoucherDraft` gained `document: "transfer"`. No other caller constructed that draft.
- Venue choice uses `originVenueId` on the command. `InventoryLocation` has no venue, and that directory is shared with purchasing.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch is the dispatch half of PR 2 (tasks 2.3–2.4). Request (2.1–2.2) stays in place. Receipt, levels, persistence, and HTTP are not included.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain

## Remaining

Tasks 2.5 through 5.2. 8 of 25 tasks complete. `state.yaml` stays `applying` and `apply: partial`.

## Batch 2.5 RED

Mode: Standard (`strict_tdd: false`). The failing test was written before the use case. `strict-tdd.md` was not loaded.

- [x] 2.5 RED `contexts/inventory/application/receive-transfer/receive-transfer.test.ts`: early receipt rejected; duplicate no-op; no `authorizerId` stores nothing; 9 of 10 at the copied origin cost; same `nextAverageCost` result as 1.3

Command: `pnpm exec vitest run --project inventory contexts/inventory/application/receive-transfer/receive-transfer.test.ts contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts`

Exit code: **1**

Result: 1 failed suite, 3 passed. Vite reported `Missing "#application/receive-transfer/receive-transfer.js" specifier in "@blackhole/inventory"`. The use case module did not exist yet. Dispatch stayed green (3 passed).

## Batch 2.6 GREEN

Mode: Standard (`strict_tdd: false`). Production code followed the failing test. `strict-tdd.md` was not loaded.

- [x] 2.5 RED early receipt rejected; duplicate no-op; no `authorizerId` stores nothing; 9 of 10 at the copied origin cost; same `nextAverageCost` result as 1.3
- [x] 2.6 GREEN `receive-transfer/`: one `TransferRepository` transaction updates `average_cost`

Command: `pnpm exec vitest run --project inventory contexts/inventory/application/receive-transfer/receive-transfer.test.ts contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts`

Exit code: **0**

Result: 2 files, 9 passed. Repeated after Biome format; exit code **0** again (`Test Files  2 passed (2)`, `Tests  9 passed (9)`).

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/receive-transfer/receive-transfer.test.ts contexts/inventory/application/dispatch-transfer/dispatch-transfer.test.ts`. RED exit code **1** (receive suite failed to load; dispatch 3 passed). GREEN exit code **0** (2 files, 9 passed) after the use case, `TransferRepository.receive`, the `#application/receive-transfer/*` import, and Biome format. |
| Runtime harness command/scenario and exact result | N/A. This batch is the receipt use case with in-memory port doubles. No HTTP, persistence, stock-level, or screen boundary. |
| Rollback boundary | Delete `contexts/inventory/application/receive-transfer/`. Remove `receive` and the receipt write types from `application/ports/transfer-repository.ts`, leaving `save` and `find`. Remove `#application/receive-transfer/*` from `contexts/inventory/package.json`. Remove the rejecting `receive` stubs from the request and dispatch test doubles. |

## Behavior locked

- Receipt calls `Transfer.receive`. That is legal only from `in_transit`. A requested transfer throws `TransferNotInTransit` and stores nothing: no transaction, no movement, no average change, no audit.
- A second receipt of a transfer already `received` or `received_with_differences` returns the same transfer and does not call `TransferRepository.receive` again.
- A shortfall without `authorizerId` throws `UnauthorizedTransferDifference` before `Transfer.receive`. Status stays `in_transit`. Nothing is stored.
- 9 received of 10 stay on the line at the origin `unitCost` copied at dispatch. `transfer_in` quantity is 9, positive. `unitCost` is that copied cost. Shortfall is 1.
- The destination average is the `averageCost` returned by `Transfer.receive`, which calls the existing `nextAverageCost`. 1000 g at 10 plus 1000 g at 12 is 11. On-hand at or below 0 stores the copied receipt cost. This slice does not change that formula and does not add another one.
- `TransferRepository.receive` is the single write. It carries the transfer, the `transfer_in` rows, and the destination `average_cost`. `save` is not called again.
- `orderLineId`, `role`, and `recipeVersion` stay null. The use case does not enqueue `after_sales`.
- The receipt is audited as `inventory.receive-transfer` after that transaction. A rejected or repeated receipt does not audit again.

## Deviations

- `UnknownTransfer` and `UnauthorizedTransferDifference` live in `receive-transfer.ts`. `dispatch-transfer.ts` was not edited.
- `TransferRepository` gained abstract `receive` plus `TransferInMovement`, `TransferAverageUpdate`, and `TransferReceiptWrite`. `save` and `find` stay. The request and dispatch memory doubles implement `receive` by rejecting, so they still typecheck. Those tests do not call it.
- `DestinationStock` only reads the destination balance. The average write goes through the repository transaction, not back through that reader.
- `contexts/inventory/package.json` gained `#application/receive-transfer/*`. Existing import keys stay.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch is the receipt half of PR 3 (tasks 2.5–2.6). Levels (2.7–2.10) are not included.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain

## Remaining

Tasks 2.7 through 5.2. 10 of 25 tasks complete. `state.yaml` stays `applying` and `apply: partial`.

## Batch 2.9 RED

Mode: Standard (`strict_tdd: false`). The failing test was written before the use case. `strict-tdd.md` was not loaded.

- [x] 2.9 RED `contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts`: below minimum returns `maximum - onHand`; else nothing. Minimum 5, maximum 20, on-hand 4 suggests 16. At or above minimum, and an ingredient without levels, suggest nothing. No stock movement and no transfer request.

Command: `pnpm exec vitest run --project inventory contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts`

Exit code: **1**

Result: 1 failed suite, 0 tests. Vite reported `Missing "#application/suggest-replenishment/suggest-replenishment.js" specifier in "@blackhole/inventory"`. The use case module did not exist yet.

## Batch 2.9 GREEN

Mode: Standard (`strict_tdd: false`). Production code followed the failing test. `strict-tdd.md` was not loaded.

- [x] 2.9 RED below minimum returns `maximum - onHand`; else nothing
- [ ] 2.10 GREEN `suggest-replenishment/` use case only. The `application/entry-port.ts` export waits, so 2.10 stays unchecked

Command: `pnpm exec vitest run --project inventory contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts`

Exit code: **0**

Result: 1 file, 3 passed. Repeated after Biome format; exit code **0** again (`Test Files  1 passed (1)`, `Tests  3 passed (3)`).

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts`. RED exit code **1** (suite failed to load; 0 tests). GREEN exit code **0** (1 file, 3 passed) after the use case, the `#application/suggest-replenishment/*` import, and Biome format. |
| Runtime harness command/scenario and exact result | N/A. This batch is the suggestion use case with in-memory port doubles. No HTTP, persistence, stock-level writer, or screen boundary. |
| Rollback boundary | Delete `contexts/inventory/application/suggest-replenishment/`. Remove the `#application/suggest-replenishment/*` line from `contexts/inventory/package.json`. Leave every other import key in place. |

## Behavior locked

- Below minimum, the suggestion is `maximum - onHand`. Minimum 5, maximum 20, on-hand 4 suggests 16. The use case calls the existing `suggestReplenishment`. It does not restate the formula.
- On-hand at the minimum (5) or above it (20) suggests nothing.
- An ingredient without levels suggests nothing.
- This slice does not append a stock movement and does not call `Transfer.request`. `StockLevelRepository.save` is not called.

## Deviations

- `OnHandStock` lives in `suggest-replenishment.ts` and only reads on-hand. A missing balance suggests nothing. The assigned cases always supply a balance.
- `contexts/inventory/package.json` gained `#application/suggest-replenishment/*`. Existing import keys stay. `entry-port.ts`, `set-stock-levels/`, `domain/stock-ledger.ts`, and `domain/transfer.ts` were not edited.
- Task 2.10 stays open because the five-use-case export from `application/entry-port.ts` is not part of this slice.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch is the suggestion half of PR 3 (task 2.9 and the use-case half of 2.10). The entry-port export, levels writer, persistence, HTTP, and screens are not included.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain

## Remaining

Task 2.10 stays unchecked. Tasks 2.7, 2.8, and 3.1 through 5.2 stay for their owners. `state.yaml` stays `applying` and `apply: partial`.

## Batch 3.1–3.2 memory

Mode: Standard (`strict_tdd: false`). The failing contract was written before the memory adapter. `strict-tdd.md` was not loaded.

- [x] 3.1 RED `transfer-repository.contract.ts` on memory: balances; rollback of movements, status, and `average_cost`; tenant hidden. No Drizzle mock
- [x] 3.2 GREEN `contexts/inventory/adapters/memory/in-memory-transfer-repository.ts`. Append-only. Skip `stock_movement_outbox`

RED command: `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-transfer-repository.contract.test.ts`

RED exit code: **1**

RED result: 1 failed suite, 0 tests. Vite reported `Cannot find module '#adapters/memory/in-memory-transfer-repository.js'`.

GREEN command: the same command.

GREEN exit code: **0**

GREEN result: 1 file, 3 passed. Repeated after Biome format inside the four-file run below.

## Batch 3.3–3.4 PGlite

Mode: Standard (`strict_tdd: false`). The PGlite harness was written before the SQL and the Drizzle repository. `strict-tdd.md` was not loaded.

- [x] 3.3 RED the same contract on PGlite with `SET LOCAL ROLE inventory_app` and `set_config('app.tenant_id', tenant, true)`
- [x] 3.4 GREEN `0004_transfers.sql` and `drizzle-transfer-repository.ts`. `transfers`, `transfer_lines`, `stock_levels`. Reuse `stock_movements`. `transfer_in` sets `average_cost`. No backfill. No SQLite

RED command: `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-transfer-repository.contract.test.ts`

RED exit code: **1**

RED result: 1 failed suite, 0 tests. Vite reported `Cannot find module '#adapters/postgres/drizzle-transfer-repository.js'`.

GREEN command: `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-transfer-repository.contract.test.ts contexts/inventory/adapters/postgres/drizzle-transfer-repository.contract.test.ts`

GREEN exit code: **0**

GREEN result: 2 files, 6 passed.

## Batch 3.5–3.6 supply

Mode: Standard (`strict_tdd: false`). The failing use-case test was written before the use case. `strict-tdd.md` was not loaded.

- [x] 3.5 RED `declare-warehouse-supply.test.ts`: an unlinked warehouse is rejected and nothing is stored
- [x] 3.6 GREEN `declare-warehouse-supply.ts` and `0015_warehouse_supplies.sql`

RED command: `pnpm exec vitest run --project platform contexts/platform/application/declare-warehouse-supply/declare-warehouse-supply.test.ts`

RED exit code: **1**

RED result: 1 failed suite, 0 tests. Vite reported `Cannot find module '#application/declare-warehouse-supply/declare-warehouse-supply.js'`.

GREEN command: `pnpm exec vitest run --project platform contexts/platform/application/declare-warehouse-supply/declare-warehouse-supply.test.ts contexts/platform/adapters/postgres/warehouse-supplies.test.ts`

GREEN exit code: **0**

GREEN result: 2 files, 3 passed.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | After Biome: `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-transfer-repository.contract.test.ts contexts/inventory/adapters/postgres/drizzle-transfer-repository.contract.test.ts --project platform contexts/platform/application/declare-warehouse-supply/declare-warehouse-supply.test.ts contexts/platform/adapters/postgres/warehouse-supplies.test.ts`. Exit code **0**. `Test Files  4 passed (4)`. `Tests  9 passed (9)`. |
| Runtime harness command/scenario and exact result | PGlite loads `0001_recipe_catalog.sql`, `0002_stock_ledger.sql`, `0003_purchasing.sql`, and `0004_transfers.sql`. Each transfer call uses `SET LOCAL ROLE inventory_app` and `SELECT set_config('app.tenant_id', tenant, true)`. Tenant B does not see tenant A's transfer, movement, balance, or average. A failed insert rolls back status, movements, and `average_cost`. `stock_movement_outbox` stays empty. Platform PGlite loads `0002_organization.sql` and `0015_warehouse_supplies.sql` as `organization_app`. Tenant B cannot read tenant A's supply link. No socket and no `listen`. |
| Rollback boundary | Delete `contexts/inventory/application/ports/transfer-repository.contract.ts`, `contexts/inventory/adapters/memory/in-memory-transfer-repository.ts`, `contexts/inventory/adapters/memory/in-memory-transfer-repository.contract.test.ts`, `contexts/inventory/adapters/postgres/0004_transfers.sql`, `contexts/inventory/adapters/postgres/drizzle-transfer-repository.ts`, `contexts/inventory/adapters/postgres/drizzle-transfer-repository.contract.test.ts`, `contexts/platform/application/declare-warehouse-supply/`, `contexts/platform/adapters/postgres/0015_warehouse_supplies.sql`, and `contexts/platform/adapters/postgres/warehouse-supplies.test.ts`. Remove only the `#application/declare-warehouse-supply/*` line from `contexts/platform/package.json`. |

## Behavior locked

- A receipt of 1000 g at unit cost 12 into a destination that already holds 1000 g at 10 stores balance 2000 and `average_cost` 11. The origin balance stays 4000 at 12. The only movement is a positive `transfer_in`. `stock_movement_outbox` stays 0.
- The same receipt for tenant A is hidden from tenant B: no transfer, no movement, balance 0, average 0.
- `failOnInsert(1)` throws inside the receipt write. Status stays `in_transit`. The line keeps unit cost 12 and has no received quantity. Destination balance and average stay 1000 and 10. No movement is stored.
- Movements are inserted, not updated. Sale columns stay null.
- North, a warehouse of another site, cannot be declared as a supplier of site A. Nothing is stored.
- Central, a company warehouse (`venueId` null), can be declared for site A. The link is stored.
- `warehouse_supplies` is isolated by `app.tenant_id` for `organization_app`.

## Deviations

- `stock_balances.average_cost` already exists from `0003_purchasing.sql`. The transfer repository writes it with SQL text. `schema.ts` and `drizzle-stock-ledger-repository.ts` were not edited. This is not a blocker.
- `Transfer` has no restore method. `find` rebuilds the aggregate with `request`, `dispatch`, and `receive`. The stored `average_cost` is the receipt value. The rebuild does not write the ledger again.
- A site warehouse of another venue is rejected. A company warehouse and the site's own warehouse are accepted. `contexts/platform/domain` was not edited. The rule lives in the use case.
- `stock_levels` is created and unused. `set-stock-levels` belongs to another slice.
- There is no Drizzle adapter for `warehouse_supplies`. The use case is tested with an in-memory store. The SQL file is executed on PGlite.
- `contexts/platform/package.json` gained `#application/declare-warehouse-supply/*`. Existing keys stay in place.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch is PR 4 Memory (3.1–3.2) and PR 5 Postgres and supply (3.3–3.6). HTTP and screens are not included.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain
- No commit and no branch.

## Remaining

Tasks 2.7, 2.8, and 2.10 stay unchecked. Tasks 4.1 through 5.2 stay for their owners. 17 of 25 tasks complete. `state.yaml` stays `applying` and `apply: partial`.

## Batch 4.1–4.2 HTTP contracts and RED

Mode: Standard (`strict_tdd: false`). The failing HTTP test was written before the controller. `strict-tdd.md` was not loaded. Task 4.3 is not done.

- [x] 4.1 `shared/contracts/transfer.ts` and the append on `shared/contracts/index.ts`. Strict Zod request, dispatch, receipt, and stock levels. No Zod in domain. Purchasing and reporting exports stay.
- [x] 4.2 RED `apps/api-cloud/test/http/transfers.controller.test.ts` via Fastify `inject`, no listen.
- [ ] 4.3 GREEN controller and `transfersEnabled` wiring. Blocked. The controller was not created.

RED command: `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/transfers.controller.test.ts`

RED exit code: **1**

RED result: 1 failed suite, 0 tests. Vite reported `Cannot find module '#src/http/transfers.controller.js'`.

GREEN command: not run. There is no controller to turn the suite green.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/transfers.controller.test.ts`. RED exit code **1**. `Test Files  1 failed (1)`. `Tests  no tests`. Missing `#src/http/transfers.controller.js`. |
| Runtime harness command/scenario and exact result | Not run. The HTTP inject harness cannot boot a transfer route until task 4.3. Flag off, unregistered device, waiter, hidden `unitCost`, Zod 400, and difference authorization are specified in the test and have no passing run. |
| Rollback boundary | Delete `shared/contracts/transfer.ts`, `apps/api-cloud/test/http/transfers.controller.test.ts`, and the `transfer.js` export block in `shared/contracts/index.ts`. Leave purchasing and reporting exports in place. |

## Blocker for 4.3

`RequestTransfer`, `DispatchTransfer`, `ReceiveTransfer`, `TransferRepository`, `WarehouseSupply`, `TransferStock`, `DestinationStock`, `TransferVoucher`, and `DrizzleTransferRepository` are not exported by `@blackhole/inventory`. Node resolves those subpaths as `ERR_PACKAGE_PATH_NOT_EXPORTED`. `application/entry-port.ts` does not export the four use cases (task 2.10 is still open). `contexts/inventory/package.json` exports do not include the transfer port, the voucher port, or `drizzle-transfer-repository`. Those two files are owned by another agent and were not edited. `permission-catalog.ts` already has `inventory.request-replenishment` and `inventory.receive-transfer`. `application-module.ts` was not edited.

A controller that calls the existing use cases cannot be constructed without those public exports. No second persistence path was added.

## Behavior locked by the RED test

The suite does not execute these assertions yet. They are the contract for 4.3:

- Flag off: `POST /tenants/:tenantId/transfers` is 404, Fastify is not listening, and `TransfersController` is absent.
- Administration session (`deviceId` empty): 403 `{ error: "UnregisteredDevice" }` and `transfers` stays empty.
- Waiter on a registered device: 403 `{ error: "TransferRequestDenied" }`. `routePermissions["POST transfers"]` is `inventory.request-replenishment`.
- Unknown body field: 400 and no transfer row.
- Keeper dispatch omits `unitCost`. A site administrator dispatch of the same quantity exposes `unitCost` 12, the seeded origin average.
- Dispatch and receipt permissions are `inventory.receive-transfer`.
- Keeper shortfall without `authorizerId`: 403 `{ error: "UnauthorizedTransferDifference" }` and status stays `in_transit`.
- Keeper shortfall with `authorizerId`: 200, status `received_with_differences`, and `unitCost` stays hidden.
- Site administrator (YES) shortfall without `authorizerId`: 200 and `unitCost` 12.

`stockLevelsCommand` accepts whole scaled units when `maximum >= minimum` and rejects a maximum below the minimum. `requestTransferCommand` rejects an unknown key. There is no levels route in this batch.

## Deviations

- Task 4.3 was not implemented. `apps/api-cloud/src/composition/application-module.ts` is unchanged.
- The RED test expects the site warehouse created with `addSiteWarehouse` to be an accepted origin. `WarehouseSupply` is not on the public API, and this batch adds no declare-supply route.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch is the contract and RED half of PR 6 HTTP (4.1–4.2). The controller wiring (4.3), levels writer, and screens are not included.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain
- No commit and no branch.

## Remaining

Tasks 2.7, 2.8, 2.10, and 4.3 stay unchecked. Tasks 5.1 and 5.2 stay for their owners. 19 of 25 tasks complete. `state.yaml` stays `applying` and `apply: partial`. The api-cloud project fails to load `transfers.controller.test.ts` until 4.3 adds the controller module.

## Batch 2.7–2.8 and 2.10 levels and public exports

Mode: Standard (`strict_tdd: false`). The failing location-level test was written and run before the production change. `strict-tdd.md` was not loaded. Tasks 4.3, 5.1, and 5.2 were not implemented. `application-module.ts` was not edited.

- [x] 2.7 RED location stock levels: 5 kg and 20 kg are stored as scaled base units (`QUANTITY_SCALE` 1000). No shortage alert and no shortage location write.
- [x] 2.8 GREEN `set-stock-levels/`. The existing site path still checks `inventory.configure-levels` and still stores a site override. A location command stores `StockLevel` and does not open an alert.
- [x] 2.10 `suggest-replenishment/` was already green from 2.9. It was not rewritten. `application/entry-port.ts` now exports `RequestTransfer`, `DispatchTransfer`, `ReceiveTransfer`, `SuggestReplenishment`, and `SetStockLevels`.

RED command: `pnpm exec vitest run --project inventory contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts`

RED exit code: **1**

RED result: `Test Files  1 failed (1)`. `Tests  1 failed | 5 passed (6)`. The new location command reached `defineStockLevels` and threw `InvalidStockLevels` because `reorderPoint` was missing. The three existing shortage tests stayed green. The two rejection cases also stayed green on that old throw.

GREEN command: `pnpm exec vitest run --project inventory contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts`

GREEN exit code: **0**

GREEN result: `Test Files  2 passed (2)`. `Tests  9 passed (9)`.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | RED: `pnpm exec vitest run --project inventory contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts`. Exit code **1**. `Tests  1 failed \| 5 passed (6)`. GREEN: `pnpm exec vitest run --project inventory contexts/inventory/application/set-stock-levels/set-stock-levels.test.ts contexts/inventory/application/suggest-replenishment/suggest-replenishment.test.ts`. Exit code **0**. `Test Files  2 passed (2)`. `Tests  9 passed (9)`. |
| Runtime harness command/scenario and exact result | N/A for HTTP. Task 4.3 still owns the controller. Node resolves the new export map entries to the same `.js` URL shape as `drizzle-purchasing-repository` (`ERR_MODULE_NOT_FOUND` on the `.ts` source, not `ERR_PACKAGE_PATH_NOT_EXPORTED`). |
| Rollback boundary | Revert `contexts/inventory/application/set-stock-levels/set-stock-levels.ts`, `set-stock-levels.test.ts`, the appended transfer exports in `contexts/inventory/application/entry-port.ts`, and the five new `package.json` export keys (`transfer-repository`, `warehouse-supply`, `transfer-voucher`, `stock-level-repository`, `drizzle-transfer-repository`). Leave the site shortage tests, `suggest-replenishment.ts`, and the existing import keys in place. |

## Behavior locked

- A point-of-sale level of minimum 5 kg and maximum 20 kg is stored as 5000 and 20000 on `StockLevelRepository`. `saveLevelAlert` and `saveLocationLevel` are not called. The site shortage row stays empty. `EvaluatePermission` is not called for that command.
- A minimum of 5.5, or a maximum below the minimum, throws `InvalidStockLevels`. Nothing is stored and no alert is opened.
- The existing site override still stores scaled kilograms, still rejects a reorder point under the minimum, and still rejects a session without `inventory.configure-levels`.
- Suggestion is unchanged: minimum 5, maximum 20, on-hand 4 returns 16. On-hand at the minimum, or no stored level, returns nothing. No movement and no transfer are stored.

## Public exports added

No import keys were missing. `#application/request-transfer/*`, `#application/dispatch-transfer/*`, `#application/receive-transfer/*`, `#application/set-stock-levels/*`, and `#application/suggest-replenishment/*` were already present. `approve-adjustment` and the shortage keys were left in place.

Exports map:

- `@blackhole/inventory/application/ports/transfer-repository`
- `@blackhole/inventory/application/ports/warehouse-supply`
- `@blackhole/inventory/application/ports/transfer-voucher`
- `@blackhole/inventory/application/ports/stock-level-repository`
- `@blackhole/inventory/adapters/postgres/drizzle-transfer-repository`

`RequestTransfer`, `DispatchTransfer`, `ReceiveTransfer`, `SuggestReplenishment`, `SetStockLevels`, `TransferStock`, `DestinationStock`, and `OnHandStock` are exported from `@blackhole/inventory/application/entry-port`, which was already on the exports map. `UnknownTransfer` is exported twice under `UnknownTransferDispatch` and `UnknownTransferReceipt`.

## Deviations

- Location levels do not multiply again. The caller passes whole scaled units, the same way the shortage tests pass `kilograms(n)`.
- The location command does not check `inventory.configure-levels`. Request, dispatch, and receive also leave that gate to HTTP. The site command still checks it.
- `suggest-replenishment.ts` was not rewritten. Task 2.10 is the entry-port export.
- `stock-ledger.ts` was not edited. Setting a level does not append a movement.
- `application-module.ts`, `transfers.controller.ts`, and task 4.3 were not touched.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch finishes the levels half of PR 3 Receipt and levels (2.7, 2.8, 2.10) and the package exports that were blocking PR 6. Tasks 2.5 and 2.6 were already done. The controller (4.3) and screens (5.1, 5.2) are not included.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain
- No commit and no branch.

## Remaining

Tasks 4.3, 5.1, and 5.2 stay unchecked. 22 of 25 tasks complete. `state.yaml` stays `applying` and `apply: partial`. Task 4.3 can import the transfer use cases and `DrizzleTransferRepository`. It is still not implemented.

## Batch 4.3 GREEN

Mode: Standard (`strict_tdd: false`). The RED test from task 4.2 was left in place. `strict-tdd.md` was not loaded.

- [x] 4.3 GREEN `apps/api-cloud/src/http/transfers.controller.ts` and `composition/application-module.ts`. `transfersEnabled` defaults off. Request requires `inventory.request-replenishment`. Dispatch and receipt accept YES or WITH_AUTHORIZATION on `inventory.receive-transfer`. A short receipt needs YES or `authorizerId`.

Command: `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/transfers.controller.test.ts`

Exit code: **0**

Result: `Test Files  1 passed (1)`. `Tests  8 passed (8)`. Fastify `inject` only. Nothing listened.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project api-cloud apps/api-cloud/test/http/transfers.controller.test.ts`. Exit code **0**. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |
| Runtime harness command/scenario and exact result | The same Vitest file boots Nest on Fastify and calls `inject`. Flag off returns 404 and `TransfersController` is absent. Unregistered device returns 403 `UnregisteredDevice` and writes no row. Waiter returns 403 `TransferRequestDenied`. Keeper dispatch omits `unitCost`; site administrator dispatch shows origin average 12. Unknown field `vat` returns 400. Keeper short receipt without `authorizerId` returns 403 `UnauthorizedTransferDifference` and leaves `in_transit`. Keeper with `authorizerId`, and site administrator without one, return 200 `received_with_differences`. `server.listening` stays false. |
| Rollback boundary | Revert `apps/api-cloud/src/http/transfers.controller.ts` and the transfers append in `apps/api-cloud/src/composition/application-module.ts` (flag, `openTransfers`, controller spread, provider spread, and the new imports). Leave purchasing, production, and inventory-report registration in place. |

## Behavior locked

- `transfersEnabled` is off unless the dependency is exactly `true`. Off means the controller is not registered. On without PostgreSQL throws `Transfers require PostgreSQL.`
- Request, dispatch, and receipt are `POST /tenants/:tenantId/transfers`, `.../dispatch`, and `.../receipt`. An empty session `deviceId` is `UnregisteredDevice` and writes nothing.
- A waiter is denied the request. A warehouse keeper (WITH_AUTHORIZATION) and a site administrator (YES) can dispatch and receive. `inventory.view-cost` controls whether `unitCost` is present.
- A short receipt from a WITH_AUTHORIZATION keeper without `authorizerId` throws `UnauthorizedTransferDifference` before the receipt write. YES supplies the session user as `authorizerId` when the body omits it. An explicit `authorizerId` is passed through.

## Deviations

- `WarehouseSupply.linked` reads the organization. A warehouse supplies a venue when its `venueId` is null or equals that venue. The HTTP test does not insert `warehouse_supplies`, and that table is not in the inventory migrations the test runs.
- `ReceiveTransfer` rejects a shortfall whenever `authorizerId` is null. YES therefore sends the session user id when the body has no `authorizerId`. The keeper path does not invent one.
- `PendingTransferVoucher.print` resolves without `EnqueuePrintJob`. The cloud printer repository in this host is the tip-printer store, and the test configures none. Calling enqueue would throw `PrinterNotConfigured` after the dispatch row was saved.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch is task 4.3 only, the last slice of PR 6 HTTP. Screens stay in PR 7.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain
- No commit and no branch.

## Remaining

Tasks 5.1 and 5.2 stay unchecked. 23 of 25 tasks complete. `state.yaml` stays `applying` and `apply: partial`.

## Batch 5.1–5.2 GREEN

Mode: Standard (`strict_tdd: false`). Tests were written first anyway (ADR-017). `strict-tdd.md` was not loaded. `state.yaml` stays `applying` / `apply: partial`. This batch does not archive.

- [x] 5.1 `TransferScreen` in `apps/admin-web/src/inventory/inventory-screen.tsx`. Request, dispatch, and QR receipt. `unitCost` is shown only when the recorded transfer includes it. Purchase and production screens stay.
- [x] 5.2 `apps/venue-app/src/router.tsx` route `/transfers` and `apps/venue-app/src/transfers/transfer-screen.tsx`. Same three POSTs. No local receipt.

### RED

| Suite | Result |
|---|---|
| `pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/transfer-screen.test.tsx` | Exit **1**. `Test Files  1 failed (1)`. `Tests  8 failed (8)`. `TransferScreen` was undefined. |
| `pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/transfers/transfer-screen.test.tsx` | Exit **1**. `Test Files  1 failed (1)`. `Tests  no tests`. Import `#src/transfers/transfer-screen.js` did not resolve. |

### GREEN

| Suite | Result |
|---|---|
| Admin transfer screen | Exit **0**. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |
| Venue transfer screen | Exit **0**. `Test Files  1 passed (1)`. `Tests  8 passed (8)`. |
| Admin purchase and production screens | Exit **0**. `Test Files  2 passed (2)`. `Tests  11 passed (11)`. |
| Venue purchasing screen | Exit **0**. `Test Files  1 passed (1)`. `Tests  6 passed (6)`. |

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Admin: `pnpm exec vitest run --project admin-web apps/admin-web/test/inventory/transfer-screen.test.tsx`. Exit **0**. 8 passed. Venue: `pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/transfers/transfer-screen.test.tsx`. Exit **0**. 8 passed. |
| Runtime harness command/scenario and exact result | Both commands run the screens in jsdom with `fetch` stubbed. Request posts `/tenants/pilot/transfers` with `x-session-id: admin-web` and no `vat` or `unitCost`. Dispatch posts `.../t-0112/dispatch` with `actorId` and `deviceId`. QR receipt posts `.../t-0112/receipt`. A short receipt omits `authorizerId` unless the field is filled. Cost text appears only when the response line has `unitCost`. Offline and rejected calls leave `localStorage` and `sessionStorage` empty. No browser session and no listening server. |
| Rollback boundary | Revert `apps/admin-web/src/inventory/inventory-screen.tsx` transfer additions, `apps/admin-web/test/inventory/transfer-screen.test.tsx`, `apps/venue-app/src/transfers/transfer-screen.tsx`, `apps/venue-app/test/transfers/transfer-screen.test.tsx`, and the `/transfers` route plus nav link in `apps/venue-app/src/router.tsx`. Leave purchase, production, and the purchasing route in place. |

## Behavior locked

- Header `x-session-id`. Request body is `transferId`, `originLocationId`, `destinationLocationId`, and lines of `ingredientId` plus `quantity`. Dispatch body is `actorId` and `deviceId`. Receipt body is lines of `ingredientId` plus `receivedQuantity`, and `authorizerId` only when that field is non-empty.
- The QR text is JSON with `transferId` and lines. The receipt URL uses that id. A missing cost is not rendered. Nothing is written to web storage.
- Admin routes `/inventory/transfers` and `/inventory/transfers/t-0112` render `TransferScreen`. The detail route starts with transfer id `t-0112`. Venue route is `/transfers`.

## Deviations

- `TransfersScreen` and `TransferDetailScreen` no longer render the static list and print prototype. Those view components remain in `inventory-view.tsx`. Purchase and production were not removed.
- Venue does not depend on `@blackhole/contracts`. It checks the recorded transfer shape locally. Admin uses `recordedTransfer.safeParse`.
- Dispatch still sends `actorId` and `deviceId` because the command schema requires them. The controller reads the actor from the session.
- No browser pass. The assigned proof is the component tests.

## Workload / PR boundary

- Mode: feature-branch-chain. This batch is PR 7 Screens (5.1–5.2), base PR 6. No commit and no branch.
- Decision needed before apply: No
- Chain strategy: feature-branch-chain
- 400-line budget risk stays High for the whole change. This slice is only the screens.

## Remaining

Tasks 5.1 and 5.2 are checked. 25 of 25 tasks complete. `state.yaml` stays `applying` and `apply: partial`. Do not archive from this batch.

