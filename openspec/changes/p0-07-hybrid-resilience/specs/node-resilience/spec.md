# Node Resilience Specification

## Purpose

Keep a hybrid site operating when its node fails, restarts, is replaced or updated, without losing or duplicating confirmed events (TRD-00 5.0, 5.3, 15, 17; ADR-004). Cloud-mode sites have no node and are out of this capability.

## Requirements

### Requirement: Automatic Restart

The node service MUST restart without manual action after a crash, a reboot or power returning, and MUST resume sync from the last confirmed event. A hybrid site MUST have a UPS listed in its kit.

#### Scenario: Process crash
- GIVEN a node serving the site
- WHEN its process crashes
- THEN it restarts on its own and devices reconnect

#### Scenario: Power cut without UPS
- GIVEN a site whose UPS failed
- WHEN power returns
- THEN the node starts, keeps all committed data and resumes sync

### Requirement: Spare-Node Restore

A spare node MUST be restorable from the cloud copy of the site in under 30 minutes, with a new generation. Events confirmed by the cloud MUST NOT be lost. Unsent events recovered later from the failed disk MUST be reconciled and applied once.

#### Scenario: Timed restore
- GIVEN a failed node and a spare device
- WHEN support runs the documented restore
- THEN the site operates on the spare within 30 minutes

#### Scenario: Old disk recovered
- GIVEN the failed node's disk holds 12 unsent events
- WHEN it is connected after the restore
- THEN those events are reconciled once and stale-generation writes are not applied

### Requirement: Failover to the Cloud

When a hybrid node fails, the site MUST NOT switch to the cloud automatically while the node may hold unsent events. Failover MUST happen only if the node last reported an empty outbox, or an administrator confirms it. Failover MUST raise the generation and be audited.

#### Scenario: Confirmed failover
- GIVEN a dead node with unknown pending events
- WHEN the administrator confirms failover
- THEN the cloud owns the operation and devices use the central API

#### Scenario: No confirmation
- GIVEN a dead node with unknown pending events
- WHEN nobody confirms
- THEN the cloud keeps rejecting direct operational writes of that site

### Requirement: Staged Node Updates

Node updates MUST roll out by stages, only outside operating hours, and MUST roll back automatically if the updated node fails its health check. The cloud MUST accept the sync contract of the current and the previous node version.

#### Scenario: Faulty update
- GIVEN a stage of nodes receiving a faulty version
- WHEN health fails after the update
- THEN each node returns to the previous version without manual action
- AND later stages do not receive it

#### Scenario: Mixed versions
- GIVEN nodes on the previous version
- WHEN they sync with the updated cloud
- THEN their batches are accepted

### Requirement: Two-Hour Cut Drill

The release MUST pass a drill in which a hybrid site runs 2 hours without internet. No dining-room order MUST be lost. On reconnect, pending invoice-class events MUST leave first and the QR orders and payments held in the cloud MUST be applied once. Returning to cloud MUST be refused while anything is unsent, unless an administrator explicitly accepts it, which is audited.

#### Scenario: Drill passes
- GIVEN orders created during a 2-hour cut
- WHEN internet returns
- THEN every order is in the cloud once and in order
- AND cloud-held QR events reach the node once

#### Scenario: Return with pending
- GIVEN 5 unsent events
- WHEN return to cloud is requested without acceptance
- THEN it is refused

#### Scenario: Return with accepted remainder
- GIVEN 5 unsent events
- WHEN the administrator explicitly accepts leaving them unsent and confirms the return
- THEN the owner becomes `cloud` and the generation increases
- AND the acceptance is audited with the 5 unsent events

#### Scenario: Return with empty outbox
- GIVEN a hybrid site whose outbox is empty after the drill
- WHEN the administrator confirms the return
- THEN the return proceeds without any acceptance step

### Requirement: Local Capacity

The node MUST keep at least 90 days of the site's operation stored locally, without depending on the cloud to serve it (TRD-00 15).

#### Scenario: Ninety days on the node
- GIVEN a hybrid site with 90 days of operation at its expected volume
- WHEN the cloud is unreachable
- THEN the node still serves those 90 days of data from SQLite

#### Scenario: Storage near limit
- GIVEN a node whose free storage would not hold 90 days at the current volume
- WHEN the node checks its capacity
- THEN it reports the shortfall to support before data is at risk
