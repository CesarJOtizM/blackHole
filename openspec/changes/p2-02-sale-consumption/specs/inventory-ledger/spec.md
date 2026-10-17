# Inventory Ledger Specification

## Purpose

Define the append-only record of stock movements per inventory location, from which balances and costs derive (TRD-00 sec. 9.1, TRD-M4 sec. 2, 3 and 6, PRD-M4 rule 4).

## Requirements

### Requirement: Append-only Movements

Every stock change MUST be a movement with location, ingredient, signed quantity in base unit (scaled integer), unit cost, type, reference and occurrence time. Types MUST include purchase, sale consumption, sale return, waste, production consumption, production output, transfer out, transfer in and count adjustment. Movements MUST NOT be updated or deleted; corrections MUST be new movements.

#### Scenario: Movement recorded
- GIVEN the point-of-sale location of a site
- WHEN a sale consumption of 200 g of beef is registered
- THEN a movement of −200 g with type sale consumption and its reference is stored

#### Scenario: Edit attempt rejected
- GIVEN an existing movement
- WHEN any actor tries to change or delete it
- THEN the operation is rejected and the movement is unchanged

### Requirement: Derived Balance

The balance of an ingredient at a location MUST equal the sum of its movements, MUST be updated in the same transaction as the movement, and MUST NOT be editable directly. If the transaction fails, neither the movement nor the balance change MUST persist.

#### Scenario: Balance equals sum including negatives
- GIVEN movements +1000 g, −700 g and −500 g
- WHEN the balance is read
- THEN it is −200 g

#### Scenario: Failed write leaves no trace
- GIVEN a consumption of 3 ingredients
- WHEN storing the third movement fails
- THEN none of the 3 movements nor balance changes persist

### Requirement: Location Ownership by Operating Mode

Only the owner of a location MUST write its movements. In hybrid mode the site node MUST own its point-of-sale and site warehouses; in cloud mode the cloud MUST own them. A node MUST hold only its own locations.

#### Scenario: Hybrid site writes locally
- GIVEN a site in hybrid mode
- WHEN a movement is registered for its point-of-sale location
- THEN the node stores it on its local database and queues it for the cloud

#### Scenario: Stale owner rejects writes
- GIVEN a site switched from hybrid back to cloud (generation increased)
- WHEN the old node tries to write a movement
- THEN the write is rejected

### Requirement: Upward Synchronization

Node movements MUST reach the cloud through the outbox, after fiscal documents, sales and cash data, without duplication and preserving order per device. Cloud aggregates MUST rebuild the same balances.

#### Scenario: Outage then reconnect
- GIVEN a hybrid node offline for 2 hours with 300 movements
- WHEN connectivity returns
- THEN all 300 arrive once and cloud balances equal node balances

#### Scenario: Duplicate batch ignored
- GIVEN a batch already acknowledged by the cloud
- WHEN the node resends it
- THEN no movement is applied twice

### Requirement: Dialect Parity

The ledger MUST behave identically on SQLite (local-node) and PostgreSQL (api-cloud). In PostgreSQL every row MUST carry the tenant and be isolated by row-level security; SQLite holds a single tenant.

#### Scenario: Same balance in both stores
- GIVEN the same sequence of movements
- WHEN applied to the node store and the cloud store
- THEN both report identical balances

#### Scenario: Cross-tenant read blocked
- GIVEN two tenants in the cloud
- WHEN tenant A queries balances
- THEN no tenant B row is returned
