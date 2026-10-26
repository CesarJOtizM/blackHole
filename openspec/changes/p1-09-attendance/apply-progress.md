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
- [x] 2.3 RED `application/correct-clock-entry/correct-clock-entry.test.ts`.
- [x] 2.4 GREEN `correct-clock-entry.ts` via the platform entry port only.
- [x] 2.5 RED `application/close-open-shifts/close-open-shifts.test.ts`.
- [x] 2.6 GREEN `close-open-shifts.ts`.
- [x] 2.7 RED `application/set-venue-attendance-policy/set-venue-attendance-policy.test.ts`.
- [x] 2.8 GREEN `set-venue-attendance-policy.ts`.

Cumulative through the xlsx adapter: tasks 1.1–2.14 and 3.1–3.6 are complete. `size:exception` was not granted. Next task is 4.1.

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

## Work unit 4 slice / correction only

Tasks 2.3–2.4. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. Close-open-shifts (2.5–2.6) was not started. The forecast groups correct and close as unit 4; this batch is only the correction.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.3 | Test before `correct-clock-entry.ts`. Exit 1, `Cannot find module '#application/correct-clock-entry/correct-clock-entry.js'`, 0 tests | — | — |
| 2.4 | Same command | Exit 0, 1 file, 3 tests | Biome check, then the same command still exit 0, 1 file, 3 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance correct-clock-entry` → exit 0, 1 file, 3 passed |
| Domain and record regression | `pnpm vitest run --project attendance record-clock-entry worker-shift project-hours` → exit 0, 3 files, 31 passed |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (285 modules, 697 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler` (TypeScript 7 is outside dependency-cruiser 18.6.0's supported compiler). Cruiser rules were not changed |
| Typecheck | `pnpm exec tsc -b contexts/attendance --pretty false` → exit 0 |
| Runtime harness | N/A: in-memory ports, no process boundary |
| Rollback | `contexts/attendance/application/correct-clock-entry/`, `contexts/attendance/application/ports/attendance-audit.ts`, `contexts/attendance/application/ports/clock-entry-correction-repository.ts`, the `#application/correct-clock-entry/*` import key, the `@blackhole/platform` workspace dependency, the platform tsconfig reference, and the attendance importer in `pnpm-lock.yaml` |

`CorrectClockEntry` appends a correction and leaves the original `ClockEntry` unchanged, including `occurredAt`. The stored fact is `entryId`, replacement `occurredAt`, and reason. The test lists the original time, then `projectHours` with the entries plus that correction: 08:00 in and a corrected 16:00 out is 8 hours. An empty or blank reason throws `CorrectionReasonRequired` before append and before audit. An unknown entry throws `UnknownClockEntry`; nothing is appended and the audit is not called. After a successful append, the narrow audit port receives action `attendance.correct`, entity the original entry id, `siteId` the venue, the correction reason, `before` the original `occurredAt`, and `after` the replacement. `actorId`, `deviceId`, and `tenantId` come from the command. `authorizerId` may be null. The audit fake sees the correction already stored. `RecordClockEntry` was not changed and does not call the audit port.

`PlatformAttendanceAudit` is the only attendance file that imports `RecordAuditEvent`, and only from `@blackhole/platform/application/entry-port`. `verbatimModuleSyntax` keeps that import type-only because the class is injected. The use-case test fakes `AttendanceAudit` and does not construct `RecordAuditEvent`. No attendance entry port. No role check.

New attendance TypeScript files are 360 physical lines: test 219, use case 81, platform adapter 27, audit port 16, correction port 17. Under the 400-line review budget. `size:exception` was not granted.

Stacked PR for this slice targets the PR 3 branch. Start: record green. Finish: correction green. Close, policy, read, export, adapters, and HTTP stay out.

## Work unit 4 slice / close only

Tasks 2.5–2.6. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. Policy, read, export, the attendance entry port, adapters, Postgres, xlsx, HTTP, and pg-boss were not started. The forecast groups correct and close as unit 4; correction is already done. This batch is only the close.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.5 | Test before `close-open-shifts.ts`. Exit 1, `Cannot find module '#application/close-open-shifts/close-open-shifts.js'`, 0 tests | — | — |
| 2.6 | Same command. Domain review-close from `on_break` was also RED first: `pnpm vitest run --project attendance worker-shift` → exit 1, 1 failed, 14 passed. `ShiftTransitionRejected` at `applyMark` | Exit 0, 1 file, 4 tests | `pnpm exec biome check --write` on the touched files (9 files, 7 fixed), then the same close command still exit 0, 1 file, 4 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance close-open-shifts` → exit 0, 1 file, 4 passed |
| Regression | `pnpm vitest run --project attendance correct-clock-entry record-clock-entry worker-shift project-hours` → exit 0, 4 files, 36 passed |
| Typecheck | `pnpm exec tsc -b contexts/attendance --pretty false` → exit 0 |
| Runtime harness | N/A: in-memory ports, no process boundary |
| Rollback | `contexts/attendance/application/close-open-shifts/`, the `#application/close-open-shifts/*` import key, `pendingReview` on `ClockEntry`, `listByVenue`, `pendingReview` threaded through `toMark` with `false` on the record path, the `on_break` review close in `worker-shift.ts`, the two new domain cases, and `listByVenue` on the record and correction fakes |

`CloseOpenShifts` lists the venue, replays each worker, and appends one `clock_out` for `on_shift` and `on_break`. `presence` is `matched`. `pendingReview` is true. `occurredAt` is `new Date(clock.now()).toISOString()`. `cashRegisterId` is null and the original cashier row stays. `id` is `clock_entry_` plus `commandId`. `commandId` is `close_${userId}_${venueId}_${occurredAt}`. A second run at the same instant sees `pending_review` and does not append again. Replaying the stored rows through `WorkerShift` derives `pending_review`. Flagged rows, `off_shift`, and an existing `pending_review` are left unchanged. The new row copies `deviceId` from the latest matched clock-in.

A worker whose stored marks throw `ShiftTransitionRejected` fails the cut before any append, so the open coworker is not closed. If `append` throws, the use case throws. The failing fake stores nothing and its `queuedJobs` array stays empty. There is no queue port and no `RecordAuditEvent`.

`ClockEntry.pendingReview` is required. `RecordClockEntry` stores `false` and passes it through `toMark`. `listByVenue(tenantId, venueId)` is append-only. `list` is unchanged. No update or delete.

Line count for this slice: 454 additions and 4 deletions (458 changed lines). New files are 377 physical lines: test 230, use case 147. Supporting edits are `worker-shift.test.ts` +40, `worker-shift.ts` +9/−4, `clock-entry-repository.ts` +6, `record-clock-entry.test.ts` +9, `record-clock-entry.ts` +2, `correct-clock-entry.test.ts` +10, and one import key in `package.json`. That is over the 400-line review budget. `size:exception` was not granted. The slice stayed together because the prompt required finishing 2.5–2.6, including the port and the domain transition the close needs.

## Deviations

A `clock_out` with `pendingReview` true is legal from `on_break` and ends in `pending_review`. A `clock_out` from `on_break` without `pendingReview` still throws `ShiftTransitionRejected`. The design did not name this transition. The new close row copies `deviceId` from the latest matched clock-in; the design did not name that field. There is no transaction port, so a throw from a later `append` is not rolled back. The check-first path still appends nobody when one worker cannot be closed.

Stacked PR for this slice targets the correction slice's branch. Start: correction green. Finish: close green. Policy, read, export, entry port, adapters, and HTTP stay out.

## Work unit 5 slice / policy only

Tasks 2.7–2.8. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. Read, export, the attendance entry port, adapters, Postgres, xlsx, and HTTP were not started. The forecast groups policy, read, export, and the entry port as unit 5. This batch is only the policy.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.7 | Test before `set-venue-attendance-policy.ts`. Exit 1, `Cannot find module '#application/set-venue-attendance-policy/set-venue-attendance-policy.js'`, 0 tests | — | — |
| 2.8 | Same command | Exit 0, 1 file, 2 tests | Biome, then `pnpm vitest run --project attendance set-venue-attendance-policy record-clock-entry` still exit 0 |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance set-venue-attendance-policy record-clock-entry correct-clock-entry close-open-shifts` → exit 0, 4 files, 19 passed |
| Typecheck | `pnpm exec tsc -b apps/api-cloud contexts/attendance --pretty false` → exit 0 |
| Runtime harness | N/A: in-memory ports, no process boundary |
| Rollback | `contexts/attendance/application/set-venue-attendance-policy/`, the `#application/set-venue-attendance-policy/*` import key, `save` on `AttendancePolicyRepository`, and the empty `save` on the record-clock test double |

`SetVenueAttendancePolicy` rejects a negative tolerance, or a close time that is not `HH:mm`, before save and before audit. A missing policy is the default, so the rule is off until someone sets it. Enabling the rule stores `operationRuleEnabled: true` and audits action `attendance.policy`. `before` is the default with the rule off. `after` is the stored policy. `siteId` and `entity` are the venue. A scheduled policy also requires `HH:mm` bounds. No HTTP and no permission check in this slice.

## Deviations

The audit action is `attendance.policy`. The design says a rule change is audited and does not name the action. `AttendancePolicyRepository.save` is new. The record-clock tests never call it. A later adapter has to implement it. There is no transaction: a throw from the audit leaves the policy stored.

Stacked PR for this slice targets the close slice's branch. Start: close green. Finish: policy green. Read, export, entry port, adapters, and HTTP stay out.

## Work unit 5 slice / read only

Tasks 2.9–2.10. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. Export, the attendance entry port, adapters, Postgres, xlsx, and HTTP were not started. The forecast groups policy, read, export, and the entry port as unit 5. This batch is only the read.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.9 | Test before `read-attendance.ts`. Exit 1, `Cannot find module '#application/read-attendance/read-attendance.js'`, 0 tests | — | — |
| 2.10 | Same command | Exit 0, 1 file, 2 tests | Biome, then the same command still exit 0, 2 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance read-attendance` → exit 0, 1 file, 2 passed. Regression: `pnpm vitest run --project attendance --project local-node` → exit 0, 13 files, 52 passed |
| Typecheck | `pnpm exec tsc -b apps/local-node contexts/attendance --pretty false` → exit 0 |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (312 modules, 810 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler`. Cruiser rules were not changed |
| Runtime harness | N/A: in-memory ports, no process boundary |
| Rollback | `contexts/attendance/application/read-attendance/` and the `#application/read-attendance/*` import key |

`ReadAttendance` asks `AttendanceSiteAccess` for `attendance.correct` on the venue. A reader of another site throws `AttendanceReadDenied` before any list. A scheduled policy of `08:00`–`16:00` with 10 minutes of tolerance reports 7h30 for a day with a 30-minute break, 25 minutes of lateness for an 08:25 clock-in, and an absence when the only clock-in is `flagged`. A correction replaces the projected clock-out and the original row stays. An open matched clock-in is `on_shift`. A flagged clock-in stays `off_shift`.

484 physical lines: `read-attendance.ts` 240, the test 243, and one import key. Over the 400-line default. `size:exception` was not granted. The two tasks are one slice and were finished together.

## Deviations

`AttendanceReadDenied` and `AttendanceSiteAccess` are not named in the design. The use case does not call `EvaluatePermission`: attendance may import another context only through its entry port, and the HTTP task is the later permission check. The gate always receives `attendance.correct`. The stored schedule is `HH:mm`, which `projectHours` cannot parse. The read anchors those bounds to the Bogota date of the worker's earliest mark. `America/Bogota` is treated as a fixed UTC−5 offset. An end at or before the start rolls to the next calendar day.

Stacked PR for this slice targets the policy slice's branch. Start: policy green. Finish: read green. Export, entry port, adapters, and HTTP stay out.

## Work unit 5 slice / export only

Tasks 2.11–2.12. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. The entry port, adapters, Postgres, xlsx, and HTTP were not started. The forecast groups policy, read, export, and the entry port as unit 5. This batch is only the export.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.11 | Test before `export-hours.ts`. Exit 1, `Cannot find module '#application/export-hours/export-hours.js'`, 0 tests | — | — |
| 2.12 | Same command | Exit 0, 1 file, 2 tests | Biome, then the same command still exit 0, 2 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance export-hours` → exit 0, 1 file, 2 passed. Regression: `pnpm vitest run --project attendance` → exit 0, 8 files, 46 passed |
| Typecheck | `pnpm exec tsc -b contexts/attendance --pretty false` → exit 0 |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (315 modules, 825 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler`. Cruiser rules were not changed |
| Runtime harness | N/A: in-memory ports, no process boundary |
| Rollback | `contexts/attendance/application/export-hours/`, `application/ports/hours-workbook.ts`, and the `#application/export-hours/*` import key |

`ExportHours` asks `AttendanceSiteAccess` for `attendance.correct`. Another site throws `AttendanceExportDenied` before any list or write. The week is `[from, to)` on `occurredAt`. A clock-out auto-closed at 22:00 and corrected to 16:00 exports 8 hours, not the 14 hours of the stored row. The previous week's worker stays out of the sheet. `HoursWorkbookRow` is the projection plus `userId`. It has no salary field. The port returns the bytes. SheetJS stays in the later xlsx adapter.

431 physical lines: `export-hours.ts` 210, the test 200, `hours-workbook.ts` 20, and one import key. Over the 400-line default. `size:exception` was not granted. The two tasks are one slice and were finished together.

## Deviations

`AttendanceExportDenied` is not named in the design. The use case reuses `AttendanceSiteAccess` and does not call `EvaluatePermission`. The week bounds are ISO instants supplied by the caller. The Bogota `HH:mm` anchor is copied from `ReadAttendance` so a scheduled policy still reaches `projectHours`. No workbook bytes are produced inside the use case.

Stacked PR for this slice targets the read slice's branch. Start: read green. Finish: export green. Entry port, adapters, and HTTP stay out.

## Work unit 5 slice / entry port only

Tasks 2.13–2.14. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. Adapters, Postgres, xlsx, and HTTP were not started in this slice. The slice ran in a separate worktree from `0362fe3` and was copied back onto the uncommitted tree.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 2.13 | Test before `entry-port.ts`. Exit 1, `Cannot find module '#application/entry-port.js'`, 0 tests | — | — |
| 2.14 | Same command | Exit 0, 1 file, 8 tests | Biome, then the same command still exit 0, 8 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance entry-port` → exit 0, 1 file, 8 passed. Together with the memory contract: 2 files, 14 passed. Regression: `pnpm vitest run --project attendance` → exit 0, 10 files, 60 passed |
| Typecheck | `pnpm exec tsc -b contexts/attendance --pretty false` → exit 0 |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (320 modules, 835 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler`. Cruiser rules were not changed |
| Runtime harness | N/A: in-memory ports, no process boundary |
| Rollback | `contexts/attendance/application/entry-port.ts`, `entry-port.test.ts`, and the `./application/entry-port` export |

`HasOpenClockIn` returns `{ ruleEnabled, counting }`. A missing policy keeps the rule off. Counting is `on_shift` or `on_break`. A flagged clock-in does not count. `HasClockedInCashier` is true only when that open matched clock-in has a `cashRegisterId`. A later matched clock-out clears both. The file exports only those two classes. It does not call `EvaluatePermission`.

285 physical lines: `entry-port.ts` 98, the test 186, and one export. Under the 400-line default.

## Deviations

The worktree started at `0362fe3`, before `AttendancePolicyRepository.save`. The copied test double gained an empty `save` so it implements the port that already exists on this tree. Callers still decide the block: the use case returns the two booleans and does not throw when the rule is on and counting is false.

## Work unit 6 slice / memory repository only

Tasks 3.1–3.2. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. Postgres, xlsx, and HTTP were not started. The slice ran in a separate worktree from `0362fe3` and was copied back onto the uncommitted tree.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 3.1 | Test before the memory repository. Exit 1, `Cannot find module '#adapters/memory/in-memory-clock-entry-repository.js'`, 0 tests | — | — |
| 3.2 | Same command | Exit 0, 1 file, 6 tests | Biome, then the same command still exit 0, 6 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance in-memory-clock-entry-repository` → exit 0, 1 file, 6 passed |
| Typecheck | `pnpm exec tsc -b contexts/attendance --pretty false` → exit 0 |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (320 modules, 835 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler`. Cruiser rules were not changed |
| Runtime harness | N/A: in-memory port, no process boundary |
| Rollback | `contexts/attendance/adapters/memory/`, `application/ports/clock-entry-repository.contract.ts`, the `#adapters/memory/*` import, and `adapters` in the attendance tsconfig `include` |

`InMemoryClockEntryRepository` clones on write and on read. A second append with the same `tenantId` and `commandId` keeps the first row. Tenant B cannot list tenant A's row. `list` hides another user; `listByVenue` returns that row. The class has no `update` and no `delete`.

About 172 physical lines: the contract 124, the repository 42, the test 4, plus the import and the tsconfig include. Under the 400-line default.

## Deviations

The idempotency key is `tenantId` plus `commandId`. A different payload on the retry is ignored and the first row stays. `tsconfig.json` now includes `adapters` so the new folder typechecks.

Stacked PR for these two slices targets the export slice's branch. Start: export green. Finish: entry port and memory repository green. Postgres, xlsx, and HTTP stay out.

## Work unit 6 slice / Postgres only

Tasks 3.3–3.4. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. xlsx and HTTP were not started. The migration stays inside `contexts/attendance`. Platform files `0001`–`0007` were not edited. `0006` stays unused. This file is `0008_attendance.sql`.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 3.3 | Test before the Drizzle repositories. Exit 1, `Cannot find module '#adapters/postgres/drizzle-attendance-policy-repository.js'`, 0 tests | — | — |
| 3.4 | Same command | Exit 0, 1 file, 11 tests | Biome, then the same command still exit 0, 11 tests |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance drizzle-attendance-repository` → exit 0, 1 file, 11 passed. Regression: `pnpm vitest run --project attendance` → exit 0, 11 files, 71 passed |
| Typecheck | `pnpm exec tsc -b contexts/attendance --pretty false` → exit 0 |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (324 modules, 850 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler`. Cruiser rules were not changed |
| Runtime harness | N/A: PGlite in process, no `listen`. Each test opens a client and `afterAll` closes it |
| Rollback | `contexts/attendance/adapters/postgres/`, the `#adapters/postgres/*` import, the PGlite and Drizzle dependencies, and `"types": ["node"]` |

`attendance_app` receives `SELECT` and `INSERT`. Row security is enabled and forced on `app.tenant_id`. A select as that role returns only the current tenant. `UPDATE`, `DELETE`, and `TRUNCATE` on `clock_entries` and `attendance_policies` raise `attendance rows are append-only`, and the stored row stays. The shared clock-entry contract passes on PGlite: hidden tenant, one row per `tenantId` and `commandId`, no `update` or `delete` method. A second policy save inserts the next `position`. `find` returns that latest row. Another tenant stays hidden.

588 physical lines in the five new files: SQL 123, schema 53, clock repository 103, policy repository 130, contract test 179. Package, tsconfig, and the lockfile add the dependencies. Over the 400-line default. `size:exception` was not granted. The two tasks are one slice and were finished together.

## Deviations

`ClockEntryCorrection` has no Postgres table in this slice. The task names entries and policy. A policy change cannot update the old row, so `save` appends a version and `find` reads the highest `position`. The migration is `0008` inside attendance, not a platform migration. `0006` remains unused because `0001`–`0007` stay untouched.

Stacked PR for this slice targets the memory slice's branch. Start: memory repository green. Finish: Postgres green. xlsx and HTTP stay out.

## Work unit 7 slice / xlsx only

Tasks 3.5–3.6. stacked-to-main. `size:exception` was not granted. Standard mode (`strict_tdd: false`); ADR-017 RED then GREEN. Threat matrix N/A. HTTP was not started. SheetJS stays in the adapter. The domain does not import it.

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 3.5 | Test before `hours-workbook.ts`. Exit 1, `Cannot find module '#adapters/xlsx/hours-workbook.js'`, 0 tests | — | — |
| 3.6 | Same command | Exit 0, 1 file, 1 test | Biome, then the same command still exit 0, 1 test |

| Evidence | Result |
|----------|--------|
| Focused test | `pnpm vitest run --project attendance hours-workbook` → exit 0, 1 file, 1 passed. Regression: `pnpm vitest run --project attendance` → exit 0, 12 files, 72 passed |
| Typecheck | `pnpm exec tsc -b contexts/attendance --pretty false` → exit 0 |
| Architecture | `pnpm architecture` → exit 0. `no dependency violations found (327 modules, 854 dependencies cruised)`. Pre-existing warning: `missing-typescript-transpiler`. Cruiser rules were not changed |
| Runtime harness | N/A: SheetJS writes bytes in process. No `listen` |
| Rollback | `contexts/attendance/adapters/xlsx/`, the `#adapters/xlsx/*` import, and the `xlsx` dependency |

`SheetJsHoursWorkbook` writes one sheet. The columns are `userId`, `workedMinutes`, `latenessMinutes`, `earlyLeaveMinutes`, `offScheduleMinutes`, and `absent`. A worker with 480 worked minutes and 7 minutes of lateness is those cells. The sheet has no salary column.

The adapter and its test are under the 400-line default. `size:exception` was not granted.

## Deviations

The column names are the workbook row fields. The design says the file has no salary and does not name the headers. HTTP stays out.

Stacked PR for this slice targets the Postgres slice's branch. Start: Postgres green. Finish: xlsx green. HTTP stays out.
