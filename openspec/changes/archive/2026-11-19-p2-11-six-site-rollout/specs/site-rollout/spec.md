# Delta for Site Rollout

## ADDED Requirements

### Requirement: Technical Visit For Each Remaining Site

Each of the 5 remaining pilot sites MUST have a completed technical visit before installation: Wi-Fi coverage (dining room, kitchen, cash register, other floors), router model and client isolation, dedicated-router decision, printer connections, and the site mode (cloud or hybrid) recorded. An unregistered phone on the site network MUST NOT be able to use the node or print.

#### Scenario: Visit passes
- GIVEN site 3 completes every checklist item
- WHEN the visit is closed
- THEN the site is cleared for installation with its mode recorded

#### Scenario: Unregistered phone can print
- GIVEN an unregistered phone prints a test ticket at site 4
- WHEN the visit is reviewed
- THEN the site is not cleared until the network is fixed and retested

### Requirement: Hardware Kit Verified Per Mode

A hybrid site MUST have node, UPS, printers and dedicated router (or approved isolation) installed, and SHOULD have a 4G backup modem. A cloud-mode site with printers MUST have its print bridge. Verification MUST include a print on every printer and a cash drawer opening.

#### Scenario: Hybrid kit
- GIVEN a hybrid site with node, UPS and printers installed
- WHEN verification runs
- THEN every printer prints and the drawer opens from the cash register

#### Scenario: Missing UPS
- GIVEN a hybrid site without UPS
- WHEN verification runs
- THEN the site is not accepted as hybrid

### Requirement: Data Load

Before go-live each site MUST have verified organization data (taxpayer, site, kitchen stations, cash registers, warehouses), menu with site prices, ingredients, recipes for every product sold, levels, supply relations, staff with roles and PIN, and registered devices. Hybrid nodes MUST hold this data after sync.

#### Scenario: Complete load
- GIVEN all data is loaded for site 5
- WHEN the load check runs
- THEN no product sold lacks a recipe or is explicitly excluded

#### Scenario: Product without recipe
- GIVEN a product sold at site 2 has no recipe
- WHEN the load check runs
- THEN it is listed as blocking for the inventory measurement

### Requirement: Role Training Recorded

Each site MUST record training per role (waiter, cashier, supervisor, kitchen chief, warehouse keeper, site administrator), with attendees and date. Each trained role MUST perform its core flow once in the system.

#### Scenario: Waiter training
- GIVEN waiters attend training
- WHEN each sends a test order to the kitchen
- THEN their attendance and the test are recorded

#### Scenario: Untrained role
- GIVEN no warehouse keeper was trained at site 6
- WHEN acceptance is requested
- THEN the site is not accepted

### Requirement: Per-Site Acceptance

A site MUST be accepted only after a full service operated solely with the system, with DIAN documents accepted, consumption recorded and attendance clocked. Sites SHOULD go live one at a time.

#### Scenario: Accepted service
- GIVEN a full service at site 3 with accepted invoices and consumption
- WHEN acceptance is reviewed
- THEN site 3 is marked live

#### Scenario: Outage during acceptance service
- GIVEN a hybrid site loses internet mid-service
- WHEN connection returns
- THEN pending invoices are issued and the service still counts

### Requirement: One-Month Theoretical Versus Actual Measurement

At least 3 sites MUST run one continuous month with an approved opening count, an approved closing count, and every purchase, transfer, production and waste recorded. The difference per site and ingredient MUST come from the theoretical-vs-actual report. A hybrid site's offline days SHALL count once synchronized, without duplicates.

#### Scenario: Measurement completed
- GIVEN sites 1, 2 and 3 complete opening and closing counts one month apart
- WHEN the administrator opens the report
- THEN each site shows its difference per ingredient and in value

#### Scenario: Gap in purchase records
- GIVEN site 2 skipped recording purchases for two days
- WHEN the month is reviewed
- THEN site 2's month is invalid and must restart, or another site replaces it
