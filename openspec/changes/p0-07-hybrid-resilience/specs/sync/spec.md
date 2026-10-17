# Delta for Sync

## ADDED Requirements

### Requirement: Retry with Growing Backoff

On an intermittent link the node MUST retry sending with growing waits up to a maximum, and MUST resume from the last confirmed event when the link returns. Retries MUST NOT reorder events or change send priority.

#### Scenario: Flapping link
- GIVEN a link that drops every few minutes
- WHEN the node keeps sending
- THEN waits grow between failures and every event arrives once and in order

#### Scenario: Link returns
- GIVEN the node waiting at maximum backoff
- WHEN connectivity returns
- THEN sending resumes within one retry interval

### Requirement: Backup Link

When the primary internet link fails and a backup link (4G) is available to the node, sync MUST continue over the backup without manual action, keeping priority. In cloud mode the backup belongs to the site router and is outside the node.

#### Scenario: Primary fails
- GIVEN a hybrid node with a 4G backup
- WHEN the primary link drops
- THEN batches continue over 4G

#### Scenario: Both links down
- GIVEN primary and backup down
- WHEN the node tries to send
- THEN events stay in the outbox and the site keeps operating

### Requirement: Two-Way Drain on Reconnect

On reconnect the node MUST upload in priority order, invoice documents and confirmed QR payments first, and MUST pull what the cloud held for the site during the cut, QR orders and payments included, applying each once.

#### Scenario: Backlog both ways
- GIVEN pending invoice events on the node and QR payments held in the cloud
- WHEN the node reconnects
- THEN invoices upload first and the QR payments are applied once

#### Scenario: Reconnect drops midway
- GIVEN a drain interrupted after half of the inbound items
- WHEN the link returns
- THEN only the remaining items are applied
