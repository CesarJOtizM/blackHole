# Delta for Reporting

## ADDED Requirements

### Requirement: Consolidated Company View

The system MUST present sales, times and cost metrics aggregated by company, brand and site for a chosen period, computed only from events already synced to the cloud. The consolidated view MUST be served by api-cloud (PostgreSQL) for both cloud-mode and hybrid sites; local-node SHALL NOT replicate other sites' history.

#### Scenario: General manager sees all sites

- GIVEN a company with 6 sites whose events are synced
- WHEN the general manager opens the consolidated view for last week
- THEN each site and the company total are shown
- AND the company total equals the sum of the sites

#### Scenario: Role scope limits the view

- GIVEN a site administrator of site 1
- WHEN they request the consolidated view
- THEN only site 1 data is returned
- AND site 2 data is never included

### Requirement: Lagging Site Indication

The consolidated view MUST flag a site as lagging when its sync cursor is behind the requested period and MUST NOT fill missing data with zeros.

#### Scenario: Hybrid site offline

- GIVEN a hybrid site whose node has been offline for 2 hours
- WHEN the consolidated view for today is requested
- THEN that site is marked lagging with its last synced time
- AND its sales are not shown as zero

#### Scenario: Catch-up without duplicates

- GIVEN the same site reconnects and its batch arrives twice
- WHEN projections catch up
- THEN totals include each event exactly once

### Requirement: Percentiles by Dimension

Every time metric (PRD-00 sec. 8.1) MUST be filterable by site, brand, product, kitchen station, person (waiter or courier), time slot and weekday, returning average, p50 and p90 with the same definition in node and cloud. A time with a missing endpoint MUST be excluded, not estimated.

#### Scenario: Preparation time by station

- GIVEN synced kitchen ticket events for the grill station
- WHEN the manager filters preparation time by station and Friday
- THEN average, p50 and p90 are returned for that subset

#### Scenario: Missing final state

- GIVEN a ticket that never reached "ready"
- WHEN preparation time is computed
- THEN that ticket is excluded from the set

### Requirement: Menu Engineering

The system MUST classify each dish by popularity and margin for a period, using M4 theoretical cost. Without cost data, the dish MUST appear with popularity only and margin "unclassified". Viewing margin MUST require the view-costs permission.

#### Scenario: Dish classified

- GIVEN dishes with sales and recipe cost in the period
- WHEN the manager opens menu engineering
- THEN each dish shows its popularity and margin class

#### Scenario: Dish without cost

- GIVEN a dish with no recipe cost
- WHEN menu engineering is computed
- THEN its margin is shown as unclassified

#### Scenario: No cost permission

- GIVEN a user without the view-costs permission
- WHEN they request menu engineering
- THEN margin values are not returned

### Requirement: Cloud Behavior Detectors

The cloud MUST evaluate synced audit and operation events against the configured thresholds (PRD-01 sec. 11) for voids, discounts, no-sale drawer openings, repeated actor/authorizer pairs and self-authorization, and MUST open one alert per pattern occurrence that references the underlying events. Detectors MUST NOT write operational data. Events produced during an outage SHALL be evaluated when they arrive.

#### Scenario: Repeated voids in a shift

- GIVEN a void threshold of 5 per shift
- WHEN a shift accumulates 6 voids by one user
- THEN one alert is opened listing those voids
- AND the owner is notified through the configured in-app channel

#### Scenario: Re-delivered events

- GIVEN an alert already opened for a pattern
- WHEN the same events arrive again in a duplicated batch
- THEN no second alert is opened

#### Scenario: Detector has no side effects

- GIVEN an open alert for a cashier
- WHEN it is raised
- THEN no order, payment or shift record is modified
