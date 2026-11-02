## Verification Report

**Change**: p1-09-attendance
**Version**: N/A (roadmap delivery 1.9)
**Mode**: Standard

Strict TDD is inactive (`strict_tdd: false`). `strict-tdd-verify.md` was not loaded. Evidence is from commit `208b30349b6c7b63f4db9898a2a84ba8e3b26df3` on branch `verify/p1-09-attendance`, inspected in `C:\Users\csar-\Proyectos\blackHole-verify-attendance`. Specs were compared first, design second, and task completion third. Product source and tests were not edited. The change was not archived.

`state.yaml` was stale (`status: designed`, `apply: pending`). `tasks.md` has every implementation task checked, and the attendance slice is on this commit. This phase treated that file as stale and updated `apply` and `verify` after the verdict. It did not start apply.

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 28 |
| Tasks complete | 28 |
| Tasks incomplete | 0 |

Tasks 1.1–1.5, 2.1–2.14, 3.1–3.6, and 4.1–4.3 are checked. No unchecked implementation task remains. The tasks file marks local-node, SQLite, sync, photo, tips, payroll, admin-web, and venue-app as out of scope. That matches design section Deferred (D-37).

### Build & Tests Execution

**Install**: ✅ Passed

```text
pnpm install --frozen-lockfile
exit 0
Packages: +278, done in 17.8s. Lockfile was up to date.
```

**Build**: ✅ Passed

```text
pnpm exec tsc -b contexts/attendance apps/api-cloud --pretty false
exit 0
No diagnostics printed.
```

**Tests**: ✅ 83 passed / ❌ 0 failed / ⚠️ 0 skipped

```text
pnpm exec vitest run --project attendance --project api-cloud attendance
exit 0
Test Files  14 passed (14)
Tests  83 passed (83)
Duration  16.15s
```

The filename filter `attendance` selected every file under `contexts/attendance` plus `apps/api-cloud/test/http/attendance.controller.test.ts` and `apps/api-cloud/test/composition/attendance-memory.test.ts`. `bootstrap.test.ts` was not in this run.

**Architecture** (extra, not one of the three scoped commands): ✅ Passed

```text
pnpm architecture
exit 0
no dependency violations found (532 modules, 1693 dependencies cruised)
```

dependency-cruiser printed the pre-existing `missing-typescript-transpiler` warning for TypeScript 7. Cruiser rules were not changed.

**Coverage**: ➖ Not available / threshold: 0% → ➖ Not available

