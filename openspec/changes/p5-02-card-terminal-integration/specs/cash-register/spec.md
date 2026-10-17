# Delta for Cash Register

## ADDED Requirements

### Requirement: Card Payment Origin

Every card payment MUST record its origin: integrated or manual. On an integrated terminal, manual entry MUST require a reason and the manual-entry permission, and MUST be audited. The rule SHALL behave identically on local-node (hybrid) and api-cloud (cloud mode); a hybrid node records the origin locally and syncs it with the payment.

#### Scenario: Integrated payment

- GIVEN an approval returned by an integrated terminal
- WHEN the payment is recorded
- THEN its origin is integrated

#### Scenario: Manual entry on integrated terminal

- GIVEN an integrated terminal at the site
- WHEN a cashier without the permission enters a card approval manually
- THEN entry is rejected
- AND with supervisor authorization it is recorded as manual with reason and audited

### Requirement: Card Count per Terminal with Integrated Records

The blind cash count MUST compare, per terminal, the sum of integrated and manual card payments against the terminal's closing report, and MUST show the integrated and manual subtotals separately after the count is submitted.

#### Scenario: Totals match

- GIVEN integrated payments of 1,200,000 COP and manual of 50,000 COP on terminal A
- WHEN the terminal close report shows 1,250,000 COP
- THEN no difference is reported for terminal A

#### Scenario: Difference requires authorization

- GIVEN the terminal report shows 1,230,000 COP
- WHEN the count is submitted
- THEN a 20,000 COP difference is reported
- AND closing the shift requires another person's approval

### Requirement: Uncertain Card Payments Block Shift Close

A shift MUST NOT close while it has card payments in uncertain status.

#### Scenario: Uncertain pending

- GIVEN a shift with one uncertain terminal payment
- WHEN the cashier tries to close the shift
- THEN closing is blocked until it is resolved

#### Scenario: Resolved

- GIVEN the uncertain payment resolved as declined
- WHEN the cashier closes the shift
- THEN the shift closes without that payment
