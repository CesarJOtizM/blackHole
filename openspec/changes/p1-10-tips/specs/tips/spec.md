# Tips Specification

## Purpose

Distribute each site's common tip pool among those who worked in a period, by a configurable rule, in an immutable, printable settlement (PRD-M2, TRD-00 6.3). Tips are never sale income or salary.

## Requirements

### Requirement: Distribution Rule

Each site SHALL have one active rule with a period (shift, day or week) and a mode: equal, percentage per person, or by hours worked. Percentages MUST sum to exactly 100 %. Changes MUST require permission and be audited.

#### Scenario: Valid percentage rule
- GIVEN an administrator of the site
- WHEN they set waiters 70 % and kitchen 30 %
- THEN the rule is saved and the change is audited

#### Scenario: Percentages not summing 100
- GIVEN a percentage rule of 60 % and 30 %
- WHEN it is saved
- THEN it is rejected

### Requirement: Common Pool

The pool of a period MUST equal the sum of tips recorded on payments of that site in the period, across all payment methods, and MUST exclude sale amounts and taxes.

#### Scenario: Mixed methods
- GIVEN tips of 20,000 in cash and 30,000 by card in a day
- WHEN the daily pool is computed
- THEN the pool is 50,000, itemized by method

#### Scenario: Empty period
- GIVEN no tips in the period
- WHEN settlement is attempted
- THEN a zero settlement is produced with no shares

### Requirement: Participants From Attendance

Participants MUST default to the users with clock events in the period, with their projected hours. An administrator MAY add or remove participants, each change with a mandatory reason stored in the settlement.

#### Scenario: Default participants
- GIVEN four workers clocked in during the shift
- WHEN settlement starts
- THEN those four are proposed with their hours

#### Scenario: Removal without reason
- GIVEN a proposed participant
- WHEN the administrator removes them without a reason
- THEN the change is rejected

### Requirement: Deterministic Calculation

Shares MUST be integer pesos: equal, by rule percentage, or proportional to hours. Rounding leftovers MUST follow a deterministic order, and shares plus any shown residue MUST equal the pool.

#### Scenario: Uneven split
- GIVEN a pool of 100,000 and three participants in equal mode
- WHEN shares are computed
- THEN the shares add up to 100,000 and repeating the run gives identical shares

#### Scenario: Hours mode with zero hours
- GIVEN a participant added manually with zero hours in hours mode
- WHEN shares are computed
- THEN that participant receives zero and the total still equals the pool

### Requirement: Immutable Settlement

A closed settlement MUST store pool, participants, shares and a rule snapshot. It MUST NOT be edited; corrections MUST be adjustment settlements referencing it.

#### Scenario: Rule changed later
- GIVEN a closed weekly settlement
- WHEN the rule changes the next day
- THEN the closed settlement still shows the original rule and shares

#### Scenario: Attempt to edit
- GIVEN a closed settlement
- WHEN someone tries to change a share
- THEN it is rejected and only an adjustment settlement is offered

### Requirement: Printable Settlement

The system SHALL print a settlement with period, pool by payment method, rule, each person's share and a signature line per person, on 80 mm and 58 mm printers.

#### Scenario: Print for signatures
- GIVEN a closed settlement
- WHEN the administrator prints it
- THEN each participant appears with share and signature line

#### Scenario: Printer unavailable
- GIVEN the main printer is offline
- WHEN printing is requested
- THEN the job goes to the backup printer or stays queued and the screen warns

### Requirement: Settlement Location and Outages

Settlement SHALL run on the operation owner. In hybrid mode it MUST work offline with local clock events and print on site. In cloud mode it is unavailable during an outage.

#### Scenario: Hybrid outage
- GIVEN a hybrid site without internet
- WHEN the administrator settles the shift
- THEN the settlement closes and prints on site and reaches the cloud after reconnection

#### Scenario: Cloud outage
- GIVEN a cloud-mode site without internet
- WHEN settlement is attempted
- THEN it is unavailable until the link returns
