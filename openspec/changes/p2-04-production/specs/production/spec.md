# Production Specification

## Purpose

Register production of stocked intermediate preparations, which consume ingredients and generate their own stock (PRD-00 sec. 6.6, TRD-00 sec. 9.1–9.2, TRD-M4 sec. 4).

## Requirements

### Requirement: Production Run

A run MUST name a stocked preparation, a location (point of sale or warehouse) and a quantity, and MUST record production-consumption per exploded ingredient and one production-output for the preparation, at that location, in one transaction. Non-stocked preparations MUST NOT be producible.

#### Scenario: Sauce run
- GIVEN stocked "tomato sauce" yields 5000 g from 6000 g tomato and 500 g onion
- WHEN the kitchen chief registers 5000 g at the point of sale
- THEN −6000 g tomato, −500 g onion and +5000 g sauce are recorded there

#### Scenario: Non-stocked rejected
- GIVEN non-stocked "vinaigrette"
- WHEN a run is attempted
- THEN it is rejected with no movement

#### Scenario: Atomic failure
- GIVEN a run with 3 ingredients
- WHEN storing the output fails
- THEN no consumption persists

### Requirement: Recipe Version Recorded

A run MUST use the preparation version current at the location and store it on its movements.

#### Scenario: Version stored
- GIVEN sauce version 2 is current
- WHEN a run is registered
- THEN its movements reference version 2

#### Scenario: Offline node copy
- GIVEN an offline hybrid node holding version 2 while the cloud has version 3
- WHEN a run is registered
- THEN version 2 is used

### Requirement: Yield Variance

The user MUST enter actual output. Consumption MUST follow the recipe for the intended batch, and expected minus actual output MUST be stored and visible to holders of "view costs and margins".

#### Scenario: Lower output
- GIVEN a batch expected at 5000 g
- WHEN actual output is 4600 g
- THEN +4600 g is recorded with −400 g variance

#### Scenario: Burned batch
- GIVEN actual output 0
- WHEN registered
- THEN ingredients are consumed, no output is recorded and the full batch is variance

### Requirement: Output Cost

Output unit cost MUST equal consumed average cost divided by actual output, and MUST update the preparation's average cost as a real-cost entry.

#### Scenario: Cost computed
- GIVEN consumed cost 24000 COP
- WHEN actual output is 4000 g
- THEN output cost is 6 COP/g

#### Scenario: Ingredient goes negative
- GIVEN tomato below the required quantity
- WHEN a run is registered
- THEN it succeeds, tomato goes negative and an alert opens

### Requirement: Sale Deducts the Preparation

Products using a stocked preparation MUST deduct the preparation, not its ingredients, on send-to-kitchen.

#### Scenario: Pasta after production
- GIVEN 4600 g sauce on hand
- WHEN a pasta using 80 g is sent
- THEN sauce is 4520 g and tomato unchanged

#### Scenario: Not produced yet
- GIVEN sauce balance 0 g
- WHEN a pasta is sent
- THEN the sale continues, sauce is −80 g and an alert opens

### Requirement: Corrections and Audit

Runs MUST NOT be edited. A wrong run MUST be reversed by a compensating run referencing it, by a holder of "adjust inventory" or with supervisor authorization. Runs and corrections MUST be audited.

#### Scenario: Compensating run
- GIVEN a mistaken 5000 g run
- WHEN an administrator corrects it
- THEN reverse movements reference the original

#### Scenario: Unauthorized correction
- GIVEN a kitchen chief
- WHEN correcting a run
- THEN supervisor authorization is required before anything changes

### Requirement: Operation by Mode

Hybrid site and warehouse nodes MUST record runs during an outage and sync later. Cloud-mode sites MUST record runs in the cloud, unavailable during an outage.

#### Scenario: Offline hybrid run
- GIVEN an offline hybrid site
- WHEN a run is registered
- THEN it is stored on the node and synced once on reconnect

#### Scenario: Cloud-mode outage
- GIVEN a cloud-mode site offline
- WHEN a run is attempted
- THEN it cannot be recorded until reconnect