No coverage provider is installed. `openspec/config.yaml` sets `coverage_threshold: 0`. Full-workspace `pnpm test`, `pnpm typecheck`, and `pnpm lint` were not run.

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Clock Events With Trusted Time | Phone clock ahead | `contexts/attendance/application/record-clock-entry/record-clock-entry.test.ts` > given a phone clock 30 minutes ahead, when the worker clocks in, then the entry uses the server clock | ✅ COMPLIANT |
| Clock Events With Trusted Time | Second clock-in | `contexts/attendance/domain/worker-shift.test.ts` > given an open clock-in, when the worker clocks in again, then it is rejected and the state stays on_shift | ✅ COMPLIANT |
| Presence on the Premises | Cloud site with bridge | `contexts/attendance/application/record-clock-entry/record-clock-entry.test.ts` > given a coordinate inside the geofence, when the worker clocks in, then presence is matched and the rule stays off | ⚠️ PARTIAL |
| Presence on the Premises | Off premises | `contexts/attendance/application/record-clock-entry/record-clock-entry.test.ts` > given a coordinate outside the geofence and the rule on, when the worker clocks in, then the row is flagged and does not enable operation | ⚠️ SPEC/DESIGN CONFLICT |
| Outage Behavior | Hybrid outage | (none in this slice; local-node has no attendance code) | ⚠️ SPEC/DESIGN CONFLICT |
| Outage Behavior | Cloud outage | `contexts/attendance/application/close-open-shifts/close-open-shifts.test.ts` > given the repository rejects the cut, when an open shift is closed, then the call fails, the rows stay, and no job is queued | ⚠️ PARTIAL |
| Work Modes | Hours only | `contexts/attendance/domain/project-hours.test.ts` > given 08:00 in, a break from 12:00 to 12:30, and 16:00 out, when hours are projected, then worked time is 7h30 and lateness is not reported | ✅ COMPLIANT |
| Work Modes | Within tolerance | `contexts/attendance/domain/project-hours.test.ts` > given an 08:00 schedule and a 10-minute tolerance, when the worker clocks in at 08:07, then lateness is not reported | ✅ COMPLIANT |
| No Clock-In, No Operation | Waiter without clock-in | `contexts/attendance/application/entry-port.test.ts` > given the rule is on and the worker has no entries, when a caller asks, then the rule is on and counting is false | ⚠️ PARTIAL |
| No Clock-In, No Operation | Administrator exempt | (no test opens a report without clock-in) | ⚠️ PARTIAL |
| Automatic Close and Audited Corrections | Forgotten clock-out corrected | `contexts/attendance/application/correct-clock-entry/correct-clock-entry.test.ts` > given an auto-closed clock-out, when an administrator corrects it with a reason, then the original stays, hours use the correction, and the audit records it | ✅ COMPLIANT |
| Automatic Close and Audited Corrections | Unauthorized correction | `apps/api-cloud/test/http/attendance.controller.test.ts` > given a cashier session, when the cashier corrects, sets policy, reads, or exports, then each response is 403 | ✅ COMPLIANT |
| Reports and Export | Weekly export | `contexts/attendance/application/export-hours/export-hours.test.ts` > given a week with a corrected clock-out, when hours are exported, then the file lists the corrected hours and has no salary | ✅ COMPLIANT |
| Reports and Export | Export during hybrid outage | (none; export is cloud-only and local-node has no attendance slice) | ⚠️ SPEC/DESIGN CONFLICT |

**Compliance summary**: 7/14 scenarios compliant. Four are partial. Three are spec/design conflicts under D-43 or D-37, not missing tests for behavior this change was required to build.

The same second-clock-in outcome also passed in `record-clock-entry.test.ts` (one stored row) and in the HTTP test (409 `{ error: "SecondClockIn" }`). The phone-clock HTTP case passed inside `attendance.controller.test.ts` ("a client clock is rejected"). The weekly-export workbook case passed in `adapters/xlsx/hours-workbook.test.ts` (no salary column). The auto-close half of the forgotten-clock-out scenario passed in `close-open-shifts.test.ts` (one `pending_review` clock-out, second run does not duplicate).

Off premises: the spec says nothing is stored. Design D-43 says a geofence miss, or a venue with no geofence, stores `flagged` and does not enable operation. Both of those tests passed and assert a stored flagged row with `counting` false. That follows the design and contradicts the spec sentence. It is not an untested rejection path.

