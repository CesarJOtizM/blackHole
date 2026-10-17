# Waste and Counts Specification

## Purpose

Record waste with reason and reconcile physical counts against theoretical stock through adjustment movements (PRD-00 M4, PRD-01 sec. 6.3 and 7, PRD-M4 rule 4, TRD-M4 sec. 2, 4, 8).

## Requirements

### Requirement: Waste with Reason

A waste record MUST state location, ingredient or preparation, quantity and reason (expired, damaged, preparation error, or other with note). It MUST be an audited waste movement valued at average cost that does not change average cost.

#### Scenario: Expired milk
- GIVEN milk at average 4 COP/ml
- WHEN the kitchen chief records 1000 ml as "expired"
- THEN −1000 ml valued 4000 COP is recorded with reason and user

#### Scenario: Missing reason
- GIVEN a waste entry without reason
- WHEN submitted
- THEN it is rejected

### Requirement: Waste Cap

Roles with limited waste permission MUST be capped by value per record (default kitchen chief 30,000 COP, lowerable per site). Above it, supervisor authorization MUST be required, never from oneself.

#### Scenario: Within cap
- GIVEN a 30,000 COP cap
- WHEN the kitchen chief records 12,000 COP
- THEN it is recorded without authorization

#### Scenario: Above cap
- GIVEN the same cap
- WHEN 45,000 COP is recorded
- THEN nothing is stored until a supervisor authorizes

### Requirement: Physical Count

Holders of "physical count" MUST open a count at a location, full or by categories, with a cut-off time. Quantities MAY use any configured unit and MUST be stored in base unit.

#### Scenario: Category count
- GIVEN a "dairy" count
- WHEN quantities are entered
- THEN only dairy ingredients are compared

#### Scenario: Uncounted item
- GIVEN a full count missing one ingredient
- WHEN submitted
- THEN it is rejected listing that ingredient

### Requirement: Variance Against Theoretical

Each counted quantity MUST be compared with the theoretical balance at cut-off, in quantity and value. Movements after cut-off MUST NOT alter the variance.

#### Scenario: Shortage
- GIVEN theoretical beef 8000 g at cut-off and 7400 g counted
- WHEN submitted
- THEN a −600 g variance with value is shown

#### Scenario: Sale during count
- GIVEN 200 g beef sold after cut-off
- WHEN variance is computed
- THEN it uses the cut-off balance and the sale stays in the ledger

### Requirement: Approval and Adjustment

A count adjustment at or under the cap MUST be recorded without extra approval, one movement per ingredient with variance. An adjustment whose absolute value is above the cap MUST wait for approval from a role allowed to approve count results (D-28). The cap MUST default to 1,000 COP, MUST be set per company and MUST be lowerable per site. Rejection MUST leave stock unchanged. Self-approval MUST be denied unless self-authorization is enabled for the shift. All MUST be audited.

#### Scenario: Within cap
- GIVEN a −600 g variance valued at 900 COP and a 1,000 COP cap
- WHEN the count is submitted
- THEN a −600 g adjustment is recorded without extra approval

#### Scenario: Above cap
- GIVEN a variance valued at 1,500 COP and a 1,000 COP cap
- WHEN submitted without approval
- THEN no adjustment is recorded

#### Scenario: Above cap approved
- GIVEN the same 1,500 COP variance
- WHEN a role allowed to approve count results approves it
- THEN the adjustment is recorded

#### Scenario: Rejected
- GIVEN a count above the cap waiting for approval
- WHEN rejected
- THEN no movement is recorded and a recount may open

#### Scenario: Self-approval
- GIVEN the counter is also the only approver
- WHEN they approve without shift self-authorization
- THEN approval is denied

### Requirement: Operation by Mode

Hybrid nodes MUST support waste, counts and approvals with supervisor PIN during an outage. Cloud-mode sites MUST run them in the cloud, unavailable offline.

#### Scenario: Offline hybrid count
- GIVEN an offline hybrid node
- WHEN a count is approved
- THEN adjustments are stored locally and synced on reconnect

#### Scenario: Cloud-mode outage
- GIVEN a cloud-mode site offline
- WHEN waste is recorded
- THEN it cannot be stored until reconnect
