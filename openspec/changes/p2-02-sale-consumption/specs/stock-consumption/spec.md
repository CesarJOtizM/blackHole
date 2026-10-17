# Stock Consumption Specification

## Purpose

Deduct recipe ingredients from the site's point-of-sale location on send-to-kitchen, and return or record waste on voids (PRD-00 rules 1–2, PRD-M4 HU-M4-02, TRD-00 sec. 9.2, TRD-M4 sec. 4).

## Requirements

### Requirement: Deduct on Send to Kitchen

On send-to-kitchen, the location owner MUST explode the current recipe version (variant and modifiers applied) and record one sale consumption per ingredient at the site's single point-of-sale location, storing the version used. The kitchen station MUST NOT change the location.

#### Scenario: Line deducts ingredients
- GIVEN "burger" version 4 uses 150 g beef and 30 g cheese
- WHEN 2 burgers are sent to the grill station
- THEN −300 g beef and −60 g cheese referencing version 4 are recorded at the point of sale

#### Scenario: Bar shares the location
- GIVEN a cocktail routed to the bar
- WHEN sent
- THEN it deducts from the same point-of-sale location

#### Scenario: Product without recipe
- GIVEN a product with no recipe
- WHEN sent
- THEN the send succeeds, no movement is recorded and it is listed as "missing recipe"

### Requirement: Version Fixed at Send Time

Later recipe versions MUST NOT alter recorded consumption or its reversal.

#### Scenario: Recipe changes mid-service
- GIVEN a line sent with version 4
- WHEN version 5 is published and the line is voided after start
- THEN the waste uses version 4 quantities

#### Scenario: New send uses new version
- GIVEN version 5 is current
- WHEN a new line is sent
- THEN consumption uses version 5

### Requirement: Stocked Preparations

Stocked sub-recipes MUST be deducted as the preparation; non-stocked ones MUST expand into ingredients.

#### Scenario: Stocked sauce
- GIVEN "pasta" uses 80 g stocked "tomato sauce"
- WHEN sent
- THEN −80 g tomato sauce is recorded and tomatoes are untouched

#### Scenario: Non-stocked dressing
- GIVEN "salad" uses non-stocked "vinaigrette"
- WHEN sent
- THEN vinaigrette ingredients are deducted

### Requirement: Void Before or After Kitchen Start

A void before kitchen start MUST record a sale return of the same quantities. A void after start MUST record audited waste with the void reason and user. A line MUST NOT receive both.

#### Scenario: Void before start
- GIVEN a sent line not started
- WHEN voided
- THEN return movements restore the quantities

#### Scenario: Void after start
- GIVEN a line in preparation
- WHEN voided with reason "customer left"
- THEN waste is recorded with reason and user, and no return

### Requirement: Negative Stock Never Blocks

Insufficient stock MUST NOT block a send. The balance MAY go negative and one negative-stock alert per ingredient MUST be raised on kitchen and cash screens.

#### Scenario: Sale continues
- GIVEN 100 g beef on hand
- WHEN a line needing 300 g is sent
- THEN the send succeeds, balance is −200 g and an alert opens

#### Scenario: Alert not repeated
- GIVEN an open negative-stock alert for beef
- WHEN another beef line is sent
- THEN no second alert opens

### Requirement: Idempotent Consumption

Repeated delivery of the same send or void for an order line MUST NOT record movements twice.

#### Scenario: Retried send
- GIVEN a line already consumed
- WHEN the send is redelivered
- THEN nothing new is recorded

#### Scenario: Retried void
- GIVEN a void already returned
- WHEN redelivered
- THEN no extra return is recorded

### Requirement: Operation by Mode

In hybrid mode consumption MUST be recorded on the site node, including during an outage, with the node's copied recipe version. In cloud mode the cloud MUST record it; an outage stops sends, so nothing is recorded until service resumes.

#### Scenario: Hybrid outage
- GIVEN an offline hybrid site
- WHEN lines are sent
- THEN consumption is stored locally and synced once on reconnect

#### Scenario: Cloud-mode outage
- GIVEN a cloud-mode site that lost internet
- WHEN sends resume after reconnect
- THEN consumption exists only for lines actually sent
