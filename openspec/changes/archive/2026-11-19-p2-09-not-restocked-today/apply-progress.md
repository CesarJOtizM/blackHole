# Apply progress: p2-09-not-restocked-today

Change: `p2-09-not-restocked-today`
Work units recorded: 7 of 9
Mode: Standard (`strict_tdd: false`). RED then GREEN still ran, as required by ADR-017 and `rules.apply`. `strict-tdd.md` was not loaded.
Committed: no
Pushed: no

Tasks 1.1 through 4.8 and 5.1 through 5.4 are complete. HTTP was not started. Ready for the next apply batch (6.1–6.7). Verify was not run.

## Completed tasks

- [x] 1.1 RED `contexts/inventory/domain/no-restock-today.test.ts`. No Nest. Portions below 1 and no `dispatched` or `in_transit` transfer proposes; no actor confirms nothing.
- [x] 1.2 GREEN `contexts/inventory/domain/no-restock-today.ts` and `domain/index.ts`.
- [x] 2.1 RED `contexts/orders/domain/check.test.ts`: oldest uncovered `sent` to `not_delivered`; confirm leaves started lines; station may move `in_preparation` or `ready`.
- [x] 2.2 GREEN `contexts/orders/domain/check.ts`. `advance` stays one rank. `total` skips `not_delivered`.
- [x] 3.1 RED `propose-no-restock-today.test.ts`: flag off and covered stock write nothing.
- [x] 3.2 GREEN that folder and `application/ports/portion-supply.ts`. Add its `#` import.
- [x] 3.3 RED `confirm-no-restock-today.test.ts` and `permission-catalog.test.ts`: waiter rejected; chief confirms; retry is idempotent. Flag off rejects.
- [x] 3.4 GREEN confirm. `cells(Y, Y, Y, N, N, N, Y, N)` on `inventory.confirm-no-restock`. No line changes.
- [x] 3.5 RED `remove-no-restock-today.test.ts`: same roles; audit `inventory.remove-no-restock`.
- [x] 3.6 GREEN remove. Export three use cases. Add three `#application` maps.
- [x] 4.1 RED `withdraw-unstarted-lines.test.ts`: uncovered `sent` to `not_delivered`; one `not_restocked` per check.
- [x] 4.2 GREEN that folder and `not_restocked` on `application/ports/realtime-hub.ts`.
- [x] 4.3 RED `confirm-guest-told.test.ts`: notice stays until `orders.guest-told`.
- [x] 4.4 GREEN that folder for `checkId`, `lineId`, `actorId`.
- [x] 4.5 RED `mark-line-undeliverable.test.ts`: `in_preparation` or `ready` only; `delivered` rejected.
- [x] 4.6 GREEN that folder. Export three use cases and `#` maps.
- [x] 4.7 RED `take-order.test.ts` and `apply-qr-order.test.ts`: marked product rejected; other lines proceed. No reconnect.
- [x] 4.8 GREEN `take-order.ts` `fire` and `apply-qr-order.ts` via the inventory entry port.
- [x] 5.1 RED `no-restock-repository.contract.ts` on memory: other tenant hidden; later date is `expired`.
- [x] 5.2 GREEN `adapters/memory/in-memory-no-restock-repository.ts`. No Drizzle mock.
- [x] 5.3 RED that contract on PGlite with `app.tenant_id`.
- [x] 5.4 GREEN `no_restock_today` (`tenant_id`, RLS) and orders withdrawal columns. No SQLite.

## Unit 1 RED / GREEN evidence

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/domain/no-restock-today.test.ts
```

RED (before `no-restock-today.ts` existed):

- Exit code: 1
- `FAIL contexts/inventory/domain/no-restock-today.test.ts`
- `Error: Cannot find module '#domain/no-restock-today.js'`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 239ms

GREEN (after `no-restock-today.ts`, the `domain/index.ts` export, and Biome on the two new files):

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 8 passed (8)
- Duration: 282ms

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/domain/no-restock-today.test.ts`. RED exit 1 (`Cannot find module '#domain/no-restock-today.js'`, 1 failed file, no tests). GREEN exit 0 (1 file, 8 passed). |
| Runtime harness command/scenario and exact result | N/A. This unit is a pure domain rule with no HTTP, database, or process boundary. |
| Rollback boundary | Delete `contexts/inventory/domain/no-restock-today.test.ts` and `contexts/inventory/domain/no-restock-today.ts`. Remove the single `export { NoRestockToday }` line from `contexts/inventory/domain/index.ts`. Revert tasks 1.1 and 1.2, `state.yaml` apply/status, and this file. |

## Domain behavior covered

- Portions below 1 at the point and at supplying warehouses, with a transfer that is not `dispatched` or `in_transit`, raises `proposed`. The coverage object is unchanged and the mark has no movements.
- A `dispatched` or `in_transit` transfer raises no proposal. Portions of 1 at either place raise no proposal.
- Confirm with a null, blank, or empty actor throws `MissingActor`. Status stays `proposed`.
- Confirm with an actor stores that actor and the `America/Bogota` calendar date. A later Bogota date reads `expired` while the service is still open. There is no service-close clock.
- Remove without an actor is rejected. Remove with an actor stays `removed` after midnight.

## Workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: PR 1 on tracker, tasks 1.1–1.2
- Boundary: inventory domain mark and proposal rule only
- Estimated review budget impact: about 290 lines in this slice. The change-wide forecast stays High; later units stay on their own PRs.

## Deviations from Design

None. Implementation matches the domain rules in the design. A proposal does not move stock. Confirming with no actor is rejected in the domain. States are `proposed`, `confirmed`, `removed`, and `expired`.

