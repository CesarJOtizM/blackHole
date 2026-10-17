# Delta for Cash Register

## ADDED Requirements

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