Hybrid outage and export during hybrid outage: the spec expects the node to store the clock and to keep today's hours during an offline export. Design Deferred (D-37) leaves local-node, SQLite, and sync out of this change. `apps/local-node` has no attendance references. Those scenarios are not a missing node implementation inside this slice.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Trusted time and one open clock-in | ✅ Implemented | `recordClockEntryBody` is `.strict()` and has no `occurredAt`. The use case stores `Clock.now()`. A second matched clock-in throws `SecondClockIn`. The same `commandId` returns the first row. HTTP clock-in is 200; the second open clock-in is 409. |
| Presence | ⚠️ Partial | Inside the geofence, presence is `matched` and the row is stored. Outside the geofence, or with no geofence, the row is stored as `flagged` and `counting` stays false. There is no site-bridge reach check. The spec's "nothing is stored" outcome is not what the code does. |
| Outage | ⚠️ Partial | `CloseOpenShifts` has no queue port. A failed cut throws and the test's `queuedJobs` stays empty. Hybrid offline clock and sync are absent. The worker does not report "clocking unavailable" for a cloud outage. |
| Hours-only and scheduled projection | ✅ Implemented | 08:00–16:00 with a 30-minute break is 450 minutes and no lateness. 08:07 within 10 minutes is not late. 08:25 is 25 minutes late. Early leave, off-schedule, and absence are covered. Flagged marks are skipped. A later correction wins and the original `occurredAt` stays. |
| Operation rule | ⚠️ Partial | `HasOpenClockIn` returns `{ ruleEnabled, counting }`. Counting is `on_shift` or `on_break` for a matched open clock-in. A flagged clock-in does not count. The rule defaults off. `contexts/orders` and `contexts/cash-register` do not call the port, so an order or register opening is not rejected. The port does not check roles. `HasClockedInCashier` is a separate class and is not `EvaluatePermission`. |
| Auto-close and corrections | ⚠️ Partial | The use case appends one matched `clock_out` with `pendingReview` true for `on_shift` and `on_break`, and a second run at the same instant does not append again. `CorrectClockEntry` appends a correction, leaves the original row, projects the replacement, and audits `attendance.correct` only after append. HTTP denies a cashier correction with 403. The pg-boss worker registers the queue and nothing sends a job. See design coherence. |
| Reports and export | ✅ Implemented | Read reports hours, lateness, absences, corrections, and presence, skips flagged marks, and denies another site before listing. Export uses the corrected hours. The workbook columns are `userId`, `workedMinutes`, `latenessMinutes`, `earlyLeaveMinutes`, `offScheduleMinutes`, and `absent`. HTTP read and export have no `salary`. Export during a hybrid outage is not implemented. |
| Append-only store | ✅ Implemented | Memory and PGlite contract tests passed: hidden tenant, one row per `tenantId` plus `commandId`, no update or delete method. `0008_attendance.sql` grants `attendance_app` SELECT and INSERT, forces RLS, and rejects UPDATE, DELETE, and TRUNCATE. Policy `save` appends the next `position`. Platform files `0001`–`0007` were not the attendance migration. |
| Cloud HTTP | ✅ Implemented | Routes on `AttendanceController`: `POST .../clock-entries`, `POST .../clock-entries/:entryId/corrections`, `PUT .../attendance/policy`, `GET .../attendance`, `POST .../attendance/export`. Tests use `inject` and `x-session-id`. Clock requires PIN and a registered device. Policy, read, export, and correction require `attendance.correct` on the caller's site. No new permission code was added. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| New context `@blackhole/attendance`; domain has no Nest or SQL | ✅ Yes | Domain tests are pure. No relative imports under `contexts/attendance`. `pnpm architecture` exited 0. |
| `Clock.now()`; client `occurredAt` rejected on clock-in | ✅ Yes | Clock body has pin, kind, coordinates, and `commandId` only. A correction body may carry a replacement `occurredAt`, which is the audited correction, not the worker clock. |
| D-43: match stores `matched`; miss or no geofence stores `flagged` and does not enable operation | ✅ Yes | Both record-clock tests passed. This follows the design and contradicts the spec's "Off premises" scenario. |
| Append `ClockEntry` and `ClockEntryCorrection`; hours are `projectHours` | ⚠️ Partial | The use cases and the in-memory correction store do this. `0008_attendance.sql` creates `clock_entries` and `attendance_policies` only. There is no correction table. |
| `HasOpenClockIn` and `HasClockedInCashier` only; admins never call the port; not inside `EvaluatePermission` | ⚠️ Partial | `entry-port.ts` exports those two classes and returns booleans. No orders, kitchen, or cash caller asks. The exemption is structural, and no test shows an administrator report staying allowed. |
| One open clock-in per worker per venue; `commandId` retry returns the same row | ✅ Yes | Domain, use case, and HTTP 409 passed. A reused `commandId` from another worker is rejected and the first row stays. |
| `attendance_app` insert-only, forced RLS, next unused SQL number | ✅ Yes | `contexts/attendance/adapters/postgres/0008_attendance.sql`. Platform `0007_audit.sql` is untouched. Contract tests passed on PGlite. Drizzle is not mocked. |
| SheetJS stays in the xlsx adapter; no salary columns | ✅ Yes | `SheetJsHoursWorkbook` is the only writer. The workbook test rejects `salary`, `salario`, and `wage`. |
| Zod at the boundary; `z.enum` for kind and presence | ✅ Yes | `shared/contracts/attendance.ts`. Read states also use `z.enum`. |
| pg-boss runs close; a failed cut is not queued | ⚠️ Partial | `startWorker` calls `registerCloseOpenShifts(boss)`. The queue is `attendance.close-open-shifts` with `retryLimit: 0`. The handler default repository is `new InMemoryClockEntryRepository()`, not the API process store. No `boss.send` exists, so venue `closeTime` never enqueues a cut. The use-case test still proves the cut itself. |
| HTTP `inject`, no `listen`; `attendance.correct` on the caller's site | ✅ Yes | The controller test file passed (6 tests) inside the 83-test run. Another site's administrator gets 403 for policy, read, and export. |
| Cloud slice only (D-37); no local-node, SQLite, sync, photo, tips, payroll, admin-web, or venue-app | ✅ Yes | Those trees have no attendance slice. Hybrid scenarios stay in the spec and are deferred by the design. |
| Nest host may keep an in-memory clock store | ✅ Yes | `ApplicationModule` uses `InMemoryClockEntryRepository` when no dependency is passed. Postgres is the contract dialect. |

