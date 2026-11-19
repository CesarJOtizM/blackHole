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

### Requirement: Food Cost Percentage

The system MUST compute food cost per site and period as theoretical cost of what was sold divided by net sales, using the recipe version stored on each consumption movement. Sold products without a recipe MUST be excluded and listed, not costed as zero.

#### Scenario: Weekly food cost
- GIVEN a week with net sales of 10,000,000 and theoretical cost of sold items of 3,200,000
- WHEN the administrator opens food cost
- THEN 32% is shown for that site and week

#### Scenario: Recipe changed mid-period
- GIVEN the burger recipe changed on Wednesday
- WHEN the week is reported
- THEN Monday–Tuesday sales use the old version and later sales the new one

#### Scenario: Product without recipe
- GIVEN a sold product with no recipe
- WHEN food cost is computed
- THEN the product is listed as uncosted and excluded from the ratio

### Requirement: Theoretical Versus Actual

The system MUST compare, per site, location and ingredient, theoretical consumption (recipes of what was sold and produced) with actual consumption (opening count + entries − closing count) between two approved counts, in quantity and at average cost. Recorded waste SHALL be shown as a separate column of the difference.

#### Scenario: Difference between counts
- GIVEN approved counts on the 1st and the 8th and theoretical beef use of 40 kg
- WHEN actual use is 43 kg
- THEN a 3 kg difference and its value are shown

#### Scenario: No closing count
- GIVEN a period with only an opening count
- WHEN the report is requested
- THEN the period is shown as pending a closing count, not as zero difference

### Requirement: Waste, Value And Rotation

The system MUST report waste by reason, ingredient, location and responsible; inventory value per location at weighted average cost; and rotation and days of inventory per ingredient. Stock owned by another node SHALL show its last-sync timestamp.

#### Scenario: Waste by reason
- GIVEN waste recorded as expired and as preparation error
- WHEN the waste report is filtered by reason
- THEN each reason shows quantity, value and responsible

#### Scenario: General warehouse value
- GIVEN the general warehouse last synced 3 hours ago
- WHEN the site views inventory value
- THEN the warehouse value shows that sync time

### Requirement: Producible Dishes And Alerts

The system MUST report producible units today with the limiting ingredient, open shortage alerts by site and level, average attention time, stockouts (times an ingredient reached zero) and coverage hours per ingredient.

#### Scenario: Stockout count
- GIVEN beef reached zero twice this week
- WHEN the alert report is opened
- THEN beef shows 2 stockouts

#### Scenario: Unseen alert
- GIVEN an alert still open and never seen
- WHEN average attention time is computed
- THEN that alert is excluded from the average and counted as open

### Requirement: Day And History Sources

Day inventory reports MUST be served by the owner of the operation: the node in hybrid mode, including during an outage, or the cloud in cloud mode, where an outage leaves no report. History MUST come from cloud projections that count a duplicated event once and flag a lagging site instead of showing zeros.

#### Scenario: Hybrid outage
- GIVEN a hybrid site without internet
- WHEN the administrator opens today's waste and alerts
- THEN the node answers with local data

#### Scenario: Duplicate batch
- GIVEN a node resends a batch after reconnecting
- WHEN projections run
- THEN totals do not change

### Requirement: Cost Access

Cost, value and margin figures MUST require the view-costs permission (PRD-01 sec. 6.3) and the role's scope; a site administrator SHALL see only their site.

#### Scenario: Other site
- GIVEN the administrator of site 1
- WHEN requesting food cost of site 2
- THEN the request is rejected

#### Scenario: Waiter
- GIVEN a waiter session
- WHEN any cost report is requested
- THEN no cost data is returned