## Issues Found

None.

## Remaining tasks

- [x] 2.1–2.2 Orders domain
- [x] 3.1–3.2 Inventory proposal
- [x] 3.3–3.6 Confirm and remove
- [x] 4.1–4.2 Withdraw unstarted lines
- [x] 4.3–4.8 Guest told, cannot finish, and send block
- [x] 5.1–5.4 Memory, then Postgres
- [ ] 6.1–6.7 HTTP inject, then screen

22/29 tasks complete. Next batch is 6.1–6.7. HTTP was not started.

## Unit 2 RED evidence

Command:

```text
pnpm exec vitest run --project orders contexts/orders/domain/check.test.ts
```

RED (tests added in `check.test.ts` before `withdrawUncoveredSent` and `markNotDeliverable` existed):

- Exit code: 1
- `FAIL contexts/orders/domain/check.test.ts`
- `TypeError: check.withdrawUncoveredSent is not a function`
- `TypeError: check.markNotDeliverable is not a function`
- Test Files: 1 failed (1)
- Tests: 5 failed | 21 passed (26)
- Duration: 323ms

The one-rank test passed on this run because `advance` already rejects a state that is not the next rank. GREEN must keep that rejection once `not_delivered` exists.

## Unit 2 GREEN evidence

Command:

```text
pnpm exec vitest run --project orders contexts/orders/domain/check.test.ts
```

GREEN (after `not_delivered` on `check.ts`):

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 26 passed (26)
- Duration: 273ms

## Unit 2 Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project orders contexts/orders/domain/check.test.ts`. RED exit 1 (`withdrawUncoveredSent` and `markNotDeliverable` are not functions; 5 failed, 21 passed). GREEN exit 0 (1 file, 26 passed). |
| Runtime harness command/scenario and exact result | N/A. This unit is a pure domain rule with no HTTP, database, or process boundary. |
| Rollback boundary | Revert `contexts/orders/domain/check.ts` and `contexts/orders/domain/check.test.ts`. Uncheck tasks 2.1 and 2.2 and remove this unit's RED and GREEN sections. Leave tasks 1.1 and 1.2 and `state.yaml` (`status: applying`, `apply: partial`) as they were. |

## Unit 2 domain behavior covered

- The oldest `sent` line of the product, by `sentAt` then check order, becomes `not_delivered` until uncovered portions are below 1. A later `sent` line stays. Zero uncovered portions change nothing.
- Confirm leaves `in_preparation`, `ready`, `delivered`, and `held`. Another product stays `sent`.
- The station path moves only `in_preparation` or `ready` to `not_delivered`. `sent` and `delivered` throw `UndeliverableLineRejected` and stay. `advance` from `not_delivered` is rejected.
- `advance` still moves one rank: `sent` to `in_preparation` to `ready` to `delivered`. `not_delivered` is not a rank, so `sent` cannot advance to it.
- `total` skips `not_delivered` and still skips `held`. Withdrawn lines keep their price and gain `notDeliveredAt`. No stock movement and no service-close clock.

## Unit 2 workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: PR 2 on PR 1, tasks 2.1–2.2
- Boundary: orders domain withdrawal on `Check` only
- Estimated review budget impact: about 520 lines in this slice (`check.test.ts` additions plus `check.ts`). The change-wide forecast stays High; later units stay on their own PRs.

## Unit 2 deviations from design

Guest-told recording is not on `Check` yet. A withdrawn line stays `not_delivered` with no guest-told stamp. Tasks 4.3 and 4.4 own that confirmation. This slice does not add a Bogota clock; the inventory mark from 1.2 already stores the `America/Bogota` calendar date.

## Unit 2 issues found

None.

## Unit 3 RED evidence

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/propose-no-restock-today/propose-no-restock-today.test.ts
```

RED (test file only, before `propose-no-restock-today.ts`, `portion-supply.ts`, and the package import existed):

- Exit code: 1
- `FAIL contexts/inventory/application/propose-no-restock-today/propose-no-restock-today.test.ts`
- `Error: Missing "#application/propose-no-restock-today/propose-no-restock-today.js" specifier in "@blackhole/inventory" package`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 417ms

## Unit 3 GREEN evidence

Command:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/propose-no-restock-today/propose-no-restock-today.test.ts
```

GREEN (after `propose-no-restock-today.ts`, `portion-supply.ts`, the `#application/propose-no-restock-today/*` import, and Biome on the new files):

- Exit code: 0
- Test Files: 1 passed (1)
- Tests: 4 passed (4)
- Duration: 442ms

## Unit 3 Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project inventory contexts/inventory/application/propose-no-restock-today/propose-no-restock-today.test.ts`. RED exit 1 (`Missing "#application/propose-no-restock-today/propose-no-restock-today.js" specifier in "@blackhole/inventory" package`, 1 failed file, no tests). GREEN exit 0 (1 file, 4 passed). |
| Runtime harness command/scenario and exact result | N/A. This unit is a use case with in-memory port doubles. No HTTP, database, or process boundary. |
| Rollback boundary | Delete `contexts/inventory/application/propose-no-restock-today/` and `contexts/inventory/application/ports/portion-supply.ts`. Remove the `#application/propose-no-restock-today/*` import from `contexts/inventory/package.json`. Uncheck tasks 3.1 and 3.2 and remove this unit's RED and GREEN sections. Leave tasks 1.1, 1.2, 2.1, and 2.2, and `state.yaml` (`status: applying`, `apply: partial`), as they were. |

## Unit 3 application behavior covered

