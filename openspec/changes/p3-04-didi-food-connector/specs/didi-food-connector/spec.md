# DiDi Food Connector Specification

## Purpose

Connect DiDi Food stores to the platform hub, directly or through an integrator (ADR-011), with behavior equivalent to the Rappi connector. Payloads stay inside the adapter (TRD-00 sec. 6.1, TRD-M5).

## Requirements

### Requirement: Connection Path

Each site channel MUST be configured to use either a direct DiDi Food connection or an integrator. The hub MUST behave the same regardless of the path, using only declared capabilities.

#### Scenario: Integrator path
- GIVEN a site whose DiDi channel uses the integrator
- WHEN a DiDi order arrives through the integrator
- THEN it appears in the queue as channel "DiDi Food", not as the integrator

#### Scenario: Path switched
- GIVEN a channel switched from integrator to direct
- WHEN an order already received via the integrator arrives directly
- THEN it is not duplicated

### Requirement: Credentials

Credentials for DiDi Food or the integrator MUST be stored encrypted in the cloud per tenant and MUST NOT reach the node, PWAs or reporting events.

#### Scenario: Saved encrypted
- GIVEN an admin linking a DiDi store
- WHEN credentials are saved
- THEN they are encrypted and tenant-scoped

#### Scenario: Not exposed
- GIVEN a courier or cashier app session
- WHEN channel configuration is loaded
- THEN no credential is returned

### Requirement: Automatic Order Reception

The connector MUST receive DiDi orders by signed webhook or polling and resolve the site from the store id. Invalid signatures MUST NOT create orders.

#### Scenario: Valid order
- GIVEN a signed DiDi order for a linked store
- WHEN it arrives
- THEN the site queue shows it with channel and code

#### Scenario: Invalid signature
- GIVEN a webhook with a bad signature
- WHEN it arrives
- THEN no order is created

### Requirement: Publishing by Declared Capability

The connector MUST publish statuses, channel menu, availability and store pause only when declared; otherwise the system MUST point to the DiDi portal.

#### Scenario: Ready status
- GIVEN status support declared
- WHEN the order becomes ready
- THEN DiDi receives "ready for pickup"

#### Scenario: Menu not supported
- GIVEN the integrator does not publish menus
- WHEN the admin publishes the DiDi menu
- THEN the system indicates the DiDi portal must be used and keeps the product mapping

### Requirement: DiDi Cancellations

DiDi cancellations MUST be received and processed with the hub cancellation rule, including when they arrive out of order.

#### Scenario: Not started
- GIVEN an accepted DiDi order not started
- WHEN DiDi cancels
- THEN stock is returned and the site is alerted

#### Scenario: Cancellation first
- GIVEN a cancellation for an unknown order
- WHEN the order arrives later
- THEN it is closed as cancelled

### Requirement: Manual Fallback Without Duplicates

If the connector or integrator fails, manual capture MUST remain available. Uniqueness MUST use (DiDi Food, external id) regardless of path.

#### Scenario: Integrator outage
- GIVEN the integrator is down
- WHEN a DiDi order is captured manually and later delivered by the integrator
- THEN only one order and one kitchen ticket exist

#### Scenario: Outage alert
- GIVEN repeated failures beyond threshold
- WHEN detected
- THEN the site is told to use manual capture
