# Sync Specification

## Purpose

Define how a hybrid site's node sends its events to the cloud and receives configuration from it, so that nothing is lost, duplicated or reordered across internet cuts (TRD-00 5.1, 5.2, 5.5; TRD-M0 3). Sync applies only to hybrid sites; in cloud mode operational writes go straight to PostgreSQL.

## Requirements

### Requirement: Transactional Outbox

Every change owned by the node MUST be written to SQLite together with its outbox record in the same transaction. Identifiers MUST be UUIDv7 generated without coordination.

#### Scenario: Change and outbox together
- GIVEN a node with no internet
- WHEN a change is written
- THEN the change and its outbox record both exist

#### Scenario: Failed transaction
- GIVEN a write whose transaction fails
- WHEN the node recovers
- THEN neither the change nor its outbox record exists

### Requirement: Event Envelope

Each event MUST carry tenant, site, device, a per-device sequence, the occurred-at time from the device clock and the received-at time from the node clock. The node clock MUST be the site's time reference; devices MUST adjust their offset when connecting.

#### Scenario: Envelope complete
- GIVEN a device with a clock 3 minutes ahead
- WHEN it creates an event through the node
- THEN the event stores both times and reports use the node time

#### Scenario: Missing field
- GIVEN a batch event without a sequence
- WHEN the cloud validates the batch
- THEN that event is rejected and reported to the node

### Requirement: Idempotent Inbox

The cloud MUST apply each event once, keyed by device and sequence, and MUST answer with the last sequence received.

#### Scenario: Duplicate batch
- GIVEN a batch already applied
- WHEN the node resends it
- THEN no event is applied twice and the same last sequence is returned

#### Scenario: Out-of-order arrival
- GIVEN sequence 8 arrives before 7 for one device
- WHEN the cloud processes them
- THEN the events are applied in sequence order

### Requirement: Compressed Resumable Batches

The node MUST send compressed batches. A batch cut midway MUST resume from the last confirmed event.

#### Scenario: Cut mid-batch
- GIVEN a batch of 500 events cut after 200 are confirmed
- WHEN the link returns
- THEN sending resumes at event 201

#### Scenario: Two-hour disconnection
- GIVEN a hybrid node offline for 2 hours while events are created
- WHEN internet returns
- THEN every event reaches the cloud once and in order

### Requirement: Sync Delay

With the site connected to internet, the delay between an event being stored on the node and being applied in the cloud MUST stay at p95 < 1 min (TRD-00 15).

#### Scenario: Connected site
- GIVEN a hybrid site with internet during a service
- WHEN its events are measured from node storage to cloud application
- THEN the p95 delay is under 1 minute

#### Scenario: Delay over target
- GIVEN a connected site whose sync delay p95 rises above 1 minute
- WHEN the delay is measured
- THEN it is reported as a sync delay breach

### Requirement: Send Priority

The node MUST send by priority: electronic invoice documents and confirmed QR payments, QR orders, audit, sales and cash register, inventory, telemetry. Telemetry MUST never delay a higher class.

#### Scenario: Mixed backlog
- GIVEN pending audit, inventory and telemetry events
- WHEN sending starts
- THEN audit goes first and telemetry last

#### Scenario: Large telemetry backlog
- GIVEN thousands of telemetry events and one audit event
- WHEN a batch is built
- THEN the audit event is in the first batch

### Requirement: Configuration Cursor

The cloud MUST publish configuration changes in a per-site stream. The node MUST download from its last cursor over a connection it opens, and MUST only receive its own site. The cursor MUST advance only after the change is stored.

#### Scenario: Catch-up after cut
- GIVEN three configuration changes made while the node was offline
- WHEN the node reconnects
- THEN it receives exactly those three, in order

#### Scenario: Other site requested
- GIVEN a node credential for site A
- WHEN it requests the stream of site B
- THEN the request is refused
