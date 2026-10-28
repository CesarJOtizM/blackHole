# Tasks: Attendance

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2200–3600 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Units 1–7 in order |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

Resolved 2026-10-23: stacked PRs to master. Implement one work unit per apply. PR 1 is tasks 1.1–1.3 only.

Cloud slice (D-37, D-43, D-33). RED then GREEN (ADR-017). Threat matrix N/A. Split a unit that exceeds 400 lines.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Start: none. Finish: shift green. Verify: second clock-in rejected. | 1 | `pnpm vitest run --project attendance worker-shift` | N/A: pure domain | package and `worker-shift.ts` |
| 2 | Start: shift types. Finish: hours green. Verify: 7h30; 08:07 not late. | 2 | `pnpm vitest run --project attendance project-hours` | N/A: pure domain | `project-hours.ts` |
| 3 | Start: domain green. Finish: record green. Verify: server time, retry, flagged, cashier. | 3 | `pnpm vitest run --project attendance record-clock-entry` | N/A: memory ports | `record-clock-entry/` and its ports |
| 4 | Start: append works. Finish: correct and close green. Verify: both rows; cut fails; no queue. | 4 | `pnpm vitest run --project attendance correct-clock-entry close-open-shifts` | N/A: memory ports | those two folders |
| 5 | Start: events exist. Finish: reads and entry port. Verify: only two queries. | 5 | `pnpm vitest run --project attendance set-venue-attendance-policy read-attendance export-hours entry-port` | N/A: memory ports | those folders and `entry-port.ts` |
| 6 | Start: contract exists. Finish: memory and PGlite green. Verify: append only; hidden tenant. | 6 | `pnpm vitest run --project attendance adapters/memory adapters/postgres` | N/A: PGlite, no live Postgres | memory, postgres, that SQL |
| 7 | Start: store green. Finish: xlsx and HTTP green. Verify: 200, 409, 403, no salary. | 7 | `pnpm vitest run --project attendance hours-workbook` then `--project api-cloud attendance.controller` | N/A: `inject`, no `listen` | xlsx, controller, contracts, worker |

## Phase 1: Domain (units 1–2)

- [x] 1.1 Create `contexts/attendance/package.json`, `tsconfig.json` (`#domain/*`), root reference, vitest project `attendance`.
- [x] 1.2 RED `domain/worker-shift.test.ts`: reject second clock-in; ignore `flagged`; states `off_shift`, `on_shift`, `on_break`, `pending_review`.
- [x] 1.3 GREEN `domain/worker-shift.ts`, `domain/index.ts`. Kinds `clock_in`, `clock_out`, `break_start`, `break_end`. No Nest or SQL.
- [x] 1.4 RED `domain/project-hours.test.ts`: 7h30; 08:07 within 10 minutes not late; correction wins; scheduled lateness, absence, early leave, off-schedule.
- [x] 1.5 GREEN `domain/project-hours.ts`. Original stays.

## Phase 2: Use cases (units 3–5)

- [x] 2.1 RED `application/record-clock-entry/record-clock-entry.test.ts`: server `Clock.now()`; `commandId` retry; second open rejected; geofence `matched`; miss or no geofence `flagged` and not enabling; rule off; cashier `cashRegisterId` until clock-out.
- [x] 2.2 GREEN `record-clock-entry.ts`. Ports: `clock.ts`, `pin-check.ts` adapts `PinVerifier`, `clock-entry-repository.ts` `append`/`list`, policy geofence, tolerance, close time, `hours_only` or `scheduled`, `ScheduledShift`. `#application/*`, `#application/ports/*`, and each use-case folder key.
- [x] 2.3 RED `application/correct-clock-entry/correct-clock-entry.test.ts`: keep original; project the correction; `RecordAuditEvent` only then.
- [x] 2.4 GREEN `correct-clock-entry.ts` via platform `entry-port` only.
- [x] 2.5 RED `application/close-open-shifts/close-open-shifts.test.ts`: `pending_review` clock-out; failed cut is not queued.
- [x] 2.6 GREEN `close-open-shifts.ts`.
- [x] 2.7 RED `application/set-venue-attendance-policy/set-venue-attendance-policy.test.ts`: audited change; rule off until set.
- [x] 2.8 GREEN `set-venue-attendance-policy.ts`.
- [x] 2.9 RED `application/read-attendance/read-attendance.test.ts`: hours, lateness, absences, corrections, presence; skip `flagged`; deny other site.
- [x] 2.10 GREEN `read-attendance.ts`. `attendance.correct`.
- [x] 2.11 RED `application/export-hours/export-hours.test.ts`: corrected hours; no salary.
- [x] 2.12 GREEN `export-hours.ts`, `ports/hours-workbook.ts`.
- [x] 2.13 RED `application/entry-port.test.ts`: `{ ruleEnabled, counting }`; block only when rule on and `counting` is false; cashier needs `cashRegisterId`; `flagged` excluded.
- [x] 2.14 GREEN `entry-port.ts`: only `HasOpenClockIn` and `HasClockedInCashier`. Admins are not callers. Not `EvaluatePermission`.

## Phase 3: Adapters (unit 6; 3.5–3.6 in unit 7)

- [x] 3.1 RED `ports/clock-entry-repository.contract.ts`, `adapters/memory/*contract.test.ts`: hidden tenant; same `commandId`; no update or delete.
- [x] 3.2 GREEN memory repository. `#adapters/memory/*`.
- [x] 3.3 RED PGlite `adapters/postgres/*.contract.test.ts`: `attendance_app`, forced RLS, UPDATE/DELETE/TRUNCATE refused. No Drizzle mock. Next unused `NNNN_attendance.sql`. Leave `0001`–`0007`.
- [x] 3.4 GREEN that SQL, `schema.ts`, `drizzle-*-repository.ts` (entries and policy). `#adapters/postgres/*`.
- [x] 3.5 RED `adapters/xlsx/hours-workbook.test.ts`: no salary column.
- [x] 3.6 GREEN `adapters/xlsx/hours-workbook.ts`.

## Phase 4: HTTP (unit 7)

- [x] 4.1 RED `apps/api-cloud/test/http/attendance.controller.test.ts`: `inject` and `x-session-id`; `POST /tenants/:tenantId/venues/:venueId/clock-entries` 200; second open 409; cashier correction 403; policy, read, and export need `attendance.correct` on the own site, else 403; no salary; PIN and a registered device; no `listen`; no new permission.
- [x] 4.2 GREEN `shared/contracts/attendance.ts`, `index.ts`. `z.enum` kind and presence. No trusted timestamp.
- [x] 4.3 GREEN controller, `attendance-access.ts` (cashier `cashRegisterId` only), `application-module.ts`, pg-boss `close-open-shifts.ts`. Wire api-cloud and root `package.json`, plus both `tsconfig.json` references.

## Out of scope

No local-node, SQLite, sync, photo, tips, payroll, admin-web, or venue-app.
