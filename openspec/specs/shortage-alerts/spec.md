# Shortage Alerts Specification

## Purpose

Warn before an ingredient or dish runs out and allow one-tap restocking (TRD-00 sec. 9.4).

## Requirements

### Requirement: Stock Levels

The system MUST store maximum ≥ reorder point ≥ minimum ≥ 0 per ingredient and location, in base units, MAY inherit them from a brand template, and SHALL let only roles permitted by PRD-01 sec. 6.3 change them.

#### Scenario: Location override
- GIVEN a brand reorder point of 10 kg for beef
- WHEN site A sets 15 kg
- THEN only site A evaluates 15 kg

#### Scenario: Inconsistent levels
- GIVEN a minimum of 8 kg
- WHEN someone sets the reorder point to 5 kg
- THEN the change is rejected

### Requirement: Level Evaluation

Every balance update MUST evaluate the changed ingredient in the same transaction: reorder point → yellow, minimum → red, ≤ 0 → critical. Crossing several levels at once SHALL open only the most severe.

#### Scenario: Yellow alert
- GIVEN beef at 16 kg with reorder point 15 kg
- WHEN a sale consumes 2 kg
- THEN a yellow alert opens

#### Scenario: Jump to critical
- GIVEN beef at 3 kg
- WHEN a 4 kg waste is recorded
- THEN one critical alert opens, not three

### Requirement: Coverage Alert

Every 15 minutes the owner MUST compute hourly use as the last-N-weeks average for that weekday and time slot, and alert when stock does not cover the rest of the service plus a margin, even above the minimum.

#### Scenario: Busy Friday
- GIVEN Friday pace covers 3 of the 5 remaining service hours
- WHEN coverage runs
- THEN a coverage alert states the hours left

#### Scenario: Insufficient history
- GIVEN less than N weeks of history
- WHEN coverage runs
- THEN no coverage alert opens

### Requirement: Dish Alert

A dish alert MUST open when producible point units fall below the product's site minimum, naming the limiting ingredient.

#### Scenario: Star dish
- GIVEN a dish minimum of 10 units
- WHEN producible units drop to 9
- THEN a dish alert opens

#### Scenario: No minimum configured
- GIVEN a dish without a minimum
- WHEN its units drop
- THEN no dish alert opens

### Requirement: Lifecycle And Hysteresis

An alert MUST go open → seen (who, when) → resolved, MUST NOT repeat while open, and SHALL auto-resolve only above the reorder point. Manual resolution needs a reason. Transitions MUST be audited.

#### Scenario: No flapping
- GIVEN an open red beef alert
- WHEN beef rises just above the minimum
- THEN the alert stays open

#### Scenario: Auto-resolution
- GIVEN the same alert
- WHEN beef rises above the reorder point
- THEN it resolves automatically

### Requirement: Notification And Escalation

Rules per site and alert type MUST define target roles. Cash register and kitchen screens SHALL get alerts in real time; phones get push online. A red alert unseen within the site's time MUST escalate kitchen chief → administrator → manager. Hybrid: the node notifies screens offline; push and manager escalation wait for reconnection. Cloud mode: an outage stops the site.

#### Scenario: Offline hybrid site
- GIVEN a hybrid site without internet
- WHEN a red alert opens
- THEN kitchen and cash register screens show it at once

#### Scenario: Escalation
- GIVEN a red alert unseen past the 20-minute limit
- WHEN the limit expires
- THEN the administrator is notified and it is audited

### Requirement: One-Tap Action

A permitted user MUST create in one tap a restock request (point alert) or purchase order (warehouse alert) for maximum − stock, rounded up to the purchase unit, linked to the alert and audited.

#### Scenario: Restock from point
- GIVEN beef at 4 kg, maximum 20 kg, purchase unit 1 kg
- WHEN the kitchen chief taps restock
- THEN a 16 kg request goes to the supplying warehouse

#### Scenario: No supplying warehouse
- GIVEN a point without a supplying warehouse
- WHEN restock is tapped
- THEN it is rejected and a purchase order is offered

### Requirement: Suggested Levels

A cloud worker MUST propose reorder point and maximum from consumption and supplier lead time; active levels change only when the administrator accepts or adjusts.

#### Scenario: Accepted proposal
- GIVEN a beef proposal
- WHEN the administrator accepts it
- THEN it becomes active on the owning node

#### Scenario: Pending proposal
- GIVEN an unaccepted proposal
- WHEN evaluation runs
- THEN active levels are used
