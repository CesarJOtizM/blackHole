# Sensitive Actions Specification

## Purpose

Guard and report theft-prone operations (PRD-01 sec. 6-11, PRD-00 sec. 8.4). Contexts: `orders`, `cash-register`, via `platform`.

## Requirements

### Requirement: Blocked Without Authorization

A sensitive operation MUST change nothing unless the server, on node or cloud, permits it or receives a valid authorization.

#### Scenario: Direct call blocked
- GIVEN a waiter without discount permission
- WHEN she calls the API directly
- THEN it is denied; the account is unchanged

#### Scenario: Authorized by PIN
- GIVEN a courtesy needing authorization
- WHEN a supervisor enters her PIN and a reason
- THEN it applies and the audit records requester, authorizer, reason, value

### Requirement: Voids

A line void MUST record whether the kitchen had started. Before start a waiter MAY void within the shift cap; otherwise authorization MUST be required. Account voids follow PRD-01 sec. 6.1.

#### Scenario: Within waiter cap
- GIVEN a waiter with 2 of 3 allowed voids this shift
- WHEN she voids a sent line not yet started
- THEN the line leaves the account

#### Scenario: After kitchen started
- GIVEN a line in preparation
- WHEN the waiter voids it without authorization
- THEN the line stays

### Requirement: Discounts, Courtesies and Price Changes

Discounts MUST respect the role percentage cap; courtesies the per-shift value cap. A sale price change MUST require authorization and not alter the menu.

#### Scenario: Discount over cap
- GIVEN a cashier with a 5 % cap
- WHEN she applies 10 %
- THEN an authorization request is raised and the discount waits

#### Scenario: Price change
- GIVEN an authorized price change on a line
- WHEN applied
- THEN only that line changes; the site price stays

### Requirement: Edits After Pre-bill and Table Transfer

Editing an account after its pre-bill and transferring a table to another waiter MUST follow PRD-01 sec. 6.1 modes.

#### Scenario: Edit after pre-bill
- GIVEN a printed pre-bill
- WHEN a waiter adds a product without required authorization
- THEN the account is unchanged

#### Scenario: Supervisor transfers table
- GIVEN a supervisor allowed to transfer
- WHEN she moves table 5 to waiter W
- THEN W owns it; the change is audited

### Requirement: Reopen and Payment Method Change

Reopening a paid account or changing a payment method MUST require authorization and leave reversal movements, never editing a closed shift.

#### Scenario: Change payment method
- GIVEN an authorized change from cash to card
- WHEN applied
- THEN a reversal and a new payment link to the original

#### Scenario: Closed shift
- GIVEN the sale belongs to a closed shift
- WHEN the account is reopened with authorization
- THEN the correction lands in the open shift, not the closed one

### Requirement: Drawer Without Sale

Opening the drawer without a sale MUST require reason and authorization and MUST be audited.

#### Scenario: Authorized opening
- GIVEN a supervisor PIN and a reason
- WHEN the drawer is opened
- THEN it opens and the event is audited

#### Scenario: Unauthorized opening
- GIVEN no authorization
- WHEN the cashier requests an opening
- THEN no drawer command is sent

### Requirement: Control Reports

Reports MUST cover voids (user, authorizer, reason, moment), discounts and courtesies (user, authorizer, value), cash differences (cashier, shift), drawer openings without sale and accounts reopened or edited after pre-bill (user). Offline hybrid actions appear after sync.

#### Scenario: Authorized void listed
- GIVEN an authorized void after kitchen
- WHEN the void report is opened
- THEN it lists requester, authorizer, reason and "after kitchen"

#### Scenario: Offline action
- GIVEN a void on an offline hybrid node
- WHEN it reconnects
- THEN the void appears once in the cloud report

### Requirement: Unusual Behavior Alerts

The cloud MUST alert on many voids after kitchen in a shift (default over 5), many discounts by one user, a repeated requester-authorizer pair, any self-authorization and repeated failed PINs on a device, with configurable thresholds.

#### Scenario: Too many voids
- GIVEN 6 voids after kitchen by one user in a shift
- WHEN detectors run
- THEN the admin is alerted

#### Scenario: Self-authorization
- GIVEN self-authorization active for the shift
- WHEN a supervisor authorizes her own void
- THEN the void is marked and an alert is raised
