# Support Panel Specification

## Purpose

Let blackHole support diagnose a customer's sites from the cloud, without remote desktop, only within an owner-granted access. Served only by api-cloud (PostgreSQL) and shown as a view of admin-web (D-05).

## Requirements

### Requirement: View Inside the Administration Web

The panel MUST be a view of admin-web, not a separate app. It MUST be visible only to users holding `support.view_panel`; other admin-web users MUST NOT see it or reach its routes.

#### Scenario: Support user in admin-web
- GIVEN a blackHole support user signed in to admin-web
- WHEN they open the navigation
- THEN the support view is listed

#### Scenario: Customer administrator
- GIVEN a company administrator without `support.view_panel` signed in to admin-web
- WHEN they request the support view route
- THEN the request is rejected and the view is not listed

### Requirement: Access Requires a Valid Grant

Panel views of a company MUST require a support access granted by its owner that is unexpired and unrevoked. Every support read MUST be recorded in that company's audit trail with support user, view and time.

#### Scenario: Granted access

- GIVEN an owner granted support access until 18:00
- WHEN support opens the panel at 16:00
- THEN the company's diagnostics are shown
- AND the read is audited in the company's chain

#### Scenario: Expired or revoked access

- GIVEN an access that expired or was revoked
- WHEN support requests the panel
- THEN the request is rejected and nothing is shown

### Requirement: Node and Sync Status

For each site the panel MUST show its mode (cloud or hybrid); for hybrid sites it MUST show last heartbeat, node version, outbox backlog by priority and sync cursor lag. A heartbeat older than the configured threshold MUST be shown as stale, never as healthy.

#### Scenario: Healthy hybrid node

- GIVEN a hybrid node that reported 30 seconds ago with an empty outbox
- WHEN support opens the site
- THEN the node shows online with zero backlog

#### Scenario: Node offline

- GIVEN a hybrid node whose last heartbeat was 2 hours ago
- WHEN support opens the site
- THEN the node shows stale with its last-seen time and last known backlog

#### Scenario: Cloud-mode site

- GIVEN a cloud-mode site
- WHEN support opens it
- THEN no node section is shown and its mode is cloud

### Requirement: Pending Invoices

The panel MUST list documents in `pending_issuance` or `uncertain` per taxpayer and site with count, oldest age and reason (no link, no balance, rejected, rate limit). It MUST NOT show customer personal data or line items.

#### Scenario: Pending by reason

- GIVEN 20 invoices pending for no balance and 3 uncertain
- WHEN support opens pending invoices
- THEN both groups appear with counts and oldest age

#### Scenario: No customer data

- GIVEN pending invoices to identified customers
- WHEN support lists them
- THEN names and IDs of those customers are not shown

### Requirement: Factus Negotiation Signals

The system MUST measure per NIT 429 responses per week, peak invoices per minute against the 80/min limit and queue drain time after reconnection; and globally documents per month and customer companies. Crossing a threshold (repeated weekly 429s, above 60% of the limit, drain over 15 minutes, documents doubling, about 10 companies) MUST raise one internal alert. Global signals require the platform role and show only aggregates.

#### Scenario: Peak above 60%

- GIVEN a NIT that reached 52 invoices in one minute
- WHEN signals are evaluated
- THEN an internal alert asks to request a higher limit for that NIT

#### Scenario: Repeated evaluation

- GIVEN an alert already open for the same NIT and signal
- WHEN signals are evaluated again
- THEN no duplicate alert is raised

### Requirement: Bag Consumption View

The panel MUST show the company bag balance, coverage days and consumption by NIT and site for a period.

#### Scenario: Consumption split

- GIVEN two NITs consuming one company bag
- WHEN support views consumption for the month
- THEN each NIT and site shows its documents consumed

#### Scenario: Factus balance unavailable

- GIVEN the Factus balance cannot be reconciled
- WHEN support views the bag
- THEN the internal balance is shown with a reconciliation warning

### Requirement: No Remote Equipment Access

The panel MUST NOT open remote desktop sessions, reveal node credentials or send operational commands to the node.

#### Scenario: Diagnosis without equipment access

- GIVEN a site with a sync backlog
- WHEN support diagnoses it from the panel
- THEN the cause is visible without any node credential being exposed

#### Scenario: Command attempt rejected

- GIVEN a support user with valid access
- WHEN they attempt to send a restart command to the node
- THEN the request is rejected and audited
