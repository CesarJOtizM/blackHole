# Organization Specification

## Purpose

Define the customer structure every module relies on: company, taxpayers, brands, sites, kitchen stations, cash registers and inventory locations (PRD-00 5, TRD-00 4, TRD-M0 2). The cloud owns the structure; a hybrid node holds a read-only copy of its own site.

## Requirements

### Requirement: Company, Taxpayers and Brands

A company MUST be able to hold several taxpayers and several brands. A NIT MUST be unique within a company. Each taxpayer MUST carry a tax profile reference.

#### Scenario: Two taxpayers
- GIVEN a company
- WHEN two taxpayers with different NITs are added
- THEN both exist with their tax profiles

#### Scenario: Duplicate NIT
- GIVEN a taxpayer with NIT 900123456
- WHEN another taxpayer with the same NIT is added to that company
- THEN it is rejected

### Requirement: Site Invoices Through Exactly One Taxpayer

Each site MUST belong to one brand and invoice through exactly one taxpayer of its company. Replacing the taxpayer MUST require an explicit replace command and MUST leave exactly one.

#### Scenario: Site created
- GIVEN a brand and a taxpayer of the same company
- WHEN a site is created with both
- THEN the site invoices through that taxpayer

#### Scenario: Implicit second taxpayer
- GIVEN a site with a taxpayer
- WHEN another taxpayer is attached without the replace command
- THEN it is rejected and the site keeps one taxpayer

### Requirement: Inventory Locations

Each site MUST have exactly one point location, created with the site, and MAY have site warehouses. A company MAY have general warehouses not tied to a site.

#### Scenario: Point created with site
- GIVEN a new site
- WHEN it is saved
- THEN it has exactly one point location

#### Scenario: Second point
- GIVEN a site with its point
- WHEN another point is added to it
- THEN it is rejected

### Requirement: Kitchen Stations and Cash Registers

A site MUST be able to hold several kitchen stations and cash registers. Stations MUST only route items and MUST NOT hold stock.

#### Scenario: Stations and registers
- GIVEN a site
- WHEN a grill station, a bar station and two registers are added
- THEN all belong to that site

#### Scenario: Stock on a station
- GIVEN a kitchen station
- WHEN stock is assigned to it
- THEN it is rejected

### Requirement: Structure Owned by the Cloud

Structure changes MUST be made only in api-cloud. In cloud mode, a cut MUST prevent editing. In hybrid mode, the node MUST keep using its copy during a cut, and web changes MUST reach it on reconnect.

#### Scenario: Edit on the node
- GIVEN a hybrid node
- WHEN a structure change is attempted on it
- THEN it is rejected

#### Scenario: Change during a cut
- GIVEN a hybrid site offline
- WHEN a register is added on the web
- THEN the node keeps its copy and receives the register on reconnect

### Requirement: Tenant Isolation

Every structure record in PostgreSQL MUST be scoped by tenant, and reads MUST never return another tenant's records, even if the query omits the filter. SQLite MUST hold only its site.

#### Scenario: Cross-tenant read
- GIVEN companies A and B
- WHEN a query in tenant A requests all sites
- THEN only A's sites return

#### Scenario: Node copy
- GIVEN a node of site 1
- WHEN its store is inspected
- THEN no other site's data is present

### Requirement: Structure Changes Recorded

Every create or change of site, taxpayer, register, station or warehouse MUST emit an organization-changed event with actor, before and after.

#### Scenario: Register renamed
- GIVEN a register
- WHEN an administrator renames it
- THEN an event records actor, old and new name

#### Scenario: Rejected change
- GIVEN an invalid change
- WHEN it is rejected
- THEN no organization-changed event is emitted
