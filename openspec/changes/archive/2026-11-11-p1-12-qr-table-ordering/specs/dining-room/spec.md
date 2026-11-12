# Delta for Dining Room

## ADDED Requirements

### Requirement: QR Table Channel Visibility

Lines, accounts and kitchen tickets originating from a QR table order MUST display the "QR table" channel to waiters, kitchen and cash register. Staff SHALL be able to void, transfer or move those lines with the same permissions as any other line.

#### Scenario: Waiter sees a QR order
- GIVEN a QR order applied to table 4
- WHEN the waiter opens the table
- THEN the new lines show the "QR table" badge

#### Scenario: Staff voids a QR line
- GIVEN a QR line already in preparation
- WHEN a waiter voids it
- THEN supervisor authorization is required as for any line

### Requirement: Pending QR Intent Alert

The system SHALL alert site staff and administrators when QR order intents remain unapplied longer than a configurable time per site.

#### Scenario: Long outage
- GIVEN a hybrid site offline for 20 minutes with a 15-minute threshold
- WHEN QR intents are still queued in the cloud
- THEN administrators see an alert with the count and age

#### Scenario: Below threshold
- GIVEN intents queued for 2 minutes
- WHEN the threshold is 15 minutes
- THEN no alert is raised
