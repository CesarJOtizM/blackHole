# Producible Quantity Specification

## Purpose

Tell, per product and site, how many units can be prepared and what limits them, and turn that into a real-time availability state (TRD-00 sec. 9.3).

## Requirements

### Requirement: Units Producible From Point Stock

The system MUST compute, per product variant and site, whole producible units as the minimum over current-recipe ingredients of point stock ÷ quantity per unit. An intermediate preparation with own stock SHALL count as one ingredient. Stock ≤ 0 MUST yield zero.

#### Scenario: Minimum across ingredients
- GIVEN a burger needs 150 g of beef and 1 bun
- AND the point holds 3,000 g of beef and 12 buns
- WHEN producible units are computed
- THEN the result is 12 units

#### Scenario: Negative stock
- GIVEN beef stock at the point is -200 g
- WHEN producible units are computed for the burger
- THEN the result is 0 units, never a negative number

### Requirement: Limiting Ingredient

The system MUST identify the ingredient that yields the minimum (the bun in the example above). On a tie it SHALL report every tied ingredient.

#### Scenario: Ingredient missing from the point
- GIVEN the point has no balance row for buns
- WHEN the limiting ingredient is requested
- THEN buns are reported as limiting with 0 units

#### Scenario: Tie
- GIVEN beef and buns both allow exactly 12 units
- WHEN the limiting ingredient is requested
- THEN both ingredients are reported

### Requirement: Units With Restocking

The system MUST also compute units with point stock plus supplying-warehouse stock; this MUST NOT drive menu availability. Stock owned by another node SHALL be the last synced value, with its timestamp.

#### Scenario: Site warehouse adds capacity
- GIVEN the point allows 12 burgers and the site warehouse adds 40 buns and enough beef
- WHEN units with restocking are computed
- THEN the result is 52 and the menu still uses 12

#### Scenario: General warehouse offline
- GIVEN a hybrid site lost internet two hours ago
- WHEN units with restocking are computed
- THEN general-warehouse stock is used as of the last sync
- AND the result shows that sync timestamp

### Requirement: Recalculation On Stock Change

Every point stock movement MUST recalculate only the products whose recipes use that ingredient. A new recipe version SHALL recalculate that product.

#### Scenario: Consumption on send to kitchen
- GIVEN a burger is sent to the kitchen
- WHEN its consumption is recorded
- THEN every product using beef or buns is recalculated

#### Scenario: Unrelated ingredient
- GIVEN a purchase of lemons is received at the point
- WHEN recalculation runs
- THEN products without lemons in their recipe are not re-evaluated

### Requirement: Availability State

Per product and site the state MUST be `sold out` at zero point units, `low units` at or below the product threshold (never without one), otherwise `available`. A computed state MUST NOT block sending or charging (PRD-00 rule 1).

#### Scenario: Low units
- GIVEN the burger threshold is 5 and point units drop from 6 to 5
- WHEN the state is derived
- THEN the burger becomes `low units`

#### Scenario: Sold out does not block the sale
- GIVEN the burger is `sold out`
- WHEN a waiter still sends one
- THEN the line is accepted, stock goes negative and the state stays `sold out`

### Requirement: Real-Time Availability Event

The point owner MUST emit an availability event (site, product, state) only on state transitions; the waiter menu SHALL reflect it within 2 s (p90). Hybrid: the node evaluates and notifies, also offline. Cloud mode: the cloud evaluates; an outage stops the dining room and state is recomputed on reconnection. The event MUST NOT expose costs.

#### Scenario: Hybrid site offline
- GIVEN a hybrid site without internet
- WHEN the last bun is consumed
- THEN waiter phones on the node network show the burger `sold out` within 2 s

#### Scenario: No transition, no event
- GIVEN the burger is `available` with 30 units
- WHEN units drop to 29
- THEN no availability event is emitted
