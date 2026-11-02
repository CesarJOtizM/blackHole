# Attendance Specification

## Purpose

Record worker clock events with trusted time, on the premises only, for the operation rule, tips and payroll export, never salary (PRD-M8, TRD-00 10.4).

## Requirements

### Requirement: Clock Events With Trusted Time

A worker SHALL clock in, clock out, start and end a break with their PIN on a registered device. Time MUST come from the node (hybrid) or server (cloud mode); client time MUST be ignored. Events MUST be append-only, a retry MUST NOT duplicate, and a worker MUST have at most one open clock-in per site.

#### Scenario: Phone clock ahead
- GIVEN a phone clock 30 minutes ahead
- WHEN the worker clocks in
- THEN the event carries node or server time

#### Scenario: Second clock-in
- GIVEN an open clock-in
- WHEN the worker clocks in again
- THEN it is rejected

### Requirement: Presence on the Premises

A clock event MUST be accepted only from a device proven on the premises: through the node network (hybrid) or by reaching the site bridge (cloud mode). Otherwise it MUST be rejected.

#### Scenario: Cloud site with bridge
- GIVEN a cloud-mode site whose bridge the phone reaches
- WHEN the worker clocks in
- THEN the event is stored

#### Scenario: Off premises
- GIVEN a registered phone off the site network
- WHEN the worker clocks in
- THEN nothing is stored

### Requirement: Outage Behavior

In hybrid mode, clocking, corrections and the open clock-in check MUST work offline on the node and sync in order later. In cloud mode clocking MUST be unavailable during an outage and devices MUST NOT queue events.

#### Scenario: Hybrid outage
- GIVEN a hybrid site offline
- WHEN a worker clocks in
- THEN the node stores it and it reaches the cloud once after reconnection

#### Scenario: Cloud outage
- GIVEN a cloud-mode site offline
- WHEN a worker clocks in
- THEN clocking is reported unavailable and nothing is stored

### Requirement: Work Modes

Each worker SHALL be hours-only or scheduled. Hours MUST equal clock-in to clock-out minus breaks. Scheduled mode MUST also derive lateness, absence, early leave and off-schedule time with the site tolerance.

#### Scenario: Hours only
- GIVEN 08:00 in, break 12:00-12:30, 16:00 out
- WHEN hours are projected
- THEN hours are 7h30 with no lateness

#### Scenario: Within tolerance
- GIVEN an 08:00 schedule and 10-minute tolerance
- WHEN the worker clocks in at 08:07
- THEN no lateness is reported

### Requirement: No Clock-In, No Operation

When a site enables the rule, operational actions (orders, opening the register, kitchen) from users without open clock-in MUST be rejected, except administrative roles, also on an offline node. When disabled, nothing is blocked. Rule changes MUST be audited.

#### Scenario: Waiter without clock-in
- GIVEN the rule is active
- WHEN a waiter without clock-in sends an order
- THEN it is rejected

#### Scenario: Administrator exempt
- GIVEN the rule is active
- WHEN an administrator without clock-in opens a report
- THEN it is allowed

### Requirement: Automatic Close and Audited Corrections

At the site's configured time, the operation owner SHALL append a clock-out to open shifts and flag them for review. Only a site administrator SHALL correct a clock event, with a mandatory reason, by appending a correction referencing the original, which MUST remain. Projections MUST apply corrections even when they sync later.

#### Scenario: Forgotten clock-out corrected
- GIVEN a shift auto-closed and flagged at closing time
- WHEN the administrator corrects the clock-out with a reason
- THEN both records exist, hours use the correction, and the audit records it

#### Scenario: Unauthorized correction
- GIVEN a cashier
- WHEN they correct a clock event
- THEN it is denied

### Requirement: Reports and Export

The system SHALL report hours, lateness, absences, corrections and who is on site now, scoped by role. Excel export MUST run only in the cloud, use the corrected projection and contain no salary.

#### Scenario: Weekly export
- GIVEN a week with corrections
- WHEN a manager exports
- THEN the file lists corrected hours per worker

#### Scenario: Export during hybrid outage
- GIVEN a hybrid site offline
- WHEN export is requested
- THEN it is unavailable; today's hours remain on the node
