# Recipes Specification

## Purpose

Brand ingredients and versioned recipes (PRD-M4 HU-M4-01, TRD-M4 sec. 2, TRD-00 sec. 9.1–9.2).

## Requirements

### Requirement: Ingredient Units

Each ingredient MUST have a base unit (gram, millilitre or unit) plus purchase and recipe units with non-zero conversion factors. Quantities MUST be stored as scaled integers in base unit.

#### Scenario: Purchase unit converts
- GIVEN "rice" with purchase unit "50 kg sack" (factor 50000 g)
- WHEN 2 sacks are converted
- THEN the result is 100000 g

#### Scenario: Zero factor rejected
- GIVEN an ingredient being edited
- WHEN a unit factor is set to 0
- THEN the change is rejected naming the unit

### Requirement: Recipe per Product and Variant

A recipe MUST belong to a brand product and MAY target a variant, else the product recipe applies. Lines MUST state ingredient or sub-recipe, net quantity and yield (default 100 %); gross = net ÷ yield.

#### Scenario: Variant overrides product
- GIVEN "burger" and variant "double" each with a recipe
- WHEN "double" is resolved
- THEN the variant recipe is used

#### Scenario: Yield applied
- GIVEN 150 g net onion at 75 % yield
- WHEN exploded for one unit
- THEN 200 g gross onion is required

### Requirement: Sub-recipes Without Cycles

A recipe MAY use sub-recipes, which MAY be marked as stocked. Non-stocked sub-recipes MUST expand into their ingredients. A publish creating a cycle MUST be rejected.

#### Scenario: Sub-recipe expands
- GIVEN "lasagna" uses non-stocked "bechamel"
- WHEN exploded
- THEN bechamel ingredients appear scaled by the lasagna line

#### Scenario: Cycle rejected
- GIVEN "sauce A" uses "sauce B"
- WHEN "sauce B" is edited to use "sauce A"
- THEN the publish is rejected naming the cycle

### Requirement: Modifier Adjustments

A catalog modifier MAY declare ingredient deltas that add or subtract. No exploded quantity MUST go below zero.

#### Scenario: Extra and without
- GIVEN "burger" uses 30 g cheese and 20 g onion
- WHEN exploded with "extra cheese" (+30 g) and "no onion" (−20 g)
- THEN cheese is 60 g and onion 0 g

#### Scenario: Floor at zero
- GIVEN −50 g on a 20 g line
- WHEN exploded
- THEN it is 0 g

### Requirement: Immutable Versions

Publishing MUST create a new version; a published version MUST NOT change. Only holders of "edit recipes" (PRD-01 sec. 6.3) MUST publish, and each version MUST be audited.

#### Scenario: Edit creates version
- GIVEN version 3 is current
- WHEN an owner publishes a change
- THEN version 4 is current, version 3 stays unchanged and the author is audited

#### Scenario: Unauthorized edit
- GIVEN a site administrator without "edit recipes"
- WHEN they publish
- THEN it is denied

### Requirement: Distribution by Operating Mode

Only the cloud MUST write recipes; cloud-mode sites read them there. Hybrid nodes MUST receive each version and keep their last copy offline.

#### Scenario: Version reaches node
- GIVEN a connected hybrid site
- WHEN a version is published
- THEN the node uses it for new lookups

#### Scenario: Outage keeps copy
- GIVEN an offline node holding version 3
- WHEN version 4 is published
- THEN the node keeps version 3 and applies version 4 once on reconnect

### Requirement: Excel Import

The system MUST import ingredients and recipes from a spreadsheet. Invalid rows MUST be reported with row number and reason, and then nothing from that file MUST be published.

#### Scenario: Valid import
- GIVEN a valid file
- WHEN imported
- THEN each dish has version, yield and cost

#### Scenario: Invalid row
- GIVEN row 17 has an unknown ingredient
- WHEN imported
- THEN row 17 is reported and nothing published

### Requirement: Theoretical Cost and Margin

Theoretical cost MUST come from the exploded recipe and each ingredient's unit cost (reference cost until an average cost exists); margin MUST compare against the site price. Only holders of "view costs and margins" MUST see them.

#### Scenario: Cost and margin
- GIVEN exploded cost 8000 COP and price 20000 COP
- WHEN an administrator views the dish
- THEN cost 8000 and margin 60 % are shown

#### Scenario: Waiter sees no costs
- GIVEN a waiter session
- WHEN product costs are requested
- THEN no cost data is returned
