# Delta for Reporting

## ADDED Requirements

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