- Flag off skips the portion read and saves nothing, including when the service is still open after midnight. `today` is the `America/Bogota` calendar date (`2026-11-14` at 05:01Z). There is no service-close clock.
- Covered stock (one portion at the point, or one portion at a supplying warehouse) saves nothing. A `dispatched` or `in_transit` transfer saves nothing.
- Portions below 1 and a transfer that is not `dispatched` or `in_transit` save one `proposed` mark. The coverage object is unchanged. The mark has no movements. Order lines stay `sent`.
- A proposal does not confirm, so `actorId` and `serviceDate` stay null. After midnight the mark still reads `proposed`. Before midnight, `today` is `2026-11-13`.

## Unit 3 workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: PR 3 on PR 2, tasks 3.1–3.2
- Boundary: inventory proposal use case and the read-only portion supply port
- Estimated review budget impact: about 280 lines in this slice. The change-wide forecast stays High; later units stay on their own PRs.

## Unit 3 deviations from design

The proposal writer is `NoRestockProposalStore` in the use case module. `application/ports/no-restock-repository.ts` stays for the persistence tasks. This slice does not export the use case from `entry-port.ts`.

## Unit 3 issues found

None.

## Unit 4 RED evidence (tasks 3.3)

Commands:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/confirm-no-restock-today/confirm-no-restock-today.test.ts
pnpm exec vitest run --project platform contexts/platform/domain/permission-catalog.test.ts
```

RED (confirm test file only, before `confirm-no-restock-today.ts` and its `#application` import existed):

- Exit code: 1
- `FAIL contexts/inventory/application/confirm-no-restock-today/confirm-no-restock-today.test.ts`
- `Error: Missing "#application/confirm-no-restock-today/confirm-no-restock-today.js" specifier in "@blackhole/inventory" package`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 270ms

RED (catalog expectation added before `inventory.confirm-no-restock` existed):

- Exit code: 1
- `FAIL contexts/platform/domain/permission-catalog.test.ts`
- `AssertionError: expected undefined to be 'inventory.confirm-no-restock'`
- Test Files: 1 failed (1)
- Tests: 1 failed | 418 passed (419)
- Duration: 294ms

## Unit 4 GREEN evidence (task 3.4)

Commands:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/confirm-no-restock-today/confirm-no-restock-today.test.ts
pnpm exec vitest run --project platform contexts/platform/domain/permission-catalog.test.ts
```

GREEN (after `confirm-no-restock-today.ts`, `inventory.confirm-no-restock` cells `Y, Y, Y, N, N, N, Y, N`, the `#application/confirm-no-restock-today/*` import, and Biome on the touched files):

- Inventory exit code: 0
- Test Files: 1 passed (1)
- Tests: 4 passed (4)
- Duration: 370ms
- Platform exit code: 0
- Test Files: 1 passed (1)
- Tests: 428 passed (428)
- Duration: 276ms

## Unit 4 RED evidence (task 3.5)

Commands:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/remove-no-restock-today/remove-no-restock-today.test.ts
pnpm exec vitest run --project platform contexts/platform/domain/permission-catalog.test.ts
```

RED (remove test file only, before `remove-no-restock-today.ts` and its `#application` import existed):

- Exit code: 1
- `FAIL contexts/inventory/application/remove-no-restock-today/remove-no-restock-today.test.ts`
- `Error: Missing "#application/remove-no-restock-today/remove-no-restock-today.js" specifier in "@blackhole/inventory" package`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 244ms

RED (catalog expectation added before `inventory.remove-no-restock` existed):

- Exit code: 1
- `FAIL contexts/platform/domain/permission-catalog.test.ts`
- `AssertionError: expected undefined to be 'inventory.remove-no-restock'`
- Test Files: 1 failed (1)
- Tests: 1 failed | 428 passed (429)
- Duration: 281ms

## Unit 4 GREEN evidence (task 3.6)

Commands:

```text
pnpm exec vitest run --project inventory contexts/inventory/application/confirm-no-restock-today/confirm-no-restock-today.test.ts contexts/inventory/application/remove-no-restock-today/remove-no-restock-today.test.ts contexts/inventory/application/propose-no-restock-today/propose-no-restock-today.test.ts
pnpm exec vitest run --project platform contexts/platform/domain/permission-catalog.test.ts
```

GREEN (after `remove-no-restock-today.ts`, `inventory.remove-no-restock` with the same cells, the three use-case exports, the three `#application` maps, and Biome on the touched files):

- Inventory exit code: 0
- Test Files: 3 passed (3)
- Tests: 12 passed (12)
- Duration: 382ms
- Platform exit code: 0
- Test Files: 1 passed (1)
- Tests: 438 passed (438)
- Duration: 295ms

## Unit 4 Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Inventory: `pnpm exec vitest run --project inventory` on confirm, remove, and propose. Confirm RED exit 1 (missing `#application/confirm-no-restock-today` specifier, 1 failed file, no tests). Catalog confirm RED exit 1 (`expected undefined to be 'inventory.confirm-no-restock'`, 1 failed, 418 passed). Confirm GREEN exit 0 (1 file, 4 passed) and catalog exit 0 (428 passed). Remove RED exit 1 (missing `#application/remove-no-restock-today` specifier, 1 failed file, no tests). Catalog remove RED exit 1 (`expected undefined to be 'inventory.remove-no-restock'`, 1 failed, 428 passed). Final GREEN exit 0 (3 files, 12 passed) and catalog exit 0 (438 passed). |
| Runtime harness command/scenario and exact result | N/A. This unit is two use cases with in-memory port doubles. No HTTP, database, or process boundary. |
| Rollback boundary | Delete `contexts/inventory/application/confirm-no-restock-today/` and `contexts/inventory/application/remove-no-restock-today/`. Remove the confirm and remove `#application` imports from `contexts/inventory/package.json`. Remove the three use-case exports from `contexts/inventory/application/entry-port.ts`. Remove `inventory.confirm-no-restock` and `inventory.remove-no-restock` from `contexts/platform/domain/permission-catalog.ts` and `permission-catalog.test.ts`. Uncheck tasks 3.3–3.6 and remove this unit's RED and GREEN sections. Leave tasks 1.1, 1.2, 2.1, 2.2, 3.1, and 3.2, and `state.yaml` (`status: applying`, `apply: partial`), as they were. |

