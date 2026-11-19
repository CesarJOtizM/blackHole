# Dish Withdrawal Specification

## Purpose

Stop a dish that will not come out this service, after a person confirms (PRD-M4 HU-M4-05).

## Requirements

### Requirement: System Proposal

The system MUST propose "not restocked today" only when the point cannot cover one more portion, supplying warehouses cannot either (last synced value if owned by another node), and no transfer to the site is dispatched or in transit. A proposal alone MUST NOT change the menu or any line.

#### Scenario: Proposal raised
- GIVEN no ribs portion at the point or supplying warehouses, and no transfer on the way
- WHEN availability is evaluated
- THEN kitchen chief and site administrator see a proposal

#### Scenario: Transfer on the way
- GIVEN the same stock but a transfer with ribs in transit
- WHEN availability is evaluated
- THEN no proposal is raised

### Requirement: Human Confirmation

Only a kitchen chief or site administrator MUST be able to confirm or remove the mark. Without an identified person no availability change MUST be emitted. Confirmation and removal MUST be audited.

#### Scenario: Kitchen chief confirms
- GIVEN a pending proposal for ribs
- WHEN the kitchen chief confirms with PIN
- THEN ribs are marked and the confirmation is audited

#### Scenario: Waiter cannot confirm
- GIVEN a waiter session
- WHEN the waiter tries to confirm
- THEN it is rejected and nothing changes

### Requirement: Menu Block

While marked, the product MUST show sold out and MUST NOT be sent to the kitchen from waiter devices or QR orders, until end of service or removal. Other bill products MUST NOT be affected.

#### Scenario: Send attempt
- GIVEN ribs are marked
- WHEN a waiter tries to send ribs
- THEN the line is rejected with a not-restocked message

#### Scenario: QR order queued during an outage
- GIVEN a QR order with ribs waiting in the cloud while a hybrid site is offline
- WHEN the site reconnects
- THEN the ribs line is rejected and the rest proceeds

### Requirement: Queue Withdrawal

On confirmation, unstarted sent lines of that product that remaining stock cannot cover MUST leave the queue, MUST NOT be charged, and their consumption MUST be returned. Lines in preparation, ready or delivered SHALL continue.

#### Scenario: Unstarted line withdrawn
- GIVEN table 4 has ribs sent and not started
- WHEN the mark is confirmed
- THEN the line leaves the queue, is not charged and its ingredients return

#### Scenario: Started line kept
- GIVEN table 7 has ribs in preparation
- WHEN the mark is confirmed
- THEN that line stays in the queue

### Requirement: Kitchen Cannot Finish

A station MUST be able to mark a started line as not deliverable, recorded as waste with reason and notifying the waiter.

#### Scenario: Station marks started line
- GIVEN ribs in preparation for table 7
- WHEN the cook marks it cannot be finished
- THEN waste is recorded and table 7's waiter is notified

#### Scenario: Delivered line
- GIVEN ribs delivered to table 9
- WHEN the station tries to mark that line
- THEN it is rejected and no waste is recorded

### Requirement: Instant Waiter Notice

The waiter of each affected table MUST get the notice through the "order ready" channel (sound and screen) within 2 s (p90). Hybrid: it MUST work offline via the node. Cloud mode: it runs in the cloud; an outage stops the site.

#### Scenario: Offline notice
- GIVEN a hybrid site without internet
- WHEN the mark withdraws a line of table 4
- THEN its waiter gets sound and screen notice within 2 s

#### Scenario: Line in preparation
- GIVEN only lines already in preparation exist
- WHEN the mark is confirmed
- THEN no waiter notice is sent

### Requirement: Customer Notified

Each withdrawn line MUST stay pending until the waiter confirms "customer notified". The audit MUST record who confirmed the mark, which tables it hit and who notified.

#### Scenario: Confirmation recorded
- GIVEN the waiter informs the customer
- WHEN "customer notified" is tapped
- THEN the audit links waiter, table and mark

#### Scenario: Confirmation pending
- GIVEN a withdrawn line on table 4 not yet confirmed
- WHEN the waiter opens the device
- THEN the notice is still shown
