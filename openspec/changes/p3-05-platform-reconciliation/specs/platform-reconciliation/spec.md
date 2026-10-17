# Platform Reconciliation Specification

## Purpose

Compare what each platform should pay with what it paid, and expose net sales and profitability per channel (PRD-M5 sec. 4–5, TRD-M5 sec. 2 and 4). Runs only in the cloud; site operation, hybrid or not, is unaffected by internet cuts.

## Requirements

### Requirement: Channel Commission

An admin MUST configure per channel a commission percentage and fixed fees with a validity start. Each accepted order MUST store the commission in force at acceptance; later changes MUST NOT alter it.

#### Scenario: Commission snapshot
- GIVEN Rappi at 20% accepted an order of 50,000
- WHEN the commission changes to 22%
- THEN that order still expects 10,000 commission

#### Scenario: No commission configured
- GIVEN a channel without commission
- WHEN an order is accepted
- THEN the order is flagged "commission missing" for reconciliation

### Requirement: Platform Receivable

Each accepted platform order MUST add a receivable for that platform and period, never cash. Orders synced late from a hybrid node MUST land in their original period.

#### Scenario: Receivable recorded
- GIVEN an accepted DiDi order
- WHEN the period is listed
- THEN the order appears as receivable from DiDi

#### Scenario: Late sync
- GIVEN an order accepted offline on Monday and synced Tuesday
- WHEN Monday's receivables are listed
- THEN the order is included once

### Requirement: Settlement Import

The admin MUST import a settlement by file, or the system MAY fetch it by API when the connector supports it. A settlement MUST be unique per channel and period, and its source file MUST be kept.

#### Scenario: File import
- GIVEN a Rappi settlement file for a week
- WHEN imported
- THEN lines are matched to orders and the file is stored

#### Scenario: Re-import
- GIVEN that week already imported
- WHEN the same period is imported again
- THEN no duplicate settlement is created and the admin is told

### Requirement: Differences Flagged

The system MUST compute expected payout as sales minus commission and fees, compare per order and in total, flag every difference and alert the admin. Unmatched lines and orders MUST be flagged, not dropped.

#### Scenario: Shortfall
- GIVEN expected 40,000 and settled 37,000 for an order
- WHEN compared
- THEN a 3,000 difference is flagged and alerted

#### Scenario: Unknown line
- GIVEN a settlement line with no matching order
- WHEN compared
- THEN it is flagged as unmatched

### Requirement: Immutable Reconciliation

Differences MUST NOT be edited; they MAY be marked with an explanation. Closing a reconciliation MUST be audited, and a closed reconciliation MUST NOT change.

#### Scenario: Close
- GIVEN all differences marked
- WHEN the admin closes
- THEN an audit event stores who, when and the file reference

#### Scenario: Edit after close
- GIVEN a closed reconciliation
- WHEN someone tries to change a mark
- THEN it is rejected

### Requirement: Cancellations in Settlement

A platform cancellation recorded as waste MUST appear with its waste cost; any payment or charge the platform settles for it MUST be compared like any order.

#### Scenario: Paid cancellation
- GIVEN an order cancelled after kitchen start that the platform still pays
- WHEN compared
- THEN the payment is matched and the waste cost is shown beside it

#### Scenario: Unpaid cancellation
- GIVEN the platform charges a fee for a cancelled order
- WHEN compared
- THEN the fee is flagged as a difference

### Requirement: Channel Profitability

The system MUST show net sales per channel (sales minus commission and fees) next to theoretical dish cost.

#### Scenario: Net vs cost
- GIVEN channel sales 1,000,000, fees 220,000 and theoretical cost 300,000
- WHEN profitability is viewed
- THEN net sales are 780,000 and margin after cost is 480,000

#### Scenario: Missing cost
- GIVEN dishes without recipe cost
- WHEN profitability is viewed
- THEN margin is shown as unavailable, not zero
