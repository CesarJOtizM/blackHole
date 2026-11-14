# Apply progress: p2-09-not-restocked-today

Change: `p2-09-not-restocked-today`
Work units recorded: 5 of 9
Mode: Standard (`strict_tdd: false`). RED then GREEN still ran, as required by ADR-017 and `rules.apply`. `strict-tdd.md` was not loaded.
Committed: no
Pushed: no

Tasks 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, and 4.2 are complete. Confirm guest told, mark undeliverable, take order, persistence, HTTP, and the waiter screen were not started. Ready for the next apply batch (4.3–4.8). Verify was not run.

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
- [ ] 4.3–4.8 Guest told, cannot finish, and send block
- [ ] 5.1–5.4 Memory, then Postgres
- [ ] 6.1–6.7 HTTP inject, then screen

12/29 tasks complete. Next batch is 4.3–4.8.

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
