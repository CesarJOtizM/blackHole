# Delta for Platform Hub

## ADDED Requirements

### Requirement: Status Propagation

The operation owner MUST emit accepted, preparing and ready statuses; the hub MUST forward them to each connector that supports status. Forwarding failures MUST be retried and MUST NOT block the kitchen.

#### Scenario: Status forwarded
- GIVEN an accepted order on a connector with status support
- WHEN the kitchen marks it ready
- THEN the platform receives "ready"

#### Scenario: Hybrid node offline
- GIVEN a hybrid node without internet
- WHEN orders change status
- THEN statuses are queued and forwarded in order on reconnect

### Requirement: Availability Propagation

When inventory marks a dish sold out or available, the hub MUST propagate it to every channel of the site whose connector supports availability.

#### Scenario: Sold out propagated
- GIVEN a site on two platforms with availability support
- WHEN a dish becomes sold out
- THEN both platforms show it sold out

#### Scenario: Manual channel
- GIVEN a channel on the Manual adapter
- WHEN a dish becomes sold out
- THEN the site is reminded to mark it on the portal

### Requirement: Store Pause and Resume

A person with permission (PRD-01 sec. 6.4) MUST be able to pause and resume a platform for a site. Pause and resume MUST be audited.

#### Scenario: Saturation pause
- GIVEN a supervisor at a saturated site
- WHEN they pause Rappi
- THEN Rappi stops sending orders and an audit event is recorded

#### Scenario: Cashier denied
- GIVEN a cashier without pause permission
- WHEN they try to pause
- THEN it is blocked

### Requirement: Silent-Node Watchdog

For hybrid sites, the hub MUST pause supporting platforms when the node is silent beyond a configurable threshold, and MUST resume them when the node returns. It MUST NOT pause a cloud-mode site that is operating.

#### Scenario: Threshold exceeded
- GIVEN a hybrid node silent longer than the threshold
- WHEN the watchdog runs
- THEN supporting platforms are paused and the pause is audited as automatic

#### Scenario: Below threshold
- GIVEN a node silent less than the threshold
- WHEN the watchdog runs
- THEN nothing is paused

#### Scenario: Node returns
- GIVEN a store paused by the watchdog
- WHEN the node reconnects
- THEN the store resumes and pending external orders reach the queue once
