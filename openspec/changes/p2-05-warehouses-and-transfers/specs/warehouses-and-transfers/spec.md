# Warehouses and Transfers Specification

## Purpose

Warehouses, transfers and replenishment, including offline reception (PRD-M4 HU-M4-03, TRD-00 sec. 5.1, 5.5, TRD-M4 sec. 2–7).

## Requirements

### Requirement: Warehouses and Supply

A site MAY have site warehouses, owned by the site's owner; a company MAY have general warehouses. Each site MUST declare which warehouses supply it, and requests MUST target only those.

#### Scenario: Supplying warehouse
- GIVEN "Central" supplies sites A and B
- WHEN site A requests replenishment
- THEN "Central" is offered

#### Scenario: Unrelated warehouse
- GIVEN "North" does not supply site A
- WHEN site A requests from it
- THEN the request is rejected

### Requirement: General Warehouse Node

A general warehouse MUST run on its own node in warehouse mode (inventory, receiving, dispatch, vouchers; no dining room or cash), which operates offline (D-04). Operating a general warehouse from the web without a node is out of scope (PA-44).

#### Scenario: Warehouse node offline
- GIVEN "Central" on an offline warehouse node
- WHEN a dispatch is registered
- THEN it is stored locally and synced later

#### Scenario: No dining room on the warehouse node
- GIVEN "Central" on a warehouse-mode node
- WHEN a device tries to open a table or a cash-register shift on it
- THEN the request is rejected

#### Scenario: General warehouse without node
- GIVEN a general warehouse with no paired node
- WHEN a dispatch is attempted from the web
- THEN it cannot be recorded

### Requirement: Transfer Lifecycle

States MUST advance in order: requested, dispatched, in transit, then received or received with differences. Each transition MUST record user and time; dispatch and receipt MUST be audited.

#### Scenario: Same-node transfer offline
- GIVEN a site warehouse and point of sale on one offline hybrid node
- WHEN dispatched and received
- THEN both halves are recorded locally and the transfer is received

#### Scenario: Receipt before dispatch
- GIVEN a requested same-owner transfer
- WHEN receipt is attempted
- THEN it is rejected

### Requirement: Two Halves, One Identifier

With different owners, origin MUST record only transfer-out and destination only transfer-in, sharing the ID; it stays in transit until the destination half exists. Duplicate or out-of-order halves MUST reconcile once.

#### Scenario: Reconciled
- GIVEN "Central" dispatched T to site A
- WHEN site A records its receipt
- THEN the cloud links both halves and marks T received

#### Scenario: Out of order
- GIVEN the receipt of T reaches the cloud before the dispatch
- WHEN the dispatch arrives
- THEN T reconciles once without duplicate movements

### Requirement: QR Voucher Reception

The dispatch voucher MUST carry a QR with transfer ID and lines. A registered device scanning it MUST record the receipt even before sync delivers the dispatch. Receipts without a matching dispatch after reconciliation MUST be flagged.

#### Scenario: Site offline at receipt
- GIVEN site A's node is offline without dispatch T
- WHEN T's voucher is scanned and quantities confirmed
- THEN transfer-in is recorded locally and reconciled on reconnect

#### Scenario: Unregistered device
- GIVEN a phone not registered at site A
- WHEN it scans the voucher
- THEN nothing is recorded

### Requirement: Received with Differences

Quantities differing from dispatch MUST set received with differences, requiring "receive a transfer with differences" or supervisor authorization (PRD-01 sec. 6.3). Line differences MUST stay visible.

#### Scenario: Short delivery
- GIVEN 10 kg beef dispatched
- WHEN 9 kg are received with authorization
- THEN destination gets +9 kg and −1 kg difference is recorded

#### Scenario: No authorization
- GIVEN a kitchen chief
- WHEN confirming a different quantity
- THEN nothing is recorded until authorized

### Requirement: Transfer Cost

Both halves MUST carry the origin's average cost at dispatch, with nothing added (D-27). Transfer-in MUST update the destination average using that cost.

#### Scenario: Cost travels
- GIVEN origin cost 12 COP/g and destination 1000 g at 10 COP/g
- WHEN 1000 g are received
- THEN destination average is 11 COP/g

#### Scenario: Short receipt valued
- GIVEN 10 kg dispatched at 12 COP/g
- WHEN 9 kg are received
- THEN the 1 kg difference is valued at 12 COP/g

### Requirement: Replenishment Suggestion

Holders of "request replenishment" MUST request from a supplying warehouse. When a point-of-sale balance falls below its minimum, the system MUST suggest maximum minus current stock.

#### Scenario: Below minimum
- GIVEN beef minimum 5 kg, maximum 20 kg, balance 4 kg
- WHEN the balance changes
- THEN a 16 kg request is suggested

#### Scenario: No levels
- GIVEN an ingredient without levels
- WHEN its balance drops
- THEN no suggestion is made
