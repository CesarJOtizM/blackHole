# QR Table Payment Specification

## Purpose

Let a customer pay the table balance and an optional tip from the cloud portal, for the exact amount, through a gateway. A payment exists only after signed confirmation, and is applied once, invoiced and reconciled (PRD-00 6.1.3, TRD-00 6.4, TRD-M2).

## Requirements

### Requirement: Balance and Tip

From the table or pre-bill QR, the portal SHALL show the balance and offer a voluntary tip, separate from the sale. Split account parts MUST be payable separately.

#### Scenario: View balance
- GIVEN table 2 with an open account of 85,000
- WHEN the customer opens the portal from the table QR
- THEN it shows 85,000 and tip options including no tip

#### Scenario: Split account
- GIVEN an account split into two parts
- WHEN one customer pays part 1
- THEN part 2 remains payable with its own balance

### Requirement: Exact-Amount Charge

The cloud MUST compute the charge as balance plus tip, never accepting a customer-sent amount. Each charge MUST carry a unique reference bound to its account or part.

#### Scenario: Charge started
- GIVEN a balance of 85,000 and a tip of 8,500
- WHEN the customer pays
- THEN the gateway is asked for 93,500 with a new unique reference

#### Scenario: Tampered amount
- GIVEN a request that includes an amount of 10,000
- WHEN it reaches the cloud
- THEN the amount is ignored and the server-computed amount is used

### Requirement: Gateway Confirmation

A payment MUST exist only after a validly signed gateway webhook confirms it. An invalid signature or a repeated confirmation for the same reference MUST NOT create a payment.

#### Scenario: Confirmed once
- GIVEN a started charge
- WHEN the gateway sends the confirmation twice
- THEN exactly one confirmed payment exists

#### Scenario: Invalid signature
- GIVEN a webhook with a forged signature
- WHEN it is received
- THEN it is rejected and no payment exists

### Requirement: Payment Application

The operation owner (the node in hybrid mode, the cloud in cloud mode) SHALL apply each confirmed payment exactly once: record it in the open shift, request the invoice with portal billing data if any (pending if the provider is unreachable), and set the table "to clean" at zero balance.

#### Scenario: Online site
- GIVEN a connected hybrid site
- WHEN a payment is confirmed
- THEN the node records it, the invoice prints and the table becomes "to clean"

#### Scenario: Partial payment
- GIVEN a split account with one part paid by QR
- WHEN the payment is applied
- THEN the table stays occupied until the other part is paid

### Requirement: Payment During an Outage

With the site offline, the customer MUST still be able to pay. The confirmed payment MUST wait in the cloud and apply once on reconnection, printing the invoice and freeing the table, in hybrid and cloud mode alike.

#### Scenario: Paid during outage
- GIVEN a hybrid site without internet
- WHEN a customer pays and the gateway confirms
- THEN on reconnection the payment is applied once, the invoice prints and the table is freed

#### Scenario: Batch delivered twice
- GIVEN the confirmed payment is delivered twice after reconnection
- WHEN the node applies it
- THEN the shift holds a single payment

### Requirement: Coexistence With Register Payments

QR and register payments MAY coexist on a split account; the remaining balance shown to cashier and portal MUST reflect QR payments.

#### Scenario: Mixed payment
- GIVEN a split account where part 1 was paid by QR
- WHEN the cashier opens the account
- THEN only part 2 remains to collect

#### Scenario: Balance changed after charge started
- GIVEN a line added after the charge started
- WHEN the payment is applied
- THEN the account shows the remaining balance

### Requirement: Gateway Reconciliation

Confirmed QR payments SHALL be reconciled per shift and day against the gateway report, flagging each difference by reference.

#### Scenario: Matching report
- GIVEN payments matching the gateway report
- WHEN reconciliation runs
- THEN no difference appears

#### Scenario: Missing in report
- GIVEN a payment missing from the gateway report
- WHEN reconciliation runs
- THEN it is flagged