## Unit 4 application behavior covered

- A waiter is rejected for confirm and for remove. The kitchen chief confirms. A second confirm is idempotent: one save, one audit, and the same actor and Bogota service date.
- Flag off rejects confirm and remove. Nothing is read, saved, or audited. A proposal stays `proposed` after midnight. A confirmed mark is not removed.
- Confirm stores the `America/Bogota` calendar date (`2026-11-13` at 04:59Z, `2026-11-14` at 05:01Z). There is no service-close clock. After midnight a confirmed mark reads `expired`. A removed mark stays `removed`.
- Confirm and remove do not change order lines and do not write a stock movement. The mark has no movements.
- Confirm audits `inventory.confirm-no-restock`. Remove audits `inventory.remove-no-restock`.
- `inventory.confirm-no-restock` and `inventory.remove-no-restock` are `cells(Y, Y, Y, N, N, N, Y, N)`.
- `entry-port.ts` exports propose, confirm, and remove. `package.json` maps all three `#application` folders. The propose use case was not rewritten.

## Unit 4 workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: PR 4 on PR 3, tasks 3.3–3.6
- Boundary: inventory confirm and remove use cases, the two permission cells, and the entry-port exports
- Estimated review budget impact: about 700 lines in this slice. The change-wide forecast stays High; later units stay on their own PRs.

## Unit 4 deviations from design

Confirm and remove keep their stores in the use case modules, as the proposal writer did. `application/ports/no-restock-repository.ts` stays for the persistence tasks. The confirm audit records `tables: []` because this slice does not know affected tables; withdrawal is tasks 4.1 and 4.2. The use case input also carries `sessionId`, `deviceId`, and `at` so permission, audit, and the Bogota date can run. These use cases do not call `ProposeNoRestockToday` or `PortionSupply`; those modules stay as written in 3.2.

## Unit 4 issues found

None.

## Unit 5 RED evidence (task 4.1)

Command:

```text
pnpm exec vitest run --project orders contexts/orders/application/withdraw-unstarted-lines/withdraw-unstarted-lines.test.ts contexts/orders/domain/check.test.ts
```

RED (test file only, before `withdraw-unstarted-lines.ts`, the `#application` import, and `not_restocked` existed):

- Exit code: 1
- `FAIL contexts/orders/application/withdraw-unstarted-lines/withdraw-unstarted-lines.test.ts`
- `Error: Missing "#application/withdraw-unstarted-lines/withdraw-unstarted-lines.js" specifier in "@blackhole/orders" package`
- Test Files: 1 failed | 1 passed (2)
- Tests: 26 passed (26)
- Duration: 269ms

`check.test.ts` stayed green. The new file collected no tests.

## Unit 5 GREEN evidence (task 4.2)

Command:

```text
pnpm exec vitest run --project orders contexts/orders/application/withdraw-unstarted-lines/withdraw-unstarted-lines.test.ts contexts/orders/domain/check.test.ts
```

