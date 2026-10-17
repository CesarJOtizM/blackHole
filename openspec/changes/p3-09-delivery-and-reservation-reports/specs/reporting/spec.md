# Delta for Reporting

## ADDED Requirements

### Requirement: Delivery and Platform Times

The system MUST compute platform acceptance, platform rider wait, delivery preparation, dispatch, en route and total delivery time (PRD-00 sec. 8.1) from timestamps of the operation owner, filterable by site, channel, courier, slot and weekday, with average, p50 and p90. A time with a missing endpoint MUST NOT produce a value.

#### Scenario: En route time
- GIVEN a delivery dispatched 12:10 and delivered 12:35
- WHEN the times report is viewed
- THEN en route time is 25 minutes for that courier

#### Scenario: Missing delivery stamp
- GIVEN a dispatched delivery never confirmed
- WHEN times are computed
- THEN it is excluded from en route and total, not counted as zero

### Requirement: Sales by Channel

The system MUST report net sales by channel: waiter table, QR table, counter, own delivery and each platform.

#### Scenario: Channels split
- GIVEN sales from tables, own delivery and Rappi in a day
- WHEN sales by channel are viewed
- THEN each channel shows its own net sales

#### Scenario: Manual capture
- GIVEN a DiDi order captured manually
- WHEN sales by channel are viewed
- THEN it counts under DiDi Food, not counter

### Requirement: Platform Metrics

The system MUST report per platform: net sales after commissions and fees, rejected or cancelled orders with count, reason and value, and settlement differences.

#### Scenario: Net per platform
- GIVEN Rappi sales 2,000,000 and fees 440,000
- WHEN the platform report is viewed
- THEN net sales show 1,560,000

#### Scenario: Unsettled period
- GIVEN no settlement imported for a period
- WHEN differences are viewed
- THEN the period shows "not reconciled", not zero difference

### Requirement: Reservation Reports

The system MUST report reservations by day, slot and channel; no-show rate (no-shows ÷ confirmed); occupancy (reserved guests ÷ slot capacity); income (deposits credited, fees charged, amounts retained); and average ticket of reserved vs non-reserved tables.

#### Scenario: No-show rate
- GIVEN 20 confirmed reservations and 3 no-shows in a week
- WHEN the report is viewed
- THEN the no-show rate is 15%

#### Scenario: Unresolved conflicts
- GIVEN provisional reservations still in conflict
- WHEN the report is viewed
- THEN they are listed apart and excluded from confirmed counts

### Requirement: Day and History Sources

Today's delivery and reservation reports MUST be served by the operation owner: the node in hybrid mode, also offline; `api-cloud` in cloud mode. History MUST come from cloud projections that count each event once and mark lagging sites.

#### Scenario: Hybrid site offline
- GIVEN a hybrid site without internet
- WHEN the admin opens today's delivery times
- THEN the node answers with locally captured stages

#### Scenario: Lagging site
- GIVEN a hybrid site whose events have not synced
- WHEN the history is viewed in the cloud
- THEN the site is marked lagging, not shown with zero sales
