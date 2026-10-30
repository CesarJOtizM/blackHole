# Delta for Observability

Judge only ADDED and MODIFIED scenarios. Cloud MVP (D-37): api-cloud and its worker on PostgreSQL. No SQLite or local-node behavior. REMOVED items are not acceptance criteria.

## ADDED Requirements

### Requirement: Metric Catalog

The system MUST publish the site, invoice, cloud, and deployment catalog and MUST NOT add a metric outside serve, invoices, cloud health, or release.

#### Scenario: Panel per metric

- GIVEN the catalog
- WHEN dashboards are applied
- THEN each metric has a panel

#### Scenario: Unanswered question

- GIVEN a metric outside those questions
- WHEN it is reviewed
- THEN it is rejected

### Requirement: Worker Scaling Within Provider Limit

Workers MUST scale with queue depth and MUST NOT exceed 80 shared provider requests per minute per tax id. PostgreSQL only; no SQLite rule.

#### Scenario: Load test

- GIVEN a full queue for one tax id
- WHEN workers scale up and later down
- THEN that tax id stays at or under 80 per minute

#### Scenario: Provider throttles

- GIVEN a 429 with a retry delay
- WHEN workers receive it
- THEN jobs reschedule in order and the response records 429

### Requirement: Export Stays Off the Request Path

An empty OpenTelemetry endpoint MUST skip log, metric, and trace export. An empty Sentry DSN MUST skip error export. Export failure MUST NOT fail the request or `GET /health`.

#### Scenario: Unset exporters

- GIVEN no OpenTelemetry endpoint and no Sentry DSN
- WHEN api-cloud or the worker runs
- THEN nothing is exported and the work succeeds

#### Scenario: Export failure

- GIVEN the exporter fails
- WHEN a request or `GET /health` runs
- THEN the request succeeds and health reports ok

## MODIFIED Requirements

### Requirement: Signals Through a Collector

api-cloud and the worker MUST emit logs, catalog metrics, and traces through a collector. Logs MUST carry tenant, site, and trace id. One trace id MUST link the cloud hops. Device, user, and order MUST NOT be metric labels.

(Previously: the node emitted, and a trace crossed a PWA and the node.)

#### Scenario: Cloud logs, metrics, and traces

- GIVEN the worker continues a cloud request
- WHEN telemetry is exported
- THEN the collector receives logs, metrics, and traces from both on one trace id

#### Scenario: High-cardinality label

- GIVEN a metric labelled by user id
- WHEN the catalog check runs
- THEN it fails

### Requirement: Dashboards and Alarms as Code

Dashboards and alarms MUST be infrastructure code. Each alarm MUST have owner, threshold, and action. A service MUST NOT deploy without its dashboard. Alarms MUST cover availability under 99.5% this month or 5 silent minutes, invoice age over 30 minutes, over 3 rejections in 10 minutes per tax id, and the first production Sentry issue.

(Previously: also a node-offline alarm and a sync-delay alarm.)

#### Scenario: Cloud availability below target

- GIVEN under 99.5% this month or silent 5 minutes
- WHEN the alarm evaluates
- THEN the availability alarm fires

#### Scenario: Pending invoice

- GIVEN an invoice pending 31 minutes
- WHEN the alarm evaluates
- THEN the invoice-age alarm fires

#### Scenario: Repeated rejections

- GIVEN over 3 rejections for one tax id in 10 minutes
- WHEN the alarm evaluates
- THEN the rejection alarm fires

#### Scenario: First production error

- GIVEN an error never seen in production
- WHEN it is reported
- THEN the new-error alarm fires

### Requirement: Cloud Error Tracking

api-cloud and the worker MUST report errors with company, site, role, and release.

(Previously: the node, an offline PWA queue, and source maps were required.)

#### Scenario: Cloud error report

- GIVEN company, site, role, and release on a cloud error
- WHEN it is reported
- THEN the tracker stores those fields and that release

### Requirement: No Personal Data

A signal or error report MUST NOT contain names, ID numbers, phones, addresses, secrets, or tokens. Scrubbing MUST run before data leaves api-cloud, the worker, or the collector. A pattern test MUST fail if a pattern remains.

(Previously: the device and the node also scrubbed.)

#### Scenario: Error with customer phone

- GIVEN an error message with a phone number
- WHEN it is sent
- THEN the stored report has the number removed

#### Scenario: Pattern test

- GIVEN a log line with an ID number
- WHEN the privacy test runs
- THEN it fails

## REMOVED Requirements

### Requirement: Node Telemetry at Lowest Priority

(Reason: D-37 defers node telemetry, the weak link, and the full buffer.)
(Migration: None.)

### Requirement: Node Disconnected Alarm

(Reason: D-37 defers the hybrid node-offline alarm. Dashboards stay without it.)
(Migration: None.)

### Requirement: Sync Delay Alarm

(Reason: D-37 defers the hybrid sync-delay alarm. Dashboards stay without it.)
(Migration: None.)

### Requirement: Offline PWA Error Queue and Deferred Browser Sentry

(Reason: D-37 defers the offline PWA queue, browser Sentry, and source-map upload.)
(Migration: None. Cloud Error Tracking is api-cloud and the worker only.)

### Requirement: PWA-to-Node Trace

(Reason: A PWA-to-node trace needs the local node and hybrid sync.)
(Migration: None. Judge Cloud logs, metrics, and traces.)

## RENAMED Requirements

### Requirement: Error Tracking with Deferred Sending → Cloud Error Tracking

(Reason: Browser deferral is out; cloud reporting stays.)
(Migration: Use Cloud Error Tracking. Drop the PWA offline scenario.)
