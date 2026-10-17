# Audit Specification

## Purpose

Keep a record of sensitive actions that nobody can edit or delete, and detect in the cloud any tampering made on a node (TRD-00 10.3, TRD-M0 2). In hybrid mode the node owns the audit generated at the site and uploads it; in cloud mode the cloud owns it.

## Requirements

### Requirement: Audit Event Content

Each sensitive action, authorization, role change, mode change, failed PIN series and revocation MUST produce an audit event with actor, authorizer if any, device, site, action, entity, before and after values, reason and the node time (server time in cloud mode). Other contexts MUST register events through the platform entry port.

#### Scenario: Authorized void
- GIVEN a supervisor authorizes a void
- WHEN the event is registered
- THEN it holds requester, authorizer, value, reason, device and time

#### Scenario: Missing actor
- GIVEN an event without actor
- WHEN it is registered
- THEN it is rejected

### Requirement: Append-Only Storage

Audit events MUST only be appended. No route, role or adapter, including the owner role, MUST be able to modify or delete them, in SQLite or PostgreSQL.

#### Scenario: Update attempt
- GIVEN a stored audit event
- WHEN any adapter tries to update it
- THEN the store refuses and the event is unchanged

#### Scenario: Owner delete request
- GIVEN the owner
- WHEN they ask to delete an event
- THEN no such action exists

### Requirement: Hash Chain per Device

Each event MUST include the hash of the previous event of the same device and a per-device sequence. The chain MUST be verifiable without trusting the node.

#### Scenario: Chain links
- GIVEN three events from one device
- WHEN the chain is verified
- THEN each event's previous hash matches the prior event

#### Scenario: Two devices
- GIVEN events interleaved from two devices
- WHEN each chain is verified
- THEN both are valid independently

### Requirement: Cloud Detects Tampering

When a batch arrives, the cloud MUST verify each device chain against the last verified hash it holds. An altered event, a deleted event or a reordered sequence MUST produce a finding for the tenant. A finding MUST NOT be deletable or dismissable without leaving its own audit event.

#### Scenario: Altered event
- GIVEN a node where a void amount was changed in SQLite
- WHEN its batch reaches the cloud
- THEN the chain fails and a finding names device and sequence

#### Scenario: Deleted event
- GIVEN a node where one event was deleted
- WHEN the batch arrives
- THEN the sequence gap produces a finding

#### Scenario: Rewritten confirmed history
- GIVEN events already verified by the cloud
- WHEN the node later sends a rebuilt chain for them
- THEN a finding is produced and the stored events are kept

### Requirement: Offline Continuity

In hybrid mode the node MUST keep appending events during a cut and upload them later in sync priority, after invoice documents and confirmed QR payments and before sales. In cloud mode no audit event is produced by the site during a cut because no operation occurs.

#### Scenario: Cut of two hours
- GIVEN a hybrid node offline for 2 hours with 40 audit events
- WHEN internet returns
- THEN all 40 reach the cloud and verify

#### Scenario: Cloud site during a cut
- GIVEN a cloud-mode site offline
- WHEN staff try an action
- THEN nothing runs and no event is produced

### Requirement: Scoped Read Access

Audit MUST be readable by owner and general manager for the company, by a site administrator only for their site, and by the auditor role read-only. Nobody else MUST read it.

#### Scenario: Site administrator
- GIVEN an administrator of site 1
- WHEN they open the audit of site 2
- THEN it is denied

#### Scenario: Auditor
- GIVEN an auditor
- WHEN they read company audit
- THEN it is shown with no write action available
