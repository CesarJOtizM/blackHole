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

## Deferred to the hybrid phase (D-37)

These notes are not scenarios of this cloud change.

### Cloud detects tampering on a node batch

When a batch arrives, the cloud verifies each device chain against the last verified hash. An altered event, a deleted event, or a reordered sequence produces a finding. A finding is not deletable or dismissable without its own audit event. The node batch, the last verified hash, and a rewritten confirmed history wait for the hybrid phase.

### Offline continuity

In hybrid mode the node keeps appending during a cut and uploads later, after invoice documents and confirmed QR payments and before sales. In cloud mode a cut produces no audit event because no operation occurs.