GREEN (after `withdraw-unstarted-lines.ts`, `not_restocked` on `realtime-hub.ts`, the last `#application/withdraw-unstarted-lines/*` import, the in-memory hub copy of that notice's line ids, and Biome on the touched files):

- Exit code: 0
- Test Files: 2 passed (2)
- Tests: 32 passed (32)
- Duration: 378ms

## Unit 5 Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project orders contexts/orders/application/withdraw-unstarted-lines/withdraw-unstarted-lines.test.ts contexts/orders/domain/check.test.ts`. RED exit 1 (`Missing "#application/withdraw-unstarted-lines/withdraw-unstarted-lines.js" specifier in "@blackhole/orders" package`, 1 failed file, 26 passed from `check.test.ts`). GREEN exit 0 (2 files, 32 passed). |
| Runtime harness command/scenario and exact result | N/A. This unit is a use case with in-memory port doubles. No HTTP, database, or process boundary. |
| Rollback boundary | Delete `contexts/orders/application/withdraw-unstarted-lines/`. Remove `NotRestocked` from `contexts/orders/application/ports/realtime-hub.ts`. Remove the `#application/withdraw-unstarted-lines/*` import from `contexts/orders/package.json`. Restore the `ids`-only clone in `contexts/orders/adapters/memory/in-memory-realtime-hub.ts`. Uncheck tasks 4.1 and 4.2 and remove this unit's RED and GREEN sections. Leave tasks 1.1–3.6 and `state.yaml` (`status: applying`, `apply: partial`) as they were. |

## Unit 5 application behavior covered

- The oldest uncovered `sent` line of the product, by `sentAt` then check order, becomes `not_delivered`. A later `sent` line stays. Portions of 1.5 withdraw one line. Portions below 1 change nothing.
- `in_preparation`, `ready`, `delivered`, and `held` stay. Another product stays `sent`. `total` still skips `not_delivered`.
- One `not_restocked` notice per check, on the existing `RealtimeHub` stream, with the withdrawn line ids. Two lines on one check produce one notice. A check with only started lines produces no notice.
- Another tenant and another venue stay `sent` and are not saved.
- No stock movement is written.
- `today` is the `America/Bogota` calendar date (`2026-11-13` at 04:59Z, `2026-11-14` at 05:01Z). Withdrawal still runs after midnight. There is no service-close clock. A second run publishes nothing and saves nothing.

## Unit 5 workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: PR 5 on PR 4, tasks 4.1–4.2
- Boundary: orders withdrawal use case and the `not_restocked` notice on the existing realtime hub
- Estimated review budget impact: about 800 lines in this slice. The change-wide forecast stays High; later units stay on their own PRs.

## Unit 5 deviations from design

The use case is not exported from `entry-port.ts`. Task 4.6 owns the three exports. `InMemoryRealtimeHub` copies `lineIds` for `not_restocked`, the same way it already copies them for `ids`. The HTTP contract still drops this kind until tasks 6.3 and 6.4.

## Unit 5 issues found

None.

## Unit 6 RED evidence (tasks 4.3, 4.5, and 4.7)

Commands:

```text
pnpm exec vitest run --project orders contexts/orders/application/confirm-guest-told/confirm-guest-told.test.ts
pnpm exec vitest run --project orders contexts/orders/application/mark-line-undeliverable/mark-line-undeliverable.test.ts
pnpm exec vitest run --project orders contexts/orders/application/take-order/take-order.test.ts contexts/orders/application/apply-qr-order/apply-qr-order.test.ts
```

RED (guest-told test only, before `confirm-guest-told.ts` and its `#application` import existed):

- Exit code: 1
- `FAIL contexts/orders/application/confirm-guest-told/confirm-guest-told.test.ts`
- `Error: Missing "#application/confirm-guest-told/confirm-guest-told.js" specifier in "@blackhole/orders" package`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 323ms

RED (mark-undeliverable test only, before `mark-line-undeliverable.ts` and its `#application` import existed):

- Exit code: 1
- `FAIL contexts/orders/application/mark-line-undeliverable/mark-line-undeliverable.test.ts`
- `Error: Missing "#application/mark-line-undeliverable/mark-line-undeliverable.js" specifier in "@blackhole/orders" package`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 242ms

RED (send-block assertions added before `fire` and `ApplyQrOrder` rejected a marked product):

- Exit code: 1
- `FAIL` take-order: ribs beside soup were both `sent`; a course of only marked ribs resolved instead of rejecting
- `FAIL` apply-qr-order: `expected [] to deeply equal ['menu_product_ribs']`
- Test Files: 2 failed (2)
- Tests: 3 failed | 21 passed (24)
- Duration: 438ms

## Unit 6 GREEN evidence (tasks 4.4, 4.6, and 4.8)

Commands:

```text
pnpm exec vitest run --project orders contexts/orders/application/confirm-guest-told/confirm-guest-told.test.ts
pnpm exec vitest run --project orders contexts/orders/application/confirm-guest-told/confirm-guest-told.test.ts contexts/orders/application/mark-line-undeliverable/mark-line-undeliverable.test.ts
pnpm exec vitest run --project orders contexts/orders/application/confirm-guest-told/confirm-guest-told.test.ts contexts/orders/application/mark-line-undeliverable/mark-line-undeliverable.test.ts contexts/orders/application/take-order/take-order.test.ts contexts/orders/application/apply-qr-order/apply-qr-order.test.ts contexts/orders/domain/check.test.ts contexts/orders/application/review-qr-order-intent/review-qr-order-intent.test.ts
```

GREEN after guest told, then after mark undeliverable and the three entry-port exports, then after the send block and Biome:

- Guest told exit code: 0
- Test Files: 1 passed (1)
- Tests: 1 passed (1)
- Duration: 434ms
- Guest told plus mark exit code: 0
- Test Files: 2 passed (2)
- Tests: 4 passed (4)
- Duration: 550ms
- Final exit code: 0
- Test Files: 6 passed (6)
- Tests: 57 passed (57)
- Duration: 439ms

`check.test.ts` stayed green after `send` learned an optional line list. `review-qr-order-intent.test.ts` stayed green because `ApplyQrOrder`'s new argument is optional.

## Unit 6 Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `pnpm exec vitest run --project orders` on confirm-guest-told, mark-line-undeliverable, take-order, apply-qr-order, check, and review-qr-order-intent. Guest-told RED exit 1 (missing `#application/confirm-guest-told` specifier, 1 failed file, no tests). Mark RED exit 1 (missing `#application/mark-line-undeliverable` specifier, 1 failed file, no tests). Send-block RED exit 1 (3 failed, 21 passed). Guest-told GREEN exit 0 (1 file, 1 passed). Mark GREEN exit 0 (2 files, 4 passed). Final GREEN exit 0 (6 files, 57 passed). |
| Runtime harness command/scenario and exact result | N/A. These use cases run against in-memory port doubles. No HTTP, database, or process boundary. |
| Rollback boundary | Delete `contexts/orders/application/confirm-guest-told/` and `contexts/orders/application/mark-line-undeliverable/`. Remove the two new `#application` keys from `contexts/orders/package.json`. Remove the three use-case exports from `contexts/orders/application/entry-port.ts`. Revert `take-order.ts`, `take-order.test.ts`, `apply-qr-order.ts`, `apply-qr-order.test.ts`, and the optional `lineIds` on `Check.send`. Uncheck tasks 4.3–4.8 and remove this unit. Leave tasks 1.1–4.2 and `state.yaml` (`status: applying`, `apply: partial`) as they were. |

## Unit 6 application behavior covered

- A withdrawn line stays on the pending notice until `orders.guest-told`. The stored record is `checkId`, `lineId`, and `actorId`. The audit also links the table. A second tap does not store or audit again. After that, the notice is gone.
- A station may mark `in_preparation` or `ready` as `not_delivered`. Each line publishes one `not_restocked` notice. `delivered` throws `UndeliverableLineRejected`, stays delivered, and publishes nothing.
- `entry-port.ts` exports `WithdrawUnstartedLines`, `ConfirmGuestTold`, and `MarkLineUndeliverable`. `package.json` maps `#application/confirm-guest-told/*` and `#application/mark-line-undeliverable/*`. The withdraw map was already present.
- `TakeOrder.fire` rejects a marked product and still sends the other held lines in the course. A course whose held lines are all marked throws `ProductNotRestocked` and saves nothing. `ApplyQrOrder` rejects the marked product and sends the rest. There is no reconnect path.
- The mark is read through the injected `NotRestockedProducts` port. Orders does not import an inventory interior.

## Unit 6 workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: PR 6 on PR 5, tasks 4.3–4.8
- Boundary: guest told, cannot finish, the three orders exports, and the send block on fire and QR apply
- Estimated review budget impact: about 900 lines in this slice. The change-wide forecast stays High; later units stay on their own PRs.

## Unit 6 deviations from design

`Check.send` accepts an optional `lineIds` list so fire can leave a marked line held while the other lines in the course are sent. Without that, send moves every held line in the course. Existing callers omit `lineIds` and still send the whole course.

Inventory's entry port exports propose, confirm, and remove. It does not export a reader for a confirmed mark. Fire and QR apply call an injected `NotRestockedProducts.execute`. Composition in task 6.5 binds that port to inventory through `@blackhole/inventory/application/entry-port`. This slice does not deep-import inventory.

The station path does not call `RecordWaste`. The design keeps the ledger in 2.2 and 2.6 and moves the line with no stock movement. The waiter notice is `not_restocked` on the existing hub.

Guest told is an application record, not a stamp on `Check`. `deviceId` is on the input because the audit chain requires it. The stored fields stay `checkId`, `lineId`, and `actorId`.

## Unit 6 issues found

None.

## Unit 7 RED evidence (tasks 5.1 and 5.3)

Existing SQL before the new files: inventory `0001_recipe_catalog.sql`, `0002_stock_ledger.sql`, `0003_purchasing.sql`, `0004_transfers.sql`, `0005_producible_quantity.sql`, `0006_production.sql`; orders `0001_menu.sql`, `0002_dining_room.sql`, `0003_check_waiter.sql`, `0004_qr_table_ordering.sql`, `0005_report_stamps.sql`, `0006_charge_stamp.sql`. The next free number is `0007` in both contexts. `0004`, `0005`, and `0006` were not edited. The PGlite contract loads `0001_recipe_catalog.sql` and `0007_no_restock_today.sql` only.

Memory command:

```text
pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-no-restock-repository.contract.test.ts
```

RED (contract and memory test only, before `in-memory-no-restock-repository.ts` existed):

- Exit code: 1
- `FAIL contexts/inventory/adapters/memory/in-memory-no-restock-repository.contract.test.ts`
- `Error: Cannot find module '#adapters/memory/in-memory-no-restock-repository.js'`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 222ms

Postgres command:

```text
pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-no-restock-repository.contract.test.ts
```

RED (postgres test only, before `drizzle-no-restock-repository.ts` existed):

- Exit code: 1
- `FAIL contexts/inventory/adapters/postgres/drizzle-no-restock-repository.contract.test.ts`
- `Error: Cannot find module '#adapters/postgres/drizzle-no-restock-repository.js'`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 628ms

RED (drizzle repository present, before `0007_no_restock_today.sql` existed):

- Exit code: 1
- `FAIL contexts/inventory/adapters/postgres/drizzle-no-restock-repository.contract.test.ts`
- `Error: ENOENT: no such file or directory, open '...\contexts\inventory\adapters\postgres\0007_no_restock_today.sql'`
- Test Files: 1 failed (1)
- Tests: no tests
- Duration: 624ms

## Unit 7 GREEN evidence (tasks 5.2 and 5.4)

Commands, after Biome `--write` on the TypeScript files:

```text
pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-no-restock-repository.contract.test.ts
pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-no-restock-repository.contract.test.ts
pnpm exec vitest run --project orders contexts/orders/adapters/postgres/no-restock-withdrawal.contract.test.ts
```

GREEN:

- Memory exit code: 0
- Test Files: 1 passed (1)
- Tests: 4 passed (4)
- Duration: 374ms
- PGlite exit code: 0
- Test Files: 1 passed (1)
- Tests: 5 passed (5)
- Duration: 8.15s
- Orders withdrawal exit code: 0
- Test Files: 1 passed (1)
- Tests: 1 passed (1)
- Duration: 3.00s

There is no Drizzle mock and no SQLite migration.

## Unit 7 Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | Memory: `pnpm exec vitest run --project inventory contexts/inventory/adapters/memory/in-memory-no-restock-repository.contract.test.ts`. RED exit 1 (`Cannot find module '#adapters/memory/in-memory-no-restock-repository.js'`, 1 failed file, no tests, 222ms). GREEN exit 0 (1 file, 4 passed, 374ms). PGlite: `pnpm exec vitest run --project inventory contexts/inventory/adapters/postgres/drizzle-no-restock-repository.contract.test.ts`. RED exit 1 (missing `#adapters/postgres/drizzle-no-restock-repository.js`, 1 failed file, no tests, 628ms), then RED exit 1 (`ENOENT` on `0007_no_restock_today.sql`, 1 failed file, no tests, 624ms). GREEN exit 0 (1 file, 5 passed, 8.15s). Orders columns: `pnpm exec vitest run --project orders contexts/orders/adapters/postgres/no-restock-withdrawal.contract.test.ts`. GREEN exit 0 (1 file, 1 passed, 3.00s). |
| Runtime harness command/scenario and exact result | PGlite applies `0001_recipe_catalog.sql` and `0007_no_restock_today.sql`, then `SET LOCAL ROLE inventory_app` and `set_config('app.tenant_id', ..., true)`. The same contract hides the other tenant. A later Bogota date reads `expired`. A direct read of `no_restock_today` under that role returns only the local tenant. Orders PGlite applies `0001_menu.sql`, `0002_dining_room.sql`, and `0007_no_restock_withdrawal.sql`, then `SET LOCAL ROLE orders_app` with the same tenant setting. The other tenant's withdrawn line stays hidden. |
| Rollback boundary | Delete `contexts/inventory/application/ports/no-restock-repository.ts`, `contexts/inventory/application/ports/no-restock-repository.contract.ts`, `contexts/inventory/adapters/memory/in-memory-no-restock-repository.ts`, `contexts/inventory/adapters/memory/in-memory-no-restock-repository.contract.test.ts`, `contexts/inventory/adapters/postgres/drizzle-no-restock-repository.ts`, `contexts/inventory/adapters/postgres/drizzle-no-restock-repository.contract.test.ts`, `contexts/inventory/adapters/postgres/0007_no_restock_today.sql`, `contexts/orders/adapters/postgres/0007_no_restock_withdrawal.sql`, and `contexts/orders/adapters/postgres/no-restock-withdrawal.contract.test.ts`. Uncheck tasks 5.1–5.4 and remove this unit. Leave tasks 1.1–4.8 and `state.yaml` (`status: applying`, `apply: partial`) as they were. |

## Unit 7 persistence behavior covered

- A saved proposal loads as a different object, stays `proposed`, and has no actor and no service date.
- A confirmed mark stored for tenant A is hidden from tenant B for the same venue and product. Tenant A still reads `confirmed` on `2026-11-13`.
- A later Bogota date (`2026-11-14T05:01:00.000Z`) reads `expired`. Removing the loaded copy does not change the stored row. The stored row stays `confirmed` and still expires on that later date.
- A removed mark stays `removed` on a later Bogota date.
- `no_restock_today` has `tenant_id` and forced row level security for `inventory_app`. The persisted statuses are `proposed`, `confirmed`, and `removed`. Expiry is computed from `service_date`.
- `order_lines` gains `not_delivered_at` and `guest_told_actor_id`. The state check accepts `not_delivered`. A withdrawn line for another tenant stays hidden under `orders_app` and `app.tenant_id`.
- No SQLite file. No Drizzle mock. `0004`, `0005`, and `0006` were not edited. Existing `schema.ts` files were not edited.

## Unit 7 workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: PR 7 on PR 6, tasks 5.1–5.4
- Boundary: no-restock repository contract, in-memory adapter, PGlite adapter, and the two new SQL files
- Estimated review budget impact: this slice is above 400 lines. The tasks forecast said to split at 5.3 if the slice went over 400. It was kept together because the assigned batch was 5.1–5.4 and the postgres contract cannot go green without the migration. The change-wide forecast stays High. HTTP stays on the next PR.

## Unit 7 deviations from design

`contexts/inventory/adapters/postgres/schema.ts` and `contexts/orders/adapters/postgres/schema.ts` were not edited. Another agent owns the inventory Drizzle schema. The `no_restock_today` table definition lives in the new `drizzle-no-restock-repository.ts`. Orders withdrawal columns live in `0007_no_restock_withdrawal.sql`.

The domain has no restore method, and this batch does not edit it. The repository snapshots the public mark and restores it by replaying propose, confirm, and remove. `expired` is not a stored status.

The confirm and remove use cases still keep their own stores. Binding this repository is task 6.5. `package.json` was not edited. The existing `#application/ports/*`, `#adapters/memory/*`, and `#adapters/postgres/*` maps already cover the new files.

## Unit 7 issues found

None.

## Unit 8 — tasks 6.1–6.7

HTTP `inject` for list, confirm, remove, guest told, and cannot finish. Waiter gets 403. `not_restocked` is forwarded on the existing orders stream. `availability_changed` stays out of this contract. The flag defaults off. Confirm runs, then withdrawal, then the audit tables. The venue notice stays until the guest is told. No SQLite. No commit. No branch. No archive.

## Unit 8 RED evidence (tasks 6.1, 6.3, and 6.6)

HTTP and realtime, before `no-restock.controller.ts` and before the `not_restocked` branch:

```text
pnpm exec vitest run --project api-cloud test/http/no-restock.controller.test.ts test/http/orders-realtime.controller.test.ts
```

RED:

- Exit code: 1
- `FAIL apps/api-cloud/test/http/no-restock.controller.test.ts`
- `Error: Cannot find module '#src/http/no-restock.controller.js'`
- Realtime: 1 failed, 1 passed. The stream timed out at 3000ms. The payload had `ids`, `printer_failed`, `line_ready`, and `billing_data_received`. `not_restocked` was dropped.
- Command duration: about 5.68s

Venue, before the guest-told notice:

```text
pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/venue-cloud.test.tsx
```

RED:

- Exit code: 1
- `FAIL apps/venue-app/test/venue-cloud.test.tsx` > given a withdrawn line, when another action runs before the guest is told, then the notice stays
- `TestingLibraryElementError`: unable to find `Mesa table_4: el plato no sale hoy. Avisa al cliente.`
- Test Files: 1 failed (1)
- Tests: 1 failed, 3 passed (4)
- Duration: 2.63s

## Unit 8 GREEN evidence (tasks 6.2, 6.4, 6.5, and 6.7)

The first HTTP run after composition still failed. `NoRestockController` index `[2]` was undefined because `RemoveNoRestockToday` was imported from the orders entry port. The worker exited 134. Tests: 3 passed (8). Duration: 4.12s. The import was moved to `@blackhole/inventory/application/entry-port`.

```text
pnpm exec vitest run --project api-cloud test/http/no-restock.controller.test.ts test/http/orders-realtime.controller.test.ts
pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/venue-cloud.test.tsx
```

GREEN:

- HTTP exit code: 0
- Test Files: 2 passed (2)
- Tests: 8 passed (8)
- Duration: 8.27s
- Venue exit code: 0
- Test Files: 1 passed (1)
- Tests: 4 passed (4)
- Duration: 1.74s

## Unit 8 Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | HTTP/realtime: `pnpm exec vitest run --project api-cloud test/http/no-restock.controller.test.ts test/http/orders-realtime.controller.test.ts`. RED exit 1 (missing `#src/http/no-restock.controller.js`; realtime 1 failed and 1 passed, `not_restocked` dropped, about 5.68s). Intermediate exit 1 (undefined `RemoveNoRestockToday`, worker 134, 3 passed of 8, 4.12s). GREEN exit 0 (2 files, 8 passed, 8.27s). Venue: `pnpm exec vitest run --config apps/venue-app/vitest.config.ts apps/venue-app/test/venue-cloud.test.tsx`. RED exit 1 (1 failed, 3 passed, 2.63s). GREEN exit 0 (1 file, 4 passed, 1.74s). |
| Runtime harness command/scenario and exact result | Fastify `inject`, not `listen`. Flag off: `NoRestockController` is absent and GET no-restock is 404. Flag on uses PGlite with `0001_recipe_catalog.sql` and `0007_no_restock_today.sql`, `SET LOCAL ROLE inventory_app`, and `set_config('app.tenant_id', ..., true)`. Waiter confirm and remove return 403 `NoRestockNotPermitted`. Chief confirm returns the table, the line becomes `not_delivered`, and the audit `after.tables` is that table. Remove, guest told, and cannot-finish follow. A delivered line returns 409 `UndeliverableLineRejected`. The SSE test forwards `not_restocked` and does not add `availability_changed`. The venue probe keeps `Mesa table_4: el plato no sale hoy. Avisa al cliente.` after clock-in and clears it only after guest told. |
| Rollback boundary | Delete `apps/api-cloud/src/http/no-restock.controller.ts` and `apps/api-cloud/test/http/no-restock.controller.test.ts`. Revert `apps/api-cloud/src/http/orders-realtime.controller.ts`, `apps/api-cloud/test/http/orders-realtime.controller.test.ts`, `shared/contracts/dining-room.ts`, `apps/api-cloud/src/composition/application-module.ts`, `apps/venue-app/src/service/venue-cloud.ts`, `apps/venue-app/src/service/service-session.tsx`, and `apps/venue-app/test/venue-cloud.test.tsx`. Uncheck tasks 6.1–6.7 and remove this unit. Leave tasks 1.1–5.4 and `state.yaml` (`status: applying`, `apply: partial`) as they were. |

## Unit 8 persistence behavior covered

- `no_restock_today` is read and written through the existing PostgreSQL client. Stored statuses stay `proposed`, `confirmed`, and `removed`. Expiry is computed from `service_date` and is not stored.
- Guest told is held in memory for the cloud process. No new SQL table. No SQLite.
- A confirmed mark is visible to `TakeOrder` through `NotRestockedProductReader`. With the flag off, that reader returns false.

## Unit 8 workload / PR boundary

- Mode: chained PR slice (`feature-branch-chain`, delivery `auto-chain`)
- Current work unit: tasks 6.1–6.7, kept in one assigned batch. The forecast still splits them as PR 8 (6.1–6.5) on PR 7 and PR 9 (6.6–6.7) on PR 8.
- Boundary: no-restock HTTP, the `not_restocked` realtime contract, cloud composition, and the venue guest-told notice
- Estimated review budget impact: this slice is above 400 lines. The change-wide forecast stays High. No branch was created.

## Unit 8 deviations from design

`@blackhole/inventory/adapters/postgres/drizzle-no-restock-repository` is not exported. The controller does not import it, and `package.json` was not edited. Composition uses the existing PGlite client and `NoRestockToday` from `@blackhole/inventory/domain`.

`PortionSupply` is not exported. Withdrawal passes `Number.MAX_SAFE_INTEGER`, so every `sent` line of that product is withdrawn.

`ConfirmNoRestockToday` writes the audit during confirm, with empty tables. A fresh deferred audit holds `inventory.confirm-no-restock` and flushes it after withdrawal with the table ids.

`ApplyQrOrder` is still constructed inside `table-qr.controller.ts` and `table-qr-admin.controller.ts`. Those files were not in this batch, so those QR `TakeOrder` instances do not receive `NotRestockedProductReader`. The `TakeOrder` registered in `application-module.ts` does.

`availability_changed` is not part of `ordersRealtimeEvent`. Any other unknown kind is reduced to `{ kind }` and dropped by `safeParse`. `printer_failed`, `line_ready`, `billing_data_received`, and `ids` stay.

## Unit 8 issues found

None that block 6.1–6.7. The missing Drizzle repository export is recorded above and was not added.
