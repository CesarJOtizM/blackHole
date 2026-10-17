# Rappi Connector Specification

## Purpose

Anti-corruption adapter that connects Rappi stores to the platform hub. It describes behavior only; Rappi payloads stay inside the adapter (TRD-00 sec. 6.1, TRD-M5, ADR-011).

## Requirements

### Requirement: Store Credentials

Rappi credentials MUST be stored encrypted in the cloud per tenant and store. They MUST NOT reach the node, the PWAs or reporting events.

#### Scenario: Credentials registered
- GIVEN an admin linking a site to its Rappi store
- WHEN credentials are saved
- THEN they are stored encrypted and scoped to that tenant

#### Scenario: Node sync excludes credentials
- GIVEN a hybrid node syncing delivery configuration
- WHEN the sync batch is built
- THEN no Rappi credential is included

### Requirement: Automatic Order Reception

The connector MUST receive Rappi orders by signed webhook or by polling, resolve the site from the store id and hand a normalized external order to the hub. An invalid signature MUST NOT create an order.

#### Scenario: Valid webhook
- GIVEN a signed Rappi order for store S1
- WHEN it arrives
- THEN an external order appears in the queue of the site linked to S1

#### Scenario: Invalid signature
- GIVEN a webhook with a wrong signature
- WHEN it arrives
- THEN no external order is created and the attempt is logged

#### Scenario: Unknown store
- GIVEN an order for a store id not linked to any site
- WHEN it arrives
- THEN it is held for support review and not routed

### Requirement: Declared Capabilities

The connector MUST declare the operations Rappi grants under the agreement (status, menu, availability, pause, settlement). Operations not granted MUST fall back to the Rappi portal.

#### Scenario: Pause not granted
- GIVEN an agreement without pause
- WHEN a supervisor pauses Rappi
- THEN the system states it must be done on the Rappi portal

#### Scenario: Status granted
- GIVEN status is granted
- WHEN an order becomes ready
- THEN Rappi receives "ready for pickup"

### Requirement: Menu and Availability Publishing

When granted, the connector MUST publish the channel menu with channel prices and modifiers, and MUST mark items sold out or available.

#### Scenario: Dish sold out
- GIVEN a dish reaches zero producible units
- WHEN the availability event reaches the hub
- THEN the item is marked sold out on Rappi

#### Scenario: Publish failure
- GIVEN Rappi rejects a menu publish
- WHEN the admin publishes
- THEN the admin sees the failure and the previous menu stays

### Requirement: Rappi Cancellations

Rappi cancellations MUST be received automatically and processed with the hub cancellation rule. A cancellation arriving before its order MUST NOT create an order.

#### Scenario: Cancellation of accepted order
- GIVEN an accepted Rappi order in preparation
- WHEN Rappi cancels it
- THEN waste is recorded and the site is alerted

#### Scenario: Cancellation before order
- GIVEN a cancellation for an unknown external id
- WHEN the order arrives later
- THEN it is closed as cancelled, not queued

### Requirement: Manual Fallback Without Duplicates

When the connector fails, the cashier MUST be able to capture the Rappi order manually. If the connector later delivers the same order, it MUST NOT duplicate.

#### Scenario: Connector recovers
- GIVEN order "R-7" captured manually during an outage
- WHEN the connector later receives "R-7"
- THEN it links to the existing order and no second ticket is printed

#### Scenario: Connector down alert
- GIVEN repeated reception failures
- WHEN the threshold is exceeded
- THEN the site is told to use manual capture