### Issues Found

**CRITICAL**:

- None.

**WARNING**:

- Spec/design conflict on "Off premises". The spec says a registered phone off the site network stores nothing. Design D-43 stores `flagged` and leaves `counting` false. The passing record-clock tests assert that stored flagged row for a geofence miss and for a venue with no geofence. This is not a missing rejection.
- Spec/design conflict on "Hybrid outage" and "Export during hybrid outage". The spec requires offline node clock, later sync, and node-side hours while export is unavailable. Design Deferred (D-37) and the tasks out-of-scope list exclude local-node, SQLite, and sync. No attendance code exists under `apps/local-node`.
- "Cloud site with bridge" is PARTIAL. A coordinate inside the geofence is stored as `matched`. Nothing checks that the phone reached a site bridge.
- "Cloud outage" is PARTIAL. A failed cut is not queued, and that test passed. Nothing reports clocking unavailable while a cloud site is offline, and clock-in has no outage branch.
- "Waiter without clock-in" is PARTIAL. `HasOpenClockIn` returns `ruleEnabled: true` and `counting: false`, and that test passed. Orders and cash do not call it, so an order or a register opening is not rejected.
- "Administrator exempt" is PARTIAL. The design says administrators never call the port. No test opens a report without a clock-in and shows it allowed. The port does not distinguish administrators.
- `registerCloseOpenShifts` consumes `attendance.close-open-shifts` on a private in-memory repository with `retryLimit: 0`. Nothing publishes a job at the venue close time, and the worker cannot see entries stored by the API process. `CloseOpenShifts` itself passed.
- `ClockEntryCorrection` is not in `0008_attendance.sql`. Corrections stay in the api-cloud memory composition. A restart drops them. Entries and policies are append-only in PGlite.
- Several apply slices exceeded the 400-line review budget. `tasks.md` forecasts 2200–3600 lines, High budget risk, and chained PRs. `size:exception` was not granted. This phase did not recompute the diff.

**SUGGESTION**:

- Before archive merges the delta, reconcile the spec sentences that D-37 and D-43 already replaced: off-premises rejection, site-bridge presence, hybrid offline clock, and hybrid export.
- A caller in orders, kitchen, and cash that blocks only when `ruleEnabled && !counting` would finish the waiter scenario. An administrator path that never calls the port would finish the exemption scenario.
- A scheduler that sends `CloseOpenShiftsCommand` at `closeTime`, against the same repository the API writes, would make the automatic close run. The use case is already green.
- A Postgres table for corrections, insert-only like `clock_entries`, would match the append-only correction decision.
- The four proposal success checkboxes are still open. They describe a real week of site use, not a unit test.

### Verdict

PASS WITH WARNINGS

7/14 spec scenarios are compliant. The scoped Vitest command exited 0 (14 files, 83 tests) and `tsc -b contexts/attendance apps/api-cloud` exited 0. No CRITICAL remains. The other seven scenarios are partial results or accepted D-37/D-43 conflicts. Archive can proceed after the orchestrator accepts those warnings. This phase did not archive.
