# Apply progress: p1-09-attendance

Work unit 1 / PR 1. Tasks 1.1–1.3. Chain strategy: stacked-to-main. `size:exception` was not granted. Mode: standard (`strict_tdd: false`) with ADR-017 RED then GREEN.

## Completed

- [x] 1.1 Package `@blackhole/attendance`, `#domain/*`, root reference, vitest project `attendance`, skeleton allow-list.
- [x] 1.2 RED `domain/worker-shift.test.ts`.
- [x] 1.3 GREEN `domain/worker-shift.ts` and `domain/index.ts`.
- [x] 1.4 RED `domain/project-hours.test.ts`.
- [x] 1.5 GREEN `domain/project-hours.ts`, exported from `domain/index.ts`.
- [x] 2.1 RED `application/record-clock-entry/record-clock-entry.test.ts`.
- [x] 2.2 GREEN `record-clock-entry.ts` and its ports.

Cumulative through work unit 3: tasks 1.1–2.2 are complete. Next task is 2.3. `size:exception` was not granted.

## TDD cycle

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1.1 | Scaffold, no behavior test | Package, tsconfig, vitest, skeleton | Biome format |
| 1.2 | Test file before `worker-shift.ts` | — | — |
| 1.3 | Same failing command | Domain passes | Biome format, tests re-run |

RED: `pnpm vitest run --project attendance worker-shift` → exit 1. `Cannot find module '#domain/worker-shift.js'`. 0 tests.

GREEN: same command → exit 0. 1 file, 13 tests. Repeated after Biome → exit 0, 13 tests.

## Work unit evidence

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance worker-shift` → exit 0, 13 passed |
| Orders regression | `pnpm vitest run --project orders menu.test` → exit 0, 6 passed |
| Skeleton | `pnpm vitest run --project skeleton` → exit 0, 2 files, 10 passed |
| Runtime harness | N/A: pure domain, no process boundary |
| Rollback | `contexts/attendance/`, the `attendance` vitest project, the `contexts/attendance` tsconfig reference, and `attendance` in `allowedContexts` |

## Behavior

`WorkerShift` derives `off_shift`, `on_shift`, `on_break`, and `pending_review` from marks. Kinds: `clock_in`, `clock_out`, `break_start`, `break_end`. A second matched clock-in while `on_shift` or `on_break` throws `SecondClockIn` and leaves the marks unchanged. `flagged` marks stay on the shift and do not change state or occupy the open clock-in. A matched `clock_out` with `pendingReview` derives `pending_review`. No Nest and no SQL.

## Deviations

`Clock.now()` stays out of this unit. The domain accepts `occurredAt`. A later matched `clock_in` after `pending_review` returns to `on_shift`; the review flag remains on that clock-out. Illegal marks throw `ShiftTransitionRejected`.

## Remaining

Phase 2 starts at 2.1. Phases 2–4 are later PRs.

## PR boundary

Stacked PR 1 targets `main` (no previous slice). Start: none. Finish: shift green. Does not include `project-hours`.

## Work unit 2 / PR 2

Tasks 1.4–1.5. stacked-to-main. `size:exception` was not granted. Standard mode; ADR-017 RED then GREEN.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1.4 | Test before `project-hours.ts`. Exit 1, module missing, 0 tests | — | — |
| 1.5 | Same command | Exit 0, 8 tests | Biome, still exit 0, 8 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance project-hours` → exit 0, 8 passed |
| Worker shift | `pnpm vitest run --project attendance worker-shift` → exit 0, 13 passed |
| Orders regression | `pnpm vitest run --project orders menu.test` → exit 0, 10 passed |
| Runtime harness | N/A: pure domain, no process boundary |
| Rollback | `project-hours.ts`, `project-hours.test.ts`, and the `projectHours` exports in `domain/index.ts` |

`projectHours` sums matched spans minus breaks: 7h30 is 450 minutes. 08:07 within 10 minutes is not late. The later correction wins; the original `occurredAt` stays. Past tolerance, lateness and early leave are the full gap. Off-schedule time sits outside that band. No matched clock-in on a schedule is absence. Flagged rows are ignored.

Stacked PR 2 targets the PR 1 branch. Start: shift types. Finish: hours green. Use cases stay out.

## Work unit 3 / PR 3

Tasks 2.1–2.2. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.1 | Test before `record-clock-entry.ts`. Exit 1, `Cannot find module '#application/ports/attendance-policy-repository.js'`, 0 tests | — | — |
| 2.2 | Same command | Exit 0, 10 tests | Biome check, then the same command still exit 0, 10 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance record-clock-entry` → exit 0, 1 file, 10 passed |
| Domain regression | `pnpm vitest run --project attendance worker-shift project-hours` → exit 0, 2 files, 21 passed |
| Orders regression | `pnpm vitest run --project orders menu.test` → exit 0, 2 files, 15 passed |
| Runtime harness | N/A: in-memory ports, no process boundary |
| Rollback | `contexts/attendance/application/record-clock-entry/`, `contexts/attendance/application/ports/clock.ts`, `pin-check.ts`, `clock-entry-repository.ts`, `attendance-policy-repository.ts`, the `#application/*` import keys, and `application` in the attendance tsconfig `include` |

`RecordClockEntry` stores `Clock.now()` and ignores `claimedAt`. The same `commandId` returns the stored row and does not append. A second matched clock-in throws `SecondClockIn` and leaves the row count at one. A point inside the geofence is `matched`. A miss, or a venue with no geofence, is stored `flagged`; `counting` stays false, so it does not enable operation. `defaultAttendancePolicy` and a missing policy keep `operationRuleEnabled` false. A matched cashier clock-in keeps `cashRegisterId` through break start and break end; clock-out clears the open register and leaves the original row. `PinCheck` is the port the use case calls. `PlatformPinCheck` adapts a `PinVerifier`-shaped `confirm` without importing platform or a hasher. The repository port is `append` and `list` only. Policy carries geofence, tolerance, close time, `hours_only` or `scheduled`, and `ScheduledShift`. No domain rule changed. `projectHours` is not used.

This unit adds 676 lines under `contexts/attendance/application` (230 use case, 326 test, 120 ports) plus the three `#application` import keys and `application` on the tsconfig `include`. That is over the 400-line review budget. The unit stayed together because it is one work unit. Task 2.3 was not started.

Stacked PR 3 targets the PR 2 branch. Start: domain green. Finish: record green. Correct, close, policy setter, read, export, and HTTP stay out.
