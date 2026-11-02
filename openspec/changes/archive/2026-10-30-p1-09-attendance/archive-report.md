# Archive Report

**Change**: p1-09-attendance
**Project**: blackhole
**Artifact store**: openspec
**Archive mode**: intentional-with-warnings
**Archived on**: 2026-10-30
**Archived to**: `openspec/changes/archive/2026-10-30-p1-09-attendance/`
**Verification verdict**: PASS WITH WARNINGS
**Engram**: not used. No observation IDs. Orchestrator forbade Engram for this archive.

## Gate

Archive was allowed. `reviewGate.result` is `allow`. This repo has no Engram review receipt. The 2026-10-28 archives used `verify-report.md` as the gate, and this archive does the same. No transaction, ledger, or receipt file was required.

`verify-report.md` records **PASS WITH WARNINGS**, `CRITICAL: None`, and 7/14 scenarios compliant. The other seven are partial results or accepted D-37/D-43 conflicts. `tasks.md` has 28/28 implementation tasks checked. `state.yaml` had `status: verified`, `verify: done`, and `archive: pending` before the move. No CRITICAL finding and no unchecked implementation task blocked this archive.

The orchestrator accepted the warnings and instructed this phase not to fix them. The verify suggestion to reconcile off-premises rejection, site-bridge presence, hybrid offline clock, and hybrid export before the merge was not applied.

`state.yaml` was not edited. The orchestrator owns that file. The archived copy still says `status: verified` and `archive: pending`, which is the state observed before the move.

## Lineage

| Artifact | Path | Observation ID |
|----------|------|----------------|
| proposal | `openspec/changes/p1-09-attendance/proposal.md` | n/a (openspec) |
| spec | `openspec/changes/p1-09-attendance/specs/attendance/spec.md` | n/a (openspec) |
| design | `openspec/changes/p1-09-attendance/design.md` | n/a (openspec) |
| tasks | `openspec/changes/p1-09-attendance/tasks.md` | n/a (openspec) |
| apply-progress | `openspec/changes/p1-09-attendance/apply-progress.md` | n/a (openspec) |
| verify-report | `openspec/changes/p1-09-attendance/verify-report.md` | n/a (openspec) |
| archive-report | `openspec/changes/archive/2026-10-30-p1-09-attendance/archive-report.md` | n/a (openspec) |

## Task Completion Gate

`tasks.md` has 28/28 implementation tasks checked (1.1–1.5, 2.1–2.14, 3.1–3.6, 4.1–4.3). No `- [ ]` implementation task remains. Checkboxes were not reconciled. Archive was allowed. The test suite was not run in this phase.

Proposal success criteria in `proposal.md` remain unchecked (four items). Those are not implementation tasks. The verify report already records them as a suggestion: they describe a real week of site use, not a unit test.

## Spec Reconciliation

No sentence was rewritten. The delta has no `ADDED`, `MODIFIED`, `REMOVED`, or `RENAMED` sections. It is a full spec. The main spec `openspec/specs/attendance/spec.md` did not exist, so the change spec was copied unchanged before the folder move. SHA-256 of the copied file matched the delta: `37C2B3DF235F8377D84BF57245F82C081F8BCCD21A88626EDD4CE88E4BA2A730`.

This merge adds requirements. It does not delete existing main-spec requirements. `openspec/config.yaml` `rules.archive` ("Warn before merging destructive deltas") does not apply as a destructive merge.

The copied spec still contains the sentences that conflict with design D-37 and D-43. That conflict is recorded below and was left in place on purpose.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| attendance | Created | Full spec copied unchanged. 7 requirements, 14 scenarios. 0 modified, 0 removed, 0 renamed in a prior main spec. |

Requirements copied:

- Clock Events With Trusted Time
- Presence on the Premises
- Outage Behavior
- Work Modes
- No Clock-In, No Operation
- Automatic Close and Audited Corrections
- Reports and Export

Source of truth: `openspec/specs/attendance/spec.md`.

No other domain spec was read or written.

## Residual Warnings (not blocking)

These remain from the verify report. This archive does not treat them as resolved.

### D-43 — off premises

- Spec scenario "Off premises" says a registered phone off the site network stores nothing.
- Design D-43 rejects dropping a location miss: haversine versus geofence. A match stores `matched`. A miss stores `flagged` and does not enable operation. No geofence stores `flagged`.
- Passing record-clock tests assert that stored flagged row. This follows the design and contradicts the spec. It is not a missing rejection.
- "Cloud site with bridge" is PARTIAL. A coordinate inside the geofence is stored as `matched`. Nothing checks that the phone reached a site bridge.

### D-37 — hybrid node deferred

- Spec scenario "Hybrid outage" requires the node to store the clock and sync it once after reconnection.
- Spec scenario "Export during hybrid outage" requires export to be unavailable while today's hours remain on the node.
- Design Deferred (D-37) leaves offline clock on `apps/local-node`, SQLite, and sync out of this change, along with photo, tips, payroll, admin-web, and venue-app. Hybrid outage behavior waits for that phase. A cloud cut stops the site. Devices do not queue clock events.
- `apps/local-node` has no attendance slice. Those scenarios are not a missing node implementation inside this change.

### Other warnings

- "Cloud outage" is PARTIAL. A failed cut is not queued, and that test passed. Nothing reports clocking unavailable while a cloud site is offline, and clock-in has no outage branch.
- "Waiter without clock-in" is PARTIAL. `HasOpenClockIn` returns `ruleEnabled: true` and `counting: false`. Orders and cash do not call it, so an order or a register opening is not rejected.
- "Administrator exempt" is PARTIAL. The design says administrators never call the port. No test opens a report without a clock-in and shows it allowed. The port does not distinguish administrators.
- `registerCloseOpenShifts` consumes `attendance.close-open-shifts` on a private in-memory repository with `retryLimit: 0`. Nothing publishes a job at the venue close time, and the worker cannot see entries stored by the API process. `CloseOpenShifts` itself passed.
- `ClockEntryCorrection` is not in `0008_attendance.sql`. Corrections stay in the api-cloud memory composition. A restart drops them. Entries and policies are append-only in PGlite.
- Several apply slices exceeded the 400-line review budget. `tasks.md` forecasts 2200–3600 lines, High budget risk, and chained PRs. `size:exception` was not granted. This phase did not recompute the diff.

## SDD Cycle

The change was planned, implemented, verified (PASS WITH WARNINGS, zero CRITICAL), synced without rewriting D-37/D-43 conflicts, and archived. Active `openspec/changes/` no longer contains `p1-09-attendance`.
