# Proposal: Attendance

## Intent

The site needs a trustworthy record of who worked and how long, to block off-shift operation, feed tips and export hours. It is not payroll (PRD-00 M8, PRD-M8, TRD-00 10.4).

## Scope

### In Scope
- Clock-in, clock-out, break start and end with the personal PIN, only on the premises, timestamped by the node or the server.
- Hours-only mode and scheduled mode (lateness, absence, early leave, off-schedule time) per worker, with site tolerance.
- Optional per-site "no clock-in, no operation" rule; administrative roles exempt.
- Automatic close of open shifts at a configured time, flagged for review.
- Audited corrections that never edit the original.
- Reports (hours, lateness, absences, corrections, who is here now) and Excel export.

### Out of Scope
- Photo on clock event → 5.4.
- Sales per hour worked and staff productivity reports → 1.11.
- Tip participants consumption → 1.10.
- Payroll, salary, electronic payroll (out of product scope).

## Capabilities

### New Capabilities
- `attendance`: append-only clock events, presence, work modes, operation rule, auto-close, corrections, reports and export.

### Modified Capabilities
None

## Approach

New context `contexts/attendance`. Clock events are append-only; hours are a projection over events plus corrections (TRD-M8 sec. 2). Time comes from node (hybrid) or server (cloud), never the client. Platform authorization asks "has open clock-in" when the rule is on. Hybrid sites clock offline on local-node; cloud sites cannot during an outage. Export runs in api-cloud.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `contexts/attendance/domain`, `contexts/attendance/application` | New | Clock events, schedules, projection, corrections |
| `contexts/attendance/adapters` (memory, sqlite, postgres) | New | Append-only repositories |
| `contexts/platform/application` | Modified | Operation rule check |
| `apps/local-node`, `apps/api-cloud` | Modified | Clock and correction endpoints, auto-close worker, export |
| `apps/venue-app`, `apps/admin-web` | Modified | Clock screen; schedules, corrections, who is here |
| `shared/contracts`, `shared/sync` | Modified | Clock event schemas and sync |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Presence check at a cloud site without local equipment | Low | The clock-in counts when the device location matches the venue. Otherwise it is flagged and does not enable operation (D-43) |
| Someone clocks for another | Med | Personal PIN plus presence; photo in 5.4 |
| Rule locks out staff on day one | Med | Rule off by default; enable per site after the pilot week |
| Corrections arriving after original during sync | Low | Projection applies corrections regardless of arrival order |

## Rollback Plan

Turn off the per-site operation rule to unblock operation immediately. Clock events are append-only and kept; hiding the clock screen stops new events without data loss. No other context depends on attendance until 1.10.

## Dependencies

- p0-02, p0-03, p0-04, p0-05, p0-06.
- Service does not start without a clocked-in cashier. Lateness tolerance is per venue (D-33).

## Success Criteria

- [ ] One real week of clock events from the site staff, with their reports of hours, lateness and absences.
- [ ] A phone clock change does not alter recorded time.
- [ ] With the rule active, no order or register opening without clock-in.
- [ ] A correction keeps the original and the projection uses the correction.
