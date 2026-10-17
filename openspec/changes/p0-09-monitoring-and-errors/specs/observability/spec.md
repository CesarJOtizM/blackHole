# Observability Specification

## Purpose

Answer four questions for any cloud: can each site serve, do invoices go out, does the cloud hold up, did a release break something (TRD-01 7, 8). Node signals exist only for hybrid sites.

## Requirements

### Requirement: Signals Through a Collector

API, workers and node MUST emit OpenTelemetry logs, metrics and traces, forwarded by a cloud collector. Logs MUST carry tenant, site, device and trace id; one trace MUST follow a request end to end. Metric labels MUST be low cardinality; device, user and order stay in logs and traces.

#### Scenario: End-to-end trace
- GIVEN a request from a PWA through the node to the cloud
- WHEN it is traced
- THEN one trace id links every hop

#### Scenario: High-cardinality label
- GIVEN a metric labelled by user id
- WHEN the metric catalog check runs
- THEN it fails

### Requirement: Metric Catalog

The system MUST publish the TRD-01 7.3 catalog for site, invoices, cloud and deployment. A metric that answers none of the four questions MUST NOT be added.

#### Scenario: Panel per metric
- GIVEN the catalog
- WHEN dashboards are applied
- THEN each metric has a panel

#### Scenario: Unanswered question
- GIVEN a proposed metric unrelated to the four questions
- WHEN it is reviewed
- THEN it is rejected

### Requirement: Node Telemetry at Lowest Priority

A connected hybrid node MUST report its state every minute at the lowest sync priority, never directly to the backend. Offline, telemetry MUST be buffered up to a maximum, discarding the oldest lowest-severity entries first.

#### Scenario: Weak link
- GIVEN pending invoice events and telemetry
- WHEN the node sends
- THEN invoices go before telemetry

#### Scenario: Full buffer
- GIVEN a full telemetry buffer offline
- WHEN a new entry arrives
- THEN the oldest lowest-severity entry is discarded

### Requirement: Dashboards and Alarms as Code

Dashboards and alarms MUST be code beside the infrastructure, each alarm with owner, threshold and action; a service MUST NOT deploy without its dashboard. Alarms MUST cover at least the TRD-01 7.5 list, including node offline over 15 minutes in operating hours and an invoice pending over 30 minutes at a connected site.

#### Scenario: Node disconnected
- GIVEN a hybrid node unplugged during operating hours
- WHEN 15 minutes pass
- THEN Grafana shows it offline and its alarm fires

#### Scenario: Pending invoice
- GIVEN a connected site with an invoice pending 31 minutes
- WHEN the alarm evaluates
- THEN it fires

#### Scenario: Cloud availability below target
- GIVEN the cloud API below 99.5% availability in the month, or not answering for more than 5 minutes
- WHEN the alarm evaluates
- THEN the cloud availability alarm fires (TRD-00 15, TRD-01 7.5)

#### Scenario: Sync delay over target
- GIVEN a connected hybrid site whose sync delay p95 exceeds 1 minute
- WHEN the alarm evaluates
- THEN the sync delay alarm fires (TRD-00 15, TRD-01 7.5)

### Requirement: Error Tracking with Deferred Sending

Cloud, node and PWAs MUST report errors with company, site, role and release, queuing them offline up to a maximum. PWA source maps MUST be uploaded but not published.

#### Scenario: PWA error offline
- GIVEN a PWA without internet that throws an error
- WHEN the connection returns
- THEN the error reaches the tracker with its release

#### Scenario: New error in production
- GIVEN an error never seen before in production
- WHEN it is reported
- THEN the new-error alarm fires

### Requirement: No Personal Data

No signal or error report MUST contain names, ID numbers, phones, addresses, secrets or tokens; scrubbing MUST happen before data leaves device, node or collector, checked by an automated pattern test.

#### Scenario: Error with customer phone
- GIVEN an error whose message contains a phone number
- WHEN it is sent
- THEN the stored report has the number removed

#### Scenario: Pattern test
- GIVEN a log line containing an ID number
- WHEN the privacy test runs
- THEN it fails

### Requirement: Worker Scaling Within Provider Limit

Workers MUST scale with queue depth, and the per-NIT request rate to the invoicing provider MUST be shared across all instances so scaling never exceeds 80 requests per minute per NIT.

#### Scenario: Load test
- GIVEN a full invoice queue for one NIT
- WHEN workers scale up and later down
- THEN requests for that NIT never exceed 80 per minute

#### Scenario: Provider throttles
- GIVEN the provider answers 429 with a retry delay
- WHEN workers receive it
- THEN jobs are rescheduled in order and the response metric records it
