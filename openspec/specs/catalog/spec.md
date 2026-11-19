# Catalog Specification

## Purpose

Brand menu and per-site adjustments (PRD-M1 sec. 2, 5; TRD-M1 sec. 2-3). Bounded context: `orders`. The cloud owns the menu.

## Requirements

### Requirement: Brand-Owned Products and Variants

The system MUST store products, with optional variants such as size, under one brand. A site MUST only see the menu of its own brand.

#### Scenario: Product with variants
- GIVEN brand B with product "Burger" and variants "single" and "double"
- WHEN an admin of brand B publishes the product
- THEN every site of brand B lists "Burger" with both variants

#### Scenario: Other brand isolated
- GIVEN site S belongs to brand A
- WHEN site S requests its menu
- THEN no product of brand B is returned

### Requirement: Modifiers With and Without Cost

A product MAY have modifiers. A modifier SHALL either add a price or add nothing to the price.

#### Scenario: Paid modifier
- GIVEN "Burger" priced 20,000 with modifier "extra cheese" at 3,000
- WHEN a waiter selects the modifier
- THEN the line price is 23,000

#### Scenario: Foreign modifier rejected
- GIVEN modifier "no ice" belongs only to drinks
- WHEN it is attached to "Burger" in an order line
- THEN the system rejects the line

### Requirement: Combos

The system MUST support combos sold at one price and composed of existing products.

#### Scenario: Combo sold as a unit
- GIVEN combo "Lunch" with a burger and a soda at 28,000
- WHEN the combo is shown in the menu
- THEN it appears as one item priced 28,000 with its components listed

#### Scenario: Unavailable component
- GIVEN the soda of combo "Lunch" is unavailable at site S
- WHEN site S shows its menu
- THEN combo "Lunch" is shown as unavailable

### Requirement: Mandatory Tax Classification

Every sellable product MUST carry a tax classification. The catalog MUST NOT compute taxes.

#### Scenario: Classified product published
- GIVEN product "Lemonade" classified as "restaurant service"
- WHEN it is published
- THEN the classification is part of the menu copy

#### Scenario: Missing classification
- GIVEN a product without tax classification
- WHEN an admin tries to publish it
- THEN publication is rejected with a validation error

### Requirement: Site Price, Availability and Schedule

A site MAY override price, manual availability and selling schedule. An override MUST NOT change the brand product or other sites.

#### Scenario: Site price override
- GIVEN brand price 20,000 for "Burger"
- WHEN site S sets 22,000
- THEN site S sells at 22,000 and other sites keep 20,000

#### Scenario: Outside schedule
- GIVEN "Breakfast" is sold at site S from 07:00 to 11:00 by node clock
- WHEN a waiter browses the menu at 12:00
- THEN "Breakfast" is shown as not orderable

### Requirement: Menu Edit Permission

Editing the menu and prices MUST require the permission from PRD-01 sec. 6.4 within the editor's scope and cap, and MUST be audited with before and after values.

#### Scenario: Admin edits own site
- GIVEN a site admin of site S
- WHEN she changes a site price within her cap
- THEN the change is saved and an audit event records old and new price

#### Scenario: Outside scope
- GIVEN a site admin of site S
- WHEN she edits the price of site T
- THEN the request is denied and nothing changes

### Requirement: Menu Copy to the Operating Site

The menu MUST reach the server that operates the site. In hybrid mode the node MUST hold a versioned copy; in cloud mode the site reads the cloud directly and has no menu during a cut.

#### Scenario: Waiter phone shows menu
- GIVEN a published menu for site S
- WHEN a registered waiter phone opens the menu
- THEN it shows products, variants, modifiers, combos, site prices and availability in force

#### Scenario: Change during an internet cut (hybrid)
- GIVEN site S is hybrid and offline
- WHEN an admin changes a price in the web
- THEN the node keeps selling with its current copy
- AND the new version applies on the node after reconnection, exactly once

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
