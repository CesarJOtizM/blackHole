# Card Terminal Integration Specification

## Purpose

Send the payment amount from the cash register to the site's card terminal (Credibanco, Bold or Redeban, as each provider allows per ADR-007) and record the approval automatically. The payment belongs to the operation owner: local-node (SQLite) in hybrid mode, api-cloud (PostgreSQL) in cloud mode. No full card data is ever received or stored.

## Requirements

### Requirement: Amount Sent from the Bill

When a site's terminal is integrated, the amount MUST come from the bill balance (or the split part) chosen by the cashier, and the cashier MUST NOT type it into the terminal. Tip, if any, MUST travel as a separate amount when the provider supports it.

#### Scenario: Amount pushed to terminal

- GIVEN a bill balance of 85,000 COP and an integrated Bold terminal
- WHEN the cashier selects card payment
- THEN the terminal shows 85,000 COP to the customer

#### Scenario: Amount above balance rejected

- GIVEN a bill balance of 85,000 COP
- WHEN a request for 90,000 COP is attempted
- THEN it is rejected before reaching the terminal

### Requirement: Approval Returned Automatically

An approved transaction MUST record terminal, approval number, franchise and last 4 digits from the terminal response, with no manual entry. A declined transaction MUST NOT create a payment.

#### Scenario: Approved

- GIVEN a transaction sent to the terminal
- WHEN the terminal approves it
- THEN a card payment is recorded with approval, franchise and last 4 digits

#### Scenario: Declined

- GIVEN a transaction sent to the terminal
- WHEN the terminal declines it
- THEN no payment is recorded and the bill keeps its balance

### Requirement: No Double Charge on Uncertain Result

Each request MUST carry a unique reference. If no response arrives, the payment MUST be uncertain and its status MUST be queried by reference before any retry. An approved uncertain request MUST be recorded once.

#### Scenario: Timeout then approved

- GIVEN a request whose response was lost
- WHEN the status query reports it approved
- THEN one payment is recorded
- AND no second request is sent

#### Scenario: Status unknown

- GIVEN the status query cannot reach the provider
- WHEN the cashier retries
- THEN the retry is blocked until status is resolved or a supervisor authorizes manual entry

### Requirement: Provider Capability per ADR-007

The system MUST enable integration only for providers whose adapter exists and is configured for that terminal; other terminals MUST stay on manual entry.

#### Scenario: Unsupported provider

- GIVEN a Redeban terminal with no integration offered
- WHEN the cashier charges by card
- THEN manual entry of approval data is used

#### Scenario: Integrated provider

- GIVEN a Credibanco terminal with its adapter configured
- WHEN the cashier charges by card
- THEN the integrated flow is used

### Requirement: Behavior During Internet Outage

In hybrid mode, terminals integrated over the local network MUST keep working without internet; terminals integrated through a provider cloud API MUST fall back to manual entry with reason. In cloud mode, card charging stops with the cash register.

#### Scenario: Local integration offline

- GIVEN a hybrid site without internet and a LAN-integrated terminal
- WHEN the cashier charges by card
- THEN the integrated flow completes on the node

#### Scenario: Cloud-API integration offline

- GIVEN a hybrid site without internet and a cloud-API terminal
- WHEN the cashier charges by card
- THEN manual entry is offered with the reason "no link"

### Requirement: No Sensitive Card Data

The system MUST NOT receive, log or store full card numbers, expiry dates or security codes.

#### Scenario: Provider response with extra data

- GIVEN a provider response including a masked PAN
- WHEN it is recorded
- THEN only the last 4 digits are kept

#### Scenario: Logs

- GIVEN an integrated payment
- WHEN its trace is logged
- THEN no card data beyond the last 4 digits appears
