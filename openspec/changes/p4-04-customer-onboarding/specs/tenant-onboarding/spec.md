# Tenant Onboarding Specification

## Purpose

Bring a new customer company from creation to "ready to invoice" through a guided setup, with no custom development. Runs only in the cloud (api-cloud, PostgreSQL); new sites start in cloud mode and may enable hybrid later through existing organization flows.

## Requirements

### Requirement: Company Creation

The platform administrator MUST create the company, its taxpayers with fiscal profile, sites, plan and first owner through the organization capability, and the system MUST create the company document bag. The creation MUST be audited and MUST NOT leave the administrator with any role in the company.

#### Scenario: Company created

- GIVEN customer data with 2 taxpayers and 3 sites
- WHEN the platform administrator creates the company
- THEN company, taxpayers, sites, owner and an empty bag exist
- AND the creation is audited with the administrator's identity

#### Scenario: Duplicate taxpayer

- GIVEN a NIT already registered in another company
- WHEN the administrator registers it again
- THEN the request is rejected

### Requirement: NIT Activation Checklist

Each taxpayer MUST show its Factus activation requirements: Chamber of Commerce certificate under 30 days old, legal representative ID, RUT, DIAN numbering range linked to Factus and digital certificate. A taxpayer MUST NOT be marked ready while any requirement is missing or expired.

#### Scenario: All requirements complete

- GIVEN a taxpayer with every requirement uploaded and valid
- WHEN the checklist is evaluated
- THEN the taxpayer moves to awaiting Factus activation

#### Scenario: Expired Chamber of Commerce

- GIVEN a Chamber of Commerce certificate issued 45 days ago
- WHEN the checklist is evaluated
- THEN that requirement shows expired
- AND the taxpayer is not ready

### Requirement: Invoicing Readiness Check

A taxpayer MUST become ready to invoice only when its Factus credentials authenticate and every site billing under it has a numbering range assigned. Until then its sites MAY operate, and their invoices MUST stay pending.

#### Scenario: Ready after activation

- GIVEN Factus activated the NIT and each site has a range
- WHEN readiness is checked
- THEN the taxpayer is marked ready to invoice

#### Scenario: Site without range

- GIVEN valid credentials but one site with no numbering range
- WHEN readiness is checked
- THEN the taxpayer is not ready
- AND the missing site is named

### Requirement: Guided Setup

The owner MUST be guided step by step through brands, sites, kitchen stations, cash registers, warehouses and roles, with progress saved, and each step MUST use the same validations as manual configuration.

#### Scenario: Resume setup

- GIVEN an owner who completed 3 of 6 steps
- WHEN they return later
- THEN the setup resumes at step 4

#### Scenario: Invalid step

- GIVEN a site with no cash register defined
- WHEN the owner tries to finish setup
- THEN completion is blocked and the missing item is shown

### Requirement: Initial Data Import

The system MUST import menu, ingredients and recipes from files, applying each file all-or-nothing and reporting every invalid row. Imported products MUST be assignable to predefined tax profiles.

#### Scenario: Valid menu file

- GIVEN a menu file with 80 valid products
- WHEN it is imported
- THEN 80 products are published

#### Scenario: One bad row

- GIVEN a recipe file where one row references an unknown ingredient
- WHEN it is imported
- THEN nothing from that file is published
- AND the bad row and reason are reported

### Requirement: Predefined Tax Profiles

The guided setup MUST offer the predefined tax profiles validated by the accountant, and selecting one MUST configure the taxpayer without manual rate entry.

#### Scenario: INC restaurant profile

- GIVEN a taxpayer that is an INC-responsible restaurant
- WHEN the owner selects that predefined profile
- THEN its products compute INC with no manual rates

#### Scenario: No matching profile

- GIVEN a taxpayer whose regime matches no predefined profile
- WHEN setup reaches the tax step
- THEN the owner can configure a custom profile
- AND readiness requires it to be saved
