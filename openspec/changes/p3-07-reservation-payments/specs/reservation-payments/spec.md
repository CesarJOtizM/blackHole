# Reservation Payments Specification

## Purpose

Charge for reservations by verified transfer, credit deposits and refund by tiers (PRD-M9, TRD-00 sec. 6.2, TRD-M9, ADR-012).

## Requirements

### Requirement: Charge Policy

Each site MUST define rules by slot and party size: none, deposit (credited) or fee (not credited), valued fixed, per person or as a percentage of minimum spend, plus refund tiers (minimum hours ahead, 0–100%).

#### Scenario: Per-person deposit
- GIVEN Friday night at 20,000 per person
- WHEN 5 people reserve
- THEN it is pending payment for 100,000

#### Scenario: Free slot
- GIVEN a slot without charge
- WHEN reserved
- THEN it is confirmed

### Requirement: Policy Snapshot

The policy in force MUST be copied into the reservation; refunds MUST use the copy.

#### Scenario: Policy changed later
- GIVEN a reservation made under ">24 h = 100%"
- WHEN the site changes to ">48 h = 100%"
- THEN cancelling 30 h ahead refunds 100%

#### Scenario: No policy
- GIVEN a site without policy
- WHEN reserved
- THEN no charge applies

### Requirement: Payment Message

The system MUST build a message with amount, site collection accounts (Nequi, Daviplata, Bre-B key or QR) and reservation reference, also on a hybrid node offline.

#### Scenario: Built
- GIVEN a pending reservation
- WHEN staff request the message
- THEN it has amount, accounts and reference

#### Scenario: No account
- GIVEN a site without accounts
- WHEN a charged reservation is created
- THEN staff are told to configure one

### Requirement: Human Verification

Payment states MUST be pending, receipt received, verified, rejected. Only a person with the verify permission (PRD-01 sec. 6.4) MUST verify, after checking the account; a receipt alone MUST NOT confirm. Verifier, time and transaction number MUST be audited.

#### Scenario: Verified
- GIVEN a receipt attached
- WHEN a permitted cashier verifies with the transaction number
- THEN the reservation is confirmed

#### Scenario: No permission
- GIVEN a waiter
- WHEN they verify
- THEN the payment stays "receipt received"

#### Scenario: Rejected
- GIVEN money not in the account
- WHEN staff reject the receipt
- THEN the rejection is audited

### Requirement: Unique Transaction Number

A transaction number MUST be unique per collection account; reuse MUST be blocked and alerted.

#### Scenario: Reuse
- GIVEN "123" verified a reservation
- WHEN used again on the same account
- THEN it is blocked and alerted

#### Scenario: Other account
- GIVEN "123" used on Nequi
- WHEN used on Daviplata
- THEN it is accepted

### Requirement: Pending Expiry

An unverified pending reservation MUST be released after the site deadline.

#### Scenario: Expired
- GIVEN the deadline passed unverified
- WHEN expiry runs
- THEN it is cancelled and capacity released

#### Scenario: Verified in time
- GIVEN verification before the deadline
- WHEN expiry runs
- THEN it stays confirmed

### Requirement: Offline Verification

A hybrid node MUST record verifications offline; the cloud MUST apply them only if the payment is still pending.

#### Scenario: Still pending
- GIVEN pending in the cloud
- WHEN the node's verification syncs
- THEN the reservation is confirmed

#### Scenario: Already verified
- GIVEN verified in the cloud during the cut
- WHEN the node's verification syncs
- THEN nothing is duplicated

### Requirement: Deposit on the Check

A verified deposit MUST be applied once as "reservation deposit", MUST NOT enter the cash count and MUST appear on the invoice as prepayment. A fee MUST NOT be credited. Without the synced verification the node MUST NOT apply it.

#### Scenario: Credited
- GIVEN a 100,000 deposit and a 250,000 check
- WHEN collected
- THEN 150,000 remains, outside cash for the deposit

#### Scenario: Retry
- GIVEN a deposit applied
- WHEN applied again
- THEN nothing is credited

### Requirement: Tiered Refunds

On cancellation or no-show, the copied tier MUST set the refund percentage. A refund MUST need approval permission and a transfer receipt, and MUST reference, not edit, the payment.

#### Scenario: Partial
- GIVEN tiers ">24 h 100%, 12–24 h 50%"
- WHEN cancelled 15 h ahead
- THEN 50% is refunded after approval with receipt

#### Scenario: No-show
- GIVEN "no-show 0%"
- WHEN no-show is marked
- THEN the payment is retained and audited
