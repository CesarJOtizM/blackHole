# Delta for Reservation Payments

## ADDED Requirements

### Requirement: Collection Method per Site

Each site MUST choose manual verification, gateway, or both. With the gateway, the customer MUST be able to pay from the public booking link or a staff-sent payment link.

#### Scenario: Gateway enabled

- GIVEN a site with the gateway enabled and a 50,000 COP deposit rule
- WHEN a customer books through the public link
- THEN they are offered online payment of 50,000 COP

#### Scenario: Gateway disabled

- GIVEN a site with only manual verification
- WHEN a customer books
- THEN the transfer instructions are shown and no online payment is offered

### Requirement: Amount Fixed by the Reservation

The charged amount MUST be computed by the cloud from the reservation's copied charge rule (fixed, per person or percentage of minimum spend). The customer MUST NOT be able to set or alter it.

#### Scenario: Per-person deposit

- GIVEN a rule of 20,000 COP per person and a party of 4
- WHEN the payment link is created
- THEN the amount is 80,000 COP

#### Scenario: Tampered amount

- GIVEN a payment request altered to 10,000 COP
- WHEN the gateway notification reports 10,000 COP paid
- THEN the reservation is not confirmed and the mismatch is flagged

### Requirement: Automatic Confirmation

A reservation MUST be confirmed automatically only on a validly signed gateway notification with matching reference and full amount, idempotent per gateway reference, and audited.

#### Scenario: Valid notification

- GIVEN a reservation pending payment
- WHEN a signed notification of full payment arrives
- THEN the charge is verified and the reservation confirmed
- AND no staff verification is required

#### Scenario: Duplicate notification

- GIVEN a reservation already confirmed by notification R1
- WHEN notification R1 arrives again
- THEN no second charge or deposit is recorded

#### Scenario: Invalid signature

- GIVEN a notification with an invalid signature
- WHEN it is received
- THEN it is rejected and the reservation stays pending

### Requirement: Payment Link Expiry

A gateway payment link MUST expire at the site's configured hold time and release the held slot. A payment confirmed after expiry MUST confirm the reservation if the slot is still available; otherwise it MUST be refunded in full.

#### Scenario: Link expires unpaid

- GIVEN a link with a 30-minute hold
- WHEN 30 minutes pass without payment
- THEN the slot is released

#### Scenario: Late payment, slot taken

- GIVEN an expired link whose slot was taken
- WHEN its payment is confirmed
- THEN a full refund is requested and the customer is not confirmed

### Requirement: Gateway Refunds

Refunds of gateway-paid reservations MUST follow the copied policy, go through the gateway when it supports refunds (otherwise a manual transfer with receipt), and require the approve-refund permission.

#### Scenario: Cancellation 30 hours ahead

- GIVEN a copied policy of 100% refund over 24 hours
- WHEN the customer cancels 30 hours ahead
- THEN a full refund is issued through the gateway

#### Scenario: Gateway refund fails

- GIVEN the gateway rejects the refund
- WHEN it is retried and fails
- THEN the refund stays pending for manual transfer

### Requirement: Cloud Ownership and Outage Behavior

Gateway charges and confirmations MUST be owned by api-cloud (PostgreSQL). A hybrid node (SQLite) MUST receive confirmed reservations through the day's sync and MUST NOT apply a deposit whose confirmation has not reached it. Cloud-mode sites read it directly.

#### Scenario: Paid during node outage

- GIVEN a hybrid site without internet
- WHEN a customer pays a reservation online
- THEN the cloud confirms it
- AND the node receives it on reconnect

#### Scenario: Deposit not yet synced

- GIVEN the confirmation has not reached the node
- WHEN the cashier closes that customer's bill
- THEN no deposit is applied

### Requirement: Gateway Reconciliation

The system MUST report, per site and period, gateway charges, refunds and commissions, and compare them against the gateway settlement report.

#### Scenario: Settlement matches

- GIVEN 10 charges in March
- WHEN the gateway settlement lists the same 10
- THEN no difference is reported

#### Scenario: Missing settlement

- GIVEN a confirmed charge absent from the settlement
- WHEN reconciliation runs
- THEN it is flagged as a difference
