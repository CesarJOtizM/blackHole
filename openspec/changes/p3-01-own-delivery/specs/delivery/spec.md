# Delivery Specification

## Purpose

Own-delivery orders taken by staff, delivered by own couriers, measured per stage and reconciled in the shift (PRD-M5, TRD-M5).

## Requirements

### Requirement: Delivery Order Capture

The system MUST create a delivery with customer, phone, mandatory address, notes and channel (phone, WhatsApp, counter), and MUST create an internal order routed to the kitchen like a table order.

#### Scenario: Created with address
- GIVEN a cashier with order permission
- WHEN they create a phone delivery with address and two products
- THEN the kitchen receives an order with channel "own delivery"

#### Scenario: Missing address
- GIVEN a delivery without address
- WHEN submitted
- THEN it is rejected and no internal order exists

### Requirement: Ordered Stages

Each delivery MUST record created, ready, dispatched and delivered with the operation owner's clock. Delivered MUST NOT precede dispatched.

#### Scenario: Stages recorded
- GIVEN a delivery whose order became ready
- WHEN it is dispatched and delivered
- THEN all four stages hold a timestamp

#### Scenario: Skipping dispatch
- GIVEN a delivery in "ready"
- WHEN delivery is confirmed
- THEN it is rejected

### Requirement: Courier Assignment

Dispatch MUST assign a courier of the same site. A courier MUST only see deliveries assigned to them, without costs or other sites.

#### Scenario: Assigned courier notified
- GIVEN a ready delivery
- WHEN courier A is assigned and it is dispatched
- THEN A is notified in the courier app

#### Scenario: Other courier
- GIVEN courier B not assigned
- WHEN B requests that delivery
- THEN access is denied

### Requirement: Courier Connectivity

The courier app MUST talk to the cloud over mobile data. During a site internet cut, a registered courier device MUST sync only through the site Wi-Fi.

#### Scenario: Deferred confirmation
- GIVEN a hybrid site offline and a courier outside its Wi-Fi
- WHEN the courier marks delivered
- THEN the confirmation waits on the device and is applied once when it reaches the cloud or the site

#### Scenario: Via site Wi-Fi
- GIVEN the courier returns to the site Wi-Fi during the cut
- WHEN the app syncs
- THEN delivery and COD reach the node

### Requirement: Cash on Delivery Reconciliation

COD MUST enter the dispatching register's shift and MUST be reconciled per courier at shift close, with audited differences.

#### Scenario: Settled in full
- GIVEN courier A confirmed three COD deliveries
- WHEN A hands over the cash
- THEN the difference is zero

#### Scenario: Not handed over
- GIVEN a confirmed COD not handed over
- WHEN the shift closes
- THEN a difference is recorded against A

### Requirement: Delivery Invoice and Bag Tax

The invoice MUST carry the delivery address even without fiscal data. If the order leaves with plastic bags, the bag tax MUST be a line per the tax engine.

#### Scenario: Address on final-consumer invoice
- GIVEN a delivery without fiscal data
- WHEN invoiced
- THEN the document carries the address

#### Scenario: No bag
- GIVEN a delivery without bags
- WHEN invoiced
- THEN no bag tax line exists

### Requirement: Ownership by Operating Mode

In hybrid mode the node MUST own site-created deliveries and sync them to the cloud; in cloud mode `api-cloud` MUST own them and creation MUST be unavailable while the site has no internet. A courier-created delivery MUST be owned by the cloud and synced to the node.

#### Scenario: Offline in hybrid
- GIVEN a hybrid site offline
- WHEN a delivery is created
- THEN it reaches the kitchen and syncs once on reconnect

#### Scenario: Cloud-mode outage
- GIVEN a cloud-mode site offline
- WHEN staff create a delivery
- THEN creation is unavailable

### Requirement: Cancellation and Audit

Cancelling MUST return stock if the kitchen had not started, or record waste with reason otherwise. COD and cancellations MUST be audited.

#### Scenario: Before kitchen start
- GIVEN a delivery not started
- WHEN cancelled
- THEN stock returns and an audit event exists

#### Scenario: After kitchen start
- GIVEN a delivery in preparation
- WHEN cancelled
- THEN waste with reason is recorded
