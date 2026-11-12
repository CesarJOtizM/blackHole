# Cash Register Specification

## Purpose

Collect accounts and close shifts blind (PRD-M2, TRD-M2). Bounded context: `cash-register`. Amounts are integer pesos.

## Requirements

### Requirement: Shift Opening

A shift MUST open with a float by denomination. A cash register MUST have at most one open shift.

#### Scenario: Open a shift
- GIVEN cash register C has no open shift
- WHEN cashier K declares a 200,000 float
- THEN a shift opens for K on C

#### Scenario: Second shift rejected
- GIVEN C has an open shift
- WHEN another cashier opens a shift on C
- THEN the request is rejected

### Requirement: Payments and Mixed Payments

The system MUST accept cash, card, transfer or wallet, voucher, and customer or corporate credit, alone or mixed, summing to the amount due; cash change SHALL be recorded. Card payments MUST record only terminal, approval number, brand and last 4 digits.

#### Scenario: Mixed payment with change
- GIVEN an account of 85,000
- WHEN card 50,000 and cash 40,000 are recorded
- THEN it is paid with 5,000 change

#### Scenario: Incomplete card data
- GIVEN a card payment without approval number
- WHEN the cashier submits it
- THEN the payment is rejected

### Requirement: Account Split

An account MAY be split by diner, by products or in equal parts. Parts MUST keep line origin and add up to the account total.

#### Scenario: Equal split with remainder
- GIVEN an account of 100,000 split in 3
- WHEN the split is created
- THEN parts are 33,334, 33,333 and 33,333 by a deterministic rule

#### Scenario: Partially paid split
- GIVEN a split account with one part paid
- WHEN viewed
- THEN it stays open until all parts are paid

### Requirement: Tip Capture

The tip MUST be asked on every payment, MAY be zero, and SHALL be recorded per payment and method, outside the sale.

#### Scenario: Tip recorded apart
- GIVEN an account of 100,000
- WHEN the customer adds a 10,000 tip by card
- THEN the sale stays 100,000 and the card tip is 10,000

#### Scenario: Tip declined
- GIVEN the customer declines
- WHEN payment is recorded
- THEN a zero tip is stored

### Requirement: Cash Movements

Cash in, cash out and withdrawals MUST carry amount and reason and MUST NOT be deleted.

#### Scenario: Withdrawal recorded
- GIVEN an open shift
- WHEN 300,000 is withdrawn with a reason
- THEN expected cash drops by 300,000

#### Scenario: Missing reason
- GIVEN an open shift
- WHEN a cash out has no reason
- THEN it is rejected

### Requirement: Blind Count and Terminal Reconciliation

Cashier and supervisor MUST count by denomination and method before any expected total is shown. Card totals MUST be compared per terminal with its closing report. A difference MUST need justification and another person's approval within cap.

#### Scenario: Difference needs approval
- GIVEN the count is 10,000 short
- WHEN the cashier closes the shift
- THEN closing waits for a justification and another person's approval

#### Scenario: Terminal mismatch
- GIVEN terminal T recorded 900,000 and its report says 880,000
- WHEN reconciliation runs
- THEN a 20,000 difference is shown for T

### Requirement: Partial and Immutable Final Close

A partial close MUST keep the shift open. A final close MUST make it immutable; corrections SHALL be new movements referencing the original.

#### Scenario: Partial close
- GIVEN an open shift
- WHEN a partial close is done
- THEN the shift keeps receiving payments

#### Scenario: Edit after close
- GIVEN a closed shift
- WHEN a payment is added or edited
- THEN the change is rejected

### Requirement: Sale Closure and Operating Mode

A fully paid account MUST hand the sale to invoicing once and set the table "to clean". During a cut the cash register MUST keep working in hybrid mode and SHALL stop in cloud mode.

#### Scenario: Paid during a cut (hybrid)
- GIVEN a hybrid site offline
- WHEN table 5 is fully paid
- THEN table 5 is to clean and one sale-closed event waits in the outbox

#### Scenario: Cut in cloud mode
- GIVEN a cloud-mode site offline
- WHEN the cashier tries to collect
- THEN the app shows it is unavailable

### Requirement: QR Payment Method in the Shift

A QR table payment applied to a shift MUST be recorded as its own payment method with its gateway reference and tip. It MUST NOT add to the expected cash. The blind cash count MUST present the QR total separately, compared against the gateway report rather than counted.

#### Scenario: Cash count with QR payments
- GIVEN a shift with 300,000 cash and 120,000 QR
- WHEN the cashier submits the blind count
- THEN expected cash is 300,000 and QR 120,000 is shown separately against the gateway report

#### Scenario: Closed shift
- GIVEN a closed shift
- WHEN a late QR payment is applied
- THEN it goes to the open shift of that register, never to the closed one

### Requirement: QR Payment Pending Application

If no shift is open at the site when a confirmed QR payment must be applied, the payment MUST remain pending, MUST NOT be lost, and the register MUST alert staff; it SHALL be applied to the next shift opened. Pending QR payments older than a configurable time MUST alert administrators.

#### Scenario: No open shift
- GIVEN a site with no open shift
- WHEN a confirmed QR payment arrives
- THEN it stays pending and staff are alerted

#### Scenario: Shift opens
- GIVEN a pending QR payment
- WHEN a cashier opens a shift
- THEN the payment is applied to that shift once
