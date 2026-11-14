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

