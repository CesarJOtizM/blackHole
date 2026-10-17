# Platform Hub Specification

## Purpose

One cloud hub and site screen for platform orders, with manual fallback (PRD-M5, TRD-00 sec. 6.1).

## Requirements

### Requirement: Connector Capabilities

Each connector MUST declare its operations (receive, status, menu, availability, pause, settlement); the hub MUST check before calling. The Manual adapter MUST declare none and call no platform.

#### Scenario: Manual channel order ready
- GIVEN a channel on the Manual adapter
- WHEN an order becomes ready
- THEN no platform call is made and the screen says to update the tablet

#### Scenario: Menu unsupported
- GIVEN a connector without menu support
- WHEN the admin publishes the channel menu
- THEN the system says to use the platform portal

### Requirement: External Order Idempotency

An external order MUST be unique by (platform, external id) across automatic intake, manual capture and sync replays.

#### Scenario: Repeated intake
- GIVEN order "R-1" received
- WHEN "R-1" arrives again
- THEN no second order exists

#### Scenario: Manual duplicate
- GIVEN DiDi "D-9" captured
- WHEN captured again
- THEN it is rejected

### Requirement: Manual Capture

A cashier MUST capture channel, external code and products; the order MUST follow the automatic path, work offline on a hybrid node, and be audited as manual.

#### Scenario: Offline capture
- GIVEN a hybrid site offline
- WHEN an order is captured and accepted
- THEN the kitchen gets it and it syncs once on reconnect

#### Scenario: Missing code
- GIVEN a capture without code
- WHEN submitted
- THEN it is rejected

### Requirement: Single Channel Queue

Pending orders MUST appear in one site queue with sound, channel, code and acceptance deadline; the alert MUST escalate near the deadline.

#### Scenario: New order
- GIVEN a received order
- WHEN it reaches the site
- THEN the queue sounds and shows channel, code and time left

#### Scenario: Deadline near
- GIVEN an unattended order near the limit
- WHEN time passes
- THEN the alert escalates

### Requirement: Accept and Reject

Only accepting MUST create the internal order, with channel and code, plus a platform receivable, never cash. Rejecting MUST close it without internal order. Both MUST require permission (PRD-01 sec. 6.4) and be audited.

#### Scenario: Accept
- GIVEN a pending order and a permitted cashier
- WHEN accepted
- THEN the kitchen ticket shows platform and code and a receivable is recorded

#### Scenario: Reject without permission
- GIVEN a waiter without the permission
- WHEN they try to reject
- THEN it is blocked and no state changes

### Requirement: Ownership and Automatic Acceptance

The cloud MUST own an external order until accepted. Acceptance MUST run on the operation owner (node in hybrid, `api-cloud` in cloud mode). A site MAY enable scheduled auto-accept; it MUST NOT happen while the owner is unreachable.

#### Scenario: Inside schedule
- GIVEN auto-accept 12:00–15:00
- WHEN an order arrives at 13:00
- THEN it is accepted without a cashier

#### Scenario: Node silent
- GIVEN a hybrid node offline
- WHEN an order arrives
- THEN it waits in the cloud and enters the queue once on reconnect

### Requirement: Channel Menu and Mapping

The admin MUST choose products and optional prices per channel. Channel items MUST map to internal products and modifiers; an unmapped item MUST enter with an alert and be mapped, and kept, before acceptance.

#### Scenario: Channel price
- GIVEN a dish at 30,000 in-house and 34,000 on a channel
- WHEN accepted from that channel
- THEN the order uses 34,000

#### Scenario: Unmapped item
- GIVEN an order with an unmapped item
- WHEN the cashier accepts
- THEN mapping is required first

### Requirement: Rider Handover

Handover MUST verify the platform order code and stamp pickup time.

#### Scenario: Match
- GIVEN ready order "R-1"
- WHEN the rider shows "R-1"
- THEN it is marked picked up

#### Scenario: Mismatch
- GIVEN ready order "R-1"
- WHEN the rider shows "R-2"
- THEN handover is blocked

### Requirement: Platform Cancellation

A cancellation MUST return stock if the kitchen had not started, or record waste with reason otherwise, and MUST be audited.

#### Scenario: Not started
- GIVEN an accepted order not started
- WHEN cancelled
- THEN stock is returned

#### Scenario: Started
- GIVEN an order in preparation
- WHEN cancelled
- THEN waste is recorded
