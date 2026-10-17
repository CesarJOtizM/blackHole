# Delta for Site Rollout

## ADDED Requirements

### Requirement: Configuration-Only Customer Setup

A non-pilot customer MUST be brought to operation using only the guided setup, imports and configuration. The system MUST NOT contain code paths, builds or branches keyed to a specific tenant identifier; any per-tenant difference MUST be a configuration available to every tenant.

#### Scenario: Setup without code changes

- GIVEN a new non-pilot restaurant with its NIT documents
- WHEN it is onboarded through the guided setup
- THEN it reaches operation with no commit made for that customer

#### Scenario: Tenant-specific code detected

- GIVEN a change that branches on the new customer's identifier
- WHEN the release pipeline verifies it
- THEN the change is rejected

### Requirement: Same Release for Every Tenant

The new customer MUST run the same released artifact and version as the pilot tenants, in cloud and in any hybrid node.

#### Scenario: Version parity

- GIVEN the pilot running release N
- WHEN the new customer goes live
- THEN its cloud services and nodes report release N

#### Scenario: Node on previous version

- GIVEN the new customer's hybrid node still on release N-1 during a staged rollout
- WHEN it syncs with the cloud
- THEN sync is accepted under the previous-version compatibility rule

### Requirement: Gap Register

Any customer need that configuration cannot satisfy MUST be recorded as a product gap with its decision (configure, decline or plan for all tenants) and MUST NOT be built for that customer alone.

#### Scenario: Unsupported need

- GIVEN the customer asks for a behavior no configuration provides
- WHEN onboarding records it
- THEN a gap entry with decision and owner exists
- AND go-live proceeds without it

#### Scenario: Gap blocks go-live

- GIVEN a gap marked as blocking legal invoicing
- WHEN the go-live checklist is evaluated
- THEN go-live is not approved

### Requirement: Tenant Isolation Gate

Before go-live, the system MUST verify that the new tenant cannot read pilot data and the pilot cannot read the new tenant's data, both in the cloud database and on any node.

#### Scenario: Cross-tenant read

- GIVEN a user of the new customer
- WHEN they request a pilot site's orders by identifier
- THEN no data is returned

#### Scenario: Node credential scope

- GIVEN the new customer's hybrid node credential
- WHEN it attempts to sync a pilot site
- THEN the request is rejected

### Requirement: Go-Live Checklist

Go-live MUST require: active subscription, every taxpayer ready to invoice, each site in its chosen mode (cloud by default) with registered devices, printing working, support panel showing the site, and the first invoice accepted by Factus. In hybrid mode it MUST also require the node to have synced its organization structure.

#### Scenario: Cloud-mode go-live

- GIVEN a cloud-mode site with all checklist items met
- WHEN the first sale is invoiced
- THEN Factus accepts it and the site is marked live

#### Scenario: Taxpayer not ready

- GIVEN one taxpayer still awaiting Factus activation
- WHEN go-live is requested for its site
- THEN go-live is blocked and the missing item is named
