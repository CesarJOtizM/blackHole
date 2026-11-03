# Operating Mode Specification

## Purpose

Define how each site runs in cloud mode (api-cloud on PostgreSQL) or hybrid mode (local-node on SQLite), who owns the site's operation, and how ownership changes without two writers creating the same sale (PRD-00 9.1, TRD-00 5.0).

## Requirements

### Requirement: Cloud Mode by Default

A site MUST start in cloud mode. In cloud mode the site PWA MUST talk to the central API, and the site MUST operate end to end without a node. The device MUST NOT choose the mode; it MUST ask the site's mode and use the returned address.

#### Scenario: Cloud site without node
- GIVEN a new site with no node
- WHEN a device performs an operational write
- THEN the central API accepts it and stores it in PostgreSQL

#### Scenario: Internet cut in cloud mode
- GIVEN a site in cloud mode
- WHEN the site loses internet
- THEN no operation is possible at the site
- AND on reconnect work resumes where it stopped, with nothing to sync

### Requirement: Single Operation Owner and Generation

Each site MUST record one operation owner (`cloud` or `node`) and a monotonic generation. Every operational write MUST carry the generation. Both hosts MUST reject writes with a stale generation.

#### Scenario: Current generation accepted
- GIVEN a site owned by the node at generation 3
- WHEN the node writes with generation 3
- THEN the write is accepted

#### Scenario: Stale generation rejected
- GIVEN the site moved to generation 4
- WHEN a write with generation 3 arrives at either host
- THEN it is rejected and not applied

### Requirement: Activate Hybrid

An administrator MUST activate hybrid mode from the cloud, which issues a single-use pairing code. Pairing MUST download the site snapshot to the node, set the owner to `node` and increment the generation. From then on the cloud MUST reject operational writes sent directly by that site's PWAs. Activation MUST NOT be possible while the cloud is unreachable.

#### Scenario: Successful pairing
- GIVEN a site in cloud mode and a valid pairing code
- WHEN the node pairs
- THEN the node holds the snapshot, the owner is `node` and the generation increased
- AND site devices are directed to the node

#### Scenario: Reused or expired code
- GIVEN a pairing code already used or expired
- WHEN a node tries to pair with it
- THEN pairing is refused and the mode is unchanged

### Requirement: Return to Cloud

Returning to cloud MUST require the node outbox to be empty, or an explicit administrator acceptance of what has not been uploaded (D-02). The acceptance MUST be audited together with the events left unsent. On return the owner MUST become `cloud` and the generation MUST increase.

#### Scenario: Empty outbox
- GIVEN a hybrid site whose outbox is empty
- WHEN the administrator confirms the return
- THEN the owner is `cloud`, the generation increased and devices use the central API

#### Scenario: Pending events
- GIVEN a hybrid site with pending outbox events
- WHEN the administrator requests the return without acceptance
- THEN the return is refused and the pending count is shown

#### Scenario: Pending events explicitly accepted
- GIVEN a hybrid site with pending outbox events
- WHEN the administrator explicitly accepts the unsent remainder and confirms the return
- THEN the owner is `cloud` and the generation increased
- AND an audit event records the acceptance and the events left unsent

### Requirement: Same Behavior in Both Hosts

The same use cases MUST run in api-cloud and local-node; only persistence adapters differ. Every persistence port MUST pass one contract suite on memory, SQLite and PostgreSQL. A `bridge` profile MUST load no organization or operation data.

#### Scenario: Contract suite on both dialects
- GIVEN a persistence port
- WHEN its contract suite runs on SQLite and PostgreSQL adapters
- THEN both pass the same assertions

#### Scenario: Bridge profile
- GIVEN the node program started with the `bridge` profile
- WHEN its routes and stores are inspected
- THEN no operation route or operation store exists
