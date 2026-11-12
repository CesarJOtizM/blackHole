# Reporting Specification

## Purpose

Read-only site reports: the operating day where the operation runs, and history in the cloud, with identical definitions on node and cloud (PRD-00 sec. 8, PRD-M6, TRD-M6).

## Requirements

### Requirement: Shared Metric Definitions

Metrics MUST come from timestamped events, using node time (server time in cloud mode). A time between two states MUST NOT exist if either state is missing. Net sales MUST exclude discounts, taxes and tips. Percentiles p50 and p90 MUST use one definition on node and cloud.

#### Scenario: Missing end state
- GIVEN a line never marked ready
- WHEN preparation time is computed
- THEN that line contributes no value

#### Scenario: Same day, both sides
- GIVEN a synced hybrid site
- WHEN a day's net sales are read on node and cloud
- THEN they match

### Requirement: Day Reports on the Operation Owner

Day reports (sales, payment methods, voids, shift, live times, hours) SHALL be answered by the operation owner. In hybrid mode the node MUST answer during an outage; in cloud mode they are unavailable during an outage.

#### Scenario: Hybrid outage
- GIVEN a hybrid site offline mid-service
- WHEN the administrator opens the day report
- THEN the node shows sales, methods and times so far

#### Scenario: Cloud outage
- GIVEN a cloud-mode site offline
- WHEN the day report is requested
- THEN it is unavailable

### Requirement: Sales Reports

The system SHALL report gross and net sales, average ticket, ticket per diner, sales per hour band, by channel (waiter vs QR table), per waiter with tips, top and bottom products, table rotation, payment-method share with QR separate from cash, invoices with customer data (portal vs register) and re-invoicing count.

#### Scenario: QR separate from cash
- GIVEN a day with cash and QR table payments
- WHEN payment methods are reported
- THEN QR totals appear apart from cash

#### Scenario: Portal capture share
- GIVEN 10 invoices, 4 with portal data and 1 with register data
- WHEN the invoice report runs
- THEN 50 % have customer data: 4 portal, 1 register

### Requirement: Time Reports

The system SHALL report order-taking, kitchen wait, preparation, total kitchen, table delivery, total service, table duration and payment time, filterable by site, station, product, waiter, hour band and weekday, with average, p50 and p90.

#### Scenario: Station filter
- GIVEN a service with grill and bar lines
- WHEN preparation time is filtered by grill
- THEN only grill lines feed average, p50 and p90

#### Scenario: Empty filter
- GIVEN a filter with no matching lines
- WHEN times are requested
- THEN no figures are shown instead of zeros

### Requirement: Cash Register and Staff Reports

The system SHALL report shift closings (expected, counted, difference per method); hours, lateness, absences and corrections; sales per hour worked; tips by period and method with distribution; productivity per waiter and station. It MUST NOT compute salary.

#### Scenario: Sales per hour worked
- GIVEN net sales of 2,000,000 and 40 staff hours
- WHEN the staff report runs
- THEN sales per hour worked is 50,000

#### Scenario: Corrected clock event
- GIVEN a clock-out corrected by the administrator
- WHEN hours are reported
- THEN the corrected value is used

### Requirement: Cloud History Projections

The cloud SHALL build history from synced events, counting each once by device and sequence. A site with a stale sync cursor MUST show as lagging, never as zero sales.

#### Scenario: Duplicate after outage
- GIVEN a batch resent after a 2-hour outage
- WHEN projections run
- THEN totals are unchanged

#### Scenario: Lagging site
- GIVEN a site still offline
- WHEN its history for today is viewed
- THEN the site is flagged as lagging

### Requirement: Role-Scoped Access

Every report MUST be filtered by the reader's scope. A supervisor MUST see only the current shift; a site administrator only their site; a waiter MUST NOT see register counts or others' data.

#### Scenario: Other site
- GIVEN an administrator of site 1
- WHEN they request site 2 history
- THEN access is denied

#### Scenario: Supervisor history
- GIVEN a supervisor
- WHEN they open a previous shift
- THEN access is denied
