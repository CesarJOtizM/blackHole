# Delta for Catalog

## ADDED Requirements

### Requirement: Effective Menu Availability

The waiter menu MUST show a product as orderable only when site manual availability and schedule (from 1.1) allow it; the computed inventory state SHALL then be shown on top. A product manually disabled or out of schedule MUST stay hidden or disabled regardless of stock.

#### Scenario: Manual availability wins
- GIVEN the site disabled "fish of the day" manually
- AND inventory allows 20 units
- WHEN the waiter opens the menu
- THEN the product is not orderable

#### Scenario: Inventory state shown
- GIVEN a product enabled and in schedule
- AND its computed state is `low units` with 3 units
- WHEN the waiter opens the menu
- THEN the product is orderable and flagged as low units

### Requirement: Products Without Recipe

A product with no active recipe MUST be excluded from automatic availability and SHALL keep only its manual availability.

#### Scenario: Bottled drink without recipe
- GIVEN a bottled soda has no recipe
- WHEN availability is derived
- THEN no inventory state is attached and the soda follows manual availability

#### Scenario: Recipe added later
- GIVEN the soda gets its first recipe version
- WHEN that version reaches the site
- THEN the soda starts receiving computed availability

### Requirement: Low-Units Threshold Per Product

The catalog MUST allow a low-units threshold per product and site, as a non-negative whole number, owned by the cloud like the rest of the catalog. Only roles with permission to configure stock levels (PRD-01 sec. 6.3) MAY change it, and each change MUST be audited. The waiter MUST NOT see costs or margins in the menu.

#### Scenario: Admin sets the threshold
- GIVEN a site administrator
- WHEN the burger threshold is set to 5
- THEN the change is audited and applies to the next availability derivation

#### Scenario: Waiter cannot change it
- GIVEN a waiter session
- WHEN the waiter tries to set a threshold
- THEN the request is rejected for missing permission

#### Scenario: Change made while a hybrid site is offline
- GIVEN a hybrid site without internet
- WHEN the administrator changes the threshold from the web admin
- THEN the node keeps using its last copy
- AND the new threshold applies on the node after reconnection
